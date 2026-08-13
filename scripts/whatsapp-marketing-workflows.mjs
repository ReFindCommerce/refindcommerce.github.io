const SHOP_DOMAIN = "s2amdn-ha.myshopify.com";
const SHOPIFY_API_VERSION = "2026-07";
const EASYTAG_PHONE_NUMBER_ID = "953305754533805";
const WHATSAPP_GRAPH_VERSION = "v23.0";

const credential = (id, name) => ({ id, name });

const postgresNode = (id, name, position, query, postgresCredentialId) => ({
  id,
  name,
  type: "n8n-nodes-base.postgres",
  typeVersion: 2.6,
  position,
  parameters: { operation: "executeQuery", query, options: {} },
  credentials: { postgres: credential(postgresCredentialId, "Postgres account") },
});

const shopifyTokenNode = (id, name, position, tokenCredentialId) => ({
  id,
  name,
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position,
  parameters: {
    method: "POST",
    url: `https://${SHOP_DOMAIN}/admin/oauth/access_token`,
    authentication: "genericCredentialType",
    genericAuthType: "httpCustomAuth",
    options: {},
  },
  credentials: {
    httpCustomAuth: credential(tokenCredentialId, "easyTag Shopify Marketing Token Exchange"),
  },
});

const scheduleNode = (id, name, position, expression) => ({
  id,
  name,
  type: "n8n-nodes-base.scheduleTrigger",
  typeVersion: 1.2,
  position,
  parameters: { rule: { interval: [{ field: "cronExpression", expression }] } },
});

const webhookNode = (id, name, position, path) => ({
  id,
  name,
  type: "n8n-nodes-base.webhook",
  typeVersion: 2.1,
  position,
  parameters: { httpMethod: "POST", path, responseMode: "lastNode", options: {} },
});

const standardSettings = {
  executionOrder: "v1",
  timezone: "Europe/London",
  saveDataSuccessExecution: "none",
  saveExecutionProgress: false,
};

function attachWebhook(workflow, includeWebhook, triggerName, nextNodeName, path) {
  if (!includeWebhook) return workflow;

  workflow.nodes.push(webhookNode(`${triggerName}-webhook`, `${triggerName} staging webhook`, [0, 100], path));
  workflow.connections[`${triggerName} staging webhook`] = {
    main: [[{ node: nextNodeName, type: "main", index: 0 }]],
  };
  return workflow;
}

