import { db } from "../db.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function tableExists(tableName) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = @tableName").get({ tableName })
  );
}

function columns(tableName) {
  if (!tableExists(tableName)) return [];
  return db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name);
}

function firstColumn(columnNames, candidates) {
  return candidates.find((candidate) => columnNames.includes(candidate)) || "";
}

function amountExpr(columnNames, decimalColumn, paiseColumn, alias = "") {
  const prefix = alias ? `${alias}.` : "";
  if (paiseColumn && columnNames.includes(paiseColumn)) return `COALESCE(NULLIF(${prefix}${paiseColumn}, 0), ROUND(COALESCE(${prefix}${decimalColumn}, 0) * 100)) / 100.0`;
  if (decimalColumn && columnNames.includes(decimalColumn)) return `COALESCE(${prefix}${decimalColumn}, 0)`;
  return "0";
}

function invoiceScope(query = {}, access = {}, alias = "") {
  const invoiceColumns = columns("invoices");
  const prefix = alias ? `${alias}.` : "";
  const tenantColumn = firstColumn(invoiceColumns, ["tenant_id", "tenantId"]);
  const branchColumn = firstColumn(invoiceColumns, ["branch_id", "branchId"]);
  const createdColumn = firstColumn(invoiceColumns, ["created_at", "createdAt", "date"]);
  const where = tenantColumn ? [`${prefix}${tenantColumn} = @tenantId`] : ["1 = 1"];
  const params = { tenantId: access.tenantId || query.tenantId || "" };

  const branchId = query.branchId || query.branch_id || access.branchId || "";
  if (branchId && branchColumn) {
    where.push(`${prefix}${branchColumn} = @branchId`);
    params.branchId = branchId;
  }
  if (query.from && createdColumn) {
    where.push(`substr(${prefix}${createdColumn}, 1, 10) >= @from`);
    params.from = query.from;
  }
  if (query.to && createdColumn) {
    where.push(`substr(${prefix}${createdColumn}, 1, 10) <= @to`);
    params.to = query.to;
  }
  return { where, params, invoiceColumns, tenantColumn, branchColumn, createdColumn };
}

function zeroMargin() {
  return {
    revenue: 0,
    productCost: 0,
    serviceConsumableCost: 0,
    staffCommission: 0,
    grossMargin: 0,
    grossMarginPct: 0
  };
}

export class BillingAnalyticsService {
  summary(query = {}, access = {}) {
    if (!tableExists("invoices")) {
      return { invoiceCount: 0, revenue: 0, avgBill: 0, refundRate: 0, discountPct: 0, taxCollected: 0, tips: 0, dueAmount: 0 };
    }
    const { where, params, invoiceColumns } = invoiceScope(query, access);
    const statusColumn = firstColumn(invoiceColumns, ["status"]);
    const statusFilter = statusColumn ? ` AND ${statusColumn} NOT IN ('draft', 'voided', 'cancelled')` : "";
    const grandTotal = amountExpr(invoiceColumns, "grand_total", "grand_total_paise");
    const refunds = amountExpr(invoiceColumns, "refund_amount", "refund_amount_paise");
    const discounts = amountExpr(invoiceColumns, "discount_total", "discount_total_paise");
    const taxes = amountExpr(invoiceColumns, "tax_total", "tax_total_paise");
    const tips = amountExpr(invoiceColumns, "tip_total", "tip_total_paise");
    const due = amountExpr(invoiceColumns, "due_amount", "due_amount_paise");
    const row = db.prepare(
      `SELECT COUNT(*) AS invoiceCount, SUM(${grandTotal}) AS revenue, AVG(${grandTotal}) AS avgBill,
              SUM(${refunds}) AS refunds, SUM(${discounts}) AS discounts, SUM(${taxes}) AS taxes,
              SUM(${tips}) AS tips, SUM(${due}) AS due
         FROM invoices
        WHERE ${where.join(" AND ")}${statusFilter}`
    ).get(params);
    return {
      invoiceCount: Number(row?.invoiceCount || 0),
      revenue: money(row?.revenue),
      avgBill: money(row?.avgBill),
      refundRate: row?.revenue ? money((Number(row.refunds || 0) / Number(row.revenue || 1)) * 100) : 0,
      discountPct: row?.revenue ? money((Number(row.discounts || 0) / Number(row.revenue || 1)) * 100) : 0,
      taxCollected: money(row?.taxes),
      tips: money(row?.tips),
      dueAmount: money(row?.due)
    };
  }

