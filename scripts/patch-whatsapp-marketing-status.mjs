import fs from "node:fs";
import path from "node:path";

import { addMetaStatusBranch } from "./whatsapp-marketing-status-callback.mjs";

const source = process.argv[2];
const destination = process.argv[3] || source;
if (!source) {
  console.error("Usage: node scripts/patch-whatsapp-marketing-status.mjs <source.json> [destination.json]");
  process.exit(1);
}

const workflow = JSON.parse(fs.readFileSync(source, "utf8"));
addMetaStatusBranch(workflow);
fs.mkdirSync(path.dirname(path.resolve(destination)), { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Added the Meta marketing status branch to ${destination}`);
