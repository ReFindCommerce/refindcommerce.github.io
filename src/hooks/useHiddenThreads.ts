import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchHiddenThreadIds, addHiddenThreads, removeHiddenThreads } from '@/lib/supabase';

export function useHiddenThreads() {
  const [hiddenThreadIds, setHiddenThreadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHiddenThreads = useCallback(async () => {
    try {
      const ids = await fetchHiddenThreadIds();
      setHiddenThreadIds(ids);
    } catch (error) {
      console.error('Error loading hidden threads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHiddenThreads();
    
    // Sync hidden threads every 5 seconds to keep in sync across devices
    intervalRef.current = setInterval(loadHiddenThreads, 5000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadHiddenThreads]);

  const hideThreads = useCallback(async (threadIds: string[]) => {
    const newHidden = [...new Set([...hiddenThreadIds, ...threadIds])];
    setHiddenThreadIds(newHidden);
    await addHiddenThreads(threadIds);
  }, [hiddenThreadIds]);

  const showThreads = useCallback(async (threadIds: string[]) => {
    const newHidden = hiddenThreadIds.filter(id => !threadIds.includes(id));
    setHiddenThreadIds(newHidden);
    await removeHiddenThreads(threadIds);
  }, [hiddenThreadIds]);

  const toggleThread = useCallback(async (threadId: string) => {
    if (hiddenThreadIds.includes(threadId)) {
      await showThreads([threadId]);
    } else {
      await hideThreads([threadId]);
    }
  }, [hiddenThreadIds, hideThreads, showThreads]);

  const isHidden = useCallback((threadId: string) => {
    return hiddenThreadIds.includes(threadId);
  }, [hiddenThreadIds]);

  return {
    hiddenThreadIds,
    hideThreads,
    showThreads,
    toggleThread,
    isHidden,
    loading,
    refresh: loadHiddenThreads,
  };
}
