export type WhatsAppConsentState =
  | "NEVER_SUBSCRIBED"
  | "PENDING"
  | "SUBSCRIBED"
  | "UNSUBSCRIBED"
  | "REDACTED";

export type SupportStatus = "no_history" | "satisfied" | "open" | "unsatisfied" | "unknown";

export type CampaignStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "blocked"
  | "failed";

export interface WhatsAppMarketingContact {
  phoneE164: string;
  consentState: WhatsAppConsentState;
  optedOutAt?: string | null;
  suppressed?: boolean;
  supportStatus: SupportStatus;
  lastSupportAt?: string | null;
  coolingUntil?: string | null;
  sentAt?: string[];
}

export interface MarketingEligibilitySettings {
  maxMessagesIn30Days: number;
  supportCoolingDays: number;
}

export type MarketingBlockReason =
  | "invalid_phone"
  | "whatsapp_consent_not_subscribed"
  | "suppressed_or_opted_out"
  | "support_not_safely_resolved"
  | "support_cooling_period"
  | "rolling_30_day_cap";

export interface MarketingEligibility {
  eligible: boolean;
  reasons: MarketingBlockReason[];
}

export interface MarketingAudienceMetrics {
  eligibleNow: number;
  coolingPeriod: number;
  suppressed: number;
  at30DayCap: number;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  campaign_kind: "useful_story" | "private_offer" | "free_gift";
  template_name: string;
  template_language: string;
  message_preview: string;
  button_label: string | null;
  button_url: string | null;
  featured_product_title: string | null;
  scheduled_for: string | null;
  timezone: string;
  cohort_size: number;
  status: CampaignStatus;
  automatic: boolean;
  approved_at: string | null;
  blocked_reason: string | null;
  delivered: number;
  clicked: number;
  orders: number;
  ctr: number;
  conversion_rate: number;
  revenue: number;
  created_at: string;
  updated_at: string;
}

export interface MarketingDashboardData {
  audience: MarketingAudienceMetrics;
  results: {
    delivered: number;
    clicked: number;
    orders: number;
    ctr: number;
    conversionRate: number;
    revenue: number;
  };
  nextCampaign: MarketingCampaign | null;
  settings: Record<string, boolean | number | string | null>;
  updatedAt: string;
}
