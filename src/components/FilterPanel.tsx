import React, { useState, useEffect } from 'react';
import { FilterOptions, Channel } from '@/types/inbox';
import { getDistinctValues } from '@/lib/supabase';
import { X, Check, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onClose: () => void;
  onEnterHideMode: () => void;
  hiddenCount: number;
}

const ALL_CHANNELS: Channel[] = ['whatsapp', 'gmail', 'amazon', 'ebay', 'tiktok shop'];

export function FilterPanel({ filters, onFiltersChange, onClose, onEnterHideMode, hiddenCount }: FilterPanelProps) {
  const [threadIds, setThreadIds] = useState<string[]>([]);
  const [messageTos, setMessageTos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    setLoading(true);
    const [threads, tos] = await Promise.all([
      getDistinctValues('thread_id'),
      getDistinctValues('message_to'),
    ]);
    setThreadIds(threads);
    setMessageTos(tos);
    setLoading(false);
  };

  const toggleChannel = (channel: Channel) => {
    const newChannels = filters.channels.includes(channel)
      ? filters.channels.filter(c => c !== channel)
      : [...filters.channels, channel];
    onFiltersChange({ ...filters, channels: newChannels });
  };

  const toggleThreadId = (threadId: string) => {
    const newThreadIds = filters.thread_ids.includes(threadId)
      ? filters.thread_ids.filter(t => t !== threadId)
      : [...filters.thread_ids, threadId];
    onFiltersChange({ ...filters, thread_ids: newThreadIds });
  };

  const toggleMessageTo = (messageTo: string) => {
    const newMessageTos = filters.message_to.includes(messageTo)
      ? filters.message_to.filter(m => m !== messageTo)
      : [...filters.message_to, messageTo];
    onFiltersChange({ ...filters, message_to: newMessageTos });
  };

  const clearFilters = () => {
    onFiltersChange({ channels: [], thread_ids: [], message_to: [] });
  };

  const hasActiveFilters = filters.channels.length > 0 || filters.thread_ids.length > 0 || filters.message_to.length > 0;

  return (
    <div className="border-b border-sidebar-border bg-muted/50 animate-fade-in">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Filters</h3>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onEnterHideMode}
              className="gap-1"
            >
              <EyeOff className="w-4 h-4" />
              Hide
              {hiddenCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {hiddenCount}
                </Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Channels */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Channel</h4>
          <div className="flex flex-wrap gap-2">
            {ALL_CHANNELS.map((channel) => (
              <Badge
                key={channel}
                variant={filters.channels.includes(channel) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer capitalize transition-all",
                  filters.channels.includes(channel) && "ring-2 ring-primary"
                )}
                onClick={() => toggleChannel(channel)}
              >
                {filters.channels.includes(channel) && <Check className="w-3 h-3 mr-1" />}
                {channel}
              </Badge>
            ))}
          </div>
        </div>

        {/* Thread IDs */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Thread ID</h4>
          <ScrollArea className="h-24">
            <div className="flex flex-wrap gap-2">
              {loading ? (
                <span className="text-sm text-muted-foreground">Loading...</span>
              ) : threadIds.length === 0 ? (
                <span className="text-sm text-muted-foreground">No thread IDs found</span>
              ) : (
                threadIds.map((threadId) => (
                  <Badge
                    key={threadId}
                    variant={filters.thread_ids.includes(threadId) ? "default" : "outline"}
                    className="cursor-pointer transition-all text-xs"
                    onClick={() => toggleThreadId(threadId)}
                  >
                    {filters.thread_ids.includes(threadId) && <Check className="w-3 h-3 mr-1" />}
                    {threadId.length > 20 ? `${threadId.slice(0, 20)}...` : threadId}
                  </Badge>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Message To */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Message To</h4>
          <ScrollArea className="h-24">
            <div className="flex flex-wrap gap-2">
              {loading ? (
                <span className="text-sm text-muted-foreground">Loading...</span>
              ) : messageTos.length === 0 ? (
                <span className="text-sm text-muted-foreground">No recipients found</span>
              ) : (
                messageTos.map((messageTo) => (
                  <Badge
                    key={messageTo}
                    variant={filters.message_to.includes(messageTo) ? "default" : "outline"}
                    className="cursor-pointer transition-all text-xs"
                    onClick={() => toggleMessageTo(messageTo)}
                  >
                    {filters.message_to.includes(messageTo) && <Check className="w-3 h-3 mr-1" />}
                    {messageTo}
                  </Badge>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
