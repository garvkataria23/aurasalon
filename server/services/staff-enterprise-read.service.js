import { db } from "../db.js";
import { repositories } from "../repositories/repository-registry.js";
import { tenantService } from "./tenant.service.js";
import { smartStaffService } from "./smart-staff.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const pct = (value) => Math.round((Number(value) || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const staffRiskDetectors = [
  "burnout_risk",
  "attrition_risk",
  "low_utilization",
  "overbooking_risk",
  "revenue_leakage",
  "discount_misuse",
  "cash_handling_risk",
  "commission_anomaly",
  "attendance_manipulation",
  "repeated_client_complaints",
  "staff_client_mismatch",
  "uncertified_service_assignment"
];

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function periodFrom(query = {}) {
  const periodEnd = String(query.periodEnd || query.toDate || query.endDate || today()).slice(0, 10);
  const start = new Date(`${periodEnd}T00:00:00.000Z`);
  start.setDate(start.getDate() - 29);
  const periodStart = String(query.periodStart || query.fromDate || query.startDate || start.toISOString().slice(0, 10)).slice(0, 10);
  return { periodStart, periodEnd };
}

function rowDate(row, fields = ["createdAt", "updatedAt", "created_at", "updated_at", "date", "startAt", "start_at", "invoiceDate", "businessDate", "business_date", "eventAt", "event_at"]) {
  const value = fields.map((field) => row?.[field]).find(Boolean);
  return String(value || "").slice(0, 10);
}

function inPeriod(row, period, fields) {
  const date = rowDate(row, fields);
  return !date || (date >= period.periodStart && date <= period.periodEnd);
}

function sum(rows, selector) {
  return rows.reduce((total, row) => total + Number(selector(row) || 0), 0);
}

function staffName(row = {}) {
  return row.name || row.fullName || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.staffName || "Unassigned";
}

function totalOf(row = {}) {
  return money(row.total ?? row.totalAmount ?? row.grandTotal ?? row.netTotal ?? row.amount ?? 0);
}

function discountOf(row = {}) {
  const itemDiscount = Array.isArray(row.items) ? sum(row.items, (item) => item.discount || item.discountAmount) : 0;
  return money(row.discount ?? row.discountAmount ?? itemDiscount);
}

function paymentModeOf(row = {}) {
  if (row.paymentMode) return String(row.paymentMode).toLowerCase();
  if (row.mode) return String(row.mode).toLowerCase();
  if (Array.isArray(row.payments) && row.payments[0]?.mode) return String(row.payments[0].mode).toLowerCase();
  if (Array.isArray(row.splitPayments) && row.splitPayments[0]?.mode) return String(row.splitPayments[0].mode).toLowerCase();
  return "";
}

function serviceIdsOf(row = {}) {
  if (Array.isArray(row.serviceIds)) return row.serviceIds;
  if (Array.isArray(row.assignedServices)) return row.assignedServices;
  if (Array.isArray(row.services)) return row.services.map((item) => item.id || item.serviceId).filter(Boolean);
  if (Array.isArray(row.items)) return row.items.map((item) => item.serviceId || item.id).filter(Boolean);
  return [];
}

function minutesBetweenDateTime(start, end) {
  const startMs = new Date(start || "").getTime();
  const endMs = new Date(end || "").getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return Math.round((endMs - startMs) / 60000);
}

function shiftMinutes(row = {}) {
  const start = row.startTime || row.start_time || "";
  const end = row.endTime || row.end_time || "";
  const [startHour, startMinute] = String(start).split(":").map(Number);
  const [endHour, endMinute] = String(end).split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))) return 0;
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute));
}

function paymentTotal(row = {}, mode = "") {
  const payments = Array.isArray(row.splitPayments) ? row.splitPayments : Array.isArray(row.payments) ? row.payments : [];
  if (!payments.length) return paymentModeOf(row).includes(mode) ? totalOf(row) : 0;
  return money(sum(payments.filter((payment) => String(payment.mode || payment.paymentMode || "").toLowerCase().includes(mode)), (payment) => payment.amount));
}

