import { db } from "../db.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/app-error.js";
import { billingService } from "./billing.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

export class DiscountApprovalService {
  request(payload = {}, access = {}) {
    const invoice = billingService.requireInvoice(payload.invoice_id || payload.invoiceId, access);
    if (invoice.payment_status === "paid") throw conflict("Paid invoice cannot receive new discount");
    const amount = money(payload.discount_amount || payload.discountAmount || 0);
    const id = `dreq_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO discount_approval_requests
        (id, tenant_id, branch_id, invoice_id, requested_by, discount_type, discount_value,
         discount_amount, reason, status, requested_at)
       VALUES
        (@id, @tenantId, @branchId, @invoiceId, @requestedBy, @discountType, @discountValue,
         @discountAmount, @reason, 'pending', CURRENT_TIMESTAMP)`
    ).run({
      id,
      tenantId: access.tenantId,
      branchId: invoice.branch_id,
      invoiceId: invoice.id,
      requestedBy: access.userId || "",
      discountType: payload.discount_type || payload.discountType || "amount",
      discountValue: Number(payload.discount_value || payload.discountValue || amount),
      discountAmount: amount,
      reason: payload.reason || "approval_required"
    });
    billingService.writeEvent({ tenantId: access.tenantId, invoiceId: invoice.id, eventType: "invoice.discount_requested", actorUserId: access.userId || "", payload: { requestId: id, amount } });
    return this.get(id, access);
  }

  get(id, access = {}) {
    const row = db.prepare("SELECT * FROM discount_approval_requests WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Discount approval request not found");
    return row;
  }

  pending(access = {}) {
    return db.prepare("SELECT * FROM discount_approval_requests WHERE tenant_id = ? AND status = 'pending' ORDER BY requested_at").all(access.tenantId);
  }

  approve(id, payload = {}, access = {}) {
    const row = this.get(id, access);
    if (row.requested_by === access.userId) throw forbidden("Staff cannot approve own discount request");
    if (!["owner", "admin", "manager"].includes(access.role)) throw forbidden("Manager approval required");
    if (Date.now() - new Date(row.requested_at).getTime() > 15 * 60 * 1000) throw conflict("Discount approval expired");
    db.prepare("UPDATE discount_approval_requests SET status = 'approved', approved_by = ?, decision_note = ?, decided_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .run(access.userId || "", payload.note || "", access.tenantId, id);
    billingService.writeEvent({ tenantId: access.tenantId, invoiceId: row.invoice_id, eventType: "invoice.discount_approved", actorUserId: access.userId || "", payload: { requestId: id } });
    return { ...row, status: "approved", approved_by: access.userId || "" };
  }

  reject(id, payload = {}, access = {}) {
    const row = this.get(id, access);
    db.prepare("UPDATE discount_approval_requests SET status = 'rejected', approved_by = ?, decision_note = ?, decided_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .run(access.userId || "", payload.note || "", access.tenantId, id);
    return { ...row, status: "rejected", decision_note: payload.note || "" };
  }
}

export const discountApprovalService = new DiscountApprovalService();
