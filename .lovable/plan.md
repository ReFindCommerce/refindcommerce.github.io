

## Plan: Show eBay subject under customer messages

Two small changes:

### 1. `src/types/inbox.ts`
Add to `Message` interface:
```typescript
subject_ebay_message: string | null;
```

### 2. `src/components/MessageBubble.tsx`
After the message content `<div>` (around line 65), add for inbound eBay messages with non-empty subject:

```tsx
{message.channel === 'ebay' && !isOutbound && message.subject_ebay_message && (
  <p className="text-xs text-muted-foreground mt-1 px-1">
    📦 {message.subject_ebay_message}
  </p>
)}
```

No query changes needed — `select('*')` already picks up the new column. Empty/null values are handled by the `&&` check.

