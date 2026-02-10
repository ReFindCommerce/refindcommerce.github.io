

## Исправление: искать item_id_ebay и message_id_ebay по всем сообщениям треда

### Проблема

Текущий код берёт `item_id_ebay` только из последнего сообщения в массиве:

```typescript
const latestMessage = messages[messages.length - 1];
if (channel === 'ebay' && latestMessage?.item_id_ebay) {
  payload.item_id_ebay = latestMessage.item_id_ebay;
}
```

Но из 10 сообщений в треде только 2 могут содержать `item_id_ebay`. Если последнее сообщение -- не одно из них, поле не попадает в payload.

### Решение

Вместо проверки только последнего сообщения, искать первое непустое значение среди всех сообщений треда (с конца, чтобы взять самое свежее):

**Файл: `src/components/ChatView.tsx`**

Заменить текущую логику для eBay полей:

```typescript
// Найти item_id_ebay и message_id_ebay среди всех сообщений (с конца — берём самое свежее)
if (channel === 'ebay') {
  const ebayMessageId = [...messages].reverse().find(m => m.message_id_ebay)?.message_id_ebay;
  const ebayItemId = [...messages].reverse().find(m => m.item_id_ebay)?.item_id_ebay;

  if (ebayMessageId) {
    payload.message_id_ebay = ebayMessageId;
  }
  if (ebayItemId) {
    payload.item_id_ebay = ebayItemId;
  }
}
```

### Что изменится

| До | После |
|----|-------|
| Берёт `item_id_ebay` только из последнего сообщения | Ищет по всем сообщениям треда, берёт самое свежее непустое значение |
| Аналогично для `message_id_ebay` | Аналогично исправлено |

### Файлы для изменения

Только один файл: `src/components/ChatView.tsx` -- заменить блок условий для eBay (строки ~148-153).

