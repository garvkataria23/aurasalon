import { db } from "../db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS clvScores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    clientId INTEGER NOT NULL,
    predictedClvPaise INTEGER NOT NULL DEFAULT 0,
    currentValuePaise INTEGER NOT NULL DEFAULT 0,
    churnRisk REAL NOT NULL DEFAULT 0,
    acquisitionStage TEXT NOT NULL,
    recommendedDiscountBudgetPaise INTEGER NOT NULL DEFAULT 0,
    modelVersion TEXT DEFAULT 'manual_or_sidecar',
    computedAt INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_clvScores_scope
    ON clvScores(tenantId, branchId, clientId);
`);

const VALID_STAGES = new Set(["new", "growing", "mature", "declining", "at_risk"]);

function normalizeScope(scope = {}) {
  const tenantId = String(scope.tenantId || "").trim();
  const branchId = String(scope.branchId || "").trim();
  if (!tenantId || !branchId) throw new Error("tenantId and branchId are required");
  return { tenantId, branchId };
}

function normalizeScore(data = {}) {
  const current = normalizeScope(data);
  const stage = String(data.acquisitionStage || "growing").trim();
  return {
    ...current,
    clientId: Number.parseInt(data.clientId, 10) || 0,
    predictedClvPaise: Math.max(0, Math.round(Number(data.predictedClvPaise || 0))),
    currentValuePaise: Math.max(0, Math.round(Number(data.currentValuePaise || 0))),
    churnRisk: Math.max(0, Math.min(1, Number(data.churnRisk || 0))),
    acquisitionStage: VALID_STAGES.has(stage) ? stage : "growing",
    recommendedDiscountBudgetPaise: Math.max(0, Math.round(Number(data.recommendedDiscountBudgetPaise || 0))),
    modelVersion: String(data.modelVersion || "manual_or_sidecar")
  };
}

function parseScore(row) {
  if (!row) return null;
  return {
    ...row,
    predictedClvPaise: Number(row.predictedClvPaise || 0),
    currentValuePaise: Number(row.currentValuePaise || 0),
    churnRisk: Number(row.churnRisk || 0),
    recommendedDiscountBudgetPaise: Number(row.recommendedDiscountBudgetPaise || 0),
    computedAt: Number(row.computedAt || 0)
  };
}

export function upsertScore(data = {}) {
  const payload = normalizeScore(data);
  if (!payload.clientId) throw new Error("clientId is required");
  db.prepare(`
    INSERT INTO clvScores (
      tenantId, branchId, clientId, predictedClvPaise, currentValuePaise,
      churnRisk, acquisitionStage, recommendedDiscountBudgetPaise, modelVersion
    )
    VALUES (
      @tenantId, @branchId, @clientId, @predictedClvPaise, @currentValuePaise,
      @churnRisk, @acquisitionStage, @recommendedDiscountBudgetPaise, @modelVersion
    )
    ON CONFLICT(tenantId, branchId, clientId) DO UPDATE SET
      predictedClvPaise = excluded.predictedClvPaise,
      currentValuePaise = excluded.currentValuePaise,
      churnRisk = excluded.churnRisk,
      acquisitionStage = excluded.acquisitionStage,
      recommendedDiscountBudgetPaise = excluded.recommendedDiscountBudgetPaise,
      modelVersion = excluded.modelVersion,
      computedAt = strftime('%s','now')
  `).run(payload);
  return getScore(payload);
}

export function getScore(scope = {}) {
  const current = normalizeScope(scope);
  const clientId = Number.parseInt(scope.clientId, 10) || 0;
  if (!clientId) return null;
  return parseScore(db.prepare(`
    SELECT *
    FROM clvScores
    WHERE tenantId = @tenantId AND branchId = @branchId AND clientId = @clientId
  `).get({ ...current, clientId }));
}

export function getTopClvClients(scope = {}) {
  const current = normalizeScope(scope);
  const limit = Math.min(100, Math.max(1, Number.parseInt(scope.limit, 10) || 25));
  return db.prepare(`
    SELECT *
    FROM clvScores
    WHERE tenantId = @tenantId AND branchId = @branchId
    ORDER BY predictedClvPaise DESC, currentValuePaise DESC
    LIMIT @limit
  `).all({ ...current, limit }).map(parseScore);
}

export function getAtRiskClients(scope = {}) {
  const current = normalizeScope(scope);
  const limit = Math.min(100, Math.max(1, Number.parseInt(scope.limit, 10) || 25));
  const minCurrentValuePaise = Math.max(0, Math.round(Number(scope.minCurrentValuePaise || 0)));
  return db.prepare(`
    SELECT *
    FROM clvScores
    WHERE tenantId = @tenantId
      AND branchId = @branchId
      AND (acquisitionStage = 'at_risk' OR churnRisk >= 0.5)
      AND currentValuePaise >= @minCurrentValuePaise
    ORDER BY churnRisk DESC, currentValuePaise DESC
    LIMIT @limit
  `).all({ ...current, minCurrentValuePaise, limit }).map(parseScore);
}

export const clvRepo = {
  upsertScore,
  getScore,
  getTopClvClients,
  getAtRiskClients
};
