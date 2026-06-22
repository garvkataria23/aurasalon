import { repositories } from "../../repositories/repository-registry.js";
import { badRequest, notFound } from "../../utils/app-error.js";
import { tenantService } from "../tenant.service.js";

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
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function rowDate(value) {
  const time = new Date(value || "").getTime();
  return Number.isNaN(time) ? 0 : time;
}

function normalizeStatus(value) {
  return String(value || "").toLowerCase();
}

function topEntry(counts) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
}

function addCount(map, key, count = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + Number(count || 1));
}

function clientSafeProfile(client) {
  return {
    id: client.id,
    name: client.name,
    phonePresent: Boolean(client.phone),
    emailPresent: Boolean(client.email),
    gender: client.gender || "",
    tags: client.tags || [],
    branchId: client.branchId || "",
    createdAt: client.createdAt || "",
    updatedAt: client.updatedAt || ""
  };
}

function activeMembership(memberships) {
  const today = Date.now();
  return memberships.find((membership) => {
    const status = normalizeStatus(membership.status || "active");
    const validUntil = membership.validityDate ? new Date(membership.validityDate).getTime() : 0;
    const valid = !validUntil || Number.isNaN(validUntil) || validUntil >= today;
    return status === "active" && valid;
  }) || null;
}

function preferredVisitTime(appointments) {
  const hours = appointments
    .map((appointment) => new Date(appointment.startAt || "").getHours())
    .filter((hour) => Number.isFinite(hour));
  if (!hours.length) return "Unknown";
  const average = Math.round(hours.reduce((sum, hour) => sum + hour, 0) / hours.length);
  if (average < 12) return "Morning";
  if (average < 17) return "Afternoon";
  return "Evening";
}

function repeatStatus(visitsCount) {
  if (visitsCount >= 5) return "loyal";
  if (visitsCount >= 2) return "repeat";
  if (visitsCount === 1) return "new";
  return "unvisited";
}

