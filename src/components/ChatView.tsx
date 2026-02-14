import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Message, CHANNEL_WEBHOOKS } from '@/types/inbox';
import { fetchMessages, getLatestAiReply, uploadImage } from '@/lib/supabase';
import { getChannelBadgeClass, getChannelIcon, formatDateTime } from '@/lib/channelUtils';
import { MessageBubble } from './MessageBubble';
import { Send, ImagePlus, X, Loader2, ArrowLeft, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ChatViewProps {
  conversation: Conversation | null;
  onBack?: () => void;
}

export function ChatView({ conversation, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (conversation) {
      loadMessages();
    }
  }, [conversation?.thread_id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!conversation) return;
    
    setLoading(true);
    const data = await fetchMessages(conversation.thread_id);
    setMessages(data);
    
    // Get the latest AI reply for the input field
    const aiReply = await getLatestAiReply(conversation.thread_id);
    if (aiReply) {
      setReplyText(aiReply);
    } else {
      setReplyText('');
    }
    
    setLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!conversation || (!replyText.trim() && !selectedImage)) return;

    setSending(true);
    
    try {
      let agentImageUrl: string | null = null;

      // Upload image if selected - convert to base64 and send directly
      if (selectedImage) {
        setUploadingImage(true);
        
        try {
          // Convert image to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedImage);
          });
          
          // Use base64 directly as the image URL
          agentImageUrl = base64;
        } catch (error) {
          console.error('Error converting image:', error);
          toast({
            title: 'Error',
            description: 'Failed to process image. Please try again.',
            variant: 'destructive',
          });
          setSending(false);
          setUploadingImage(false);
          return;
        }
        
        setUploadingImage(false);
      }

      // Get the latest message data to use as base
      const latestMessage = messages[messages.length - 1];
      
      // Determine webhook URL based on channel
      const channel = conversation.channel.toLowerCase();
      const webhookUrl = CHANNEL_WEBHOOKS[channel] || CHANNEL_WEBHOOKS['whatsapp'];

      // Prepare the payload
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

      // Add image URL if present
      if (agentImageUrl) {
        payload.agent_image_url = agentImageUrl;
      }

      // Find eBay IDs across all messages (reverse to get most recent non-null value)
      if (channel === 'ebay') {
        const ebayMessageId = [...messages].reverse().find(m => m.message_id_ebay)?.message_id_ebay;
        const ebayItemId = [...messages].reverse().find(m => m.item_id_ebay)?.item_id_ebay;

        if (ebayMessageId) {
          payload.message_id_ebay = ebayMessageId;
        }
        if (ebayItemId) {
          payload.item_id_ebay = ebayItemId;
        }
      }

      // Send to webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      toast({
        title: 'Sent!',
        description: 'Your reply has been sent successfully.',
      });

      // Clear inputs
      setReplyText('');
      removeImage();
      
      // Reload messages after a short delay
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
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
            {channelIcon}
          </div>
          
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate">
              {conversation.sender_name}
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate">{conversation.thread_id}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <Badge className={cn('capitalize', badgeClass)}>
              {conversation.channel}
            </Badge>
            <span className="text-xs text-muted-foreground">
              to: {conversation.message_to}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
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
      <div className="p-4 border-t border-border bg-card">
        {/* Image Preview */}
        {imagePreview && (
          <div className="relative inline-block mb-3">
            <img
              src={imagePreview}
              alt="Selected"
              className="max-h-32 rounded-lg shadow-sm"
            />
            <button
              onClick={removeImage}
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
        
        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="shrink-0"
          >
            <ImagePlus className="w-5 h-5" />
          </Button>
          
          <Textarea
            value={replyText}
            onChange={(e) => {
              setReplyText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, window.innerHeight * 0.5) + 'px';
            }}
            placeholder="Type your reply..."
            className="min-h-[44px] max-h-[50vh] resize-y overflow-auto"
            rows={1}
            
          />
          
          <Button
            onClick={handleSend}
            disabled={sending || (!replyText.trim() && !selectedImage)}
            className="shrink-0"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        
        {replyText && (
          <p className="text-xs text-muted-foreground mt-2">
            💡 AI suggested reply loaded. Edit if needed, then press send.
          </p>
        )}
      </div>
    </div>
  );
}
