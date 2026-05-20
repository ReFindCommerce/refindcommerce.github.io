import { createClient } from '@supabase/supabase-js';
import type { Message, Conversation, Channel, InboxFailure } from '@/types/inbox';
import { formatSuggestedReply } from '@/lib/textFormat';

const supabaseUrl = 'https://dquighsffvqgbizedatd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdWlnaHNmZnZxZ2JpemVkYXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyODc0OTMsImV4cCI6MjA4Mzg2MzQ5M30.mTOr7xTBerM2Z7c-cxdYSw0AadfTPYJeR4U_gkpTc6I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TABLE_NAME = 'inbox_messages';
const FAILURES_TABLE_NAME = 'inbox_failures';
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
  'ai_confidence',
  'ai_confidence_reason',
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

const CONVERSATION_SELECT = [
  'id',
  'channel',
  'thread_id',
  'message_from',
  'message_to',
  'sender_name',
  'direction',
  'user_message',
  'final_reply',
  'status',
  'uploaded_at',
].join(',');

function getConversationKey(message: Pick<Message, 'channel' | 'thread_id' | 'message_to'>): string {
  const threadId = message.thread_id || 'unknown-thread';
  const channel = String(message.channel || 'unknown-channel').toLowerCase();
  const messageTo = String(message.message_to || 'unknown-recipient').trim().toLowerCase();

  if (channel === 'gmail') {
    return `${channel}:${threadId}:${messageTo}`;
  }

  return `${channel}:${threadId}`;
}

export async function fetchMessages(threadId: string, messageTo?: string): Promise<Message[]> {
  let query = supabase
    .from(TABLE_NAME)
    .select(MESSAGE_SELECT)
    .eq('thread_id', threadId);

  if (messageTo) {
    query = query.eq('message_to', messageTo);
  }

  const { data, error } = await query.order('uploaded_at', { ascending: true });

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
    .select(CONVERSATION_SELECT)
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

  // Group email by recipient too, otherwise the same sender can merge multiple inboxes.
  const conversationMap = new Map<string, Conversation>();

  (data || []).forEach((msg: Message) => {
    const conversationKey = getConversationKey(msg);
    const existing = conversationMap.get(conversationKey);
    
    if (!existing) {
      conversationMap.set(conversationKey, {
        conversation_key: conversationKey,
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

export interface AiDraft {
  reply: string;
  confidence: number | null;
  confidenceReason: string | null;
}

export async function getLatestAiDraft(threadId: string, messageTo?: string): Promise<AiDraft | null> {
  let query = supabase
    .from(TABLE_NAME)
    .select('ai_reply,ai_confidence,ai_confidence_reason,user_message,final_reply,direction,uploaded_at')
    .eq('thread_id', threadId);

  if (messageTo) {
    query = query.eq('message_to', messageTo);
  }

  const { data, error } = await query
    .order('uploaded_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching AI reply:', error);
    return null;
  }

  const rows = data || [];
  const latestOutbound = rows.find((message: any) => message.direction === 'outbound');
  const latestOutboundTime = latestOutbound ? new Date(latestOutbound.uploaded_at).getTime() : 0;
  const unresolvedInbound = rows.filter((message: any) => {
    if (message.direction !== 'inbound') return false;
    if (!message.ai_reply) return false;
    return new Date(message.uploaded_at).getTime() >= latestOutboundTime;
  });
  const candidates = unresolvedInbound.length > 0
    ? unresolvedInbound
    : rows.filter((message: any) => message.direction === 'inbound' && message.ai_reply);

  if (candidates.length === 0) return null;

  const [best] = [...candidates].sort((a: any, b: any) => {
    return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
  });

  if (!best?.ai_reply) return null;

  return {
    reply: formatSuggestedReply(best.ai_reply),
    confidence: typeof best.ai_confidence === 'number'
      ? best.ai_confidence
      : estimateLegacyDraftConfidence(best.user_message, rows),
    confidenceReason: best.ai_confidence_reason || getLegacyDraftConfidenceReason(best.user_message),
  };
}

export async function getLatestAiReply(threadId: string, messageTo?: string): Promise<string | null> {
  const draft = await getLatestAiDraft(threadId, messageTo);
  return draft?.reply || null;
}

function getDraftCandidateScore(message: string | null): number {
  const text = String(message || '').trim();
  if (!text) return 0;

  const words = text.split(/\s+/).filter(Boolean);
  const genericHelpRequest = /^(hi|hello|hey|thanks|thank you|ok|okay|i have (a )?few questions\.? can you help\??|can you help\??)$/i;
  const asksForHelpOnly = /^(i have (a )?few questions|can you help|please help)$/i;

  if (genericHelpRequest.test(text) || (words.length <= 8 && asksForHelpOnly.test(text))) {
    return 1;
  }

  return Math.min(100, 10 + words.length);
}

function estimateLegacyDraftConfidence(message: string | null, rows: any[]): number {
  const text = String(message || '').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const hasRecentContext = rows.some((row: any) => row.direction === 'inbound' && row.user_message && row.user_message !== message);

  if (!text) return 35;
  if (getDraftCandidateScore(text) <= 1) return hasRecentContext ? 55 : 40;
  if (words.length >= 20) return hasRecentContext ? 70 : 65;
  if (words.length >= 8) return hasRecentContext ? 65 : 60;
  return hasRecentContext ? 55 : 50;
}

function getLegacyDraftConfidenceReason(message: string | null): string {
  const text = String(message || '').trim();

  if (!text) {
    return 'estimated because this draft does not have stored workflow confidence';
  }

  if (getDraftCandidateScore(text) <= 1) {
    return 'estimated from a low-information message because stored workflow confidence is missing';
  }

  return 'estimated from message specificity because stored workflow confidence is missing';
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

export interface ReliabilityStatus {
  failures: InboxFailure[];
  pendingSends: Message[];
  failedSends: Message[];
}

export async function fetchReliabilityStatus(): Promise<ReliabilityStatus> {
  const [failuresResult, sendIssuesResult] = await Promise.all([
    supabase
      .from(FAILURES_TABLE_NAME)
      .select([
        'id',
        'created_at',
        'workflow_name',
        'execution_id',
        'node_name',
        'severity',
        'error_message',
        'message_from',
        'message_to',
        'subject',
        'status',
      ].join(','))
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from(TABLE_NAME)
      .select(MESSAGE_SELECT)
      .in('status', ['sending', 'send_failed'])
      .order('uploaded_at', { ascending: false })
      .limit(25),
  ]);

  if (failuresResult.error) {
    console.error('Error fetching inbox failures:', failuresResult.error);
  }

  if (sendIssuesResult.error) {
    console.error('Error fetching send issues:', sendIssuesResult.error);
  }

  const sendIssues = (sendIssuesResult.data || []) as Message[];

  return {
    failures: (failuresResult.data || []) as InboxFailure[],
    pendingSends: sendIssues.filter((message) => message.status === 'sending'),
    failedSends: sendIssues.filter((message) => message.status === 'send_failed'),
  };
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
