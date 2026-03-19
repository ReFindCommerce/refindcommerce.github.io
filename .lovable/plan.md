

## Send eBay IDs as arrays in webhook payload

**Change in `src/components/ChatView.tsx`** (~lines 155-162):

Replace the current logic that finds a single `message_id_ebay` and `item_id_ebay` with collecting all non-null values into arrays:

```typescript
if (channel === 'ebay') {
  const ebayMessageIds = messages
    .filter(m => m.message_id_ebay)
    .map(m => m.message_id_ebay);
  const ebayItemIds = messages
    .filter(m => m.item_id_ebay)
    .map(m => m.item_id_ebay);

  if (ebayMessageIds.length > 0) {
    payload.message_id_ebay = ebayMessageIds;
  }
  if (ebayItemIds.length > 0) {
    payload.item_id_ebay = ebayItemIds;
  }
}
```

One file, one change. The webhook will now receive arrays of all eBay IDs from the thread instead of a single value.

