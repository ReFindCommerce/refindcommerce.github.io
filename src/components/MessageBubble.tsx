import React, { useState } from 'react';
import { Message } from '@/types/inbox';
import { formatTime } from '@/lib/channelUtils';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [imageOpen, setImageOpen] = useState(false);
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
    <>
      <div
        className={cn(
          'flex flex-col max-w-[75%] animate-fade-in',
          alignRight ? 'ml-auto items-end' : 'mr-auto items-start'
        )}
      >
        {imageUrl && (
          <div
            className={cn(
              'rounded-2xl overflow-hidden mb-1 shadow-sm p-1 cursor-pointer hover:opacity-90 transition-opacity',
              alignRight ? 'bg-message-outbound' : 'bg-message-inbound'
            )}
            onClick={() => setImageOpen(true)}
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

      {/* Image Lightbox */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-transparent border-none shadow-none">
          <button
            onClick={() => setImageOpen(false)}
            className="absolute top-2 right-2 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={imageUrl || ''}
            alt="Full size"
            className="max-w-full max-h-[85vh] object-contain rounded-lg mx-auto"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