export function buildShopifySyncWorkflow({ tokenCredentialId, postgresCredentialId, includeWebhook = false }) {
  const customerQuery = `query MarketingCustomers($cursor: String) {
    customers(first: 250, after: $cursor) {
      nodes {
        id firstName lastName locale tags numberOfOrders
        lastOrder { createdAt }
        defaultPhoneNumber {
          phoneNumber
          marketingState marketingOptInLevel marketingUpdatedAt marketingCollectedFrom
          whatsAppMarketingConsent { state optInLevel updatedAt collectedFrom }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

  const parsePageCode = `const payload = $input.first().json;
if (payload.errors?.length) {
  throw new Error('Shopify customer query failed: ' + payload.errors.map((error) => error.message).join('; '));
}
const customers = (payload.data?.customers?.nodes || [])
  .filter((customer) => customer.defaultPhoneNumber?.phoneNumber)
  .map((customer) => {
    const phone = customer.defaultPhoneNumber;
    const whatsAppState = phone.whatsAppMarketingConsent?.state || 'NEVER_SUBSCRIBED';
    const smsState = phone.marketingState || null;
    const consentState = whatsAppState === 'SUBSCRIBED'
      ? 'SUBSCRIBED'
      : whatsAppState === 'UNSUBSCRIBED'
        ? 'UNSUBSCRIBED'
        : smsState === 'SUBSCRIBED'
          ? 'SUBSCRIBED'
          : 'NEVER_SUBSCRIBED';
    const consentBasis = whatsAppState === 'SUBSCRIBED' || whatsAppState === 'UNSUBSCRIBED'
      ? 'shopify_whatsapp'
      : smsState === 'SUBSCRIBED'
        ? 'shopify_sms'
        : 'none';
    return {
    phone_e164: String(customer.defaultPhoneNumber.phoneNumber).replace(/[^+\\d]/g, ''),
    shopify_customer_id: customer.id,
    first_name: customer.firstName || null,
    last_name: customer.lastName || null,
    locale: customer.locale || null,
    consent_state: consentState,
    consent_updated_at: phone.whatsAppMarketingConsent?.updatedAt || phone.marketingUpdatedAt || null,
    consent_collected_from: phone.whatsAppMarketingConsent?.collectedFrom || phone.marketingCollectedFrom || null,
    consent_basis: consentBasis,
    sms_marketing_state: smsState,
    sms_marketing_updated_at: phone.marketingUpdatedAt || null,
    sms_marketing_collected_from: phone.marketingCollectedFrom || null,
    tags: Array.isArray(customer.tags) ? customer.tags : [],
    order_count: Number(customer.numberOfOrders || 0),
    last_order_at: customer.lastOrder?.createdAt || null,
    };
  });
const pageInfo = payload.data?.customers?.pageInfo || {};
return [{
  json: {
    customers,
    cursor: pageInfo.endCursor || null,
    has_next_page: pageInfo.hasNextPage === true,
  },
}];`;

  const buildUpsertCode = `const input = $input.first().json;
const encoded = JSON.stringify(input.customers || []).replace(/'/g, "''");
const cursor = String(input.cursor || '').replace(/'/g, "''");
const hasNext = input.has_next_page === true ? 'true' : 'false';
const sql = [
  "insert into public.wa_marketing_contacts (phone_e164, shopify_customer_id, first_name, last_name, locale, consent_state, consent_updated_at, consent_collected_from, consent_basis, sms_marketing_state, sms_marketing_updated_at, sms_marketing_collected_from, tags, order_count, last_order_at, source, last_shopify_sync_at, updated_at)",
  "select x.phone_e164, x.shopify_customer_id, x.first_name, x.last_name, x.locale, x.consent_state, x.consent_updated_at::timestamptz, x.consent_collected_from, x.consent_basis, x.sms_marketing_state, x.sms_marketing_updated_at::timestamptz, x.sms_marketing_collected_from, coalesce(x.tags, '[]'::jsonb), coalesce(x.order_count, 0), x.last_order_at::timestamptz, 'shopify', now(), now()",
  "from jsonb_to_recordset('" + encoded + "'::jsonb) as x(phone_e164 text, shopify_customer_id text, first_name text, last_name text, locale text, consent_state text, consent_updated_at text, consent_collected_from text, consent_basis text, sms_marketing_state text, sms_marketing_updated_at text, sms_marketing_collected_from text, tags jsonb, order_count integer, last_order_at text)",
  "on conflict (phone_e164) do update set shopify_customer_id = excluded.shopify_customer_id, first_name = excluded.first_name, last_name = excluded.last_name, locale = excluded.locale, consent_state = excluded.consent_state, consent_updated_at = excluded.consent_updated_at, consent_collected_from = excluded.consent_collected_from, consent_basis = excluded.consent_basis, sms_marketing_state = excluded.sms_marketing_state, sms_marketing_updated_at = excluded.sms_marketing_updated_at, sms_marketing_collected_from = excluded.sms_marketing_collected_from, tags = excluded.tags, order_count = excluded.order_count, last_order_at = excluded.last_order_at, last_shopify_sync_at = now(), updated_at = now();",
  "select '" + cursor + "'::text as cursor, " + hasNext + "::boolean as has_next_page, (select count(*) from public.wa_marketing_contacts)::integer as contacts_total;",
].join(' ');
return [{ json: { sql } }];`;

  const nodes = [
    scheduleNode("wa-sync-schedule", "Daily 03:15 London", [0, -100], "15 3 * * *"),
    shopifyTokenNode("wa-sync-token", "Get short-lived Shopify token", [260, -100], tokenCredentialId),
    {
      id: "wa-sync-start",
      name: "Start pagination",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [520, -100],
      parameters: { jsCode: "return [{ json: { cursor: null } }];" },
    },
    {
      id: "wa-sync-fetch",
      name: "Fetch Shopify customers page",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [780, -100],
      parameters: {
        method: "POST",
        url: `https://${SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Content-Type", value: "application/json" },
            { name: "Accept-Encoding", value: "identity" },
            {
              name: "X-Shopify-Access-Token",
              value: "={{ $('Get short-lived Shopify token').first().json.access_token }}",
            },
          ],
        },
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: `={{ JSON.stringify({ query: ${JSON.stringify(customerQuery)}, variables: { cursor: $json.cursor || null } }) }}`,
        options: {},
      },
    },
    {
      id: "wa-sync-parse",
      name: "Normalize consent page",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1040, -100],
      parameters: { jsCode: parsePageCode },
    },
    {
      id: "wa-sync-sql",
      name: "Build consent upsert",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1300, -100],
      parameters: { jsCode: buildUpsertCode },
    },
    postgresNode(
      "wa-sync-upsert",
      "Upsert Shopify consent page",
      [1560, -100],
      "={{ $json.sql }}",
      postgresCredentialId,
    ),
    {
      id: "wa-sync-more",
      name: "More Shopify pages?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [1820, -100],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3 },
          conditions: [
            {
              id: "wa-sync-has-more",
              leftValue: "={{ $json.has_next_page }}",
              rightValue: true,
              operator: { type: "boolean", operation: "true", singleValue: true },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
    },
    postgresNode(
      "wa-sync-complete",
      "Mark Shopify sync healthy",
      [2080, 20],
      `insert into public.wa_marketing_settings (key, value, updated_at)
       values ('shopify_connected', 'true'::jsonb, now())
       on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
       select count(*)::integer as contacts_total,
              count(*) filter (where consent_state = 'SUBSCRIBED')::integer as whatsapp_subscribed,
              max(last_shopify_sync_at) as synced_at
       from public.wa_marketing_contacts;`,
      postgresCredentialId,
    ),
  ];

  const connections = {
    "Daily 03:15 London": { main: [[{ node: "Get short-lived Shopify token", type: "main", index: 0 }]] },
    "Get short-lived Shopify token": { main: [[{ node: "Start pagination", type: "main", index: 0 }]] },
    "Start pagination": { main: [[{ node: "Fetch Shopify customers page", type: "main", index: 0 }]] },
    "Fetch Shopify customers page": { main: [[{ node: "Normalize consent page", type: "main", index: 0 }]] },
    "Normalize consent page": { main: [[{ node: "Build consent upsert", type: "main", index: 0 }]] },
    "Build consent upsert": { main: [[{ node: "Upsert Shopify consent page", type: "main", index: 0 }]] },
    "Upsert Shopify consent page": { main: [[{ node: "More Shopify pages?", type: "main", index: 0 }]] },
    "More Shopify pages?": {
      main: [
        [{ node: "Fetch Shopify customers page", type: "main", index: 0 }],
        [{ node: "Mark Shopify sync healthy", type: "main", index: 0 }],
      ],
    },
  };

  return attachWebhook(
    { name: "easyTag WhatsApp Marketing - Shopify Sync", nodes, connections, settings: standardSettings },
    includeWebhook,
    "Shopify sync",
    "Get short-lived Shopify token",
    "easytag-wa-marketing-shopify-sync-staging",
  );
}

