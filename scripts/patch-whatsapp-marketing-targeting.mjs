import fs from "node:fs";

const paths = {
  shopify: "n8n/whatsapp-marketing/shopify-sync.json",
  scheduler: "n8n/whatsapp-marketing/scheduler.json",
};

const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const write = (path, value) => fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const node = (workflow, name) => {
  const match = workflow.nodes.find((item) => item.name === name);
  if (!match) throw new Error(`Missing node: ${name}`);
  return match;
};

const shopify = read(paths.shopify);
const fetchCustomers = node(shopify, "Fetch Shopify customers page");
fetchCustomers.parameters.body = fetchCustomers.parameters.body.replace(
  "id firstName lastName locale tags\\n",
  "id firstName lastName locale tags numberOfOrders\\n        lastOrder { createdAt }\\n",
);

const normalize = node(shopify, "Normalize consent page");
normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
  "tags: Array.isArray(customer.tags) ? customer.tags : [],\n",
  "tags: Array.isArray(customer.tags) ? customer.tags : [],\n    order_count: Number(customer.numberOfOrders || 0),\n    last_order_at: customer.lastOrder?.createdAt || null,\n",
);

const upsert = node(shopify, "Build consent upsert");
upsert.parameters.jsCode = upsert.parameters.jsCode
  .replace(
    "tags, source, last_shopify_sync_at, updated_at)",
    "tags, order_count, last_order_at, source, last_shopify_sync_at, updated_at)",
  )
  .replace(
    "coalesce(x.tags, '[]'::jsonb), 'shopify', now(), now()",
    "coalesce(x.tags, '[]'::jsonb), coalesce(x.order_count, 0), x.last_order_at::timestamptz, 'shopify', now(), now()",
  )
  .replace(
    "sms_marketing_collected_from text, tags jsonb)",
    "sms_marketing_collected_from text, tags jsonb, order_count integer, last_order_at text)",
  )
  .replace(
    "tags = excluded.tags, last_shopify_sync_at",
    "tags = excluded.tags, order_count = excluded.order_count, last_order_at = excluded.last_order_at, last_shopify_sync_at",
  );
write(paths.shopify, shopify);