function riskLevelFromScore(score) {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function riskScoreFromRatio(ratio, multiplier = 100) {
  return Math.max(0, Math.min(100, Math.round(Number(ratio || 0) * multiplier)));
}

function resolveBranch(query = {}, access = {}) {
  const branchId = String(query.branchId || access.requestedBranchId || "").trim();
  if (branchId) tenantService.assertBranchAccess(access, branchId);
  return branchId;
}

function scopedQuery(access, branchId) {
  return branchId ? { tenantId: access.tenantId, branchId } : tenantService.accessScope(access);
}

function tableExists(table) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function tableColumns(table) {
  if (!tableExists(table)) return [];
  return db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
}

function optionalRows(table, access, { branchId = "", limit = 100, staffId = "", orderBy = "createdAt" } = {}) {
  const columns = tableColumns(table);
  if (!columns.length) return { rows: [], schemaReady: false };
  const tenantColumn = columns.includes("tenantId") ? "tenantId" : columns.includes("tenant_id") ? "tenant_id" : "";
  const branchColumn = columns.includes("branchId") ? "branchId" : columns.includes("branch_id") ? "branch_id" : "";
  const staffColumn = columns.includes("staffId") ? "staffId" : columns.includes("staff_id") ? "staff_id" : "";
  const safeOrder = columns.includes(orderBy)
    ? orderBy
    : columns.includes("createdAt")
      ? "createdAt"
      : columns.includes("created_at")
        ? "created_at"
        : columns.includes("id")
          ? "id"
          : columns[0];
  const where = [];
  const params = {};
  if (tenantColumn) {
    where.push(`${tenantColumn} = @tenantId`);
    params.tenantId = access.tenantId;
  }
  if (branchId && branchColumn) {
    where.push(`${branchColumn} = @branchId`);
    params.branchId = branchId;
  }
  if (staffId && staffColumn) {
    where.push(`${staffColumn} = @staffId`);
    params.staffId = staffId;
  }
  params.limit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const sql = `SELECT * FROM ${table}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY ${safeOrder} DESC LIMIT @limit`;
  return { rows: db.prepare(sql).all(params), schemaReady: true };
}

function listRepository(repo, query, access, period, dateFields) {
  try {
    return repo.list(query, scopedQuery(access, query.branchId || "")).filter((row) => inPeriod(row, period, dateFields));
  } catch {
    return [];
  }
}

function groupedByStaff(rows) {
  const map = new Map();
  for (const row of rows) {
    const staffId = row.staffId || row.staff_id || "";
    if (!staffId) continue;
    if (!map.has(staffId)) map.set(staffId, []);
    map.get(staffId).push(row);
  }
  return map;
}

function buildEnterpriseContext(query = {}, access) {
  const period = periodFrom(query);
  const branchId = resolveBranch(query, access);
  const input = { ...query, ...period, branchId };
  const summary = smartStaffService.summary(input, access);
  const context = smartStaffService.context(input, access);
  const repoQuery = { branchId, limit: 10000 };
  const invoices = listRepository(repositories.invoices, repoQuery, access, period, ["createdAt", "invoiceDate", "date"]);
  const commissionRuns = listRepository(repositories.staffCommissionRuns, repoQuery, access, period, ["createdAt", "periodStart"]);
  const payrollExports = listRepository(repositories.payrollExports, repoQuery, access, period, ["createdAt", "periodStart"]);
  const staffReviews = optionalRows("staff_reviews", access, { limit: 10000, orderBy: "created_at" }).rows
    .filter((row) => inPeriod(row, period, ["created_at", "createdAt"]));
  const reputationReviews = optionalRows("reviews_v2", access, { branchId, limit: 10000, orderBy: "reviewed_at" }).rows
    .filter((row) => inPeriod(row, period, ["reviewed_at", "imported_at", "updated_at", "created_at"]));
  const skillLicenses = optionalRows("staff_skill_licenses", access, { branchId, limit: 10000 }).rows.map((row) => normalizeCamelJson(row, ["evidenceJson"]));
  return {
    access,
    branchId,
    period,
    summary,
    staff: context.staff || [],
    sales: context.sales || [],
    appointments: context.appointments || [],
    attendance: context.attendance || [],
    shifts: context.shifts || [],
    services: context.services || [],
    invoices,
    commissionRuns,
    payrollExports,
    staffReviews,
    reputationReviews,
    skillLicenses,
    ranking: summary.ranking || [],
    commission: summary.commission || { entries: [], summary: {} },
    payrollPreview: summary.payrollPreview || []
  };
}

function calculatedRiskSignals(ctx) {
  const signals = [];
  const rankingById = new Map(ctx.ranking.map((row) => [row.staffId, row]));
  const appointmentsByStaff = groupedByStaff(ctx.appointments);
  const salesByStaff = groupedByStaff(ctx.sales);
  const commissionByStaff = groupedByStaff(ctx.commission.entries || []);
  const attendanceByStaff = groupedByStaff(ctx.attendance);
  const shiftsByStaff = groupedByStaff(ctx.shifts);
  const reviewsByStaff = groupedByStaff(ctx.staffReviews || []);
  const reputationByStaff = new Map();
  const serviceById = new Map(ctx.services.map((service) => [service.id, service]));
  for (const review of ctx.reputationReviews || []) {
    const staffId = review.primary_staff_id || review.primaryStaffId || "";
    if (!staffId) continue;
    if (!reputationByStaff.has(staffId)) reputationByStaff.set(staffId, []);
    reputationByStaff.get(staffId).push(review);
  }

  for (const person of ctx.staff) {
    const ranking = rankingById.get(person.id) || {};
    const appointments = appointmentsByStaff.get(person.id) || [];
    const sales = salesByStaff.get(person.id) || [];
    const commissionEntries = commissionByStaff.get(person.id) || [];
    const attendance = attendanceByStaff.get(person.id) || [];
    const shifts = shiftsByStaff.get(person.id) || [];
    const staffReviews = reviewsByStaff.get(person.id) || [];
    const reputationReviews = reputationByStaff.get(person.id) || [];
    const cancelled = appointments.filter((item) => ["cancelled", "canceled", "no-show"].includes(String(item.status || "").toLowerCase())).length;
    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter((item) => ["completed", "done", "checked_out", "checkout"].includes(String(item.status || "").toLowerCase())).length;
    const cashTotal = sum(sales, (sale) => paymentTotal(sale, "cash"));
    const totalPaid = sum(sales, totalOf);
    const cashRatio = totalPaid ? cashTotal / totalPaid : 0;
    const discountTotal = sum(sales, discountOf);
    const discountedSales = sales.filter((sale) => discountOf(sale) > 0).length;
    const revenue = Number(ranking.revenue || sum(sales, (item) => item.total));
    const commissionTotal = sum(commissionEntries, (entry) => entry.commission);
    const scheduledMinutes = Math.max(0, sum(shifts, shiftMinutes));
    const bookedMinutes = Math.max(0, sum(appointments, (appointment) => minutesBetweenDateTime(appointment.startAt || appointment.start_at, appointment.endAt || appointment.end_at)));
    const workedMinutes = Math.max(0, sum(attendance, (row) => row.minutesWorked || row.minutes_worked));
    const overtimeMinutes = Math.max(0, sum(attendance, (row) => row.overtimeMinutes || row.overtime_minutes));
    const utilization = scheduledMinutes ? bookedMinutes / scheduledMinutes : totalAppointments ? 1 : 0;
    const cancellationRate = totalAppointments ? cancelled / totalAppointments : 0;
    const completionRate = totalAppointments ? completedAppointments / totalAppointments : 0;
    const attendanceScore = Number(ranking.attendanceScore ?? 100);
    const performanceScore = Number(ranking.performanceScore ?? 100);
    const serviceEfficiency = Number(ranking.serviceEfficiency ?? 100);
    const discountRatio = revenue ? discountTotal / revenue : 0;
    const commissionRatio = revenue ? commissionTotal / revenue : 0;
    const negativeReviews = [
      ...staffReviews.filter((review) => Number(review.rating || 0) <= 3 || Number(review.complaintFlag || review.complaint_flag || 0) === 1 || /negative|complaint|angry|poor|bad/i.test(String(review.sentiment || review.review_text || review.feedback || ""))),
      ...reputationReviews.filter((review) => Number(review.rating || 0) <= 3 || /negative|complaint|angry|poor|bad/i.test(String(review.sentiment || review.review_text || review.reviewText || "")))
    ];
    const lateOrAbsent = attendance.filter((row) => ["late", "absent", "missing", "corrected"].includes(String(row.status || "").toLowerCase())).length;
    const suspiciousAttendance = attendance.filter((row) => {
      const status = String(row.status || "").toLowerCase();
      const minutes = Number(row.minutesWorked || row.minutes_worked || 0);
      const notes = String(row.notes || row.reason || "").toLowerCase();
      return notes.includes("manual") || notes.includes("correct") || notes.includes("edit") || (status === "present" && minutes <= 0) || Number(row.overtimeMinutes || row.overtime_minutes || 0) >= 180;
    }).length;
    const serviceIds = new Set([
      ...serviceIdsOf(person),
      ...appointments.flatMap(serviceIdsOf),
      ...sales.flatMap(serviceIdsOf)
    ].filter(Boolean));
    const licenses = (ctx.skillLicenses || []).filter((license) => license.staffId === person.id && String(license.status || "active").toLowerCase() !== "archived");
    const certifiedServiceIds = new Set(licenses
      .filter((license) => ["certified", "approved", "active"].includes(String(license.certificationStatus || "").toLowerCase()))
      .map((license) => license.serviceId)
      .filter(Boolean));
    const uncertifiedServices = [...serviceIds].filter((serviceId) => {
      if (!serviceId) return false;
      if (!licenses.length) return true;
      return !certifiedServiceIds.has(serviceId);
    });

    addSignal("burnout_risk", Math.max(
      riskScoreFromRatio(overtimeMinutes / 600, 100),
      riskScoreFromRatio(utilization - 0.85, 220),
      attendanceScore < 75 ? 55 : 15
    ), person, [
      overtimeMinutes >= 180 ? `${overtimeMinutes} overtime minutes in selected period.` : "",
      utilization >= 0.9 ? `${pct(utilization * 100)}% booked utilization against rostered minutes.` : "",
      attendanceScore < 75 ? `Attendance score is ${pct(attendanceScore)}.` : ""
    ], "Review workload, break allocation, and peak-hour roster pressure.", { overtimeMinutes, utilization: pct(utilization * 100), attendanceScore });

    addSignal("attrition_risk", Math.max(
      performanceScore < 55 ? 65 : 15,
      attendanceScore < 70 ? 70 : 10,
      negativeReviews.length >= 2 ? 70 : negativeReviews.length ? 45 : 10,
      revenue <= 0 && totalAppointments > 0 ? 55 : 10
    ), person, [
      performanceScore < 55 ? `Performance score is ${pct(performanceScore)}.` : "",
      attendanceScore < 70 ? `Attendance score is ${pct(attendanceScore)}.` : "",
      negativeReviews.length ? `${negativeReviews.length} negative or complaint-linked reviews.` : "",
      revenue <= 0 && totalAppointments > 0 ? "Booked work has no matching revenue in the selected period." : ""
    ], "Schedule manager check-in, coaching plan, and retention conversation.", { performanceScore, attendanceScore, negativeReviewCount: negativeReviews.length, revenue, totalAppointments });

    addSignal("low_utilization", Math.max(
      scheduledMinutes >= 300 && utilization < 0.35 ? 72 : utilization < 0.5 && scheduledMinutes >= 300 ? 48 : 10,
      totalAppointments === 0 && shifts.length ? 55 : 10
    ), person, [
      scheduledMinutes >= 300 ? `${pct(utilization * 100)}% utilization across ${scheduledMinutes} scheduled minutes.` : "",
      totalAppointments === 0 && shifts.length ? "Rostered shifts have no appointment allocation." : ""
    ], "Move demand, assign walk-ins, or reduce idle roster blocks.", { scheduledMinutes, bookedMinutes, utilization: pct(utilization * 100), shifts: shifts.length, totalAppointments });

    addSignal("overbooking_risk", Math.max(
      scheduledMinutes > 0 && bookedMinutes > scheduledMinutes * 1.1 ? 78 : 10,
      totalAppointments >= Math.max(1, shifts.length) * 6 ? 70 : 10
    ), person, [
      scheduledMinutes > 0 && bookedMinutes > scheduledMinutes ? `${bookedMinutes} booked minutes against ${scheduledMinutes} scheduled minutes.` : "",
      totalAppointments >= Math.max(1, shifts.length) * 6 ? `${totalAppointments} appointments across ${Math.max(1, shifts.length)} shift blocks.` : ""
    ], "Add buffer, move non-critical appointments, or assign backup staff.", { scheduledMinutes, bookedMinutes, totalAppointments, shifts: shifts.length });

    addSignal("revenue_leakage", Math.max(
      discountRatio >= 0.2 ? 80 : discountRatio >= 0.12 ? 55 : 10,
      revenue <= 0 && completedAppointments > 0 ? 75 : 10,
      completionRate < 0.5 && totalAppointments >= 4 ? 55 : 10
    ), person, [
      discountRatio >= 0.12 ? `Discounts are ${pct(discountRatio * 100)}% of revenue.` : "",
      revenue <= 0 && completedAppointments > 0 ? `${completedAppointments} completed appointments have no matched revenue.` : "",
      completionRate < 0.5 && totalAppointments >= 4 ? `Completion rate is ${pct(completionRate * 100)}%.` : ""
    ], "Audit invoices, discounts, and checkout completion before payroll closure.", { revenue, discountTotal, discountRatio: pct(discountRatio * 100), completedAppointments, completionRate: pct(completionRate * 100) });

    addSignal("discount_misuse", Math.max(
      discountRatio >= 0.25 ? 86 : discountRatio >= 0.15 ? 62 : 10,
      discountedSales >= 3 ? 58 : 10
    ), person, [
      discountRatio >= 0.15 ? `Discount ratio is ${pct(discountRatio * 100)}%.` : "",
      discountedSales >= 3 ? `${discountedSales} discounted bills in selected period.` : ""
    ], "Require manager approval for further discounts and review bill-level reasons.", { discountTotal, discountRatio: pct(discountRatio * 100), discountedSales, revenue });

    addSignal("cash_handling_risk", Math.max(
      cashTotal >= 20000 ? 85 : cashTotal >= 10000 ? 60 : 10,
      cashRatio >= 0.75 && totalPaid >= 5000 ? 70 : 10
    ), person, [
      cashTotal >= 10000 ? `Cash collection linked to staff is ${money(cashTotal)}.` : "",
      cashRatio >= 0.75 && totalPaid >= 5000 ? `Cash share is ${pct(cashRatio * 100)}% of staff payments.` : ""
    ], "Cross-check cash drawer, payment splits, and invoice closure notes.", { cashTotal: money(cashTotal), totalPaid: money(totalPaid), cashRatio: pct(cashRatio * 100) });

    addSignal("commission_anomaly", Math.max(
      commissionRatio >= 0.4 ? 88 : commissionRatio >= 0.28 ? 62 : 10,
      commissionTotal > revenue && commissionTotal > 0 ? 92 : 10
    ), person, [
      commissionRatio >= 0.28 ? `Commission is ${pct(commissionRatio * 100)}% of staff revenue.` : "",
      commissionTotal > revenue && commissionTotal > 0 ? "Commission exceeds attributed revenue." : ""
    ], "Hold payroll export until commission rule and invoice attribution are reviewed.", { commissionTotal: money(commissionTotal), revenue: money(revenue), commissionRatio: pct(commissionRatio * 100) });

    addSignal("attendance_manipulation", Math.max(
      suspiciousAttendance >= 2 ? 82 : suspiciousAttendance ? 55 : 10,
      lateOrAbsent >= 3 ? 62 : 10,
      overtimeMinutes >= 360 ? 72 : 10
    ), person, [
      suspiciousAttendance ? `${suspiciousAttendance} attendance rows need manual/correction review.` : "",
      lateOrAbsent >= 3 ? `${lateOrAbsent} late/absent/missing attendance marks.` : "",
      overtimeMinutes >= 360 ? `${overtimeMinutes} overtime minutes may need approval.` : ""
    ], "Compare biometric logs, manager approvals, and payroll inputs before finalization.", { suspiciousAttendance, lateOrAbsent, overtimeMinutes, attendanceRows: attendance.length });

    addSignal("repeated_client_complaints", Math.max(
      negativeReviews.length >= 3 ? 90 : negativeReviews.length === 2 ? 72 : negativeReviews.length === 1 ? 45 : 10
    ), person, [
      negativeReviews.length ? `${negativeReviews.length} negative review or complaint records linked to staff.` : ""
    ], "Open service recovery review and assign coaching before next premium booking.", { negativeReviewCount: negativeReviews.length, sample: negativeReviews.slice(0, 3) });

    addSignal("staff_client_mismatch", Math.max(
      cancellationRate >= 0.45 && totalAppointments >= 4 ? 82 : cancellationRate >= 0.3 && totalAppointments >= 3 ? 62 : 10,
      totalAppointments >= 4 && completedAppointments === 0 ? 70 : 10
    ), person, [
      cancellationRate >= 0.3 && totalAppointments >= 3 ? `${cancelled} of ${totalAppointments} appointments cancelled or no-show.` : "",
      totalAppointments >= 4 && completedAppointments === 0 ? "No completed appointments despite repeated allocation." : ""
    ], "Review client preferences, staff assignment rules, and rebooking recovery script.", { cancelled, totalAppointments, cancellationRate: pct(cancellationRate * 100), completedAppointments });

    addSignal("uncertified_service_assignment", Math.max(
      uncertifiedServices.length >= 3 ? 82 : uncertifiedServices.length ? 58 : 10
    ), person, [
      uncertifiedServices.length ? `${uncertifiedServices.length} assigned/booked services do not have certified license evidence.` : ""
    ], "Block premium assignment until skill license matrix is updated or manager approves exception.", {
      serviceIds: [...serviceIds],
      uncertifiedServices: uncertifiedServices.map((serviceId) => ({ serviceId, serviceName: serviceById.get(serviceId)?.name || serviceId })),
      licenseCount: licenses.length
    });
  }

  return signals.sort((a, b) => b.riskScore - a.riskScore);

  function addSignal(type, score, person, reasons, suggestedAction, evidence) {
    const normalizedReasons = reasons.filter(Boolean);
    if (!normalizedReasons.length && score < 40) return;
    const riskScore = Math.max(1, Math.min(100, Math.round(score)));
    const level = riskLevelFromScore(riskScore);
    signals.push({
      id: `calc_${type}_${person.id}`,
      source: "calculated",
      signalType: type,
      riskLevel: level,
      riskScore,
      tenantId: ctx.access.tenantId,
      branchId: person.branchId || ctx.branchId || "",
      staffId: person.id,
      staffName: staffName(person),
      reason: normalizedReasons.join(" "),
      reasons: normalizedReasons,
      suggestedAction,
      evidence,
      reviewStatus: "needs_review",
      status: "open",
      detectedAt: new Date().toISOString()
    });
  }
}

function digitalTwinForStaff(person, ctx, storedTwin = null) {
  const ranking = ctx.ranking.find((item) => item.staffId === person.id) || {};
  const sales = ctx.sales.filter((item) => item.staffId === person.id);
  const appointments = ctx.appointments.filter((item) => item.staffId === person.id);
  const attendance = ctx.attendance.filter((item) => item.staffId === person.id);
  const shifts = ctx.shifts.filter((item) => item.staffId === person.id);
  const commission = (ctx.commission.entries || []).filter((item) => item.staffId === person.id);
  const risks = calculatedRiskSignals(ctx).filter((item) => item.staffId === person.id);
  const serviceIds = new Set([
    ...serviceIdsOf(person),
    ...appointments.flatMap(serviceIdsOf)
  ]);
  return {
    staffId: person.id,
    staffName: staffName(person),
    branchId: person.branchId || "",
    status: person.status || "active",
    storedTwin,
    profile: {
      role: person.role || person.designation || "",
      phone: person.phone || person.mobile || "",
      skillsKnown: serviceIds.size,
      activeServices: [...serviceIds]
    },
    performance: {
      score: pct(ranking.performanceScore),
      attendanceScore: pct(ranking.attendanceScore),
      serviceEfficiency: pct(ranking.serviceEfficiency),
      revenue: money(ranking.revenue || sum(sales, (item) => item.total)),
      appointmentCount: appointments.length,
      presentDays: attendance.filter((item) => String(item.status).toLowerCase() === "present").length,
      scheduledShifts: shifts.length
    },
    finance: {
      revenue: money(sum(sales, (item) => item.total)),
      commission: money(sum(commission, (item) => item.commission)),
      averageTicket: appointments.length ? money(sum(sales, (item) => item.total) / appointments.length) : 0
    },
    risk: {
      highestRisk: risks[0]?.riskLevel || "low",
      signals: risks.slice(0, 5)
    },
    suggestions: [
      Number(ranking.attendanceScore || 100) < 80 ? "Keep away from peak-hour critical slots until punctuality improves." : "Safe for peak-hour booking allocation.",
      Number(ranking.serviceEfficiency || 0) < 70 ? "Pair with senior staff for high-value services." : "Eligible for premium service allocation.",
      risks.length ? "Review open risk signals before approving payroll or roster changes." : "No calculated risk signal in selected period."
    ]
  };
}

function normalizeCamelJson(row, fields) {
  const copy = { ...row };
  for (const field of fields) copy[field] = parseJson(copy[field], {});
  return copy;
}

function normalizeRiskSignal(row) {
  const evidence = row.evidence ?? row.evidenceJson ?? {};
  const reasons = Array.isArray(row.reasons)
    ? row.reasons
    : String(row.reason || "")
      .split(/\n|;|\.\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
  return {
    ...row,
    riskLevel: row.riskLevel || "low",
    riskScore: Number(row.riskScore || 0),
    reason: row.reason || reasons.join(" "),
    reasons,
    evidence: parseJson(evidence, evidence && typeof evidence === "object" ? evidence : {}),
    evidenceJson: parseJson(row.evidenceJson, {}),
    suggestedAction: row.suggestedAction || "Review the signal and record a manager decision.",
    reviewStatus: row.reviewStatus || row.status || "open"
  };
}

export class StaffEnterpriseReadService {
  commandCenter(query = {}, access) {
    const ctx = buildEnterpriseContext(query, access);
    const riskSignals = calculatedRiskSignals(ctx);
    const approvals = this.approvals(query, access).items;
    const training = this.training(query, access).items;
    return {
      period: ctx.period,
      branchId: ctx.branchId,
      generatedAt: new Date().toISOString(),
      empty: ctx.staff.length === 0,
      sourceCounts: {
        staff: ctx.staff.length,
        appointments: ctx.appointments.length,
        invoices: ctx.invoices.length,
        sales: ctx.sales.length,
        attendance: ctx.attendance.length,
        commissionRuns: ctx.commissionRuns.length
      },
      kpis: {
        staffCount: ctx.summary.metrics?.staffCount || ctx.staff.length,
        scheduledShifts: ctx.summary.metrics?.scheduledShifts || ctx.shifts.length,
        presentDays: ctx.summary.metrics?.presentDays || 0,
        totalRevenue: money(ctx.summary.metrics?.totalRevenue),
        totalCommission: money(ctx.summary.metrics?.totalCommission),
        highRiskSignals: riskSignals.filter((item) => ["high", "critical"].includes(item.riskLevel)).length,
        pendingApprovals: approvals.filter((item) => item.status === "pending").length,
        trainingDue: training.filter((item) => ["assigned", "pending", "overdue"].includes(String(item.status || "").toLowerCase())).length
      },
      topStaff: [...ctx.ranking].sort((a, b) => Number(b.performanceScore || 0) - Number(a.performanceScore || 0)).slice(0, 5),
      attentionQueue: [
        ...riskSignals.slice(0, 8).map((item) => ({ type: "risk", ...item })),
        ...approvals.filter((item) => item.status === "pending").slice(0, 5).map((item) => ({ type: "approval", ...item })),
        ...training.filter((item) => ["assigned", "pending", "overdue"].includes(String(item.status || "").toLowerCase())).slice(0, 5).map((item) => ({ type: "training", ...item }))
      ],
      recommendations: this.commandRecommendations(ctx, riskSignals)
    };
  }

  commandRecommendations(ctx, riskSignals) {
    const recommendations = [];
    const top = [...ctx.ranking].sort((a, b) => Number(b.performanceScore || 0) - Number(a.performanceScore || 0))[0];
    const weakAttendance = ctx.ranking.filter((item) => Number(item.attendanceScore || 100) < 75);
    if (top) {
      recommendations.push({
        type: "roster",
        priority: "medium",
        title: "Protect premium slots with best available staff",
        reason: `${top.staffName || top.name || top.staffId} has the strongest score in this period.`,
        suggestedAction: "Use this staff member for high-value bookings where skills match."
      });
    }
    if (weakAttendance.length) {
      recommendations.push({
        type: "attendance",
        priority: "high",
        title: "Attendance coaching required",
        reason: `${weakAttendance.length} staff members are below 75 attendance score.`,
        suggestedAction: "Review roster pressure, late marks, and shift timings."
      });
    }
    if (riskSignals.some((item) => ["discount_misuse", "revenue_leakage"].includes(item.signalType))) {
      recommendations.push({
        type: "revenue_leakage",
        priority: "high",
        title: "Discount leakage review",
        reason: "Discount share crossed the configured risk threshold for selected staff.",
        suggestedAction: "Audit discounts before payroll or commission finalization."
      });
    }
    return recommendations;
  }

  digitalTwins(query = {}, access) {
    const ctx = buildEnterpriseContext(query, access);
    const stored = optionalRows("staff_digital_twins", access, { branchId: ctx.branchId, limit: 500 });
    const storedByStaff = new Map(stored.rows.map((row) => [row.staffId, normalizeCamelJson(row, ["profileJson", "skillJson", "clientPreferenceJson", "revenueJson", "upsellJson", "fatigueJson", "complaintRiskJson", "cancellationImpactJson"])]));
    const items = ctx.staff.map((person) => digitalTwinForStaff(person, ctx, storedByStaff.get(person.id) || null));
    return { period: ctx.period, branchId: ctx.branchId, schemaReady: stored.schemaReady, empty: items.length === 0, items };
  }

  digitalTwin(staffId, query = {}, access) {
    const items = this.digitalTwins(query, access).items;
    const twin = items.find((item) => item.staffId === staffId);
    if (twin) return twin;
    return { staffId, empty: true, message: "Staff member was not found in the selected tenant or branch scope." };
  }

  skillMatrix(query = {}, access) {
    const ctx = buildEnterpriseContext(query, access);
    const licenses = optionalRows("staff_skill_licenses", access, { branchId: ctx.branchId, limit: 500 });
    const legacySkills = optionalRows("staff_skills", access, { branchId: ctx.branchId, limit: 500 });
    const serviceById = new Map(ctx.services.map((service) => [service.id, service]));
    const licenseItems = licenses.rows.map((row) => normalizeCamelJson(row, ["evidenceJson"]));
    const skillItems = legacySkills.rows.map((row) => normalizeCamelJson(row, ["serviceIds", "certifications"]));
    const staffRows = ctx.staff.map((person) => {
      const ids = serviceIdsOf(person);
      return {
        staffId: person.id,
        staffName: staffName(person),
        branchId: person.branchId || "",
        assignedServices: ids.map((serviceId) => ({
          serviceId,
          serviceName: serviceById.get(serviceId)?.name || serviceId
        })),
        licenses: licenseItems.filter((item) => item.staffId === person.id),
        skills: skillItems.filter((item) => item.staffId === person.id)
      };
    });
    return {
      period: ctx.period,
      branchId: ctx.branchId,
      schemaReady: licenses.schemaReady,
      empty: staffRows.length === 0,
      items: staffRows
    };
  }

  riskSignals(query = {}, access) {
    const ctx = buildEnterpriseContext(query, access);
    const limit = Math.max(1, Math.min(Number(query.limit) || 200, 500));
    const stored = optionalRows("staff_risk_signals", access, { branchId: ctx.branchId, limit });
    const storedItems = stored.rows.map((row) => normalizeRiskSignal(normalizeCamelJson(row, ["evidenceJson"])));
    const calculated = calculatedRiskSignals(ctx).map(normalizeRiskSignal);
    const items = [...storedItems.map((item) => ({ ...item, source: "stored" })), ...calculated]
      .sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0))
      .slice(0, limit);
    return {
      period: ctx.period,
      branchId: ctx.branchId,
      schemaReady: stored.schemaReady,
      detectors: staffRiskDetectors.map((type) => ({
        type,
        status: "active",
        outputFields: ["riskLevel", "riskScore", "reasons", "evidence", "suggestedAction", "reviewStatus"]
      })),
      empty: storedItems.length + calculated.length === 0,
      totalSignals: storedItems.length + calculated.length,
      items
    };
  }

  floorControl(query = {}, access) {
    const ctx = buildEnterpriseContext(query, access);
    const controlDate = String(query.date || today()).slice(0, 10);
    const stored = optionalRows("staff_floor_control_events", access, { branchId: ctx.branchId, limit: Number(query.limit) || 200, orderBy: "eventAt" });
    const attendanceByStaff = groupedByStaff(ctx.attendance.filter((row) => rowDate(row, ["date"]) === controlDate));
    const shifts = ctx.shifts.filter((row) => rowDate(row, ["date"]) === controlDate);
    const appointments = ctx.appointments.filter((row) => rowDate(row, ["startAt", "date"]) === controlDate);
    const calculated = shifts.map((shift) => {
      const present = (attendanceByStaff.get(shift.staffId) || []).some((row) => String(row.status).toLowerCase() === "present");
      const booked = appointments.filter((appointment) => appointment.staffId === shift.staffId).length;
      return {
        id: `floor_${controlDate}_${shift.id}`,
        source: "calculated",
        tenantId: access.tenantId,
        branchId: shift.branchId || ctx.branchId || "",
        staffId: shift.staffId,
        eventType: present ? "staff_available" : "attendance_missing",
        severity: present ? "info" : "warning",
        eventAt: `${controlDate}T00:00:00.000Z`,
        status: present ? "ready" : "open",
        eventPayloadJson: {
          shiftId: shift.id,
          startTime: shift.startTime,
          endTime: shift.endTime,
          appointmentCount: booked
        }
      };
    });
    return {
      date: controlDate,
      period: ctx.period,
      branchId: ctx.branchId,
      schemaReady: stored.schemaReady,
      empty: stored.rows.length + calculated.length === 0,
      items: [...stored.rows.map((row) => normalizeCamelJson(row, ["eventPayloadJson"])), ...calculated]
    };
  }

  payrollIntelligence(query = {}, access) {
    const ctx = buildEnterpriseContext(query, access);
    const stored = optionalRows("staff_payroll_intelligence", access, { branchId: ctx.branchId, limit: Number(query.limit) || 200, orderBy: "periodStart" });
    const risks = calculatedRiskSignals(ctx);
    const items = ctx.payrollPreview.map((row) => {
      const staffRisks = risks.filter((risk) => risk.staffId === row.staffId);
      return {
        source: "calculated",
        tenantId: access.tenantId,
        branchId: ctx.branchId || row.branchId || "",
        staffId: row.staffId,
        staffName: row.name || row.staffName,
        periodStart: ctx.period.periodStart,
        periodEnd: ctx.period.periodEnd,
        grossPay: money(row.grossPayout),
        commissionAmount: money(row.commission),
        incentiveAmount: money(row.incentive),
        overtimePay: money(row.overtimePay),
        complianceRiskLevel: staffRisks.some((risk) => risk.riskLevel === "high" || risk.riskLevel === "critical") ? "high" : staffRisks.length ? "medium" : "low",
        anomalyJson: staffRisks,
        status: "preview"
      };
    });
    return {
      period: ctx.period,
      branchId: ctx.branchId,
      schemaReady: stored.schemaReady,
      empty: stored.rows.length + items.length === 0,
      stored: stored.rows.map((row) => normalizeCamelJson(row, ["statutoryJson", "anomalyJson", "payoutRecommendationJson"])),
      items
    };
  }

  auditTrail(query = {}, access) {
    const branchId = resolveBranch(query, access);
    const limit = Number(query.limit) || 200;
    const zeroTrust = optionalRows("staff_zero_trust_audit", access, { branchId, limit });
    const staffAudit = optionalRows("staff_audit_logs", access, { branchId, limit, orderBy: "created_at" });
    const legacyAudit = optionalRows("audit_logs", access, { branchId, limit });
    return {
      branchId,
      schemaReady: zeroTrust.schemaReady || staffAudit.schemaReady || legacyAudit.schemaReady,
      empty: zeroTrust.rows.length + staffAudit.rows.length + legacyAudit.rows.length === 0,
      items: [
        ...zeroTrust.rows.map((row) => ({ ...normalizeCamelJson(row, ["beforeJson", "afterJson", "metadataJson"]), source: "zero_trust" })),
        ...staffAudit.rows.map((row) => ({ ...row, source: "staff_audit", beforeJson: parseJson(row.before_json, {}), afterJson: parseJson(row.after_json, {}), metadataJson: parseJson(row.details_json, {}) })),
        ...legacyAudit.rows.filter((row) => String(row.action || "").toLowerCase().includes("staff")).map((row) => ({ ...row, source: "legacy_audit", details: parseJson(row.details, {}) }))
      ].slice(0, limit)
    };
  }

  training(query = {}, access) {
    const ctx = buildEnterpriseContext(query, access);
    const enterprise = optionalRows("staff_training_assignments", access, { branchId: ctx.branchId, limit: Number(query.limit) || 200 });
    const legacy = optionalRows("training_assignments", access, { branchId: ctx.branchId, limit: Number(query.limit) || 200 });
    const coachingRiskTypes = new Set(["burnout_risk", "attrition_risk", "low_utilization", "discount_misuse", "revenue_leakage", "attendance_manipulation", "repeated_client_complaints", "uncertified_service_assignment"]);
    const riskBased = calculatedRiskSignals(ctx).filter((risk) => coachingRiskTypes.has(risk.signalType)).slice(0, 20).map((risk) => ({
      id: `recommend_${risk.id}`,
      source: "calculated_recommendation",
      tenantId: access.tenantId,
      branchId: risk.branchId,
      staffId: risk.staffId,
      trainingType: ["discount_misuse", "revenue_leakage", "cash_handling_risk", "commission_anomaly"].includes(risk.signalType) ? "billing_controls" : "performance_coaching",
      trainingTitle: ["discount_misuse", "revenue_leakage"].includes(risk.signalType) ? "Discount and invoice control refresher" : risk.signalType === "uncertified_service_assignment" ? "Skill license certification review" : "Staff performance coaching",
      triggerSignalId: risk.id,
      status: "recommended",
      reason: risk.reason
    }));
    return {
      period: ctx.period,
      branchId: ctx.branchId,
      schemaReady: enterprise.schemaReady,
      empty: enterprise.rows.length + legacy.rows.length + riskBased.length === 0,
      items: [
        ...enterprise.rows.map((row) => normalizeCamelJson(row, ["resultJson"])),
        ...legacy.rows.map((row) => ({ ...row, source: "legacy" })),
        ...riskBased
      ]
    };
  }

  approvals(query = {}, access) {
    const branchId = resolveBranch(query, access);
    const enterprise = optionalRows("staff_approval_requests", access, { branchId, limit: Number(query.limit) || 200 });
    const legacy = optionalRows("staff_approvals", access, { branchId, limit: Number(query.limit) || 200 });
    return {
      branchId,
      schemaReady: enterprise.schemaReady,
      empty: enterprise.rows.length + legacy.rows.length === 0,
      items: [
        ...enterprise.rows.map((row) => normalizeCamelJson(row, ["beforeJson", "afterJson"])),
        ...legacy.rows.map((row) => ({ ...row, source: "legacy", details: parseJson(row.details, {}), history: parseJson(row.history, []) }))
      ]
    };
  }
}

export const staffEnterpriseReadService = new StaffEnterpriseReadService();