export function buildCustomerAiContext({ clientId, access }) {
  if (!clientId) throw badRequest("clientId is required for Customer 360 AI");
  const client = repositories.clients.getById(clientId, scope(access));
  if (!client) throw notFound("Client not found");
  if (client.branchId) tenantService.assertBranchAccess(access, client.branchId);

  const branchId = client.branchId || "";
  const scoped = scope(access, branchId);
  const tenantScope = scope(access);
  const appointments = repositories.appointments
    .list({ branchId, limit: 10000 }, scoped)
    .filter((appointment) => appointment.clientId === clientId);
  const sales = repositories.sales
    .list({ branchId, limit: 10000 }, scoped)
    .filter((sale) => sale.clientId === clientId);
  const invoices = repositories.invoices
    .list({ branchId, limit: 10000 }, scoped)
    .filter((invoice) => invoice.clientId === clientId);
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
  const payments = repositories.payments
    .list({ limit: 10000 }, tenantScope)
    .filter((payment) => invoiceIds.has(payment.invoiceId));
  const memberships = repositories.memberships
    .list({ branchId, limit: 10000 }, scoped)
    .filter((membership) => membership.clientId === clientId);
  const walletTransactions = repositories.walletTransactions
    .list({ clientId, limit: 10000 }, tenantScope)
    .filter((row) => row.clientId === clientId);
  const services = repositories.services.list({ limit: 10000 }, tenantScope);
  const staff = repositories.staff.list({ branchId, limit: 10000 }, scoped);

  const serviceById = new Map(services.map((service) => [service.id, service]));
  const staffById = new Map(staff.map((person) => [person.id, person]));
  const serviceCounts = new Map();
  const staffCounts = new Map();
  let serviceRevenue = 0;
  let productRevenue = 0;

  for (const appointment of appointments) {
    addCount(staffCounts, appointment.staffId);
    for (const serviceId of appointment.serviceIds || []) {
      const service = serviceById.get(serviceId);
      addCount(serviceCounts, service?.name || serviceId);
    }
  }

  for (const sale of sales) {
    addCount(staffCounts, sale.staffId);
    for (const item of sale.items || []) {
      const quantity = Number(item.quantity || 1);
      if (item.type === "service") {
        addCount(serviceCounts, item.name || serviceById.get(item.id)?.name || item.id, quantity);
        serviceRevenue += Number(item.price || 0) * quantity;
      }
      if (item.type === "product") productRevenue += Number(item.price || 0) * quantity;
    }
  }

  const completedBookings = appointments.filter((item) => ["completed", "billed", "paid"].includes(normalizeStatus(item.status))).length;
  const cancelledBookings = appointments.filter((item) => normalizeStatus(item.status) === "cancelled").length;
  const noShowBookings = appointments.filter((item) => normalizeStatus(item.status) === "no-show").length;
  const lastVisitAt = [
    client.lastVisitAt,
    ...appointments.filter((item) => ["completed", "billed", "paid"].includes(normalizeStatus(item.status))).map((item) => item.startAt),
    ...sales.map((sale) => sale.createdAt)
  ].filter(Boolean).sort((a, b) => rowDate(b) - rowDate(a))[0] || "";
  const visitsCount = Math.max(Number(client.visitCount || 0), completedBookings, sales.length);
  const totalSpend = money(Math.max(
    Number(client.totalSpend || 0),
    sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
  ));
  const pendingPaymentAmount = money(invoices
    .filter((invoice) => normalizeStatus(invoice.status) !== "paid")
    .reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0));
  const membership = activeMembership(memberships);
  const favoriteService = topEntry(serviceCounts)?.[0] || "";
  const favoriteStaffId = topEntry(staffCounts)?.[0] || "";
  const favoriteStaff = staffById.get(favoriteStaffId)?.name || "";
  const preferredTime = preferredVisitTime(appointments);
  const inactiveDays = daysSince(lastVisitAt);
  const averageSpend = visitsCount ? money(totalSpend / visitsCount) : 0;
  const churnSignals = [];
  const upsellSignals = [];

  if (inactiveDays >= 90) churnSignals.push("90+ days since last visit");
  else if (inactiveDays >= 60) churnSignals.push("60+ days since last visit");
  else if (inactiveDays >= 30) churnSignals.push("30+ days since last visit");
  if (noShowBookings > 0) churnSignals.push(`${noShowBookings} no-show booking(s)`);
  if (cancelledBookings > 0) churnSignals.push(`${cancelledBookings} cancelled booking(s)`);
  if (pendingPaymentAmount > 0) churnSignals.push(`Pending payment INR ${pendingPaymentAmount}`);
  if (visitsCount <= 1) churnSignals.push("Low visit history");
  if (membership) upsellSignals.push("Active membership client");
  if (!membership && visitsCount >= 3) upsellSignals.push("Repeat client without active membership");
  if (favoriteService) upsellSignals.push(`Favorite service: ${favoriteService}`);
  if (productRevenue === 0 && serviceRevenue > 0) upsellSignals.push("No retail product purchase recorded");
  if (averageSpend > 0) upsellSignals.push(`Average spend INR ${averageSpend}`);

  return {
    tenantId: access.tenantId,
    branchId,
    client: clientSafeProfile(client),
    metrics: {
      totalSpend,
      visitsCount,
      lastVisitAt,
      daysSinceLastVisit: inactiveDays,
      averageSpend,
      completedBookings,
      cancelledBookings,
      noShowBookings,
      pendingPaymentAmount,
      activeMembership: membership ? {
        id: membership.id,
        planName: membership.planName,
        creditsRemaining: Number(membership.creditsRemaining || 0),
        validityDate: membership.validityDate || "",
        status: membership.status || "active"
      } : null,
      favoriteService,
      favoriteStaff,
      repeatStatus: repeatStatus(visitsCount),
      preferredVisitTime: preferredTime,
      serviceRevenue: money(serviceRevenue),
      productRevenue: money(productRevenue),
      walletBalance: Number(client.walletBalance || 0),
      loyaltyPoints: Number(client.loyaltyPoints || 0),
      paymentCount: payments.length,
      walletActivityCount: walletTransactions.length
    },
    preferences: {
      favoriteService,
      favoriteStaff,
      preferredVisitTime: preferredTime
    },
    churnSignals,
    upsellSignals,
    catalog: {
      activeServices: services
        .filter((service) => normalizeStatus(service.status || "active") === "active")
        .slice(0, 20)
        .map((service) => ({
          id: service.id,
          name: service.name,
          category: service.category,
          price: Number(service.price || 0),
          durationMinutes: Number(service.durationMinutes || 0)
        }))
    },
    sourceCounts: {
      appointments: appointments.length,
      sales: sales.length,
      invoices: invoices.length,
      payments: payments.length,
      memberships: memberships.length
    }
  };
}
