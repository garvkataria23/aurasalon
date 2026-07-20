import "../server/db.js";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "data");
const source = join(dataDir, "salon-crm.sqlite");
const backupDir = join(dataDir, "backups");

if (!existsSync(source)) {
  console.error(JSON.stringify({ ok: false, error: "Database file was not found", source }, null, 2));
  process.exit(1);
}

mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(backupDir, `manual-${stamp}.sqlite`);
copyFileSync(source, target);
const bytes = readFileSync(target);
const checksum = createHash("sha256").update(bytes).digest("hex");
const stat = statSync(target);

console.log(JSON.stringify({ ok: true, filePath: target, fileSizeBytes: stat.size, checksum }, null, 2));
