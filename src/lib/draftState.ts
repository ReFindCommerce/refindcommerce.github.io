import { formatSuggestedReply } from '@/lib/textFormat';

const DRAFT_PREFIX = 'refind-inbox-draft:';
const ACTIVE_DRAFT_EVENT = 'refind-active-draft-changed';

interface StoredDraft {
  version: 1;
  kind: 'user';
  value: string;
  savedAt: string;
}

export interface LoadedDraft {
  value: string;
  isLegacy: boolean;
}

export function getDraftKey(threadId: string): string {
  return `${DRAFT_PREFIX}${threadId}`;
}

export function saveDraft(threadId: string, value: string): void {
  const key = getDraftKey(threadId);
  if (value.trim()) {
    const storedDraft: StoredDraft = {
      version: 1,
      kind: 'user',
      value,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(storedDraft));
  } else {
    localStorage.removeItem(key);
  }
}

export function loadDraftState(threadId: string): LoadedDraft {
  const rawDraft = localStorage.getItem(getDraftKey(threadId));
  if (!rawDraft) return { value: '', isLegacy: false };

  try {
    const parsed = JSON.parse(rawDraft) as Partial<StoredDraft>;
    if (parsed?.version === 1 && parsed.kind === 'user' && typeof parsed.value === 'string') {
      return { value: formatSuggestedReply(parsed.value), isLegacy: false };
    }
  } catch {
    // Older releases stored AI suggestions as plain strings. Treat those as disposable legacy drafts.
  }

  return { value: formatSuggestedReply(rawDraft), isLegacy: true };
}

export function loadDraft(threadId: string): string {
  return loadDraftState(threadId).value;
}

export function clearDraft(threadId: string): void {
  localStorage.removeItem(getDraftKey(threadId));
}

export function hasSavedDrafts(): boolean {
  return Object.keys(localStorage).some((key) => key.startsWith(DRAFT_PREFIX));
}

export function setActiveDraftState(active: boolean): void {
  window.dispatchEvent(new CustomEvent(ACTIVE_DRAFT_EVENT, { detail: { active } }));
}

export function onActiveDraftStateChange(callback: (active: boolean) => void): () => void {
  const handler = (event: Event) => {
    callback(Boolean((event as CustomEvent<{ active: boolean }>).detail?.active));
  };

  window.addEventListener(ACTIVE_DRAFT_EVENT, handler);
  return () => window.removeEventListener(ACTIVE_DRAFT_EVENT, handler);
}
