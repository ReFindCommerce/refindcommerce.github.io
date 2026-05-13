# Inbox Release Guardrails

Use this process for every inbox or n8n workflow change.

## Production Rules

- Do not edit active production n8n workflows directly unless production is already broken.
- Duplicate the workflow, make the change in staging, and run the checks below before copying the change to production.
- Keep `inbox_messages.status` only for inbox state:
  - `new` for inbound customer messages.
  - `answered` for outbound agent replies.
- Do not write delivery states such as `sending`, `sent`, `send_failed`, `queued`, or `failed` into `inbox_messages.status`.
- If delivery tracking is needed, add a separate `delivery_status` column instead of changing `status`.

## Required Checks Before Release

Run:

```sh
npm run validate:inbox
npm run test -- --run
npm run build
```

The inbox validation checks that:

- Required n8n workflows are active.
- Supabase status writes use only supported inbox statuses.
- Gmail outbound sends connect directly to `Respond to Webhook`.
- The fragile post-send status update chain cannot block customer replies.
- `Webhook.item` references are not reintroduced.
- Production webhook paths remain stable.

## Safe Smoke Test

After the validation passes, run one safe Gmail test to `tom@refindcommerce.com` and confirm:

- n8n returns `200 OK`.
- The latest Gmail workflow execution is `success/webhook`.
- The response includes Gmail message/thread IDs.

Do not remove email notifications or make broad workflow rewires until the replacement notification path has passed a live device test.

## If Production Breaks

1. Stop non-essential edits.
2. Check latest n8n executions for the affected workflow.
3. Restore the last known-good workflow connection/status contract.
4. Run `npm run validate:inbox`.
5. Run a safe smoke test before resuming customer replies.