export function buildSupportSafetyWorkflow({ postgresCredentialId, includeWebhook = false }) {
  const safetySql = `insert into public.wa_marketing_contacts (
    phone_e164, consent_state, consent_basis, consent_updated_at, consent_collected_from,
    source, support_status, last_inbox_sync_at, updated_at
  )
  select distinct
    '+' || regexp_replace(coalesce(thread_id, message_from, ''), '[^0-9]', '', 'g'),
    'SUBSCRIBED',
    'support_marketing_optin',
    min(uploaded_at) over (partition by regexp_replace(coalesce(thread_id, message_from, ''), '[^0-9]', '', 'g')),
    'SUPPORT_MARKETING_AGREEMENT',
    'inbox',
    'unknown',
    now(),
    now()
  from public.inbox_messages
  where lower(channel) = 'whatsapp'
    and regexp_replace(coalesce(thread_id, message_from, ''), '[^0-9]', '', 'g') ~ '^[1-9][0-9]{7,14}$'
  on conflict (phone_e164) do update
    set last_inbox_sync_at = now(), updated_at = now();

  with whatsapp_messages as (
    select
      case
        when regexp_replace(coalesce(thread_id, message_from, ''), '[^0-9]', '', 'g') ~ '^[1-9][0-9]{7,14}$'
          then '+' || regexp_replace(coalesce(thread_id, message_from, ''), '[^0-9]', '', 'g')
        else null
      end as phone_e164,
      direction,
      lower(coalesce(user_message, final_reply, '')) as body,
      uploaded_at,
      row_number() over (
        partition by regexp_replace(coalesce(thread_id, message_from, ''), '[^0-9]', '', 'g')
        order by uploaded_at desc, id desc
      ) as row_num
    from public.inbox_messages
    where lower(channel) = 'whatsapp'
  ), support_rollup as (
    select
      phone_e164,
      max(uploaded_at) as last_support_at,
      (array_agg(body order by uploaded_at desc) filter (where direction = 'inbound' and row_num <= 12))[1] as recent_inbound,
      (array_agg(direction order by uploaded_at desc))[1] as latest_direction,
      string_agg(body, ' ' order by uploaded_at desc) filter (where row_num <= 12) as recent_text
    from whatsapp_messages
    where phone_e164 is not null
    group by phone_e164
  ), classified as (
    select
      c.phone_e164,
      s.last_support_at,
      case
        when s.phone_e164 is null then 'no_history'
        when coalesce(s.recent_text, '') ~ '(still (not|doesn.t)|not working|doesn.t work|broken|angry|complaint|refund|scam|terrible|awful|disappointed|no response|never arrived|not received)' then 'unsatisfied'
        when s.latest_direction = 'inbound' then 'open'
        when coalesce(s.recent_inbound, '') ~ '(thank(s| you)|great|perfect|working now|works now|resolved|sorted|received (it|the replacement)|appreciate)' then 'satisfied'
        else 'unknown'
      end as support_status
    from public.wa_marketing_contacts c
    left join support_rollup s using (phone_e164)
  )
  update public.wa_marketing_contacts c
  set support_status = classified.support_status,
      support_evidence = case classified.support_status
        when 'satisfied' then 'Latest support history contains a clear positive resolution signal.'
        when 'unsatisfied' then 'Recent support history contains an unresolved or negative signal.'
        when 'open' then 'The customer sent the most recent support message.'
        when 'unknown' then 'Support history exists without a clear satisfaction signal.'
        else 'No WhatsApp support history was found.'
      end,
      last_support_at = classified.last_support_at,
      cooling_until = case
        when classified.last_support_at is null then null
        else classified.last_support_at + make_interval(days => public.wa_marketing_setting_number('support_cooling_days', 7)::integer)
      end,
      last_inbox_sync_at = now(),
      updated_at = now()
  from classified
  where c.phone_e164 = classified.phone_e164;

  select support_status, count(*)::integer as contacts
  from public.wa_marketing_contacts
  group by support_status
  order by support_status;`;

  const nodes = [
    scheduleNode("wa-safety-schedule", "Daily 03:45 London", [0, -100], "45 3 * * *"),
    postgresNode("wa-safety-classify", "Classify support safety", [320, -100], safetySql, postgresCredentialId),
  ];
  const connections = {
    "Daily 03:45 London": { main: [[{ node: "Classify support safety", type: "main", index: 0 }]] },
  };

  return attachWebhook(
    { name: "easyTag WhatsApp Marketing - Support Safety Sync", nodes, connections, settings: standardSettings },
    includeWebhook,
    "Support safety",
    "Classify support safety",
    "easytag-wa-marketing-support-safety-staging",
  );
}

