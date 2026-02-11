

## Обновление webhook URL-ов

Замена всех webhook-адресов в файле `src/types/inbox.ts`:

| Канал | Старый URL | Новый URL |
|-------|-----------|-----------|
| whatsapp | `https://n8n.srv1247903.hstgr.cloud/webhook/unified-inbox` | `https://n8n.srv1354140.hstgr.cloud/webhook/whatsapp` |
| gmail | `https://n8n.srv1247903.hstgr.cloud/webhook/dd2988d5-...` | `https://n8n.srv1354140.hstgr.cloud/webhook/gmail` |
| amazon | `https://n8n.srv1247903.hstgr.cloud/webhook/7e998505-...` | *(без изменений -- новый URL не указан)* |
| ebay | `https://n8n.srv1247903.hstgr.cloud/webhook/f2a6e6ac-...` | `https://n8n.srv1354140.hstgr.cloud/webhook/ebay` |
| tiktok shop | `https://n8n.srv1247903.hstgr.cloud/webhook/13e53ba7-...` | `https://n8n.srv1354140.hstgr.cloud/webhook/tiktokshop` |

### Детали

**Файл:** `src/types/inbox.ts` -- обновить объект `CHANNEL_WEBHOOKS`.

> Amazon webhook не был указан в запросе, поэтому останется прежним.

