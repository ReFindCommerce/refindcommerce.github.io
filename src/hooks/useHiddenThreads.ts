import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchHiddenThreadIds, addHiddenThreads, removeHiddenThreads } from '@/lib/supabase';

const HIDDEN_THREAD_SYNC_INTERVAL_MS = 30_000;
const HIDDEN_THREAD_SYNC_TIMEOUT_MS = 10_000;

export function useHiddenThreads() {
  const [hiddenThreadIds, setHiddenThreadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadInFlightRef = useRef(false);

  const loadHiddenThreads = useCallback(async () => {
    if (loadInFlightRef.current) return;

    loadInFlightRef.current = true;

    try {
      const ids = await withTimeout(
        fetchHiddenThreadIds(),
        HIDDEN_THREAD_SYNC_TIMEOUT_MS,
        'Hidden thread sync timed out.'
      );
      setHiddenThreadIds(ids);
    } catch (error) {
      console.error('Error loading hidden threads:', error);
    } finally {
      loadInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHiddenThreads();
    
    const syncIfActive = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        loadHiddenThreads();
      }
    };

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        syncIfActive();
      }
    };

    intervalRef.current = setInterval(syncIfActive, HIDDEN_THREAD_SYNC_INTERVAL_MS);
    window.addEventListener('online', syncIfActive);
    window.addEventListener('pageshow', syncIfActive);
    document.addEventListener('visibilitychange', handleVisible);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('online', syncIfActive);
      window.removeEventListener('pageshow', syncIfActive);
      document.removeEventListener('visibilitychange', handleVisible);
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
