import { describe, expect, it } from 'vitest';
import {
  buildWhatsappSupportFollowUpPayload,
  WHATSAPP_SUPPORT_FOLLOW_UP_TEMPLATE,
} from '@/lib/whatsappSupportFollowUp';
import type { Conversation } from '@/types/inbox';

const conversation: Conversation = {
  conversation_key: 'whatsapp:447700900123',
  thread_id: '447700900123',
  sender_name: 'Customer',
  channel: 'whatsapp',
  message_from: '447700900123',
  message_to: '447542608444',
  status: 'new',
  last_message: 'Can you help?',
  last_message_time: '2026-09-04T14:40:00.000Z',
  unread_count: 1,
};

describe('WhatsApp support follow-up', () => {
  it('builds an allowlisted template request from the latest inbound route', () => {
    const payload = buildWhatsappSupportFollowUpPayload(
      conversation,
      [
        {
          direction: 'inbound',
          message_from: '447700900123',
          message_to: '447542608444',
          uploaded_at: '2026-09-04T14:40:00.000Z',
        },
        {
          direction: 'outbound',
          message_from: '447700900123',
          message_to: '447542608444',
          uploaded_at: '2026-09-04T14:45:00.000Z',
        },
      ],
      '65b85a07-8958-44b6-9cae-fdf947554a88',
      '2026-09-05T15:00:00.000Z'
    );

    expect(payload).toMatchObject({
      reply_mode: 'approved_support_template',
      template_name: WHATSAPP_SUPPORT_FOLLOW_UP_TEMPLATE.name,
      template_language: 'en',
      message_from: '447700900123',
      message_to: '447542608444',
      final_reply: WHATSAPP_SUPPORT_FOLLOW_UP_TEMPLATE.preview,
    });
  });

  it('rejects use outside WhatsApp', () => {
    expect(() =>
      buildWhatsappSupportFollowUpPayload(
        { ...conversation, channel: 'gmail' },
        [],
        '65b85a07-8958-44b6-9cae-fdf947554a88',
        '2026-09-05T15:00:00.000Z'
      )
    ).toThrow('only be sent on WhatsApp');
  });
});