export function buildShopifyContactImportWorkflow({ tokenCredentialId, postgresCredentialId, includeWebhook = false }) {
  const candidateSql = `select c.phone_e164
  from public.wa_marketing_contacts c
  where c.source = 'inbox'
    and c.support_status = 'satisfied'
    and c.shopify_customer_id is null
    and c.consent_state = 'SUBSCRIBED'
    and c.opted_out_at is null
    and not exists (select 1 from public.wa_marketing_suppressions s where s.phone_e164 = c.phone_e164)
  order by md5(c.phone_e164)
  limit 50;`;

  const findQuery = `query FindCustomerByPhone($query: String!) {
    customers(first: 5, query: $query) {
      nodes { id defaultPhoneNumber { phoneNumber } }
    }
  }`;
  const createMutation = `mutation CreateSupportContact($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }`;
  const consentMutation = `mutation SetWhatsAppConsent($input: CustomerWhatsAppMarketingConsentUpdateInput!) {
    customerWhatsAppMarketingConsentUpdate(input: $input) {
      customerPhoneNumber { phoneNumber }
      userErrors { field message }
    }
  }`;

  const inspectExistingCode = `const payload = $input.first().json;
if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join('; '));
const phone = $('Select satisfied support contacts').item.json.phone_e164;
const exact = (payload.data?.customers?.nodes || []).find((customer) => customer.defaultPhoneNumber?.phoneNumber === phone);
return [{ json: { phone_e164: phone, existing_customer_id: exact?.id || null } }];`;

  const validateCreateCode = `const payload = $input.first().json;
const result = payload.data?.customerCreate;
if (payload.errors?.length || result?.userErrors?.length || !result?.customer?.id) {
  throw new Error('Shopify customer import failed: ' + [
    ...(payload.errors || []).map((error) => error.message),
    ...(result?.userErrors || []).map((error) => error.message),
  ].join('; '));
}
return [{ json: { phone_e164: $('Inspect exact phone match').item.json.phone_e164, shopify_customer_id: result.customer.id } }];`;

  const validateConsentCode = `const payload = $input.first().json;
const result = payload.data?.customerWhatsAppMarketingConsentUpdate;
if (payload.errors?.length || result?.userErrors?.length || !result?.customerPhoneNumber?.phoneNumber) {
  throw new Error('Shopify WhatsApp consent sync failed: ' + [
    ...(payload.errors || []).map((error) => error.message),
    ...(result?.userErrors || []).map((error) => error.message),
  ].join('; '));
}
return [{ json: {
  phone_e164: $('Prepare consent update').item.json.phone_e164,
  shopify_customer_id: $('Prepare consent update').item.json.shopify_customer_id,
} }];`;

  const auditImportCode = `const phone = String($json.phone_e164 || '').replace(/'/g, "''");
const customerId = String($json.shopify_customer_id || '').replace(/'/g, "''");
return [{ json: { sql: "with updated as (update public.wa_marketing_contacts set shopify_customer_id = '" + customerId + "', last_shopify_sync_at = now(), updated_at = now() where phone_e164 = '" + phone + "' returning phone_e164) insert into public.wa_marketing_events (phone_e164, event_type, payload, occurred_at) select phone_e164, 'shopify_contact_imported', jsonb_build_object('shopify_customer_id', '" + customerId + "'), now() from updated;" } }];`;

  const nodes = [
    scheduleNode("wa-import-schedule", "Daily 04:10 London", [0, -100], "10 4 * * *"),
    shopifyTokenNode("wa-import-token", "Get import Shopify token", [260, -100], tokenCredentialId),
    postgresNode("wa-import-candidates", "Select satisfied support contacts", [520, -100], candidateSql, postgresCredentialId),
    {
      id: "wa-import-filter",
      name: "Filter import candidates",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [650, -100],
      parameters: { jsCode: "return $input.all().filter((item) => Boolean(item.json.phone_e164));" },
    },
    {
      id: "wa-import-find",
      name: "Find existing Shopify customer",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [780, -100],
      parameters: {
        method: "POST",
        url: `https://${SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        sendHeaders: true,
        headerParameters: { parameters: [
          { name: "Content-Type", value: "application/json" },
          { name: "Accept-Encoding", value: "identity" },
          { name: "X-Shopify-Access-Token", value: "={{ $('Get import Shopify token').first().json.access_token }}" },
        ] },
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: `={{ JSON.stringify({ query: ${JSON.stringify(findQuery)}, variables: { query: 'phone:' + $json.phone_e164 } }) }}`,
        options: {},
      },
    },
    { id: "wa-import-inspect", name: "Inspect exact phone match", type: "n8n-nodes-base.code", typeVersion: 2, position: [1040, -100], parameters: { jsCode: inspectExistingCode } },
    {
      id: "wa-import-exists",
      name: "Customer already exists?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [1300, -100],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 3 },
          conditions: [{ id: "wa-import-existing", leftValue: "={{ $json.existing_customer_id }}", rightValue: "", operator: { type: "string", operation: "exists", singleValue: true } }],
          combinator: "and",
        },
        options: {},
      },
    },
    {
      id: "wa-import-existing-id",
      name: "Use existing customer",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1560, -220],
      parameters: { jsCode: "return [{ json: { phone_e164: $json.phone_e164, shopify_customer_id: $json.existing_customer_id } }];" },
    },
    {
      id: "wa-import-create",
      name: "Create Shopify support contact",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1560, 20],
      parameters: {
        method: "POST",
        url: `https://${SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        sendHeaders: true,
        headerParameters: { parameters: [
          { name: "Content-Type", value: "application/json" },
          { name: "Accept-Encoding", value: "identity" },
          { name: "X-Shopify-Access-Token", value: "={{ $('Get import Shopify token').first().json.access_token }}" },
        ] },
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: `={{ JSON.stringify({ query: ${JSON.stringify(createMutation)}, variables: { input: { phone: $json.phone_e164, tags: ['whatsapp-support-optin', 'whatsapp-marketing'], note: 'Imported from ReFind Inbox after the support marketing agreement and satisfaction safety check.', whatsAppMarketingConsent: { state: 'SUBSCRIBED', optInLevel: 'SINGLE_OPT_IN', updatedAt: $now.toISO() } } } }) }}`,
        options: {},
      },
    },
    { id: "wa-import-validate-create", name: "Validate customer import", type: "n8n-nodes-base.code", typeVersion: 2, position: [1820, 20], parameters: { jsCode: validateCreateCode } },
    {
      id: "wa-import-prepare-consent",
      name: "Prepare consent update",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1950, -100],
      parameters: { jsCode: "return [{ json: { phone_e164: $json.phone_e164, shopify_customer_id: $json.shopify_customer_id } }];" },
    },
    {
      id: "wa-import-consent",
      name: "Confirm WhatsApp consent in Shopify",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2080, -100],
      parameters: {
        method: "POST",
        url: `https://${SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        sendHeaders: true,
        headerParameters: { parameters: [
          { name: "Content-Type", value: "application/json" },
          { name: "Accept-Encoding", value: "identity" },
          { name: "X-Shopify-Access-Token", value: "={{ $('Get import Shopify token').first().json.access_token }}" },
        ] },
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: `={{ JSON.stringify({ query: ${JSON.stringify(consentMutation)}, variables: { input: { customerId: $json.shopify_customer_id, whatsAppMarketingConsent: { state: 'SUBSCRIBED', optInLevel: 'SINGLE_OPT_IN', updatedAt: $now.toISO() } } } }) }}`,
        options: {},
      },
    },
    { id: "wa-import-validate-consent", name: "Validate imported consent", type: "n8n-nodes-base.code", typeVersion: 2, position: [2340, -100], parameters: { jsCode: validateConsentCode } },
    { id: "wa-import-audit-code", name: "Build contact import audit", type: "n8n-nodes-base.code", typeVersion: 2, position: [2600, -100], parameters: { jsCode: auditImportCode } },
    postgresNode("wa-import-audit", "Record Shopify contact import", [2860, -100], "={{ $json.sql }}", postgresCredentialId),
  ];
  const connections = {
    "Daily 04:10 London": { main: [[{ node: "Get import Shopify token", type: "main", index: 0 }]] },
    "Get import Shopify token": { main: [[{ node: "Select satisfied support contacts", type: "main", index: 0 }]] },
    "Select satisfied support contacts": { main: [[{ node: "Filter import candidates", type: "main", index: 0 }]] },
    "Filter import candidates": { main: [[{ node: "Find existing Shopify customer", type: "main", index: 0 }]] },
    "Find existing Shopify customer": { main: [[{ node: "Inspect exact phone match", type: "main", index: 0 }]] },
    "Inspect exact phone match": { main: [[{ node: "Customer already exists?", type: "main", index: 0 }]] },
    "Customer already exists?": { main: [
      [{ node: "Use existing customer", type: "main", index: 0 }],
      [{ node: "Create Shopify support contact", type: "main", index: 0 }],
    ] },
    "Use existing customer": { main: [[{ node: "Prepare consent update", type: "main", index: 0 }]] },
    "Create Shopify support contact": { main: [[{ node: "Validate customer import", type: "main", index: 0 }]] },
    "Validate customer import": { main: [[{ node: "Prepare consent update", type: "main", index: 0 }]] },
    "Prepare consent update": { main: [[{ node: "Confirm WhatsApp consent in Shopify", type: "main", index: 0 }]] },
    "Confirm WhatsApp consent in Shopify": { main: [[{ node: "Validate imported consent", type: "main", index: 0 }]] },
    "Validate imported consent": { main: [[{ node: "Build contact import audit", type: "main", index: 0 }]] },
    "Build contact import audit": { main: [[{ node: "Record Shopify contact import", type: "main", index: 0 }]] },
  };

  return attachWebhook(
    { name: "easyTag WhatsApp Marketing - Shopify Contact Import", nodes, connections, settings: standardSettings },
    includeWebhook,
    "Contact import",
    "Get import Shopify token",
    "easytag-wa-marketing-contact-import-staging",
  );
}

export function buildOptOutWorkflow({ tokenCredentialId, postgresCredentialId, includeWebhook = false }) {
  const detectSql = `with optouts as (
    select distinct
      '+' || regexp_replace(coalesce(thread_id, message_from, ''), '[^0-9]', '', 'g') as phone_e164
    from public.inbox_messages
    where lower(channel) = 'whatsapp'
      and direction = 'inbound'
      and upper(trim(regexp_replace(coalesce(user_message, ''), '[^A-Za-z ]', '', 'g')))
        in ('STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPTOUT', 'CANCEL', 'END', 'QUIT')
      and regexp_replace(coalesce(thread_id, message_from, ''), '[^0-9]', '', 'g') ~ '^[1-9][0-9]{7,14}$'
    union
    select s.phone_e164
    from public.wa_marketing_suppressions s
    where not exists (
      select 1 from public.wa_marketing_events e
      where e.phone_e164 = s.phone_e164 and e.event_type = 'shopify_optout_synced'
    )
  ), saved as (
    insert into public.wa_marketing_suppressions (phone_e164, reason, source, created_at, updated_at)
    select phone_e164, 'Customer WhatsApp opt-out message', 'whatsapp', now(), now()
    from optouts
    on conflict (phone_e164) do update set reason = excluded.reason, source = excluded.source, updated_at = now()
    returning phone_e164
  ), updated_contacts as (
    update public.wa_marketing_contacts c
    set opted_out_at = coalesce(c.opted_out_at, now()),
        consent_state = 'UNSUBSCRIBED',
        updated_at = now()
    from saved
    where c.phone_e164 = saved.phone_e164
    returning c.phone_e164, c.shopify_customer_id
  )
  select u.phone_e164, u.shopify_customer_id
  from updated_contacts u
  where u.shopify_customer_id is not null
    and not exists (
      select 1 from public.wa_marketing_events e
      where e.phone_e164 = u.phone_e164 and e.event_type = 'shopify_optout_synced'
    );`;

  const mutation = `mutation WhatsAppOptOut($input: CustomerWhatsAppMarketingConsentUpdateInput!) {
    customerWhatsAppMarketingConsentUpdate(input: $input) {
      customerPhoneNumber { phoneNumber }
      userErrors { field message }
    }
  }`;

  const parseMutationCode = `const payload = $input.first().json;
const result = payload.data?.customerWhatsAppMarketingConsentUpdate;
if (payload.errors?.length || result?.userErrors?.length) {
  throw new Error('Shopify WhatsApp opt-out sync failed: ' + [
    ...(payload.errors || []).map((error) => error.message),
    ...(result?.userErrors || []).map((error) => error.message),
  ].join('; '));
}
return [{ json: {
  phone_e164: $('Detect WhatsApp opt-outs').item.json.phone_e164,
  shopify_customer_id: $('Detect WhatsApp opt-outs').item.json.shopify_customer_id,
} }];`;

  const logCode = `const phone = String($json.phone_e164 || '').replace(/'/g, "''");
const customerId = String($json.shopify_customer_id || '').replace(/'/g, "''");
return [{ json: { sql: "insert into public.wa_marketing_events (phone_e164, event_type, payload, occurred_at) values ('" + phone + "', 'shopify_optout_synced', jsonb_build_object('shopify_customer_id', '" + customerId + "'), now());" } }];`;

  const nodes = [
    scheduleNode("wa-optout-schedule", "Every 15 minutes", [0, -100], "*/15 * * * *"),
    shopifyTokenNode("wa-optout-token", "Get opt-out Shopify token", [260, -100], tokenCredentialId),
    postgresNode("wa-optout-detect", "Detect WhatsApp opt-outs", [520, -100], detectSql, postgresCredentialId),
    {
      id: "wa-optout-filter",
      name: "Filter linked opt-outs",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [650, -100],
      parameters: { jsCode: "return $input.all().filter((item) => Boolean(item.json.phone_e164 && item.json.shopify_customer_id));" },
    },
    {
      id: "wa-optout-shopify",
      name: "Unsubscribe in Shopify",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [780, -100],
      parameters: {
        method: "POST",
        url: `https://${SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Content-Type", value: "application/json" },
            { name: "Accept-Encoding", value: "identity" },
            { name: "X-Shopify-Access-Token", value: "={{ $('Get opt-out Shopify token').first().json.access_token }}" },
          ],
        },
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: `={{ JSON.stringify({ query: ${JSON.stringify(mutation)}, variables: { input: { customerId: $json.shopify_customer_id, whatsAppMarketingConsent: { state: 'UNSUBSCRIBED', updatedAt: $now.toISO() } } } }) }}`,
        options: {},
      },
    },
    {
      id: "wa-optout-validate",
      name: "Validate Shopify opt-out",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1040, -100],
      parameters: { jsCode: parseMutationCode },
    },
    {
      id: "wa-optout-log-code",
      name: "Build opt-out audit event",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1300, -100],
      parameters: { jsCode: logCode },
    },
    postgresNode("wa-optout-log", "Log Shopify opt-out", [1560, -100], "={{ $json.sql }}", postgresCredentialId),
  ];
  const connections = {
    "Every 15 minutes": { main: [[{ node: "Get opt-out Shopify token", type: "main", index: 0 }]] },
    "Get opt-out Shopify token": { main: [[{ node: "Detect WhatsApp opt-outs", type: "main", index: 0 }]] },
    "Detect WhatsApp opt-outs": { main: [[{ node: "Filter linked opt-outs", type: "main", index: 0 }]] },
    "Filter linked opt-outs": { main: [[{ node: "Unsubscribe in Shopify", type: "main", index: 0 }]] },
    "Unsubscribe in Shopify": { main: [[{ node: "Validate Shopify opt-out", type: "main", index: 0 }]] },
    "Validate Shopify opt-out": { main: [[{ node: "Build opt-out audit event", type: "main", index: 0 }]] },
    "Build opt-out audit event": { main: [[{ node: "Log Shopify opt-out", type: "main", index: 0 }]] },
  };

  return attachWebhook(
    { name: "easyTag WhatsApp Marketing - Opt-out Sync", nodes, connections, settings: standardSettings },
    includeWebhook,
    "Opt-out sync",
    "Get opt-out Shopify token",
    "easytag-wa-marketing-optout-staging",
  );
}

