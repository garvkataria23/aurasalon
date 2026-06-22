import { db } from "../db.js";
import { badRequest } from "../utils/app-error.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function safeJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function dateWhere(query = {}) {
  const where = [];
  const params = {};
  if (query.from) {
    where.push("substr(i.created_at, 1, 10) >= @from");
    params.from = query.from;
  }
  if (query.to) {
    where.push("substr(i.created_at, 1, 10) <= @to");
    params.to = query.to;
  }
  return { where, params };
}

function commissionRuleFor(staffId, tenantId) {
  const staff = db.prepare("SELECT * FROM staff WHERE tenantId = ? AND id = ?").get(tenantId, staffId);
  const staffRule = safeJson(staff?.commissionRule, {});
  const persisted = db.prepare(
    "SELECT * FROM commissions WHERE tenantId = ? AND staffId = ? AND status = 'active' ORDER BY createdAt DESC LIMIT 1"
  ).get(tenantId, staffId);
  return {
    servicePercent: Number(staffRule.servicePercent ?? persisted?.value ?? persisted?.servicePercent ?? 10),
    productPercent: Number(staffRule.retailPercent ?? staffRule.productPercent ?? persisted?.productPercent ?? 5),
    fixed: Number(staffRule.fixed ?? 0),
    target: Number(staffRule.target ?? 0),
    targetBonus: Number(staffRule.targetBonus ?? 0),
    tiers: safeJson(persisted?.tiers || staffRule.tiers, [])
  };
}

function tierPercent(basePercent, tiers = [], revenue = 0) {
  if (!Array.isArray(tiers) || !tiers.length) return basePercent;
  const matched = tiers
    .map((tier) => ({ min: Number(tier.min || tier.from || 0), percent: Number(tier.percent || tier.value || basePercent) }))
    .filter((tier) => revenue >= tier.min)
    .sort((a, b) => b.min - a.min)[0];
  return matched?.percent ?? basePercent;
}

export class StaffCommissionService {
  calculateInvoice(invoiceId, access = {}) {
    if (!invoiceId) throw badRequest("invoiceId is required");
    const items = db.prepare(
      `SELECT ii.*, i.branch_id, i.created_at
         FROM invoice_items ii
         JOIN invoices i ON i.tenant_id = ii.tenant_id AND i.id = ii.invoice_id
        WHERE ii.tenant_id = ? AND ii.invoice_id = ?`
    ).all(access.tenantId, invoiceId);
    return items.filter((item) => item.staff_id).map((item) => {
      const rule = commissionRuleFor(item.staff_id, access.tenantId);
      const basePercent = item.item_type === "product" ? rule.productPercent : rule.servicePercent;
      const percent = tierPercent(basePercent, rule.tiers, Number(item.taxable_amount || item.total_amount || 0));
      const variable = money(Number(item.taxable_amount || item.total_amount || 0) * (percent / 100));
      const fixed = money(rule.fixed || 0);
      const special = ["membership", "package"].includes(item.item_type) ? money(Number(item.total_amount || 0) * 0.03) : 0;
      return {
        invoiceId,
        invoiceItemId: item.id,
        staffId: item.staff_id,
        itemType: item.item_type,
        revenue: money(item.total_amount || 0),
        percent,
        variable,
        fixed,
        membershipPackageCommission: special,
        commission: money(variable + fixed + special)
      };
    });
  }

  staffReport(staffId, query = {}, access = {}) {
    if (!staffId) throw badRequest("staffId is required");
    const { where, params } = dateWhere(query);
    const rows = db.prepare(
      `SELECT ii.invoice_id AS invoiceId, ii.id AS invoiceItemId, ii.item_type AS itemType,
              ii.item_name AS itemName, ii.total_amount AS totalAmount, ii.taxable_amount AS taxableAmount,
              i.created_at AS createdAt
         FROM invoice_items ii
         JOIN invoices i ON i.tenant_id = ii.tenant_id AND i.id = ii.invoice_id
        WHERE ii.tenant_id = @tenantId
          AND ii.staff_id = @staffId
          AND i.status NOT IN ('draft', 'voided', 'cancelled')
          ${where.length ? `AND ${where.join(" AND ")}` : ""}
        ORDER BY i.created_at DESC`
    ).all({ tenantId: access.tenantId, staffId, ...params });
    const entries = rows.flatMap((row) => this.calculateInvoice(row.invoiceId, access).filter((entry) => entry.invoiceItemId === row.invoiceItemId));
    return {
      staffId,
      entries,
      totals: {
        revenue: money(entries.reduce((sum, entry) => sum + entry.revenue, 0)),
        commission: money(entries.reduce((sum, entry) => sum + entry.commission, 0))
      }
    };
  }

  summary(query = {}, access = {}) {
    const { where, params } = dateWhere(query);
    const branchFilter = query.branchId || query.branch_id || access.branchId || "";
    if (branchFilter) {
      where.push("i.branch_id = @branchId");
      params.branchId = branchFilter;
    }
    const staffRows = db.prepare(
      `SELECT DISTINCT ii.staff_id AS staffId
         FROM invoice_items ii
         JOIN invoices i ON i.tenant_id = ii.tenant_id AND i.id = ii.invoice_id
        WHERE ii.tenant_id = @tenantId
          AND ii.staff_id IS NOT NULL
          AND ii.staff_id <> ''
          ${where.length ? `AND ${where.join(" AND ")}` : ""}`
    ).all({ tenantId: access.tenantId, ...params });
    const rows = staffRows.map((row) => this.staffReport(row.staffId, query, access));
    return {
      rows,
      totals: {
        revenue: money(rows.reduce((sum, row) => sum + row.totals.revenue, 0)),
        commission: money(rows.reduce((sum, row) => sum + row.totals.commission, 0))
      }
    };
  }
}

export const staffCommissionService = new StaffCommissionService();
