import { repositories } from "../repositories/repository-registry.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { resourceService } from "./resource.service.js";
import { tenantService } from "./tenant.service.js";

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {}, "appointments");
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function addDays(value, days) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw badRequest("Invalid warranty date");
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString();
}

function money(value) {
  return Number(value || 0);
}

function serviceIdsFor(appointment = {}) {
  return Array.isArray(appointment.serviceIds) ? appointment.serviceIds : [];
}

function getAppointment(id, access) {
  const row = repositories.appointments.getById(id, scope(access));
  if (!row) throw notFound("Appointment not found");
  if (row.branchId) tenantService.assertBranchAccess(access, row.branchId);
  return row;
}

function warrantyServices(appointment, access) {
  return serviceIdsFor(appointment)
    .map((id) => repositories.services.getById(id, tenantService.accessScope(access || {}, "services")))
    .filter(Boolean)
    .filter((service) => Number(service.warrantyDays || 0) > 0);
}

function estimateOperationalCost(appointment, access) {
  const services = serviceIdsFor(appointment)
    .map((id) => repositories.services.getById(id, tenantService.accessScope(access || {}, "services")))
    .filter(Boolean);
  const productCost = services.reduce((sum, service) => {
    const requiredProducts = Array.isArray(service.requiredProducts) ? service.requiredProducts : [];
    return sum + requiredProducts.reduce((productSum, item) => {
      const productId = item.productId || item.id;
      const product = productId ? repositories.products.getById(productId, tenantService.accessScope(access || {}, "products")) : null;
      const unitCost = money(product?.costPrice || product?.purchasePrice || product?.price || item.cost || 0);
      return productSum + unitCost * money(item.quantity || item.qty || 1);
    }, 0);
  }, 0);
  const durationMinutes = Math.max(30, (new Date(appointment.endAt || appointment.startAt).getTime() - new Date(appointment.startAt).getTime()) / 60000 || 45);
  const staffTimeCost = Math.round(durationMinutes * 3);
  return Math.round((productCost + staffTimeCost) * 100) / 100;
}

