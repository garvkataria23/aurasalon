import { db } from "../db.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/app-error.js";
import { cashDrawerService } from "./cash-drawer.service.js";
import { billingService } from "./billing.service.js";
import { realtimeService } from "./realtime.service.js";
import { tenantService } from "./tenant.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

export class DailyClosingService {
  totals(branchId, closingDate, access = {}) {
    const payments = cashDrawerService.cashMovementTotals(branchId, access, closingDate);
    const invoices = db.prepare(
      `SELECT COUNT(*) AS count, SUM(grand_total) AS sales, SUM(discount_total) AS discounts,
              SUM(tax_total) AS taxes, SUM(tip_total) AS tips, SUM(due_amount) AS due
         FROM invoices
        WHERE tenant_id = @tenantId
          AND branch_id = @branchId
          AND status NOT IN ('draft', 'voided', 'cancelled')
          AND substr(created_at, 1, 10) = @closingDate`
    ).get({ tenantId: access.tenantId, branchId, closingDate });
    return {
      paymentTotals: payments.payments,
      refundTotal: payments.refundTotal,
      totalSales: money(invoices?.sales || 0),
      discountTotal: money(invoices?.discounts || 0),
      taxTotal: money(invoices?.taxes || 0),
      tipsTotal: money(invoices?.tips || 0),
      dueAmount: money(invoices?.due || 0),
      invoiceCount: Number(invoices?.count || 0)
    };
  }

  close(payload = {}, access = {}) {
    const branchId = payload.branch_id || payload.branchId || access.branchId;
    const closingDate = payload.closing_date || payload.closingDate || today();
    if (!branchId) throw badRequest("branchId is required");
    tenantService.assertBranchAccess(access, branchId);
    const existing = db.prepare("SELECT id FROM daily_closing WHERE tenant_id = ? AND branch_id = ? AND closing_date = ?").get(access.tenantId, branchId, closingDate);
    if (existing) throw conflict("Day is already closed");
    const totals = this.totals(branchId, closingDate, access);
    const openingCash = money(payload.opening_cash ?? payload.openingCash ?? 0);
    const closingCash = money(payload.closing_cash ?? payload.closingCash ?? openingCash + Number(totals.paymentTotals.cash || 0) - totals.refundTotal);
    const difference = money(closingCash - (openingCash + Number(totals.paymentTotals.cash || 0) - totals.refundTotal));
    if (difference !== 0 && !payload.reason) throw badRequest("Cash difference requires reason");
    const id = `close_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO daily_closing
        (id, tenant_id, branch_id, closing_date, total_sales, cash_total, upi_total, card_total,
         wallet_total, refund_total, discount_total, tax_total, tips_total, opening_cash,
         closing_cash, difference, closed_by, manager_approved_by, remarks, created_at)
       VALUES
        (@id, @tenantId, @branchId, @closingDate, @totalSales, @cashTotal, @upiTotal, @cardTotal,
         @walletTotal, @refundTotal, @discountTotal, @taxTotal, @tipsTotal, @openingCash,
         @closingCash, @difference, @closedBy, @managerApprovedBy, @remarks, CURRENT_TIMESTAMP)`
    ).run({
      id,
      tenantId: access.tenantId,
      branchId,
      closingDate,
      totalSales: totals.totalSales,
      cashTotal: money(totals.paymentTotals.cash || 0),
      upiTotal: money(totals.paymentTotals.upi || 0),
      cardTotal: money(totals.paymentTotals.card || 0),
      walletTotal: money(totals.paymentTotals.wallet || 0),
      refundTotal: totals.refundTotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      tipsTotal: totals.tipsTotal,
      openingCash,
      closingCash,
      difference,
      closedBy: access.userId || "",
      managerApprovedBy: payload.manager_approved_by || payload.managerApprovedBy || access.userId || "",
      remarks: payload.remarks || payload.reason || ""
    });
    this.lockInvoicesForDay(branchId, closingDate, access);
    realtimeService.broadcast("daily_closing:completed", { id, branchId, closingDate, totals }, { tenantId: access.tenantId, branchId });
    return this.get(closingDate, { branchId }, access);
  }

  lockInvoicesForDay(branchId, closingDate, access = {}) {
    const invoices = db.prepare(
      "SELECT id FROM invoices WHERE tenant_id = ? AND branch_id = ? AND substr(created_at, 1, 10) = ?"
    ).all(access.tenantId, branchId, closingDate);
    for (const invoice of invoices) {
      billingService.lockInvoiceInTransaction(invoice.id, access, "day_close_lock");
    }
    return invoices.length;
  }

  get(date, query = {}, access = {}) {
    const branchId = query.branchId || query.branch_id || access.branchId || "";
    const row = db.prepare(
      `SELECT * FROM daily_closing WHERE tenant_id = ? AND closing_date = ? ${branchId ? "AND branch_id = ?" : ""} ORDER BY created_at DESC LIMIT 1`
    ).get(...(branchId ? [access.tenantId, date, branchId] : [access.tenantId, date]));
    if (!row) throw notFound("Daily closing not found");
    return row;
  }

  report(query = {}, access = {}) {
    const where = ["tenant_id = @tenantId"];
    const params = { tenantId: access.tenantId };
    if (query.branchId || query.branch_id || access.branchId) {
      where.push("branch_id = @branchId");
      params.branchId = query.branchId || query.branch_id || access.branchId;
    }
    if (query.from) {
      where.push("closing_date >= @from");
      params.from = query.from;
    }
    if (query.to) {
      where.push("closing_date <= @to");
      params.to = query.to;
    }
    return db.prepare(`SELECT * FROM daily_closing WHERE ${where.join(" AND ")} ORDER BY closing_date DESC`).all(params);
  }

  reopen(id, access = {}) {
    if (!["owner", "admin"].includes(access.role)) throw forbidden("Reopening a closed day requires admin access");
    const row = db.prepare("SELECT * FROM daily_closing WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Daily closing not found");
    db.prepare("DELETE FROM daily_closing WHERE tenant_id = ? AND id = ?").run(access.tenantId, id);
    return { reopened: true, id };
  }
}

export const dailyClosingService = new DailyClosingService();
