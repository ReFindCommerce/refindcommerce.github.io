import type { Conversation, Message } from '@/types/inbox';

export const WHATSAPP_SUPPORT_FOLLOW_UP_ENDPOINT =
  'https://n8n.srv1354140.hstgr.cloud/webhook/whatsapp-support-follow-up';

export const WHATSAPP_SUPPORT_FOLLOW_UP_TEMPLATE = {
  name: 'easytag_support_follow_up_v1',
  language: 'en',
  preview: "Hi, we're following up on your support request. Reply to this message and we'll continue helping you.",
} as const;

type SupportFollowUpMessage = Pick<
  Message,
  'direction' | 'message_from' | 'message_to' | 'uploaded_at'
>;

export function buildWhatsappSupportFollowUpPayload(
  conversation: Conversation,
  messages: SupportFollowUpMessage[],
  requestId: string,
  requestedAt: string
): Record<string, string> {
  if (conversation.channel !== 'whatsapp') {
    throw new Error('Support follow-up templates can only be sent on WhatsApp.');
  }

  const latestInbound = [...messages]
    .reverse()
    .find((message) => message.direction === 'inbound');

  if (!latestInbound) {
    throw new Error('No inbound customer message was found for this conversation.');
  }

  const customerPhone = latestInbound.message_from || conversation.message_from;
  const businessPhone = latestInbound.message_to || conversation.message_to;

  if (!conversation.thread_id || !customerPhone || !businessPhone) {
    throw new Error('This conversation is missing the identifiers needed to send a follow-up.');
  }

  return {
    id: requestId,
    channel: 'whatsapp',
    thread_id: conversation.thread_id,
    message_from: customerPhone,
    message_to: businessPhone,
    sender_name: conversation.sender_name || customerPhone,
    reply_mode: 'approved_support_template',
    template_name: WHATSAPP_SUPPORT_FOLLOW_UP_TEMPLATE.name,
    template_language: WHATSAPP_SUPPORT_FOLLOW_UP_TEMPLATE.language,
    final_reply: WHATSAPP_SUPPORT_FOLLOW_UP_TEMPLATE.preview,
    requested_at: requestedAt,
  };
}
