import React from 'react';
import { Message } from '@/types/inbox';
import { formatTime } from '@/lib/channelUtils';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const content = isOutbound ? message.final_reply : message.user_message;
  const imageUrl = isOutbound ? message.agent_image_url : message.customer_image_url;

  if (!content && !imageUrl) return null;

  return (
    <div
      className={cn(
        'flex flex-col max-w-[75%] animate-fade-in',
        isOutbound ? 'ml-auto items-end' : 'mr-auto items-start'
      )}
    >
      {imageUrl && (
        <div
          className={cn(
            'rounded-2xl overflow-hidden mb-1 shadow-sm',
            isOutbound ? 'bg-message-outbound' : 'bg-message-inbound'
          )}
        >
          <img
            src={imageUrl}
            alt="Message attachment"
            className="max-w-full max-h-64 object-contain"
            loading="lazy"
          />
        </div>
      )}
      
      {content && (
        <div
          className={cn(
            'px-4 py-2 rounded-2xl shadow-sm',
            isOutbound
              ? 'bg-message-outbound text-message-outbound-foreground rounded-br-md'
              : 'bg-message-inbound text-message-inbound-foreground rounded-bl-md'
          )}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        </div>
      )}
      
      <span className="text-xs text-muted-foreground mt-1 px-2">
        {formatTime(message.uploaded_at)}
      </span>
    </div>
  );
}
