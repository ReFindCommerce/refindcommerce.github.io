import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Channel, FilterOptions } from '@/types/inbox';
import { ConversationItem } from './ConversationItem';
import { FilterPanel } from './FilterPanel';
import { fetchConversations } from '@/lib/supabase';
import { useHiddenThreads } from '@/hooks/useHiddenThreads';
import { Search, Filter, Inbox, RefreshCw, Check } from 'lucide-react';
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
  const [hideMode, setHideMode] = useState(false);
  const [selectedToHide, setSelectedToHide] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    channels: [],
    thread_ids: [],
    message_to: [],
  });
  const isFirstLoad = useRef(true);
  
  const { hiddenThreadIds, hideThreads, showThreads, isHidden } = useHiddenThreads();

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

  const enterHideMode = () => {
    // Pre-select currently hidden threads
    setSelectedToHide([...hiddenThreadIds]);
    setHideMode(true);
  };

  const exitHideMode = () => {
    // Apply hide changes
    const toHide = selectedToHide.filter(id => !hiddenThreadIds.includes(id));
    const toShow = hiddenThreadIds.filter(id => !selectedToHide.includes(id));
    
    if (toHide.length > 0) {
      hideThreads(toHide);
    }
    if (toShow.length > 0) {
      showThreads(toShow);
    }
    
    setHideMode(false);
    setSelectedToHide([]);
  };

  const toggleHideSelection = (threadId: string) => {
    if (selectedToHide.includes(threadId)) {
      setSelectedToHide(prev => prev.filter(id => id !== threadId));
    } else {
      setSelectedToHide(prev => [...prev, threadId]);
    }
  };

  // In hide mode, show all conversations (including hidden) for selection
  // In normal mode, filter out hidden conversations
  const visibleConversations = hideMode 
    ? conversations 
    : conversations.filter(conv => !isHidden(conv.thread_id));

  const filteredConversations = visibleConversations.filter(conv => {
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
          {hideMode ? (
            <Button
              variant="default"
              size="sm"
              onClick={exitHideMode}
              className="gap-1"
            >
              <Check className="w-4 h-4" />
              Done
            </Button>
          ) : (
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
          )}
        </div>
        
        {hideMode && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md mb-4">
            Выберите чаты для скрытия. Отмеченные чаты не будут показываться.
          </div>
        )}
        
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
      {showFilters && !hideMode && (
        <FilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          onClose={() => setShowFilters(false)}
          onEnterHideMode={enterHideMode}
          hiddenCount={hiddenThreadIds.length}
        />
      )}

      {/* Conversations */}
      <ScrollArea className="flex-1 [&>div>div]:!overflow-visible">
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
          <div className="py-2 pr-2">
            {filteredConversations.map((conversation) => (
              <div key={conversation.thread_id} className="relative">
                {hideMode && (
                  <div 
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHideSelection(conversation.thread_id);
                    }}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all",
                      selectedToHide.includes(conversation.thread_id)
                        ? "bg-destructive border-destructive text-destructive-foreground"
                        : "bg-background border-muted-foreground/50 hover:border-primary"
                    )}>
                      {selectedToHide.includes(conversation.thread_id) && (
                        <Check className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                )}
                <div className={cn(hideMode && "ml-8")}>
                  <ConversationItem
                    conversation={conversation}
                    isSelected={selectedThreadId === conversation.thread_id}
                    onClick={() => !hideMode && onSelectConversation(conversation)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
