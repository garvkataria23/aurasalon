import { db } from "../db.js";
import { getCached, setCached } from "./dashboard-cache.service.js";
import { dashboardAggregationService } from "./dashboard-aggregation.service.js";
import { ensureDashboardSchema } from "./dashboard-schema.service.js";

ensureDashboardSchema();

const dayMs = 86_400_000;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const pct = (value) => Math.round((Number(value) || 0) * 100) / 100;
const todayIso = () => new Date().toISOString().slice(0, 10);

function safeJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function addDays(date, days) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function rangeFromQuery(query = {}) {
  const today = todayIso();
  if (query.range === "custom" && query.from && query.to) {
    return { range: "custom", from: String(query.from).slice(0, 10), to: String(query.to).slice(0, 10) };
  }
  const range = query.range || "today";
  const days = {
    today: 0,
    week: 6,
    month: 29,
    quarter: 89,
    year: 364
  }[range] ?? 0;
  return { range, from: addDays(today, -days), to: today };
}

function previousRange({ from, to }) {
  const span = Math.max(1, Math.round((new Date(`${to}T00:00:00.000Z`) - new Date(`${from}T00:00:00.000Z`)) / dayMs) + 1);
  return {
    from: addDays(from, -span),
    to: addDays(from, -1)
  };
}

function branchFilter(branchId, alias = "") {
  const column = `${alias ? `${alias}.` : ""}branchId`;
  return branchId ? ` AND ${column} = @branchId` : "";
}

function summaryRows(tenantId, from, to, branchId = "") {
  const params = { tenantId, from, to, branchId };
  return db.prepare(
    `SELECT *
     FROM daily_summary
     WHERE tenant_id = @tenantId AND date BETWEEN @from AND @to
     ${branchId ? "AND branch_id = @branchId" : ""}
     ORDER BY date`
  ).all(params);
}

function ensureRangeSummaries(tenantId, from, to) {
  const existing = db.prepare(
    "SELECT COUNT(*) AS count FROM daily_summary WHERE tenant_id = ? AND date BETWEEN ? AND ?"
  ).get(tenantId, from, to).count;
  if (!existing) dashboardAggregationService.refreshRange(tenantId, from, to);
  ensureCustomerMetrics(tenantId);
}

function ensureCustomerMetrics(tenantId) {
  const today = todayIso();
  const row = db.prepare(
    "SELECT COUNT(*) AS count, MAX(substr(updated_at, 1, 10)) AS updatedAt FROM customer_metrics WHERE tenant_id = ?"
  ).get(tenantId);
  if (!row.count || row.updatedAt !== today) dashboardAggregationService.refreshCustomerMetrics(tenantId);
}

function sumRows(rows, key) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function metric(current, previous, key, formatter = (value) => value) {
  const currentValue = sumRows(current, key);
  const previousValue = sumRows(previous, key);
  const delta = currentValue - previousValue;
  const deltaPct = previousValue === 0 ? 0 : pct((delta / previousValue) * 100);
  return {
    value: formatter(currentValue),
    rawValue: money(currentValue),
    delta: money(delta),
    deltaPct,
    trend: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    sparkline: sparkline(current, key)
  };
}

function ratioMetric(current, previous, numerator, denominator) {
  const currentDenominator = Math.max(1, sumRows(current, denominator));
  const previousDenominator = Math.max(1, sumRows(previous, denominator));
  const currentValue = (sumRows(current, numerator) * 100) / currentDenominator;
  const previousValue = (sumRows(previous, numerator) * 100) / previousDenominator;
  const delta = currentValue - previousValue;
  return {
    value: pct(currentValue),
    rawValue: pct(currentValue),
    delta: pct(delta),
    deltaPct: pct(delta),
    trend: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    sparkline: sparkline(current.map((row) => ({ ...row, ratio: (Number(row[numerator] || 0) * 100) / Math.max(1, Number(row[denominator] || 0)) })), "ratio")
  };
}

function sparkline(rows, key) {
  return rows.map((row) => ({ date: row.date, value: money(row[key]) }));
}

function revenueTrend(rows) {
  const grouped = new Map();
  for (const row of rows) grouped.set(row.date, money((grouped.get(row.date) || 0) + Number(row.revenue || 0)));
  return [...grouped.entries()].map(([date, value]) => ({ date, value }));
}

