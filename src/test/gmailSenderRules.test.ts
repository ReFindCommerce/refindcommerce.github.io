import { describe, expect, it } from 'vitest';
import {
  assertGmailSenderRule,
  getGmailSenderRule,
  isPersonalGmailRecipient,
  normalizeEmailAddress,
} from '@/lib/gmailSenderRules';

describe('gmail sender rules', () => {
  it('normalizes display-name email values', () => {
    expect(normalizeEmailAddress('easyTag Support <Support@EasyTag.App>')).toBe('support@easytag.app');
  });

  it('maps approved inbox recipients to matching sender aliases', () => {
    expect(getGmailSenderRule('support@easytag.app')).toEqual({
      inboxAddress: 'support@easytag.app',
      fromEmail: 'support@easytag.app',
      fromName: 'easyTag Support',
    });
  });

  it('blocks personal mailboxes from customer service sends', () => {
    expect(isPersonalGmailRecipient('Thomas Pegram <tom@refindcommerce.com>')).toBe(true);
    expect(() => assertGmailSenderRule('tom@refindcommerce.com')).toThrow(/personal mailbox/);
  });

  it('blocks unmapped Gmail recipients', () => {
    expect(() => assertGmailSenderRule('sales@example.com')).toThrow(/not mapped to an approved sender alias/);
  });
});

