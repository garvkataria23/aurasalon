import { repositories } from "../repositories/repository-registry.js";
import { staffOsService } from "./staff-os.service.js";
import { tenantService } from "./tenant.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const dayKey = (value = "") => String(value || "").slice(0, 10);

const categoryLabels = {
  service: "Service",
  product: "Product",
  membership: "Membership",
  package: "Package",
  gift_card: "Gift card",
  custom: "Custom"
};

function inDateRange(row, from, to) {
  const key = dayKey(row.createdAt || row.updatedAt);
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
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

  const staffId = item.staffId || sale.staffId || "";
  const staffRecord = staffById.get(staffId);
  return [{
    staffId: staffId || "unassigned",
    staffName: item.staffName || staffRecord?.name || staffId || "Unassigned",
    amount,
    sharePercent: 100,
    sourceStaffId: item.staffId ? "line_item" : "invoice_fallback"
  }];
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

    const staffMap = new Map();
    const itemRows = [];

    for (const sale of sales) {
      const saleItems = Array.isArray(sale.items) ? sale.items : [];
      for (const item of saleItems) {
        const type = item.type || "custom";
        const quantity = Number(item.quantity || 1);
        const lineAmount = money(Number(item.price || 0) * quantity);
        const splits = attributionRows(item, sale, lineAmount, staffById);

        for (const split of splits) {
          const key = split.staffId || "unassigned";

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
            saleId: sale.id,
            invoiceId: sale.invoiceId || "",
            date: dayKey(sale.createdAt || sale.updatedAt),
            branchId: sale.branchId,
            staffId: key,
            staffName: split.staffName,
            itemType: type,
            itemTypeLabel: categoryLabels[type] || "Item",
            itemName: item.name || item.id || "Item",
            quantity,
            price: Number(item.price || 0),
            lineAmount,
            amount: split.amount,
            sharePercent: split.sharePercent,
            sourceStaffId: split.sourceStaffId
          });
        }
      }
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
