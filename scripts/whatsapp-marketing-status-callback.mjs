export const META_STATUS_EXTRACTOR_NODE = "Extract Meta marketing statuses";
export const META_STATUS_RECORDER_NODE = "Record Meta marketing statuses";
export const META_STATUS_RECORDER_QUERY =
  '={{ $json.sql || "select null::uuid as recipient_id where false" }}';

export function extractMetaStatuses(items, nowIso = new Date().toISOString()) {
  const allowedStatuses = new Set(["sent", "delivered", "read", "failed"]);
  const output = [];

  function visit(value, containers, depth = 0) {
    if (depth > 6 || value == null) return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, containers, depth + 1);
      return;
    }
    if (typeof value !== "object") return;

    if (Array.isArray(value.statuses)) containers.push(value);
    for (const key of ["body", "entry", "changes", "value"]) {
      if (value[key] != null) visit(value[key], containers, depth + 1);
    }
  }

  for (const item of items || []) {
    const root = item?.json || {};
    const containers = [];
    visit(root, containers);

    for (const container of containers) {
      for (const status of container.statuses || []) {
        const providerMessageId = String(status?.id || "").trim();
        const eventType = String(status?.status || "").trim().toLowerCase();
        if (!providerMessageId || !allowedStatuses.has(eventType)) continue;

        const rawTimestamp = String(status?.timestamp || "");
        const occurredAt = /^\d{9,13}$/.test(rawTimestamp)
          ? new Date(Number(rawTimestamp) * 1000).toISOString()
          : nowIso;
        const recipientDigits = String(
          status?.recipient_id || container?.contacts?.[0]?.wa_id || root?.contacts?.[0]?.wa_id || "",
        ).replace(/\D/g, "");
        const error = Array.isArray(status?.errors) ? status.errors[0] || {} : {};

        output.push({
          json: {
            provider_message_id: providerMessageId,
            event_type: eventType,
            occurred_at: occurredAt,
            phone_e164: recipientDigits ? `+${recipientDigits}` : "",
            error_code: String(error?.code || ""),
            error_message: String(error?.error_data?.details || error?.message || error?.title || ""),
            payload_json: JSON.stringify(status),
          },
        });
      }
    }
  }

  return output;
}

export const META_STATUS_SQL = `with incoming as (
  select
    $1::text as provider_message_id,
    lower($2::text) as event_type,
    $3::timestamptz as occurred_at,
    nullif($4::text, '') as callback_phone,
    nullif($5::text, '') as error_code,
    nullif($6::text, '') as error_message,
    $7::jsonb as payload
), target as (
  select
    r.id as recipient_id,
    r.campaign_id,
    r.phone_e164,
    r.send_status as previous_status,
    i.*
  from incoming i
  join public.wa_marketing_recipients r
    on r.provider_message_id = i.provider_message_id
  where i.event_type in ('sent', 'delivered', 'read', 'failed')
), updated as (
  update public.wa_marketing_recipients r
  set
    send_status = case
      when t.event_type = 'read' then 'read'
      when t.event_type = 'delivered' and r.send_status <> 'read' then 'delivered'
      when t.event_type = 'failed' and r.send_status in ('sending', 'sent') then 'failed'
      when t.event_type = 'sent' and r.send_status = 'sending' then 'sent'
      else r.send_status
    end,
    delivered_at = case
      when t.event_type in ('delivered', 'read') then coalesce(r.delivered_at, t.occurred_at)
      else r.delivered_at
    end,
    read_at = case
      when t.event_type = 'read' then coalesce(r.read_at, t.occurred_at)
      else r.read_at
    end,
    error_code = case
      when t.event_type = 'failed' and r.send_status in ('sending', 'sent') then t.error_code
      when t.event_type in ('delivered', 'read') then null
      else r.error_code
    end,
    error_message = case
      when t.event_type = 'failed' and r.send_status in ('sending', 'sent') then t.error_message
      when t.event_type in ('delivered', 'read') then null
      else r.error_message
    end,
    updated_at = now()
  from target t
  where r.id = t.recipient_id
  returning r.id, r.campaign_id, r.phone_e164, r.provider_message_id, r.send_status
), saved_event as (
  insert into public.wa_marketing_events (
    campaign_id, recipient_id, phone_e164, provider_message_id, event_type, payload, occurred_at
  )
  select
    u.campaign_id,
    u.id,
    u.phone_e164,
    u.provider_message_id,
    t.event_type,
    t.payload,
    t.occurred_at
  from updated u
  join target t on t.recipient_id = u.id
  where not exists (
    select 1
    from public.wa_marketing_events e
    where e.provider_message_id = u.provider_message_id
      and e.event_type = t.event_type
  )
  returning id
)
select
  u.id as recipient_id,
  u.provider_message_id,
  u.send_status,
  exists(select 1 from saved_event) as event_recorded
from updated u;`;

