import React, { useState } from 'react';
import { Conversation } from '@/types/inbox';
import { ConversationList } from '@/components/ConversationList';
import { ChatView } from '@/components/ChatView';
import { cn } from '@/lib/utils';

const Index = () => {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showChat, setShowChat] = useState(false);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowChat(true);
  };

  const handleBack = () => {
    setShowChat(false);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Conversation List - Hidden on mobile when chat is open */}
      <div
        className={cn(
          'w-full md:w-[420px] lg:w-[480px] shrink-0 h-full',
          showChat && 'hidden md:flex md:flex-col'
        )}
      >
        <ConversationList
          selectedThreadId={selectedConversation?.thread_id || null}
          onSelectConversation={handleSelectConversation}
        />
      </div>

      {/* Chat View */}
      <div
        className={cn(
          'flex-1 h-full',
          !showChat && 'hidden md:flex'
        )}
      >
        <ChatView
          conversation={selectedConversation}
          onBack={handleBack}
        />
      </div>
    </div>
  );
};

export default Index;
