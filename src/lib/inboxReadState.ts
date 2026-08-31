import type { Conversation } from '@/types/inbox';

export const CONVERSATION_READ_MARKER_PREFIX = '__inbox_read__|';

export function buildConversationReadMarker(conversationKey: string, readThrough: string): string {
  return `${CONVERSATION_READ_MARKER_PREFIX}${encodeURIComponent(conversationKey)}|${encodeURIComponent(readThrough)}`;
}

export function parseConversationReadMarker(marker: string): {
  conversationKey: string;
  readThrough: string;
} | null {
  if (!marker.startsWith(CONVERSATION_READ_MARKER_PREFIX)) return null;

  const encodedParts = marker.slice(CONVERSATION_READ_MARKER_PREFIX.length).split('|');
  if (encodedParts.length !== 2) return null;

  try {
    const conversationKey = decodeURIComponent(encodedParts[0]);
    const readThrough = decodeURIComponent(encodedParts[1]);
    if (!conversationKey || !Number.isFinite(Date.parse(readThrough))) return null;
    return { conversationKey, readThrough };
  } catch {
    return null;
  }
}

export function isConversationMarkedRead(
  conversation: Pick<Conversation, 'conversation_key' | 'last_message_time'>,
  readStates: Record<string, string>
): boolean {
  const readThrough = readStates[conversation.conversation_key];
  if (!readThrough) return false;

  const lastMessageTime = Date.parse(conversation.last_message_time);
  const readThroughTime = Date.parse(readThrough);

  if (!Number.isFinite(lastMessageTime) || !Number.isFinite(readThroughTime)) {
    return false;
  }

  return lastMessageTime <= readThroughTime;
}
