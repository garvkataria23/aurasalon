import { db } from "../db.js";
import { notFound } from "../utils/app-error.js";

export class CouponAbuseService {
  recordUsage(payload = {}, access = {}) {
    const id = `cuse_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO coupon_usage
        (id, tenant_id, coupon_code, customer_id, invoice_id, discount_amount, used_at, branch_id, staff_id)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`
    ).run(id, access.tenantId, payload.coupon_code || payload.couponCode, payload.customer_id || payload.customerId || "", payload.invoice_id || payload.invoiceId || "", payload.discount_amount || payload.discountAmount || 0, payload.branch_id || payload.branchId || access.branchId || "", payload.staff_id || payload.staffId || "");
    this.detect(payload.coupon_code || payload.couponCode, payload.customer_id || payload.customerId || "", access);
    return { id };
  }

  detect(couponCode, customerId, access = {}) {
    const count = db.prepare("SELECT COUNT(*) AS count FROM coupon_usage WHERE tenant_id = ? AND coupon_code = ? AND customer_id = ?").get(access.tenantId, couponCode, customerId).count;
    if (count >= 3) this.createAlert({ couponCode, customerId, alertType: "coupon_reuse", severity: "critical", evidence: { count } }, access);
  }

  createAlert({ couponCode, customerId, alertType, severity, evidence }, access = {}) {
    const id = `calert_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO coupon_abuse_alerts
        (id, tenant_id, customer_id, coupon_code, alert_type, severity, evidence_json, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', CURRENT_TIMESTAMP)`
    ).run(id, access.tenantId, customerId, couponCode, alertType, severity, JSON.stringify(evidence || {}));
    return { id };
  }

  alerts(query = {}, access = {}) {
    return db.prepare("SELECT * FROM coupon_abuse_alerts WHERE tenant_id = ? AND status = COALESCE(NULLIF(?, ''), status) ORDER BY created_at DESC").all(access.tenantId, query.status || "");
  }

  resolve(id, payload = {}, access = {}) {
    const row = db.prepare("SELECT * FROM coupon_abuse_alerts WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Coupon abuse alert not found");
    db.prepare("UPDATE coupon_abuse_alerts SET status = 'resolved', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?").run(access.userId || "", access.tenantId, id);
    return { ...row, status: "resolved", note: payload.note || "" };
  }
}

export const couponAbuseService = new CouponAbuseService();
