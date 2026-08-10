import type {
  MarketingBlockReason,
  MarketingEligibility,
  MarketingEligibilitySettings,
  WhatsAppMarketingContact,
} from "@/types/marketing";

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizePhoneE164(value: string): string | null {
  const trimmed = String(value || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

export function evaluateWhatsAppEligibility(
  contact: WhatsAppMarketingContact,
  now: Date,
  settings: MarketingEligibilitySettings,
): MarketingEligibility {
  const reasons: MarketingBlockReason[] = [];
  const phone = normalizePhoneE164(contact.phoneE164);

  if (!phone) reasons.push("invalid_phone");
  if (contact.consentState !== "SUBSCRIBED") reasons.push("whatsapp_consent_not_subscribed");
  if (contact.suppressed || contact.optedOutAt) reasons.push("suppressed_or_opted_out");
  if (["open", "unsatisfied", "unknown"].includes(contact.supportStatus)) {
    reasons.push("support_not_safely_resolved");
  }

  const coolingUntil = contact.coolingUntil ? new Date(contact.coolingUntil).getTime() : null;
  const lastSupportAt = contact.lastSupportAt ? new Date(contact.lastSupportAt).getTime() : null;
  const coolingThreshold = now.getTime() - settings.supportCoolingDays * DAY_MS;
  if (
    (coolingUntil !== null && Number.isFinite(coolingUntil) && coolingUntil > now.getTime()) ||
    (lastSupportAt !== null && Number.isFinite(lastSupportAt) && lastSupportAt > coolingThreshold)
  ) {
    reasons.push("support_cooling_period");
  }

  const rollingStart = now.getTime() - 30 * DAY_MS;
  const recentSendCount = (contact.sentAt || []).filter((value) => {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp >= rollingStart && timestamp <= now.getTime();
  }).length;
  if (recentSendCount >= settings.maxMessagesIn30Days) reasons.push("rolling_30_day_cap");

  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickDeterministicCohort<T extends { phoneE164: string }>(
  contacts: T[],
  cohortSize: number,
  seed: string,
): T[] {
  const unique = new Map<string, T>();
  contacts.forEach((contact) => {
    const phone = normalizePhoneE164(contact.phoneE164);
    if (phone && !unique.has(phone)) unique.set(phone, contact);
  });

  return [...unique.entries()]
    .sort(([phoneA], [phoneB]) => {
      const scoreDifference = stableHash(`${seed}:${phoneA}`) - stableHash(`${seed}:${phoneB}`);
      return scoreDifference || phoneA.localeCompare(phoneB);
    })
    .slice(0, Math.max(0, Math.floor(cohortSize)))
    .map(([, contact]) => contact);
}

