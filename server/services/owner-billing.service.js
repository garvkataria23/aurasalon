import { db } from "../db.js";
import { badRequest, forbidden, notFound } from "../utils/app-error.js";

const text = (value) => String(value ?? "").trim();
const lower = (value) => text(value).toLowerCase();
const jsonArray = (value) => { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.map(text).filter(Boolean) : []; } catch { return []; } };
const money = (row, paiseKey, rupeeKey) => {
  const paise = Number(row?.[paiseKey] || 0);
  const rupees = Number(row?.[rupeeKey] || 0);
  return Math.round(paise !== 0 || rupees === 0 ? paise : rupees * 100);
};

function ownerScope(access, requestedBranchId) {
  if (lower(access?.role) !== "owner") throw forbidden("Active owner access is required");
  const owner = db.prepare(`SELECT id, tenantId, role, status, branchIds FROM tenant_users
    WHERE tenantId = @tenantId AND id = @id`).get({ tenantId: text(access.tenantId), id: text(access.userId) });
  if (!owner || lower(owner.role) !== "owner" || lower(owner.status) !== "active") throw forbidden("Active owner access is required");
  const assigned = [...new Set(jsonArray(owner.branchIds))];
  if (!assigned.length) throw forbidden("This owner has no assigned branches");
  const requested = text(requestedBranchId || "all");
  if (requested.toLowerCase() !== "all" && !assigned.includes(requested)) throw forbidden("The requested branch is not assigned to this owner");
  const branchIds = requested.toLowerCase() === "all" ? assigned : [requested];
  const params = { tenantId: owner.tenantId };
  const slots = branchIds.map((branchId, index) => { params[`branch${index}`] = branchId; return `@branch${index}`; });
  return { tenantId: owner.tenantId, branchIds, branchSql: slots.join(", "), params };
}

function validDate(value, field) {
  const date = text(value);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest(`${field} must use YYYY-MM-DD format`);
  return date;
}

function invoiceView(row) {
  return {
    id: text(row.id), invoiceNumber: text(row.invoice_no), branchId: text(row.branch_id), branchName: text(row.branchName),
    customerId: text(row.customer_id), customerName: text(row.customerName), status: text(row.status), paymentStatus: text(row.payment_status),
    grandTotalPaise: money(row, "grand_total_paise", "grand_total"), paidAmountPaise: money(row, "paid_amount_paise", "paid_amount"),
    dueAmountPaise: money(row, "due_amount_paise", "due_amount"), currency: text(row.currency || "INR"),
    dueDate: text(row.due_date), createdAt: text(row.created_at), finalizedAt: text(row.finalized_at), updatedAt: text(row.updated_at)
  };
}

function itemView(row) {
  return {
    id: text(row.id), name: text(row.item_name), type: text(row.item_type), quantity: Number(row.quantity || 0),
    unitPricePaise: money(row, "unit_price_paise", "unit_price"), discountAmountPaise: money(row, "discount_amount_paise", "discount_amount"),
    taxAmountPaise: money(row, "tax_amount_paise", "tax_amount"), totalAmountPaise: money(row, "total_amount_paise", "total_amount")
  };
}

function paymentView(row) {
  return {
    id: text(row.id), method: text(row.payment_mode || row.mode), status: text(row.status), reference: text(row.reference_no || row.reference),
    amountPaise: money(row, "amount_paise", "amount"), paidAt: text(row.paid_at), createdAt: text(row.created_at)
  };
}

