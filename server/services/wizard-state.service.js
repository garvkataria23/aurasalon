import { db } from "../db.js";
import { badRequest } from "../utils/app-error.js";

function expiresAt() {
  return new Date(Date.now() + 30 * 60 * 1000).toISOString();
}

export const wizardStateService = {
  saveState(access, { sessionId, step, stateJson = {}, customerId = "" } = {}) {
    if (!sessionId || !step) throw badRequest("sessionId and step are required");
    const state = typeof stateJson === "string" ? stateJson : JSON.stringify(stateJson || {});
    const row = {
      sessionId,
      tenantId: access.tenantId,
      customerId,
      step: Number(step),
      stateJson: state,
      expiresAt: expiresAt()
    };
    db.prepare(
      `INSERT INTO booking_wizard_state (sessionId, tenantId, customerId, step, stateJson, expiresAt)
       VALUES (@sessionId, @tenantId, @customerId, @step, @stateJson, @expiresAt)
       ON CONFLICT(sessionId) DO UPDATE SET
         customerId = excluded.customerId,
         step = excluded.step,
         stateJson = excluded.stateJson,
         expiresAt = excluded.expiresAt,
         updatedAt = CURRENT_TIMESTAMP`
    ).run(row);
    return this.loadState(access, sessionId);
  },

  loadState(access, sessionId) {
    const row = db.prepare(
      "SELECT * FROM booking_wizard_state WHERE sessionId = ? AND tenantId = ? AND expiresAt > ?"
    ).get(sessionId, access.tenantId, new Date().toISOString());
    if (!row) return null;
    return { ...row, stateJson: JSON.parse(row.stateJson || "{}") };
  },

  clearState(access, sessionId) {
    const result = db.prepare("DELETE FROM booking_wizard_state WHERE sessionId = ? AND tenantId = ?").run(sessionId, access.tenantId);
    return { deleted: result.changes > 0 };
  },

  cleanupExpired() {
    return db.prepare("DELETE FROM booking_wizard_state WHERE expiresAt < ?").run(new Date().toISOString()).changes || 0;
  }
};

