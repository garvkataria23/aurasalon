import { db } from "../../db.js";
import { assertAiTaskAllowed } from "./aiPolicy.js";
import { tenantService } from "../tenant.service.js";

const money = (value) => Math.round(Number(value || 0));

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function daysSince(value) {
  if (!value) return 999;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 999;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function daysUntil(value) {
  if (!value) return 999;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 999;
  return Math.floor((date.getTime() - Date.now()) / 86400000);
}

function riskLevel(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function scopeBranch(access, query = {}) {
  const branchId = String(query.branchId || access.branchId || "");
  if (branchId) tenantService.assertBranchAccess(access, branchId);
  return branchId;
}

function branchWhere(branchId) {
  return branchId ? "AND (branchId = ? OR branchId = '')" : "";
}

function confidenceFor(sourceMetrics = {}) {
  const metricCount = Object.values(sourceMetrics).filter((value) => value !== undefined && value !== null && value !== "").length;
  return Math.max(0.35, Math.min(0.92, Math.round((0.35 + metricCount * 0.08) * 100) / 100));
}

function result({ score, reason, recommendedAction, sourceMetrics, id = "", name = "", type = "" }) {
  const rounded = Math.max(0, Math.min(100, Math.round(score)));
  return {
    id,
    name,
    type,
    riskLevel: riskLevel(rounded),
    score: rounded,
    reason,
    recommendedAction,
    sourceMetrics,
    confidence: confidenceFor(sourceMetrics)
  };
}

export class PredictiveIntelligenceService {
  clientPredictions(query = {}, access) {
    assertAiTaskAllowed({ taskKey: "customer360.churn_risk", tenantId: access.tenantId, role: access.role });
    const branchId = scopeBranch(access, query);
    const params = branchId ? [access.tenantId, branchId] : [access.tenantId];
    const clients = db.prepare(`SELECT * FROM clients WHERE tenantId = ? ${branchWhere(branchId)} ORDER BY updatedAt DESC LIMIT 200`).all(...params);
    const appointments = db.prepare(`SELECT clientId, status, startAt, serviceIds FROM appointments WHERE tenantId = ?`).all(access.tenantId);
    const invoices = db.prepare("SELECT clientId, createdAt, total, balance, status FROM invoices WHERE tenantId = ?").all(access.tenantId);
    const memberships = new Map(db.prepare("SELECT * FROM memberships WHERE tenantId = ?").all(access.tenantId).map((item) => [item.id, item]));
    return {
      generatedAt: new Date().toISOString(),
      predictions: clients.map((client) => {
        const rows = appointments.filter((appointment) => appointment.clientId === client.id);
        const noShows = rows.filter((appointment) => String(appointment.status || "").toLowerCase() === "no-show").length;
        const cancelled = rows.filter((appointment) => String(appointment.status || "").toLowerCase() === "cancelled").length;
        const inactiveDays = daysSince(client.lastVisitAt || client.updatedAt || client.createdAt);
        const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.id);
        const recentSpend = clientInvoices
          .filter((invoice) => daysSince(invoice.createdAt) <= 90)
          .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
        const olderSpend = clientInvoices
          .filter((invoice) => daysSince(invoice.createdAt) > 90 && daysSince(invoice.createdAt) <= 180)
          .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
        const spendDrop = olderSpend > 0 ? Math.max(0, (olderSpend - recentSpend) / olderSpend) : 0;
        const pendingPaymentAmount = clientInvoices
          .filter((invoice) => String(invoice.status || "").toLowerCase() !== "paid")
          .reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);
        const membership = memberships.get(client.membershipId || "");
        const membershipExpiryDays = membership ? daysUntil(membership.validUntil || membership.endDate || membership.expiresAt) : 999;
        let score = Math.min(55, inactiveDays * 0.65);
        if (Number(client.visitCount || 0) <= 1) score += 14;
        if (noShows) score += Math.min(20, noShows * 8);
        if (cancelled) score += Math.min(14, cancelled * 5);
        if (spendDrop >= 0.5) score += 16;
        if (pendingPaymentAmount > 0) score += 10;
        if (membershipExpiryDays <= 30) score += 10;
        if (Number(client.totalSpend || 0) >= 25000) score -= 8;
        if (String(client.membershipId || "") && membershipExpiryDays > 30) score -= 8;
        return result({
          id: client.id,
          name: client.name,
          type: "client_churn",
          score,
          reason: `${inactiveDays} days since last visit, ${noShows} no-show(s), ${cancelled} cancellation(s), ${Math.round(spendDrop * 100)}% spend drop.`,
          recommendedAction: score >= 70 ? "Send win-back WhatsApp draft with a personal offer" : score >= 40 ? "Schedule rebooking follow-up" : "Keep loyalty nurture active",
          sourceMetrics: {
            inactiveDays,
            visits: client.visitCount || 0,
            totalSpend: client.totalSpend || 0,
            noShows,
            cancelled,
            spendDrop,
            pendingPaymentAmount,
            membershipExpiryDays
          }
        });
      }).sort((a, b) => b.score - a.score)
    };
  }

  appointmentPredictions(query = {}, access) {
    assertAiTaskAllowed({ taskKey: "calendar.no_show_risk", tenantId: access.tenantId, role: access.role });
    const branchId = scopeBranch(access, query);
    const params = branchId ? [access.tenantId, branchId] : [access.tenantId];
    const appointments = db.prepare(`SELECT * FROM appointments WHERE tenantId = ? ${branchWhere(branchId)} ORDER BY startAt ASC LIMIT 200`).all(...params);
    const clients = new Map(db.prepare("SELECT * FROM clients WHERE tenantId = ?").all(access.tenantId).map((client) => [client.id, client]));
    return {
      generatedAt: new Date().toISOString(),
      predictions: appointments.map((appointment) => {
        const client = clients.get(appointment.clientId) || {};
        const history = db.prepare("SELECT status, startAt FROM appointments WHERE tenantId = ? AND clientId = ?").all(access.tenantId, appointment.clientId);
        const noShows = history.filter((row) => String(row.status || "").toLowerCase() === "no-show").length;
        const cancellations = history.filter((row) => String(row.status || "").toLowerCase() === "cancelled").length;
        const pending = db.prepare("SELECT COALESCE(SUM(balance), 0) AS total FROM invoices WHERE tenantId = ? AND clientId = ? AND status != 'paid'").get(access.tenantId, appointment.clientId)?.total || 0;
        const bookedLeadHours = appointment.createdAt && appointment.startAt
          ? (new Date(appointment.startAt).getTime() - new Date(appointment.createdAt).getTime()) / 3600000
          : 48;
        const sourceRisk = String(appointment.source || "").includes("online") ? 10 : String(appointment.source || "").includes("walk") ? 8 : 0;
        let score = noShows * 22 + cancellations * 7 + (pending > 0 ? 18 : 0) + (!client.phone ? 14 : 0) + sourceRisk;
        if (bookedLeadHours < 12) score += 10;
        if (String(appointment.source || "").includes("walk")) score += 8;
        return result({
          id: appointment.id,
          name: client.name || appointment.clientId,
          type: "appointment_no_show_delay",
          score,
          reason: `${noShows} prior no-show(s), ${cancellations} cancellation(s), pending INR ${money(pending)}, lead time ${Math.round(bookedLeadHours)}h.`,
          recommendedAction: score >= 70 ? "Confirm by phone and collect advance before holding slot" : score >= 40 ? "Send confirmation reminder" : "Normal confirmation is enough",
          sourceMetrics: { noShows, cancellations, pendingPaymentAmount: pending, source: appointment.source, bookedLeadHours, status: appointment.status, startAt: appointment.startAt }
        });
      }).sort((a, b) => b.score - a.score)
    };
  }

  demandPredictions(query = {}, access) {
    assertAiTaskAllowed({ taskKey: "dashboard.risk_briefing", tenantId: access.tenantId, role: access.role });
    const branchId = scopeBranch(access, query);
    const params = branchId ? [access.tenantId, branchId] : [access.tenantId];
    const appointments = db.prepare(`SELECT * FROM appointments WHERE tenantId = ? ${branchWhere(branchId)}`).all(...params);
    const services = new Map(db.prepare("SELECT id, name FROM services WHERE tenantId = ?").all(access.tenantId).map((service) => [service.id, service.name]));
    const hourCounts = new Map();
    const serviceDemand = new Map();
    appointments.forEach((appointment) => {
      const date = new Date(appointment.startAt || "");
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getDay()}-${date.getHours()}`;
      hourCounts.set(key, (hourCounts.get(key) || 0) + 1);
      parseJson(appointment.serviceIds, []).forEach((serviceId) => {
        serviceDemand.set(serviceId, (serviceDemand.get(serviceId) || 0) + 1);
      });
    });
    const topService = [...serviceDemand.entries()].sort((a, b) => b[1] - a[1])[0];
    const predictions = [...hourCounts.entries()]
      .map(([key, count]) => {
        const [day, hour] = key.split("-").map(Number);
        return result({
          id: key,
          name: `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]} ${hour}:00`,
          type: "demand_forecast",
          score: Math.min(100, count * 18),
          reason: `${count} saved appointment(s) historically in this day/hour bucket. Top demand: ${services.get(topService?.[0]) || "mixed services"}.`,
          recommendedAction: count >= 4 ? "Add staff coverage or promote high-margin services" : "Use this slot for rebooking and offers",
          sourceMetrics: { dayOfWeek: day, hour, appointments: count, topServiceId: topService?.[0] || "", topServiceDemand: topService?.[1] || 0 }
        });
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return { generatedAt: new Date().toISOString(), predictions };
  }

  inventoryPredictions(query = {}, access) {
    assertAiTaskAllowed({ taskKey: "inventory.reorder_prediction", tenantId: access.tenantId, role: access.role });
    const branchId = scopeBranch(access, query);
    const params = branchId ? [access.tenantId, branchId] : [access.tenantId];
    const products = db.prepare(`SELECT * FROM products WHERE tenantId = ? ${branchWhere(branchId)} ORDER BY stock ASC LIMIT 5000`).all(...params);
    const recentTransactions = db.prepare(`
      SELECT productId, SUM(ABS(quantity)) AS used
      FROM inventory_transactions
      WHERE tenantId = ? AND quantity < 0 AND createdAt >= ?
      GROUP BY productId
    `).all(access.tenantId, new Date(Date.now() - 30 * 86400000).toISOString());
    const velocityByProduct = new Map(recentTransactions.map((row) => [row.productId, Number(row.used || 0) / 30]));
    return {
      generatedAt: new Date().toISOString(),
      predictions: products.map((product) => {
        const stock = Number(product.stock || 0);
        const threshold = Number(product.lowStockThreshold || 0);
        const velocity = velocityByProduct.get(product.id) || 0;
        const daysToStockout = velocity > 0 ? stock / velocity : 999;
        const expiryDays = product.expiryDate ? daysUntil(product.expiryDate) : 999;
        let score = stock <= threshold ? 76 : Math.max(5, 45 - stock);
        if (daysToStockout <= 14) score += 18;
        if (expiryDays <= 30) score += 18;
        return result({
          id: product.id,
          name: product.name,
          type: "inventory_stockout",
          score,
          reason: `${stock} in stock, threshold ${threshold}, ${Math.round(velocity * 10) / 10}/day usage, stockout in ${Math.round(daysToStockout)} day(s).`,
          recommendedAction: score >= 70 ? "Create purchase entry and pause promotion for dependent services" : "Monitor stock during daily close",
          sourceMetrics: { stock, lowStockThreshold: threshold, expiryDate: product.expiryDate, expiryDays, dailyUsageVelocity: velocity, daysToStockout }
        });
      }).sort((a, b) => b.score - a.score)
    };
  }

  revenuePredictions(query = {}, access) {
    assertAiTaskAllowed({ taskKey: "dashboard.revenue_actions", tenantId: access.tenantId, role: access.role });
    const branchId = scopeBranch(access, query);
    const params = branchId ? [access.tenantId, branchId] : [access.tenantId];
    const pending = db.prepare(`SELECT COALESCE(SUM(balance), 0) AS total, COUNT(*) AS count FROM invoices WHERE tenantId = ? ${branchWhere(branchId)} AND status != 'paid' AND balance > 0`).get(...params);
    const cancelled = db.prepare(`SELECT COUNT(*) AS count FROM appointments WHERE tenantId = ? ${branchWhere(branchId)} AND status IN ('cancelled','no-show')`).get(...params);
    const discounts = db.prepare(`SELECT COALESCE(SUM(discount), 0) AS total FROM sales WHERE tenantId = ? ${branchWhere(branchId)}`).get(...params);
    const completed = db.prepare(`SELECT COUNT(*) AS count FROM appointments WHERE tenantId = ? ${branchWhere(branchId)} AND status IN ('completed','billed','paid')`).get(...params);
    const allAppointments = db.prepare(`SELECT COUNT(*) AS count FROM appointments WHERE tenantId = ? ${branchWhere(branchId)}`).get(...params);
    const idleClients = db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(totalSpend), 0) AS totalSpend FROM clients WHERE tenantId = ? AND visitCount > 0").get(access.tenantId);
    const leakage = Number(pending?.total || 0) + Number(cancelled?.count || 0) * 800;
    const utilizationGap = allAppointments?.count ? 1 - Number(completed?.count || 0) / Number(allAppointments.count || 1) : 0;
    return {
      generatedAt: new Date().toISOString(),
      predictions: [
        result({
          id: "pending-payments",
          name: "Pending payment leakage",
          type: "revenue_leakage",
          score: Math.min(100, Number(pending?.count || 0) * 15 + Number(pending?.total || 0) / 1000),
          reason: `INR ${money(pending?.total)} pending across ${pending?.count || 0} invoice(s).`,
          recommendedAction: "Run payment reminder suggestions before closing",
          sourceMetrics: { pendingPaymentAmount: pending?.total || 0, invoices: pending?.count || 0, discountLeakage: discounts?.total || 0 }
        }),
        result({
          id: "cancelled-noshow",
          name: "Cancelled/no-show leakage",
          type: "revenue_leakage",
          score: Math.min(100, Number(cancelled?.count || 0) * 10 + utilizationGap * 35),
          reason: `${cancelled?.count || 0} cancelled/no-show appointment(s), ${Math.round(utilizationGap * 100)}% utilization gap can be recovered.`,
          recommendedAction: "Run no-show follow-up and rebooking suggestions",
          sourceMetrics: { cancelledOrNoShow: cancelled?.count || 0, estimatedLeakage: leakage, utilizationGap }
        }),
        result({
          id: "client-recovery",
          name: "Inactive client recovery",
          type: "revenue_recovery",
          score: Math.min(100, Number(idleClients?.count || 0) * 2),
          reason: `${idleClients?.count || 0} clients with saved history hold INR ${money(idleClients?.totalSpend)} lifetime value.`,
          recommendedAction: "Generate inactive client win-back suggestions",
          sourceMetrics: { clientsWithHistory: idleClients?.count || 0, lifetimeValue: idleClients?.totalSpend || 0 }
        })
      ]
    };
  }
}

export const predictiveIntelligenceService = new PredictiveIntelligenceService();
