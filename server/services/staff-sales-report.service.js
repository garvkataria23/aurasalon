import { repositories } from "../repositories/repository-registry.js";
import { staffOsService } from "./staff-os.service.js";
import { tenantService } from "./tenant.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const dayKey = (value = "") => String(value || "").slice(0, 10);
const normalizeKey = (value = "") => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const categoryLabels = {
  service: "Service",
  product: "Product",
  membership: "Membership",
  package: "Package",
  gift_card: "Gift card",
  custom: "Custom"
};

function inDateRange(row, from, to) {
  const key = dayKey(row.createdAt || row.created_at || row.invoiceDate || row.invoice_date || row.updatedAt || row.updated_at);
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

function readArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizedItemType(item = {}) {
  const raw = String(item.type || item.itemType || item.item_type || item.kind || item.category || "").toLowerCase();
  if (raw.includes("service")) return "service";
  if (raw.includes("product") || raw.includes("retail")) return "product";
  if (raw.includes("membership")) return "membership";
  if (raw.includes("package")) return "package";
  if (raw.includes("gift")) return "gift_card";
  return "custom";
}

function lineAmount(item = {}) {
  const direct = item.finalAmount ?? item.final_amount ?? item.totalAmount ?? item.total_amount ?? item.lineTotal ?? item.line_total ?? item.total ?? item.amount;
  if (direct !== undefined && direct !== null && direct !== "") return money(direct);
  const taxable = Number(item.taxableAmount ?? item.taxable_amount ?? 0);
  const gst = Number(item.gstAmount ?? item.gst_amount ?? item.taxAmount ?? item.tax_amount ?? 0);
  if (taxable || gst) return money(taxable + gst);
  return money(Number(item.price ?? item.rate ?? item.unitPrice ?? item.unit_price ?? 0) * Number(item.quantity || item.qty || 1));
}

function blankStaff(staffId, staffName = "") {
  return {
    staffId: staffId || "unassigned",
    staffName: staffName || (staffId ? staffId : "Unassigned"),
    totalRevenue: 0,
    itemCount: 0,
    serviceRevenue: 0,
    serviceCount: 0,
    productRevenue: 0,
    productCount: 0,
    membershipRevenue: 0,
    membershipCount: 0,
    packageRevenue: 0,
    packageCount: 0,
    giftCardRevenue: 0,
    giftCardCount: 0,
    customRevenue: 0,
    customCount: 0
  };
}

function staffDisplayName(row = {}) {
  return row.fullName || row.name || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.shortName || row.id || "";
}

function staffLookup(branchId, access = {}) {
  const staffById = new Map();
  for (const person of repositories.staff.list({ limit: 10000 }, { tenantId: access.tenantId })) {
    if (person?.id) staffById.set(person.id, { ...person, name: staffDisplayName(person) || person.name || person.id });
  }
  try {
    for (const person of staffOsService.listStaff({ branchId, status: "active", limit: 200 }, access)) {
      if (person?.id) staffById.set(person.id, { ...person, name: staffDisplayName(person) || person.id });
    }
  } catch {
    // Existing staff repository remains the fallback while Staff OS is being migrated.
  }
  return staffById;
}

function attributionRows(item = {}, sale = {}, amount = 0, staffById = new Map()) {
  const rawSplits = Array.isArray(item.staffSplits) ? item.staffSplits.filter((split) => split?.staffId) : [];
  if (rawSplits.length) {
    const totalShare = rawSplits.reduce((sum, split) => sum + Number(split.share || Number(split.percent || 0) / 100 || 0), 0);
    let allocated = 0;
    return rawSplits.map((split, index) => {
      const rawShare = Number(split.share || Number(split.percent || 0) / 100 || 0);
      const share = totalShare > 0 ? rawShare / totalShare : 1 / rawSplits.length;
      const splitAmount = index === rawSplits.length - 1 ? money(amount - allocated) : money(amount * share);
      allocated = money(allocated + splitAmount);
      const staffRecord = staffById.get(split.staffId);
      return {
        staffId: split.staffId,
        staffName: split.staffName || staffRecord?.name || split.staffId,
        amount: splitAmount,
        sharePercent: money(share * 100),
        sourceStaffId: rawSplits.length > 1 ? "split_attribution" : "line_item"
      };
    });
  }

  const staffId = item.staffId || item.staff_id || item.assignedStaffId || item.assigned_staff_id || sale.staffId || sale.staff_id || "";
  const staffRecord = staffById.get(staffId);
  return [{
    staffId: staffId || "unassigned",
    staffName: item.staffName || item.staff_name || item.assignedStaffName || item.assigned_staff_name || sale.staffName || sale.staff_name || staffRecord?.name || staffId || "Unassigned",
    amount,
    sharePercent: 100,
    sourceStaffId: (item.staffId || item.staff_id || item.assignedStaffId || item.assigned_staff_id) ? "line_item" : "invoice_fallback"
  }];
}

function addDocumentItems({ source, items, sourceType, staffMap, itemRows, staffById }) {
  let itemCount = 0;
  for (const item of items) {
    const type = normalizedItemType(item);
    const quantity = Number(item.quantity || item.qty || 1);
    const amount = lineAmount(item);
    if (!amount) continue;
    const splits = attributionRows(item, source, amount, staffById);

    for (const split of splits) {
      const key = split.staffId && split.staffId !== "unassigned"
        ? split.staffId
        : `name:${normalizeKey(split.staffName) || "unassigned"}`;

      if (!staffMap.has(key)) staffMap.set(key, blankStaff(key, split.staffName));
      const summary = staffMap.get(key);
      summary.staffName = split.staffName;
      summary.totalRevenue = money(summary.totalRevenue + split.amount);
      summary.itemCount += 1;

      const revenueKey = `${type === "gift_card" ? "giftCard" : type}Revenue`;
      const countKey = `${type === "gift_card" ? "giftCard" : type}Count`;
      if (revenueKey in summary) summary[revenueKey] = money(summary[revenueKey] + split.amount);
      if (countKey in summary) summary[countKey] += 1;

      itemRows.push({
        saleId: sourceType === "sale" ? source.id : source.saleId || "",
        invoiceId: sourceType === "invoice" ? source.id : source.invoiceId || "",
        date: dayKey(source.createdAt || source.created_at || source.invoiceDate || source.invoice_date || source.updatedAt || source.updated_at),
        branchId: source.branchId || source.branch_id || "",
        staffId: key,
        staffName: split.staffName,
        itemType: type,
        itemTypeLabel: categoryLabels[type] || "Item",
        itemName: item.name || item.itemName || item.item_name || item.id || "Item",
        quantity,
        price: Number(item.price || item.rate || item.unitPrice || item.unit_price || 0),
        lineAmount: amount,
        amount: split.amount,
        sharePercent: split.sharePercent,
        sourceStaffId: split.sourceStaffId,
        sourceType
      });
      itemCount += 1;
    }
  }
  return itemCount;
}

export class StaffSalesReportService {
  report(query = {}, access = {}) {
    const branchId = String(query.branchId || "").trim();
    if (branchId) tenantService.assertBranchAccess(access, branchId);

    const scope = tenantService.accessScope(access, "reports");
    const salesScope = { ...scope, ...(branchId ? { branchId } : {}) };
    const staffById = staffLookup(branchId, access);
    const from = String(query.from || query.dateFrom || "").slice(0, 10);
    const to = String(query.to || query.dateTo || "").slice(0, 10);

    const sales = repositories.sales
      .list({ limit: Number(query.limit || 10000) }, salesScope)
      .filter((sale) => inDateRange(sale, from, to));
    const invoices = repositories.invoices
      .list({ limit: Number(query.limit || 10000) }, salesScope)
      .filter((invoice) => inDateRange(invoice, from, to));

    const staffMap = new Map();
    const itemRows = [];
    const coveredInvoices = new Set();

    for (const sale of sales) {
      const saleItems = Array.isArray(sale.items) ? sale.items : [];
      if (addDocumentItems({ source: sale, items: saleItems, sourceType: "sale", staffMap, itemRows, staffById })) {
        if (sale.invoiceId) coveredInvoices.add(sale.invoiceId);
      }
    }

    for (const invoice of invoices) {
      if (coveredInvoices.has(invoice.id)) continue;
      const items = readArray(invoice.lineItems).length
        ? readArray(invoice.lineItems)
        : readArray(invoice.items || invoice.line_items || invoice.invoiceItems || invoice.invoice_items);
      addDocumentItems({ source: invoice, items, sourceType: "invoice", staffMap, itemRows, staffById });
    }

    const rows = [...staffMap.values()].sort((a, b) => b.totalRevenue - a.totalRevenue || a.staffName.localeCompare(b.staffName));
    const totals = rows.reduce((acc, row) => {
      acc.totalRevenue = money(acc.totalRevenue + row.totalRevenue);
      acc.itemCount += row.itemCount;
      acc.serviceRevenue = money(acc.serviceRevenue + row.serviceRevenue);
      acc.productRevenue = money(acc.productRevenue + row.productRevenue);
      acc.membershipRevenue = money(acc.membershipRevenue + row.membershipRevenue);
      acc.packageRevenue = money(acc.packageRevenue + row.packageRevenue);
      acc.giftCardRevenue = money(acc.giftCardRevenue + row.giftCardRevenue);
      acc.customRevenue = money(acc.customRevenue + row.customRevenue);
      return acc;
    }, {
      totalRevenue: 0,
      itemCount: 0,
      serviceRevenue: 0,
      productRevenue: 0,
      membershipRevenue: 0,
      packageRevenue: 0,
      giftCardRevenue: 0,
      customRevenue: 0
    });

    return {
      filters: { branchId, from, to },
      totals,
      staff: rows,
      items: itemRows.sort((a, b) => String(b.date).localeCompare(String(a.date)))
    };
  }
}

export const staffSalesReportService = new StaffSalesReportService();
