import { describe, expect, it } from 'vitest';
import {
  buildEnglishFallbackReply,
  hasClearNonEnglishCustomerSignal,
  replyAppearsNonEnglish,
  shouldDefaultCustomerLanguageToEnglish,
  shouldReplaceWithEnglishFallback,
} from '@/lib/languageRules';

describe('language rules', () => {
  it('defaults ambiguous greetings to English', () => {
    expect(shouldDefaultCustomerLanguageToEnglish('hi')).toBe(true);
    expect(shouldDefaultCustomerLanguageToEnglish('Hello')).toBe(true);
    expect(hasClearNonEnglishCustomerSignal('hi')).toBe(false);
  });

  it('only switches away from English when the customer clearly uses another language', () => {
    expect(hasClearNonEnglishCustomerSignal('Bonjour, pouvez-vous aider?')).toBe(true);
    expect(shouldDefaultCustomerLanguageToEnglish('Bonjour, pouvez-vous aider?')).toBe(false);
  });

  it('replaces a non-English draft for an ambiguous English customer message', () => {
    const germanDraft = 'Hallo! Wie kann ich Ihnen heute helfen?';

    expect(replyAppearsNonEnglish(germanDraft)).toBe(true);
    expect(shouldReplaceWithEnglishFallback('hi', germanDraft)).toBe(true);
    expect(buildEnglishFallbackReply('hi')).toBe('Hi! How can I help?');
  });
});
