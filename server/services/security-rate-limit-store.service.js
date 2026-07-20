import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { ensureSecurityRateLimitSchema } from "./security-rate-limit-schema.service.js";

const nowIso = () => new Date().toISOString();
const makeId = () => `rl_${randomUUID().slice(0, 10)}`;

function clean(value) {
  return String(value || "").slice(0, 240);
}

export class SecurityRateLimitStore {
  hit({ tenantId = "public", branchId = "", scope, bucketKey, windowMs }) {
    ensureSecurityRateLimitSchema();
    const currentMs = Date.now();
    const currentIso = new Date(currentMs).toISOString();
    const resetIso = new Date(currentMs + windowMs).toISOString();
    const params = {
      tenantId: clean(tenantId) || "public",
      branchId: clean(branchId),
      scope: clean(scope),
      bucketKey: clean(bucketKey),
      resetAt: resetIso,
      updatedAt: currentIso
    };

    const hitWindow = db.transaction(() => {
      const existing = db.prepare(`
        SELECT id, count, resetAt FROM security_rate_limit_windows
        WHERE tenantId = @tenantId AND branchId = @branchId AND scope = @scope AND bucketKey = @bucketKey
      `).get(params);

      if (!existing || String(existing.resetAt || "") <= currentIso) {
        const id = existing?.id || makeId();
        if (existing) {
          db.prepare(`
            UPDATE security_rate_limit_windows
            SET count = 1, resetAt = @resetAt, updatedAt = @updatedAt
            WHERE id = @id AND tenantId = @tenantId
          `).run({ ...params, id });
        } else {
          db.prepare(`
            INSERT INTO security_rate_limit_windows
              (id, tenantId, branchId, scope, bucketKey, count, resetAt, updatedAt)
            VALUES
              (@id, @tenantId, @branchId, @scope, @bucketKey, 1, @resetAt, @updatedAt)
          `).run({ ...params, id });
        }
        return { count: 1, resetAt: resetIso };
      }

      const count = Number(existing.count || 0) + 1;
      db.prepare(`
        UPDATE security_rate_limit_windows
        SET count = @count, updatedAt = @updatedAt
        WHERE id = @id AND tenantId = @tenantId
      `).run({ id: existing.id, tenantId: params.tenantId, count, updatedAt: currentIso });
      return { count, resetAt: existing.resetAt };
    });

    if (Math.random() < 0.01) this.sweepExpired();
    return hitWindow();
  }

  sweepExpired() {
    ensureSecurityRateLimitSchema();
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    db.prepare("DELETE FROM security_rate_limit_windows WHERE resetAt < @cutoff").run({ cutoff });
  }
}

export const securityRateLimitStore = new SecurityRateLimitStore();
