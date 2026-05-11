const DRAFT_PREFIX = 'refind-inbox-draft:';
const ACTIVE_DRAFT_EVENT = 'refind-active-draft-changed';

export function getDraftKey(threadId: string): string {
  return `${DRAFT_PREFIX}${threadId}`;
}

export function saveDraft(threadId: string, value: string): void {
  const key = getDraftKey(threadId);
  if (value.trim()) {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }
}

export function loadDraft(threadId: string): string {
  return localStorage.getItem(getDraftKey(threadId)) || '';
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
