import type { Conversation } from '@/types/inbox';

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
