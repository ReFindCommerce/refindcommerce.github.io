import fs from 'node:fs';
import path from 'node:path';

const workflowPath = path.resolve(import.meta.dirname, '..', 'n8n', 'whatsapp-support-follow-up.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const failures = [];
const nodeByName = new Map(workflow.nodes.map((node) => [node.name, node]));

const requiredNodes = [
  'Support follow-up webhook',
  'Get WhatsApp conversation state',
  'Validate support follow-up',
  'Request allowed?',
  'Send approved support template',
  'Record support follow-up',
  'Follow-up sent response',
  'Follow-up rejected response',
];

for (const name of requiredNodes) {
  if (!nodeByName.has(name)) failures.push(`Missing node: ${name}`);
}

const webhook = nodeByName.get('Support follow-up webhook');
if (webhook?.parameters?.path !== 'whatsapp-support-follow-up') {
  failures.push('The production webhook path is incorrect.');
}

const validationCode = String(nodeByName.get('Validate support follow-up')?.parameters?.jsCode || '');
for (const required of [
  'easytag_support_follow_up_v1',
  "'447562949052': '953305754533805'",
  "'447542608444': '877340175471949'",
  'WHATSAPP_FOLLOW_UP_RECENTLY_SENT',
  'WHATSAPP_WINDOW_OPEN',
]) {
  if (!validationCode.includes(required)) failures.push(`Validation is missing: ${required}`);
}

try {
  new Function(validationCode);
} catch (error) {
  failures.push(`Validation node has invalid JavaScript: ${error.message}`);
}

const sendNode = nodeByName.get('Send approved support template');
const sendBody = String(sendNode?.parameters?.body || '');
if (!sendBody.includes("type: 'template'") || !sendBody.includes('template_language')) {
  failures.push('The Meta request is not a template send.');
}
if (!String(sendNode?.parameters?.url || '').includes('$json.phone_number_id')) {
  failures.push('The Meta request does not use the validated business phone number.');
}

const falseBranch = workflow.connections?.['Request allowed?']?.main?.[1] || [];
if (!falseBranch.some((connection) => connection.node === 'Follow-up rejected response')) {
  failures.push('Rejected requests are not routed to the blocked response.');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('WhatsApp support follow-up workflow validation passed.');
