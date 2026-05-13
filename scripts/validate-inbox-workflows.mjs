import fs from 'node:fs';

const BASE_URL = process.env.N8N_BASE_URL || 'https://n8n.srv1354140.hstgr.cloud/api/v1';
const API_KEY =
  process.env.N8N_API_KEY ||
  (fs.existsSync('.n8n-api-key.local') ? fs.readFileSync('.n8n-api-key.local', 'utf8').trim() : '');

const REQUIRED_WORKFLOWS = [
  'gmai - refindcommerce',
  'gmail - tom.pergam@easytag',
  'whatsapp',
  'eBay',
  'ReFind Inbox - Push Notifications',
];

const GMAIL_WORKFLOW = 'gmai - refindcommerce';
const GMAIL_SEND_NODES = [
  'info@refindcommerce.com',
  'support@refindcommerce.com',
  'support@easytag.app',
  'info@easytag.app',
];

const ALLOWED_LITERAL_STATUSES = new Set(['new', 'answered']);
const DISALLOWED_STATUS_WORDS = /\b(sending|sent|send_failed|failed|queued)\b/i;

if (!API_KEY) {
  fail('Missing N8N_API_KEY and .n8n-api-key.local is not present.');
}

const failures = [];
const warnings = [];

function fail(message) {
  console.error(`Inbox workflow validation failed: ${message}`);
  process.exit(1);
}

function addFailure(message) {
  failures.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

async function n8n(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-N8N-API-KEY': API_KEY },
  });

  if (!response.ok) {
    throw new Error(`n8n API ${path} returned ${response.status}`);
  }

  return response.json();
}

function stringify(value) {
  return JSON.stringify(value ?? {});
}

function connectionTargets(workflow, nodeName) {
  const main = workflow.connections?.[nodeName]?.main || [];
  return main.flat().filter(Boolean).map((connection) => connection.node);
}

function fieldValues(node) {
  return node.parameters?.fieldsUi?.fieldValues || [];
}

function validateStatusFields(workflow) {
  for (const node of workflow.nodes || []) {
    for (const field of fieldValues(node)) {
      if (field.fieldId !== 'status') continue;

      const value = String(field.fieldValue ?? '').trim();
      const normalized = value.replace(/^=/, '').trim();

      if (DISALLOWED_STATUS_WORDS.test(value)) {
        addFailure(`${workflow.name} / ${node.name} writes unsupported inbox status: ${value}`);
      }

      if (!value.startsWith('=') && !ALLOWED_LITERAL_STATUSES.has(normalized)) {
        addFailure(`${workflow.name} / ${node.name} writes unknown literal inbox status: ${value}`);
      }
    }
  }
}

function validateNoFragileWebhookReferences(workflow) {
  const workflowJson = stringify(workflow.nodes);
  if (workflowJson.includes('Webhook.item')) {
    addFailure(`${workflow.name} contains fragile Webhook.item references.`);
  }
}

function validateWebhookPaths(workflow) {
  const webhookNodes = (workflow.nodes || []).filter((node) => node.type === 'n8n-nodes-base.webhook');
  for (const node of webhookNodes) {
    if (node.parameters?.path && /\s/.test(node.parameters.path)) {
      addFailure(`${workflow.name} / ${node.name} has whitespace in webhook path.`);
    }
  }
}

function validateGmailSendWorkflow(workflow) {
  const respondNode = (workflow.nodes || []).find((node) => node.name === 'Respond to Webhook');
  if (!respondNode) {
    addFailure(`${workflow.name} is missing Respond to Webhook.`);
  }

  const outboundCreate = (workflow.nodes || []).find((node) => node.name === 'Create a row1');
  if (!outboundCreate) {
    addFailure(`${workflow.name} is missing outbound Supabase node Create a row1.`);
  } else {
    const statusField = fieldValues(outboundCreate).find((field) => field.fieldId === 'status');
    if (String(statusField?.fieldValue || '').trim() !== 'answered') {
      addFailure(`${workflow.name} / Create a row1 must write status answered.`);
    }
  }

  for (const nodeName of GMAIL_SEND_NODES) {
    const targets = connectionTargets(workflow, nodeName);
    if (!targets.includes('Respond to Webhook')) {
      addFailure(`${workflow.name} / ${nodeName} must connect directly to Respond to Webhook.`);
    }
    if (targets.includes('Build send status update') || targets.includes('Update outbound send status')) {
      addFailure(`${workflow.name} / ${nodeName} must not depend on experimental status-update nodes.`);
    }
  }

  const webhook = (workflow.nodes || []).find((node) => node.name === 'Webhook');
  if (webhook?.parameters?.path !== 'gmail') {
    addFailure(`${workflow.name} production webhook path must remain gmail.`);
  }
}

const list = await n8n('/workflows?limit=100');
const workflows = new Map(list.data.map((workflow) => [workflow.name, workflow]));

for (const required of REQUIRED_WORKFLOWS) {
  const summary = workflows.get(required);
  if (!summary) {
    addFailure(`Required workflow missing: ${required}`);
    continue;
  }
  if (!summary.active) {
    addFailure(`Required workflow is inactive: ${required}`);
  }
}

for (const name of REQUIRED_WORKFLOWS) {
  const summary = workflows.get(name);
  if (!summary) continue;

  const workflow = await n8n(`/workflows/${summary.id}`);
  validateStatusFields(workflow);
  validateNoFragileWebhookReferences(workflow);
  validateWebhookPaths(workflow);

  if (name === GMAIL_WORKFLOW) {
    validateGmailSendWorkflow(workflow);
  }
}

if (warnings.length) {
  console.warn(warnings.map((warning) => `Warning: ${warning}`).join('\n'));
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('Inbox workflow validation passed.');
