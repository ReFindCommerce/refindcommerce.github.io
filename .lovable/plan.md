

## Гарантировать отправку item_id_ebay в webhook eBay

### Проблема

Логика поиска `item_id_ebay` по массиву `messages` уже реализована, но поле по-прежнему не попадает в payload. Вероятная причина: сообщения с `item_id_ebay` могут не загружаться в массив `messages` (например, из-за большого количества сообщений или особенностей данных).

### Решение

Добавить отдельный запрос к Supabase, который напрямую ищет `item_id_ebay` для данного `thread_id`, если значение не найдено в уже загруженных сообщениях. Это гарантирует, что значение будет найдено.

### Изменения

**Файл: `src/lib/supabase.ts`** -- добавить новую функцию:

```typescript
export async function getEbayIds(threadId: string): Promise<{ message_id_ebay: string | null; item_id_ebay: string | null }> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('message_id_ebay, item_id_ebay')
    .eq('thread_id', threadId)
    .not('item_id_ebay', 'is', null)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching eBay IDs:', error);
    return { message_id_ebay: null, item_id_ebay: null };
  }

  // Also try separate query for message_id_ebay if not found
  let messageId = data?.message_id_ebay || null;
  const itemId = data?.item_id_ebay || null;

  if (!messageId) {
    const { data: msgData } = await supabase
      .from(TABLE_NAME)
      .select('message_id_ebay')
      .eq('thread_id', threadId)
      .not('message_id_ebay', 'is', null)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    messageId = msgData?.message_id_ebay || null;
  }

  return { message_id_ebay: messageId, item_id_ebay: itemId };
}
```

**Файл: `src/components/ChatView.tsx`** -- использовать новую функцию:

```typescript
// Find eBay IDs - query database directly to guarantee we find them
if (channel === 'ebay') {
  const ebayIds = await getEbayIds(conversation.thread_id);

  if (ebayIds.message_id_ebay) {
    payload.message_id_ebay = ebayIds.message_id_ebay;
  }
  if (ebayIds.item_id_ebay) {
    payload.item_id_ebay = ebayIds.item_id_ebay;
  }
}
```

Добавить импорт `getEbayIds` из `@/lib/supabase`.

### Почему это сработает

Вместо поиска по уже загруженным сообщениям (которые могут не содержать нужные строки), делаем прямой запрос к базе с фильтром `NOT NULL` на `item_id_ebay`. Это гарантирует нахождение значения, если оно есть хотя бы в одной строке треда.

### Файлы для изменения

1. `src/lib/supabase.ts` -- новая функция `getEbayIds`
2. `src/components/ChatView.tsx` -- заменить блок поиска eBay ID на вызов новой функции
