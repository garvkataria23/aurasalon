import { db } from "../db.js";
import { appointmentActivityService } from "./appointment-activity.service.js";
import { appointmentLifecycleService } from "./appointment-lifecycle.service.js";
import { resourceService } from "./resource.service.js";
import { serviceRulesService } from "./service-rules.service.js";
import { AppError, badRequest, conflict, forbidden, notFound } from "../utils/app-error.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_INITIAL_STATUSES = new Set(["draft", "booked", "confirmed"]);
const OWNER_TRANSITIONS = Object.freeze({
  draft: { allowedStatusTransitions: ["booked", "confirmed"], supportedActions: ["update", "setStatus", "reschedule", "cancel"] },
  booked: { allowedStatusTransitions: ["confirmed", "waiting"], supportedActions: ["update", "setStatus", "reschedule", "cancel", "checkIn", "noShow"] },
  confirmed: { allowedStatusTransitions: ["waiting"], supportedActions: ["update", "setStatus", "reschedule", "cancel", "checkIn", "noShow"] },
  rescheduled: { allowedStatusTransitions: ["confirmed", "waiting"], supportedActions: ["update", "setStatus", "reschedule", "cancel", "checkIn", "noShow"] },
  arrived: { allowedStatusTransitions: ["waiting"], supportedActions: ["update", "setStatus", "startService", "cancel", "noShow"] },
  waiting: { allowedStatusTransitions: [], supportedActions: ["update", "startService", "cancel", "noShow"] },
  "in-service": { allowedStatusTransitions: [], supportedActions: ["update", "complete"] },
  completed: { allowedStatusTransitions: [], supportedActions: [] },
  billed: { allowedStatusTransitions: [], supportedActions: [] },
  paid: { allowedStatusTransitions: [], supportedActions: [] },
  cancelled: { allowedStatusTransitions: [], supportedActions: [] },
  canceled: { allowedStatusTransitions: [], supportedActions: [] },
  "no-show": { allowedStatusTransitions: [], supportedActions: [] },
  deleted: { allowedStatusTransitions: [], supportedActions: [] }
});

function text(value) {
  return String(value || "").trim();
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ownerBranchRows(access = {}) {
  if (text(access.role).toLowerCase() !== "owner") throw forbidden("Owner role is required");
  const owner = db.prepare(`
    SELECT role, status, branchIds FROM tenant_users
    WHERE tenantId = @tenantId AND id = @userId
  `).get({ tenantId: access.tenantId, userId: access.userId });
  if (!owner || owner.status !== "active" || text(owner.role).toLowerCase() !== "owner") throw forbidden("Active OwnerUser access is required");
  const assigned = [...new Set(parseJsonArray(owner.branchIds).map(text).filter(Boolean))];
  if (!access.tenantId || !assigned.length) throw forbidden("This owner session has no assigned branch access");
  const params = { tenantId: access.tenantId };
  const names = assigned.map((branchId, index) => {
    params[`branch${index}`] = branchId;
    return `@branch${index}`;
  });
  return db.prepare(`
    SELECT id, name, city, timezone, status
    FROM branches
    WHERE tenantId = @tenantId AND id IN (${names.join(", ")})
    ORDER BY name, id
  `).all(params);
}

function selectedBranches(access, requested = "all") {
  const rows = ownerBranchRows(access);
  const id = text(requested || "all");
  if (id.toLowerCase() === "all") return rows;
  const branch = rows.find((row) => row.id === id);
  if (!branch) throw forbidden("The requested branch is not accessible to this owner session");
  return [branch];
}

function assertBranch(access, branchId) {
  const branch = selectedBranches(access, branchId)[0];
  if (!branch) throw forbidden("The requested branch is not accessible to this owner session");
  return branch;
}

function appointmentServiceIds(candidate = {}, tenantId) {
  const hasServiceIds = Object.prototype.hasOwnProperty.call(candidate, "serviceIds");
  const hasServiceId = Object.prototype.hasOwnProperty.call(candidate, "serviceId");
  if (!hasServiceIds && !hasServiceId) return [];
  const raw = hasServiceIds ? candidate.serviceIds : [candidate.serviceId];
  let parsed;
  if (Array.isArray(raw)) parsed = raw;
  else if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { throw new AppError("serviceIds must be a valid array", 422, { field: "serviceIds" }); }
    if (!Array.isArray(parsed)) throw new AppError("serviceIds must be an array", 422, { field: "serviceIds" });
  } else throw new AppError("serviceIds must be an array", 422, { field: "serviceIds" });
  if (parsed.some((serviceId) => typeof serviceId !== "string" || !serviceId.trim())) throw new AppError("serviceIds must contain non-empty service IDs", 422, { field: "serviceIds" });
  const requested = [...new Set(parsed.map(text))];
  if (!requested.length) return [];
  return [...new Set(serviceRulesService.resolveServiceChain(tenantId, requested).map((item) => text(item.serviceId)).filter(Boolean))];
}

