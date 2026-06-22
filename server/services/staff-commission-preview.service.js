import { repositories } from "../repositories/repository-registry.js";
import { staffOsService } from "./staff-os.service.js";
import { staffSalesReportService } from "./staff-sales-report.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

const defaultRule = {
  servicePercent: 10,
  productPercent: 5,
  membershipPercent: 3,
  packagePercent: 3,
  giftCardPercent: 0,
  customPercent: 0,
  fixedPerLine: 0,
  target: 0,
  targetBonus: 0,
  tiers: []
};

const categoryLabels = {
  service: "Service",
  product: "Product",
  membership: "Membership",
  package: "Package",
  gift_card: "Gift card",
  custom: "Custom"
};

function safeJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalType(type = "") {
  return String(type || "custom").trim().toLowerCase();
}

function percentFieldFor(type) {
  const key = normalType(type);
  if (key === "product") return "productPercent";
  if (key === "membership") return "membershipPercent";
  if (key === "package") return "packagePercent";
  if (key === "gift_card") return "giftCardPercent";
  if (key === "service") return "servicePercent";
  return "customPercent";
}

function tierPercent(basePercent, tiers = [], revenue = 0) {
  if (!Array.isArray(tiers) || !tiers.length) return basePercent;
  const matched = tiers
    .map((tier) => ({
      min: Number(tier.min ?? tier.from ?? tier.fromRevenue ?? 0),
      max: Number(tier.max ?? tier.to ?? tier.toRevenue ?? Number.MAX_SAFE_INTEGER),
      percent: Number(tier.percent ?? tier.value ?? tier.commissionPercent ?? basePercent)
    }))
    .filter((tier) => revenue >= tier.min && revenue <= tier.max)
    .sort((a, b) => b.min - a.min)[0];
  return matched?.percent ?? basePercent;
}

