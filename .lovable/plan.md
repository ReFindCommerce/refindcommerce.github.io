

## Исправление: убрать `updated_at`, использовать только `uploaded_at` + пагинация

### Проблема
Код сейчас сначала пытается сортировать по `updated_at` (которого нет в БД), получает ошибку 400, и только потом fallback на `uploaded_at`. Это лишний запрос каждые 10 секунд.

### Изменения в `src/lib/supabase.ts`

1. **Убрать fallback-логику с `updated_at`** — использовать только `uploaded_at` + `id` для сортировки. Пагинация через `fetchAllRows` уже работает и останется.

2. **Упростить `fetchConversations`** — убрать `buildQuery` с параметром `orderCol`, try/catch с кодом `42703`. Просто один запрос:
```typescript
let query = supabase
  .from(TABLE_NAME)
  .select('*')
  .order('uploaded_at', { ascending: true })
  .order('id', { ascending: true });
// + apply filters
// + fetchAllRows(query)
```

3. **Убрать ссылки на `msg.updated_at`** в группировке — использовать только `msg.uploaded_at` для `last_message_time` и сравнения времени.

4. **В `src/types/inbox.ts`** — убрать `updated_at` из типа `Message` (его нет в БД).

Пагинация (`fetchAllRows` с `range()`) уже реализована и загружает все строки без лимита — она остаётся как есть.

