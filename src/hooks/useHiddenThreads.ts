import { useState, useEffect, useCallback } from 'react';
import { fetchHiddenThreadIds, addHiddenThreads, removeHiddenThreads } from '@/lib/supabase';

export function useHiddenThreads() {
  const [hiddenThreadIds, setHiddenThreadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHiddenThreads = useCallback(async () => {
    const ids = await fetchHiddenThreadIds();
    setHiddenThreadIds(ids);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHiddenThreads();
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
