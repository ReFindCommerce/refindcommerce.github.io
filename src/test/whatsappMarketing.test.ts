import { describe, expect, it } from "vitest";

import {
  evaluateWhatsAppEligibility,
  normalizePhoneE164,
  pickDeterministicCohort,
} from "@/lib/whatsappMarketing";
import type { WhatsAppMarketingContact } from "@/types/marketing";

const now = new Date("2026-08-10T12:00:00.000Z");
const settings = { maxMessagesIn30Days: 2, supportCoolingDays: 7 };

function contact(overrides: Partial<WhatsAppMarketingContact> = {}): WhatsAppMarketingContact {
  return {
    phoneE164: "+447700900001",
    consentState: "SUBSCRIBED",
    supportStatus: "no_history",
    ...overrides,
  };
}

describe("WhatsApp marketing eligibility", () => {
  it("allows a consented customer with no unsafe support signal", () => {
    expect(evaluateWhatsAppEligibility(contact(), now, settings)).toEqual({ eligible: true, reasons: [] });
  });

  it("fails closed for open, unhappy, or unknown support outcomes", () => {
    expect(evaluateWhatsAppEligibility(contact({ supportStatus: "open" }), now, settings).reasons)
      .toContain("support_not_safely_resolved");
    expect(evaluateWhatsAppEligibility(contact({ supportStatus: "unsatisfied" }), now, settings).eligible)
      .toBe(false);
    expect(evaluateWhatsAppEligibility(contact({ supportStatus: "unknown" }), now, settings).eligible)
      .toBe(false);
  });

  it("holds recent support conversations for seven days", () => {
    const result = evaluateWhatsAppEligibility(
      contact({ supportStatus: "satisfied", lastSupportAt: "2026-08-06T12:00:00.000Z" }),
      now,
      settings,
    );
    expect(result.reasons).toContain("support_cooling_period");
  });

  it("enforces the rolling two-message cap", () => {
    const result = evaluateWhatsAppEligibility(
      contact({ sentAt: ["2026-07-20T12:00:00.000Z", "2026-08-01T12:00:00.000Z"] }),
      now,
      settings,
    );
    expect(result.reasons).toContain("rolling_30_day_cap");
  });

  it("blocks missing consent and opt-outs", () => {
    const result = evaluateWhatsAppEligibility(
      contact({ consentState: "UNSUBSCRIBED", optedOutAt: "2026-08-01T12:00:00.000Z" }),
      now,
      settings,
    );
    expect(result.reasons).toEqual([
      "whatsapp_consent_not_subscribed",
      "suppressed_or_opted_out",
    ]);
  });
});

describe("phone normalization and cohort selection", () => {
  it("normalizes international phone values", () => {
    expect(normalizePhoneE164("+44 7700 900 001")).toBe("+447700900001");
    expect(normalizePhoneE164("07700 900 001")).toBeNull();
  });

  it("selects a stable, deduplicated cohort", () => {
    const contacts = [
      { phoneE164: "+447700900001" },
      { phoneE164: "+447700900002" },
      { phoneE164: "+447700900003" },
      { phoneE164: "+44 7700 900 001" },
    ];
    const first = pickDeterministicCohort(contacts, 2, "campaign-1");
    const second = pickDeterministicCohort(contacts, 2, "campaign-1");
    expect(second).toEqual(first);
    expect(first).toHaveLength(2);
  });
});

