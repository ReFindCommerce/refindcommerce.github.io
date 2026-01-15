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
        'flex flex-col gap-2 p-3 cursor-pointer transition-all duration-200 rounded-lg mx-2 my-1 overflow-visible',
        channelColor,
        isSelected && 'ring-2 ring-primary shadow-md',
        'hover:shadow-sm hover:scale-[1.01]'
      )}
    >
      {/* Row 1: Name */}
      <div className="flex items-center gap-2">
        <span className="text-lg shrink-0">{channelIcon}</span>
        <span className="font-semibold text-foreground truncate">
          {conversation.sender_name}
        </span>
      </div>
      
      {/* Row 2: Thread ID + Time */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{conversation.thread_id}</span>
        <span className="whitespace-nowrap shrink-0">
          {formatDate(conversation.last_message_time)} {formatTime(conversation.last_message_time)}
        </span>
      </div>
      
      {/* Row 3: Channel badge + Status + From */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full capitalize', badgeClass)}>
          {conversation.channel}
        </span>
        <span className={cn(
          'px-2 py-0.5 text-xs font-bold rounded-full uppercase',
          conversation.status === 'new' 
            ? 'bg-status-new text-white animate-pulse-soft' 
            : 'bg-status-answered text-white'
        )}>
          {conversation.status === 'new' ? 'NEW' : 'ANSWERED'}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          from: {conversation.message_from}
        </span>
      </div>
      
      {/* Row 4: Last message preview */}
      {conversation.last_message && (
        <p className="text-sm text-muted-foreground truncate">
          {conversation.last_message}
        </p>
      )}
    </div>
  );
}