function topStaffFromSummary(tenantId, from, to, branchId) {
  const params = { tenantId, from, to, branchId };
  return db.prepare(
    `SELECT COALESCE(s.name, sds.staff_id) AS staff,
            sds.staff_id AS staffId,
            SUM(sds.revenue_generated) AS value,
            SUM(sds.services_completed) AS servicesCompleted,
            SUM(sds.tips_received) AS tips
     FROM staff_daily_summary sds
     LEFT JOIN staff s ON s.id = sds.staff_id AND s.tenantId = sds.tenant_id
     WHERE sds.tenant_id = @tenantId AND sds.date BETWEEN @from AND @to
       ${branchId ? "AND COALESCE(s.branchId, '') = @branchId" : ""}
     GROUP BY sds.staff_id
     ORDER BY value DESC
     LIMIT 10`
  ).all(params).map((row) => ({
    staff: row.staff,
    staffId: row.staffId,
    value: money(row.value),
    servicesCompleted: Number(row.servicesCompleted || 0),
    tips: money(row.tips)
  }));
}

function salesRows(tenantId, from, to, branchId = "") {
  const params = { tenantId, from, to, branchId };
  return db.prepare(
    `SELECT *
     FROM sales
     WHERE tenantId = @tenantId AND substr(createdAt, 1, 10) BETWEEN @from AND @to
       ${branchFilter(branchId)}
     ORDER BY createdAt DESC`
  ).all(params);
}

function refundRows(tenantId, from, to, branchId = "") {
  return db.prepare(
    `SELECT r.*, COALESCE(c.name, r.clientId) AS clientName
     FROM finance_refunds r
     LEFT JOIN clients c ON c.id = r.clientId AND c.tenantId = r.tenantId
     WHERE r.tenantId = @tenantId AND substr(r.createdAt, 1, 10) BETWEEN @from AND @to
       ${branchFilter(branchId, "r")}
     ORDER BY r.createdAt DESC`
  ).all({ tenantId, from, to, branchId });
}

function bookingPortalRows(tenantId, from, to, branchId = "") {
  return db.prepare(
    `SELECT *
     FROM booking_portal_events
     WHERE tenantId = @tenantId AND substr(createdAt, 1, 10) BETWEEN @from AND @to
       ${branchFilter(branchId)}
     ORDER BY createdAt DESC`
  ).all({ tenantId, from, to, branchId });
}

function onlineRequestRows(tenantId, from, to, branchId = "") {
  return db.prepare(
    `SELECT *
     FROM online_booking_requests
     WHERE tenantId = @tenantId AND substr(createdAt, 1, 10) BETWEEN @from AND @to
       ${branchFilter(branchId)}
     ORDER BY createdAt DESC`
  ).all({ tenantId, from, to, branchId });
}

function reviewRows(tenantId, from, to, branchId = "") {
  return db.prepare(
    `SELECT *
     FROM reputation_reviews
     WHERE tenantId = @tenantId AND substr(createdAt, 1, 10) BETWEEN @from AND @to
       ${branchFilter(branchId)}
     ORDER BY createdAt DESC`
  ).all({ tenantId, from, to, branchId });
}

function paymentRows(tenantId, from, to, branchId = "") {
  return db.prepare(
    `SELECT p.*, i.total AS invoiceTotal, i.balance AS invoiceBalance, i.status AS invoiceStatus,
            i.createdAt AS invoiceCreatedAt, s.branchId, s.tenantId, s.id AS saleId
     FROM payments p
     LEFT JOIN invoices i ON i.id = p.invoiceId
     LEFT JOIN sales s ON s.id = i.saleId
     WHERE s.tenantId = @tenantId AND substr(p.createdAt, 1, 10) BETWEEN @from AND @to
       ${branchId ? "AND s.branchId = @branchId" : ""}
     ORDER BY p.createdAt DESC`
  ).all({ tenantId, from, to, branchId });
}

function appointmentRows(tenantId, from, to, branchId = "") {
  const params = { tenantId, from, to, branchId };
  return db.prepare(
    `SELECT a.*, c.name AS clientName, s.name AS staffName
     FROM appointments a
     LEFT JOIN clients c ON c.id = a.clientId AND c.tenantId = a.tenantId
     LEFT JOIN staff s ON s.id = a.staffId AND s.tenantId = a.tenantId
     WHERE a.tenantId = @tenantId AND substr(a.startAt, 1, 10) BETWEEN @from AND @to
       ${branchFilter(branchId, "a")}
     ORDER BY a.startAt`
  ).all(params);
}

