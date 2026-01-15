import React from 'react';
import { Conversation } from '@/types/inbox';
import { getChannelColorClass, getChannelBadgeClass, getChannelIcon, formatTime, formatDate } from '@/lib/channelUtils';
import { cn } from '@/lib/utils';

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const channelColor = getChannelColorClass(conversation.channel);
  const badgeClass = getChannelBadgeClass(conversation.channel);
  const channelIcon = getChannelIcon(conversation.channel);
  
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1 p-3 cursor-pointer transition-all duration-200 rounded-lg mx-2 my-1',
        channelColor,
        isSelected && 'ring-2 ring-primary shadow-md',
        'hover:shadow-sm hover:scale-[1.01]'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-lg">{channelIcon}</span>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-foreground truncate">
              {conversation.sender_name}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {conversation.thread_id}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(conversation.last_message_time)} {formatTime(conversation.last_message_time)}
          </span>
          {conversation.status === 'new' && (
            <span className="px-2 py-0.5 text-xs font-medium bg-status-new text-white rounded-full animate-pulse-soft">
              NEW
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-1">
        <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full capitalize', badgeClass)}>
          {conversation.channel}
        </span>
        <span className="text-xs text-muted-foreground">
          from: {conversation.message_from}
        </span>
      </div>
      
      {conversation.last_message && (
        <p className="text-sm text-muted-foreground truncate mt-1">
          {conversation.last_message}
        </p>
      )}
    </div>
  );
}
