import { repositories } from "../../repositories/repository-registry.js";
import { badRequest, notFound } from "../../utils/app-error.js";
import { tenantService } from "../tenant.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function status(value) {
  return String(value || "").toLowerCase();
}

function minutesBetween(start, end) {
  const startMs = new Date(start || "").getTime();
  const endMs = new Date(end || "").getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return Math.round((endMs - startMs) / 60000);
}

function dayKey(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function safeAppointment(appointment, clientsById, staffById, servicesById) {
  const services = (appointment.serviceIds || []).map((id) => servicesById.get(id)).filter(Boolean);
  return {
    id: appointment.id,
    branchId: appointment.branchId,
    clientId: appointment.clientId,
    clientName: clientsById.get(appointment.clientId)?.name || "",
    staffId: appointment.staffId,
    staffName: staffById.get(appointment.staffId)?.name || "",
    serviceIds: appointment.serviceIds || [],
    serviceNames: services.map((service) => service.name),
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    durationMinutes: minutesBetween(appointment.startAt, appointment.endAt) || services.reduce((sum, service) => sum + Number(service.durationMinutes || 0), 0),
    status: appointment.status || "booked",
    source: appointment.source || "front-desk",
    chair: appointment.chair || "",
    room: appointment.room || "",
    billable: Boolean(appointment.billable)
  };
}

export function buildCalendarAiContext({ appointmentId = "", branchId = "", staffId = "", serviceId = "", startAt = "", access }) {
  const effectiveBranchId = branchId || access.branchId || "";
  if (effectiveBranchId) tenantService.assertBranchAccess(access, effectiveBranchId);
  const scoped = scope(access, effectiveBranchId);
  const tenantScoped = scope(access);

  const appointment = appointmentId ? repositories.appointments.getById(appointmentId, tenantScoped) : null;
  if (appointmentId && !appointment) throw notFound("Appointment not found");
  if (appointment?.branchId) tenantService.assertBranchAccess(access, appointment.branchId);

  const activeBranchId = appointment?.branchId || effectiveBranchId;
  const activeScope = scope(access, activeBranchId);
  const query = activeBranchId ? { branchId: activeBranchId, limit: 10000 } : { limit: 10000 };
  const clients = repositories.clients.list(query, activeScope);
  const staff = repositories.staff.list(query, activeScope);
  const services = repositories.services.list({ limit: 10000 }, tenantScoped);
  const products = repositories.products.list(query, activeScope);
  const appointments = repositories.appointments.list(query, activeScope);
  const sales = repositories.sales.list(query, activeScope);
  const invoices = repositories.invoices.list(query, activeScope);
  const memberships = repositories.memberships.list(query, activeScope);

  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const staffById = new Map(staff.map((person) => [person.id, person]));
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const targetDate = dayKey(startAt || appointment?.startAt);
  const dayAppointments = appointments.filter((item) => dayKey(item.startAt) === targetDate);
  const selectedService = serviceId ? servicesById.get(serviceId) : null;
  if (serviceId && !selectedService) throw badRequest("Selected service was not found for Calendar AI");

  const completed = dayAppointments.filter((item) => ["completed", "billed", "paid"].includes(status(item.status))).length;
  const cancelled = dayAppointments.filter((item) => status(item.status) === "cancelled").length;
  const noShows = dayAppointments.filter((item) => status(item.status) === "no-show").length;
  const revenueByStaff = new Map();
  for (const sale of sales) {
    revenueByStaff.set(sale.staffId || "unassigned", money((revenueByStaff.get(sale.staffId || "unassigned") || 0) + Number(sale.total || 0)));
  }

  const staffLoad = staff.map((person) => {
    const bookings = dayAppointments.filter((item) => item.staffId === person.id);
    const bookedMinutes = bookings.reduce((sum, item) => sum + (minutesBetween(item.startAt, item.endAt) || 45), 0);
    return {
      id: person.id,
      name: person.name,
      role: person.role,
      status: person.status || "active",
      branchId: person.branchId,
      bookedMinutes,
      idleMinutes: Math.max(0, 480 - bookedMinutes),
      bookingCount: bookings.length,
      commissionForecast: money((revenueByStaff.get(person.id) || 0) * 0.1)
    };
  });

  const lowStockProducts = products
    .filter((product) => Number(product.stock || 0) <= Number(product.lowStockThreshold || 0))
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock: Number(product.stock || 0),
      lowStockThreshold: Number(product.lowStockThreshold || 0),
      branchId: product.branchId
    }));

  return {
    tenantId: access.tenantId,
    branchId: activeBranchId,
    targetDate,
    target: appointment ? safeAppointment(appointment, clientsById, staffById, servicesById) : {
      appointmentId: "",
      staffId,
      serviceId,
      startAt,
      serviceName: selectedService?.name || ""
    },
    metrics: {
      dayBookingCount: dayAppointments.length,
      completed,
      cancelled,
      noShows,
      noShowRate: dayAppointments.length ? money((noShows / dayAppointments.length) * 100) : 0,
      billableAppointments: dayAppointments.filter((item) => Number(item.billable || 0) === 1).length,
      unpaidInvoiceBalance: money(invoices.filter((invoice) => status(invoice.status) !== "paid").reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0)),
      activeMemberships: memberships.filter((membership) => status(membership.status || "active") === "active").length
    },
    staffLoad,
    dayAppointments: dayAppointments.slice(0, 80).map((item) => safeAppointment(item, clientsById, staffById, servicesById)),
    serviceCatalog: services.slice(0, 80).map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
      price: Number(service.price || 0),
      durationMinutes: Number(service.durationMinutes || 0),
      requiredProducts: service.requiredProducts || []
    })),
    inventory: {
      lowStockProducts,
      productCount: products.length
    },
    sourceCounts: {
      clients: clients.length,
      staff: staff.length,
      services: services.length,
      products: products.length,
      appointments: appointments.length,
      sales: sales.length,
      invoices: invoices.length
    }
  };
}
