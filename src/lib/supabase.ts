import { createClient } from '@supabase/supabase-js';
import type { Message, Conversation, Channel } from '@/types/inbox';

const supabaseUrl = 'https://dquighsffvqgbizedatd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdWlnaHNmZnZxZ2JpemVkYXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyODc0OTMsImV4cCI6MjA4Mzg2MzQ5M30.mTOr7xTBerM2Z7c-cxdYSw0AadfTPYJeR4U_gkpTc6I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TABLE_NAME = 'inbox_messages';

export async function fetchMessages(threadId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('thread_id', threadId)
    .order('uploaded_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data || [];
}

export async function fetchConversations(filters?: {
  channels?: Channel[];
  thread_ids?: string[];
  message_to?: string[];
}): Promise<Conversation[]> {
  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .order('uploaded_at', { ascending: false });

  if (filters?.channels && filters.channels.length > 0) {
    query = query.in('channel', filters.channels);
  }

  if (filters?.thread_ids && filters.thread_ids.length > 0) {
    query = query.in('thread_id', filters.thread_ids);
  }

  if (filters?.message_to && filters.message_to.length > 0) {
    query = query.in('message_to', filters.message_to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }

  // Group messages by thread_id
  const conversationMap = new Map<string, Conversation>();

  (data || []).forEach((msg: Message) => {
    const existing = conversationMap.get(msg.thread_id);
    
    if (!existing) {
      conversationMap.set(msg.thread_id, {
        thread_id: msg.thread_id,
        sender_name: msg.sender_name,
        channel: msg.channel,
        message_from: msg.message_from,
        message_to: msg.message_to,
        status: msg.status,
        last_message: msg.user_message || msg.final_reply || '',
        last_message_time: msg.uploaded_at,
        unread_count: msg.status === 'new' ? 1 : 0,
      });
    } else {
      // Update with latest message info - always use the most recent message's status
      const msgTime = new Date(msg.uploaded_at).getTime();
      const existingTime = new Date(existing.last_message_time).getTime();
      
      if (msgTime > existingTime) {
        existing.last_message = msg.user_message || msg.final_reply || '';
        existing.last_message_time = msg.uploaded_at;
        // Use the status of the LATEST message
        existing.status = msg.status;
      }
      
      if (msg.status === 'new') {
        existing.unread_count++;
      }
    }
  });

  // Sort: new status first, then by time
  const conversations = Array.from(conversationMap.values());
  conversations.sort((a, b) => {
    if (a.status === 'new' && b.status !== 'new') return -1;
    if (a.status !== 'new' && b.status === 'new') return 1;
    return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
  });

  return conversations;
}

export async function uploadImage(file: File): Promise<string | null> {
  const fileName = `${Date.now()}_${file.name}`;
  const filePath = `inbox_images/${fileName}`;

  const { error } = await supabase.storage
    .from('public')
    .upload(filePath, file);

  if (error) {
    console.error('Error uploading image:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('public')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

export async function getLatestAiReply(threadId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('ai_reply')
    .eq('thread_id', threadId)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching AI reply:', error);
    return null;
  }

  return data?.ai_reply || null;
}

export async function getDistinctValues(column: 'channel' | 'thread_id' | 'message_to'): Promise<string[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(column);

  if (error) {
    console.error(`Error fetching distinct ${column}:`, error);
    return [];
  }

  const uniqueValues = [...new Set((data || []).map(item => item[column]).filter(Boolean))];
  return uniqueValues;
}
