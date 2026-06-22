import { db } from "../db.js";

function toMs(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function overlaps(startA, endA, startB, endB) {
  return toMs(startA) < toMs(endB) && toMs(startB) < toMs(endA);
}

export const availabilityAugmentService = {
  activeHolds({ tenantId, branchId, staffId = "", chairId = "", roomId = "", startTime, endTime, excludeHoldId = "" }) {
    const rows = db.prepare(
      `SELECT * FROM slot_reservations
       WHERE tenantId = ?
         AND branchId = ?
         AND status = 'holding'
         AND reservedUntil > ?
         AND id <> ?
       ORDER BY startTime ASC`
    ).all(tenantId, branchId, new Date().toISOString(), excludeHoldId || "__none__");
    return rows.filter((row) => {
      if (!overlaps(startTime, endTime, row.startTime, row.endTime)) return false;
      const sameStaff = staffId && row.staffId && row.staffId === staffId;
      const sameChair = chairId && row.chairId && row.chairId === chairId;
      const sameRoom = roomId && row.roomId && row.roomId === roomId;
      return sameStaff || sameChair || sameRoom || (!staffId && !chairId && !roomId);
    });
  },

  hasActiveHold(input) {
    return this.activeHolds(input).length > 0;
  },

  isDateBlocked({ tenantId, branchId = "", date, source = "online" }) {
    const day = new Date(date).toISOString().slice(0, 10);
    const rows = db.prepare(
      `SELECT * FROM blackout_dates
       WHERE tenantId = ?
         AND (branchId = '' OR branchId = ?)
         AND blackoutDate <= ?
         AND COALESCE(blackoutUntil, blackoutDate) >= ?`
    ).all(tenantId, branchId || "", day, day);
    return rows.find((row) => {
      if (source === "walkin") return Number(row.blockWalkin || 0) === 1;
      return Number(row.blockOnline || 0) === 1;
    }) || null;
  }
};

