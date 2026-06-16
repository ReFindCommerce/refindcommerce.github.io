import { describe, expect, it } from 'vitest';
import {
  getWhatsappReplyWindowDescription,
  getWhatsappReplyWindowStatus,
  WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS,
} from '@/lib/whatsappReplyWindow';

const baseMessage = {
  direction: 'inbound' as const,
  uploaded_at: '2026-06-13T09:22:20.241961+00:00',
};

describe('whatsapp reply window', () => {
  it('does not apply to non-WhatsApp channels', () => {
    const status = getWhatsappReplyWindowStatus('gmail', [], Date.parse('2026-06-16T09:22:20Z'));

    expect(status.applies).toBe(false);
    expect(status.canSendFreeform).toBe(true);
    expect(getWhatsappReplyWindowDescription(status)).toBeNull();
  });

  it('allows WhatsApp free-form replies before the 24-hour window expires', () => {
    const status = getWhatsappReplyWindowStatus(
      'whatsapp',
      [baseMessage],
      Date.parse(baseMessage.uploaded_at) + WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS - 1
    );

    expect(status.applies).toBe(true);
    expect(status.canSendFreeform).toBe(true);
    expect(getWhatsappReplyWindowDescription(status)).toBeNull();
  });

  it('blocks WhatsApp free-form replies after the 24-hour window expires', () => {
    const status = getWhatsappReplyWindowStatus(
      'whatsapp',
      [baseMessage],
      Date.parse('2026-06-16T09:22:20Z')
    );

    expect(status.applies).toBe(true);
    expect(status.canSendFreeform).toBe(false);
    expect(status.latestInboundAt?.toISOString()).toBe('2026-06-13T09:22:20.241Z');
    expect(status.expiresAt?.toISOString()).toBe('2026-06-14T09:22:20.241Z');
    expect(getWhatsappReplyWindowDescription(status)).toContain('24 hours');
  });

  it('uses the newest inbound message when later outbound replies exist', () => {
    const status = getWhatsappReplyWindowStatus(
      'whatsapp',
      [
        baseMessage,
        { direction: 'outbound' as const, uploaded_at: '2026-06-15T09:00:00.000Z' },
        { direction: 'inbound' as const, uploaded_at: '2026-06-16T08:00:00.000Z' },
      ],
      Date.parse('2026-06-16T09:00:00Z')
    );

    expect(status.canSendFreeform).toBe(true);
    expect(status.latestInboundAt?.toISOString()).toBe('2026-06-16T08:00:00.000Z');
  });
});
