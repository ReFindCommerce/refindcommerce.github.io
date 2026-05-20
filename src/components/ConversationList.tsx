import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, Channel, FilterOptions } from '@/types/inbox';
import { ConversationItem } from './ConversationItem';
import { FilterPanel } from './FilterPanel';
import { InstallAppButton } from './InstallAppButton';
import { NotificationButton } from './NotificationButton';
import { AppUpdateButton } from './AppUpdateButton';
import { fetchConversations } from '@/lib/supabase';
import { useHiddenThreads } from '@/hooks/useHiddenThreads';
import { Search, Filter, Inbox, RefreshCw, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { normalizeCompactText, normalizeSearchText } from '@/lib/textFormat';

interface ConversationListProps {
  selectedConversationKey: string | null;
  onSelectConversation: (conversation: Conversation) => void;
}

const CONVERSATION_ARCHIVE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const ANSWERED_ARCHIVE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export function ConversationList({ selectedConversationKey, onSelectConversation }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [hideMode, setHideMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedToHide, setSelectedToHide] = useState<string[]>([]);
  const [hideSelectionInitialized, setHideSelectionInitialized] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    channels: [],
    thread_ids: [],
    message_to: [],
  });
  const isFirstLoad = useRef(true);
  const loadRequestId = useRef(0);
  
  const { hiddenThreadIds, hideThreads, showThreads, isHidden, loading: hiddenLoading } = useHiddenThreads();
  const hasActiveFilters = filters.channels.length > 0 || filters.thread_ids.length > 0 || filters.message_to.length > 0;
  const hasSearch = Boolean(searchQuery.trim());
  const shouldIncludeArchived = hideMode || hasSearch || hasActiveFilters;

  const loadConversations = useCallback(async (showLoader = false) => {
    const requestId = ++loadRequestId.current;

    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const data = await fetchConversations({
        channels: filters.channels.length > 0 ? filters.channels : undefined,
        thread_ids: filters.thread_ids.length > 0 ? filters.thread_ids : undefined,
        message_to: filters.message_to.length > 0 ? filters.message_to : undefined,
        includeArchived: shouldIncludeArchived,
      });

      if (requestId !== loadRequestId.current) return;

      setConversations(data);
      setLoadError(null);
      isFirstLoad.current = false;
    } catch (error) {
      console.error('Failed to refresh conversations:', error);
      if (requestId === loadRequestId.current) {
        setLoadError(showLoader || conversations.length === 0 ? 'Refresh failed. Please try again.' : null);
      }
    } finally {
      if (requestId === loadRequestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filters, shouldIncludeArchived, conversations.length]);

  useEffect(() => {
    loadConversations(true);
  }, [loadConversations]);

  // Silent refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => loadConversations(false), 10000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const enterHideMode = () => {
    // Start hide mode; selection will be initialized once hidden threads are loaded
    setHideMode(true);
    setHideSelectionInitialized(false);
  };

  useEffect(() => {
    if (!hideMode) return;
    if (hideSelectionInitialized) return;
    if (hiddenLoading) return;

    // Pre-select currently hidden threads (so checkmarks stay when re-opening)
    setSelectedToHide([...hiddenThreadIds]);
    setHideSelectionInitialized(true);
  }, [hideMode, hideSelectionInitialized, hiddenLoading, hiddenThreadIds]);

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
    setHideSelectionInitialized(false);
  };

  const toggleHideSelection = (threadId: string) => {
    if (selectedToHide.includes(threadId)) {
      setSelectedToHide(prev => prev.filter(id => id !== threadId));
    } else {
      setSelectedToHide(prev => [...prev, threadId]);
    }
  };

  const query = normalizeSearchText(searchQuery);
  const compactQuery = normalizeCompactText(searchQuery);
  const baseConversations = shouldIncludeArchived
    ? conversations
    : conversations.filter((conv) => !isArchivedDefaultConversation(conv));
  const visibleConversations = hideMode
    ? baseConversations
    : baseConversations.filter(conv => !isHidden(conv.thread_id));

  const filteredConversations = visibleConversations.filter((conv) => {
    if (!query) return true;

    const searchable = normalizeSearchText([
      conv.sender_name,
      conv.thread_id,
      conv.message_from,
      conv.message_to,
      conv.channel,
      conv.status,
      conv.last_message,
    ].filter(Boolean).join(' '));
    const compactSearchable = normalizeCompactText(searchable);

    return (
      searchable.includes(query) ||
      query.split(' ').every((term) => searchable.includes(term)) ||
      (!!compactQuery && compactSearchable.includes(compactQuery))
    );
  });

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      <div className="p-3 md:p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            <h1 className="text-lg md:text-xl font-bold text-foreground">Inbox</h1>
          </div>
          {hideMode ? (
            <Button variant="default" size="sm" onClick={exitHideMode} className="gap-1">
              <Check className="w-4 h-4" />
              Done
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <AppUpdateButton />
              <NotificationButton />
              <InstallAppButton />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => loadConversations(true)}
                className="h-8 w-8"
                title="Refresh"
                disabled={loading || refreshing}
              >
                <RefreshCw className={cn('w-4 h-4', (loading || refreshing) && 'animate-spin')} />
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
            Select conversations to hide. Checked conversations will not show in the normal inbox.
          </div>
        )}
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 bg-background"
          />
          {hasSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {(hasSearch || hasActiveFilters) && !loading && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing {filteredConversations.length} of {visibleConversations.length} conversations
            {hasActiveFilters ? ' after filters' : ''}
          </p>
        )}

        {loadError && (
          <p className="mt-2 text-xs text-destructive">{loadError}</p>
        )}
      </div>

      {showFilters && !hideMode && (
        <FilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          onClose={() => setShowFilters(false)}
          onEnterHideMode={enterHideMode}
          hiddenCount={hiddenThreadIds.length}
        />
      )}

      <ScrollArea className="flex-1 [&>div>div]:!overflow-visible">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Inbox className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">
              {hasSearch || hasActiveFilters ? 'No matching conversations' : 'No conversations found'}
            </p>
            {(hasSearch || hasActiveFilters) && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSearchQuery('');
                  setFilters({ channels: [], thread_ids: [], message_to: [] });
                }}
              >
                Clear search and filters
              </Button>
            )}
          </div>
        ) : (
          <div className="py-2 pr-2">
            {filteredConversations.map((conversation) => (
              <div key={conversation.conversation_key} className="relative">
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
                    isSelected={selectedConversationKey === conversation.conversation_key}
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

function isArchivedDefaultConversation(conversation: Conversation): boolean {
  const lastMessageTime = new Date(conversation.last_message_time).getTime();
  if (!Number.isFinite(lastMessageTime)) return false;

  const age = Date.now() - lastMessageTime;
  if (age > CONVERSATION_ARCHIVE_AFTER_MS) return true;

  return conversation.status === 'answered' && age > ANSWERED_ARCHIVE_AFTER_MS;
}