function normalizeSaleItems(sales) {
  const items = [];
  for (const sale of sales) {
    const parsed = safeJson(sale.items, []);
    if (!Array.isArray(parsed)) continue;
    for (const item of parsed) {
      items.push({
        ...item,
        saleId: sale.id,
        branchId: sale.branchId,
        staffId: sale.staffId,
        createdAt: sale.createdAt
      });
    }
  }
  return items;
}

function revenueByService(sales) {
  const grouped = new Map();
  for (const item of normalizeSaleItems(sales)) {
    if ((item.type || "service") !== "service") continue;
    const name = item.name || item.serviceName || item.id || "Service";
    grouped.set(name, (grouped.get(name) || 0) + Number(item.total || item.price || 0) * Number(item.quantity || 1));
  }
  const total = [...grouped.values()].reduce((sum, value) => sum + value, 0);
  return [...grouped.entries()]
    .map(([service, value]) => ({ service, value: money(value), pct: total ? pct((value * 100) / total) : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function peakHours(appointments) {
  const grouped = new Map();
  for (const appointment of appointments) {
    const hour = (appointment.startAt || "").slice(11, 13) || "00";
    grouped.set(hour, (grouped.get(hour) || 0) + 1);
  }
  return [...grouped.entries()].map(([hour, bookings]) => ({ hour: `${hour}:00`, bookings })).sort((a, b) => a.hour.localeCompare(b.hour));
}

function serviceTimeVariance(appointments, servicesById) {
  const grouped = new Map();
  for (const appointment of appointments) {
    const ids = safeJson(appointment.serviceIds, []);
    const serviceId = Array.isArray(ids) ? ids[0] : ids;
    const service = servicesById.get(serviceId) || {};
    const start = new Date(appointment.startAt).getTime();
    const end = appointment.endAt ? new Date(appointment.endAt).getTime() : 0;
    const actual = end > start ? Math.round((end - start) / 60000) : Number(service.durationMinutes || 30);
    const planned = Number(service.durationMinutes || 30);
    const name = service.name || serviceId || "Service";
    const current = grouped.get(name) || { service: name, plannedMin: 0, actualMin: 0, count: 0 };
    current.plannedMin += planned;
    current.actualMin += actual;
    current.count += 1;
    grouped.set(name, current);
  }
  return [...grouped.values()].map((row) => ({
    service: row.service,
    avgPlannedMin: row.count ? Math.round(row.plannedMin / row.count) : 0,
    avgActualMin: row.count ? Math.round(row.actualMin / row.count) : 0,
    variancePct: row.plannedMin ? pct(((row.actualMin - row.plannedMin) * 100) / row.plannedMin) : 0,
    bufferRecommendationMin: row.actualMin > row.plannedMin ? Math.ceil((row.actualMin - row.plannedMin) / Math.max(1, row.count)) : 0
  })).sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct)).slice(0, 10);
}

function walkInRatio(summaryRowsForRange) {
  const walkins = sumRows(summaryRowsForRange, "walkin_count");
  const appointments = sumRows(summaryRowsForRange, "appointments_count");
  return {
    walkins,
    appointments,
    ratioPct: appointments ? pct((walkins * 100) / appointments) : 0,
    appointmentCount: Math.max(0, appointments - walkins)
  };
}

function averageVisitGap(tenantId) {
  const rows = db.prepare(
    `SELECT customer_id, total_visits, avg_gap_days, last_visit_date, segment, clv
     FROM customer_metrics
     WHERE tenant_id = ?
     ORDER BY avg_gap_days DESC
     LIMIT 20`
  ).all(tenantId);
  const avg = rows.length ? rows.reduce((sum, row) => sum + Number(row.avg_gap_days || 0), 0) / rows.length : 0;
  return {
    avgGapDays: money(avg),
    atRiskCustomers: rows.filter((row) => Number(row.avg_gap_days || 0) > 45 || ["At-Risk", "Cant-Lose", "Lost"].includes(row.segment)).length,
    topRisks: rows
  };
}

function tipsSnapshot(sales, staffById) {
  const byMode = new Map();
  const byStaff = new Map();
  let totalTips = 0;
  let totalRevenue = 0;
  for (const sale of sales) {
    totalRevenue += Number(sale.total || 0);
    const payments = safeJson(sale.splitPayments, []);
    if (!Array.isArray(payments)) continue;
    for (const payment of payments) {
      const tip = Number(payment.tip || payment.tipAmount || 0);
      if (!tip) continue;
      totalTips += tip;
      const mode = payment.mode || "unknown";
      byMode.set(mode, (byMode.get(mode) || 0) + tip);
      const staffName = staffById.get(sale.staffId)?.name || sale.staffId || "Unassigned";
      byStaff.set(staffName, (byStaff.get(staffName) || 0) + tip);
    }
  }
  return {
    totalTips: money(totalTips),
    tipPctOfBill: totalRevenue ? pct((totalTips * 100) / totalRevenue) : 0,
    byMode: [...byMode.entries()].map(([mode, value]) => ({ mode, value: money(value) })),
    byStaff: [...byStaff.entries()].map(([staff, value]) => ({ staff, value: money(value) })).sort((a, b) => b.value - a.value)
  };
}

function serviceMargins(sales, servicesById, productsById) {
  const byService = new Map();
  for (const item of normalizeSaleItems(sales)) {
    if ((item.type || "service") !== "service") continue;
    const service = servicesById.get(item.id) || servicesById.get(item.serviceId) || {};
    const required = safeJson(service.requiredProducts, []);
    const productCost = Array.isArray(required)
      ? required.reduce((sum, req) => {
          const product = productsById.get(req.productId || req.id) || {};
          return sum + Number(product.unitCost || 0) * Number(req.quantity || 1);
        }, 0)
      : 0;
    const name = service.name || item.name || item.id || "Service";
    const revenue = Number(item.total || item.price || service.price || 0) * Number(item.quantity || 1);
    const commission = Number(item.commission || 0);
    const current = byService.get(name) || { service: name, revenue: 0, productCost: 0, commission: 0, count: 0 };
    current.revenue += revenue;
    current.productCost += productCost;
    current.commission += commission;
    current.count += 1;
    byService.set(name, current);
  }
  return [...byService.values()].map((row) => {
    const margin = row.revenue - row.productCost - row.commission;
    return {
      ...row,
      revenue: money(row.revenue),
      productCost: money(row.productCost),
      commission: money(row.commission),
      grossMargin: money(margin),
      marginPct: row.revenue ? pct((margin * 100) / row.revenue) : 0
    };
  }).sort((a, b) => b.grossMargin - a.grossMargin).slice(0, 10);
}

function gstSnapshot(sales, servicesById, branchById) {
  const byRate = new Map();
  let taxable = 0;
  let gst = 0;
  for (const sale of sales) {
    taxable += Number(sale.subtotal || 0) - Number(sale.discount || 0);
    gst += Number(sale.gstAmount || 0);
    for (const item of normalizeSaleItems([sale])) {
      const service = servicesById.get(item.id) || servicesById.get(item.serviceId) || {};
      const rate = Number(item.gstRate || service.gstRate || 18);
      byRate.set(rate, (byRate.get(rate) || 0) + Number(item.total || item.price || 0) * Number(item.quantity || 1));
    }
  }
  return {
    taxableValue: money(taxable),
    gstAmount: money(gst),
    cgst: money(gst / 2),
    sgst: money(gst / 2),
    igst: 0,
    hsnSummary: [...byRate.entries()].map(([gstRate, taxableValue]) => ({ hsnSac: "999729", gstRate, taxableValue: money(taxableValue) })),
    branchCount: branchById.size
  };
}

function refundSnapshot(sales, financeRefunds = []) {
  const saleRefunds = sales.filter((sale) => ["refunded", "refund", "void"].includes(String(sale.status || "").toLowerCase()));
  const refunds = [
    ...saleRefunds.map((sale) => ({
      id: sale.id,
      saleId: sale.id,
      clientId: sale.clientId,
      amount: Number(sale.total || 0),
      reason: sale.status || "Sale refund",
      status: sale.status,
      createdAt: sale.createdAt
    })),
    ...financeRefunds
  ];
  const total = sales.length;
  return {
    refundRatePct: total ? pct((refunds.length * 100) / total) : 0,
    refundAmount: money(refunds.reduce((sum, refund) => sum + Number(refund.amount || refund.total || 0), 0)),
    count: refunds.length,
    reasons: refunds.map((refund) => ({
      refundId: refund.id,
      saleId: refund.saleId || "",
      client: refund.clientName || refund.clientId || "",
      amount: money(refund.amount || refund.total || 0),
      reason: refund.reason || refund.status || "Refund",
      createdAt: refund.createdAt
    })).slice(0, 10)
  };
}

function auditTrailSnapshot(tenantId, from, to) {
  return db.prepare(
    `SELECT action, entity_type AS entityType, entity_id AS entityId, user_id AS userId, created_at AS createdAt
     FROM audit_log
     WHERE tenant_id = @tenantId AND substr(created_at, 1, 10) BETWEEN @from AND @to
     ORDER BY created_at DESC
     LIMIT 20`
  ).all({ tenantId, from, to });
}

function monthDiff(startMonth, endDate) {
  const [startYear, startMonthIndex] = String(startMonth).split("-").map(Number);
  const end = new Date(endDate);
  if (!startYear || !startMonthIndex || Number.isNaN(end.getTime())) return -1;
  return (end.getUTCFullYear() - startYear) * 12 + (end.getUTCMonth() + 1 - startMonthIndex);
}

function cohortAnalysis(tenantId) {
  const metrics = db.prepare(
    `SELECT c.id, c.createdAt, cm.last_visit_date AS lastVisitDate
     FROM clients c
     LEFT JOIN customer_metrics cm ON cm.customer_id = c.id AND cm.tenant_id = c.tenantId
     WHERE c.tenantId = ?`
  ).all(tenantId);
  const visits = db.prepare(
    `SELECT clientId, substr(startAt, 1, 10) AS visitDate
     FROM appointments
     WHERE tenantId = ? AND status IN ('completed','billed','paid')
     ORDER BY startAt`
  ).all(tenantId);
  const visitsByClient = new Map();
  for (const visit of visits) {
    const list = visitsByClient.get(visit.clientId) || [];
    list.push(visit.visitDate);
    visitsByClient.set(visit.clientId, list);
  }
  const cohorts = new Map();
  const now = new Date();
  for (const row of metrics) {
    const cohort = (row.createdAt || "").slice(0, 7) || "Unknown";
    const active = row.lastVisitDate && (now - new Date(row.lastVisitDate)) / dayMs <= 90;
    const item = cohorts.get(cohort) || {
      cohort,
      customers: 0,
      active: 0,
      months: Array.from({ length: 6 }, (_, month) => ({ month, retained: 0, retentionPct: 0 }))
    };
    item.customers += 1;
    if (active) item.active += 1;
    for (const visitDate of visitsByClient.get(row.id) || []) {
      const month = monthDiff(cohort, visitDate);
      if (month >= 0 && month < item.months.length) item.months[month].retained += 1;
    }
    cohorts.set(cohort, item);
  }
  return [...cohorts.values()].map((row) => ({
    ...row,
    retentionPct: row.customers ? pct((row.active * 100) / row.customers) : 0,
    months: row.months.map((month) => ({
      ...month,
      retentionPct: row.customers ? pct((month.retained * 100) / row.customers) : 0
    }))
  })).slice(-12);
}

function rfmSegments(tenantId) {
  return db.prepare(
    `SELECT segment, COUNT(*) AS customerCount, COALESCE(SUM(clv), 0) AS totalCLV, COALESCE(AVG(clv), 0) AS avgCLV
     FROM customer_metrics
     WHERE tenant_id = ?
     GROUP BY segment
     ORDER BY totalCLV DESC`
  ).all(tenantId).map((row) => ({
    segment: row.segment || "Unclassified",
    customerCount: Number(row.customerCount || 0),
    totalCLV: money(row.totalCLV),
    avgCLV: money(row.avgCLV)
  }));
}

function serviceProfitabilityMatrix(margins, revenueByServiceRows) {
  const demandMap = new Map(revenueByServiceRows.map((row) => [row.service, row.value]));
  const avgDemand = revenueByServiceRows.length ? revenueByServiceRows.reduce((sum, row) => sum + row.value, 0) / revenueByServiceRows.length : 0;
  const avgMargin = margins.length ? margins.reduce((sum, row) => sum + row.marginPct, 0) / margins.length : 0;
  return margins.map((row) => {
    const demand = demandMap.get(row.service) || 0;
    const quadrant = demand >= avgDemand && row.marginPct >= avgMargin
      ? "Stars"
      : demand >= avgDemand
        ? "Workhorses"
        : row.marginPct >= avgMargin
          ? "Hidden Gems"
          : "Drop Candidates";
    const action = {
      Stars: "Push aggressively in campaigns and staff recommendations.",
      Workhorses: "Review price, timing, product usage and commission leakage.",
      "Hidden Gems": "Market more; low demand but margin is strong.",
      "Drop Candidates": "Reprice, repackage or reduce promotion priority."
    }[quadrant];
    return {
      service: row.service,
      demand: money(demand),
      bookings: row.count || 0,
      revenue: row.revenue,
      productCost: row.productCost,
      commission: row.commission,
      grossMargin: row.grossMargin,
      marginPct: row.marginPct,
      quadrant,
      action
    };
  }).sort((a, b) => b.grossMargin - a.grossMargin);
}

function occupancyHeatmap(appointments) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array.from({ length: 12 }, (_, index) => `${9 + index}:00`);
  const cells = days.map(() => hours.map(() => 0));
  for (const appointment of appointments) {
    const date = new Date(appointment.startAt);
    const day = date.getUTCDay();
    const hour = date.getUTCHours();
    const hourIndex = hours.indexOf(`${hour}:00`);
    if (hourIndex >= 0) cells[day][hourIndex] += 1;
  }
  const max = Math.max(1, ...cells.flat());
  return {
    days,
    hours,
    cells: cells.map((row) => row.map((value) => pct((value * 100) / max)))
  };
}

function bookingFunnel(appointments, portalEvents = [], onlineRequests = []) {
  const countEvents = (...types) => portalEvents.filter((event) => types.includes(String(event.type || "").toLowerCase())).length;
  const requested = Math.max(appointments.length, onlineRequests.length, countEvents("visit", "portal_visit", "booking_started"));
  const serviceSelected = Math.max(countEvents("service_selected", "service-selected"), onlineRequests.filter((request) => safeJson(request.serviceIds, []).length).length);
  const slotPicked = Math.max(countEvents("slot_picked", "slot-picked"), onlineRequests.filter((request) => request.selectedSlotAt).length);
  const details = Math.max(countEvents("customer_details", "customer-details"), onlineRequests.filter((request) => request.clientId || Object.keys(safeJson(request.clientInfo, {})).length).length);
  const paid = Math.max(countEvents("payment", "payment_completed", "payment-completed"), appointments.filter((item) => ["paid", "billed", "completed"].includes(String(item.status || "").toLowerCase())).length);
  const confirmed = Math.max(countEvents("confirmed", "booking_confirmed", "booking-confirmed"), appointments.filter((item) => ["confirmed", "booked", "completed", "billed", "paid"].includes(String(item.status || "").toLowerCase())).length);
  const withDrop = (step, count, previous) => ({ step, count, dropOffPct: previous ? pct(((previous - count) * 100) / previous) : 0 });
  return [
    withDrop("Portal visit", requested, requested),
    withDrop("Service selected", serviceSelected || requested, requested),
    withDrop("Slot picked", slotPicked || confirmed, serviceSelected || requested),
    withDrop("Customer details", details || confirmed, slotPicked || confirmed),
    withDrop("Payment", paid, details || confirmed),
    withDrop("Confirmed", confirmed, paid || details || requested)
  ];
}

function priceElasticity(sales) {
  const discounted = sales.filter((sale) => Number(sale.discount || sale.couponDiscount || 0) > 0);
  const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const discountedRevenue = discounted.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  return {
    discountedInvoices: discounted.length,
    discountSharePct: sales.length ? pct((discounted.length * 100) / sales.length) : 0,
    discountedRevenue: money(discountedRevenue),
    discountFatigueRisk: totalRevenue && discountedRevenue / totalRevenue > 0.5 ? "medium" : "low"
  };
}

function npsSentiment(reviews = []) {
  const total = reviews.length;
  const promoters = reviews.filter((review) => Number(review.rating || 0) >= 4.5).length;
  const detractors = reviews.filter((review) => Number(review.rating || 0) <= 3).length;
  const avgRating = total ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / total : 0;
  const sentiment = reviews.reduce((acc, review) => {
    const key = String(review.sentiment || "neutral").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  if (!total) {
    return {
      nps: 0,
      reviewsAnalyzed: 0,
      averageRating: 0,
      sentiment: {},
      negativeReviews: [],
      action: "Connect Google reviews to activate sentiment dashboard"
    };
  }
  return {
    nps: pct(((promoters - detractors) * 100) / total),
    reviewsAnalyzed: total,
    averageRating: pct(avgRating),
    sentiment,
    negativeReviews: reviews.filter((review) => Number(review.rating || 0) <= 3).map((review) => ({
      id: review.id,
      reviewer: review.reviewer,
      rating: review.rating,
      text: review.reviewText,
      status: review.status,
      createdAt: review.createdAt
    })).slice(0, 10),
    action: detractors ? "Prioritize manager callbacks for low-rated reviews." : "Maintain review request cadence."
  };
}

function razorpaySettlementSnapshot(payments = []) {
  const gatewayPayments = payments.filter((payment) => /razorpay|gateway|online|upi/i.test(`${payment.mode} ${payment.reference}`));
  const gross = gatewayPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const estimatedFees = gross * 0.02;
  const expectedSettlement = gross - estimatedFees;
  const pending = gatewayPayments.filter((payment) => !/settled|bank|utr/i.test(String(payment.reference || "")));
  return {
    status: gatewayPayments.length ? "Gateway payments detected" : "No Razorpay gateway payments in range",
    gatewayPayments: gatewayPayments.length,
    grossReceived: money(gross),
    estimatedFees: money(estimatedFees),
    expectedSettlement: money(expectedSettlement),
    pendingSettlement: money(pending.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
    mismatches: 0,
    alerts: pending.slice(0, 10).map((payment) => ({
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      amount: money(payment.amount),
      reference: payment.reference || "Missing settlement reference"
    }))
  };
}

function capacityPlanning(staffRows, appointments) {
  const bookedMin = appointments.reduce((sum, appointment) => {
    const start = new Date(appointment.startAt).getTime();
    const end = appointment.endAt ? new Date(appointment.endAt).getTime() : 0;
    return sum + (end > start ? (end - start) / 60000 : 30);
  }, 0);
  const staffCapacity = Math.max(1, staffRows.length) * 10 * 60;
  return {
    staffCount: staffRows.length,
    bookedMinutes: Math.round(bookedMin),
    capacityMinutes: staffCapacity,
    utilizationPct: pct((bookedMin * 100) / staffCapacity),
    hiringSignal: bookedMin / staffCapacity > 0.85 ? "Review hiring or extended shifts" : "Capacity healthy"
  };
}

function clvSnapshot(tenantId) {
  const row = db.prepare(
    `SELECT COUNT(*) AS customers, COALESCE(AVG(clv), 0) AS avgClv, COALESCE(SUM(clv), 0) AS totalClv
     FROM customer_metrics
     WHERE tenant_id = ?`
  ).get(tenantId);
  return {
    customers: Number(row.customers || 0),
    avgClv: money(row.avgClv),
    totalClv: money(row.totalClv),
    cacToClvRatio: "1:3 target"
  };
}

function anomalyList(tenantId, status = "open") {
  return db.prepare(
    `SELECT id, type, severity, title, message, entity_ref AS entityRef, status, created_at AS createdAt
     FROM alerts
     WHERE tenant_id = @tenantId AND (@status = 'all' OR status = @status)
     ORDER BY created_at DESC
     LIMIT 30`
  ).all({ tenantId, status });
}

function staffRows(tenantId, branchId = "") {
  return db.prepare(
    `SELECT * FROM staff WHERE tenantId = @tenantId ${branchId ? "AND branchId = @branchId" : ""}`
  ).all({ tenantId, branchId });
}

function lookupMap(table, tenantId) {
  return new Map(db.prepare(`SELECT * FROM ${table} WHERE tenantId = ?`).all(tenantId).map((row) => [row.id, row]));
}

export class DashboardService {
  getExecutiveDashboard({ tenantId, branchId = "", query = {} }) {
    const { range, from, to } = rangeFromQuery(query);
    const cacheKey = `dashboard:executive:${tenantId}:${range}:${from}:${to}:${branchId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    ensureRangeSummaries(tenantId, from, to);
    const prev = previousRange({ from, to });
    ensureRangeSummaries(tenantId, prev.from, prev.to);

    const current = summaryRows(tenantId, from, to, branchId);
    const previous = summaryRows(tenantId, prev.from, prev.to, branchId);
    const sales = salesRows(tenantId, from, to, branchId);
    const appointments = appointmentRows(tenantId, from, to, branchId);
    const refunds = refundRows(tenantId, from, to, branchId);
    const portalEvents = bookingPortalRows(tenantId, from, to, branchId);
    const onlineRequests = onlineRequestRows(tenantId, from, to, branchId);
    const reviews = reviewRows(tenantId, from, to, branchId);
    const payments = paymentRows(tenantId, from, to, branchId);
    const servicesById = lookupMap("services", tenantId);
    const productsById = lookupMap("products", tenantId);
    const staffById = lookupMap("staff", tenantId);
    const branchById = lookupMap("branches", tenantId);
    const staffList = staffRows(tenantId, branchId);
    const staffRevenue = topStaffFromSummary(tenantId, from, to, branchId);
    const serviceRevenue = revenueByService(sales);
    const margins = serviceMargins(sales, servicesById, productsById);
    const appointmentCount = sumRows(current, "appointments_count");

    const response = {
      range: { key: range, from, to, previous: prev },
      kpis: {
        revenue: metric(current, previous, "revenue", money),
        appointments: metric(current, previous, "appointments_count", (value) => Number(value || 0)),
        newCustomers: metric(current, previous, "new_customers", (value) => Number(value || 0)),
        avgTicket: {
          value: appointmentCount ? money(sumRows(current, "revenue") / Math.max(1, sales.length || appointmentCount)) : 0,
          delta: 0,
          deltaPct: 0,
          trend: "flat",
          sparkline: sparkline(current, "avg_ticket")
        },
        chairUtilization: {
          value: current.length ? pct(current.reduce((sum, row) => sum + Number(row.chair_utilization_pct || 0), 0) / current.length) : 0,
          delta: 0,
          deltaPct: 0,
          trend: "flat",
          sparkline: sparkline(current, "chair_utilization_pct")
        },
        cancellationRate: ratioMetric(current, previous, "cancellations", "appointments_count"),
        noshowRate: ratioMetric(current, previous, "noshows", "appointments_count"),
        retention: ratioMetric(current, previous, "repeat_customers", "appointments_count")
      },
      charts: {
        revenueTrend: revenueTrend(current),
        revenueByService: serviceRevenue,
        revenueByStaff: staffRevenue,
        peakHours: peakHours(appointments)
      },
      alerts: anomalyList(tenantId, "open"),
      topPerformers: {
        staff: staffRevenue.slice(0, 5),
        services: serviceRevenue.slice(0, 5)
      },
      salonCritical: {
        chairUtilization: {
          summaryPct: current.length ? pct(current.reduce((sum, row) => sum + Number(row.chair_utilization_pct || 0), 0) / current.length) : 0,
          idleRisk: current.some((row) => Number(row.chair_utilization_pct || 0) < 35) ? "Idle capacity visible" : "Capacity healthy"
        },
        serviceTimeVariance: serviceTimeVariance(appointments, servicesById),
        walkInVsAppointment: walkInRatio(current),
        averageVisitGap: averageVisitGap(tenantId),
        tipDistribution: tipsSnapshot(sales, staffById),
        productChemicalCost: margins,
        gstReports: gstSnapshot(sales, servicesById, branchById),
        razorpaySettlement: razorpaySettlementSnapshot(payments),
        refundsDisputes: refundSnapshot(sales, refunds),
        auditTrail: auditTrailSnapshot(tenantId, from, to)
      },
      advanced: {
        cohortAnalysis: cohortAnalysis(tenantId),
        rfmSegmentation: rfmSegments(tenantId),
        serviceProfitabilityMatrix: serviceProfitabilityMatrix(margins, serviceRevenue),
        staffCapacityPlanning: capacityPlanning(staffList, appointments),
        customerLifetimeValue: clvSnapshot(tenantId),
        bookingFunnel: bookingFunnel(appointments, portalEvents, onlineRequests),
        occupancyHeatmap: occupancyHeatmap(appointments),
        priceElasticity: priceElasticity(sales),
        npsReviewSentiment: npsSentiment(reviews),
        anomalyDetection: anomalyList(tenantId, "all")
      },
      activity: [
        ...auditTrailSnapshot(tenantId, from, to).map((item) => ({
          type: "audit",
          title: item.action,
          subtitle: `${item.entityType || "record"} ${item.entityId || ""}`.trim(),
          createdAt: item.createdAt
        })),
        ...anomalyList(tenantId, "all").map((item) => ({
          type: "anomaly-detected",
          title: item.title,
          subtitle: item.message,
          createdAt: item.createdAt
        }))
      ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 20)
    };

    return setCached(cacheKey, response);
  }
}

export const dashboardService = new DashboardService();
