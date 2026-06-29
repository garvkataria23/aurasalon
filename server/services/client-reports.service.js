import { DEFAULT_TENANT_ID, db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { notFound } from "../utils/app-error.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const clampInt = (value, fallback, min, max) => Math.min(max, Math.max(min, Number.parseInt(value, 10) || fallback));
const invalidStatuses = "('void','voided','cancelled','canceled','deleted')";

const invoiceDateExpr = "COALESCE(NULLIF(i.createdAt, ''), NULLIF(i.created_at, ''), NULLIF(i.updatedAt, ''), NULLIF(i.updated_at, ''))";
const invoiceBranchExpr = "COALESCE(NULLIF(i.branchId, ''), NULLIF(i.branch_id, ''), NULLIF(s.branchId, ''), NULLIF(c.branchId, ''))";
const invoiceTotalExpr = "COALESCE(NULLIF(i.grand_total, 0), NULLIF(i.total, 0), 0)";
const invoicePaidExpr = "CASE WHEN COALESCE(i.paid_amount, 0) > 0 THEN i.paid_amount ELSE COALESCE(i.paid, 0) END";
const invoiceBalanceExpr = "CASE WHEN COALESCE(i.due_amount, 0) > 0 THEN i.due_amount WHEN COALESCE(i.balance_due, 0) > 0 THEN i.balance_due ELSE COALESCE(i.balance, 0) END";
const invoiceStatusExpr = "LOWER(COALESCE(NULLIF(i.status, ''), NULLIF(i.payment_status, ''), 'open'))";

function tenantId(access = {}) {
  return access.tenantId || DEFAULT_TENANT_ID;
}

function branchFrom(query = {}, access = {}) {
  const branchLimited = ["staff", "frontDesk"].includes(access.role);
  const branchId = String(query.branchId || access.requestedBranchId || (branchLimited ? access.branchId : "") || "");
  if (branchId) tenantService.assertBranchAccess(access, branchId);
  return branchId;
}

function clientWhere(branchId) {
  return [
    "c.tenantId = @tenantId",
    "(c.deletedAt IS NULL OR c.deletedAt = '')",
    branchId ? "c.branchId = @branchId" : ""
  ].filter(Boolean).join(" AND ");
}

function invoiceWhere(branchId) {
  return [
    "i.tenantId = @tenantId",
    `${invoiceStatusExpr} NOT IN ${invalidStatuses}`,
    branchId ? `${invoiceBranchExpr} = @branchId` : ""
  ].filter(Boolean).join(" AND ");
}

function saleWhere(branchId, alias = "s") {
  return [
    `${alias}.tenantId = @tenantId`,
    `LOWER(COALESCE(${alias}.status, 'completed')) NOT IN ${invalidStatuses}`,
    branchId ? `${alias}.branchId = @branchId` : ""
  ].filter(Boolean).join(" AND ");
}

function statsCte(branchId) {
  return `
    WITH invoice_stats AS (
      SELECT
        i.clientId,
        COUNT(DISTINCT i.id) AS invoiceCount,
        COALESCE(SUM(${invoiceTotalExpr}), 0) AS invoiceSpend,
        COALESCE(SUM(${invoicePaidExpr}), 0) AS paidAmount,
        COALESCE(SUM(${invoiceBalanceExpr}), 0) AS outstandingBalance,
        MAX(${invoiceDateExpr}) AS lastInvoiceAt
      FROM invoices i
      LEFT JOIN sales s ON s.id = i.saleId AND s.tenantId = i.tenantId
      LEFT JOIN clients c ON c.id = i.clientId AND c.tenantId = i.tenantId
      WHERE ${invoiceWhere(branchId)}
      GROUP BY i.clientId
    ),
    sale_stats AS (
      SELECT
        s.clientId,
        COUNT(DISTINCT s.id) AS saleCount,
        MAX(s.createdAt) AS lastSaleAt
      FROM sales s
      WHERE ${saleWhere(branchId)}
      GROUP BY s.clientId
    ),
    client_stats AS (
      SELECT
        c.id,
        c.name,
        c.phone,
        c.email,
        c.gender,
        c.birthday,
        c.anniversary,
        c.tags,
        c.branchId,
        c.createdAt,
        c.lastVisitAt,
        COALESCE(i.invoiceCount, 0) AS invoiceCount,
        COALESCE(s.saleCount, 0) AS saleCount,
        MAX(COALESCE(NULLIF(i.lastInvoiceAt, ''), ''), COALESCE(NULLIF(s.lastSaleAt, ''), ''), COALESCE(NULLIF(c.lastVisitAt, ''), '')) AS computedLastVisitAt,
        COALESCE(NULLIF(i.invoiceSpend, 0), NULLIF(c.totalSpend, 0), 0) AS monetary,
        COALESCE(i.paidAmount, 0) AS paidAmount,
        COALESCE(i.outstandingBalance, 0) AS outstandingBalance,
        MAX(COALESCE(i.invoiceCount, 0), COALESCE(s.saleCount, 0), COALESCE(c.visitCount, 0)) AS frequency
      FROM clients c
      LEFT JOIN invoice_stats i ON i.clientId = c.id
      LEFT JOIN sale_stats s ON s.clientId = c.id
      WHERE ${clientWhere(branchId)}
    )
  `;
}

function normalizeStat(row = {}) {
  const lastVisitAt = row.computedLastVisitAt || row.lastVisitAt || "";
  const daysSinceLastVisit = lastVisitAt
    ? Math.max(0, Math.floor((Date.now() - new Date(lastVisitAt).getTime()) / 86400000))
    : 999;
  return {
    ...row,
    name: clientDisplayName(row),
    frequency: Number(row.frequency || 0),
    monetary: money(row.monetary),
    paidAmount: money(row.paidAmount),
    outstandingBalance: money(row.outstandingBalance),
    lastVisitAt,
    daysSinceLastVisit
  };
}

function nextOccurrence(rawDate, now = new Date()) {
  if (!rawDate) return null;
  const parts = String(rawDate).slice(0, 10).split("-");
  if (parts.length !== 3) return null;
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), month, day);
  if (next < today) next = new Date(now.getFullYear() + 1, month, day);
  const daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000);
  return {
    nextDate: next.toISOString().slice(0, 10),
    daysUntil
  };
}

function readJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function readList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "object") return [value].filter(Boolean);
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    if (parsed && typeof parsed === "object") return [parsed];
  } catch {
    // Plain comma/newline text is accepted below.
  }
  return String(value)
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberValue(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inr(value) {
  return `₹${Math.round(numberValue(value)).toLocaleString("en-IN")}`;
}

function percentage(part, total) {
  return total ? Math.round((numberValue(part) / numberValue(total)) * 100) : 0;
}

function dateMs(value) {
  const time = new Date(String(value || "")).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function daysSinceDate(value) {
  const time = dateMs(value);
  return time ? Math.max(0, Math.floor((Date.now() - time) / 86400000)) : 999;
}

function compactText(value, fallback = "Not captured") {
  const text = String(value || "").trim();
  return text || fallback;
}

function clientDisplayName(client = {}) {
  if (!client || typeof client !== "object") return "Client";
  return compactText(client.name || client.fullName || client.full_name || client.clientName || client.customerName || client.phone || client.email || client.id, "Client");
}

function titleText(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function itemType(item = {}) {
  return String(item.type || item.itemType || item.categoryType || "").toLowerCase();
}

function itemName(item = {}) {
  return compactText(item.name || item.serviceName || item.productName || item.title || item.id, "Unnamed item");
}

function itemAmount(item = {}) {
  const direct = item.total ?? item.amount ?? item.lineTotal;
  if (direct !== undefined && direct !== null && direct !== "") return money(direct);
  const quantity = numberValue(item.quantity ?? item.qty ?? 1, 1) || 1;
  const price = numberValue(item.price ?? item.unitPrice ?? item.rate ?? 0);
  return money(quantity * price);
}

function mostCommon(entries, fallback = "") {
  const counts = new Map();
  for (const entry of entries.filter(Boolean)) counts.set(entry, (counts.get(entry) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]?.[0] || fallback;
}

function monthWindow(offset = 0) {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth() + offset, 1).getTime(),
    end: new Date(now.getFullYear(), now.getMonth() + offset + 1, 1).getTime()
  };
}

function spendInWindow(invoices, window) {
  return money(invoices.reduce((sum, invoice) => {
    const time = dateMs(invoice.reportCreatedAt || invoice.createdAt || invoice.created_at);
    return time >= window.start && time < window.end ? sum + numberValue(invoice.reportTotal ?? invoice.total ?? invoice.grand_total) : sum;
  }, 0));
}

function averageGapDays(dates) {
  const ordered = [...new Set(dates.map(dateMs).filter(Boolean))].sort((a, b) => a - b);
  if (ordered.length < 2) return 0;
  const gaps = ordered.slice(1).map((time, index) => (time - ordered[index]) / 86400000);
  return Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
}

function buildCard(raw) {
  return {
    id: raw.id,
    label: raw.label,
    category: raw.category,
    tone: raw.tone || "teal",
    value: String(raw.value ?? "0"),
    detail: String(raw.detail || ""),
    source: String(raw.source || "client 360 data"),
    actionLabel: String(raw.actionLabel || "Inspect linked data"),
    relatedCardIds: raw.relatedCardIds || []
  };
}

function connectCards(cards) {
  const ids = new Set(cards.map((card) => card.id));
  return cards.map((card) => {
    const categoryPeers = cards
      .filter((peer) => peer.category === card.category && peer.id !== card.id)
      .map((peer) => peer.id);
    const related = [...new Set([...(card.relatedCardIds || []), ...categoryPeers])]
      .filter((id) => ids.has(id) && id !== card.id)
      .slice(0, 6);
    return { ...card, relatedCardIds: related };
  });
}

function buildClient360Cards({
  client,
  metrics,
  favoriteServices,
  invoices,
  sales,
  appointments,
  services,
  memberships,
  walletTransactions,
  messageLogs,
  reputationReviews,
  referralCount,
  rfmProfile,
  lapsedProfile
}) {
  const tags = readList(client.tags).map((tag) => String(tag));
  const preferences = readJson(client.preferences);
  const communication = readJson(client.communicationPreferences);
  const safetyFlags = readJson(client.safetyFlags);
  const visitHistory = readList(client.visitHistory);
  const purchaseHistory = readList(client.purchaseHistory);
  const whatsappHistory = readList(client.whatsappHistory);
  const consentForms = readList(client.consentForms);
  const formulas = readList(client.formulas);

  const salesWithItems = sales.map((sale) => ({ ...sale, parsedItems: readList(sale.items) }));
  const itemRows = salesWithItems.flatMap((sale) => sale.parsedItems.map((item) => ({ sale, item })));
  const serviceItems = itemRows.filter(({ item }) => {
    const type = itemType(item);
    return type === "service" || type === "custom" || (!type && !item.productId);
  });
  const productItems = itemRows.filter(({ item }) => itemType(item) === "product" || item.productId);
  const serviceRevenue = money(serviceItems.reduce((sum, row) => sum + itemAmount(row.item), 0));
  const productRevenue = money(productItems.reduce((sum, row) => sum + itemAmount(row.item), 0));
  const itemRevenue = serviceRevenue + productRevenue;

  const invoiceDates = invoices.map((invoice) => invoice.reportCreatedAt || invoice.createdAt || invoice.created_at);
  const saleDates = sales.map((sale) => sale.createdAt);
  const appointmentDates = appointments.map((appointment) => appointment.startAt || appointment.createdAt);
  const historicVisitDates = visitHistory.map((visit) => visit.date || visit.createdAt);
  const visitDates = [...invoiceDates, ...saleDates, ...appointmentDates, ...historicVisitDates].filter(Boolean);
  const latestVisitAt = visitDates.sort((a, b) => dateMs(b) - dateMs(a))[0] || metrics.lastVisitAt || client.lastVisitAt || "";
  const firstVisitAt = visitDates.sort((a, b) => dateMs(a) - dateMs(b))[0] || client.createdAt || "";
  const avgGap = averageGapDays(visitDates);

  const currentMonthSpend = spendInWindow(invoices, monthWindow(0));
  const previousMonthSpend = spendInWindow(invoices, monthWindow(-1));
  const spendDelta = previousMonthSpend ? Math.round(((currentMonthSpend - previousMonthSpend) / previousMonthSpend) * 100) : (currentMonthSpend > 0 ? 100 : 0);
  const highestSingleBill = money(Math.max(0, ...invoices.map((invoice) => numberValue(invoice.reportTotal ?? invoice.total ?? invoice.grand_total))));
  const subtotal = invoices.reduce((sum, invoice) => sum + numberValue(invoice.subtotal ?? invoice.reportTotal ?? invoice.total), 0);
  const discount = invoices.reduce((sum, invoice) => sum + numberValue(invoice.discount_total ?? invoice.discount ?? invoice.couponDiscount), 0)
    + sales.reduce((sum, sale) => sum + numberValue(sale.discount ?? sale.couponDiscount), 0);
  const discountPercent = percentage(discount, subtotal || metrics.monetary);

  const staffUsage = new Map();
  for (const sale of sales) {
    const staffId = String(sale.staffId || "");
    if (!staffId) continue;
    const current = staffUsage.get(staffId) || { name: sale.staffName || staffId, count: 0 };
    staffUsage.set(staffId, { ...current, count: current.count + 1 });
  }
  for (const appointment of appointments) {
    const staffId = String(appointment.staffId || "");
    if (!staffId) continue;
    const current = staffUsage.get(staffId) || { name: appointment.staffName || staffId, count: 0 };
    staffUsage.set(staffId, { ...current, count: current.count + 1 });
  }
  const preferredStaff = [...staffUsage.values()].sort((a, b) => b.count - a.count)[0];

  const serviceStats = new Map();
  for (const row of serviceItems) {
    const serviceId = String(row.item.id || row.item.serviceId || "custom-service");
    const name = itemName(row.item);
    const current = serviceStats.get(serviceId) || { id: serviceId, name, count: 0, revenue: 0, category: row.item.category || "" };
    serviceStats.set(serviceId, {
      ...current,
      name,
      count: current.count + numberValue(row.item.quantity ?? row.item.qty ?? 1, 1),
      revenue: money(current.revenue + itemAmount(row.item)),
      category: row.item.category || current.category || ""
    });
  }
  for (const item of favoriteServices) {
    if (serviceStats.has(String(item.serviceId))) continue;
    serviceStats.set(String(item.serviceId || item.serviceName), {
      id: String(item.serviceId || item.serviceName),
      name: item.serviceName,
      count: numberValue(item.quantity || item.visitCount),
      revenue: money(item.revenue),
      category: ""
    });
  }
  const topServices = [...serviceStats.values()].sort((a, b) => b.count - a.count || b.revenue - a.revenue);
  const triedServiceIds = new Set(topServices.map((item) => item.id).filter(Boolean));
  const untriedServices = services
    .filter((service) => !triedServiceIds.has(String(service.id)) && String(service.status || "active").toLowerCase() !== "deleted")
    .slice(0, 8);
  const serviceCategoryPreference = mostCommon([
    ...topServices.map((item) => item.category),
    ...serviceItems.map(({ item }) => item.category)
  ], "Not enough history");
  const avgServicesPerVisit = metrics.frequency ? Math.round((serviceItems.length / metrics.frequency) * 10) / 10 : 0;

  const noShows = appointments.filter((item) => String(item.status || "").toLowerCase().includes("no")).length
    + numberValue(client.noShowCount);
  const cancellations = appointments.filter((item) => /cancel/i.test(String(item.status || ""))).length
    + numberValue(client.cancellationCount);
  const cancellationRate = percentage(cancellations, appointments.length || metrics.frequency);
  const walkInCount = sales.filter((sale) => !sale.appointmentId).length
    + appointments.filter((appointment) => /walk/i.test(String(appointment.source || appointment.sourceChannel || ""))).length;
  const bookedCount = appointments.length + sales.filter((sale) => sale.appointmentId).length;
  const peakDay = mostCommon(visitDates.map((value) => {
    const time = dateMs(value);
    return time ? new Date(time).toLocaleDateString("en-IN", { weekday: "short" }) : "";
  }), "Not enough history");
  const peakHour = mostCommon(visitDates.map((value) => {
    const time = dateMs(value);
    if (!time) return "";
    const hour = new Date(time).getHours();
    if (hour < 12) return "Morning";
    if (hour < 17) return "Afternoon";
    return "Evening";
  }), "Not enough history");

  const lastProduct = productItems.sort((a, b) => dateMs(b.sale.createdAt) - dateMs(a.sale.createdAt))[0]?.item;
  const productHistoryCount = productItems.length + purchaseHistory.length;
  const membershipBalance = memberships.reduce((sum, item) => sum + numberValue(item.creditsRemaining), 0);
  const activeMembership = memberships.find((item) => String(item.status || "").toLowerCase() === "active");
  const latestWallet = walletTransactions.sort((a, b) => dateMs(b.createdAt || b.created_at) - dateMs(a.createdAt || a.created_at))[0];
  const walletBalance = latestWallet ? numberValue(latestWallet.balanceAfter ?? latestWallet.balance_after) : numberValue(client.walletBalance);

  const lastMessage = messageLogs.sort((a, b) => dateMs(b.createdAt) - dateMs(a.createdAt))[0];
  const lastWhatsapp = whatsappHistory.sort((a, b) => dateMs(b.date || b.createdAt) - dateMs(a.date || a.createdAt))[0];
  const lastContactedAt = lastMessage?.createdAt || lastWhatsapp?.date || lastWhatsapp?.createdAt || "";
  const communicationPreference = compactText(
    client.preferredChannel || communication.preferredChannel || communication.channel || (tags.some((tag) => /dnd/i.test(tag)) ? "DND" : ""),
    "Default"
  );
  const marketingConsentRaw = communication.marketingConsent ?? communication.marketingOptIn ?? communication.consent;
  const marketingConsent = tags.some((tag) => /dnd/i.test(tag))
    ? "Opt-out"
    : marketingConsentRaw === true || marketingConsentRaw === "opt-in" || marketingConsentRaw === "yes"
      ? "Opt-in"
      : marketingConsentRaw === false || marketingConsentRaw === "opt-out" || marketingConsentRaw === "no"
        ? "Opt-out"
        : consentForms.length
          ? `${consentForms.length} form(s)`
          : "Not captured";
  const matchingReviews = reputationReviews.filter((review) => {
    const metadata = readJson(review.metadata);
    const reviewer = String(review.reviewer || "").toLowerCase();
    return metadata.clientId === client.id
      || reviewer === String(client.name || "").toLowerCase()
      || reviewer.includes(String(client.name || "").split(" ")[0]?.toLowerCase() || "__none__");
  });
  const reviewAvg = matchingReviews.length
    ? Math.round((matchingReviews.reduce((sum, review) => sum + numberValue(review.rating), 0) / matchingReviews.length) * 10) / 10
    : 0;

  const inactiveDays = daysSinceDate(latestVisitAt);
  const churnPercent = Math.min(100, Math.max(
    0,
    Math.round((inactiveDays > 180 ? 45 : inactiveDays > 90 ? 30 : inactiveDays > 45 ? 18 : 6)
      + noShows * 8
      + (metrics.frequency <= 1 ? 12 : 0)
      + (rfmProfile?.recencyScore <= 2 ? 18 : 0))
  ));
  const churnLabel = churnPercent >= 70 ? "High" : churnPercent >= 40 ? "Medium" : "Low";
  const rfmSegment = rfmProfile?.segment || (metrics.frequency ? "Developing" : "New");
  const rebookingRate = percentage(appointments.filter((item) => ["booked", "confirmed", "completed"].includes(String(item.status || "").toLowerCase())).length, metrics.frequency || appointments.length);
  const spendingTrend = spendDelta > 10 ? "Up" : spendDelta < -10 ? "Down" : "Flat";
  const inactiveTrend = avgGap && inactiveDays > avgGap * 1.5 ? "Slower than usual" : inactiveDays <= 30 ? "Active" : "Watch";
  const topServiceNames = topServices.slice(0, 3).map((item) => item.name);

  const cards = [
    buildCard({ id: "last-visit", label: "Last visit", category: "Original 6", tone: "teal", value: latestVisitAt ? `${inactiveDays} days` : "New", detail: latestVisitAt ? new Date(dateMs(latestVisitAt)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "No visit recorded", source: "invoices + sales + appointments", relatedCardIds: ["visit-frequency", "inactive-days-trend", "churn-risk-score"] }),
    buildCard({ id: "favorite-service", label: "Favorite service", category: "Original 6", tone: "blue", value: topServiceNames[0] || "Not enough history", detail: topServices[0] ? `${topServices[0].count} service unit(s)` : "Service history not established", source: "sales item history", relatedCardIds: ["top-3-services", "service-category-preference", "services-never-tried"] }),
    buildCard({ id: "average-spend", label: "Average spend", category: "Original 6", tone: "green", value: inr(metrics.averageBill || (metrics.frequency ? metrics.monetary / metrics.frequency : 0)), detail: `${metrics.frequency || 0} visit basis`, source: "invoice totals / visits", relatedCardIds: ["lifetime-value", "highest-single-bill", "spending-trend"] }),
    buildCard({ id: "preferred-staff", label: "Preferred staff", category: "Original 6", tone: "amber", value: preferredStaff?.name || "Not enough history", detail: preferredStaff ? `${preferredStaff.count} interaction(s)` : "No repeated staff pattern", source: "sales + appointments staff", relatedCardIds: ["favorite-service", "peak-day-time", "rebooking-rate"] }),
    buildCard({ id: "outstanding-balance", label: "Outstanding balance", category: "Original 6", tone: "red", value: inr(metrics.outstandingBalance), detail: `${invoices.filter((invoice) => numberValue(invoice.reportBalance ?? invoice.balance ?? invoice.due_amount) > 0).length} open invoice(s)`, source: "invoice balances", relatedCardIds: ["lifetime-value", "last-contacted", "churn-risk-score"] }),
    buildCard({ id: "loyalty-points", label: "Loyalty points", category: "Original 6", tone: "violet", value: String(numberValue(client.loyaltyPoints)), detail: `${inr(walletBalance)} wallet · ${membershipBalance} package credit(s)`, source: "client + wallet + membership", relatedCardIds: ["membership-package-balance", "lifetime-value", "rebooking-rate"] }),

    buildCard({ id: "lifetime-value", label: "Lifetime Value (LTV)", category: "Spending & Revenue", tone: "gold", value: inr(metrics.monetary), detail: firstVisitAt ? `Since ${new Date(dateMs(firstVisitAt)).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : "Client since not captured", source: "paid invoices + client totalSpend", relatedCardIds: ["average-spend", "this-month-spend", "rfm-segment"] }),
    buildCard({ id: "this-month-spend", label: "This Month Spend", category: "Spending & Revenue", tone: "emerald", value: inr(currentMonthSpend), detail: `${spendDelta >= 0 ? "+" : ""}${spendDelta}% vs last month`, source: "current and previous month invoices", relatedCardIds: ["spending-trend", "lifetime-value", "highest-single-bill"] }),
    buildCard({ id: "highest-single-bill", label: "Highest Single Bill", category: "Spending & Revenue", tone: "indigo", value: inr(highestSingleBill), detail: "Peak transaction value", source: "invoice totals", relatedCardIds: ["average-spend", "discount-availed", "product-service-split"] }),
    buildCard({ id: "discount-availed", label: "Discount Availed %", category: "Spending & Revenue", tone: "orange", value: `${discountPercent}%`, detail: `${inr(discount)} discount tracked`, source: "invoice + sale discount fields", relatedCardIds: ["highest-single-bill", "spending-trend", "lifetime-value"] }),
    buildCard({ id: "product-service-split", label: "Product vs Service Split", category: "Spending & Revenue", tone: "cyan", value: `${percentage(productRevenue, itemRevenue)}% retail`, detail: `${inr(productRevenue)} product · ${inr(serviceRevenue)} service`, source: "sale line item types", relatedCardIds: ["product-purchase-history", "service-category-preference", "avg-services-per-visit"] }),
    buildCard({ id: "membership-package-balance", label: "Membership/package balance", category: "Spending & Revenue", tone: "violet", value: `${membershipBalance} credit(s)`, detail: activeMembership ? `${activeMembership.planName} active` : "No active plan found", source: "memberships table", relatedCardIds: ["loyalty-points", "rebooking-rate", "lifetime-value"] }),

    buildCard({ id: "visit-frequency", label: "Visit Frequency", category: "Visit Behavior", tone: "teal", value: avgGap ? `Every ${avgGap} days` : "Not enough history", detail: `${visitDates.length} recorded touchpoint(s)`, source: "appointments + sales + invoices", relatedCardIds: ["last-visit", "inactive-days-trend", "rebooking-rate"] }),
    buildCard({ id: "no-show-count", label: "No-show Count", category: "Visit Behavior", tone: "red", value: String(noShows), detail: "Missed appointment signal", source: "appointment status + client counters", relatedCardIds: ["cancellation-rate", "churn-risk-score", "rebooking-rate"] }),
    buildCard({ id: "cancellation-rate", label: "Cancellation Rate %", category: "Visit Behavior", tone: "amber", value: `${cancellationRate}%`, detail: `${cancellations} cancellation(s)`, source: "appointment status + client counters", relatedCardIds: ["no-show-count", "churn-risk-score", "visit-frequency"] }),
    buildCard({ id: "walkin-vs-booked", label: "Walk-in vs Booked", category: "Visit Behavior", tone: "blue", value: `${percentage(walkInCount, walkInCount + bookedCount)}% walk-in`, detail: `${bookedCount} booked · ${walkInCount} walk-in`, source: "appointments + POS sales", relatedCardIds: ["peak-day-time", "visit-frequency", "rebooking-rate"] }),
    buildCard({ id: "peak-day-time", label: "Peak Day/Time", category: "Visit Behavior", tone: "violet", value: peakDay, detail: peakHour, source: "visit timestamps", relatedCardIds: ["preferred-staff", "walkin-vs-booked", "visit-frequency"] }),

    buildCard({ id: "top-3-services", label: "Top 3 Services", category: "Service & Product", tone: "blue", value: topServiceNames[0] || "Not enough history", detail: topServiceNames.slice(1).join(" · ") || "No repeat service pattern", source: "service line items", relatedCardIds: ["favorite-service", "services-never-tried", "service-category-preference"] }),
    buildCard({ id: "services-never-tried", label: "Services Never Tried", category: "Service & Product", tone: "orange", value: untriedServices[0]?.name || "All core tried", detail: untriedServices.length ? `${untriedServices.length} upsell option(s)` : "No obvious service gap", source: "services catalog vs client sales", relatedCardIds: ["top-3-services", "avg-services-per-visit", "service-category-preference"] }),
    buildCard({ id: "product-purchase-history", label: "Product purchase history", category: "Service & Product", tone: "pink", value: lastProduct ? itemName(lastProduct) : `${productHistoryCount} item(s)`, detail: productHistoryCount ? `${productHistoryCount} retail/history row(s)` : "No product purchase recorded", source: "sale product items + client purchase history", relatedCardIds: ["product-service-split", "service-category-preference", "spending-trend"] }),
    buildCard({ id: "avg-services-per-visit", label: "Avg services per visit", category: "Service & Product", tone: "green", value: String(avgServicesPerVisit), detail: `${serviceItems.length} service line(s)`, source: "service line items / visits", relatedCardIds: ["top-3-services", "visit-frequency", "services-never-tried"] }),
    buildCard({ id: "service-category-preference", label: "Service category preference", category: "Service & Product", tone: "violet", value: serviceCategoryPreference, detail: formulas.length ? `${formulas.length} formula note(s)` : "Formula notes can deepen this", source: "service catalog categories + formula notes", relatedCardIds: ["favorite-service", "top-3-services", "product-service-split"] }),

    buildCard({ id: "referral-count", label: "Referral count", category: "Relationship & Engagement", tone: "green", value: String(referralCount), detail: "Clients/appointments attributed to this client", source: "appointment referral fields", relatedCardIds: ["review-rating", "communication-preference", "lifetime-value"] }),
    buildCard({ id: "review-rating", label: "Review/rating given", category: "Relationship & Engagement", tone: "gold", value: matchingReviews.length ? `${reviewAvg} ★` : "No review", detail: `${matchingReviews.length} matched review(s)`, source: "reputation reviews reviewer/client match", relatedCardIds: ["referral-count", "last-contacted", "churn-risk-score"] }),
    buildCard({ id: "communication-preference", label: "Communication preference", category: "Relationship & Engagement", tone: "cyan", value: titleText(communicationPreference), detail: compactText(client.preferredLanguage || communication.preferredLanguage, "Language default"), source: "client communication preferences", relatedCardIds: ["marketing-consent-status", "last-contacted", "birthday-anniversary"] }),
    buildCard({ id: "marketing-consent-status", label: "Marketing consent status", category: "Relationship & Engagement", tone: marketingConsent === "Opt-out" ? "red" : "teal", value: marketingConsent, detail: `${consentForms.length} consent/profile form(s)`, source: "communication preferences + consent forms + tags", relatedCardIds: ["communication-preference", "last-contacted", "campaign-engagement"] }),
    buildCard({ id: "last-contacted", label: "Last contacted date", category: "Relationship & Engagement", tone: "indigo", value: lastContactedAt ? `${daysSinceDate(lastContactedAt)} days` : "Not contacted", detail: lastContactedAt ? new Date(dateMs(lastContactedAt)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "No message log found", source: "message logs + WhatsApp history", relatedCardIds: ["communication-preference", "campaign-engagement", "churn-risk-score"] }),
    buildCard({ id: "campaign-engagement", label: "Campaign engagement", category: "Relationship & Engagement", tone: "pink", value: `${messageLogs.length} message(s)`, detail: lastMessage ? `${lastMessage.channel || "Message"} · ${lastMessage.status || "logged"}` : "No campaign/message log", source: "message_logs", relatedCardIds: ["last-contacted", "marketing-consent-status", "communication-preference"] }),
    buildCard({ id: "birthday-anniversary", label: "Birthday / anniversary", category: "Relationship & Engagement", tone: "amber", value: client.birthday ? new Date(dateMs(client.birthday)).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "Not set", detail: client.anniversary ? `Anniv ${new Date(dateMs(client.anniversary)).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : "Anniversary not set", source: "client profile dates", relatedCardIds: ["communication-preference", "campaign-engagement", "last-contacted"] }),

    buildCard({ id: "churn-risk-score", label: "Churn risk score", category: "Risk & Churn", tone: churnPercent >= 70 ? "red" : churnPercent >= 40 ? "amber" : "green", value: `${churnLabel} · ${churnPercent}%`, detail: lapsedProfile?.suggestedAction || "Calculated from inactivity, RFM and no-shows", source: "RFM + inactivity + appointment behavior", relatedCardIds: ["rfm-segment", "inactive-days-trend", "last-contacted"] }),
    buildCard({ id: "rfm-segment", label: "RFM segment", category: "Risk & Churn", tone: "blue", value: rfmSegment, detail: rfmProfile ? `Score ${rfmProfile.rfmScore}` : "Needs visit/spend history", source: "top RFM report", relatedCardIds: ["churn-risk-score", "lifetime-value", "spending-trend"] }),
    buildCard({ id: "inactive-days-trend", label: "Inactive days trend", category: "Risk & Churn", tone: inactiveTrend === "Active" ? "green" : inactiveTrend === "Watch" ? "amber" : "red", value: `${inactiveDays} days`, detail: avgGap ? `${inactiveTrend} vs ${avgGap} day rhythm` : inactiveTrend, source: "last visit vs average visit gap", relatedCardIds: ["last-visit", "visit-frequency", "churn-risk-score"] }),
    buildCard({ id: "rebooking-rate", label: "Rebooking rate", category: "Risk & Churn", tone: "teal", value: `${rebookingRate}%`, detail: `${appointments.length} appointment row(s)`, source: "appointment status history", relatedCardIds: ["visit-frequency", "no-show-count", "churn-risk-score"] }),
    buildCard({ id: "spending-trend", label: "Spending trend", category: "Risk & Churn", tone: spendingTrend === "Up" ? "green" : spendingTrend === "Down" ? "red" : "amber", value: spendingTrend, detail: `${spendDelta >= 0 ? "+" : ""}${spendDelta}% month-over-month`, source: "month-to-date invoice trend", relatedCardIds: ["this-month-spend", "lifetime-value", "rfm-segment"] })
  ];

  const connectedCards = connectCards(cards);
  return {
    cards: connectedCards,
    groups: [...new Set(connectedCards.map((card) => card.category))].map((category) => ({
      category,
      count: connectedCards.filter((card) => card.category === category).length
    })),
    connections: connectedCards.flatMap((card) => card.relatedCardIds.map((targetId) => ({ sourceId: card.id, targetId }))),
    drilldowns: {
      topServices: topServices.slice(0, 6),
      untriedServices,
      productItems: productItems.slice(0, 8).map(({ sale, item }) => ({ saleId: sale.id, createdAt: sale.createdAt, name: itemName(item), amount: itemAmount(item) })),
      recentAppointments: appointments.slice(0, 8),
      recentMessages: messageLogs.slice(0, 8),
      memberships: memberships.slice(0, 5)
    }
  };
}

export class ClientReportsService {
  client360(clientId, query = {}, access = {}) {
    const branchId = branchFrom(query, access);
    const params = { tenantId: tenantId(access), branchId, clientId };
    const client = db.prepare(
      `SELECT * FROM clients c WHERE c.id = @clientId AND ${clientWhere(branchId)}`
    ).get(params);
    if (!client) throw notFound("Client not found");
    if (client.branchId) tenantService.assertBranchAccess(access, client.branchId);
    const clientProfile = { ...client, name: clientDisplayName(client) };

    const metrics = normalizeStat(db.prepare(
      `${statsCte(branchId)}
       SELECT * FROM client_stats WHERE id = @clientId`
    ).get(params) || {});

    const favoriteServices = db.prepare(
      `WITH item_rows AS (
        SELECT
          COALESCE(NULLIF(json_extract(item.value, '$.id'), ''), 'custom-service') AS serviceId,
          COALESCE(NULLIF(json_extract(item.value, '$.name'), ''), 'Service') AS serviceName,
          COALESCE(json_extract(item.value, '$.quantity'), 1) AS quantity,
          COALESCE(json_extract(item.value, '$.price'), 0) AS price,
          s.id AS saleId,
          s.createdAt
        FROM sales s
        JOIN json_each(CASE WHEN json_valid(s.items) THEN s.items ELSE '[]' END) item
        WHERE ${saleWhere(branchId)}
          AND s.clientId = @clientId
          AND LOWER(COALESCE(json_extract(item.value, '$.type'), 'service')) IN ('service', 'custom')
      )
      SELECT serviceId, serviceName, COUNT(DISTINCT saleId) AS visitCount,
             SUM(quantity) AS quantity, SUM(quantity * price) AS revenue, MAX(createdAt) AS lastVisitAt
      FROM item_rows
      GROUP BY serviceId, serviceName
      ORDER BY visitCount DESC, revenue DESC
      LIMIT 5`
    ).all(params).map((row) => ({ ...row, revenue: money(row.revenue) }));

    const recentInvoices = db.prepare(
      `SELECT i.id, i.invoiceNumber, ${invoiceDateExpr} AS createdAt,
              ${invoiceTotalExpr} AS total, ${invoicePaidExpr} AS paid, ${invoiceBalanceExpr} AS balance,
              COALESCE(NULLIF(i.status, ''), NULLIF(i.payment_status, ''), 'open') AS status
       FROM invoices i
       LEFT JOIN sales s ON s.id = i.saleId AND s.tenantId = i.tenantId
       LEFT JOIN clients c ON c.id = i.clientId AND c.tenantId = i.tenantId
       WHERE ${invoiceWhere(branchId)} AND i.clientId = @clientId
       ORDER BY ${invoiceDateExpr} DESC
       LIMIT 8`
    ).all(params).map((row) => ({
      ...row,
      total: money(row.total),
      paid: money(row.paid),
      balance: money(row.balance)
    }));

    const allInvoices = db.prepare(
      `SELECT i.*,
              ${invoiceDateExpr} AS reportCreatedAt,
              ${invoiceTotalExpr} AS reportTotal,
              ${invoicePaidExpr} AS reportPaid,
              ${invoiceBalanceExpr} AS reportBalance,
              COALESCE(NULLIF(i.status, ''), NULLIF(i.payment_status, ''), 'open') AS reportStatus
       FROM invoices i
       LEFT JOIN sales s ON s.id = i.saleId AND s.tenantId = i.tenantId
       LEFT JOIN clients c ON c.id = i.clientId AND c.tenantId = i.tenantId
       WHERE ${invoiceWhere(branchId)} AND i.clientId = @clientId
       ORDER BY ${invoiceDateExpr} DESC
       LIMIT 500`
    ).all(params).map((row) => ({
      ...row,
      reportTotal: money(row.reportTotal),
      reportPaid: money(row.reportPaid),
      reportBalance: money(row.reportBalance)
    }));

    const sales = db.prepare(
      `SELECT s.*, st.name AS staffName
       FROM sales s
       LEFT JOIN staff st ON st.id = s.staffId AND st.tenantId = s.tenantId
       WHERE ${saleWhere(branchId)}
         AND s.clientId = @clientId
       ORDER BY COALESCE(NULLIF(s.createdAt, ''), NULLIF(s.updatedAt, '')) DESC
       LIMIT 500`
    ).all(params);

    const appointments = db.prepare(
      `SELECT a.*, st.name AS staffName
       FROM appointments a
       LEFT JOIN staff st ON st.id = a.staffId AND st.tenantId = a.tenantId
       WHERE a.tenantId = @tenantId
         AND a.clientId = @clientId
         ${branchId ? "AND a.branchId = @branchId" : ""}
       ORDER BY COALESCE(NULLIF(a.startAt, ''), NULLIF(a.createdAt, '')) DESC
       LIMIT 500`
    ).all(params);

    const services = db.prepare(
      `SELECT id, name, category, price, durationMinutes, status
       FROM services
       WHERE tenantId = @tenantId
         AND LOWER(COALESCE(NULLIF(status, ''), 'active')) NOT IN ('deleted','inactive')
       ORDER BY name ASC
       LIMIT 1000`
    ).all(params);

    const memberships = db.prepare(
      `SELECT *
       FROM memberships
       WHERE tenantId = @tenantId
         AND clientId = @clientId
         ${branchId ? "AND branchId = @branchId" : ""}
       ORDER BY COALESCE(NULLIF(validityDate, ''), NULLIF(createdAt, '')) DESC
       LIMIT 100`
    ).all(params);

    const walletTransactions = db.prepare(
      `SELECT *
       FROM wallet_transactions
       WHERE tenantId = @tenantId
         AND clientId = @clientId
         ${branchId ? "AND COALESCE(NULLIF(branchId, ''), '') = @branchId" : ""}
       ORDER BY COALESCE(NULLIF(createdAt, ''), '') DESC
       LIMIT 200`
    ).all(params);

    const messageLogs = db.prepare(
      `SELECT *
       FROM message_logs
       WHERE tenantId = @tenantId
         AND clientId = @clientId
         ${branchId ? "AND branchId = @branchId" : ""}
       ORDER BY COALESCE(NULLIF(createdAt, ''), NULLIF(updatedAt, '')) DESC
       LIMIT 200`
    ).all(params);

    const reputationReviews = db.prepare(
      `SELECT *
       FROM reputation_reviews
       WHERE tenantId = @tenantId
         ${branchId ? "AND branchId = @branchId" : ""}
       ORDER BY COALESCE(NULLIF(createdAt, ''), NULLIF(updatedAt, '')) DESC
       LIMIT 1000`
    ).all(params);

    const referralCount = Number(db.prepare(
      `SELECT COUNT(DISTINCT clientId) AS count
       FROM appointments
       WHERE tenantId = @tenantId
         AND referrerCustomerId = @clientId
         ${branchId ? "AND branchId = @branchId" : ""}`
    ).get(params)?.count || 0);

    const scopedReportQuery = { ...(branchId ? { branchId } : {}) };
    const rfmProfile = this.topRfm({ ...scopedReportQuery, limit: 200 }, access)
      .find((row) => String(row.id) === String(clientId));
    const lapsedProfile = this.lapsed({ ...scopedReportQuery, minDays: 1, maxDays: 3650, limit: 200 }, access)
      .find((row) => String(row.id) === String(clientId));
    const client360Cards = buildClient360Cards({
      client: clientProfile,
      metrics,
      favoriteServices,
      invoices: allInvoices,
      sales,
      appointments,
      services,
      memberships,
      walletTransactions,
      messageLogs,
      reputationReviews,
      referralCount,
      rfmProfile,
      lapsedProfile
    });

    return {
      client: clientProfile,
      metrics: {
        totalVisits: metrics.frequency,
        totalSpend: metrics.monetary,
        paidAmount: metrics.paidAmount,
        outstandingBalance: metrics.outstandingBalance,
        lastVisitAt: metrics.lastVisitAt,
        daysSinceLastVisit: metrics.daysSinceLastVisit,
        averageBill: metrics.frequency ? money(metrics.monetary / metrics.frequency) : 0,
        favoriteService: favoriteServices[0]?.serviceName || "Not enough history"
      },
      favoriteServices,
      recentInvoices,
      metricCards: client360Cards.cards,
      metricGroups: client360Cards.groups,
      metricConnections: client360Cards.connections,
      metricDrilldowns: client360Cards.drilldowns
    };
  }

  topRfm(query = {}, access = {}) {
    const branchId = branchFrom(query, access);
    const limit = clampInt(query.limit, 50, 1, 200);
    const rows = db.prepare(
      `${statsCte(branchId)},
       normalized AS (
         SELECT *,
           CASE WHEN computedLastVisitAt IS NULL OR computedLastVisitAt = '' THEN 999
                ELSE CAST(julianday('now') - julianday(computedLastVisitAt) AS INTEGER)
           END AS daysSinceLastVisit
         FROM client_stats
       ),
       scored AS (
         SELECT *,
           CASE WHEN frequency <= 0 THEN 1 ELSE 6 - NTILE(5) OVER (ORDER BY daysSinceLastVisit ASC) END AS recencyScore,
           CASE WHEN frequency <= 0 THEN 1 ELSE NTILE(5) OVER (ORDER BY frequency ASC) END AS frequencyScore,
           CASE WHEN monetary <= 0 THEN 1 ELSE NTILE(5) OVER (ORDER BY monetary ASC) END AS monetaryScore
         FROM normalized
       )
       SELECT *,
         (recencyScore + frequencyScore + monetaryScore) AS rfmScore,
         CASE
           WHEN recencyScore + frequencyScore + monetaryScore >= 13 THEN 'Champions'
           WHEN recencyScore >= 4 AND monetaryScore >= 4 THEN 'High-value active'
           WHEN recencyScore <= 2 AND monetaryScore >= 4 THEN 'Win-back priority'
           WHEN frequencyScore >= 4 THEN 'Loyal regulars'
           ELSE 'Developing'
         END AS segment
       FROM scored
       ORDER BY rfmScore DESC, monetary DESC, frequency DESC
       LIMIT @limit`
    ).all({ tenantId: tenantId(access), branchId, limit });
    return rows.map(normalizeStat).map((row) => ({
      ...row,
      recencyScore: Number(row.recencyScore || 0),
      frequencyScore: Number(row.frequencyScore || 0),
      monetaryScore: Number(row.monetaryScore || 0),
      rfmScore: Number(row.rfmScore || 0)
    }));
  }

  lapsed(query = {}, access = {}) {
    const branchId = branchFrom(query, access);
    const minDays = clampInt(query.minDays, 60, 1, 3650);
    const maxDays = clampInt(query.maxDays, 180, minDays, 3650);
    const limit = clampInt(query.limit, 50, 1, 200);
    return db.prepare(
      `${statsCte(branchId)},
       normalized AS (
         SELECT *,
           CASE WHEN computedLastVisitAt IS NULL OR computedLastVisitAt = '' THEN 999
                ELSE CAST(julianday('now') - julianday(computedLastVisitAt) AS INTEGER)
           END AS daysSinceLastVisit
         FROM client_stats
       )
       SELECT *
       FROM normalized
       WHERE frequency >= 2 AND daysSinceLastVisit BETWEEN @minDays AND @maxDays
       ORDER BY monetary DESC, daysSinceLastVisit DESC
       LIMIT @limit`
    ).all({ tenantId: tenantId(access), branchId, minDays, maxDays, limit })
      .map(normalizeStat)
      .map((row) => ({
        ...row,
        riskBand: row.daysSinceLastVisit >= 120 ? "high" : "medium",
        suggestedAction: row.monetary >= 10000 ? "Personal win-back call with premium offer" : "WhatsApp comeback offer"
      }));
  }

  newVsReturning(query = {}, access = {}) {
    const branchId = branchFrom(query, access);
    const months = clampInt(query.months, 12, 1, 36);
    const rows = db.prepare(
      `WITH RECURSIVE months(n, monthStart) AS (
         SELECT 0, date('now', 'start of month')
         UNION ALL
         SELECT n + 1, date(monthStart, '-1 month') FROM months WHERE n < @months - 1
       ),
       base_clients AS (
         SELECT c.id, c.createdAt
         FROM clients c
         WHERE ${clientWhere(branchId)}
       ),
       touches AS (
         SELECT i.clientId, ${invoiceDateExpr} AS touchedAt
         FROM invoices i
         LEFT JOIN sales s ON s.id = i.saleId AND s.tenantId = i.tenantId
         LEFT JOIN clients c ON c.id = i.clientId AND c.tenantId = i.tenantId
         WHERE ${invoiceWhere(branchId)}
         UNION ALL
         SELECT s.clientId, s.createdAt AS touchedAt
         FROM sales s
         JOIN clients c ON c.id = s.clientId AND c.tenantId = s.tenantId
         WHERE ${saleWhere(branchId)}
       ),
       first_touch AS (
         SELECT bc.id AS clientId, substr(COALESCE(MIN(t.touchedAt), bc.createdAt), 1, 7) AS firstMonth
         FROM base_clients bc
         LEFT JOIN touches t ON t.clientId = bc.id
         GROUP BY bc.id
       ),
       monthly_touch AS (
         SELECT DISTINCT clientId, substr(touchedAt, 1, 7) AS visitMonth
         FROM touches
         WHERE touchedAt IS NOT NULL AND touchedAt <> ''
       )
       SELECT
         strftime('%Y-%m', m.monthStart) AS month,
         COUNT(DISTINCT CASE WHEN substr(bc.createdAt, 1, 7) = strftime('%Y-%m', m.monthStart)
                              OR ft.firstMonth = strftime('%Y-%m', m.monthStart)
                             THEN bc.id END) AS newClients,
         COUNT(DISTINCT CASE WHEN mt.visitMonth = strftime('%Y-%m', m.monthStart)
                              AND ft.firstMonth < strftime('%Y-%m', m.monthStart)
                             THEN mt.clientId END) AS returningClients,
         COUNT(DISTINCT CASE WHEN mt.visitMonth = strftime('%Y-%m', m.monthStart) THEN mt.clientId END) AS activeClients
       FROM months m
       LEFT JOIN base_clients bc ON 1 = 1
       LEFT JOIN first_touch ft ON ft.clientId = bc.id
       LEFT JOIN monthly_touch mt ON mt.clientId = bc.id AND mt.visitMonth = strftime('%Y-%m', m.monthStart)
       GROUP BY m.monthStart
       ORDER BY m.monthStart ASC`
    ).all({ tenantId: tenantId(access), branchId, months });
    return rows.map((row) => ({
      month: row.month,
      newClients: Number(row.newClients || 0),
      returningClients: Number(row.returningClients || 0),
      activeClients: Number(row.activeClients || 0),
      retentionMix: Number(row.activeClients || 0) ? Math.round((Number(row.returningClients || 0) / Number(row.activeClients || 0)) * 100) : 0
    }));
  }

  occasions(query = {}, access = {}) {
    const branchId = branchFrom(query, access);
    const withinDays = clampInt(query.withinDays, 30, 1, 366);
    const limit = clampInt(query.limit, 100, 1, 500);
    const clients = db.prepare(
      `SELECT c.id, c.name, c.phone, c.email, c.branchId, c.birthday, c.anniversary
       FROM clients c
       WHERE ${clientWhere(branchId)}`
    ).all({ tenantId: tenantId(access), branchId });
    return clients.flatMap((client) => {
      return [
        { type: "birthday", rawDate: client.birthday },
        { type: "anniversary", rawDate: client.anniversary }
      ].map((occasion) => {
        const next = nextOccurrence(occasion.rawDate);
        if (!next || next.daysUntil > withinDays) return null;
        return {
          id: `${client.id}-${occasion.type}`,
          clientId: client.id,
          name: clientDisplayName(client),
          phone: client.phone,
          email: client.email,
          branchId: client.branchId,
          type: occasion.type,
          originalDate: occasion.rawDate,
          nextDate: next.nextDate,
          daysUntil: next.daysUntil
        };
      }).filter(Boolean);
    }).sort((a, b) => a.daysUntil - b.daysUntil || String(a.name || "").localeCompare(String(b.name || ""))).slice(0, limit);
  }

  byService(query = {}, access = {}) {
    const branchId = branchFrom(query, access);
    const limit = clampInt(query.limit, 25, 1, 200);
    const serviceId = String(query.serviceId || "");
    const params = { tenantId: tenantId(access), branchId, serviceId, limit };
    const serviceFilter = serviceId
      ? "AND COALESCE(NULLIF(json_extract(item.value, '$.id'), ''), 'custom-service') = @serviceId"
      : "";
    const serviceRows = db.prepare(
      `WITH item_rows AS (
        SELECT
          COALESCE(NULLIF(json_extract(item.value, '$.id'), ''), 'custom-service') AS serviceId,
          COALESCE(NULLIF(json_extract(item.value, '$.name'), ''), svc.name, 'Service') AS serviceName,
          s.clientId,
          c.name AS clientName,
          c.phone AS clientPhone,
          COALESCE(json_extract(item.value, '$.quantity'), 1) AS quantity,
          COALESCE(json_extract(item.value, '$.price'), 0) AS price,
          s.id AS saleId,
          s.createdAt
        FROM sales s
        JOIN clients c ON c.id = s.clientId AND c.tenantId = s.tenantId
        JOIN json_each(CASE WHEN json_valid(s.items) THEN s.items ELSE '[]' END) item
        LEFT JOIN services svc ON svc.id = json_extract(item.value, '$.id') AND svc.tenantId = s.tenantId
        WHERE ${saleWhere(branchId)}
          AND (c.deletedAt IS NULL OR c.deletedAt = '')
          AND LOWER(COALESCE(json_extract(item.value, '$.type'), 'service')) IN ('service', 'custom')
          ${serviceFilter}
      )
      SELECT serviceId, serviceName, COUNT(DISTINCT clientId) AS clientCount,
             COUNT(DISTINCT saleId) AS visitCount, SUM(quantity) AS quantity,
             SUM(quantity * price) AS revenue, MAX(createdAt) AS lastSoldAt
      FROM item_rows
      GROUP BY serviceId, serviceName
      ORDER BY revenue DESC, visitCount DESC
      LIMIT @limit`
    ).all(params).map((row) => ({ ...row, revenue: money(row.revenue) }));

    const topClients = db.prepare(
      `WITH item_rows AS (
        SELECT
          COALESCE(NULLIF(json_extract(item.value, '$.id'), ''), 'custom-service') AS serviceId,
          COALESCE(NULLIF(json_extract(item.value, '$.name'), ''), svc.name, 'Service') AS serviceName,
          s.clientId,
          c.name AS clientName,
          c.phone AS clientPhone,
          COALESCE(json_extract(item.value, '$.quantity'), 1) AS quantity,
          COALESCE(json_extract(item.value, '$.price'), 0) AS price,
          s.id AS saleId,
          s.createdAt
        FROM sales s
        JOIN clients c ON c.id = s.clientId AND c.tenantId = s.tenantId
        JOIN json_each(CASE WHEN json_valid(s.items) THEN s.items ELSE '[]' END) item
        LEFT JOIN services svc ON svc.id = json_extract(item.value, '$.id') AND svc.tenantId = s.tenantId
        WHERE ${saleWhere(branchId)}
          AND (c.deletedAt IS NULL OR c.deletedAt = '')
          AND LOWER(COALESCE(json_extract(item.value, '$.type'), 'service')) IN ('service', 'custom')
          ${serviceFilter}
      ),
      grouped AS (
        SELECT serviceId, serviceName, clientId, clientName, clientPhone,
               COUNT(DISTINCT saleId) AS visitCount, SUM(quantity) AS quantity,
               SUM(quantity * price) AS revenue, MAX(createdAt) AS lastVisitAt
        FROM item_rows
        GROUP BY serviceId, serviceName, clientId, clientName, clientPhone
      ),
      ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY serviceId, serviceName ORDER BY revenue DESC, visitCount DESC) AS rank
        FROM grouped
      )
      SELECT * FROM ranked WHERE rank <= 5`
    ).all(params).map((row) => ({ ...row, revenue: money(row.revenue) }));

    const clientsByService = new Map();
    for (const row of topClients) {
      const key = `${row.serviceId}::${row.serviceName}`;
      if (!clientsByService.has(key)) clientsByService.set(key, []);
      clientsByService.get(key).push(row);
    }
    return serviceRows.map((row) => ({
      ...row,
      topClients: clientsByService.get(`${row.serviceId}::${row.serviceName}`) || []
    }));
  }
}

export const clientReportsService = new ClientReportsService();
