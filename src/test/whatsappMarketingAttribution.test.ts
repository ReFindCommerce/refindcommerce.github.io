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

  it("blocks scheduling until click and order tracking are connected", () => {
    const workflowText = fs.readFileSync(
      path.join(root, "n8n/whatsapp-marketing/scheduler.json"),
      "utf8",
    );

    expect(workflowText).toContain("key = 'click_tracking_connected'");
    expect(workflowText).toContain("key = 'order_attribution_connected'");
  });

  it("enforces a five-per-day London send window", () => {
    const workflowText = fs.readFileSync(
      path.join(root, "n8n/whatsapp-marketing/scheduler.json"),
      "utf8",
    );

    expect(workflowText).toContain("send_window_start_hour_london");
    expect(workflowText).toContain("send_window_end_hour_london");
    expect(workflowText).toContain("wa_marketing_daily_send_cap");
    expect(workflowText).toContain("daily_send_limit");
    expect(workflowText).toContain("Europe/London");
    expect(workflowText).not.toContain("where dc.automatic and d.send_status");
  });

  it("skips scheduled campaigns once their explicit recipient queue is empty", () => {
    const workflowText = fs.readFileSync(
      path.join(root, "n8n/whatsapp-marketing/scheduler.json"),
      "utf8",
    );

    expect(workflowText).toContain("pending.campaign_id = c.id");
    expect(workflowText).toContain("pending.send_status = 'queued'");
  });

  it("syncs Shopify purchase history for audience targeting", () => {
    const workflowText = fs.readFileSync(
      path.join(root, "n8n/whatsapp-marketing/shopify-sync.json"),
      "utf8",
    );

    expect(workflowText).toContain("numberOfOrders");
    expect(workflowText).toContain("order_count");
    expect(workflowText).toContain("last_order_at");
  });

  it("uses the named recipient constraint to avoid PL/pgSQL column ambiguity", () => {
    const migration = fs.readFileSync(
      path.join(root, "supabase/migrations/20260813_whatsapp_marketing_targeting.sql"),
      "utf8",
    );

    expect(migration).toContain(
      "on conflict on constraint wa_marketing_recipients_campaign_id_phone_e164_key do nothing",
    );
    expect(migration).not.toContain("on conflict (campaign_id, phone_e164)");
  });

  it("does not auto-select contacts for manual internal campaigns", () => {
    const migration = fs.readFileSync(
      path.join(
        root,
        "supabase/migrations/20260813_whatsapp_marketing_manual_recipient_guard.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("if campaign.automatic then");
    expect(migration).toContain("Manual campaigns only use recipients");
    expect(migration).toContain("and r.send_status = 'queued'");
  });

  it("returns a newly selected cohort without rejoining the same-statement table snapshot", () => {
    const workflow = JSON.parse(
      fs.readFileSync(path.join(root, "n8n/whatsapp-marketing/scheduler.json"), "utf8"),
    );
    const buildCohort = workflow.nodes.find(
      (node: { name: string }) => node.name === "Build cohort selection",
    );
    const cohortCode = String(buildCohort?.parameters?.jsCode || "");

    expect(cohortCode).toContain("select s.recipient_id, s.phone_e164");
    expect(cohortCode).not.toContain(
      "join public.wa_marketing_recipients r on r.id = s.recipient_id",
    );
  });

  it("preserves every selected recipient through the final eligibility builder", () => {
    const workflow = JSON.parse(
      fs.readFileSync(path.join(root, "n8n/whatsapp-marketing/scheduler.json"), "utf8"),
    );
    const finalBuilder = workflow.nodes.find(
      (node: { name: string }) => node.name === "Build final eligibility check",
    );
    const builderCode = String(finalBuilder?.parameters?.jsCode || "");

    expect(builderCode).toContain("$input.all().map((item)");
    expect(builderCode).toContain("item.json.recipient_id");
  });

  it("pairs every Meta send response with its recipient audit row", () => {
    const workflow = JSON.parse(
      fs.readFileSync(path.join(root, "n8n/whatsapp-marketing/scheduler.json"), "utf8"),
    );
    const auditBuilder = workflow.nodes.find(
      (node: { name: string }) => node.name === "Build send audit",
    );
    const auditCode = String(auditBuilder?.parameters?.jsCode || "");

    expect(auditCode).toContain("$('Final eligibility check').all()");
    expect(auditCode).toContain("$input.all().map((item, index)");
    expect(auditCode).not.toContain("$input.first()");
  });

  it("provides a live-safe click redirect workflow", () => {
    const workflow = JSON.parse(
      fs.readFileSync(
        path.join(root, "n8n/whatsapp-marketing/click-redirect.json"),
        "utf8",
      ),
    );
    const workflowText = JSON.stringify(workflow);

    expect(workflowText).toContain("easytag-wa-click/:token");
    expect(workflowText).toContain("wa_marketing_record_click");
    expect(workflowText).toContain("respondWith\":\"redirect");
    expect(workflowText).toContain("https://easytag.app/");
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