function normalizeServicePayload(payload = {}) {
  const hasServiceIds = Object.prototype.hasOwnProperty.call(payload, "serviceIds");
  const hasServiceId = Object.prototype.hasOwnProperty.call(payload, "serviceId");
  if (!hasServiceIds && !hasServiceId) return { ...payload };
  const raw = hasServiceIds ? payload.serviceIds : [payload.serviceId];
  if (!Array.isArray(raw) || raw.some((serviceId) => typeof serviceId !== "string" || !serviceId.trim())) {
    throw new AppError("serviceIds must be an array of non-empty service IDs", 422, { field: "serviceIds" });
  }
  const normalized = { ...payload, serviceIds: [...new Set(raw.map(text))] };
  delete normalized.serviceId;
  return normalized;
}

function assertAppointmentReferences(candidate = {}, access) {
  const branchId = text(candidate.branchId);
  if (!branchId || branchId.toLowerCase() === "all") throw badRequest("A specific appointment branch is required");
  assertBranch(access, branchId);

  const clientId = text(candidate.clientId);
  if (clientId) {
    const client = db.prepare(`
      SELECT id FROM clients
      WHERE tenantId = @tenantId AND id = @clientId AND branchId = @branchId
        AND (deletedAt IS NULL OR deletedAt = '')
    `).get({ tenantId: access.tenantId, clientId, branchId });
    if (!client) throw new AppError("Selected client is not available for the appointment branch", 422, { field: "clientId" });
  }

  const staffId = text(candidate.staffId);
  if (staffId) {
    const staff = db.prepare(`
      SELECT id FROM staff
      WHERE tenantId = @tenantId AND id = @staffId AND branchId = @branchId
        AND COALESCE(status, 'active') = 'active'
    `).get({ tenantId: access.tenantId, staffId, branchId });
    if (!staff) throw new AppError("Selected staff member is not active for the appointment branch", 422, { field: "staffId" });
  }

  const serviceIds = appointmentServiceIds(candidate, access.tenantId);
  if (serviceIds.length) {
    const params = { tenantId: access.tenantId };
    const names = serviceIds.map((serviceId, index) => {
      params[`service${index}`] = serviceId;
      return `@service${index}`;
    });
    const rows = db.prepare(`
      SELECT id FROM services
      WHERE tenantId = @tenantId AND id IN (${names.join(", ")})
        AND COALESCE(status, 'active') = 'active'
    `).all(params);
    if (rows.length !== serviceIds.length) throw new AppError("One or more services are not active for this tenant", 422, { field: "serviceIds" });
  }
}

function appointmentRow(id, access) {
  const appointment = db.prepare(`
    SELECT * FROM appointments
    WHERE tenantId = @tenantId AND id = @id
  `).get({ tenantId: access.tenantId, id: text(id) });
  if (!appointment) throw notFound("Appointment not found");
  assertBranch(access, appointment.branchId);
  return appointment;
}

function date(value, field) {
  const result = text(value);
  const [year, month, day] = result.split("-").map(Number);
  const roundTrip = DATE_PATTERN.test(result) && Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
    ? new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
    : "";
  if (roundTrip !== result) {
    throw badRequest(`${field} must be a valid YYYY-MM-DD date`);
  }
  return result;
}

function positiveInteger(value, fallback, max) {
  const result = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(result) || result < 0) return fallback;
  return Math.min(result, max);
}