function persistedRuleFor(staffId, branchId, commissionRows = []) {
  return commissionRows
    .filter((row) => row.staffId === staffId)
    .filter((row) => !row.status || row.status === "active")
    .filter((row) => !branchId || !row.branchId || row.branchId === branchId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
}

function incentiveRuleFor(staff = {}) {
  const incentive = staff?.employeeDetails?.incentive || {};
  if (!incentive || !Object.keys(incentive).length) return {};
  const fixedPercent = Number(incentive.fixedIncentivePercent || 0);
  return {
    servicePercent: fixedPercent,
    productPercent: fixedPercent,
    membershipPercent: fixedPercent,
    packagePercent: fixedPercent,
    customPercent: fixedPercent,
    fixedPerLine: Number(incentive.fixedIncentiveAmount || 0),
    target: Number(incentive.target || 0),
    targetBonus: Number(incentive.targetBonus || 0),
    tiers: Array.isArray(incentive.targetSlabs) ? incentive.targetSlabs.map((slab) => ({
      min: Number(slab.fromAmount || slab.from || 0),
      max: Number(slab.toAmount || slab.to || Number.MAX_SAFE_INTEGER),
      percent: Number(slab.incentivePercent || slab.percent || fixedPercent)
    })) : []
  };
}

function staffDisplayName(row = {}) {
  return row.fullName || row.name || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.id || "";
}

function staffRowsForRules(branchId, access = {}) {
  const rows = new Map();
  for (const person of repositories.staff.list({ limit: 10000 }, { tenantId: access.tenantId })) {
    if (person?.id) rows.set(person.id, { ...person, name: staffDisplayName(person) || person.name || person.id });
  }
  try {
    for (const person of staffOsService.listStaff({ branchId, status: "active", limit: 200 }, access)) {
      if (person?.id) rows.set(person.id, { ...person, name: staffDisplayName(person) || person.id });
    }
  } catch {
    // Legacy commission rules remain usable if Staff OS is not available.
  }
  return [...rows.values()];
}

function ruleFor(staff, persisted, staffTotalRevenue) {
  const staffRule = {
    ...incentiveRuleFor(staff),
    ...safeJson(staff?.commissionRule, {})
  };
  const persistedRule = safeJson(persisted?.rule, {});
  const merged = {
    ...defaultRule,
    ...staffRule,
    ...persistedRule
  };

  merged.productPercent = Number(
    merged.productPercent ?? merged.retailPercent ?? persisted?.productPercent ?? defaultRule.productPercent
  );
  merged.servicePercent = Number(
    merged.servicePercent ?? persisted?.servicePercent ?? persisted?.value ?? defaultRule.servicePercent
  );
  merged.membershipPercent = Number(merged.membershipPercent ?? defaultRule.membershipPercent);
  merged.packagePercent = Number(merged.packagePercent ?? defaultRule.packagePercent);
  merged.giftCardPercent = Number(merged.giftCardPercent ?? defaultRule.giftCardPercent);
  merged.customPercent = Number(merged.customPercent ?? defaultRule.customPercent);
  merged.fixedPerLine = Number(merged.fixedPerLine ?? merged.fixed ?? persisted?.fixed ?? 0);
  merged.target = Number(merged.target ?? persisted?.target ?? 0);
  merged.targetBonus = Number(merged.targetBonus ?? persisted?.targetBonus ?? 0);
  merged.tiers = safeJson(persisted?.tiers || merged.tiers, []);

  const source = persisted ? "commission_rule" : Object.keys(staffRule).length ? "staff_profile" : "default";
  return {
    ...merged,
    source,
    name: persisted?.name || staffRule.name || "Default preview rule",
    effectiveServicePercent: tierPercent(Number(merged.servicePercent), merged.tiers, staffTotalRevenue),
    effectiveProductPercent: tierPercent(Number(merged.productPercent), merged.tiers, staffTotalRevenue)
  };
}

function percentForItem(type, rule, staffTotalRevenue) {
  const field = percentFieldFor(type);
  const base = Number(rule[field] ?? 0);
  return tierPercent(base, rule.tiers, staffTotalRevenue);
}

function blankStaff(row, rule) {
  return {
    staffId: row.staffId,
    staffName: row.staffName,
    revenue: 0,
    itemCount: 0,
    variableCommission: 0,
    fixedCommission: 0,
    targetBonus: 0,
    commission: 0,
    effectiveRate: 0,
    ruleName: rule.name,
    ruleSource: rule.source,
    serviceCommission: 0,
    productCommission: 0,
    membershipCommission: 0,
    packageCommission: 0,
    giftCardCommission: 0,
    customCommission: 0
  };
}

export class StaffCommissionPreviewService {
  preview(query = {}, access = {}) {
    const salesReport = staffSalesReportService.report(query, access);
    const branchId = salesReport.filters?.branchId || "";
    const staffRows = staffRowsForRules(branchId, access);
    const commissionRows = repositories.commissions.list({ limit: 10000 }, { tenantId: access.tenantId });
    const staffById = new Map(staffRows.map((person) => [person.id, person]));
    const salesByStaff = new Map((salesReport.staff || []).map((row) => [row.staffId, row]));
    const rulesByStaff = new Map();

    for (const row of salesReport.staff || []) {
      const staff = staffById.get(row.staffId);
      rulesByStaff.set(row.staffId, ruleFor(staff, persistedRuleFor(row.staffId, branchId, commissionRows), Number(row.totalRevenue || 0)));
    }

    const staffMap = new Map();
    const typeMap = new Map();
    const entries = [];

    for (const item of salesReport.items || []) {
      const staffSales = salesByStaff.get(item.staffId) || { totalRevenue: item.amount || 0, staffName: item.staffName };
      const rule = rulesByStaff.get(item.staffId) || ruleFor(staffById.get(item.staffId), persistedRuleFor(item.staffId, branchId, commissionRows), Number(staffSales.totalRevenue || 0));
      const percent = percentForItem(item.itemType, rule, Number(staffSales.totalRevenue || 0));
      const revenue = money(item.amount || 0);
      const variable = money(revenue * (percent / 100));
      const fixed = money(rule.fixedPerLine || 0);
      const commission = money(variable + fixed);

      if (!staffMap.has(item.staffId)) staffMap.set(item.staffId, blankStaff(item, rule));
      const staffSummary = staffMap.get(item.staffId);
      staffSummary.revenue = money(staffSummary.revenue + revenue);
      staffSummary.itemCount += 1;
      staffSummary.variableCommission = money(staffSummary.variableCommission + variable);
      staffSummary.fixedCommission = money(staffSummary.fixedCommission + fixed);
      staffSummary.commission = money(staffSummary.commission + commission);

      const commissionKey = `${item.itemType === "gift_card" ? "giftCard" : normalType(item.itemType)}Commission`;
      if (commissionKey in staffSummary) staffSummary[commissionKey] = money(staffSummary[commissionKey] + commission);

      const typeKey = normalType(item.itemType);
      if (!typeMap.has(typeKey)) {
        typeMap.set(typeKey, { itemType: typeKey, itemTypeLabel: categoryLabels[typeKey] || "Item", revenue: 0, commission: 0, itemCount: 0 });
      }
      const typeSummary = typeMap.get(typeKey);
      typeSummary.revenue = money(typeSummary.revenue + revenue);
      typeSummary.commission = money(typeSummary.commission + commission);
      typeSummary.itemCount += 1;

      entries.push({
        ...item,
        revenue,
        percent,
        variableCommission: variable,
        fixedCommission: fixed,
        commission,
        ruleName: rule.name,
        ruleSource: rule.source
      });
    }

    for (const row of staffMap.values()) {
      const sales = salesByStaff.get(row.staffId);
      const rule = rulesByStaff.get(row.staffId);
      if (rule?.target && row.revenue >= Number(rule.target) && Number(rule.targetBonus || 0) > 0) {
        row.targetBonus = money(rule.targetBonus);
        row.commission = money(row.commission + row.targetBonus);
      }
      row.effectiveRate = row.revenue > 0 ? money((row.commission / row.revenue) * 100) : 0;
      row.revenue = money(sales?.totalRevenue ?? row.revenue);
    }

    const staff = [...staffMap.values()].sort((a, b) => b.commission - a.commission || b.revenue - a.revenue);
    const totals = staff.reduce((acc, row) => {
      acc.revenue = money(acc.revenue + row.revenue);
      acc.itemCount += row.itemCount;
      acc.variableCommission = money(acc.variableCommission + row.variableCommission);
      acc.fixedCommission = money(acc.fixedCommission + row.fixedCommission);
      acc.targetBonus = money(acc.targetBonus + row.targetBonus);
      acc.commission = money(acc.commission + row.commission);
      return acc;
    }, { revenue: 0, itemCount: 0, variableCommission: 0, fixedCommission: 0, targetBonus: 0, commission: 0 });
    totals.effectiveRate = totals.revenue > 0 ? money((totals.commission / totals.revenue) * 100) : 0;
    totals.staffCount = staff.length;

    return {
      filters: salesReport.filters,
      assumptions: {
        mode: "preview_only",
        basis: "POS line-item amount",
        rulePriority: "active commission rule, staff profile rule, then default",
        defaultRule
      },
      totals,
      staff,
      typeTotals: [...typeMap.values()].sort((a, b) => b.commission - a.commission),
      entries
    };
  }
}

export const staffCommissionPreviewService = new StaffCommissionPreviewService();
