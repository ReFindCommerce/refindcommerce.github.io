import { supabase } from "@/lib/supabase";
import type { MarketingCampaign, MarketingDashboardData } from "@/types/marketing";

export async function fetchMarketingDashboard(): Promise<MarketingDashboardData> {
  const { data, error } = await supabase.rpc("get_wa_marketing_dashboard");
  if (error) throw error;
  return data as MarketingDashboardData;
}

export async function fetchMarketingCampaigns(): Promise<MarketingCampaign[]> {
  const { data, error } = await supabase.rpc("get_wa_marketing_campaigns");
  if (error) throw error;
  return (data || []) as MarketingCampaign[];
}

export interface WhatsAppPreferenceStatus {
  valid: boolean;
  optedOut: boolean;
}

export async function fetchWhatsAppPreference(token: string): Promise<WhatsAppPreferenceStatus> {
  const { data, error } = await supabase.rpc("get_wa_marketing_preference", { p_token: token });
  if (error) throw error;
  return data as WhatsAppPreferenceStatus;
}

export async function optOutOfWhatsAppMarketing(token: string): Promise<void> {
  const { data, error } = await supabase.rpc("wa_marketing_opt_out", { p_token: token });
  if (error) throw error;
  if (!data?.success) throw new Error("This preferences link is not valid.");
}
