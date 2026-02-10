

## Добавить поле item_id_ebay в webhook payload для eBay

### Что нужно сделать

Добавить новое поле `item_id_ebay` в интерфейс `Message` и включить его в payload при отправке на eBay webhook (аналогично тому, как уже сделано для `message_id_ebay`).

### Изменения

**1. `src/types/inbox.ts`** — добавить поле в интерфейс Message:
```typescript
message_id_ebay: string | null;
item_id_ebay: string | null;  // новое поле
```

**2. `src/components/ChatView.tsx`** — добавить передачу `item_id_ebay` в payload рядом с существующей логикой для `message_id_ebay`:
```typescript
if (channel === 'ebay' && latestMessage?.message_id_ebay) {
  payload.message_id_ebay = latestMessage.message_id_ebay;
}
// Добавить:
if (channel === 'ebay' && latestMessage?.item_id_ebay) {
  payload.item_id_ebay = latestMessage.item_id_ebay;
}
```

### Итоговый payload для eBay

| Поле | Значение |
|------|----------|
| message_id_ebay | ID сообщения eBay (уже есть) |
| item_id_ebay | ID товара eBay (новое) |

Оба поля добавляются только для канала eBay и только если значение существует в базе данных.

