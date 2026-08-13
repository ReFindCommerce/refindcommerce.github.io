import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const sql = fs.readFileSync(
  path.join(root, "supabase/migrations/20260813_whatsapp_marketing_attribution.sql"),
  "utf8",
);

const workflow = {
  name: "easyTag WhatsApp Marketing - Attribution Schema Setup",
  nodes: [
    {
      id: "wa-attribution-schema-manual",
      name: "Run schema setup",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [0, -100],
      parameters: {},
    },
    {
      id: "wa-attribution-schema-postgres",
      name: "Apply attribution schema",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.6,
      position: [260, -100],
      parameters: {
        operation: "executeQuery",
        query: sql,
        options: {},
      },
      credentials: {
        postgres: {
          id: "MHmCNfCkbN5OTMZj",
          name: "Postgres account",
        },
      },
    },
  ],
  connections: {
    "Run schema setup": {
      main: [[{ node: "Apply attribution schema", type: "main", index: 0 }]],
    },
  },
  settings: {
    executionOrder: "v1",
    timezone: "Europe/London",
    saveDataSuccessExecution: "all",
    saveExecutionProgress: false,
  },
  active: false,
  tags: [],
};

fs.writeFileSync(
  path.join(root, "n8n/whatsapp-marketing/attribution-schema-setup.json"),
  `${JSON.stringify(workflow, null, 2)}\n`,
);
