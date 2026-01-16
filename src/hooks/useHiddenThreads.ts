import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'hidden_thread_ids';

export function useHiddenThreads() {
  const [hiddenThreadIds, setHiddenThreadIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHiddenThreadIds(JSON.parse(stored));
      } catch {
        setHiddenThreadIds([]);
      }
    }
  }, []);

  const saveHiddenThreadIds = useCallback((ids: string[]) => {
    setHiddenThreadIds(ids);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, []);

  const hideThreads = useCallback((threadIds: string[]) => {
    const newHidden = [...new Set([...hiddenThreadIds, ...threadIds])];
    saveHiddenThreadIds(newHidden);
  }, [hiddenThreadIds, saveHiddenThreadIds]);

  const showThreads = useCallback((threadIds: string[]) => {
    const newHidden = hiddenThreadIds.filter(id => !threadIds.includes(id));
    saveHiddenThreadIds(newHidden);
  }, [hiddenThreadIds, saveHiddenThreadIds]);

  const toggleThread = useCallback((threadId: string) => {
    if (hiddenThreadIds.includes(threadId)) {
      showThreads([threadId]);
    } else {
      hideThreads([threadId]);
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
  };
}
