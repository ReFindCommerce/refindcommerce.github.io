

## Исправление статуса NEW/ANSWERED

### Проблема
Все сообщения имеют одинаковый `uploaded_at`, поэтому порядок обработки непредсказуем и статус определяется неверно.

### Решение
Ты говоришь использовать `updated_at` из Supabase — это встроенное поле, которое обновляется при изменении строки. Нужно:

**Файл: `src/lib/supabase.ts`**

1. Изменить сортировку запроса — использовать `updated_at` вместо `uploaded_at` как основной критерий порядка, с `uploaded_at` как вторичным:

```typescript
.order('updated_at', { ascending: true })
.order('uploaded_at', { ascending: true })
```

2. Изменить сравнение времени в логике группировки — использовать `updated_at` для определения "последнего" сообщения:

```typescript
const msgTime = new Date(msg.updated_at).getTime();
const existingTime = new Date(existing.last_message_time).getTime();
```

3. Сохранять `updated_at` в `last_message_time` вместо `uploaded_at`.

4. Добавить `updated_at` в тип `Message` в `src/types/inbox.ts` (если его там нет — это стандартное поле Supabase, оно возвращается автоматически при `select('*')`).

Это гарантирует правильный порядок: даже если `uploaded_at` одинаковый, `updated_at` будет отличаться, т.к. Supabase обновляет его при каждом изменении строки.