  paymentSplit(query = {}, access = {}) {
    if (!tableExists("invoices") || !tableExists("invoice_payments")) return [];
    const invoiceColumns = columns("invoices");
    const paymentColumns = columns("invoice_payments");
    const invoiceIdColumn = firstColumn(invoiceColumns, ["id"]);
    const paymentInvoiceColumn = firstColumn(paymentColumns, ["invoice_id", "invoiceId"]);
    const tenantColumn = firstColumn(invoiceColumns, ["tenant_id", "tenantId"]);
    const paymentTenantColumn = firstColumn(paymentColumns, ["tenant_id", "tenantId"]);
    const modeColumn = firstColumn(paymentColumns, ["payment_mode", "mode", "paymentMode"]);
    if (!invoiceIdColumn || !paymentInvoiceColumn || !tenantColumn || !paymentTenantColumn || !modeColumn) return [];
    const { where, params } = invoiceScope(query, access, "i");
    const amount = amountExpr(paymentColumns, "amount", "amount_paise", "ip");
    const statusColumn = firstColumn(paymentColumns, ["status"]);
    const statusFilter = statusColumn ? " AND ip.status = 'paid'" : "";
    return db.prepare(
      `SELECT ip.${modeColumn} AS mode, SUM(${amount}) AS amount, COUNT(*) AS count
         FROM invoice_payments ip
         JOIN invoices i ON i.${tenantColumn} = ip.${paymentTenantColumn} AND i.${invoiceIdColumn} = ip.${paymentInvoiceColumn}
        WHERE ${where.join(" AND ")}${statusFilter}
        GROUP BY ip.${modeColumn}
        ORDER BY amount DESC`
    ).all(params).map((row) => ({ ...row, amount: money(row.amount) }));
  }

  paymentModeReport(query = {}, access = {}) {
    if (!tableExists("invoices") || !tableExists("invoice_payments")) {
      return { from: query.from || "", to: query.to || "", total: 0, summary: [], rows: [] };
    }
    const invoiceColumns = columns("invoices");
    const paymentColumns = columns("invoice_payments");
    const invoiceIdColumn = firstColumn(invoiceColumns, ["id"]);
    const paymentInvoiceColumn = firstColumn(paymentColumns, ["invoice_id", "invoiceId"]);
    const invoiceTenantColumn = firstColumn(invoiceColumns, ["tenant_id", "tenantId"]);
    const paymentTenantColumn = firstColumn(paymentColumns, ["tenant_id", "tenantId"]);
    const branchColumn = firstColumn(invoiceColumns, ["branch_id", "branchId"]);
    const modeColumn = firstColumn(paymentColumns, ["payment_mode", "mode", "paymentMode"]);
    const paymentDateColumn = firstColumn(paymentColumns, ["paid_at", "paidAt", "created_at", "createdAt"]);
    if (!invoiceIdColumn || !paymentInvoiceColumn || !invoiceTenantColumn || !paymentTenantColumn || !modeColumn || !paymentDateColumn) {
      return { from: query.from || "", to: query.to || "", total: 0, summary: [], rows: [] };
    }

    const where = [`ip.${paymentTenantColumn} = @tenantId`];
    const params = {
      tenantId: access.tenantId || query.tenantId || "",
      from: String(query.from || new Date().toISOString().slice(0, 10)),
      to: String(query.to || query.from || new Date().toISOString().slice(0, 10))
    };
    where.push(`substr(ip.${paymentDateColumn}, 1, 10) >= @from`);
    where.push(`substr(ip.${paymentDateColumn}, 1, 10) <= @to`);

    const branchId = query.branchId || query.branch_id || access.branchId || "";
    if (branchId && branchColumn) {
      where.push(`i.${branchColumn} = @branchId`);
      params.branchId = branchId;
    }
    if (query.mode) {
      where.push(`ip.${modeColumn} = @mode`);
      params.mode = String(query.mode);
    }

    const statusColumn = firstColumn(paymentColumns, ["status"]);
    if (statusColumn) where.push(`COALESCE(ip.${statusColumn}, 'paid') = 'paid'`);

    const amount = amountExpr(paymentColumns, "amount", "amount_paise", "ip");
    const invoiceNoColumn = firstColumn(invoiceColumns, ["invoice_no", "invoiceNumber", "invoiceNo", "number"]);
    const clientColumn = firstColumn(invoiceColumns, ["customer_id", "customerId", "client_id", "clientId"]);
    const staffColumn = firstColumn(invoiceColumns, ["staff_id", "staffId"]);
    const totalColumn = firstColumn(invoiceColumns, ["grand_total", "grandTotal", "total"]);
    const paidColumn = firstColumn(invoiceColumns, ["paid_amount", "paidAmount"]);
    const dueColumn = firstColumn(invoiceColumns, ["due_amount", "dueAmount"]);
    const invoiceStatusColumn = firstColumn(invoiceColumns, ["status"]);
    const paymentStatusColumn = firstColumn(invoiceColumns, ["payment_status", "paymentStatus"]);
    const paymentIdColumn = firstColumn(paymentColumns, ["id"]);
    const referenceColumn = firstColumn(paymentColumns, ["reference_no", "referenceNo", "reference"]);
    const notesColumn = firstColumn(paymentColumns, ["notes", "remarks"]);

    const baseJoin = `FROM invoice_payments ip
         JOIN invoices i ON i.${invoiceTenantColumn} = ip.${paymentTenantColumn} AND i.${invoiceIdColumn} = ip.${paymentInvoiceColumn}
        WHERE ${where.join(" AND ")}`;
    const summary = db.prepare(
      `SELECT ip.${modeColumn} AS mode, SUM(${amount}) AS amount, COUNT(*) AS count, COUNT(DISTINCT i.${invoiceIdColumn}) AS invoiceCount
         ${baseJoin}
        GROUP BY ip.${modeColumn}
        ORDER BY amount DESC`
    ).all(params).map((row) => ({
      mode: String(row.mode || "unknown"),
      amount: money(row.amount),
      count: Number(row.count || 0),
      invoiceCount: Number(row.invoiceCount || 0)
    }));

    const rows = db.prepare(
      `SELECT ${paymentIdColumn ? `ip.${paymentIdColumn}` : "''"} AS paymentId,
              i.${invoiceIdColumn} AS invoiceId,
              ${invoiceNoColumn ? `i.${invoiceNoColumn}` : `i.${invoiceIdColumn}`} AS invoiceNo,
              ${clientColumn ? `i.${clientColumn}` : "''"} AS clientId,
              ${staffColumn ? `i.${staffColumn}` : "''"} AS staffId,
              ip.${modeColumn} AS mode,
              ${amount} AS amount,
              ip.${paymentDateColumn} AS paidAt,
              ${referenceColumn ? `ip.${referenceColumn}` : "''"} AS referenceNo,
              ${notesColumn ? `ip.${notesColumn}` : "''"} AS notes,
              ${statusColumn ? `ip.${statusColumn}` : "'paid'"} AS status,
              ${totalColumn ? `i.${totalColumn}` : "0"} AS invoiceTotal,
              ${paidColumn ? `i.${paidColumn}` : "0"} AS invoicePaid,
              ${dueColumn ? `i.${dueColumn}` : "0"} AS invoiceDue,
              ${invoiceStatusColumn ? `i.${invoiceStatusColumn}` : "''"} AS invoiceStatus,
              ${paymentStatusColumn ? `i.${paymentStatusColumn}` : "''"} AS paymentStatus
         ${baseJoin}
        ORDER BY ip.${paymentDateColumn} DESC, paymentId DESC
        LIMIT 1000`
    ).all(params).map((row) => ({
      ...row,
      amount: money(row.amount),
      invoiceTotal: money(row.invoiceTotal),
      invoicePaid: money(row.invoicePaid),
      invoiceDue: money(row.invoiceDue)
    }));

    return {
      from: params.from,
      to: params.to,
      total: money(summary.reduce((sum, row) => sum + Number(row.amount || 0), 0)),
      summary,
      rows
    };
  }

