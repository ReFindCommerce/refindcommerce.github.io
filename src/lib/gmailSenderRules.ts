export interface GmailSenderRule {
  inboxAddress: string;
  fromEmail: string;
  fromName: string;
}

const GMAIL_SENDER_RULES: Record<string, GmailSenderRule> = {
  'info@refindcommerce.com': {
    inboxAddress: 'info@refindcommerce.com',
    fromEmail: 'info@refindcommerce.com',
    fromName: 'ReFind Commerce',
  },
  'support@refindcommerce.com': {
    inboxAddress: 'support@refindcommerce.com',
    fromEmail: 'support@refindcommerce.com',
    fromName: 'ReFind Commerce Support',
  },
  'info@easytag.app': {
    inboxAddress: 'info@easytag.app',
    fromEmail: 'info@easytag.app',
    fromName: 'easyTag',
  },
  'support@easytag.app': {
    inboxAddress: 'support@easytag.app',
    fromEmail: 'support@easytag.app',
    fromName: 'easyTag Support',
  },
};

const PERSONAL_GMAIL_RECIPIENTS = new Set([
  'tom.pegram@easytag.app',
  'tom@refindcommerce.com',
]);

export function normalizeEmailAddress(value: string | null | undefined): string {
  const rawValue = String(value || '').trim().toLowerCase();
  const match = rawValue.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match?.[0] || rawValue;
}

export function getGmailSenderRule(recipient: string | null | undefined): GmailSenderRule | null {
  const normalizedRecipient = normalizeEmailAddress(recipient);
  return GMAIL_SENDER_RULES[normalizedRecipient] || null;
}

export function isPersonalGmailRecipient(recipient: string | null | undefined): boolean {
  return PERSONAL_GMAIL_RECIPIENTS.has(normalizeEmailAddress(recipient));
}

export function assertGmailSenderRule(recipient: string | null | undefined): GmailSenderRule {
  const normalizedRecipient = normalizeEmailAddress(recipient);

  if (PERSONAL_GMAIL_RECIPIENTS.has(normalizedRecipient)) {
    throw new Error(`Blocked Gmail send: ${normalizedRecipient} is a personal mailbox, not a customer service sender.`);
  }

  const rule = GMAIL_SENDER_RULES[normalizedRecipient];
  if (!rule) {
    throw new Error(`Blocked Gmail send: ${normalizedRecipient || 'unknown recipient'} is not mapped to an approved sender alias.`);
  }

  return rule;
}