function paise(value) {
  return Math.round(Number(value || 0) * 100);
}

function invoiceForAppointment(appointmentId, tenantId) {
  return db.prepare(`
    SELECT id, invoice_no AS invoiceNumber, status, payment_status AS paymentStatus,
           grand_total AS grandTotal, paid_amount AS paidAmount, due_amount AS dueAmount, created_at AS createdAt
    FROM invoices
    WHERE tenant_id = @tenantId AND appointment_id = @appointmentId
    ORDER BY created_at DESC LIMIT 1
  `).get({ tenantId, appointmentId }) || null;
}

function billingStatus(appointment, access) {
  const invoice = invoiceForAppointment(appointment.id, access.tenantId);
  const status = text(appointment.status).toLowerCase();
  const eligible = status === "completed" && !invoice;
  return {
    eligible,
    reason: eligible ? null : invoice ? "Appointment already has an invoice" : "Appointment must be completed before billing",
    invoice: invoice ? {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      paymentStatus: invoice.paymentStatus,
      grandTotalPaise: paise(invoice.grandTotal),
      paidAmountPaise: paise(invoice.paidAmount),
      dueAmountPaise: paise(invoice.dueAmount),
      createdAt: invoice.createdAt
    } : null
  };
}

function capabilitiesFor(appointment, billing) {
  const status = text(appointment.status).toLowerCase();
  const configured = OWNER_TRANSITIONS[status] || { allowedStatusTransitions: [], supportedActions: [] };
  const actions = [...configured.supportedActions];
  if (billing.eligible) actions.push("openPos");
  return {
    allowedStatusTransitions: [...configured.allowedStatusTransitions],
    supportedActions: [...new Set(actions)]
  };
}

function assertSupportedAction(id, access, action) {
  const appointment = appointmentRow(id, access);
  const billing = billingStatus(appointment, access);
  const capabilities = capabilitiesFor(appointment, billing);
  if (!capabilities.supportedActions.includes(action)) {
    throw conflict(`Action ${action} is not supported for an appointment with status ${appointment.status}`, {
      appointmentId: appointment.id,
      currentStatus: appointment.status,
      supportedActions: capabilities.supportedActions,
      allowedStatusTransitions: capabilities.allowedStatusTransitions
    });
  }
  return { appointment, billing, ...capabilities };
}

function appointmentDto(row) {
  const { touchupCost, ...appointment } = row;
  return {
    ...appointment,
    serviceIds: parseJsonArray(row.serviceIds),
    version: Number(row.version || 1),
    ...(touchupCost !== undefined ? { touchupCostPaise: paise(touchupCost) } : {})
  };
}

function displayContext(appointment, access) {
  const client = appointment.clientId ? db.prepare(`SELECT id, name, phone, email FROM clients WHERE tenantId = @tenantId AND id = @id`).get({ tenantId: access.tenantId, id: appointment.clientId }) : null;
  const staff = appointment.staffId ? db.prepare(`SELECT id, name, role, branchId, status FROM staff WHERE tenantId = @tenantId AND id = @id`).get({ tenantId: access.tenantId, id: appointment.staffId }) : null;
  const branch = db.prepare(`SELECT id, name, city, timezone, status FROM branches WHERE tenantId = @tenantId AND id = @id`).get({ tenantId: access.tenantId, id: appointment.branchId }) || null;
  const serviceIds = parseJsonArray(appointment.serviceIds).map(text).filter(Boolean);
  const services = serviceIds.map((id) => db.prepare(`SELECT id, name, category, price, durationMinutes, status FROM services WHERE tenantId = @tenantId AND id = @id`).get({ tenantId: access.tenantId, id })).filter(Boolean).map(({ price, ...service }) => ({ ...service, pricePaise: paise(price) }));
  return { client, staff, branch, services };
}

function activityDto(row) {
  return {
    id: row.id,
    action: row.action,
    actionGroup: row.actionGroup,
    statusBefore: row.statusBefore,
    statusAfter: row.statusAfter,
    changedBy: row.changedBy,
    changedByRole: row.changedByRole,
    source: row.source,
    reason: row.reason,
    createdAt: row.createdAt,
    version: row.version
  };
}

