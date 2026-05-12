import { repositories } from "../repositories/repository-registry.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function daysSince(value) {
  if (!value) return 999;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 999;
  return Math.max(0, Math.round((Date.now() - time) / 86400000));
}

export class Customer360Service {
  summary(query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const clients = repositories.clients.list({ branchId, limit: 10000 }, scope(access, branchId));
    const profiles = clients.map((client) => this.intelligenceForClient(client.id, access, false));
    return {
      metrics: {
        clients: profiles.length,
        totalLtv: money(profiles.reduce((sum, item) => sum + Number(item.metrics.lifetimeValue || 0), 0)),
        avgSpend: profiles.length ? money(profiles.reduce((sum, item) => sum + Number(item.metrics.averageSpend || 0), 0) / profiles.length) : 0,
        highRisk: profiles.filter((item) => item.metrics.riskScore >= 70).length,
        vip: clients.filter((client) => (client.tags || []).includes("VIP")).length
      },
      profiles,
      snapshots: repositories.customerIntelligenceSnapshots.list({ branchId, limit: 50 }, scope(access, branchId))
    };
  }

  profile(clientId, access) {
    return this.intelligenceForClient(clientId, access, true);
  }

  addTimelineEvent(clientId, payload = {}, access) {
    if (!payload.title && !payload.body) throw badRequest("title or body is required");
    const client = repositories.clients.getById(clientId, scope(access));
    if (!client) throw notFound("Client not found");
    if (client.branchId) tenantService.assertBranchAccess(access, client.branchId);
    const event = repositories.customerTimelineEvents.create({
      id: makeId("ctime"),
      branchId: client.branchId || "",
      clientId,
      type: payload.type || "note",
      title: payload.title || "Client note",
      body: payload.body || "",
      metadata: payload.metadata || { author: access.userId || "system" }
    }, scope(access, client.branchId || ""));
    if (payload.body) {
      repositories.clients.update(clientId, {
        notes: [client.notes, `${now().slice(0, 10)}: ${payload.body}`].filter(Boolean).join("\n")
      }, scope(access));
    }
    return event;
  }

  generateSnapshot(clientId, access) {
    const profile = this.intelligenceForClient(clientId, access, false);
    const snapshot = repositories.customerIntelligenceSnapshots.create({
      id: makeId("c360"),
      branchId: profile.client.branchId || "",
      clientId,
      metrics: profile.metrics,
      insights: profile.insights,
      nextBestAction: profile.nextBestAction,
      status: "generated"
    }, scope(access, profile.client.branchId || ""));
    return { snapshot, profile };
  }

