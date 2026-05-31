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

  it('keeps German drafts for German easyTag support conversations', () => {
    const customerMessage = 'Eine neue Verbindung ist zu Android ist nicht mehr möglich nun';
    const germanDraft = 'Guten Tag, danke für Ihre Nachricht. Können Sie mir bitte sagen, welche Android-Version Sie verwenden?';

    expect(hasClearNonEnglishCustomerSignal(customerMessage)).toBe(true);
    expect(shouldDefaultCustomerLanguageToEnglish(customerMessage)).toBe(false);
    expect(replyAppearsNonEnglish(germanDraft)).toBe(true);
    expect(shouldReplaceWithEnglishFallback(customerMessage, germanDraft)).toBe(false);
  });
});
