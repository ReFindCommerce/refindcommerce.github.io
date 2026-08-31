import { describe, expect, it } from 'vitest';
import {
  buildConversationReadMarker,
  isConversationMarkedRead,
  parseConversationReadMarker,
} from '@/lib/inboxReadState';

const conversation = {
  conversation_key: 'gmail:thread-1:support@easytag.app',
  last_message_time: '2026-08-31T10:00:00.000Z',
};

describe('conversation read state', () => {
  it('hides a conversation read through its latest message', () => {
    expect(isConversationMarkedRead(conversation, {
      [conversation.conversation_key]: '2026-08-31T10:00:00.000Z',
    })).toBe(true);
  });

  it('shows the conversation when a newer message arrives', () => {
    expect(isConversationMarkedRead({
      ...conversation,
      last_message_time: '2026-08-31T10:01:00.000Z',
    }, {
      [conversation.conversation_key]: '2026-08-31T10:00:00.000Z',
    })).toBe(false);
  });

  it('keeps Gmail recipient keys isolated', () => {
    expect(isConversationMarkedRead({
      ...conversation,
      conversation_key: 'gmail:thread-1:info@refindcommerce.com',
    }, {
      [conversation.conversation_key]: '2026-08-31T10:00:00.000Z',
    })).toBe(false);
  });

  it('round-trips a namespaced read marker', () => {
    const marker = buildConversationReadMarker(
      conversation.conversation_key,
      conversation.last_message_time
    );

    expect(parseConversationReadMarker(marker)).toEqual({
      conversationKey: conversation.conversation_key,
      readThrough: conversation.last_message_time,
    });
  });

  it('does not treat filtered contacts as read markers', () => {
    expect(parseConversationReadMarker('billing@tm1.openai.com')).toBeNull();
  });
});
