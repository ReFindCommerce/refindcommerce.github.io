import { cleanMessageText, formatSuggestedReply } from './textFormat';

export interface ProductFactGuardInput {
  latestCustomerMessage: string | null | undefined;
  customerContext: string | null | undefined;
  aiReply: string | null | undefined;
  confidence: number | null;
  confidenceReason: string | null;
}

export interface ProductFactGuardResult {
  reply: string;
  confidence: number;
  confidenceReason: string;
}

const easyTagProductPattern = /\b(?:easytag|easy tag|card tracker|m10 card|wallet tracker|find my m10|apple wallet tracker|samsung wallet tracker)\b/i;
const excludedProductPattern = /\b(?:vehicle tracker|gps vehicle|vehicle gps|p09|airtag holder|apple airtag|magsafe|sim card|battery cables?|black and red wires?|ignition)\b/i;
const chargerTopicPattern = /\b(?:charger|charging|charge|charged|recharge|recharging|recharger|chargeur|usb|usb-c|usbc|cable|adapter|wireless charger|magnetic charger|charging attachment|ladegerat|ladegeraet|ladeger\u00e4t|aufladen)\b/i;
const packageQuestionPattern = /\b(?:come|comes|include|included|including|extra|free|provided|supplied|box|package|charger lead|usb lead|charging adapter|charger as well)\b/i;
const howToChargePattern = /\b(?:how do i charge|how to charge|how can i charge|comment recharger|recharger mon|recharge my|charge my)\b/i;
const includedChargerFactPattern = /\b(?:comes? with|included|includes|provided|supplied|own charger|charging adapter|charging attachment|magnetic wired|magnetic charger|cable de charge fourni|chargeur magn(?:e|\u00e9)tique|fourni avec)\b/i;
const contradictedChargerFactPattern = /\b(?:does not come|doesn't come|doesn.t come|does not include|doesn't include|doesn.t include|not included|not supplied|not provided|no charger|no charging cable|no usb lead|not rechargeable|does not require recharging|doesn't require recharging|doesn.t require recharging|replaceable battery|coin cell|built-in battery)\b/i;
const frenchCustomerPattern = /\b(?:bonjour|bonsoir|merci|comment recharger|recharger mon|votre|vous|avec|chargeur|c(?:a|\u00e2)ble|fourni)\b/i;
const germanCustomerPattern = /\b(?:hallo|guten|danke|bitte|ladeger(?:a|\u00e4)t|ladegeraet|aufladen|aufladung|mitgeliefert|karte)\b/i;

export function applyProductFactGuard(input: ProductFactGuardInput): ProductFactGuardResult | null {
  const latestCustomerMessage = cleanMessageText(input.latestCustomerMessage);
  const customerContext = cleanMessageText(input.customerContext || latestCustomerMessage);
  const aiReply = cleanMessageText(input.aiReply);

  if (!customerContext || !aiReply) return null;
  if (!isEasyTagChargerContext(customerContext, aiReply)) return null;

  const isPackageQuestion = packageQuestionPattern.test(customerContext);
  const isHowToChargeQuestion = howToChargePattern.test(customerContext);
  const draftHasIncludedFact = includedChargerFactPattern.test(aiReply);
  const draftContradictsFact = contradictedChargerFactPattern.test(aiReply);

  if (!draftContradictsFact && (!isPackageQuestion || draftHasIncludedFact)) {
    return null;
  }

  if (!isPackageQuestion && !isHowToChargeQuestion && !draftContradictsFact) {
    return null;
  }

  return {
    reply: buildEasyTagChargerReply(latestCustomerMessage || customerContext),
    confidence: Math.max(input.confidence ?? 0, 92),
    confidenceReason: buildConfidenceReason(input.confidenceReason),
  };
}

function isEasyTagChargerContext(customerContext: string, aiReply: string): boolean {
  if (excludedProductPattern.test(customerContext)) return false;
  const combinedContext = `${customerContext}\n${aiReply}`;
  return easyTagProductPattern.test(combinedContext) && chargerTopicPattern.test(combinedContext);
}

function buildEasyTagChargerReply(customerMessage: string): string {
  if (frenchCustomerPattern.test(customerMessage)) {
    return formatSuggestedReply([
      'Bonjour,',
      '',
      "Oui, chaque easyTag est fourni avec son propre chargeur/adaptateur de charge magnetique.",
      '',
      "Ce n'est pas un socle de charge sans fil : il faut aligner le chargeur magnetique avec les contacts de l'easyTag, puis le brancher sur une alimentation USB.",
      '',
      'Bien cordialement,',
      'Emily',
    ].join('\n'));
  }

  if (germanCustomerPattern.test(customerMessage)) {
    return formatSuggestedReply([
      'Guten Tag,',
      '',
      'Ja, jeder easyTag wird mit einem eigenen magnetischen Ladeadapter geliefert.',
      '',
      'Es ist kein kabelloses Ladepad: Der magnetische Ladeadapter wird an die Ladekontakte des easyTags angelegt und dann an eine USB-Stromquelle angeschlossen.',
      '',
      'Mit freundlichen Grussen,',
      'Emily',
    ].join('\n'));
  }

  return formatSuggestedReply([
    'Hello,',
    '',
    'Yes, each easyTag comes with its own magnetic charger/charging adapter included.',
    '',
    'It is not a wireless charging pad. It is a magnetic wired charger/attachment that connects to the charging contacts on the easyTag and plugs into a USB power source.',
    '',
    'If you need a spare charger beyond the one included with the easyTag, that would be separate.',
    '',
    'Best wishes,',
    'Emily',
  ].join('\n'));
}

function buildConfidenceReason(existingReason: string | null): string {
  const guardReason = 'verified easyTag charger fact guard applied';
  if (!existingReason) return guardReason;
  if (existingReason.includes(guardReason)) return existingReason;
  return `${existingReason}; ${guardReason}`;
}
