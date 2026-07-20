import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";
import { availabilityAugmentService } from "./availability-augment.service.js";

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
}

function day(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest("Invalid blackout date");
  return date.toISOString().slice(0, 10);
}

export const blackoutService = {
  isDateBlocked(tenantId, branchId, date, source = "online") {
    return availabilityAugmentService.isDateBlocked({ tenantId, branchId, date, source });
  },

  listBlackouts(access, { branchId = "", from = "", to = "" } = {}) {
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const start = from ? day(from) : "0000-01-01";
    const end = to ? day(to) : "9999-12-31";
    return db.prepare(
      `SELECT * FROM blackout_dates
       WHERE tenantId = ?
         AND (? = '' OR branchId = '' OR branchId = ?)
         AND blackoutDate <= ?
         AND COALESCE(blackoutUntil, blackoutDate) >= ?
       ORDER BY blackoutDate ASC`
    ).all(access.tenantId, branchId, branchId, end, start);
  },

  createBlackout(access, payload = {}) {
    const branchId = payload.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    if (!payload.blackoutDate && !payload.date) throw badRequest("blackoutDate is required");
    const row = {
      id: payload.id || makeId("blk"),
      tenantId: access.tenantId,
      branchId,
      blackoutDate: day(payload.blackoutDate || payload.date),
      blackoutUntil: payload.blackoutUntil ? day(payload.blackoutUntil) : null,
      reason: payload.reason || "Salon unavailable",
      blockOnline: payload.blockOnline === false ? 0 : 1,
      blockWalkin: payload.blockWalkin === false ? 0 : 1,
      allowExisting: payload.allowExisting ? 1 : 0,
      createdBy: access.userId || "system"
    };
    db.prepare(
      `INSERT INTO blackout_dates
       (id, tenantId, branchId, blackoutDate, blackoutUntil, reason, blockOnline, blockWalkin, allowExisting, createdBy)
       VALUES (@id, @tenantId, @branchId, @blackoutDate, @blackoutUntil, @reason, @blockOnline, @blockWalkin, @allowExisting, @createdBy)`
    ).run(row);
    return row;
  },

  deleteBlackout(access, id) {
    const row = db.prepare("SELECT * FROM blackout_dates WHERE id = ? AND tenantId = ?").get(id, access.tenantId);
    if (!row) throw notFound("Blackout not found");
    if (row.branchId) tenantService.assertBranchAccess(access, row.branchId);
    db.prepare("DELETE FROM blackout_dates WHERE id = ? AND tenantId = ?").run(id, access.tenantId);
    return { deleted: true };
  }
};

