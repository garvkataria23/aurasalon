import { db, tableHasColumn } from "../db.js";

let checked = false;

export function ensureServiceBufferColumn() {
  if (checked) return;
  checked = true;
  if (!tableHasColumn("services", "bufferMinutes")) {
    db.prepare("ALTER TABLE services ADD COLUMN bufferMinutes INTEGER DEFAULT 0").run();
  }
}
