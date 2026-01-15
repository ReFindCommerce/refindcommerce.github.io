export type Channel = 'whatsapp' | 'gmail' | 'amazon' | 'ebay' | 'tiktok shop';

export type MessageStatus = 'new' | 'answered';

export type UserType = 'customer' | 'agent';

export type Direction = 'inbound' | 'outbound';

export interface Message {
  id: string;
  channel: Channel;
  thread_id: string;
  message_from: string;
  message_to: string;
  sender_name: string;
  user_type: UserType;
  direction: Direction;
  user_message: string | null;
  final_reply: string | null;
  ai_reply: string | null;
  status: MessageStatus;
  uploaded_at: string;
  customer_image_url: string | null;
  agent_image_url: string | null;
}

export interface Conversation {
  thread_id: string;
  sender_name: string;
  channel: Channel;
  message_from: string;
  message_to: string;
  status: MessageStatus;
  last_message: string | null;
  last_message_time: string;
  unread_count: number;
}

export interface FilterOptions {
  channels: Channel[];
  thread_ids: string[];
  message_to: string[];
}

export const CHANNEL_WEBHOOKS: Record<string, string> = {
  whatsapp: 'https://n8n.srv1247903.hstgr.cloud/webhook/unified-inbox',
  gmail: 'https://n8n.srv1247903.hstgr.cloud/webhook/dd2988d5-fa00-443f-a7b9-3c7fb95d7367',
  amazon: 'https://n8n.srv1247903.hstgr.cloud/webhook/7e998505-6594-4c6d-8acc-c21a56e4823c',
  ebay: 'https://n8n.srv1247903.hstgr.cloud/webhook/7e998505-6594-4c6d-8acc-c21a56e4823c',
  'tiktok shop': 'https://n8n.srv1247903.hstgr.cloud/webhook/7e998505-6594-4c6d-8acc-c21a56e4823c',
};
