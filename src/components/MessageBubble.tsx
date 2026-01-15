import React from 'react';
import { Message } from '@/types/inbox';
import { formatTime } from '@/lib/channelUtils';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  
  // Get content based on direction
  const content = isOutbound ? message.final_reply : message.user_message;
  
  // Get image URL - check both fields regardless of direction
  const imageUrl = message.customer_image_url || message.agent_image_url;
  const isCustomerImage = !!message.customer_image_url;

  // If no content and no image, don't render
  if (!content && !imageUrl) return null;

  // Determine alignment based on image ownership or message direction
  const alignRight = imageUrl ? !isCustomerImage : isOutbound;

  return (
    <div
      className={cn(
        'flex flex-col max-w-[75%] animate-fade-in',
        alignRight ? 'ml-auto items-end' : 'mr-auto items-start'
      )}
    >
      {imageUrl && (
        <div
          className={cn(
            'rounded-2xl overflow-hidden mb-1 shadow-sm p-1',
            alignRight ? 'bg-message-outbound' : 'bg-message-inbound'
          )}
        >
          <img
            src={imageUrl}
            alt="Message attachment"
            className="max-w-full max-h-64 object-contain rounded-xl"
            loading="lazy"
          />
        </div>
      )}
      
      {content && (
        <div
          className={cn(
            'px-4 py-2 rounded-2xl shadow-sm',
            alignRight
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