export const ownerBillingService = {
  listInvoices(access, query = {}) {
    const scope = ownerScope(access, query.branchId);
    const from = validDate(query.from, "from");
    const to = validDate(query.to, "to");
    if (from && to && from > to) throw badRequest("from must be on or before to");
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(query.pageSize, 10) || 25));
    const where = ["i.tenant_id = @tenantId", `i.branch_id IN (${scope.branchSql})`];
    const params = { ...scope.params };
    if (from) { where.push("substr(i.created_at, 1, 10) >= @from"); params.from = from; }
    if (to) { where.push("substr(i.created_at, 1, 10) <= @to"); params.to = to; }
    if (query.status) { where.push("lower(i.status) = @status"); params.status = lower(query.status); }
    if (query.paymentStatus) { where.push("lower(i.payment_status) = @paymentStatus"); params.paymentStatus = lower(query.paymentStatus); }
    if (query.search) {
      where.push("(lower(i.invoice_no) LIKE @search OR lower(COALESCE(c.name,'')) LIKE @search OR lower(i.id) LIKE @search)");
      params.search = `%${lower(query.search)}%`;
    }
    const whereSql = where.join(" AND ");
    const sort = { invoiceNumber: "i.invoice_no", grandTotalPaise: "COALESCE(NULLIF(i.grand_total_paise, 0), ROUND(i.grand_total * 100))", dueAmountPaise: "COALESCE(NULLIF(i.due_amount_paise, 0), ROUND(i.due_amount * 100))" }[text(query.sortBy)] || "i.created_at";
    const direction = lower(query.sortDirection) === "asc" ? "ASC" : "DESC";
    const rows = db.prepare(`SELECT i.*, b.name AS branchName, COALESCE(c.name,'') AS customerName
      FROM invoices i
      LEFT JOIN branches b ON b.id = i.branch_id AND b.tenantId = i.tenant_id
      LEFT JOIN clients c ON c.id = i.customer_id AND c.tenantId = i.tenant_id
      WHERE ${whereSql} ORDER BY ${sort} ${direction}, i.id ${direction} LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });
    const all = db.prepare(`SELECT i.*, COALESCE(c.name,'') AS customerName FROM invoices i
      LEFT JOIN clients c ON c.id = i.customer_id AND c.tenantId = i.tenant_id WHERE ${whereSql}`).all(params);
    const items = rows.map(invoiceView);
    const totals = all.map(invoiceView);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return {
      context: { branchId: text(query.branchId || "all"), branchIds: scope.branchIds, from, to, timezone: "Asia/Kolkata" },
      summary: {
        invoiceCount: totals.length,
        billedPaise: totals.reduce((sum, row) => sum + row.grandTotalPaise, 0),
        paidPaise: totals.reduce((sum, row) => sum + row.paidAmountPaise, 0),
        outstandingPaise: totals.reduce((sum, row) => sum + Math.max(0, row.dueAmountPaise), 0),
        overduePaise: totals.filter((row) => row.dueDate && row.dueDate < today).reduce((sum, row) => sum + Math.max(0, row.dueAmountPaise), 0)
      },
      items,
      page: { page, pageSize, total: totals.length, pages: Math.max(1, Math.ceil(totals.length / pageSize)), hasMore: page * pageSize < totals.length },
      capabilities: { viewDetail: true, recordPayment: false, createPaymentLink: false, sendReminder: false, refund: false, void: false, creditNote: false }
    };
  },

  invoice(invoiceId, access) {
    const scope = ownerScope(access, "all");
    const row = db.prepare(`SELECT i.*, b.name AS branchName, COALESCE(c.name,'') AS customerName FROM invoices i
      LEFT JOIN branches b ON b.id = i.branch_id AND b.tenantId = i.tenant_id
      LEFT JOIN clients c ON c.id = i.customer_id AND c.tenantId = i.tenant_id
      WHERE i.tenant_id = @tenantId AND i.id = @id`).get({ tenantId: scope.tenantId, id: text(invoiceId) });
    if (!row) throw notFound("Invoice not found");
    if (!scope.branchIds.includes(text(row.branch_id))) throw notFound("Invoice not found");
    const childParams = { tenantId: scope.tenantId, invoiceId: row.id };
    const items = db.prepare(`SELECT * FROM invoice_items WHERE tenant_id = @tenantId AND invoice_id = @invoiceId ORDER BY created_at, id`).all(childParams).map(itemView);
    const taxes = db.prepare(`SELECT id, tax_type AS type, tax_rate AS rate, tax_amount, tax_amount_paise FROM invoice_taxes WHERE tenant_id = @tenantId AND invoice_id = @invoiceId ORDER BY created_at, id`).all(childParams).map((tax) => ({ id: text(tax.id), type: text(tax.type), rate: Number(tax.rate || 0), amountPaise: money(tax, "tax_amount_paise", "tax_amount") }));
    const payments = db.prepare(`SELECT * FROM invoice_payments WHERE tenant_id = @tenantId AND invoice_id = @invoiceId ORDER BY created_at, id`).all(childParams).map(paymentView);
    const events = db.prepare(`SELECT id, event_type, actor_user_id, created_at FROM invoice_events WHERE tenant_id = @tenantId AND invoice_id = @invoiceId ORDER BY created_at DESC, id DESC LIMIT 100`).all(childParams).map((event) => ({ id: text(event.id), type: text(event.event_type), actorUserId: text(event.actor_user_id), createdAt: text(event.created_at) }));
    return { invoice: invoiceView(row), items, taxes, payments, events, capabilities: { recordPayment: false, createPaymentLink: false, sendReminder: false, refund: false, void: false, creditNote: false } };
  }
};