export function buildSchedulerWorkflow({ postgresCredentialId, whatsappCredentialId, includeWebhook = false }) {
  const gateSql = `update public.wa_marketing_recipients
    set send_status = 'failed', error_code = 'stale_sending', error_message = 'Recovered after 20 minutes in sending state', updated_at = now()
    where send_status = 'sending' and updated_at < now() - interval '20 minutes';

  select c.id as campaign_id
  from public.wa_marketing_campaigns c
  where c.status = 'scheduled'
    and c.scheduled_for <= now()
    and coalesce((select (value #>> '{}')::boolean from public.wa_marketing_settings where key = 'automation_enabled'), false)
    and not coalesce((select (value #>> '{}')::boolean from public.wa_marketing_settings where key = 'dry_run'), true)
    and coalesce((select (value #>> '{}')::boolean from public.wa_marketing_settings where key = 'send_endpoint_armed'), false)
    and coalesce((select (value #>> '{}')::boolean from public.wa_marketing_settings where key = 'shopify_connected'), false)
    and coalesce((select (value #>> '{}')::boolean from public.wa_marketing_settings where key = 'whatsapp_connected'), false)
    and coalesce((select (value #>> '{}')::boolean from public.wa_marketing_settings where key = 'meta_templates_approved'), false)
    and coalesce((select (value #>> '{}')::boolean from public.wa_marketing_settings where key = 'click_tracking_connected'), false)
    and coalesce((select (value #>> '{}')::boolean from public.wa_marketing_settings where key = 'order_attribution_connected'), false)
    and extract(hour from now() at time zone 'Europe/London') >= coalesce((select (value #>> '{}')::integer from public.wa_marketing_settings where key = 'send_window_start_hour_london'), 10)
    and extract(hour from now() at time zone 'Europe/London') < coalesce((select (value #>> '{}')::integer from public.wa_marketing_settings where key = 'send_window_end_hour_london'), 18)
  order by c.scheduled_for
  limit 2;`;

  const selectCode = `const id = String($json.campaign_id || '');
if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid campaign id');
return [{ json: { sql: "with selected as (select * from public.wa_marketing_select_recipients('" + id + "'::uuid)) select r.id as recipient_id, r.phone_e164, c.id as campaign_id, c.template_name, c.template_language, c.template_components from selected s join public.wa_marketing_recipients r on r.id = s.recipient_id join public.wa_marketing_campaigns c on c.id = r.campaign_id where r.send_status = 'queued';" } }];`;

  const recheckCode = `const recipientId = String($json.recipient_id || '');
if (!/^[0-9a-f-]{36}$/i.test(recipientId)) throw new Error('Invalid recipient id');
return [{ json: { sql: "with send_lock as (select pg_advisory_xact_lock(hashtext('wa_marketing_daily_send_cap'))), ready as (update public.wa_marketing_recipients r set eligibility_status = 'eligible', blocked_reasons = '{}', send_status = 'sending', updated_at = now() from send_lock where r.id = '" + recipientId + "'::uuid and cardinality(public.wa_marketing_block_reasons(r.phone_e164, now())) = 0 and extract(hour from now() at time zone 'Europe/London') >= coalesce((select (value #>> '{}')::integer from public.wa_marketing_settings where key = 'send_window_start_hour_london'), 10) and extract(hour from now() at time zone 'Europe/London') < coalesce((select (value #>> '{}')::integer from public.wa_marketing_settings where key = 'send_window_end_hour_london'), 18) and (select count(*) from public.wa_marketing_recipients d join public.wa_marketing_campaigns dc on dc.id = d.campaign_id where dc.automatic and d.send_status in ('sending','sent','delivered','read') and (coalesce(d.sent_at,d.updated_at) at time zone 'Europe/London')::date = (now() at time zone 'Europe/London')::date) < coalesce((select (value #>> '{}')::integer from public.wa_marketing_settings where key = 'daily_send_limit'), 5) returning r.id, r.phone_e164, r.campaign_id, r.click_token) select ready.id as recipient_id, ready.phone_e164, ready.campaign_id, ready.click_token::text as click_token, c.template_name, c.template_language, c.template_components, contact.preference_token::text as preference_token from ready join public.wa_marketing_campaigns c on c.id = ready.campaign_id join public.wa_marketing_contacts contact on contact.phone_e164 = ready.phone_e164;" } }];`;

  const templateBody = `={{ JSON.stringify({
    messaging_product: 'whatsapp',
    to: $json.phone_e164.replace(/^\\+/, ''),
    type: 'template',
    template: {
      name: $json.template_name,
      language: { code: $json.template_language },
      components: JSON.parse(JSON.stringify($json.template_components || []).replaceAll('__PREFERENCE_TOKEN__', $json.preference_token).replaceAll('__CLICK_TOKEN__', $json.click_token)),
    },
  }) }}`;

  const auditCode = `const response = $input.first().json;
const recipientId = String($('Final eligibility check').item.json.recipient_id || '').replace(/'/g, "''");
const providerId = String(response.messages?.[0]?.id || '').replace(/'/g, "''");
if (!providerId) throw new Error('WhatsApp send did not return a message id');
return [{ json: { sql: "with updated as (update public.wa_marketing_recipients set send_status = 'sent', provider_message_id = '" + providerId + "', sent_at = now(), updated_at = now() where id = '" + recipientId + "'::uuid returning id, campaign_id, phone_e164) insert into public.wa_marketing_events (campaign_id, recipient_id, phone_e164, provider_message_id, event_type, payload, occurred_at) select campaign_id, id, phone_e164, '" + providerId + "', 'sent', '{}'::jsonb, now() from updated;" } }];`;

  const nodes = [
    scheduleNode("wa-send-schedule", "Every 5 minutes", [0, -100], "*/5 * * * *"),
    postgresNode("wa-send-gate", "Check hard send gates", [260, -100], gateSql, postgresCredentialId),
    {
      id: "wa-send-filter-campaigns",
      name: "Filter due campaigns",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [390, -100],
      parameters: { jsCode: "return $input.all().filter((item) => Boolean(item.json.campaign_id));" },
    },
    {
      id: "wa-send-select-code",
      name: "Build cohort selection",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [520, -100],
      parameters: { jsCode: selectCode },
    },
    postgresNode("wa-send-select", "Select safe recipients", [780, -100], "={{ $json.sql }}", postgresCredentialId),
    {
      id: "wa-send-filter-recipients",
      name: "Filter selected recipients",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [910, -100],
      parameters: { jsCode: "return $input.all().filter((item) => Boolean(item.json.recipient_id && item.json.phone_e164));" },
    },
    {
      id: "wa-send-recheck-code",
      name: "Build final eligibility check",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1040, -100],
      parameters: { jsCode: recheckCode },
    },
    postgresNode("wa-send-recheck", "Final eligibility check", [1300, -100], "={{ $json.sql }}", postgresCredentialId),
    {
      id: "wa-send-filter-ready",
      name: "Filter send-ready recipients",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1430, -100],
      parameters: { jsCode: "return $input.all().filter((item) => Boolean(item.json.recipient_id && item.json.phone_e164));" },
    },
    {
      id: "wa-send-template",
      name: "Send approved easyTag template",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1560, -100],
      parameters: {
        method: "POST",
        url: `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${EASYTAG_PHONE_NUMBER_ID}/messages`,
        authentication: "predefinedCredentialType",
        nodeCredentialType: "whatsAppApi",
        sendHeaders: true,
        headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: templateBody,
        options: {},
      },
      credentials: { whatsAppApi: credential(whatsappCredentialId, "easytag") },
    },
    {
      id: "wa-send-audit-code",
      name: "Build send audit",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1820, -100],
      parameters: { jsCode: auditCode },
    },
    postgresNode("wa-send-audit", "Record successful send", [2080, -100], "={{ $json.sql }}", postgresCredentialId),
  ];
  const connections = {
    "Every 5 minutes": { main: [[{ node: "Check hard send gates", type: "main", index: 0 }]] },
    "Check hard send gates": { main: [[{ node: "Filter due campaigns", type: "main", index: 0 }]] },
    "Filter due campaigns": { main: [[{ node: "Build cohort selection", type: "main", index: 0 }]] },
    "Build cohort selection": { main: [[{ node: "Select safe recipients", type: "main", index: 0 }]] },
    "Select safe recipients": { main: [[{ node: "Filter selected recipients", type: "main", index: 0 }]] },
    "Filter selected recipients": { main: [[{ node: "Build final eligibility check", type: "main", index: 0 }]] },
    "Build final eligibility check": { main: [[{ node: "Final eligibility check", type: "main", index: 0 }]] },
    "Final eligibility check": { main: [[{ node: "Filter send-ready recipients", type: "main", index: 0 }]] },
    "Filter send-ready recipients": { main: [[{ node: "Send approved easyTag template", type: "main", index: 0 }]] },
    "Send approved easyTag template": { main: [[{ node: "Build send audit", type: "main", index: 0 }]] },
    "Build send audit": { main: [[{ node: "Record successful send", type: "main", index: 0 }]] },
  };

  return attachWebhook(
    { name: "easyTag WhatsApp Marketing - Scheduler", nodes, connections, settings: standardSettings },
    includeWebhook,
    "Scheduler",
    "Check hard send gates",
    "easytag-wa-marketing-scheduler-staging",
  );
}
