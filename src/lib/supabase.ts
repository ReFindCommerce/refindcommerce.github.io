import { createClient } from '@supabase/supabase-js';
import type { Message, Conversation, Channel } from '@/types/inbox';
import { normalizeSearchText } from './textFormat';

const supabaseUrl = 'https://dquighsffvqgbizedatd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdWlnaHNmZnZxZ2JpemVkYXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyODc0OTMsImV4cCI6MjA4Mzg2MzQ5M30.mTOr7xTBerM2Z7c-cxdYSw0AadfTPYJeR4U_gkpTc6I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TABLE_NAME = 'inbox_messages';
const QA_TABLE_NAME = 'qa_pairs';
const MESSAGE_SELECT = [
  'id',
  'channel',
  'thread_id',
  'message_from',
  'message_to',
  'sender_name',
  'user_type',
  'direction',
  'user_message',
  'final_reply',
  'ai_reply',
  'status',
  'uploaded_at',
  'customer_image_url',
  'agent_image_url',
  'image_url',
  'ebay_image',
  'message_id_ebay',
  'gmail_message_id',
  'gmail_thread_id',
  'in_reply_to',
  'item_id_ebay',
  'subject_ebay_message',
].join(',');

export async function fetchMessages(threadId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(MESSAGE_SELECT)
    .eq('thread_id', threadId)
    .order('uploaded_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data || [];
}

async function fetchAllRows(query: any): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  
  while (true) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  
  return allData;
}

export async function fetchConversations(filters?: {
  channels?: Channel[];
  thread_ids?: string[];
  message_to?: string[];
}): Promise<Conversation[]> {
  let query = supabase
    .from(TABLE_NAME)
    .select(MESSAGE_SELECT)
    .order('uploaded_at', { ascending: true })
    .order('id', { ascending: true });

  if (filters?.channels && filters.channels.length > 0) {
    query = query.in('channel', filters.channels);
  }
  if (filters?.thread_ids && filters.thread_ids.length > 0) {
    query = query.in('thread_id', filters.thread_ids);
  }
  if (filters?.message_to && filters.message_to.length > 0) {
    query = query.in('message_to', filters.message_to);
  }

  let data: any[] | null = null;
  let error: any = null;

  try {
    data = await fetchAllRows(query);
  } catch (e: any) {
    error = e;
  }

  if (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }

  // Group messages by thread_id
  const conversationMap = new Map<string, Conversation>();

  (data || []).forEach((msg: Message) => {
    const existing = conversationMap.get(msg.thread_id);
    
    if (!existing) {
      conversationMap.set(msg.thread_id, {
        thread_id: msg.thread_id,
        sender_name: msg.sender_name || msg.message_from || msg.thread_id,
        channel: msg.channel,
        message_from: msg.message_from,
        message_to: msg.message_to,
        status: msg.direction === 'outbound' ? 'answered' : 'new',
        last_message: msg.user_message || msg.final_reply || '',
        last_message_time: msg.uploaded_at,
        unread_count: msg.status === 'new' ? 1 : 0,
      });
    } else {
      // Update with latest message info
      const msgTime = new Date(msg.uploaded_at).getTime();
      const existingTime = new Date(existing.last_message_time).getTime();
      
      if (msgTime >= existingTime) {
        existing.last_message = msg.user_message || msg.final_reply || '';
        existing.last_message_time = msg.uploaded_at;
        existing.status = msg.direction === 'outbound' ? 'answered' : 'new';
        existing.sender_name = existing.sender_name || msg.sender_name || msg.message_from || msg.thread_id;
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
    .not('ai_reply', 'is', null)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching AI reply:', error);
    return null;
  }

  return data?.ai_reply || null;
}

export interface SavedReplySuggestion {
  question: string;
  answer: string;
  channel: string | null;
  message_to: string | null;
  score: number;
}

function scoreSavedReply(query: string, question: string): number {
  const queryTerms = new Set(normalizeSearchText(query).split(' ').filter((term) => term.length > 2));
  const questionTerms = new Set(normalizeSearchText(question).split(' ').filter((term) => term.length > 2));
  if (!queryTerms.size || !questionTerms.size) return 0;

  let matches = 0;
  queryTerms.forEach((term) => {
    if (questionTerms.has(term)) matches += 1;
  });

  return matches / Math.max(queryTerms.size, questionTerms.size);
}

export async function fetchSavedReplySuggestions(options: {
  message: string | null | undefined;
  channel?: Channel;
  message_to?: string | null;
}): Promise<SavedReplySuggestion[]> {
  const cleanMessage = normalizeSearchText(options.message);
  if (!cleanMessage) return [];

  const { data, error } = await supabase
    .from(QA_TABLE_NAME)
    .select('question, answer, channel, message_to')
    .limit(500);

  if (error) {
    console.error('Error fetching saved reply suggestions:', error);
    return [];
  }

  return (data || [])
    .map((row) => {
      const channelBoost = options.channel && row.channel === options.channel ? 0.12 : 0;
      const recipientBoost = options.message_to && row.message_to === options.message_to ? 0.08 : 0;
      return {
        question: row.question || '',
        answer: row.answer || '',
        channel: row.channel || null,
        message_to: row.message_to || null,
        score: scoreSavedReply(cleanMessage, row.question || '') + channelBoost + recipientBoost,
      };
    })
    .filter((row) => row.answer && row.score >= 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
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

// Hidden threads management
const HIDDEN_THREADS_TABLE = 'hidden_threads';

export async function fetchHiddenThreadIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from(HIDDEN_THREADS_TABLE)
    .select('thread_id');

  if (error) {
    console.error('Error fetching hidden threads:', error);
    return [];
  }

  return (data || []).map(item => item.thread_id);
}

export async function addHiddenThreads(threadIds: string[]): Promise<void> {
  if (threadIds.length === 0) return;

  const rows = threadIds.map(thread_id => ({ thread_id }));
  
  const { error } = await supabase
    .from(HIDDEN_THREADS_TABLE)
    .upsert(rows, { onConflict: 'thread_id' });

  if (error) {
    console.error('Error adding hidden threads:', error);
  }
}

export async function removeHiddenThreads(threadIds: string[]): Promise<void> {
  if (threadIds.length === 0) return;

  const { error } = await supabase
    .from(HIDDEN_THREADS_TABLE)
    .delete()
    .in('thread_id', threadIds);

  if (error) {
    console.error('Error removing hidden threads:', error);
  }
}
