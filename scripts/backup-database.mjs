import "../server/config/env.js";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

const { db, dbPath: source } = await import("../server/db.js");
const backupDir = join(dirname(source), "backups");

if (!existsSync(source)) {
  console.error(JSON.stringify({ ok: false, error: "Database file was not found", source }, null, 2));
  process.exit(1);
}

mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(backupDir, `manual-${stamp}.sqlite`);
await db.backup(target);
const hash = createHash("sha256");
for await (const chunk of createReadStream(target)) hash.update(chunk);
const checksum = hash.digest("hex");
const stat = statSync(target);

console.log(JSON.stringify({ ok: true, filePath: target, fileSizeBytes: stat.size, checksum }, null, 2));