  margin(query = {}, access = {}) {
    if (!tableExists("invoices") || !tableExists("invoice_item_margins")) return zeroMargin();
    const invoiceColumns = columns("invoices");
    const marginColumns = columns("invoice_item_margins");
    const invoiceIdColumn = firstColumn(invoiceColumns, ["id"]);
    const marginInvoiceColumn = firstColumn(marginColumns, ["invoice_id", "invoiceId"]);
    const tenantColumn = firstColumn(invoiceColumns, ["tenant_id", "tenantId"]);
    const marginTenantColumn = firstColumn(marginColumns, ["tenant_id", "tenantId"]);
    if (!invoiceIdColumn || !marginInvoiceColumn || !tenantColumn || !marginTenantColumn) return zeroMargin();
    const { where, params } = invoiceScope(query, access, "i");
    const revenue = amountExpr(marginColumns, "revenue", "revenue_paise", "m");
    const productCost = amountExpr(marginColumns, "product_cost", "product_cost_paise", "m");
    const consumableCost = amountExpr(marginColumns, "service_consumable_cost", "service_consumable_cost_paise", "m");
    const commission = amountExpr(marginColumns, "staff_commission", "staff_commission_paise", "m");
    const grossMargin = amountExpr(marginColumns, "gross_margin", "gross_margin_paise", "m");
    const row = db.prepare(
      `SELECT SUM(${revenue}) AS revenue, SUM(${productCost}) AS productCost,
              SUM(${consumableCost}) AS serviceConsumableCost,
              SUM(${commission}) AS staffCommission, SUM(${grossMargin}) AS grossMargin
         FROM invoice_item_margins m
         JOIN invoices i ON i.${tenantColumn} = m.${marginTenantColumn} AND i.${invoiceIdColumn} = m.${marginInvoiceColumn}
        WHERE ${where.join(" AND ")}`
    ).get(params);
    const result = {
      revenue: money(row?.revenue),
      productCost: money(row?.productCost),
      serviceConsumableCost: money(row?.serviceConsumableCost),
      staffCommission: money(row?.staffCommission),
      grossMargin: money(row?.grossMargin)
    };
    return { ...result, grossMarginPct: result.revenue ? money((result.grossMargin / result.revenue) * 100) : 0 };
  }
}

export const billingAnalyticsService = new BillingAnalyticsService();
