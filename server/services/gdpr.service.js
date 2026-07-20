import { db } from "../db.js";
import { repositories } from "../repositories/repository-registry.js";
import { badRequest, notFound } from "../utils/app-error.js";

/**
 * GDPR / data-privacy service (ADD-ONLY feature).
 *
 * Implements data-subject rights for a client (the "data subject"):
 *   - export  : Right of access / portability (Art. 15 / 20) - gather every
 *               record tied to the client across the database.
 *   - erase   : Right to erasure (Art. 17) - anonymize personal data while
 *               retaining anonymized transactional rows that must be kept for
 *               legal/tax obligations (financial integrity preserved).
 *   - retentionCandidates : surface stale records for a retention policy.
 *
 * Read-only DB introspection (PRAGMA) is used to discover every table that
 * references a client, so new tables are covered automatically. Nothing here
 * modifies existing code.
 */

const now = () => new Date().toISOString();

// PII-bearing column names that should be scrubbed on erasure wherever they appear.
const PII_COLUMNS = new Set([
  "name", "fullName", "clientName", "customerName", "contactName",
  "phone", "mobile", "clientPhone", "customerPhone", "contactPhone", "whatsapp", "whatsappNumber",
  "email", "clientEmail", "customerEmail", "contactEmail",
  "address", "addressLine", "city", "pincode", "postalCode",
  "birthday", "dob", "dateOfBirth", "anniversary", "gender",
  "notes", "remarks"
]);

function tablesReferencingClient() {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  const out = [];
  for (const table of tables) {
    let cols;
    try {
      cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    } catch {
      continue;
    }
    if (cols.includes("clientId") && cols.includes("tenantId")) out.push({ table, cols });
  }
  return out;
}

export class GdprService {
  resolveClient(clientId, access) {
    if (!clientId) throw badRequest("clientId is required");
    const client = repositories.clients.getById(clientId, { tenantId: access.tenantId });
    if (!client) throw notFound("Client not found");
    return client;
  }

  /** Right of access / portability: collect everything tied to this client. */
  exportClientData(clientId, access) {
    const client = this.resolveClient(clientId, access);
    const records = {};
    let totalRows = 0;
    for (const { table } of tablesReferencingClient()) {
      try {
        const rows = db
          .prepare(`SELECT * FROM ${table} WHERE clientId = @clientId AND tenantId = @tenantId`)
          .all({ clientId, tenantId: access.tenantId });
        if (rows.length) {
          records[table] = rows;
          totalRows += rows.length;
        }
      } catch {
        // Skip any table that cannot be queried; never fail the whole export.
      }
    }
    return {
      format: "gdpr-data-export-v1",
      generatedAt: now(),
      subject: { id: client.id, ...client },
      relatedRecords: records,
      summary: { tables: Object.keys(records).length, totalRows }
    };
  }

  /** Right to erasure: anonymize PII, retain anonymized transactional rows. */
  eraseClientData(clientId, access, { reason = "Data subject erasure request" } = {}) {
    const client = this.resolveClient(clientId, access);
    if (client.deletedReason === "GDPR erasure") {
      return { erased: true, alreadyErased: true, clientId };
    }

    // 1. Anonymize the primary client profile (keep aggregates + id for finance).
    repositories.clients.update(
      clientId,
      {
        name: `Erased Subject ${String(clientId).slice(-6)}`,
        phone: "",
        email: "",
        gender: "",
        birthday: "",
        anniversary: "",
        notes: "",
        tags: [],
        preferences: {},
        allergies: [],
        safetyFlags: {},
        communicationPreferences: {},
        whatsappHistory: [],
        consentForms: [],
        deletedAt: now(),
        deletedBy: access.userId || "",
        deletedReason: "GDPR erasure"
      },
      { tenantId: access.tenantId }
    );

    // 2. Scrub snapshotted PII columns in every related table.
    const scrubbed = [];
    for (const { table, cols } of tablesReferencingClient()) {
      const piiCols = cols.filter((c) => PII_COLUMNS.has(c));
      if (!piiCols.length) continue;
      const setClause = piiCols.map((c) => `${c} = ''`).join(", ");
      try {
        const info = db
          .prepare(`UPDATE ${table} SET ${setClause} WHERE clientId = @clientId AND tenantId = @tenantId`)
          .run({ clientId, tenantId: access.tenantId });
        if (info.changes) scrubbed.push({ table, columns: piiCols, rows: info.changes });
      } catch {
        // best-effort scrub
      }
    }

    return {
      erased: true,
      clientId,
      reason,
      erasedAt: now(),
      profileAnonymized: true,
      relatedTablesScrubbed: scrubbed
    };
  }

  /** Retention report: clients with no activity older than the cutoff (report only). */
  retentionCandidates(access, { inactiveDays = 1825 } = {}) {
    const cutoff = new Date(Date.now() - Number(inactiveDays) * 86400000).toISOString();
    const rows = db
      .prepare(
         `SELECT id, name, lastVisitAt, createdAt FROM clients
         WHERE tenantId = @tenantId
           AND (deletedReason IS NULL OR deletedReason != 'GDPR erasure')
           AND COALESCE(NULLIF(lastVisitAt, ''), createdAt) < @cutoff
         ORDER BY COALESCE(NULLIF(lastVisitAt, ''), createdAt) ASC
         LIMIT 1000`
      )
      .all({ tenantId: access.tenantId, cutoff });
    return {
      policy: { inactiveDays, cutoff },
      generatedAt: now(),
      candidateCount: rows.length,
      candidates: rows
    };
  }
}

export const gdprService = new GdprService();
