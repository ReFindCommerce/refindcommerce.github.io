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
const ALLOWED_GMAIL_RECIPIENTS = [
  'info@refindcommerce.com',
  'info@easytag.app',
  'support@refindcommerce.com',
  'support@easytag.app',
];
const DISALLOWED_INBOX_RECIPIENTS = /\b(tom\.pegram@easytag\.app|tom@refindcommerce\.com)\b/i;

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

  for (const node of workflow.nodes || []) {
    if (node.type === 'n8n-nodes-base.code') continue;
    if (stringify(node.parameters).includes('current.text')) {
      addFailure(`${workflow.name} / ${node.name} contains a prompt expression that references current.text outside a code node.`);
    }
  }

  for (const node of workflow.nodes || []) {
    if (node.type !== 'n8n-nodes-base.code') continue;
    if (String(node.parameters?.jsCode || '').includes('fetch(')) {
      addFailure(`${workflow.name} / ${node.name} uses fetch inside an n8n Code node.`);
    }
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

function validateGmailInboundAttachments(workflow) {
  if (!workflow.name.toLowerCase().includes('gmail') && !workflow.name.toLowerCase().includes('gmai')) {
    return;
  }

  const getMessage = (workflow.nodes || []).find((node) => node.name === 'Get a message');
  if (!getMessage) {
    addFailure(`${workflow.name} is missing Gmail Get a message node.`);
  } else {
    if (getMessage.parameters?.options?.downloadAttachments !== true) {
      addFailure(`${workflow.name} / Get a message must download attachments.`);
    }
    if (getMessage.parameters?.options?.dataPropertyAttachmentsPrefixName !== 'attachment_') {
      addFailure(`${workflow.name} / Get a message must use attachment_ as the attachment binary prefix.`);
    }
  }

  for (const node of workflow.nodes || []) {
    if (node.type === 'n8n-nodes-base.switch' && stringify(node.parameters).match(DISALLOWED_INBOX_RECIPIENTS)) {
      addFailure(`${workflow.name} / ${node.name} contains a personal email recipient in Gmail inbox routing.`);
    }

    if (
      node.type === 'n8n-nodes-base.code' &&
      (node.name === 'Code in JavaScript' || node.name === 'Code in JavaScript2' || node.name === 'Code in JavaScript3' || node.name === 'Code in JavaScript5') &&
      String(node.parameters?.jsCode || '').includes('normalizeAddresses')
    ) {
      const code = String(node.parameters?.jsCode || '');
      for (const recipient of ALLOWED_GMAIL_RECIPIENTS) {
        if (!code.includes(recipient)) {
          addFailure(`${workflow.name} / ${node.name} is missing allowed Gmail recipient ${recipient}.`);
        }
      }
      if (!code.includes('disallowedRecipients')) {
        addFailure(`${workflow.name} / ${node.name} must explicitly reject personal Gmail recipients.`);
      }
      if (!code.includes('hasAllowedRecipient')) {
        addFailure(`${workflow.name} / ${node.name} must drop Gmail messages for non-inbox recipients before AI/Supabase.`);
      }
      const recipientGuardIndex = code.indexOf('if (!hasAllowedRecipient(to, item)) continue;');
      const attachmentExtractionIndex = code.indexOf('extractAttachmentUrls.call');
      if (recipientGuardIndex === -1 || attachmentExtractionIndex === -1 || recipientGuardIndex > attachmentExtractionIndex) {
        addFailure(`${workflow.name} / ${node.name} must apply the Gmail recipient guard before attachment extraction.`);
      }
    }

    if (node.type !== 'n8n-nodes-base.supabase') continue;

    const fields = fieldValues(node);
    const hasAiReply = fields.some((field) => field.fieldId === 'ai_reply');
    if (!hasAiReply) continue;

    const fieldIds = new Set(fields.map((field) => field.fieldId));
    if (!fieldIds.has('customer_image_url')) {
      addFailure(`${workflow.name} / ${node.name} must preserve the first Gmail media attachment.`);
    }
    if (!fieldIds.has('image_url')) {
      addFailure(`${workflow.name} / ${node.name} must preserve the second Gmail media attachment.`);
    }
    if (!fieldIds.has('ebay_image')) {
      addFailure(`${workflow.name} / ${node.name} must preserve the third Gmail media attachment.`);
    }

    for (const field of fields) {
      if (String(field.fieldValue || '').includes('$(') && String(field.fieldValue || '').includes('Code in JavaScript')) {
        addFailure(`${workflow.name} / ${node.name} should read Gmail inbound fields from the AI prompt builder, not a disconnected Code node.`);
      }
    }
  }

  for (const [from, connection] of Object.entries(workflow.connections || {})) {
    if (!from.startsWith('Code in JavaScript')) continue;
    const targets = (connection.main || []).flat().filter(Boolean).map((target) => target.node);
    if (targets.some((target) => target.startsWith('AI Agent'))) {
      addFailure(`${workflow.name} / ${from} must not connect directly to an AI Agent; route through the prompt builder.`);
    }
  }
}

function validateAiConfidenceFields(workflow) {
  for (const node of workflow.nodes || []) {
    if (node.type !== 'n8n-nodes-base.supabase') continue;

    const fields = fieldValues(node);
    const hasAiReply = fields.some((field) => field.fieldId === 'ai_reply');
    if (!hasAiReply) continue;

    const fieldIds = new Set(fields.map((field) => field.fieldId));
    if (!fieldIds.has('ai_confidence')) {
      addFailure(`${workflow.name} / ${node.name} writes ai_reply without ai_confidence.`);
    }
    if (!fieldIds.has('ai_confidence_reason')) {
      addFailure(`${workflow.name} / ${node.name} writes ai_reply without ai_confidence_reason.`);
    }
  }
}

function validateAiSameLanguageRule(workflow) {
  if (workflow.name === 'ReFind Inbox - Push Notifications') {
    return;
  }

  const workflowText = stringify(workflow.nodes);
  const draftsAiReplies = workflowText.includes('ai_reply') || workflowText.includes('AI Agent');
  if (!draftsAiReplies) {
    return;
  }

  if (!/same language|LANGUAGE RULE/i.test(workflowText)) {
    addFailure(`${workflow.name} must instruct AI replies to use the same language as the latest customer message.`);
  }

  const aiPromptNodes = (workflow.nodes || []).filter((node) => {
    const code = String(node.parameters?.jsCode || '');
    return node.type === 'n8n-nodes-base.code' && (/Build .*AI prompt/i.test(node.name) || code.includes('LATEST CUSTOMER MESSAGE'));
  });

  for (const node of aiPromptNodes) {
    const code = String(node.parameters?.jsCode || '');
    if (!/same language|LANGUAGE RULE/i.test(code)) {
      addFailure(`${workflow.name} / ${node.name} must include the same-language AI reply rule.`);
    }
  }

  const aiAgentNodes = (workflow.nodes || []).filter((node) => node.name?.startsWith('AI Agent'));
  for (const node of aiAgentNodes) {
    if (!/same language/i.test(stringify(node.parameters))) {
      addFailure(`${workflow.name} / ${node.name} must include the same-language AI reply rule.`);
    }
  }
}

function validateAiAttachmentContext(workflow) {
  if (workflow.name === 'ReFind Inbox - Push Notifications') {
    return;
  }

  const workflowText = stringify(workflow.nodes);
  const draftsAiReplies = workflowText.includes('ai_reply') || workflowText.includes('AI Agent');
  if (!draftsAiReplies) {
    return;
  }

  const aiPromptNodes = (workflow.nodes || []).filter((node) => {
    const code = String(node.parameters?.jsCode || '');
    return node.type === 'n8n-nodes-base.code' && /Build .*AI prompt/i.test(node.name);
  });

  for (const node of aiPromptNodes) {
    const code = String(node.parameters?.jsCode || '');
    if (!code.includes('ATTACHMENT CONTEXT')) {
      addFailure(`${workflow.name} / ${node.name} must include attachment context in the AI prompt.`);
    }
    if (!/Do not say you did not receive|Do not say you.*cannot see an attachment/i.test(code)) {
      addFailure(`${workflow.name} / ${node.name} must prevent AI drafts from asking customers to resend known attachments.`);
    }
    if (!code.includes('customer_image_url') || !code.includes('image_url') || !code.includes('ebay_image')) {
      addFailure(`${workflow.name} / ${node.name} must pass known image fields into the AI prompt context.`);
    }
    if (!code.includes('summarizeAttachmentValue') || !code.includes('/^data:/i')) {
      addFailure(`${workflow.name} / ${node.name} must summarize data URL attachments instead of embedding base64 in the AI prompt.`);
    }
  }

  for (const node of workflow.nodes || []) {
    if (node.type !== 'n8n-nodes-base.postgres' || !/conversation history/i.test(node.name)) continue;

    const query = String(node.parameters?.query || '');
    if (!query.includes('customer_image_url') || !query.includes('image_url') || !query.includes('ebay_image')) {
      addFailure(`${workflow.name} / ${node.name} must include image fields in conversation history for AI context.`);
    }
  }
}

function validateAiPromptSyntax(workflow) {
  const aiPromptNodes = (workflow.nodes || []).filter((node) => {
    return node.type === 'n8n-nodes-base.code' && /Build .*AI prompt/i.test(node.name);
  });

  for (const node of aiPromptNodes) {
    const code = String(node.parameters?.jsCode || '');
    try {
      new Function(code);
    } catch (error) {
      addFailure(`${workflow.name} / ${node.name} contains invalid JavaScript: ${error.message}`);
    }
  }
}

function validateEasyTagGmailBranchReferences(workflow) {
  if (workflow.name !== 'gmail - tom.pergam@easytag') {
    return;
  }

  const expectedReferences = [
    {
      nodeName: 'Get Gmail Tom conversation history',
      source: 'query',
      required: "$('Edit Fields').item.json.from",
      disallowed: ["$('Code in JavaScript1')", "$('Code in JavaScript3')"],
    },
    {
      nodeName: 'Get Gmail Tom conversation history2',
      source: 'query',
      required: "$('Edit Fields1').item.json.from",
      disallowed: ["$('Code in JavaScript1')", "$('Code in JavaScript3')"],
    },
    {
      nodeName: 'Build Gmail Tom AI prompt',
      source: 'jsCode',
      required: "$('Edit Fields').first().json",
      disallowed: ["$('Code in JavaScript1')", "$('Code in JavaScript3')"],
    },
    {
      nodeName: 'Build Gmail Tom AI prompt2',
      source: 'jsCode',
      required: "$('Edit Fields1').first().json",
      disallowed: ["$('Code in JavaScript1')", "$('Code in JavaScript3')"],
    },
    {
      nodeName: 'Get Gmail Tom approved knowledge',
      source: 'query',
      required: "$('Edit Fields').item.json",
      disallowed: ["$('Code in JavaScript1')", "$('Code in JavaScript3')"],
    },
    {
      nodeName: 'Get Gmail Tom approved knowledge2',
      source: 'query',
      required: "$('Edit Fields1').item.json",
      disallowed: ["$('Code in JavaScript1')", "$('Code in JavaScript3')"],
    },
    {
      nodeName: 'Switch',
      source: 'parameters',
      required: "$('Build Gmail Tom AI prompt').item.json",
      disallowed: ["$('Code in JavaScript1')", "$('Code in JavaScript3')"],
    },
    {
      nodeName: 'Switch2',
      source: 'parameters',
      required: "$('Build Gmail Tom AI prompt2').item.json",
      disallowed: ["$('Code in JavaScript1')", "$('Code in JavaScript3')"],
    },
  ];

  for (const check of expectedReferences) {
    const node = (workflow.nodes || []).find((candidate) => candidate.name === check.nodeName);
    if (!node) {
      addFailure(`${workflow.name} is missing ${check.nodeName}.`);
      continue;
    }

    const content =
      check.source === 'parameters'
        ? stringify(node.parameters)
        : String(node.parameters?.[check.source] || '');
    if (!content.includes(check.required)) {
      addFailure(`${workflow.name} / ${check.nodeName} must read from the direct upstream ${check.required} branch.`);
    }

    for (const disallowed of check.disallowed) {
      if (content.includes(disallowed)) {
        addFailure(`${workflow.name} / ${check.nodeName} must not reference sibling branch ${disallowed}.`);
      }
    }
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
  validateGmailInboundAttachments(workflow);
  validateAiConfidenceFields(workflow);
  validateAiSameLanguageRule(workflow);
  validateAiAttachmentContext(workflow);
  validateAiPromptSyntax(workflow);
  validateEasyTagGmailBranchReferences(workflow);

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
