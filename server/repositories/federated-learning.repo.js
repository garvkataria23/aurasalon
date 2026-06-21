import { db } from "../db.js";

const MIN_REAL_TENANTS = 50;

db.exec(`
  CREATE TABLE IF NOT EXISTS federatedLearningRounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    moduleCode TEXT NOT NULL DEFAULT 'F6',
    status TEXT NOT NULL DEFAULT 'draft',
    eligibleTenantCount INTEGER NOT NULL DEFAULT 0,
    sampleCount INTEGER NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_federatedLearningRounds_scope
    ON federatedLearningRounds(tenantId, branchId, moduleCode, createdAt);
`);

function normalizeScope(scope = {}) {
  const tenantId = String(scope.tenantId || "").trim();
  const branchId = String(scope.branchId || "").trim();
  if (!tenantId || !branchId) throw new Error("tenantId and branchId are required");
  return { tenantId, branchId };
}

function tableExists(tableName) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function count(tableName, where = "", params = {}) {
  if (!tableExists(tableName)) return 0;
  const row = db.prepare(`SELECT COUNT(*) AS value FROM ${tableName} ${where}`).get(params);
  return Number(row?.value || 0);
}

function tenantSet(tableName, where = "") {
  if (!tableExists(tableName)) return new Set();
  return new Set(db.prepare(`
    SELECT DISTINCT tenantId
    FROM ${tableName}
    WHERE tenantId IS NOT NULL AND tenantId != ''
    ${where}
  `).all().map((row) => String(row.tenantId || "").trim()).filter(Boolean));
}

function unionSize(...sets) {
  return new Set(sets.flatMap((set) => [...set])).size;
}

export function readiness(scope = {}) {
  const current = normalizeScope(scope);
  const invoiceTenants = tenantSet("invoices");
  const appointmentTenants = tenantSet("appointments");
  const demandTenants = tenantSet("demandSignals");
  const subscriptionTenants = tableExists("subscriptions")
    ? tenantSet("subscriptions", "AND status = 'active'")
    : new Set();
  const realTenantCount = unionSize(invoiceTenants, appointmentTenants, demandTenants, subscriptionTenants);
  const sampleCount = count("demandSignals") + count("invoices") + count("appointments");
  const ready = realTenantCount >= MIN_REAL_TENANTS;
  return {
    ...current,
    status: ready ? "ready" : "premature",
    ready,
    gate: `${MIN_REAL_TENANTS}+ real active/paying tenants`,
    eligibleTenantCount: realTenantCount,
    sampleCount,
    evidence: {
      invoiceTenants: invoiceTenants.size,
      appointmentTenants: appointmentTenants.size,
      demandTenants: demandTenants.size,
      activeSubscriptionTenants: subscriptionTenants.size
    },
    note: ready
      ? "Federated learning can be prepared as review-only aggregate weights."
      : "Do not train federated models yet; keep collecting real tenant activity."
  };
}

export function createRound(data = {}) {
  const current = normalizeScope(data);
  const gate = readiness(current);
  const status = gate.ready ? "draft" : "blocked";
  const result = db.prepare(`
    INSERT INTO federatedLearningRounds (
      tenantId, branchId, moduleCode, status, eligibleTenantCount, sampleCount, notes
    )
    VALUES (
      @tenantId, @branchId, 'F6', @status, @eligibleTenantCount, @sampleCount, @notes
    )
  `).run({
    ...current,
    status,
    eligibleTenantCount: gate.eligibleTenantCount,
    sampleCount: gate.sampleCount,
    notes: data.notes || gate.note
  });
  return getRound({ ...current, id: Number(result.lastInsertRowid) });
}

export function getRound(scope = {}) {
  const current = normalizeScope(scope);
  const id = Number.parseInt(scope.id, 10) || 0;
  if (!id) return null;
  return db.prepare(`
    SELECT *
    FROM federatedLearningRounds
    WHERE id = @id AND tenantId = @tenantId AND branchId = @branchId
  `).get({ ...current, id }) || null;
}

export function listRounds(scope = {}) {
  const current = normalizeScope(scope);
  const limit = Math.min(100, Math.max(1, Number.parseInt(scope.limit, 10) || 25));
  return db.prepare(`
    SELECT *
    FROM federatedLearningRounds
    WHERE tenantId = @tenantId AND branchId = @branchId
    ORDER BY createdAt DESC, id DESC
    LIMIT @limit
  `).all({ ...current, limit });
}

export const federatedLearningRepo = {
  readiness,
  createRound,
  getRound,
  listRounds
};
