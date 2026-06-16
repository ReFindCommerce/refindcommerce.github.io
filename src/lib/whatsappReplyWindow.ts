import type { Message } from '@/types/inbox';

export const WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface WhatsappReplyWindowStatus {
  applies: boolean;
  canSendFreeform: boolean;
  latestInboundAt: Date | null;
  expiresAt: Date | null;
}

export function getWhatsappReplyWindowStatus(
  channel: string | null | undefined,
  messages: Array<Pick<Message, 'direction' | 'uploaded_at'>>,
  nowMs = Date.now()
): WhatsappReplyWindowStatus {
  if (String(channel || '').toLowerCase() !== 'whatsapp') {
    return {
      applies: false,
      canSendFreeform: true,
      latestInboundAt: null,
      expiresAt: null,
    };
  }

  const latestInboundAt = [...messages]
    .reverse()
    .find((message) => message.direction === 'inbound' && Number.isFinite(Date.parse(message.uploaded_at)));

  if (!latestInboundAt) {
    return {
      applies: true,
      canSendFreeform: false,
      latestInboundAt: null,
      expiresAt: null,
    };
  }

  const inboundDate = new Date(latestInboundAt.uploaded_at);
  const expiresAt = new Date(inboundDate.getTime() + WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS);

  return {
    applies: true,
    canSendFreeform: nowMs < expiresAt.getTime(),
    latestInboundAt: inboundDate,
    expiresAt,
  };
}

export function getWhatsappReplyWindowDescription(
  status: WhatsappReplyWindowStatus,
  locale?: string
): string | null {
  if (!status.applies || status.canSendFreeform) {
    return null;
  }

  const lastMessageText = status.latestInboundAt
    ? ` Last customer message: ${formatMessageTime(status.latestInboundAt, locale)}.`
    : '';

  return `WhatsApp free-form replies close 24 hours after the customer's last message.${lastMessageText} Use an approved WhatsApp template or ask the customer to message again.`;
}

function formatMessageTime(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
