import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Channel, FilterOptions } from '@/types/inbox';
import { ConversationItem } from './ConversationItem';
import { FilterPanel } from './FilterPanel';
import { fetchConversations } from '@/lib/supabase';
import { Search, Filter, Inbox, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  selectedThreadId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
}

export function ConversationList({ selectedThreadId, onSelectConversation }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    channels: [],
    thread_ids: [],
    message_to: [],
  });
  const isFirstLoad = useRef(true);

  const loadConversations = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    const data = await fetchConversations({
      channels: filters.channels.length > 0 ? filters.channels : undefined,
      thread_ids: filters.thread_ids.length > 0 ? filters.thread_ids : undefined,
      message_to: filters.message_to.length > 0 ? filters.message_to : undefined,
    });
    setConversations(data);
    setLoading(false);
    isFirstLoad.current = false;
  };

  useEffect(() => {
    loadConversations(true);
  }, [filters]);

  // Silent refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => loadConversations(false), 10000);
    return () => clearInterval(interval);
  }, [filters]);

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.sender_name.toLowerCase().includes(query) ||
      conv.thread_id.toLowerCase().includes(query) ||
      conv.message_from.toLowerCase().includes(query) ||
      conv.channel.toLowerCase().includes(query)
    );
  });

  const hasActiveFilters = filters.channels.length > 0 || filters.thread_ids.length > 0 || filters.message_to.length > 0;

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Inbox className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Inbox</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => loadConversations(true)}
              className="h-8 w-8"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant={hasActiveFilters ? "default" : "ghost"}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 w-8"
              title="Filter"
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background"
          />
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Inbox className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No conversations found</p>
          </div>
        ) : (
          <div className="py-2">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.thread_id}
                conversation={conversation}
                isSelected={selectedThreadId === conversation.thread_id}
                onClick={() => onSelectConversation(conversation)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
