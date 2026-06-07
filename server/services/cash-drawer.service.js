import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

export class CashDrawerService {
  current(branchId, access = {}) {
    const resolvedBranchId = branchId || access.branchId || "";
    if (!resolvedBranchId) throw badRequest("branchId is required");
    tenantService.assertBranchAccess(access, resolvedBranchId);
    return db.prepare(
      `SELECT *
         FROM cash_drawer_sessions
        WHERE tenant_id = ? AND branch_id = ? AND status = 'open'
        ORDER BY opened_at DESC LIMIT 1`
    ).get(access.tenantId, resolvedBranchId) || null;
  }

  open(payload = {}, access = {}) {
    const branchId = payload.branch_id || payload.branchId || access.branchId;
    if (!branchId) throw badRequest("branchId is required");
    tenantService.assertBranchAccess(access, branchId);
    if (this.current(branchId, access)) throw conflict("Cash drawer is already open");
    const id = `drawer_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO cash_drawer_sessions
        (id, tenant_id, branch_id, cashier_id, terminal_id, opening_cash, expected_cash, status, opened_at)
       VALUES
        (@id, @tenantId, @branchId, @cashierId, @terminalId, @openingCash, @openingCash, 'open', CURRENT_TIMESTAMP)`
    ).run({
      id,
      tenantId: access.tenantId,
      branchId,
      cashierId: payload.cashier_id || payload.cashierId || access.userId || "",
      terminalId: payload.terminal_id || payload.terminalId || "",
      openingCash: money(payload.opening_cash ?? payload.openingCash ?? 0)
    });
    return this.current(branchId, access);
  }

  cashMovementTotals(branchId, access = {}, businessDate = today()) {
    const payments = db.prepare(
      `SELECT payment_mode AS mode, SUM(amount) AS amount
         FROM invoice_payments ip
         JOIN invoices i ON i.tenant_id = ip.tenant_id AND i.id = ip.invoice_id
        WHERE ip.tenant_id = @tenantId
          AND i.branch_id = @branchId
          AND ip.status = 'paid'
          AND substr(ip.paid_at, 1, 10) = @businessDate
        GROUP BY payment_mode`
    ).all({ tenantId: access.tenantId, branchId, businessDate });
    const refunds = db.prepare(
      `SELECT SUM(ir.amount) AS amount
         FROM invoice_refunds ir
         JOIN invoices i ON i.tenant_id = ir.tenant_id AND i.id = ir.invoice_id
        WHERE ir.tenant_id = @tenantId
          AND i.branch_id = @branchId
          AND substr(ir.created_at, 1, 10) = @businessDate`
    ).get({ tenantId: access.tenantId, branchId, businessDate });
    return {
      payments: Object.fromEntries(payments.map((row) => [row.mode, money(row.amount)])),
      refundTotal: money(refunds?.amount || 0)
    };
  }

  close(payload = {}, access = {}) {
    const branchId = payload.branch_id || payload.branchId || access.branchId;
    const drawer = this.current(branchId, access);
    if (!drawer) throw notFound("No open cash drawer found");
    const businessDate = payload.business_date || payload.businessDate || today();
    const totals = this.cashMovementTotals(branchId, access, businessDate);
    const expectedCash = money(Number(drawer.opening_cash || 0) + Number(totals.payments.cash || 0) - Number(totals.refundTotal || 0));
    const closingCash = money(payload.closing_cash ?? payload.closingCash ?? expectedCash);
    const cashDifference = money(closingCash - expectedCash);
    if (cashDifference !== 0 && !payload.reason) throw badRequest("Cash mismatch requires reason");
    db.prepare(
      `UPDATE cash_drawer_sessions
          SET closing_cash = @closingCash,
              expected_cash = @expectedCash,
              cash_difference = @cashDifference,
              status = 'closed',
              closed_at = CURRENT_TIMESTAMP
        WHERE tenant_id = @tenantId AND id = @id`
    ).run({ closingCash, expectedCash, cashDifference, tenantId: access.tenantId, id: drawer.id });
    return { ...drawer, closing_cash: closingCash, expected_cash: expectedCash, cash_difference: cashDifference, status: "closed", paymentTotals: totals.payments, refundTotal: totals.refundTotal };
  }
}

export const cashDrawerService = new CashDrawerService();
