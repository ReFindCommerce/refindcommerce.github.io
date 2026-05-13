import { describe, expect, it, beforeEach } from 'vitest';
import { clearDraft, getDraftKey, loadDraftState, saveDraft } from '@/lib/draftState';

describe('draftState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('marks current saved drafts as user-edited drafts', () => {
    saveDraft('thread-1', 'Hello there');

    expect(loadDraftState('thread-1')).toEqual({
      value: 'Hello there',
      isLegacy: false,
    });
  });

  it('marks old plain-string drafts as legacy', () => {
    localStorage.setItem(getDraftKey('thread-2'), 'Hello, old cached suggestion');

    expect(loadDraftState('thread-2')).toEqual({
      value: 'Hello,\n\nold cached suggestion',
      isLegacy: true,
    });
  });

  it('clears saved drafts', () => {
    saveDraft('thread-3', 'Reply');
    clearDraft('thread-3');

    expect(loadDraftState('thread-3')).toEqual({
      value: '',
      isLegacy: false,
    });
  });
});
