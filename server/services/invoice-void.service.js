import { db } from "../db.js";
import { badRequest, conflict, forbidden } from "../utils/app-error.js";
import { billingService } from "./billing.service.js";
import { billingInventoryService } from "./billing-inventory.service.js";
import { balanceSheetService } from "./balance-sheet.service.js";
import { realtimeService } from "./realtime.service.js";

function isSameDay(value) {
  return String(value || "").slice(0, 10) === new Date().toISOString().slice(0, 10);
}

export class InvoiceVoidService {
  voidInvoice(invoiceId, payload = {}, access = {}) {
    const invoice = billingService.requireInvoice(invoiceId, access);
    if (!payload.reason) throw badRequest("Void reason is required");
    if (!["owner", "admin", "manager"].includes(access.role)) throw forbidden("Manager approval is required to void invoice");
    if (invoice.status !== "draft" && !isSameDay(invoice.created_at)) throw conflict("Only draft or same-day invoices can be voided");

    const txn = db.transaction(() => {
      const rollback = billingInventoryService.rollbackInvoice(invoiceId, access);
      db.prepare(
        `INSERT INTO invoice_voids
          (id, tenant_id, invoice_id, reason, old_invoice_json, inventory_rollback_done,
           commission_rollback_done, approved_by, voided_by, created_at)
         VALUES
          (@id, @tenantId, @invoiceId, @reason, @oldInvoiceJson, 1, 1, @approvedBy, @voidedBy, CURRENT_TIMESTAMP)`
      ).run({
        id: `void_${crypto.randomUUID().slice(0, 12)}`,
        tenantId: access.tenantId,
        invoiceId,
        reason: payload.reason,
        oldInvoiceJson: JSON.stringify(invoice),
        approvedBy: payload.approved_by || payload.approvedBy || access.userId || "",
        voidedBy: access.userId || ""
      });
      db.prepare(
        `UPDATE invoices
            SET status = 'voided',
                voided_by = @voidedBy,
                void_reason = @reason,
                voided_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
          WHERE tenant_id = @tenantId AND id = @invoiceId`
      ).run({ voidedBy: access.userId || "", reason: payload.reason, tenantId: access.tenantId, invoiceId });
      billingService.writeEvent({
        tenantId: access.tenantId,
        invoiceId,
        eventType: "invoice.voided",
        actorUserId: access.userId || "",
        payload: { reason: payload.reason, rollback }
      });
      try {
        balanceSheetService.enqueueInvoiceVoidEvent({ invoice, reason: payload.reason, mode: payload.mode || payload.paymentMode || "", access });
      } catch {
        billingService.writeEvent({
          tenantId: access.tenantId,
          invoiceId,
          eventType: "finance.gl_enqueue_failed",
          actorUserId: access.userId || "",
          payload: { reason: payload.reason }
        });
      }
      realtimeService.broadcast("invoice:voided", { invoiceId, reason: payload.reason }, { tenantId: access.tenantId, branchId: invoice.branch_id });
      realtimeService.broadcast("audit:sensitive_action", { action: "invoice.voided", invoiceId, reason: payload.reason }, { tenantId: access.tenantId, branchId: invoice.branch_id });
      return billingService.getInvoice(invoiceId, access);
    });
    return txn();
  }
}

export const invoiceVoidService = new InvoiceVoidService();
