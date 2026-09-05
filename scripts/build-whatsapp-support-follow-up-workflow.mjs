import fs from 'node:fs';
import path from 'node:path';

const workspace = path.resolve(import.meta.dirname, '..');
const outputPath = path.join(workspace, 'n8n', 'whatsapp-support-follow-up.json');

const POSTGRES_CREDENTIAL_ID = 'MHmCNfCkbN5OTMZj';
const WHATSAPP_CREDENTIAL_ID = 'kAmVxFJKk1AFYszb';
const TEMPLATE_NAME = 'easytag_support_follow_up_v1';
const TEMPLATE_LANGUAGE = 'en';
const TEMPLATE_PREVIEW = "Hi, we're following up on your support request. Reply to this message and we'll continue helping you.";

const stateQuery = `={{ "select max(uploaded_at) filter (where direction = 'inbound') as latest_inbound_at, (array_agg(message_from order by uploaded_at desc) filter (where direction = 'inbound'))[1] as latest_inbound_from, (array_agg(message_to order by uploaded_at desc) filter (where direction = 'inbound'))[1] as latest_inbound_to, max(uploaded_at) filter (where direction = 'outbound' and ai_confidence_reason like 'whatsapp_support_follow_up_template:%') as latest_follow_up_at from public.inbox_messages where lower(channel) = 'whatsapp' and thread_id = '" + String($json.body?.thread_id || '').replace(/'/g, "''") + "'" }}`;

const validateCode = `const body = $('Support follow-up webhook').item.json.body || {};
const allowedBusinessNumbers = {
  '447562949052': '953305754533805',
  '447542608444': '877340175471949',
};
const templateName = '${TEMPLATE_NAME}';
const templateLanguage = '${TEMPLATE_LANGUAGE}';
const templatePreview = ${JSON.stringify(TEMPLATE_PREVIEW)};
const digits = (value) => String(value || '').replace(/\\D/g, '');
const requestId = String(body.id || '');
const threadId = String(body.thread_id || '').trim();
const inboundAt = Date.parse($json.latest_inbound_at || '');
const latestFollowUpAt = Date.parse($json.latest_follow_up_at || '');
const customerPhone = digits($json.latest_inbound_from);
const requestedCustomerPhone = digits(body.message_from);
const businessPhone = digits($json.latest_inbound_to);
const requestedBusinessPhone = digits(body.message_to);
const phoneNumberId = allowedBusinessNumbers[businessPhone] || '';
const ageMs = Number.isFinite(inboundAt) ? Date.now() - inboundAt : null;
const followUpAlreadySent = Number.isFinite(latestFollowUpAt) && latestFollowUpAt >= inboundAt;
let responseCode = 409;
let code = '';
let reason = '';

if (body.reply_mode !== 'approved_support_template' || body.template_name !== templateName || body.template_language !== templateLanguage) {
  responseCode = 400;
  code = 'INVALID_SUPPORT_TEMPLATE';
  reason = 'Only the approved support follow-up template is accepted by this endpoint.';
} else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
  responseCode = 400;
  code = 'INVALID_REQUEST_ID';
  reason = 'The follow-up request id is invalid.';
} else if (!threadId || !Number.isFinite(inboundAt) || !customerPhone || !businessPhone) {
  code = 'WHATSAPP_CONVERSATION_NOT_FOUND';
  reason = 'No matching inbound WhatsApp conversation was found.';
} else if (requestedCustomerPhone && requestedCustomerPhone !== customerPhone) {
  responseCode = 400;
  code = 'WHATSAPP_CUSTOMER_MISMATCH';
  reason = 'The requested customer does not match the latest inbound WhatsApp message.';
} else if (requestedBusinessPhone && requestedBusinessPhone !== businessPhone) {
  responseCode = 400;
  code = 'WHATSAPP_BUSINESS_NUMBER_MISMATCH';
  reason = 'The requested business number does not match the latest inbound WhatsApp message.';
} else if (!phoneNumberId) {
  responseCode = 400;
  code = 'WHATSAPP_BUSINESS_NUMBER_NOT_ALLOWED';
  reason = 'The conversation is not assigned to an approved WhatsApp business number.';
} else if (ageMs !== null && ageMs <= 24 * 60 * 60 * 1000) {
  code = 'WHATSAPP_WINDOW_OPEN';
  reason = 'The WhatsApp reply window is open. Send the normal reply instead of a template.';
} else if (followUpAlreadySent) {
  code = 'WHATSAPP_FOLLOW_UP_RECENTLY_SENT';
  reason = "A support follow-up was already sent after the customer's latest message.";
}

return [{ json: {
  valid: !code,
  response_code: responseCode,
  code,
  reason,
  request_id: requestId,
  thread_id: threadId,
  customer_phone: customerPhone,
  business_phone: businessPhone,
  phone_number_id: phoneNumberId,
  sender_name: String(body.sender_name || customerPhone || 'Customer'),
  template_name: templateName,
  template_language: templateLanguage,
  template_preview: templatePreview,
  latest_inbound_at: Number.isFinite(inboundAt) ? new Date(inboundAt).toISOString() : '',
} }];`;