export const warrantyService = {
  applyWarrantyOnCompletion(appointmentId, access) {
    const appointment = getAppointment(appointmentId, access);
    const services = warrantyServices(appointment, access);
    if (!services.length) return { appointment, warrantyApplied: false };
    const maxDays = Math.max(...services.map((service) => Number(service.warrantyDays || 0)));
    const warrantyUntil = addDays(new Date().toISOString(), maxDays);
    const updated = repositories.appointments.update(appointment.id, { warrantyUntil }, scope(access, appointment.branchId));
    return { appointment: updated, warrantyApplied: true, warrantyUntil, warrantyDays: maxDays };
  },

  eligibility(appointmentId, access) {
    const appointment = getAppointment(appointmentId, access);
    if (Number(appointment.isTouchup || 0) === 1) {
      return { eligible: false, reason: "Touch-up appointments do not create another warranty", appointment };
    }
    if (appointment.status !== "completed" && appointment.status !== "billed" && appointment.status !== "paid") {
      return { eligible: false, reason: "Appointment must be completed before warranty touch-up", appointment };
    }
    const warrantyUntil = appointment.warrantyUntil ? new Date(appointment.warrantyUntil) : null;
    if (!warrantyUntil || Number.isNaN(warrantyUntil.getTime()) || warrantyUntil.getTime() < Date.now()) {
      return { eligible: false, reason: "Warranty period is not active", appointment };
    }
    const existingTouchup = repositories.appointments
      .list({ limit: 1000 }, scope(access, appointment.branchId))
      .find((row) => row.touchupOfAppointmentId === appointment.id && !["cancelled", "no-show"].includes(row.status));
    if (existingTouchup) {
      return { eligible: false, reason: "Touch-up is already booked", appointment, touchupAppointment: existingTouchup };
    }
    const cost = estimateOperationalCost(appointment, access);
    return {
      eligible: true,
      reason: "Within warranty period",
      warrantyUntil: appointment.warrantyUntil,
      estimatedOperationalCost: cost,
      appointment
    };
  },

  eligibleAppointmentsForClient(clientId, access) {
    if (!clientId) throw badRequest("clientId is required");
    return repositories.appointments
      .list({ clientId, limit: 10000 }, scope(access))
      .map((appointment) => this.eligibility(appointment.id, access))
      .filter((item) => item.eligible);
  },

  createTouchupAppointment(appointmentId, payload = {}, access, req = null) {
    const eligibility = this.eligibility(appointmentId, access);
    if (!eligibility.eligible) throw conflict(eligibility.reason, eligibility);
    const original = eligibility.appointment;
    const startAt = payload.startAt || payload.startTime;
    if (!startAt) throw badRequest("startAt is required for touch-up booking");
    const durationMs = new Date(original.endAt || original.startAt).getTime() - new Date(original.startAt).getTime();
    const endAt = payload.endAt || new Date(new Date(startAt).getTime() + Math.max(durationMs, 45 * 60000)).toISOString();
    const appointment = resourceService.create("appointments", {
      clientId: original.clientId,
      staffId: payload.staffId || original.staffId,
      branchId: payload.branchId || original.branchId,
      serviceIds: payload.serviceIds || original.serviceIds || [],
      startAt,
      endAt,
      status: payload.status || "booked",
      source: "warranty-touchup",
      sourceChannel: "touchup",
      chair: payload.chair || original.chair || "",
      room: payload.room || original.room || "",
      isTouchup: 1,
      touchupOfAppointmentId: original.id,
      touchupCost: eligibility.estimatedOperationalCost,
      billable: 0,
      notes: [payload.notes || "", `Warranty touch-up for ${original.id}`].filter(Boolean).join(" | ")
    }, access, { req });
    this.markWarrantyConsumed(original.id, access);
    return { appointment, sourceAppointmentId: original.id, estimatedOperationalCost: eligibility.estimatedOperationalCost };
  },

  markWarrantyConsumed(appointmentId, access) {
    const appointment = getAppointment(appointmentId, access);
    const notes = [appointment.notes, `Warranty touch-up consumed at ${new Date().toISOString()}`].filter(Boolean).join(" | ");
    return repositories.appointments.update(appointment.id, { warrantyUntil: new Date().toISOString(), notes }, scope(access, appointment.branchId));
  },

  costImpact(access, query = {}) {
    const from = query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const to = query.to || new Date().toISOString();
    const branchId = query.branchId || "";
    const rows = repositories.appointments.list({ branchId, limit: 100000 }, scope(access, branchId))
      .filter((row) => (row.startAt || row.createdAt) >= from && (row.startAt || row.createdAt) <= to);
    const touchups = rows.filter((row) => Number(row.isTouchup || 0) === 1);
    const revenue = repositories.sales.list({ branchId, limit: 100000 }, tenantService.accessScope(access || {}, "sales"))
      .filter((sale) => (sale.createdAt || "") >= from && (sale.createdAt || "") <= to)
      .reduce((sum, sale) => sum + money(sale.total), 0);
    const touchupCost = touchups.reduce((sum, row) => sum + money(row.touchupCost), 0);
    const byStaff = Object.values(touchups.reduce((acc, row) => {
      const key = row.staffId || "unassigned";
      acc[key] ||= { staffId: key, touchups: 0, cost: 0 };
      acc[key].touchups += 1;
      acc[key].cost += money(row.touchupCost);
      return acc;
    }, {}));
    const byService = Object.values(touchups.reduce((acc, row) => {
      for (const serviceId of serviceIdsFor(row)) {
        acc[serviceId] ||= { serviceId, touchups: 0, cost: 0 };
        acc[serviceId].touchups += 1;
        acc[serviceId].cost += money(row.touchupCost) / Math.max(1, serviceIdsFor(row).length);
      }
      return acc;
    }, {}));
    return {
      from,
      to,
      branchId,
      revenue,
      touchups: touchups.length,
      touchupCost,
      touchupCostPct: revenue > 0 ? Math.round((touchupCost * 10000) / revenue) / 100 : 0,
      byStaff,
      byService
    };
  }
};
