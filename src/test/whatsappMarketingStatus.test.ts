import { describe, expect, it } from "vitest";

import {
  META_STATUS_EXTRACTOR_NODE,
  META_STATUS_RECORDER_QUERY,
  META_STATUS_RECORDER_NODE,
  META_STATUS_SQL,
  addSqlToMetaStatuses,
  addMetaStatusBranch,
  extractMetaStatuses,
} from "../../scripts/whatsapp-marketing-status-callback.mjs";

const messageId = "wamid.test-marketing-message";

describe("Meta marketing status extraction", () => {
  it.each(["sent", "delivered", "read", "failed"])("extracts %s callbacks", (status) => {
    const errors = status === "failed" ? [{ code: 131042, title: "Payment issue" }] : undefined;
    const result = extractMetaStatuses(
      [{ json: { statuses: [{ id: messageId, status, timestamp: "1786533091", recipient_id: "447825005731", errors }] } }],
      "2026-08-12T11:11:31.000Z",
    );

    expect(result).toHaveLength(1);
    expect(result[0].json).toMatchObject({
      provider_message_id: messageId,
      event_type: status,
      occurred_at: "2026-08-12T11:11:31.000Z",
      phone_e164: "+447825005731",
    });
  });

  it("finds nested Cloud API callback payloads", () => {
    const result = extractMetaStatuses([
      { json: { body: { entry: [{ changes: [{ value: { statuses: [{ id: messageId, status: "delivered" }] } }] }] } } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].json.event_type).toBe("delivered");
  });

  it("returns no items for ordinary inbound messages", () => {
    const result = extractMetaStatuses([
      { json: { messages: [{ from: "447825005731", type: "text", text: { body: "Hello" } }] } },
    ]);
    expect(result).toEqual([]);
  });

  it("ignores unsupported and malformed statuses", () => {
    const result = extractMetaStatuses([
      { json: { statuses: [{ id: messageId, status: "deleted" }, { status: "read" }, null] } },
    ]);
    expect(result).toEqual([]);
  });

  it("escapes callback text without relying on Node globals", () => {
    const rows = extractMetaStatuses([
      { json: { statuses: [{ id: "wamid.'unsafe", status: "failed", errors: [{ message: "it's broken" }] }] } },
    ]);
    const [item] = addSqlToMetaStatuses(rows);
    expect(item.json.sql).not.toContain("wamid.'unsafe");
    expect(item.json.sql).not.toContain("it's broken");
    expect(item.json.sql).toContain("wamid.''unsafe");
    expect(item.json.sql).toContain("it''s broken");
    expect(item.json.sql).not.toContain("Buffer");
  });
});

describe("Meta marketing status branch", () => {
  it("adds a parallel fail-soft branch without replacing inbox routing", () => {
    const workflow = {
      nodes: [
        { name: "WhatsApp Trigger", position: [-592, 512] },
        { name: "Switch" },
        { name: "Existing query", credentials: { postgres: { id: "postgres-id", name: "Postgres account" } } },
      ],
      connections: {
        "WhatsApp Trigger": { main: [[{ node: "Switch", type: "main", index: 0 }]] },
      },
    };

    addMetaStatusBranch(workflow);

    expect(workflow.connections["WhatsApp Trigger"].main[0].map((connection) => connection.node)).toEqual([
      "Switch",
      META_STATUS_EXTRACTOR_NODE,
    ]);
    expect(workflow.connections[META_STATUS_EXTRACTOR_NODE].main[0][0].node).toBe(META_STATUS_RECORDER_NODE);
    expect(workflow.nodes.find((node) => node.name === META_STATUS_EXTRACTOR_NODE)?.onError).toBe("continueRegularOutput");
    expect(workflow.nodes.find((node) => node.name === META_STATUS_RECORDER_NODE)?.onError).toBe("continueRegularOutput");
  });

  it("uses idempotent event writes and never downgrades read status", () => {
    expect(META_STATUS_SQL).toContain("where not exists");
    expect(META_STATUS_SQL).toContain("when t.event_type = 'read' then 'read'");
    expect(META_STATUS_SQL).toContain("when t.event_type = 'delivered' and r.send_status <> 'read'");
    expect(META_STATUS_SQL).toContain("join public.wa_marketing_recipients r");
  });

  it("uses a harmless fallback when an extractor item has no SQL", () => {
    expect(META_STATUS_RECORDER_QUERY).toContain("$json.sql ||");
    expect(META_STATUS_RECORDER_QUERY).toContain("where false");
  });

  it("repairs an existing status branch instead of duplicating it", () => {
    const workflow = {
      nodes: [
        { name: "WhatsApp Trigger", position: [-592, 512] },
        {
          name: META_STATUS_EXTRACTOR_NODE,
          id: "existing-extractor",
          position: [1, 2],
          parameters: { jsCode: "broken" },
        },
        {
          name: META_STATUS_RECORDER_NODE,
          id: "existing-recorder",
          position: [3, 4],
          parameters: { query: "={{ $json.sql }}" },
        },
        { name: "Existing query", credentials: { postgres: { id: "postgres-id", name: "Postgres account" } } },
      ],
      connections: {
        "WhatsApp Trigger": { main: [[{ node: "Switch", type: "main", index: 0 }, { node: META_STATUS_EXTRACTOR_NODE, type: "main", index: 0 }]] },
      },
    };

    addMetaStatusBranch(workflow);

    expect(workflow.nodes.filter((node) => node.name === META_STATUS_EXTRACTOR_NODE)).toHaveLength(1);
    expect(workflow.nodes.find((node) => node.name === META_STATUS_EXTRACTOR_NODE)?.id).toBe("existing-extractor");
    expect(workflow.nodes.find((node) => node.name === META_STATUS_EXTRACTOR_NODE)?.parameters.jsCode).not.toBe("broken");
    expect(workflow.nodes.find((node) => node.name === META_STATUS_RECORDER_NODE)?.parameters.query).toBe(META_STATUS_RECORDER_QUERY);
  });
});
