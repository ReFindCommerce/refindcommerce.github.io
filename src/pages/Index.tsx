import React, { useState } from 'react';
import { Conversation } from '@/types/inbox';
import { ConversationList } from '@/components/ConversationList';
import { ChatView } from '@/components/ChatView';
import { cn } from '@/lib/utils';

const Index = () => {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [conversationRefreshToken, setConversationRefreshToken] = useState(0);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowChat(true);
  };

  const handleBack = () => {
    setShowChat(false);
  };

  const handleMarkedRead = () => {
    setSelectedConversation(null);
    setShowChat(false);
    setConversationRefreshToken((value) => value + 1);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Conversation List - Hidden on mobile when chat is open */}
      <div
        className={cn(
          'w-full md:w-[380px] lg:w-[420px] xl:w-[480px] shrink-0 h-full',
          showChat && 'hidden md:flex md:flex-col'
        )}
      >
        <ConversationList
          selectedConversationKey={selectedConversation?.conversation_key || null}
          onSelectConversation={handleSelectConversation}
          refreshToken={conversationRefreshToken}
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
          onMarkedRead={handleMarkedRead}
        />
      </div>
    </div>
  );
};

export default Index;
