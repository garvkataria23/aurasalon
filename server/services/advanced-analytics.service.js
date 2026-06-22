import { repositories } from "../repositories/repository-registry.js";
import { anomalyDetectionService } from "./anomaly-detection.service.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const pct = (value) => Math.round((Number(value) || 0) * 100) / 100;
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function dayKey(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function hourOf(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getHours() : 0;
}

function dayOfWeek(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getDay() : 0;
}

function daysSince(value) {
  if (!value) return 999;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 999;
  return Math.max(0, Math.round((Date.now() - time) / 86400000));
}

function daysUntil(value) {
  if (!value) return 999;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 999;
  return Math.round((time - Date.now()) / 86400000);
}

function withinPeriod(row, start, end) {
  const createdAt = row.createdAt || row.startAt || row.lastVisitAt || "";
  if (!createdAt) return true;
  const key = createdAt.slice(0, 10);
  return (!start || key >= start) && (!end || key <= end);
}

function sum(items, selector) {
  return items.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

function countBy(items, keyFn) {
  const output = new Map();
  for (const item of items) {
    const key = keyFn(item);
    output.set(key, (output.get(key) || 0) + 1);
  }
  return output;
}

function revenueBy(items, keyFn) {
  const output = new Map();
  for (const item of items) {
    const key = keyFn(item);
    output.set(key, money((output.get(key) || 0) + Number(item.total || 0)));
  }
  return output;
}

function rate(part, whole) {
  return whole ? pct((Number(part) / Number(whole)) * 100) : 0;
}

function previousDays(count) {
  return Array.from({ length: count }, (_item, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (count - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

export class AdvancedAnalyticsService {
  run(input = {}, access) {
    tenantService.ensureSubscriptionActive(access.tenantId);
    const branchId = input.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const context = this.context(input, access, branchId);
    const metrics = this.metrics(context);
    const insights = this.insights(metrics);
    const snapshot = repositories.analyticsSnapshots.create({
      id: makeId("anly"),
      branchId,
      type: input.type || "advanced",
      periodStart: context.periodStart,
      periodEnd: context.periodEnd,
      input,
      metrics,
      insights,
      status: "generated"
    }, scope(access, branchId));
    tenantService.recordUsage({ tenantId: access.tenantId, metric: "analytics:snapshot", referenceType: "analytics_snapshot", referenceId: snapshot.id });
    return { snapshot, metrics, insights };
  }

  snapshots(query = {}, access) {
    return repositories.analyticsSnapshots.list(query, scope(access));
  }

  latest(query = {}, access) {
    return repositories.analyticsSnapshots.list({ ...query, limit: 1 }, scope(access))[0] || null;
  }

  reportCommandCenter(query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const input = {
      branchId,
      periodStart: query.periodStart || query.from,
      periodEnd: query.periodEnd || query.to
    };
    const context = this.context(input, access, branchId);
    const metrics = this.metrics(context);
    const anomalies = this.openAnomalies(access, branchId);
    return {
      filters: {
        branchId,
        periodStart: context.periodStart,
        periodEnd: context.periodEnd
      },
      summary: this.reportSummary(metrics, anomalies),
      kpiDetailMap: this.kpiDetailMap(metrics),
      drilldowns: this.reportDrilldowns(context, metrics),
      exportControls: this.exportControls(query, access),
      scheduledReports: this.reportSchedules({ branchId }, access),
      aiInsights: this.aiInsights(metrics, anomalies),
      anomalyDetection: {
        open: anomalies.length,
        critical: anomalies.filter((item) => item.severity === "critical").length,
        warning: anomalies.filter((item) => item.severity === "warning").length,
        rows: anomalies.slice(0, 8)
      }
    };
  }

  kpiDetail(moduleName, kpiKey, query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const context = this.context({ ...query, branchId, periodStart: query.from || query.periodStart, periodEnd: query.to || query.periodEnd }, access, branchId);
    const metrics = this.metrics(context);
    const definition = this.kpiDetailMap(metrics).find((item) => item.module === moduleName && item.key === kpiKey)
      || { module: moduleName, key: kpiKey, title: this.titleFromKey(kpiKey), source: "analytics" };
    return {
      definition,
      filters: { branchId, periodStart: context.periodStart, periodEnd: context.periodEnd },
      stats: this.kpiStats(kpiKey, metrics, context),
      rows: this.kpiRows(kpiKey, metrics, context),
      aiInsights: this.aiInsights(metrics, this.openAnomalies(access, branchId)).filter((item) => item.kpiKey === kpiKey || item.module === moduleName).slice(0, 4),
      exportControls: this.exportControls({ report: `${moduleName}:${kpiKey}` }, access)
    };
  }

  reportSchedules(query = {}, access) {
    return repositories.analyticsSnapshots
      .list({ branchId: query.branchId || access.branchId || "", type: "scheduled_report", limit: 100 }, scope(access, query.branchId || access.branchId || ""))
      .map((row) => ({
        id: row.id,
        branchId: row.branchId,
        name: row.input?.name || "Scheduled report",
        cadence: row.input?.cadence || "weekly",
        recipients: row.input?.recipients || [],
        reportKeys: row.input?.reportKeys || [],
        nextRunAt: row.input?.nextRunAt || this.nextRunAt(row.input?.cadence || "weekly"),
        status: row.status,
        createdAt: row.createdAt
      }));
  }

  createSchedule(payload = {}, access) {
    const branchId = payload.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const cadence = payload.cadence || "weekly";
    const schedule = repositories.analyticsSnapshots.create({
      id: makeId("rsch"),
      branchId,
      type: "scheduled_report",
      periodStart: "",
      periodEnd: "",
      input: {
        name: payload.name || "Owner performance digest",
        cadence,
        recipients: Array.isArray(payload.recipients) ? payload.recipients : [],
        reportKeys: Array.isArray(payload.reportKeys) && payload.reportKeys.length ? payload.reportKeys : ["reports:sales-revenue", "analytics:high-churn-risk"],
        nextRunAt: payload.nextRunAt || this.nextRunAt(cadence),
        exportFormat: payload.exportFormat || "pdf_csv"
      },
      metrics: {},
      insights: ["Scheduled report created with branch/date scope and export controls."],
      status: payload.status || "active"
    }, scope(access, branchId));
    tenantService.recordUsage({ tenantId: access.tenantId, metric: "analytics:scheduled-report", referenceType: "analytics_snapshot", referenceId: schedule.id });
    return schedule;
  }

  exportControls(query = {}, access = {}) {
    const role = access.role || "staff";
    const allowed = ["owner", "admin", "superAdmin", "manager", "accountant", "analyst"].includes(role);
    const sensitiveReport = String(query.report || "").includes("client") || String(query.report || "").includes("payroll");
    return {
      allowed,
      role,
      formats: allowed ? ["csv", "pdf", "xlsx"] : [],
      watermark: true,
      auditRequired: true,
      piiMasked: !["owner", "admin", "superAdmin"].includes(role) || sensitiveReport,
      approvalRequired: sensitiveReport && !["owner", "admin", "superAdmin"].includes(role),
      retentionDays: 30,
      message: allowed ? "Export allowed with audit trail and watermark." : "Export blocked for this role."
    };
  }

  runAnomalyDetection(query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    if (branchId) {
      tenantService.assertBranchAccess(access, branchId);
      return {
        branchId,
        revenue: anomalyDetectionService.detectRevenueAnomaly(access.tenantId, branchId),
        cancellations: anomalyDetectionService.detectCancellationSpike(access.tenantId, branchId),
        rows: this.openAnomalies(access, branchId)
      };
    }
    return {
      branchId: "",
      results: anomalyDetectionService.runAllChecks(access.tenantId),
      rows: this.openAnomalies(access, "")
    };
  }

  context(input, access, branchId) {
    const queryScope = scope(access, branchId);
    const periodEnd = input.periodEnd || now().slice(0, 10);
    const defaultStart = new Date(periodEnd);
    defaultStart.setDate(defaultStart.getDate() - 89);
    const periodStart = input.periodStart || defaultStart.toISOString().slice(0, 10);
    const branchQuery = branchId ? { branchId, limit: 10000 } : { limit: 10000 };
    const sales = repositories.sales.list(branchQuery, queryScope).filter((item) => withinPeriod(item, periodStart, periodEnd));
    const appointments = repositories.appointments.list(branchQuery, queryScope).filter((item) => withinPeriod(item, periodStart, periodEnd));
    const clients = repositories.clients.list(branchQuery, queryScope);
    const staff = repositories.staff.list(branchQuery, queryScope);
    const memberships = repositories.memberships.list(branchQuery, queryScope).filter((item) => withinPeriod(item, periodStart, periodEnd));
    const products = repositories.products.list(branchQuery, queryScope);
    const allBranches = repositories.branches.list({ limit: 10000 }, scope(access));
    const branches = branchId ? allBranches.filter((branch) => branch.id === branchId) : allBranches;
    const saleIds = new Set(sales.map((sale) => sale.id));
    const invoices = repositories.invoices.list({ limit: 10000 }, scope(access))
      .filter((item) => withinPeriod(item, periodStart, periodEnd))
      .filter((item) => !branchId || saleIds.has(item.saleId));
    const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
    const payments = repositories.payments.list({ limit: 10000 }, scope(access))
      .filter((item) => withinPeriod(item, periodStart, periodEnd))
      .filter((item) => !branchId || invoiceIds.has(item.invoiceId));
    const whatsappThreads = repositories.whatsappThreads.list({ limit: 10000 }, queryScope).filter((item) => withinPeriod(item, periodStart, periodEnd));
    const campaigns = repositories.campaigns.list({ limit: 10000 }, scope(access)).filter((item) => withinPeriod(item, periodStart, periodEnd));
    return { access, branchId, periodStart, periodEnd, sales, appointments, clients, staff, memberships, products, branches, invoices, payments, whatsappThreads, campaigns };
  }

  metrics(context) {
    return {
      revenueForecast: this.revenueForecast(context),
      peakHours: this.peakHours(context),
      staffProductivity: this.staffProductivity(context),
      repeatCustomers: this.repeatCustomers(context),
      churn: this.churn(context),
      lifetimeValue: this.lifetimeValue(context),
      heatmaps: this.heatmaps(context),
      conversionFunnel: this.conversionFunnel(context),
      membershipPerformance: this.membershipPerformance(context),
      branchComparison: this.branchComparison(context)
    };
  }

  revenueForecast({ sales }) {
    const days = previousDays(30);
    const byDay = revenueBy(sales, (sale) => dayKey(sale.createdAt));
    const series = days.map((date) => ({ date, revenue: money(byDay.get(date) || 0) }));
    const last7 = series.slice(-7);
    const previous7 = series.slice(-14, -7);
    const last7Avg = money(sum(last7, (item) => item.revenue) / 7);
    const previous7Avg = money(sum(previous7, (item) => item.revenue) / 7);
    const trend = previous7Avg ? (last7Avg - previous7Avg) / previous7Avg : 0;
    const forecast = Array.from({ length: 14 }, (_item, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index + 1);
      const seasonalLift = 1 + Math.min(0.35, Math.max(-0.25, trend)) * ((index + 1) / 14);
      return {
        date: date.toISOString().slice(0, 10),
        projectedRevenue: money(Math.max(0, last7Avg * seasonalLift)),
        confidence: last7Avg > 0 ? pct(Math.max(55, 88 - index * 2)) : 45
      };
    });
    return {
      actual30Days: series,
      last7Avg,
      previous7Avg,
      trendPercent: pct(trend * 100),
      forecast14Days: forecast,
      projected14DayRevenue: money(sum(forecast, (item) => item.projectedRevenue))
    };
  }

  peakHours({ appointments, sales }) {
    const appointmentHours = countBy(appointments, (item) => hourOf(item.startAt));
    const revenueHours = revenueBy(sales, (item) => hourOf(item.createdAt));
    const rows = Array.from({ length: 24 }, (_item, hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      bookings: appointmentHours.get(hour) || 0,
      revenue: money(revenueHours.get(hour) || 0),
      score: pct((appointmentHours.get(hour) || 0) * 10 + (revenueHours.get(hour) || 0) / 1000)
    }));
    return {
      hours: rows,
      topHours: rows.filter((item) => item.bookings || item.revenue).sort((a, b) => b.score - a.score).slice(0, 5)
    };
  }

  staffProductivity({ staff, appointments, sales }) {
    const rows = staff.map((person) => {
      const staffAppointments = appointments.filter((item) => item.staffId === person.id);
      const completed = staffAppointments.filter((item) => item.status === "completed").length;
      const noShow = staffAppointments.filter((item) => item.status === "no-show").length;
      const staffSales = sales.filter((item) => item.staffId === person.id);
      const revenue = money(sum(staffSales, (item) => item.total));
      const avgTicket = staffSales.length ? money(revenue / staffSales.length) : 0;
      const completionRate = rate(completed, staffAppointments.length);
      const noShowPenalty = rate(noShow, staffAppointments.length) * 0.25;
      const rating = Number(person.performance?.rating || 4.2);
      const score = pct(Math.min(100, revenue / 500 + completionRate * 0.45 + rating * 8 - noShowPenalty));
      return {
        id: person.id,
        name: person.name,
        branchId: person.branchId,
        role: person.role,
        bookings: staffAppointments.length,
        completed,
        revenue,
        avgTicket,
        completionRate,
        rating,
        productivityScore: score
      };
    });
    return rows.sort((a, b) => b.productivityScore - a.productivityScore);
  }

  repeatCustomers({ clients }) {
    const repeat = clients.filter((client) => Number(client.visitCount || 0) > 1);
    const loyal = clients.filter((client) => Number(client.visitCount || 0) >= 5);
    const highValueRepeat = repeat.filter((client) => Number(client.totalSpend || 0) >= 20000);
    return {
      totalClients: clients.length,
      repeatClients: repeat.length,
      repeatRate: rate(repeat.length, clients.length),
      loyalClients: loyal.length,
      highValueRepeatClients: highValueRepeat.length,
      topRepeatClients: [...repeat].sort((a, b) => Number(b.visitCount || 0) - Number(a.visitCount || 0)).slice(0, 8).map((client) => ({
        id: client.id,
        name: client.name,
        visits: Number(client.visitCount || 0),
        totalSpend: money(client.totalSpend),
        lastVisitAt: client.lastVisitAt
      }))
    };
  }

  churn({ clients }) {
    const rows = clients.map((client) => {
      const inactiveDays = daysSince(client.lastVisitAt);
      const inactiveTag = (client.tags || []).map((item) => String(item).toLowerCase()).includes("inactive");
      const score = Math.max(0, Math.min(100, Math.round(inactiveDays * 0.85 + (inactiveTag ? 25 : 0) + (Number(client.visitCount || 0) <= 1 ? 10 : 0) - (client.membershipId ? 12 : 0))));
      return {
        id: client.id,
        name: client.name,
        branchId: client.branchId,
        inactiveDays,
        score,
        risk: score >= 70 ? "high" : score >= 40 ? "medium" : "low",
        recommendedAction: score >= 70 ? "Win-back WhatsApp with service credit" : score >= 40 ? "Personalized check-in" : "Loyalty nurture"
      };
    }).sort((a, b) => b.score - a.score);
    return {
      highRisk: rows.filter((item) => item.risk === "high").length,
      mediumRisk: rows.filter((item) => item.risk === "medium").length,
      lowRisk: rows.filter((item) => item.risk === "low").length,
      averageRiskScore: rows.length ? pct(sum(rows, (item) => item.score) / rows.length) : 0,
      clients: rows.slice(0, 12)
    };
  }

  lifetimeValue({ clients, sales }) {
    const rows = clients.map((client) => {
      const clientSales = sales.filter((sale) => sale.clientId === client.id);
      const savedSpend = Number(client.totalSpend || 0);
      const periodSpend = sum(clientSales, (sale) => sale.total);
      const visits = Math.max(1, Number(client.visitCount || 0));
      const avgTicket = money(savedSpend / visits);
      const projectedAnnual = money(avgTicket * Math.min(12, Math.max(2, visits)));
      return {
        id: client.id,
        name: client.name,
        branchId: client.branchId,
        lifetimeValue: money(savedSpend),
        periodSpend: money(periodSpend),
        avgTicket,
        projectedAnnualValue: projectedAnnual,
        loyaltyPoints: Number(client.loyaltyPoints || 0),
        walletBalance: money(client.walletBalance)
      };
    }).sort((a, b) => b.lifetimeValue - a.lifetimeValue);
    return {
      totalLtv: money(sum(rows, (item) => item.lifetimeValue)),
      avgLtv: rows.length ? money(sum(rows, (item) => item.lifetimeValue) / rows.length) : 0,
      topClients: rows.slice(0, 10)
    };
  }

  heatmaps({ appointments, sales }) {
    const appointmentMap = new Map();
    const revenueMap = new Map();
    for (const appointment of appointments) {
      const key = `${dayOfWeek(appointment.startAt)}-${hourOf(appointment.startAt)}`;
      appointmentMap.set(key, (appointmentMap.get(key) || 0) + 1);
    }
    for (const sale of sales) {
      const key = `${dayOfWeek(sale.createdAt)}-${hourOf(sale.createdAt)}`;
      revenueMap.set(key, money((revenueMap.get(key) || 0) + Number(sale.total || 0)));
    }
    const cells = [];
    for (let day = 0; day < 7; day += 1) {
      for (let hour = 8; hour <= 22; hour += 1) {
        const key = `${day}-${hour}`;
        cells.push({
          day,
          dayLabel: dayNames[day],
          hour,
          bookings: appointmentMap.get(key) || 0,
          revenue: money(revenueMap.get(key) || 0),
          intensity: pct(Math.min(100, (appointmentMap.get(key) || 0) * 18 + (revenueMap.get(key) || 0) / 350))
        });
      }
    }
    return {
      cells,
      strongestCells: [...cells].sort((a, b) => b.intensity - a.intensity).slice(0, 8)
    };
  }

  conversionFunnel({ whatsappThreads, appointments, sales, invoices }) {
    const leadCount = whatsappThreads.length;
    const qualified = whatsappThreads.filter((thread) => Number(thread.leadScore || 0) >= 70 || thread.status === "qualified").length;
    const booked = appointments.filter((item) => ["booked", "arrived", "completed"].includes(item.status)).length;
    const arrived = appointments.filter((item) => ["arrived", "completed"].includes(item.status)).length;
    const completed = appointments.filter((item) => item.status === "completed").length;
    const billed = sales.length;
    const paid = invoices.filter((invoice) => invoice.status === "paid").length;
    const stages = [
      { stage: "Leads", count: leadCount },
      { stage: "Qualified", count: qualified },
      { stage: "Booked", count: booked },
      { stage: "Arrived", count: arrived },
      { stage: "Completed", count: completed },
      { stage: "Billed", count: billed },
      { stage: "Paid", count: paid }
    ];
    return {
      stages: stages.map((stage, index) => ({
        ...stage,
        conversionFromPrevious: index === 0 ? 100 : rate(stage.count, stages[index - 1].count),
        conversionFromLead: index === 0 ? 100 : rate(stage.count, leadCount)
      }))
    };
  }

  membershipPerformance({ memberships }) {
    const active = memberships.filter((item) => item.status === "active");
    const creditsSold = sum(memberships, (item) => item.planCredits);
    const creditsRemaining = sum(memberships, (item) => item.creditsRemaining);
    const creditsRedeemed = Math.max(0, creditsSold - creditsRemaining);
    const expiringSoon = memberships.filter((item) => {
      const remainingDays = daysUntil(item.validityDate);
      return remainingDays >= 0 && remainingDays <= 30;
    });
    return {
      activeCount: active.length,
      revenue: money(sum(memberships, (item) => item.price)),
      creditsSold,
      creditsRedeemed,
      creditsRemaining,
      redemptionRate: rate(creditsRedeemed, creditsSold),
      autoRenewCount: memberships.filter((item) => Number(item.autoRenew || 0) === 1).length,
      expiringSoon: expiringSoon.map((item) => ({ id: item.id, planName: item.planName, clientId: item.clientId, validityDate: item.validityDate }))
    };
  }

  branchComparison({ branches, sales, appointments, clients, staff, products, memberships }) {
    return branches.map((branch) => {
      const branchSales = sales.filter((sale) => sale.branchId === branch.id);
      const branchAppointments = appointments.filter((appointment) => appointment.branchId === branch.id);
      const branchClients = clients.filter((client) => client.branchId === branch.id);
      const branchProducts = products.filter((product) => product.branchId === branch.id);
      const completed = branchAppointments.filter((appointment) => appointment.status === "completed").length;
      return {
        id: branch.id,
        name: branch.name,
        city: branch.city,
        revenue: money(sum(branchSales, (sale) => sale.total)),
        sales: branchSales.length,
        appointments: branchAppointments.length,
        completionRate: rate(completed, branchAppointments.length),
        clients: branchClients.length,
        repeatRate: rate(branchClients.filter((client) => Number(client.visitCount || 0) > 1).length, branchClients.length),
        staffCount: staff.filter((person) => person.branchId === branch.id).length,
        lowStock: branchProducts.filter((product) => Number(product.stock || 0) <= Number(product.lowStockThreshold || 0)).length,
        memberships: memberships.filter((membership) => membership.branchId === branch.id).length
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  insights(metrics) {
    const insights = [];
    const forecast = metrics.revenueForecast;
    insights.push(`Projected 14-day revenue is INR ${forecast.projected14DayRevenue} with ${forecast.trendPercent}% recent trend.`);
    const topHour = metrics.peakHours.topHours[0];
    if (topHour) insights.push(`Peak operating hour is ${topHour.label} with ${topHour.bookings} bookings and INR ${topHour.revenue} revenue.`);
    const topStaff = metrics.staffProductivity[0];
    if (topStaff) insights.push(`${topStaff.name} leads staff productivity with score ${topStaff.productivityScore}.`);
    if (metrics.churn.highRisk) insights.push(`${metrics.churn.highRisk} clients are high churn risk and should enter win-back automation.`);
    const topBranch = metrics.branchComparison[0];
    if (topBranch) insights.push(`${topBranch.name} is the strongest branch by revenue in this period.`);
    return insights;
  }

  reportSummary(metrics, anomalies = []) {
    return {
      projectedRevenue: metrics.revenueForecast.projected14DayRevenue,
      trendPercent: metrics.revenueForecast.trendPercent,
      repeatRate: metrics.repeatCustomers.repeatRate,
      highChurnRisk: metrics.churn.highRisk,
      openAnomalies: anomalies.length,
      topBranch: metrics.branchComparison[0]?.name || "",
      topStaff: metrics.staffProductivity[0]?.name || ""
    };
  }

  kpiDetailMap(metrics) {
    return [
      { module: "reports", key: "sales-revenue", title: "Sales Revenue", value: metrics.revenueForecast.last7Avg, route: "/kpi-details/reports/sales-revenue", source: "sales" },
      { module: "reports", key: "bookings", title: "Bookings", value: metrics.conversionFunnel.stages.find((item) => item.stage === "Booked")?.count || 0, route: "/kpi-details/reports/bookings", source: "appointments" },
      { module: "reports", key: "export-risk", title: "Export Risk", value: 0, route: "/kpi-details/reports/export-risk", source: "security" },
      { module: "analytics", key: "14-day-forecast", title: "14-day Forecast", value: metrics.revenueForecast.projected14DayRevenue, route: "/kpi-details/analytics/14-day-forecast", source: "analytics_snapshots" },
      { module: "analytics", key: "repeat-rate", title: "Repeat Rate", value: metrics.repeatCustomers.repeatRate, route: "/kpi-details/analytics/repeat-rate", source: "clients" },
      { module: "analytics", key: "high-churn-risk", title: "High Churn Risk", value: metrics.churn.highRisk, route: "/kpi-details/analytics/high-churn-risk", source: "clients" },
      { module: "analytics", key: "anomalies", title: "Anomalies", value: 0, route: "/kpi-details/analytics/anomalies", source: "alerts" }
    ];
  }

  reportDrilldowns(context, metrics) {
    return [
      { title: "Revenue by day", route: "/kpi-details/reports/sales-revenue", rows: metrics.revenueForecast.actual30Days.length, source: "sales" },
      { title: "Booking funnel", route: "/kpi-details/reports/bookings", rows: metrics.conversionFunnel.stages.length, source: "appointments" },
      { title: "Staff productivity", route: "/kpi-details/analytics/staff-productivity", rows: metrics.staffProductivity.length, source: "staff + sales" },
      { title: "Client churn", route: "/kpi-details/analytics/high-churn-risk", rows: metrics.churn.clients.length, source: "clients" },
      { title: "Branch comparison", route: "/kpi-details/analytics/branches", rows: metrics.branchComparison.length, source: "branches" },
      { title: "Invoices and exports", route: "/reports/invoices", rows: context.invoices.length, source: "invoices" }
    ];
  }

  aiInsights(metrics, anomalies = []) {
    const output = [];
    const forecast = metrics.revenueForecast;
    output.push({
      module: "analytics",
      kpiKey: "14-day-forecast",
      severity: forecast.trendPercent < 0 ? "warning" : "positive",
      title: forecast.trendPercent < 0 ? "Revenue trend needs recovery" : "Revenue trend is improving",
      recommendation: forecast.trendPercent < 0 ? "Schedule win-back and high-margin service campaigns for next 7 days." : "Protect peak slots and push premium add-ons during top hours."
    });
    if (metrics.churn.highRisk) {
      output.push({
        module: "analytics",
        kpiKey: "high-churn-risk",
        severity: "warning",
        title: `${metrics.churn.highRisk} high-risk clients need action`,
        recommendation: "Send a manager-approved WhatsApp win-back list with service credit limits."
      });
    }
    if (anomalies.length) {
      output.push({
        module: "analytics",
        kpiKey: "anomalies",
        severity: "critical",
        title: `${anomalies.length} open anomaly signal${anomalies.length === 1 ? "" : "s"}`,
        recommendation: "Review revenue, cancellation and staff productivity anomalies before daily close."
      });
    }
    const topHour = metrics.peakHours.topHours[0];
    if (topHour) {
      output.push({
        module: "reports",
        kpiKey: "bookings",
        severity: "info",
        title: `${topHour.label} is the strongest operating hour`,
        recommendation: "Keep senior staff and high-margin services available in this slot."
      });
    }
    return output;
  }

  kpiStats(kpiKey, metrics, context) {
    const maps = {
      "sales-revenue": [
        { label: "Last 7 avg", value: metrics.revenueForecast.last7Avg, hint: "Daily revenue average" },
        { label: "Previous 7 avg", value: metrics.revenueForecast.previous7Avg, hint: "Comparison baseline" },
        { label: "Trend", value: `${metrics.revenueForecast.trendPercent}%`, hint: "Recent movement" },
        { label: "Sales", value: context.sales.length, hint: "Rows in range" }
      ],
      bookings: [
        { label: "Booked", value: metrics.conversionFunnel.stages.find((item) => item.stage === "Booked")?.count || 0, hint: "Appointments booked" },
        { label: "Completed", value: metrics.conversionFunnel.stages.find((item) => item.stage === "Completed")?.count || 0, hint: "Completed visits" },
        { label: "Paid", value: metrics.conversionFunnel.stages.find((item) => item.stage === "Paid")?.count || 0, hint: "Paid invoices" },
        { label: "Appointments", value: context.appointments.length, hint: "Rows in range" }
      ],
      "high-churn-risk": [
        { label: "High risk", value: metrics.churn.highRisk, hint: "Clients" },
        { label: "Medium risk", value: metrics.churn.mediumRisk, hint: "Clients" },
        { label: "Average risk", value: metrics.churn.averageRiskScore, hint: "Score" },
        { label: "Clients", value: context.clients.length, hint: "Rows" }
      ],
      anomalies: [
        { label: "Open", value: this.openAnomalies(context.access, context.branchId).length, hint: "Signals" },
        { label: "Revenue current", value: anomalyDetectionService.detectRevenueAnomaly(context.access.tenantId, context.branchId).current, hint: "Today" },
        { label: "Cancel current", value: anomalyDetectionService.detectCancellationSpike(context.access.tenantId, context.branchId).current, hint: "Today" },
        { label: "Branch", value: context.branchId || "All", hint: "Scope" }
      ]
    };
    return maps[kpiKey] || [
      { label: "Rows", value: this.kpiRows(kpiKey, metrics, context).length, hint: "Drilldown rows" },
      { label: "Period start", value: context.periodStart, hint: "From" },
      { label: "Period end", value: context.periodEnd, hint: "To" },
      { label: "Branch", value: context.branchId || "All", hint: "Scope" }
    ];
  }

  kpiRows(kpiKey, metrics, context) {
    if (kpiKey === "sales-revenue" || kpiKey === "14-day-forecast") {
      return metrics.revenueForecast.actual30Days.map((row) => ({
        title: row.date,
        meta: "Daily sales revenue",
        value: row.revenue,
        status: row.revenue > metrics.revenueForecast.last7Avg ? "above avg" : "normal"
      }));
    }
    if (kpiKey === "bookings") {
      return context.appointments.slice(0, 100).map((row) => ({
        title: row.clientName || row.clientId || row.id,
        meta: `${row.status || "booked"} · ${row.startAt || ""}`,
        value: row.staffId || row.branchId || "",
        status: row.status || "booked"
      }));
    }
    if (kpiKey === "repeat-rate") return metrics.repeatCustomers.topRepeatClients.map((row) => ({
      title: row.name,
      meta: `${row.visits} visits · last ${row.lastVisitAt || "unknown"}`,
      value: row.totalSpend,
      status: "repeat"
    }));
    if (kpiKey === "high-churn-risk") return metrics.churn.clients.map((row) => ({
      title: row.name,
      meta: `${row.inactiveDays} inactive days`,
      value: row.score,
      status: row.risk
    }));
    if (kpiKey === "staff-productivity") return metrics.staffProductivity.map((row) => ({
      title: row.name,
      meta: `${row.bookings} bookings · ${row.completionRate}% completion`,
      value: row.revenue,
      status: `${row.productivityScore} score`
    }));
    if (kpiKey === "branches") return metrics.branchComparison.map((row) => ({
      title: row.name,
      meta: `${row.appointments} appointments · ${row.clients} clients`,
      value: row.revenue,
      status: `${row.completionRate}% completion`
    }));
    if (kpiKey === "anomalies") return this.openAnomalies(context.access, context.branchId).map((row) => ({
      title: row.title,
      meta: row.message,
      value: row.type,
      status: row.severity
    }));
    return this.kpiDetailMap(metrics).map((row) => ({
      title: row.title,
      meta: row.source,
      value: row.value,
      status: "mapped"
    }));
  }

  openAnomalies(access, branchId = "") {
    return anomalyDetectionService
      .getAnomalies(access.tenantId, "open")
      .filter((item) => !branchId || !item.branchId || item.branchId === branchId);
  }

  nextRunAt(cadence = "weekly") {
    const date = new Date();
    const days = cadence === "daily" ? 1 : cadence === "monthly" ? 30 : 7;
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);
    return date.toISOString();
  }

  titleFromKey(value = "") {
    return String(value || "kpi").split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
}

export const advancedAnalyticsService = new AdvancedAnalyticsService();