const auditCode = `const sent = $input.first().json || {};
const request = $('Validate support follow-up').item.json || {};
const providerId = String(sent.messages?.[0]?.id || '');
if (!providerId) throw new Error('Meta did not return a WhatsApp message id');
const escaped = (value) => String(value || '').replace(/'/g, "''");
const sql = [
  "insert into public.inbox_messages (id, channel, thread_id, message_from, message_to, sender_name, user_type, direction, final_reply, status, uploaded_at, ai_confidence_reason)",
  "values ('" + escaped(request.request_id) + "'::uuid, 'whatsapp', '" + escaped(request.thread_id) + "', '" + escaped(request.customer_phone) + "', '" + escaped(request.business_phone) + "', '" + escaped(request.sender_name) + "', 'agent', 'outbound', '" + escaped(request.template_preview) + "', 'answered', now(), 'whatsapp_support_follow_up_template:" + escaped(providerId) + "')",
  "on conflict (id) do nothing",
  "returning true as ok, 'sent'::text as status, '" + escaped(providerId) + "'::text as provider_message_id, '" + escaped(request.template_name) + "'::text as template_name;",
].join(' ');
return [{ json: { sql } }];`;

const workflow = {
  name: 'ReFind Inbox - WhatsApp Support Follow-up',
  nodes: [
    {
      id: 'wa-support-follow-up-webhook',
      name: 'Support follow-up webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.1,
      position: [0, 0],
      parameters: {
        httpMethod: 'POST',
        path: 'whatsapp-support-follow-up',
        responseMode: 'responseNode',
        options: {},
      },
    },
    {
      id: 'wa-support-follow-up-state',
      name: 'Get WhatsApp conversation state',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [260, 0],
      parameters: { operation: 'executeQuery', query: stateQuery, options: {} },
      credentials: { postgres: { id: POSTGRES_CREDENTIAL_ID, name: 'Postgres account' } },
    },
    {
      id: 'wa-support-follow-up-validate',
      name: 'Validate support follow-up',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [520, 0],
      parameters: { jsCode: validateCode },
    },
    {
      id: 'wa-support-follow-up-valid',
      name: 'Request allowed?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [780, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
          conditions: [
            {
              id: 'wa-support-follow-up-valid-condition',
              leftValue: '={{ $json.valid }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
    },
    {
      id: 'wa-support-follow-up-send',
      name: 'Send approved support template',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1040, -100],
      parameters: {
        method: 'POST',
        url: '=https://graph.facebook.com/v23.0/{{ $json.phone_number_id }}/messages',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'whatsAppApi',
        sendHeaders: true,
        headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: `={{ JSON.stringify({ messaging_product: 'whatsapp', to: $json.customer_phone, type: 'template', template: { name: $json.template_name, language: { code: $json.template_language } } }) }}`,
        options: {},
      },
      credentials: { whatsAppApi: { id: WHATSAPP_CREDENTIAL_ID, name: 'easytag' } },
    },
    {
      id: 'wa-support-follow-up-audit',
      name: 'Build support follow-up audit',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1300, -100],
      parameters: { jsCode: auditCode },
    },
    {
      id: 'wa-support-follow-up-record',
      name: 'Record support follow-up',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [1560, -100],
      parameters: { operation: 'executeQuery', query: '={{ $json.sql }}', options: {} },
      credentials: { postgres: { id: POSTGRES_CREDENTIAL_ID, name: 'Postgres account' } },
    },
    {
      id: 'wa-support-follow-up-success',
      name: 'Follow-up sent response',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.5,
      position: [1820, -100],
      parameters: {
        respondWith: 'json',
        responseBody: '={{ $json }}',
        options: { responseCode: 200 },
      },
    },
    {
      id: 'wa-support-follow-up-rejected',
      name: 'Follow-up rejected response',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.5,
      position: [1040, 120],
      parameters: {
        respondWith: 'json',
        responseBody: '={{ { ok: false, status: "blocked", code: $json.code, reason: $json.reason } }}',
        options: { responseCode: '={{ $json.response_code }}' },
      },
    },
  ],
  connections: {
    'Support follow-up webhook': {
      main: [[{ node: 'Get WhatsApp conversation state', type: 'main', index: 0 }]],
    },
    'Get WhatsApp conversation state': {
      main: [[{ node: 'Validate support follow-up', type: 'main', index: 0 }]],
    },
    'Validate support follow-up': {
      main: [[{ node: 'Request allowed?', type: 'main', index: 0 }]],
    },
    'Request allowed?': {
      main: [
        [{ node: 'Send approved support template', type: 'main', index: 0 }],
        [{ node: 'Follow-up rejected response', type: 'main', index: 0 }],
      ],
    },
    'Send approved support template': {
      main: [[{ node: 'Build support follow-up audit', type: 'main', index: 0 }]],
    },
    'Build support follow-up audit': {
      main: [[{ node: 'Record support follow-up', type: 'main', index: 0 }]],
    },
    'Record support follow-up': {
      main: [[{ node: 'Follow-up sent response', type: 'main', index: 0 }]],
    },
  },
  settings: {
    executionOrder: 'v1',
    timezone: 'Europe/London',
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'all',
    saveExecutionProgress: true,
  },
  pinData: {},
  active: false,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(outputPath);