function detail(id, access) {
  const appointment = appointmentRow(id, access);
  const billing = billingStatus(appointment, access);
  const capabilities = capabilitiesFor(appointment, billing);
  return {
    appointment: appointmentDto(appointment),
    context: displayContext(appointment, access),
    billing,
    supportedActions: capabilities.supportedActions,
    allowedStatusTransitions: capabilities.allowedStatusTransitions,
    version: Number(appointment.version || 1),
    activityHistory: appointmentActivityService.appointmentTimeline(appointment.id, access).map(activityDto),
    metadata: { timezone: "Asia/Kolkata", moneyUnit: "paise", activitySource: "appointment_activity_log" }
  };
}

function list(access, query = {}) {
  const supported = new Set(["branchId", "from", "to", "search", "q", "staffId", "serviceId", "clientId", "status", "source", "paymentStatus", "limit", "offset"]);
  const unsupported = Object.keys(query).filter((key) => !supported.has(key));
  if (unsupported.length) throw badRequest(`Unsupported appointment filter(s): ${unsupported.join(", ")}`);
  const nonScalar = Object.entries(query).filter(([, value]) => value !== undefined && typeof value !== "string").map(([key]) => key);
  if (nonScalar.length) throw badRequest(`Appointment filter(s) must be scalar values: ${nonScalar.join(", ")}`);
  const branches = selectedBranches(access, query.branchId || "all");
  const from = date(query.from, "from");
  const to = date(query.to, "to");
  if (from > to) throw badRequest("from must be on or before to");
  const where = [
    "a.tenantId = @tenantId",
    `CASE WHEN a.startAt GLOB '*Z' OR a.startAt GLOB '*[+-][0-9][0-9]:[0-9][0-9]' THEN date(a.startAt, '+5 hours', '+30 minutes') ELSE substr(a.startAt, 1, 10) END BETWEEN @from AND @to`
  ];
  const params = {
    tenantId: access.tenantId,
    from,
    to
  };
  const limit = Math.max(1, positiveInteger(query.limit, 50, 200));
  const offset = positiveInteger(query.offset, 0, 100000);
  const branchNames = branches.map((branch, index) => {
    params[`branch${index}`] = branch.id;
    return `@branch${index}`;
  });
  where.push(`a.branchId IN (${branchNames.join(", ")})`);
  for (const [queryKey, column] of [["staffId", "a.staffId"], ["clientId", "a.clientId"], ["status", "a.status"]]) {
    if (text(query[queryKey])) {
      where.push(`${column} = @${queryKey}`);
      params[queryKey] = text(query[queryKey]);
    }
  }
  if (text(query.serviceId)) {
    where.push("EXISTS (SELECT 1 FROM json_each(COALESCE(a.serviceIds, '[]')) WHERE json_each.value = @serviceId)");
    params.serviceId = text(query.serviceId);
  }
  if (text(query.source)) {
    where.push("COALESCE(NULLIF(a.sourceChannel, ''), a.source, '') = @source");
    params.source = text(query.source);
  }
  if (text(query.paymentStatus)) {
    where.push("(SELECT i.payment_status FROM invoices i WHERE i.tenant_id = a.tenantId AND i.appointment_id = a.id ORDER BY i.created_at DESC LIMIT 1) = @paymentStatus");
    params.paymentStatus = text(query.paymentStatus);
  }
  const search = text(query.search || query.q);
  if (search) {
    where.push("(a.id LIKE @search OR c.name LIKE @search OR c.phone LIKE @search OR s.name LIKE @search OR b.name LIKE @search OR a.notes LIKE @search)");
    params.search = `%${search}%`;
  }
  const baseSql = `
    FROM appointments a
    LEFT JOIN clients c ON c.tenantId = a.tenantId AND c.id = a.clientId
    LEFT JOIN staff s ON s.tenantId = a.tenantId AND s.id = a.staffId
    LEFT JOIN branches b ON b.tenantId = a.tenantId AND b.id = a.branchId
    WHERE ${where.join(" AND ")}`;
  const total = db.prepare(`SELECT COUNT(*) AS count ${baseSql}`).get(params).count;
  const rows = db.prepare(`
    SELECT a.*, c.name AS clientName, c.phone AS clientPhone, s.name AS staffName, b.name AS branchName,
      (SELECT i.payment_status FROM invoices i WHERE i.tenant_id = a.tenantId AND i.appointment_id = a.id ORDER BY i.created_at DESC LIMIT 1) AS paymentStatus
    ${baseSql}
    ORDER BY a.startAt ASC, a.id ASC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset }).map((row) => ({ ...appointmentDto(row), clientName: row.clientName, clientPhone: row.clientPhone, staffName: row.staffName, branchName: row.branchName, paymentStatus: row.paymentStatus || null }));
  return {
    items: rows,
    page: { limit, offset, total, hasMore: offset + rows.length < total, nextOffset: offset + rows.length < total ? offset + rows.length : null },
    metadata: {
      timezone: "Asia/Kolkata",
      moneyUnit: "paise",
      branchIds: branches.map((branch) => branch.id),
      filters: { from, to, branchId: query.branchId || "all", search: search || null, staffId: query.staffId || null, serviceId: query.serviceId || null, clientId: query.clientId || null, status: query.status || null, source: query.source || null, paymentStatus: query.paymentStatus || null },
      supportedFilters: ["branchId", "from", "to", "search", "staffId", "serviceId", "clientId", "status", "source", "paymentStatus", "limit", "offset"]
    }
  };
}

function options(access, resource, query = {}) {
  const branches = selectedBranches(access, query.branchId || "all");
  if (resource === "branches") return branches;
  const config = {
    clients: { table: "clients", columns: "id, name, phone, email, branchId", status: "(deletedAt IS NULL OR deletedAt = '')" },
    staff: { table: "staff", columns: "id, name, role, branchId, status", status: "COALESCE(status, 'active') = 'active'" },
    services: { table: "services", columns: "id, name, category, price, durationMinutes, status", status: "COALESCE(status, 'active') = 'active'" }
  }[resource];
  if (!config) throw badRequest("options resource must be branches, clients, staff, or services");
  const params = { tenantId: access.tenantId, limit: positiveInteger(query.limit, 100, 500) };
  const names = branches.map((branch, index) => {
    params[`branch${index}`] = branch.id;
    return `@branch${index}`;
  });
  const branchClause = resource === "services" ? "1 = 1" : `branchId IN (${names.join(", ")})`;
  const search = text(query.search || query.q);
  if (search) params.search = `%${search}%`;
  const rows = db.prepare(`
    SELECT ${config.columns} FROM ${config.table}
    WHERE tenantId = @tenantId AND ${branchClause} AND ${config.status}
      ${search ? "AND (name LIKE @search OR id LIKE @search)" : ""}
    ORDER BY name, id LIMIT @limit
  `).all(params);
  return rows.map((row) => resource === "services" ? (({ price, ...rest }) => ({ ...rest, pricePaise: paise(price) }))(row) : row);
}

function mutateExisting(id, access, operation) {
  appointmentRow(id, access);
  const result = operation();
  const changed = result?.appointment || result;
  if (changed?.branchId) assertBranch(access, changed.branchId);
  return {
    appointment: changed ? appointmentDto(changed) : null,
    ...(Array.isArray(result?.appointments) ? { appointments: result.appointments.map(appointmentDto) } : {}),
    ...(result?.bookingGroupId !== undefined ? { bookingGroupId: result.bookingGroupId } : {}),
    ...(result?.appliedToGroup !== undefined ? { appliedToGroup: result.appliedToGroup } : {})
  };
}

export const ownerAppointmentService = {
  list,
  detail,
  options,
  assertAccessibleAppointment: appointmentRow,
  assertSupportedAction,
  billingStatus,
  create(payload, access, req) {
    const normalizedPayload = normalizeServicePayload(payload);
    const initialStatus = text(normalizedPayload.status || "booked").toLowerCase();
    if (!SAFE_INITIAL_STATUSES.has(initialStatus)) {
      throw new AppError("New Owner appointments may start only as draft, booked, or confirmed", 422, { requestedStatus: initialStatus });
    }
    assertAppointmentReferences(normalizedPayload, access);
    return detail(resourceService.create("appointments", { ...normalizedPayload, status: initialStatus }, access, { req }).id, access);
  },
  update(id, payload, access, req, ifMatch) {
    const { appointment } = assertSupportedAction(id, access, "update");
    const normalizedPayload = normalizeServicePayload(payload);
    if (!ifMatch) throw new AppError("If-Match header or version body field is required for appointment updates", 428);
    if (Object.prototype.hasOwnProperty.call(normalizedPayload, "status") && text(normalizedPayload.status).toLowerCase() !== text(appointment.status).toLowerCase()) {
      throw conflict("Appointment status cannot be changed through update; use a lifecycle action", {
        currentStatus: appointment.status,
        requestedStatus: normalizedPayload.status
      });
    }
    assertAppointmentReferences({ ...appointment, ...normalizedPayload }, access);
    const updated = resourceService.update("appointments", id, normalizedPayload, access, { req, ifMatch });
    return detail(updated.id, access);
  },
  cancel(id, payload, access) {
    const { appointment } = assertSupportedAction(id, access, "cancel");
    if (!text(payload?.reason)) throw badRequest("Cancellation reason is required");
    const beforeById = new Map(db.prepare(`
      SELECT * FROM appointments
      WHERE tenantId = @tenantId AND branchId = @branchId
    `).all({ tenantId: access.tenantId, branchId: appointment.branchId }).map((row) => [row.id, row]));
    const cancelWithBoundary = db.transaction(() => {
      const result = appointmentLifecycleService.cancel(id, payload, access);
      for (const changed of result.appointments || [result.appointment]) {
        const before = beforeById.get(changed?.id);
        const capabilities = before ? capabilitiesFor(before, billingStatus(before, access)) : null;
        if (!capabilities?.supportedActions.includes("cancel")) {
          throw conflict("A grouped appointment cannot be cancelled from its current status", {
            appointmentId: changed?.id || "",
            currentStatus: before?.status || "unknown"
          });
        }
      }
      return result;
    });
    return mutateExisting(id, access, cancelWithBoundary);
  },
  reschedule(id, payload, access, req) {
    const { appointment } = assertSupportedAction(id, access, "reschedule");
    const normalizedPayload = normalizeServicePayload(payload);
    assertAppointmentReferences({
      ...appointment,
      ...normalizedPayload,
      branchId: normalizedPayload.branchId || normalizedPayload.slot?.branchId || appointment.branchId,
      staffId: normalizedPayload.staffId || normalizedPayload.slot?.staffId || appointment.staffId
    }, access);
    return mutateExisting(id, access, () => appointmentLifecycleService.reschedule(id, payload, access, req));
  },
  setStatus(id, payload, access) {
    if (payload?.applyGroup || payload?.applyBookingGroup || payload?.scope === "bookingGroup") {
      throw new AppError("Owner generic status transitions support one appointment at a time", 422);
    }
    const capabilities = assertSupportedAction(id, access, "setStatus");
    const nextStatus = text(payload?.status).toLowerCase();
    if (!capabilities.allowedStatusTransitions.includes(nextStatus)) {
      throw conflict(`Status ${nextStatus || "(missing)"} is not allowed from ${capabilities.appointment.status}`, {
        currentStatus: capabilities.appointment.status,
        requestedStatus: nextStatus,
        allowedStatusTransitions: capabilities.allowedStatusTransitions
      });
    }
    return mutateExisting(id, access, () => appointmentLifecycleService.setStatus(id, { ...payload, status: nextStatus }, access));
  },
  checkIn(id, access) {
    assertSupportedAction(id, access, "checkIn");
    return mutateExisting(id, access, () => appointmentLifecycleService.checkIn(id, access));
  },
  startService(id, access) {
    assertSupportedAction(id, access, "startService");
    return mutateExisting(id, access, () => appointmentLifecycleService.startService(id, access));
  },
  complete(id, payload, access) {
    assertSupportedAction(id, access, "complete");
    return mutateExisting(id, access, () => appointmentLifecycleService.complete(id, payload, access));
  },
  noShow(id, payload, access) {
    assertSupportedAction(id, access, "noShow");
    return mutateExisting(id, access, () => appointmentLifecycleService.noShow(id, payload, access));
  }
};
