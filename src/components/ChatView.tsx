import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Conversation, Message, CHANNEL_WEBHOOKS } from '@/types/inbox';
import { fetchMessages, getLatestAiDraft } from '@/lib/supabase';
import { getChannelBadgeClass, getChannelIcon } from '@/lib/channelUtils';
import { MessageBubble } from './MessageBubble';
import { Send, ImagePlus, X, Loader2, ArrowLeft, User, RefreshCw, Languages, ExternalLink, Gauge, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { clearDraft, loadDraftState, saveDraft, setActiveDraftState } from '@/lib/draftState';
import { buildTranslateUrl, extractContactInfo } from '@/lib/messageParsing';
import { cleanMessageText, formatSuggestedReply } from '@/lib/textFormat';
import { useAuthGate } from './AuthGate';
import { assertGmailSenderRule } from '@/lib/gmailSenderRules';
import { getWhatsappReplyWindowDescription, getWhatsappReplyWindowStatus } from '@/lib/whatsappReplyWindow';

interface ChatViewProps {
  conversation: Conversation | null;
  onBack?: () => void;
}

const SEND_TIMEOUT_MS = 45_000;
const STUCK_SEND_RECOVERY_MS = 60_000;
const MESSAGE_LOAD_TIMEOUT_MS = 15_000;
const ATTACHMENT_READ_TIMEOUT_MS = 20_000;

export function ChatView({ conversation, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiConfidenceReason, setAiConfidenceReason] = useState<string | null>(null);
  const [draftIsUserEdited, setDraftIsUserEdited] = useState(false);
  const [draftThreadId, setDraftThreadId] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesScrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRetryTimersRef = useRef<number[]>([]);
  const sendStartedAtRef = useRef<number | null>(null);
  const loadMessagesRef = useRef<() => void>(() => undefined);
  const { toast } = useToast();
  const { lockInbox } = useAuthGate();
  const latestMessageId = messages[messages.length - 1]?.id;
  const conversationKey = conversation?.conversation_key || null;
  const gmailMessageTo = conversation?.channel === 'gmail' ? conversation.message_to : undefined;

  useEffect(() => {
    if (conversation) {
      setDraftThreadId(null);
      setSelectedMedia(null);
      setMediaPreview(null);
      setDraftIsUserEdited(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      loadMessages();
    } else {
      setMessages([]);
      setReplyText('');
      setAiConfidence(null);
      setAiConfidenceReason(null);
      setDraftIsUserEdited(false);
      setActiveDraftState(false);
    }
  }, [conversationKey]);

  useLayoutEffect(() => {
    if (!loading && messages.length > 0) {
      queueScrollToBottom();
    }

    return clearScrollRetries;
  }, [loading, latestMessageId, conversationKey]);

  useEffect(() => {
    if (!conversation) return;
    if (draftThreadId !== conversation.conversation_key) return;

    if (draftIsUserEdited) {
      saveDraft(conversation.conversation_key, replyText);
    }
    setActiveDraftState(Boolean(replyText.trim()) || Boolean(selectedMedia));
  }, [conversationKey, draftThreadId, draftIsUserEdited, replyText, selectedMedia]);

  useEffect(() => {
    return () => {
      clearScrollRetries();
      setActiveDraftState(false);
    };
  }, []);

  useEffect(() => {
    return () => revokePreviewUrl(mediaPreview);
  }, [mediaPreview]);

  const loadMessages = async () => {
    if (!conversation) return;
    
    setLoading(true);
    try {
      const [data, aiDraft] = await withTimeout(
        Promise.all([
          fetchMessages(conversation.thread_id, gmailMessageTo),
          getLatestAiDraft(conversation.thread_id, gmailMessageTo),
        ]),
        MESSAGE_LOAD_TIMEOUT_MS,
        'Conversation load timed out.'
      );
      setMessages(data);
      
      const savedDraft = loadDraftState(conversation.conversation_key);

      if (savedDraft.value && !savedDraft.isLegacy) {
        setReplyText(savedDraft.value);
        setAiConfidence(null);
        setAiConfidenceReason(null);
        setDraftIsUserEdited(true);
      } else if (aiDraft) {
        clearDraft(conversation.conversation_key);
        setReplyText(aiDraft.reply);
        setAiConfidence(aiDraft.confidence);
        setAiConfidenceReason(aiDraft.confidenceReason);
        setDraftIsUserEdited(false);
      } else if (savedDraft.value) {
        setReplyText(savedDraft.value);
        setAiConfidence(null);
        setAiConfidenceReason(null);
        setDraftIsUserEdited(false);
      } else {
        setReplyText('');
        setAiConfidence(null);
        setAiConfidenceReason(null);
        setDraftIsUserEdited(false);
      }

      setDraftThreadId(conversation.conversation_key);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast({
        title: 'Could not load messages',
        description: 'Please try refreshing this conversation.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const clearScrollRetries = () => {
    scrollRetryTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    scrollRetryTimersRef.current = [];
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const viewport = messagesScrollAreaRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]'
    );

    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  const queueScrollToBottom = () => {
    clearScrollRetries();
    scrollToBottom();

    window.requestAnimationFrame(() => {
      scrollToBottom();
      window.requestAnimationFrame(() => scrollToBottom());
    });

    scrollRetryTimersRef.current = [50, 250, 750].map((delay) =>
      window.setTimeout(() => scrollToBottom(), delay)
    );
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDraftIsUserEdited(true);
      setSelectedMedia(file);
      setMediaPreview((currentPreview) => {
        revokePreviewUrl(currentPreview);
        return URL.createObjectURL(file);
      });
    }
  };

  const removeMedia = () => {
    revokePreviewUrl(mediaPreview);
    setSelectedMedia(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!conversation || (!replyText.trim() && !selectedMedia)) return;

    if (!navigator.onLine) {
      toast({
        title: 'You appear to be offline',
        description: 'Please reconnect, then try sending again.',
        variant: 'destructive',
      });
      return;
    }

    const whatsappReplyWindow = getWhatsappReplyWindowStatus(conversation.channel, messages);
    if (whatsappReplyWindow.applies && !whatsappReplyWindow.canSendFreeform) {
      toast({
        title: 'WhatsApp reply window closed',
        description:
          getWhatsappReplyWindowDescription(whatsappReplyWindow) ||
          'Use an approved WhatsApp template or ask the customer to message again before replying here.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    sendStartedAtRef.current = Date.now();
    
    try {
      const trimmedReply = formatSuggestedReply(replyText).trim();
      let agentImageUrl: string | null = null;

      if (selectedMedia) {
        setUploadingImage(true);
        
        try {
          agentImageUrl = await readFileAsDataUrlWithTimeout(selectedMedia, ATTACHMENT_READ_TIMEOUT_MS);
        } catch (error) {
          console.error('Error converting attachment:', error);
          toast({
            title: 'Error',
            description: 'Failed to process attachment. Please try again.',
            variant: 'destructive',
          });
          setSending(false);
          setUploadingImage(false);
          return;
        }
        
        setUploadingImage(false);
      }

      // Get the latest message data to use as base
      const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound');

      if (!lastInbound) {
        throw new Error('No inbound customer message found for this conversation.');
      }

      if (
        !conversation.thread_id ||
        conversation.thread_id === 'unknown-thread' ||
        !conversation.message_from ||
        conversation.message_from === 'unknown-customer'
      ) {
        throw new Error('This conversation is missing the identifiers needed to send a reply.');
      }

      const gmailMessageId = lastInbound?.gmail_message_id || lastInbound?.message_id_ebay || undefined;
      const gmailThreadId = lastInbound?.gmail_thread_id || conversation.thread_id;
      const channel = conversation.channel.toLowerCase();
      const gmailInboxAddress = lastInbound?.message_to || conversation.message_to;
      const gmailSenderRule = channel === 'gmail' ? assertGmailSenderRule(gmailInboxAddress) : null;
      const recentHistory = messages.slice(-12).map((message) => ({
        direction: message.direction,
        at: message.uploaded_at,
        text: cleanMessageText(message.user_message || message.final_reply || message.ai_reply),
      }));
      const extractedContact = extractContactInfo(lastInbound?.user_message || '');
      
      // Determine webhook URL based on channel
      const webhookUrl = CHANNEL_WEBHOOKS[channel] || CHANNEL_WEBHOOKS['whatsapp'];

      // Prepare the payload
      const payload: Record<string, string | null | undefined> = {
        id: crypto.randomUUID(),
        channel: conversation.channel,
        thread_id: conversation.thread_id,
        message_from: conversation.message_from,
        message_to: gmailSenderRule?.inboxAddress || conversation.message_to,
        sender_name: conversation.sender_name,
        user_type: 'agent',
        direction: 'outbound',
        status: 'answered',
        final_reply: trimmedReply || null,
        uploaded_at: new Date().toISOString(),
        reply_mode: channel === 'gmail' ? 'thread_reply' : 'channel_reply',
        email_thread_id: channel === 'gmail' ? gmailThreadId : undefined,
        gmail_thread_id: channel === 'gmail' ? gmailThreadId : undefined,
        gmail_message_id: channel === 'gmail' ? gmailMessageId : undefined,
        in_reply_to: channel === 'gmail' ? gmailMessageId : undefined,
        original_message_from: lastInbound?.message_from || conversation.message_from,
        original_message_to: gmailSenderRule?.inboxAddress || lastInbound?.message_to || conversation.message_to,
        mailbox_recipient: gmailSenderRule?.inboxAddress,
        required_from_alias: gmailSenderRule?.fromEmail,
        expected_from_alias: gmailSenderRule?.fromEmail,
        outbound_sender_email: gmailSenderRule?.fromEmail,
        outbound_sender_name: gmailSenderRule?.fromName,
        reply_to_email: gmailSenderRule?.fromEmail,
        resolved_customer_email: extractedContact.email || undefined,
        resolved_customer_phone: extractedContact.phone || undefined,
        latest_customer_message: cleanMessageText(lastInbound?.user_message),
        email_subject: lastInbound?.subject_ebay_message || undefined,
        subject_ebay_message: lastInbound?.subject_ebay_message || undefined,
        conversation_history: JSON.stringify(recentHistory),
      };

      // Add image URL if present
      if (agentImageUrl) {
        payload.agent_image_url = agentImageUrl;
      }

      // Find eBay IDs from the last inbound message only
      if (channel === 'ebay') {
        if (lastInbound?.message_id_ebay) {
          // Extract plain string ID, ignoring any nested arrays from previous sends
          const raw = lastInbound.message_id_ebay;
          const cleanId = typeof raw === 'string' && !raw.startsWith('[') ? raw : null;
          if (cleanId) {
            payload.message_id_ebay = cleanId;
          }
        }
        if (lastInbound?.item_id_ebay) {
          const raw = lastInbound.item_id_ebay;
          const cleanId = typeof raw === 'string' && !raw.startsWith('[') ? raw : null;
          if (cleanId) {
            payload.item_id_ebay = cleanId;
          }
        }
      }

      // Send to webhook
      const response = await postJsonWithTimeout(webhookUrl, payload, SEND_TIMEOUT_MS);

      if (!response.ok) {
        throw new Error(await getWebhookFailureMessage(response));
      }

      sendStartedAtRef.current = null;

      toast({
        title: 'Sent!',
        description: 'Your reply has been sent successfully.',
      });

      // Clear inputs
      clearDraft(conversation.conversation_key);
      setReplyText('');
      setAiConfidence(null);
      setAiConfidenceReason(null);
      setDraftIsUserEdited(false);
      removeMedia();
      
      // Reload messages after a short delay
      setTimeout(loadMessages, 1000);

    } catch (error) {
      console.error('Error sending message:', error);
      const timedOut = isAbortError(error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message. Please try again.';
      toast({
        title: timedOut ? 'Send timed out' : 'Error',
        description: getSendErrorDescription(errorMessage, timedOut),
        variant: 'destructive',
      });

      if (timedOut) {
        setTimeout(loadMessages, 1000);
      }
    } finally {
      sendStartedAtRef.current = null;
      setUploadingImage(false);
      setSending(false);
    }
  };
  loadMessagesRef.current = loadMessages;

  useEffect(() => {
    const recoverStuckSend = () => {
      if (!sendStartedAtRef.current) return;
      if (Date.now() - sendStartedAtRef.current < STUCK_SEND_RECOVERY_MS) return;

      sendStartedAtRef.current = null;
      setSending(false);
      setUploadingImage(false);

      toast({
        title: 'Send check reset',
        description: 'The mobile app was still waiting for a send response, so the conversation has been refreshed before retrying.',
      });
      loadMessagesRef.current();
    };

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        recoverStuckSend();
      }
    };

    const handleOnline = () => {
      recoverStuckSend();
      loadMessagesRef.current();
    };

    window.addEventListener('focus', recoverStuckSend);
    window.addEventListener('pageshow', recoverStuckSend);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      window.removeEventListener('focus', recoverStuckSend);
      window.removeEventListener('pageshow', recoverStuckSend);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [conversationKey, toast]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <User className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Select a conversation</p>
          <p className="text-sm">Choose a chat from the list to start messaging</p>
        </div>
      </div>
    );
  }

  const channelIcon = getChannelIcon(conversation.channel);
  const badgeClass = getChannelBadgeClass(conversation.channel);
  const latestInboundMessage = [...messages].reverse().find((message) => message.direction === 'inbound');
  const latestInboundText = cleanMessageText(latestInboundMessage?.user_message);
  const showTranslationTools = Boolean(latestInboundText);
  const inferredContact = extractContactInfo(latestInboundMessage?.user_message);
  const showAiConfidence = Boolean(replyText.trim()) && !draftIsUserEdited;
  const confidenceLabel = getConfidenceLabel(aiConfidence);
  const confidenceClass = getConfidenceClass(aiConfidence);
  const whatsappReplyWindow = getWhatsappReplyWindowStatus(conversation.channel, messages);
  const whatsappReplyWindowDescription = loading ? null : getWhatsappReplyWindowDescription(whatsappReplyWindow);
  const sendDisabled =
    sending ||
    Boolean(whatsappReplyWindowDescription) ||
    (!replyText.trim() && !selectedMedia);

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 p-3 md:flex-nowrap md:gap-3 md:p-4 border-b border-border bg-card">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        
        <div className="flex min-w-0 flex-1 basis-0 items-center gap-2 md:gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-muted flex items-center justify-center text-base md:text-lg shrink-0">
            {channelIcon}
          </div>
          
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm md:text-base text-foreground truncate">
              {conversation.sender_name}
            </h2>
            <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
              <span className="truncate">{conversation.thread_id}</span>
            </div>
          </div>

        </div>

        <div className={cn(
          'flex basis-full items-center justify-between gap-2 min-w-0',
          onBack && 'pl-10',
          'md:basis-auto md:justify-end md:pl-0'
        )}>
          <div className="flex min-w-0 items-center gap-2">
            <Badge className={cn('capitalize text-xs', badgeClass)}>
              {conversation.channel}
            </Badge>
            <span className="min-w-0 truncate text-[10px] md:text-xs text-muted-foreground max-w-[52vw] sm:max-w-[240px] md:max-w-none">
              to: {conversation.message_to}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={loadMessages}
              className="h-8 w-8"
              title="Refresh conversation"
              disabled={loading}
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={lockInbox}
              className="h-8 w-8 px-0 sm:w-auto sm:px-2"
              title="Lock inbox"
              type="button"
            >
              <LockKeyhole className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-1">Lock</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea
        ref={messagesScrollAreaRef}
        className="flex-1 p-3 md:p-4"
        onLoadCapture={queueScrollToBottom}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No messages yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 md:p-4 border-t border-border bg-card max-h-[60vh] flex flex-col">
        {(showTranslationTools || inferredContact.email || inferredContact.phone || replyText.trim()) && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {showTranslationTools && latestInboundText && (
              <a
                href={buildTranslateUrl(latestInboundText)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium text-foreground hover:bg-muted"
              >
                <Languages className="h-3.5 w-3.5" />
                Translate customer message
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {replyText.trim() && (
              <a
                href={buildTranslateUrl(replyText, 'en')}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium text-foreground hover:bg-muted"
              >
                <Languages className="h-3.5 w-3.5" />
                Translate reply to English
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {showAiConfidence && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium',
                  confidenceClass
                )}
                title={aiConfidenceReason || 'Confidence is based on approved knowledge matches and thread context.'}
              >
                <Gauge className="h-3.5 w-3.5" />
                AI confidence: {aiConfidence !== null ? `${aiConfidence}% ${confidenceLabel}` : 'pending'}
              </span>
            )}
            {(inferredContact.email || inferredContact.phone) && (
              <span className="rounded-md bg-muted px-2 py-1">
                Detected contact: {inferredContact.email || inferredContact.phone}
              </span>
            )}
          </div>
        )}
        {/* Attachment Preview */}
        {mediaPreview && (
          <div className="relative inline-block mb-3 shrink-0">
            {selectedMedia?.type.startsWith('video/') ? (
              <video
                src={mediaPreview}
                className="max-h-32 rounded-lg shadow-sm"
                controls
              />
            ) : (
              <img
                src={mediaPreview}
                alt="Selected"
                className="max-h-32 rounded-lg shadow-sm"
              />
            )}
            <button
              onClick={removeMedia}
              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {uploadingImage && (
              <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        )}
        
        <div className="flex items-end gap-2 min-h-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleMediaSelect}
            accept="image/*,video/*"
            className="hidden"
          />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="shrink-0 mb-0.5"
            title="Attach image or video"
          >
            <ImagePlus className="w-5 h-5" />
          </Button>
          
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            <Textarea
              value={replyText}
              onChange={(e) => {
                setReplyText(e.target.value);
                setAiConfidence(null);
                setAiConfidenceReason(null);
                setDraftIsUserEdited(true);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, window.innerHeight * 0.35) + 'px';
              }}
              placeholder="Type your reply..."
              className="min-h-[44px] max-h-[35vh] resize-none overflow-auto w-full"
              rows={1}
            />
          </div>
          
          <Button
            onClick={handleSend}
            disabled={sendDisabled}
            className="shrink-0 mb-0.5"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        
        {replyText && !whatsappReplyWindowDescription && (
          <p className="text-xs text-muted-foreground mt-2">
            AI suggested reply loaded. Edit if needed, then press send.
          </p>
        )}
        {whatsappReplyWindowDescription && (
          <p className="text-xs text-destructive mt-2">
            {whatsappReplyWindowDescription}
          </p>
        )}
      </div>
    </div>
  );
}

async function postJsonWithTimeout(
  url: string,
  payload: Record<string, string | null | undefined>,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof window.setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  });
}

function readFileAsDataUrlWithTimeout(file: File, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reader.abort();
      reject(new Error('Attachment processing timed out. Please try a smaller file.'));
    }, timeoutMs);

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      callback();
    };

    reader.onload = () => {
      settle(() => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Attachment could not be read. Please try again.'));
      });
    };
    reader.onerror = () => settle(() => reject(reader.error || new Error('Attachment could not be read.')));
    reader.onabort = () => settle(() => reject(new Error('Attachment processing was cancelled.')));
    reader.readAsDataURL(file);
  });
}