const scheduler = read(paths.scheduler);
const gate = node(scheduler, "Check hard send gates");
const metaGate = "    and coalesce((select (value #>> '{}')::boolean from public.wa_marketing_settings where key = 'meta_templates_approved'), false)";
gate.parameters.query = gate.parameters.query
  .replace(/\n    and coalesce\(\(select \(value #>> '\{\}'\)::boolean from public\.wa_marketing_settings where key = 'click_tracking_connected'\), false\)/g, "")
  .replace(/\n    and coalesce\(\(select \(value #>> '\{\}'\)::boolean from public\.wa_marketing_settings where key = 'order_attribution_connected'\), false\)/g, "")
  .replace(/\n    and extract\(hour from now\(\) at time zone 'Europe\/London'\) >= coalesce\(\(select \(value #>> '\{\}'\)::integer from public\.wa_marketing_settings where key = 'send_window_start_hour_london'\), 10\)/g, "")
  .replace(/\n    and extract\(hour from now\(\) at time zone 'Europe\/London'\) < coalesce\(\(select \(value #>> '\{\}'\)::integer from public\.wa_marketing_settings where key = 'send_window_end_hour_london'\), 18\)/g, "");
gate.parameters.query = gate.parameters.query.replace(
  metaGate,
  `${metaGate}\n    and coalesce((select (value #>> '{}')::boolean from public.wa_marketing_settings where key = 'click_tracking_connected'), false)\n    and coalesce((select (value #>> '{}')::boolean from public.wa_marketing_settings where key = 'order_attribution_connected'), false)\n    and extract(hour from now() at time zone 'Europe/London') >= coalesce((select (value #>> '{}')::integer from public.wa_marketing_settings where key = 'send_window_start_hour_london'), 10)\n    and extract(hour from now() at time zone 'Europe/London') < coalesce((select (value #>> '{}')::integer from public.wa_marketing_settings where key = 'send_window_end_hour_london'), 18)`,
);

node(scheduler, "Build cohort selection").parameters.jsCode = `const id = String($json.campaign_id || '');
if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid campaign id');
return [{ json: { sql: "with selected as (select * from public.wa_marketing_select_recipients('" + id + "'::uuid)) select s.recipient_id, s.phone_e164, c.id as campaign_id, c.template_name, c.template_language, c.template_components from selected s join public.wa_marketing_campaigns c on c.id = '" + id + "'::uuid;" } }];`;

node(scheduler, "Build final eligibility check").parameters.jsCode = `return $input.all().map((item) => {
  const recipientId = String(item.json.recipient_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(recipientId)) throw new Error('Invalid recipient id');
  return { json: { sql: "with send_lock as (select pg_advisory_xact_lock(hashtext('wa_marketing_daily_send_cap'))), ready as (update public.wa_marketing_recipients r set eligibility_status = 'eligible', blocked_reasons = '{}', send_status = 'sending', updated_at = now() from send_lock where r.id = '" + recipientId + "'::uuid and cardinality(public.wa_marketing_block_reasons(r.phone_e164, now())) = 0 and extract(hour from now() at time zone 'Europe/London') >= coalesce((select (value #>> '{}')::integer from public.wa_marketing_settings where key = 'send_window_start_hour_london'), 10) and extract(hour from now() at time zone 'Europe/London') < coalesce((select (value #>> '{}')::integer from public.wa_marketing_settings where key = 'send_window_end_hour_london'), 18) and (select count(*) from public.wa_marketing_recipients d join public.wa_marketing_campaigns dc on dc.id = d.campaign_id where dc.automatic and d.send_status in ('sending','sent','delivered','read') and (coalesce(d.sent_at,d.updated_at) at time zone 'Europe/London')::date = (now() at time zone 'Europe/London')::date) < coalesce((select (value #>> '{}')::integer from public.wa_marketing_settings where key = 'daily_send_limit'), 5) returning r.id, r.phone_e164, r.campaign_id, r.click_token) select ready.id as recipient_id, ready.phone_e164, ready.campaign_id, ready.click_token::text as click_token, c.template_name, c.template_language, c.template_components, contact.preference_token::text as preference_token from ready join public.wa_marketing_campaigns c on c.id = ready.campaign_id join public.wa_marketing_contacts contact on contact.phone_e164 = ready.phone_e164;" } };
});`;

const send = node(scheduler, "Send approved easyTag template");
send.parameters.body = send.parameters.body.replace(
  ".replaceAll('__PREFERENCE_TOKEN__', $json.preference_token))",
  ".replaceAll('__PREFERENCE_TOKEN__', $json.preference_token).replaceAll('__CLICK_TOKEN__', $json.click_token))",
);
node(scheduler, "Build send audit").parameters.jsCode = `const recipients = $('Final eligibility check').all();
return $input.all().map((item, index) => {
  const recipientId = String(recipients[index]?.json?.recipient_id || '').replace(/'/g, "''");
  const providerId = String(item.json.messages?.[0]?.id || '').replace(/'/g, "''");
  if (!recipientId || !providerId) throw new Error('WhatsApp send response could not be paired to a recipient');
  return { json: { sql: "with updated as (update public.wa_marketing_recipients set send_status = 'sent', provider_message_id = '" + providerId + "', sent_at = now(), updated_at = now() where id = '" + recipientId + "'::uuid returning id, campaign_id, phone_e164) insert into public.wa_marketing_events (campaign_id, recipient_id, phone_e164, provider_message_id, event_type, payload, occurred_at) select campaign_id, id, phone_e164, '" + providerId + "', 'sent', '{}'::jsonb, now() from updated;" } };
});`;
write(paths.scheduler, scheduler);