  intelligenceForClient(clientId, access, includeTimeline = true) {
    const client = repositories.clients.getById(clientId, scope(access));
    if (!client) throw notFound("Client not found");
    if (client.branchId) tenantService.assertBranchAccess(access, client.branchId);
    const queryScope = scope(access, client.branchId || "");
    const sales = repositories.sales.list({ branchId: client.branchId || "", limit: 10000 }, queryScope).filter((sale) => sale.clientId === clientId);
    const invoices = repositories.invoices.list({ limit: 10000 }, scope(access)).filter((invoice) => invoice.clientId === clientId);
    const appointments = repositories.appointments.list({ branchId: client.branchId || "", limit: 10000 }, queryScope).filter((appointment) => appointment.clientId === clientId);
    const memberships = repositories.memberships.list({ branchId: client.branchId || "", limit: 10000 }, queryScope).filter((membership) => membership.clientId === clientId);
    const serviceCounts = new Map();
    const staffCounts = new Map();
    for (const sale of sales) {
      for (const item of sale.items || []) {
        if (item.type === "service") serviceCounts.set(item.name, (serviceCounts.get(item.name) || 0) + Number(item.quantity || 1));
      }
      if (sale.staffId) staffCounts.set(sale.staffId, (staffCounts.get(sale.staffId) || 0) + 1);
    }
    for (const appointment of appointments) {
      if (appointment.staffId) staffCounts.set(appointment.staffId, (staffCounts.get(appointment.staffId) || 0) + 1);
      for (const serviceId of appointment.serviceIds || []) {
        const service = repositories.services.getById(serviceId, scope(access));
        if (service) serviceCounts.set(service.name, (serviceCounts.get(service.name) || 0) + 1);
      }
    }
    const favoriteService = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "No favorite yet";
    const preferredStaffId = [...staffCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const preferredStaff = preferredStaffId ? repositories.staff.getById(preferredStaffId, scope(access)) : null;
    const lifetimeValue = money(Number(client.totalSpend || 0) || invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0));
    const visitCount = Number(client.visitCount || appointments.filter((item) => item.status === "completed").length || sales.length);
    const averageSpend = visitCount ? money(lifetimeValue / visitCount) : 0;
    const inactiveDays = daysSince(client.lastVisitAt);
    const noShows = appointments.filter((item) => item.status === "no-show").length;
    const riskScore = Math.min(100, Math.round((inactiveDays > 90 ? 45 : inactiveDays > 45 ? 25 : 8) + noShows * 12 + (visitCount <= 1 ? 15 : 0)));
    const nextBestAction = this.nextBestAction({ client, lifetimeValue, inactiveDays, riskScore, favoriteService, memberships });
    const insights = [
      `${client.name} has lifetime value INR ${lifetimeValue}.`,
      favoriteService === "No favorite yet" ? "Favorite service is not established yet." : `Favorite service is ${favoriteService}.`,
      preferredStaff ? `Preferred staff appears to be ${preferredStaff.name}.` : "Preferred staff is not established yet.",
      riskScore >= 70 ? "High churn risk; prioritize personal follow-up." : "Risk is manageable with normal follow-up."
    ];
    return {
      client,
      metrics: {
        lifetimeValue,
        lastVisit: client.lastVisitAt || "",
        inactiveDays,
        favoriteService,
        averageSpend,
        riskScore,
        preferredStaffId,
        preferredStaffName: preferredStaff?.name || "",
        visitCount,
        outstandingBalance: money(invoices.reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0)),
        loyaltyPoints: Number(client.loyaltyPoints || 0),
        membershipStatus: memberships[0]?.status || "none"
      },
      insights,
      nextBestAction,
      timeline: includeTimeline ? this.timeline(client, sales, invoices, appointments, access) : []
    };
  }

  timeline(client, sales, invoices, appointments, access) {
    const events = repositories.customerTimelineEvents.list({ branchId: client.branchId || "", limit: 100 }, scope(access, client.branchId || "")).filter((item) => item.clientId === client.id);
    const appointmentEvents = appointments.map((appointment) => ({
      id: `appt-${appointment.id}`,
      type: "appointment",
      title: `Appointment ${appointment.status}`,
      body: appointment.notes || appointment.source,
      createdAt: appointment.startAt,
      metadata: { appointmentId: appointment.id }
    }));
    const saleEvents = sales.map((sale) => ({
      id: `sale-${sale.id}`,
      type: "purchase",
      title: `Sale INR ${sale.total}`,
      body: (sale.items || []).map((item) => item.name).join(", "),
      createdAt: sale.createdAt,
      metadata: { saleId: sale.id }
    }));
    const invoiceEvents = invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      type: "invoice",
      title: `${invoice.invoiceNumber} ${invoice.status}`,
      body: `Paid INR ${invoice.paid}, balance INR ${invoice.balance}`,
      createdAt: invoice.createdAt,
      metadata: { invoiceId: invoice.id }
    }));
    return [...events, ...appointmentEvents, ...saleEvents, ...invoiceEvents].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 60);
  }

  nextBestAction({ client, lifetimeValue, inactiveDays, riskScore, favoriteService, memberships }) {
    if (riskScore >= 70) {
      return { action: "Send personal win-back WhatsApp", reason: "High churn risk", channel: "WhatsApp", priority: "high" };
    }
    if (!memberships.length && lifetimeValue > 5000) {
      return { action: "Offer premium membership", reason: "High LTV without membership", channel: "Front desk", priority: "medium" };
    }
    if (inactiveDays > 30) {
      return { action: `Offer ${favoriteService} comeback package`, reason: "Client has not visited recently", channel: "WhatsApp", priority: "medium" };
    }
    if ((client.tags || []).includes("VIP")) {
      return { action: "Invite to priority slot or new launch", reason: "VIP relationship", channel: "Call", priority: "medium" };
    }
    return { action: "Ask for review after next visit", reason: "Healthy customer profile", channel: "WhatsApp", priority: "normal" };
  }
}

export const customer360Service = new Customer360Service();
