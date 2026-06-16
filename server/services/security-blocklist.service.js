import { db } from "../db.js";
import { securityService } from "./security.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

function addMinutes(minutes) {
  return new Date(Date.now() + Number(minutes) * 60 * 1000).toISOString();
}

function rowToBlock(row) {
  return row || null;
}

function auditBlocklist({ action, record, access = {}, severity = "warning" }) {
  try {
    if (!record?.tenantId || !action) return;
    securityService.audit({
      action,
      targetType: "security_blocklist",
      targetId: record.id,
      severity,
      details: {
        ipAddress: record.ipAddress || "",
        userId: record.userId || "",
        reason: record.reason || "",
        blockedUntil: record.blockedUntil || "",
        status: record.status || ""
      }
    }, {
      tenantId: record.tenantId,
      branchId: record.branchId || access.branchId || "",
      userId: access.userId || record.userId || "",
      role: access.role || "system",
      branchIds: record.branchId ? [record.branchId] : []
    }, { ip: record.ipAddress || "", get: () => "" });
  } catch {
    // Audit failures should never break block/unblock behavior.
  }
}

export class SecurityBlocklistService {
  blockIpForAlert(alert) {
    if (!alert || alert.severity !== "critical" || !alert.ipAddress) return null;
    if (!["repeated_failed_login", "multiple_account_attack", "brute_force_suspected"].includes(alert.alertType)) return null;

    const recentCritical = db.prepare(`
      SELECT COUNT(*) count FROM security_alerts
      WHERE tenantId = ? AND ipAddress = ? AND severity = 'critical' AND createdAt >= ?
    `).get(alert.tenantId, alert.ipAddress, new Date(Date.now() - 60 * 60 * 1000).toISOString());

    const minutes = Number(recentCritical?.count || 0) >= 2 ? 60 : 15;
    return this.block({
      tenantId: alert.tenantId,
      branchId: alert.branchId || "",
      ipAddress: alert.ipAddress,
      userId: alert.userId || "",
      reason: `${alert.alertType}: ${alert.summary}`,
      severity: alert.severity,
      blockedUntil: addMinutes(minutes)
    });
  }

  block({ tenantId, branchId = "", ipAddress = "", userId = "", reason, severity = "warning", blockedUntil }) {
    if (!tenantId || (!ipAddress && !userId) || !reason || !blockedUntil) return null;
    const timestamp = now();
    const existing = db.prepare(`
      SELECT * FROM security_blocklist
      WHERE tenantId = ? AND status = 'active' AND
        ((? != '' AND ipAddress = ?) OR (? != '' AND userId = ?))
      ORDER BY blockedUntil DESC
      LIMIT 1
    `).get(tenantId, ipAddress, ipAddress, userId, userId);

    if (existing) {
      db.prepare(`
        UPDATE security_blocklist
        SET reason = ?, severity = ?, blockedUntil = ?, updatedAt = ?
        WHERE id = ? AND tenantId = ?
      `).run(reason, severity, blockedUntil, timestamp, existing.id, tenantId);
      const updated = this.getById(existing.id, { tenantId });
      auditBlocklist({ action: "security.blocklist.extended", record: updated, severity });
      return updated;
    }

    const record = {
      id: makeId("block"),
      tenantId,
      branchId,
      ipAddress,
      userId,
      reason,
      severity,
      blockedUntil,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_blocklist
      (id, tenantId, branchId, ipAddress, userId, reason, severity, blockedUntil, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @ipAddress, @userId, @reason, @severity, @blockedUntil, @status, @createdAt, @updatedAt)
    `).run(record);
    auditBlocklist({ action: "security.blocklist.created", record, severity });
    return record;
  }

  expireOldBlocks() {
    db.prepare(`
      UPDATE security_blocklist
      SET status = 'expired', updatedAt = ?
      WHERE status = 'active' AND blockedUntil <= ?
    `).run(now(), now());
  }

  findActiveBlock({ tenantId = "", ipAddress = "", userId = "" }) {
    this.expireOldBlocks();
    if (!ipAddress && !userId) return null;
    const params = [now(), ipAddress, ipAddress, userId, userId];
    let tenantSql = "";
    if (tenantId) {
      tenantSql = "AND tenantId = ?";
      params.push(tenantId);
    }
    return rowToBlock(db.prepare(`
      SELECT * FROM security_blocklist
      WHERE status = 'active'
        AND blockedUntil > ?
        AND ((? != '' AND ipAddress = ?) OR (? != '' AND userId = ?))
        ${tenantSql}
      ORDER BY blockedUntil DESC
      LIMIT 1
    `).get(...params));
  }

  list(query = {}, access = {}) {
    this.expireOldBlocks();
    const limit = Math.min(Number(query.limit || 100), 500);
    const status = String(query.status || "active").trim();
    const params = [access.tenantId];
    const where = ["tenantId = ?"];
    if (access.branchId) {
      where.push("(branchId = '' OR branchId = ?)");
      params.push(access.branchId);
    }
    if (status) {
      where.push("status = ?");
      params.push(status);
    }
    params.push(limit);
    return db.prepare(`
      SELECT * FROM security_blocklist
      WHERE ${where.join(" AND ")}
      ORDER BY updatedAt DESC
      LIMIT ?
    `).all(...params);
  }

  unblock(id, access = {}) {
    const existing = this.getById(id, access);
    const timestamp = now();
    const result = db.prepare(`
      UPDATE security_blocklist
      SET status = 'unblocked', updatedAt = ?
      WHERE id = ? AND tenantId = ?
    `).run(timestamp, id, access.tenantId);
    if (result.changes > 0 && existing) {
      auditBlocklist({
        action: "security.blocklist.unblocked",
        record: { ...existing, status: "unblocked" },
        access,
        severity: "info"
      });
    }
    return { id, unblocked: result.changes > 0 };
  }

  getById(id, access = {}) {
    return rowToBlock(db.prepare("SELECT * FROM security_blocklist WHERE id = ? AND tenantId = ?").get(id, access.tenantId));
  }
}

export const securityBlocklistService = new SecurityBlocklistService();