export function addSqlToMetaStatuses(rows, sqlTemplate = META_STATUS_SQL) {
  const sqlText = (value) => `'${String(value ?? "").replace(/'/g, "''")}'`;

  return (rows || []).map((item) => {
    const row = item.json;
    const sql = sqlTemplate
      .replace("$7::jsonb", `${sqlText(row.payload_json)}::jsonb`)
      .replace("$6::text", `${sqlText(row.error_message)}::text`)
      .replace("$5::text", `${sqlText(row.error_code)}::text`)
      .replace("$4::text", `${sqlText(row.phone_e164)}::text`)
      .replace("$3::timestamptz", `${sqlText(row.occurred_at)}::timestamptz`)
      .replace("$2::text", `${sqlText(row.event_type)}::text`)
      .replace("$1::text", `${sqlText(row.provider_message_id)}::text`);
    return { json: { ...row, sql } };
  });
}

export const META_STATUS_EXTRACTOR_CODE = `const extractMetaStatuses = ${extractMetaStatuses.toString()};
const addSqlToMetaStatuses = ${addSqlToMetaStatuses.toString()};
const sqlTemplate = ${JSON.stringify(META_STATUS_SQL)};
return addSqlToMetaStatuses(extractMetaStatuses($input.all()), sqlTemplate);`;

export function buildMetaStatusNodes(postgresCredential, triggerPosition = [-592, 512]) {
  const [triggerX, triggerY] = triggerPosition;
  return [
    {
      parameters: { jsCode: META_STATUS_EXTRACTOR_CODE },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [triggerX + 256, triggerY + 736],
      id: "73bb887a-dad6-4827-b427-7a1561770622",
      name: META_STATUS_EXTRACTOR_NODE,
      onError: "continueRegularOutput",
    },
    {
      parameters: {
        operation: "executeQuery",
        query: META_STATUS_RECORDER_QUERY,
        options: {},
      },
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.6,
      position: [triggerX + 512, triggerY + 736],
      id: "a529710b-83b2-42e5-b1ec-fdddf558ac67",
      name: META_STATUS_RECORDER_NODE,
      credentials: { postgres: postgresCredential },
      onError: "continueRegularOutput",
    },
  ];
}

export function addMetaStatusBranch(workflow) {
  if (!workflow?.nodes || !workflow?.connections) throw new Error("Invalid n8n workflow");

  const trigger = workflow.nodes.find((node) => node.name === "WhatsApp Trigger");
  const postgres = workflow.nodes.find((node) => node.credentials?.postgres);
  if (!trigger) throw new Error("WhatsApp Trigger node not found");
  if (!postgres?.credentials?.postgres) throw new Error("Postgres credential reference not found");

  const nodes = buildMetaStatusNodes(postgres.credentials.postgres, trigger.position);
  for (const node of nodes) {
    const existing = workflow.nodes.find((candidate) => candidate.name === node.name);
    if (existing) Object.assign(existing, node, { id: existing.id, position: existing.position });
    else workflow.nodes.push(node);
  }
  workflow.connections[META_STATUS_EXTRACTOR_NODE] = {
    main: [[{ node: META_STATUS_RECORDER_NODE, type: "main", index: 0 }]],
  };

  const triggerMain = workflow.connections[trigger.name]?.main?.[0];
  if (!Array.isArray(triggerMain)) throw new Error("WhatsApp Trigger main connection not found");
  if (!triggerMain.some((connection) => connection.node === META_STATUS_EXTRACTOR_NODE)) {
    triggerMain.push({ node: META_STATUS_EXTRACTOR_NODE, type: "main", index: 0 });
  }
  return workflow;
}
