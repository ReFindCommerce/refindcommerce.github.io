import React, { useState } from 'react';
import { Message } from '@/types/inbox';
import { formatTime } from '@/lib/channelUtils';
import { cn } from '@/lib/utils';
import { cleanMessageText } from '@/lib/textFormat';
import { buildTranslateUrl, extractLinks, extractMediaAttachments } from '@/lib/messageParsing';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ExternalLink, Languages, Paperclip, X } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<ReturnType<typeof extractMediaAttachments>[number] | null>(null);
  const isOutbound = message.direction === 'outbound';
  
  // Get content based on direction
  const rawContent = isOutbound ? message.final_reply : message.user_message;
  const content = cleanMessageText(rawContent);
  const attachments = extractMediaAttachments(message);
  const inlineLinks = extractLinks(rawContent).filter((link) => !attachments.some((attachment) => attachment.url === link));
  const needsTranslation = !isOutbound && Boolean(content);

  if (!content && attachments.length === 0) return null;

  const alignRight = isOutbound;

  return (
    <>
      <div
        className={cn(
          'flex flex-col max-w-[85%] md:max-w-[75%] animate-fade-in overflow-hidden',
          alignRight ? 'ml-auto items-end' : 'mr-auto items-start'
        )}
      >
        {attachments.length > 0 && (
          <div className="grid gap-2 mb-1 max-w-full">
            {attachments.map((attachment) => (
              <div
                key={attachment.url}
                className={cn(
                  'rounded-2xl overflow-hidden shadow-sm p-1 hover:opacity-90 transition-opacity',
                  attachment.kind !== 'file' && 'cursor-pointer',
                  alignRight ? 'bg-message-outbound' : 'bg-message-inbound'
                )}
                onClick={() => {
                  if (attachment.kind === 'file') return;
                  setSelectedAttachment(attachment);
                  setMediaOpen(true);
                }}
              >
                {attachment.kind === 'video' ? (
                  <video
                    src={attachment.url}
                    className="max-w-full max-h-64 rounded-xl"
                    controls
                    preload="metadata"
                  />
                ) : attachment.kind === 'image' ? (
                  <img
                    src={attachment.url}
                    alt="Message attachment"
                    className="max-w-full max-h-64 object-contain rounded-xl"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-sm underline-offset-4 hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Paperclip className="h-4 w-4 shrink-0" />
                    Open attachment
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                )}
              </div>
            ))}
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
            <p className="text-sm whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{content}</p>
            {inlineLinks.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {inlineLinks.map((link) => (
                  <a
                    key={link}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs underline underline-offset-4 opacity-90"
                  >
                    Open link
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            )}
            {needsTranslation && (
              <a
                href={buildTranslateUrl(content)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4"
              >
                <Languages className="h-3 w-3" />
                Translate message
              </a>
            )}
          </div>
        )}
        
        <span className="text-xs text-muted-foreground mt-1 px-2">
          {formatTime(message.uploaded_at)}
        </span>
      </div>

      <Dialog open={mediaOpen} onOpenChange={setMediaOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-transparent border-none shadow-none">
          <button
            onClick={() => setMediaOpen(false)}
            className="absolute top-2 right-2 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {(selectedAttachment || attachments[0])?.kind === 'video' ? (
            <video
              src={(selectedAttachment || attachments[0])?.url || ''}
              className="max-w-full max-h-[85vh] rounded-lg mx-auto"
              controls
              autoPlay
            />
          ) : (
            <img
              src={(selectedAttachment || attachments[0])?.url || ''}
              alt="Full size"
              className="max-w-full max-h-[85vh] object-contain rounded-lg mx-auto"
              referrerPolicy="no-referrer"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
