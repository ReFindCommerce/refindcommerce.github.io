import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

describe("WhatsApp marketing attribution release path", () => {
  it("puts a unique click token into every template send", () => {
    const workflow = JSON.parse(
      fs.readFileSync(path.join(root, "n8n/whatsapp-marketing/scheduler.json"), "utf8"),
    );
    const nodes = workflow.nodes as Array<{ name: string; parameters: Record<string, string> }>;
    const recheck = nodes.find((node) => node.name === "Build final eligibility check");
    const sender = nodes.find((node) => node.name === "Send approved easyTag template");

    expect(recheck?.parameters.jsCode).toContain("r.click_token");
    expect(sender?.parameters.body).toContain("__CLICK_TOKEN__");
    expect(sender?.parameters.body).toContain("$json.click_token");
  });

  it("records unique clicks and attributes only post-click orders", () => {
    const migration = fs.readFileSync(
      path.join(root, "supabase/migrations/20260813_whatsapp_marketing_attribution.sql"),
      "utf8",
    );

    expect(migration).toContain("wa_marketing_record_click");
    expect(migration).toContain("click_count = click_count + 1");
    expect(migration).toContain("wa_recipient=");
    expect(migration).toContain("wa_marketing_attribute_order");
    expect(migration).toContain("first_clicked_at <= p_order_created_at");
    expect(migration).toContain("interval '30 days'");
  });
});
