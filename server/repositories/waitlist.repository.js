import { db } from "../db.js";
import { BaseRepository } from "./base.repository.js";

export class WaitlistRepository extends BaseRepository {
  constructor() {
    super("waitlist_entries");
  }

  list(query = {}, scope = {}) {
    const where = [];
    const params = { limit: Number(query.limit || 100) };
    if (scope.tenantId) {
      where.push("tenantId = @tenantId");
      params.tenantId = scope.tenantId;
    }
    if (scope.branchId || query.branchId) {
      where.push("branchId = @branchId");
      params.branchId = scope.branchId || query.branchId;
    }
    if (query.status) {
      where.push("status = @status");
      params.status = query.status;
    }
    const sql = `SELECT * FROM waitlist_entries${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY createdAt DESC LIMIT @limit`;
    return db.prepare(sql).all(params);
  }

  findMatchesForSlot(scope = {}, { serviceId = "", staffId = "", startAt = "", endAt = "" } = {}) {
    if (!scope.tenantId || !serviceId || !startAt || !endAt) return [];
    const where = [
      "tenantId = @tenantId",
      "status = 'waiting'",
      "serviceId = @serviceId",
      "windowStart < @endAt",
      "windowEnd > @startAt",
      "(staffId IS NULL OR staffId = '' OR staffId = @staffId)",
      "(preferredDate IS NULL OR preferredDate = '' OR preferredDate = @preferredDate)"
    ];
    const params = {
      tenantId: scope.tenantId,
      serviceId,
      staffId,
      startAt,
      endAt,
      preferredDate: String(startAt).slice(0, 10)
    };
    if (scope.branchId) {
      where.push("(branchId IS NULL OR branchId = '' OR branchId = @branchId)");
      params.branchId = scope.branchId;
    }
    return db
      .prepare(`SELECT * FROM waitlist_entries WHERE ${where.join(" AND ")} ORDER BY priority DESC, createdAt ASC`)
      .all(params);
  }
}
