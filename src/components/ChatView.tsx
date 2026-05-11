import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Message, CHANNEL_WEBHOOKS } from '@/types/inbox';
import { fetchMessages, getLatestAiReply } from '@/lib/supabase';
import { getChannelBadgeClass, getChannelIcon } from '@/lib/channelUtils';
import { MessageBubble } from './MessageBubble';
import { Send, ImagePlus, X, Loader2, ArrowLeft, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { clearDraft, loadDraft, saveDraft, setActiveDraftState } from '@/lib/draftState';

interface ChatViewProps {
  conversation: Conversation | null;
  onBack?: () => void;
}

export function ChatView({ conversation, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [draftThreadId, setDraftThreadId] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (conversation) {
      setDraftThreadId(null);
      setSelectedMedia(null);
      setMediaPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadMessages();
    } else {
      setActiveDraftState(false);
    }
  }, [conversation?.thread_id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!conversation) return;
    if (draftThreadId !== conversation.thread_id) return;

    saveDraft(conversation.thread_id, replyText);
    setActiveDraftState(Boolean(replyText.trim()) || Boolean(selectedMedia));
  }, [conversation?.thread_id, draftThreadId, replyText, selectedMedia]);

  useEffect(() => {
    return () => setActiveDraftState(false);
  }, []);

  const loadMessages = async () => {
    if (!conversation) return;

    setLoading(true);
    const data = await fetchMessages(conversation.thread_id);
    setMessages(data);

    const savedDraft = loadDraft(conversation.thread_id);
    if (savedDraft) {
      setReplyText(savedDraft);
    } else {
      const aiReply = await getLatestAiReply(conversation.thread_id);
      setReplyText(aiReply || '');
    }

    setDraftThreadId(conversation.thread_id);
    setLoading(false);
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedMedia(file);
    const reader = new FileReader();
    reader.onload = (event) => setMediaPreview(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeMedia = () => {
    setSelectedMedia(null);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!conversation || (!replyText.trim() && !selectedMedia)) return;

    setSending(true);

    try {
      let agentImageUrl: string | null = null;

      if (selectedMedia) {
        setUploadingImage(true);

        try {
          agentImageUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedMedia);
          });
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

      const latestMessage = messages[messages.length - 1];
      const channel = conversation.channel.toLowerCase();
      const webhookUrl = CHANNEL_WEBHOOKS[channel] || CHANNEL_WEBHOOKS['whatsapp'];

      const payload: Record<string, string | null | undefined> = {
        id: latestMessage?.id || crypto.randomUUID(),
        channel: conversation.channel,
        thread_id: conversation.thread_id,
        message_from: conversation.message_from,
        message_to: conversation.message_to,
        sender_name: conversation.sender_name,
        user_type: 'agent',
        direction: 'outbound',
        status: 'answered',
        final_reply: replyText.trim() || null,
        uploaded_at: new Date().toISOString(),
      };

      if (agentImageUrl) payload.agent_image_url = agentImageUrl;

      if (channel === 'ebay') {
        const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound');

        if (lastInbound?.message_id_ebay) {
          const raw = lastInbound.message_id_ebay;
          const cleanId = typeof raw === 'string' && !raw.startsWith('[') ? raw : null;
          if (cleanId) payload.message_id_ebay = cleanId;
        }
        if (lastInbound?.item_id_ebay) {
          const raw = lastInbound.item_id_ebay;
          const cleanId = typeof raw === 'string' && !raw.startsWith('[') ? raw : null;
          if (cleanId) payload.item_id_ebay = cleanId;
        }
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to send message');

      toast({
        title: 'Sent!',
        description: 'Your reply has been sent successfully.',
      });

      clearDraft(conversation.thread_id);
      setReplyText('');
      removeMedia();
      setTimeout(loadMessages, 1000);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

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

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <div className="flex items-center gap-2 p-3 md:p-4 border-b border-border bg-card">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}

        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
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

          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge className={cn('capitalize text-xs', badgeClass)}>{conversation.channel}</Badge>
            <span className="text-[10px] md:text-xs text-muted-foreground truncate max-w-[100px] md:max-w-none">
              to: {conversation.message_to}
            </span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-3 md:p-4">
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

      <div className="p-3 md:p-4 border-t border-border bg-card max-h-[60vh] flex flex-col">
        {mediaPreview && (
          <div className="relative inline-block mb-3 shrink-0">
            {selectedMedia?.type.startsWith('video/') ? (
              <video src={mediaPreview} className="max-h-32 rounded-lg shadow-sm" controls />
            ) : (
              <img src={mediaPreview} alt="Selected" className="max-h-32 rounded-lg shadow-sm" />
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
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, window.innerHeight * 0.35) + 'px';
              }}
              placeholder="Type your reply..."
              className="min-h-[44px] max-h-[35vh] resize-none overflow-auto w-full"
              rows={1}
            />
          </div>

          <Button onClick={handleSend} disabled={sending || (!replyText.trim() && !selectedMedia)} className="shrink-0 mb-0.5">
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>

        {replyText && <p className="text-xs text-muted-foreground mt-2">Reply draft is saved locally until you send it.</p>}
      </div>
    </div>
  );
}