function revokePreviewUrl(url: string | null): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function getWebhookFailureMessage(response: Response): Promise<string> {
  const details = await response.text().catch(() => '');
  const cleanedDetails = summarizeResponseDetails(details);
  if (!cleanedDetails) {
    return `The send workflow returned ${response.status}.`;
  }

  return `The send workflow returned ${response.status}: ${cleanedDetails}`;
}

function summarizeResponseDetails(details: string): string {
  const trimmed = details.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed);
    const message = parsed.message || parsed.error || parsed.description;
    if (typeof message === 'string') {
      return truncateErrorText(message);
    }
  } catch {
    // Fall through to plain text cleanup.
  }

  return truncateErrorText(trimmed.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

function truncateErrorText(text: string): string {
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function getSendErrorDescription(errorMessage: string, timedOut: boolean): string {
  if (timedOut) {
    return 'The mobile app stopped waiting for the send response. Please check the refreshed conversation before retrying, to avoid sending twice.';
  }

  if (errorMessage.startsWith('Blocked Gmail send')) {
    return errorMessage;
  }

  if (errorMessage.startsWith('The send workflow returned')) {
    return errorMessage;
  }

  return 'Failed to send message. Please try again.';
}

function getConfidenceLabel(confidence: number | null): string {
  if (confidence === null) return '';
  if (confidence >= 85) return 'high';
  if (confidence >= 65) return 'medium';
  return 'low';
}

function getConfidenceClass(confidence: number | null): string {
  if (confidence === null) return 'text-muted-foreground';
  if (confidence >= 85) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (confidence >= 65) return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-destructive/30 bg-destructive/10 text-destructive';
}
