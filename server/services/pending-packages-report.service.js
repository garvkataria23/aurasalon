import { resourceService } from "./resource.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const text = (value = "") => String(value || "").trim();
const dayKey = (value = "") => text(value).slice(0, 10);

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

function readObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function dateMs(value) {
  const parsed = Date.parse(text(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function inDateRange(value, from, to) {
  const key = dayKey(value);
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

function lower(value) {
  return text(value).toLowerCase();
}

function firstValue(row = {}, keys = []) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function recordId(row = {}) {
  return text(row.id || row.packageId || row.membershipId || "");
}

function clientId(row = {}) {
  return text(row.clientId || row.client_id || row.customerId || row.customer_id || "");
}

function clientName(row = {}) {
  return text(row.name || row.clientName || row.customerName || row.fullName || [row.firstName, row.lastName].filter(Boolean).join(" "));
}

function clientPhone(row = {}) {
  return text(row.phone || row.mobile || row.contact || row.whatsapp || row.clientPhone || row.customerPhone);
}

function packageName(row = {}) {
  return text(row.planName || row.name || row.packageName || "").replace(/^Package:\s*/i, "") || "Package";
}

function packageCredits(row = {}) {
  return [
    ...readArray(row.packageCredits || row.package_credits),
    ...readArray(row.serviceCredits || row.service_credits),
    ...readArray(row.creditsBreakdown || row.credits_breakdown)
  ];
}

function redemptionHistory(row = {}) {
  return [
    ...readArray(row.redeemHistory || row.redeem_history),
    ...readArray(row.redemptionHistory || row.redemption_history),
    ...readArray(row.usageHistory || row.usage_history)
  ];
}

function isPackageMembership(membership = {}) {
  const id = lower(membership.id || membership.membershipId);
  const planName = lower(membership.planName || membership.name);
  const credits = packageCredits(membership);
  const history = redemptionHistory(membership);
  return id.startsWith("pkgmem_")
    || planName.startsWith("package:")
    || credits.some((item) => text(item.packageId || item.package_id))
    || history.some((item) => text(item.packageId || item.package_id));
}

function packageForMembership(membership = {}, packagesById = new Map(), packagesByName = new Map()) {
  const directId = text(membership.packageId || membership.package_id || membership.planId || membership.plan_id);
  if (directId && packagesById.has(directId)) return packagesById.get(directId);
  for (const credit of packageCredits(membership)) {
    const packageId = text(credit.packageId || credit.package_id);
    if (packageId && packagesById.has(packageId)) return packagesById.get(packageId);
  }
  const name = lower(packageName(membership));
  return packagesByName.get(name) || {};
}

function totalCreditQty(credit = {}) {
  return money(credit.credits ?? credit.quantity ?? credit.qty ?? credit.total ?? credit.totalQty ?? credit.total_qty ?? 0);
}

function creditServiceId(credit = {}) {
  return text(credit.serviceId || credit.service_id || credit.id || "");
}

function creditServiceName(credit = {}) {
  return text(credit.serviceName || credit.service_name || credit.name || credit.label || "Service");
}

function redemptionQty(entry = {}) {
  return money(entry.creditsUsed ?? entry.credits_used ?? entry.usedCredits ?? entry.used_credits ?? entry.quantity ?? entry.qty ?? entry.credits ?? 0);
}

function redeemedQtyForCredit(credit = {}, history = [], totalCreditCount = 1) {
  const serviceId = creditServiceId(credit);
  const serviceName = lower(creditServiceName(credit));
  const matching = history.filter((entry) => {
    const entryServiceId = text(entry.serviceId || entry.service_id);
    const entryServiceName = lower(entry.serviceName || entry.service_name || entry.name);
    if (serviceId && entryServiceId) return serviceId === entryServiceId;
    if (serviceName && entryServiceName) return serviceName === entryServiceName;
    return totalCreditCount === 1;
  });
  return money(matching.reduce((sum, entry) => sum + redemptionQty(entry), 0));
}

function packagePrice(row = {}) {
  return money(row.packagePrice ?? row.price ?? row.sellingPrice ?? row.selling_price ?? row.amount ?? row.totalAmount ?? row.total_amount ?? 0);
}

function creditPrice(credit = {}, membership = {}, pkg = {}, totalCredits = 0) {
  const direct = firstValue(credit, ["unitPrice", "unit_price", "price", "servicePrice", "service_price", "amount"]);
  if (direct !== "") return money(direct);
  const membershipPrice = packagePrice(membership);
  const catalogPrice = packagePrice(pkg);
  const price = membershipPrice || catalogPrice;
  return totalCredits > 0 ? money(price / totalCredits) : money(price);
}

function saleDate(membership = {}) {
  return dayKey(firstValue(membership, ["soldDate", "saleDate", "invoiceDate", "createdAt", "startDate", "date"]));
}

function expiryDate(membership = {}) {
  return dayKey(firstValue(membership, ["expiredOn", "expiresOn", "expiryDate", "expiresAt", "validUntil", "endDate"]));
}

function invoiceId(membership = {}) {
  return text(firstValue(membership, ["invoiceId", "invoice_id", "saleId", "sale_id", "sourceInvoiceId"]));
}

function rowStatus(expiredOn = "", nowMs = Date.now()) {
  const expiryMs = dateMs(expiredOn);
  if (expiryMs && expiryMs < nowMs) return "expired";
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (expiryMs && expiryMs <= nowMs + thirtyDays) return "expiring";
  return "active";
}

function searchMatch(row = {}, search = "") {
  if (!search) return true;
  const haystack = [
    row.clientName,
    row.contact,
    row.packageName,
    row.serviceName,
    row.invoiceId
  ].join(" ").toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function packageSearchMatch(row = {}, search = "") {
  if (!search) return true;
  const haystack = [
    row.clientName,
    row.contact,
    row.packageName,
    row.invoiceId
  ].join(" ").toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function statusMatch(row = {}, status = "all") {
  if (!status || status === "all") return true;
  return row.status === status;
}

function buildSummary(rows = []) {
  return rows.reduce((summary, row) => {
    summary.totalService = money(summary.totalService + row.totalQty);
    summary.servicesAmount = money(summary.servicesAmount + row.price * row.totalQty);
    summary.pendingServicesAmount = money(summary.pendingServicesAmount + row.pendingServicesPrice);
    summary.pendingQty = money(summary.pendingQty + row.pendingQty);
    summary.redeemedQty = money(summary.redeemedQty + row.redeemedQty);
    if (row.status === "expiring") summary.expiringPackages += 1;
    if (row.status === "expired") summary.expiredPendingPackages += 1;
    return summary;
  }, {
    totalService: 0,
    servicesAmount: 0,
    pendingServicesAmount: 0,
    pendingQty: 0,
    redeemedQty: 0,
    expiringPackages: 0,
    expiredPendingPackages: 0
  });
}

function buildExpiredSummary(rows = []) {
  return rows.reduce((summary, row) => {
    summary.totalPackages += 1;
    summary.packagesAmount = money(summary.packagesAmount + row.price);
    summary.totalServices = money(summary.totalServices + row.totalServices);
    summary.pendingServices = money(summary.pendingServices + row.pendingServices);
    return summary;
  }, {
    totalPackages: 0,
    packagesAmount: 0,
    totalServices: 0,
    pendingServices: 0
  });
}

function buildCompletedSummary(rows = []) {
  const packageIds = new Set();
  const summary = rows.reduce((summary, row) => {
    summary.totalCompletedServices = money(summary.totalCompletedServices + row.totalQty);
    summary.totalServiceAmount = money(summary.totalServiceAmount + row.price * row.totalQty);
    summary.redeemedQty = money(summary.redeemedQty + row.redeemedQty);
    if (row.membershipId || row.id) packageIds.add(row.membershipId || row.id);
    return summary;
  }, {
    totalCompletedServices: 0,
    totalServiceAmount: 0,
    completedPackageCount: 0,
    redeemedQty: 0
  });
  summary.completedPackageCount = packageIds.size;
  return summary;
}

class PendingPackagesReportService {
  report(query = {}, access = {}) {
    const from = dayKey(query.from);
    const to = dayKey(query.to);
    const search = text(query.search);
    const status = lower(query.status || "all");
    const limit = Math.min(500, Math.max(1, Number(query.limit || 25)));
    const offset = Math.max(0, Number(query.offset || 0));
    const branchId = text(query.branchId || access.branchId);

    const listQuery = { limit: 10000, branchId };
    const memberships = resourceService.list("memberships", listQuery, access);
    const packages = resourceService.list("packages", listQuery, access);
    const clients = resourceService.list("clients", { limit: 10000, branchId, compact: 1 }, access);

    const clientsById = new Map(clients.map((client) => [recordId(client), client]));
    const packagesById = new Map(packages.map((pkg) => [recordId(pkg), pkg]));
    const packagesByName = new Map(packages.map((pkg) => [lower(packageName(pkg)), pkg]));
    const rows = [];

    for (const membership of memberships) {
      if (!isPackageMembership(membership)) continue;
      const date = saleDate(membership);
      if (!inDateRange(date, from, to)) continue;

      const pkg = packageForMembership(membership, packagesById, packagesByName);
      const credits = packageCredits(membership).length ? packageCredits(membership) : packageCredits(pkg);
      if (!credits.length) continue;

      const totalCredits = credits.reduce((sum, credit) => sum + totalCreditQty(credit), 0);
      const history = redemptionHistory(membership);
      const client = clientsById.get(clientId(membership)) || {};
      const expiredOn = expiryDate(membership);
      const statusValue = rowStatus(expiredOn);

      credits.forEach((credit, index) => {
        const totalQty = totalCreditQty(credit);
        if (totalQty <= 0) return;
        const redeemedQty = Math.min(totalQty, redeemedQtyForCredit(credit, history, credits.length));
        const pendingQty = money(Math.max(0, totalQty - redeemedQty));
        if (pendingQty <= 0) return;
        const price = creditPrice(credit, membership, pkg, totalCredits);
        const row = {
          id: `${recordId(membership)}:${creditServiceId(credit) || index}`,
          clientId: clientId(membership),
          clientName: clientName(client) || text(membership.clientName || membership.customerName) || "Walk-in Client",
          contact: clientPhone(client) || text(membership.contact || membership.phone || membership.clientPhone),
          packageId: recordId(pkg) || text(membership.packageId || membership.package_id),
          packageName: packageName(membership) || packageName(pkg),
          serviceId: creditServiceId(credit),
          serviceName: creditServiceName(credit),
          invoiceId: invoiceId(membership),
          price,
          totalQty,
          redeemedQty,
          pendingQty,
          pendingServicesPrice: money(pendingQty * price),
          date,
          expiredOn,
          status: statusValue
        };
        if (searchMatch(row, search) && statusMatch(row, status)) rows.push(row);
      });
    }

    const summary = buildSummary(rows);
    const total = rows.length;
    return {
      summary,
      rows: rows.slice(offset, offset + limit),
      total,
      limit,
      offset
    };
  }

  expired(query = {}, access = {}) {
    const from = dayKey(query.from);
    const to = dayKey(query.to);
    const search = text(query.search);
    const limit = Math.min(500, Math.max(1, Number(query.limit || 25)));
    const offset = Math.max(0, Number(query.offset || 0));
    const branchId = text(query.branchId || access.branchId);

    const listQuery = { limit: 10000, branchId };
    const memberships = resourceService.list("memberships", listQuery, access);
    const packages = resourceService.list("packages", listQuery, access);
    const clients = resourceService.list("clients", { limit: 10000, branchId, compact: 1 }, access);

    const clientsById = new Map(clients.map((client) => [recordId(client), client]));
    const packagesById = new Map(packages.map((pkg) => [recordId(pkg), pkg]));
    const packagesByName = new Map(packages.map((pkg) => [lower(packageName(pkg)), pkg]));
    const rows = [];

    for (const membership of memberships) {
      if (!isPackageMembership(membership)) continue;
      const expiredOn = expiryDate(membership);
      if (!expiredOn || rowStatus(expiredOn) !== "expired" || !inDateRange(expiredOn, from, to)) continue;

      const pkg = packageForMembership(membership, packagesById, packagesByName);
      const credits = packageCredits(membership).length ? packageCredits(membership) : packageCredits(pkg);
      if (!credits.length) continue;

      const totalServices = money(credits.reduce((sum, credit) => sum + totalCreditQty(credit), 0));
      if (totalServices <= 0) continue;

      const history = redemptionHistory(membership);
      const redeemedServices = money(credits.reduce((sum, credit) => {
        const totalQty = totalCreditQty(credit);
        return sum + Math.min(totalQty, redeemedQtyForCredit(credit, history, credits.length));
      }, 0));
      const client = clientsById.get(clientId(membership)) || {};
      const catalogPrice = packagePrice(pkg);
      const memberPrice = packagePrice(membership);
      const fallbackPrice = money(credits.reduce((sum, credit) => sum + (creditPrice(credit, membership, pkg, totalServices) * totalCreditQty(credit)), 0));
      const row = {
        id: recordId(membership) || `${clientId(membership)}:${packageName(membership)}:${expiredOn}`,
        clientId: clientId(membership),
        clientName: clientName(client) || text(membership.clientName || membership.customerName) || "Walk-in Client",
        contact: clientPhone(client) || text(membership.contact || membership.phone || membership.clientPhone),
        packageId: recordId(pkg) || text(membership.packageId || membership.package_id),
        packageName: packageName(membership) || packageName(pkg),
        invoiceId: invoiceId(membership),
        price: memberPrice || catalogPrice || fallbackPrice,
        totalServices,
        pendingServices: money(Math.max(0, totalServices - redeemedServices)),
        date: saleDate(membership),
        expiredOn
      };
      if (packageSearchMatch(row, search)) rows.push(row);
    }

    rows.sort((left, right) => {
      const byExpiry = dateMs(right.expiredOn) - dateMs(left.expiredOn);
      if (byExpiry) return byExpiry;
      return String(left.clientName || "").localeCompare(String(right.clientName || ""));
    });

    return {
      summary: buildExpiredSummary(rows),
      rows: rows.slice(offset, offset + limit),
      total: rows.length,
      limit,
      offset
    };
  }

  completed(query = {}, access = {}) {
    const from = dayKey(query.from);
    const to = dayKey(query.to);
    const search = text(query.search);
    const limit = Math.min(500, Math.max(1, Number(query.limit || 25)));
    const offset = Math.max(0, Number(query.offset || 0));
    const branchId = text(query.branchId || access.branchId);

    const listQuery = { limit: 10000, branchId };
    const memberships = resourceService.list("memberships", listQuery, access);
    const packages = resourceService.list("packages", listQuery, access);
    const clients = resourceService.list("clients", { limit: 10000, branchId, compact: 1 }, access);

    const clientsById = new Map(clients.map((client) => [recordId(client), client]));
    const packagesById = new Map(packages.map((pkg) => [recordId(pkg), pkg]));
    const packagesByName = new Map(packages.map((pkg) => [lower(packageName(pkg)), pkg]));
    const rows = [];

    for (const membership of memberships) {
      if (!isPackageMembership(membership)) continue;
      const date = saleDate(membership);
      if (!inDateRange(date, from, to)) continue;

      const pkg = packageForMembership(membership, packagesById, packagesByName);
      const credits = packageCredits(membership).length ? packageCredits(membership) : packageCredits(pkg);
      if (!credits.length) continue;

      const totalCredits = credits.reduce((sum, credit) => sum + totalCreditQty(credit), 0);
      const history = redemptionHistory(membership);
      const client = clientsById.get(clientId(membership)) || {};
      const expiredOn = expiryDate(membership);
      const statusValue = rowStatus(expiredOn);
      const membershipId = recordId(membership);

      credits.forEach((credit, index) => {
        const totalQty = totalCreditQty(credit);
        if (totalQty <= 0) return;
        const redeemedQty = Math.min(totalQty, redeemedQtyForCredit(credit, history, credits.length));
        const pendingQty = money(Math.max(0, totalQty - redeemedQty));
        if (pendingQty > 0) return;
        const price = creditPrice(credit, membership, pkg, totalCredits);
        const row = {
          id: `${membershipId}:${creditServiceId(credit) || index}`,
          membershipId,
          clientId: clientId(membership),
          clientName: clientName(client) || text(membership.clientName || membership.customerName) || "Walk-in Client",
          contact: clientPhone(client) || text(membership.contact || membership.phone || membership.clientPhone),
          packageId: recordId(pkg) || text(membership.packageId || membership.package_id),
          packageName: packageName(membership) || packageName(pkg),
          serviceId: creditServiceId(credit),
          serviceName: creditServiceName(credit),
          invoiceId: invoiceId(membership),
          price,
          totalQty,
          redeemedQty,
          pendingQty,
          date,
          expiredOn,
          status: statusValue
        };
        if (searchMatch(row, search)) rows.push(row);
      });
    }

    rows.sort((left, right) => {
      const byDate = dateMs(right.date) - dateMs(left.date);
      if (byDate) return byDate;
      return String(left.clientName || "").localeCompare(String(right.clientName || ""));
    });

    return {
      summary: buildCompletedSummary(rows),
      rows: rows.slice(offset, offset + limit),
      total: rows.length,
      limit,
      offset
    };
  }
}

export const pendingPackagesReportService = new PendingPackagesReportService();
export {
  buildCompletedSummary,
  buildExpiredSummary,
  buildSummary,
  creditPrice,
  isPackageMembership,
  redeemedQtyForCredit,
  totalCreditQty
};
