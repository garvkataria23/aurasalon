import { createHash, randomUUID } from "node:crypto";
import { columnsFor, db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;

function safeColumns(table) {
  try {
    return columnsFor(table);
  } catch {
    return [];
  }
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hashLedgerEvent({ tenantId, invoiceId, eventType, payload, previousHash, createdAt }) {
  return createHash("sha256")
    .update(JSON.stringify({ tenantId, invoiceId, eventType, payload, previousHash: previousHash || "", createdAt }))
    .digest("hex");
}

function hashSnapshot(snapshot) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function eventSchema() {
  const columns = safeColumns("invoice_events");
  return {
    columns,
    payloadColumn: columns.includes("event_payload_json") ? "event_payload_json" : "payload_json",
    hashColumn: columns.includes("event_hash") ? "event_hash" : "hash",
    hasActorRole: columns.includes("actor_role"),
    hasIp: columns.includes("ip_address"),
    hasUserAgent: columns.includes("user_agent"),
    hasSource: columns.includes("source")
  };
}

function requireTable(table) {
  if (!safeColumns(table).length) throw badRequest(`${table} migration is not applied`);
}

export class InvoiceEventLedgerService {
  append({ tenantId, invoiceId, eventType, actorUserId = "", actorRole = "", payload = {}, ip = "", userAgent = "", source = "invoice-ledger" }) {
    requireTable("invoice_events");
    if (!tenantId || !invoiceId || !eventType) throw badRequest("tenantId, invoiceId and eventType are required");
    const schema = eventSchema();
    const previous = db
      .prepare(`SELECT ${schema.hashColumn} AS hash FROM invoice_events WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`)
      .get(tenantId, invoiceId);
    const createdAt = now();
    const previousHash = previous?.hash || "";
    const eventHash = hashLedgerEvent({ tenantId, invoiceId, eventType, payload, previousHash, createdAt });
    const base = {
      id: makeId("ieve"),
      tenant_id: tenantId,
      invoice_id: invoiceId,
      event_type: eventType,
      actor_user_id: actorUserId,
      previous_hash: previousHash,
      created_at: createdAt
    };
    base[schema.payloadColumn] = JSON.stringify(payload || {});
    base[schema.hashColumn] = eventHash;
    if (schema.hasActorRole) base.actor_role = actorRole;
    if (schema.hasIp) base.ip_address = ip;
    if (schema.hasUserAgent) base.user_agent = userAgent;
    if (schema.hasSource) base.source = source;

    const keys = Object.keys(base);
    db.prepare(`INSERT INTO invoice_events (${keys.join(", ")}) VALUES (${keys.map((key) => `@${key}`).join(", ")})`).run(base);
    return { id: base.id, eventHash, previousHash };
  }

  listEvents(invoiceId, access = {}) {
    requireTable("invoice_events");
    if (!invoiceId) throw badRequest("invoiceId is required");
    const rows = db
      .prepare("SELECT * FROM invoice_events WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at ASC, id ASC")
      .all(access.tenantId, invoiceId);
    return rows.map((row) => ({
      ...row,
      payload: parseJson(row.event_payload_json || row.payload_json, {})
    }));
  }

  snapshot(invoiceId, access = {}) {
    requireTable("invoice_snapshots");
    const existing = db
      .prepare("SELECT * FROM invoice_snapshots WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(access.tenantId, invoiceId);
    if (existing) return { ...existing, snapshot: parseJson(existing.snapshot_json, {}) };

    const invoice = db.prepare("SELECT * FROM invoices WHERE tenant_id = ? AND id = ?").get(access.tenantId, invoiceId);
    if (!invoice) throw notFound("Invoice not found");
    const snapshot = {
      invoice,
      items: db.prepare("SELECT * FROM invoice_items WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at ASC").all(access.tenantId, invoiceId),
      payments: db.prepare("SELECT * FROM invoice_payments WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at ASC").all(access.tenantId, invoiceId),
      taxes: db.prepare("SELECT * FROM invoice_taxes WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at ASC").all(access.tenantId, invoiceId)
    };
    const snapshotHash = hashSnapshot(snapshot);
    const id = makeId("isnp");
    db.prepare(
      `INSERT INTO invoice_snapshots (id, tenant_id, invoice_id, snapshot_json, snapshot_hash, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, access.tenantId, invoiceId, JSON.stringify(snapshot), snapshotHash, access.userId || "", now());
    return { id, tenant_id: access.tenantId, invoice_id: invoiceId, snapshot_hash: snapshotHash, snapshot };
  }

  verify(invoiceId, access = {}) {
    const events = this.listEvents(invoiceId, access);
    let previousHash = "";
    const warnings = [];
    const schema = eventSchema();
    const verified = events.every((event, index) => {
      const eventHash = event.event_hash || event.hash || "";
      const payload = parseJson(event.event_payload_json || event.payload_json, {});
      const expectedPrevious = event.previous_hash || "";
      if (expectedPrevious !== previousHash) {
        warnings.push({ index, type: "previous_hash_mismatch", expected: previousHash, actual: expectedPrevious });
        return false;
      }
      const expectedHash = hashLedgerEvent({
        tenantId: event.tenant_id,
        invoiceId: event.invoice_id,
        eventType: event.event_type,
        payload,
        previousHash,
        createdAt: event.created_at
      });
      previousHash = eventHash;
      if (schema.hashColumn === "hash") {
        warnings.push({ index, type: "legacy_hash_schema", message: "Legacy rows may use the original billing hash format." });
        return true;
      }
      if (expectedHash !== eventHash) {
        warnings.push({ index, type: "event_hash_mismatch", expected: expectedHash, actual: eventHash });
        return false;
      }
      return true;
    });
    return { ok: verified, eventCount: events.length, lastHash: previousHash, warnings };
  }
}

export const invoiceEventLedgerService = new InvoiceEventLedgerService();
