import { db } from "../db.js";
import { badRequest } from "../utils/app-error.js";
import { enterpriseSchedulerService } from "./enterprise-scheduler.service.js";
import { razorpayBookingService } from "./razorpay-booking.service.js";
import { tenantService } from "./tenant.service.js";

const THRESHOLD_AMOUNT = 2000;
const DEPOSIT_PERCENT = 20;

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function parseJson(value, fallback = []) {
  try {
    return typeof value === "string" ? JSON.parse(value || "null") ?? fallback : value ?? fallback;
  } catch {
    return fallback;
  }
}

function serviceRows(tenantId, lines = []) {
  const ids = [...new Set(lines.map((line) => line.serviceId).filter(Boolean))];
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`SELECT id, name, price FROM services WHERE tenantId = ? AND id IN (${placeholders})`).all(tenantId, ...ids);
}

function bookingLines(payload = {}) {
  const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
  return rawLines.map((line) => ({
    ...line,
    staffId: line.staffId || payload.staffId || "",
    startAt: line.startAt || payload.startAt || payload.date || ""
  }));
}

function serviceTotal(services = [], lines = []) {
  const byId = new Map(services.map((service) => [service.id, service]));
  return money(lines.reduce((sum, line) => sum + Number(byId.get(line.serviceId)?.price || 0), 0));
}

function clientDetails(tenantId, clientId = "") {
  if (!clientId) return {};
  const client = db.prepare("SELECT name, phone, email FROM clients WHERE tenantId = ? AND id = ?").get(tenantId, clientId);
  return {
    name: client?.name || "",
    phone: client?.phone || "",
    email: client?.email || ""
  };
}

function rowToReport(row = {}) {
  const serviceIds = parseJson(row.serviceIds, []);
  return {
    paymentLinkId: row.paymentLinkId,
    appointmentId: row.appointmentId,
    tenantId: row.tenantId,
    branchId: row.branchId || "",
    clientId: row.clientId || "",
    clientName: row.clientName || "",
    clientPhone: row.clientPhone || "",
    staffId: row.staffId || "",
    serviceIds,
    serviceNames: row.serviceNames || serviceIds.join(", "),
    appointmentStatus: row.appointmentStatus || "",
    depositStatus: row.depositStatus || row.linkStatus || "",
    amount: money(row.amount),
    currency: row.currency || "INR",
    paymentLink: row.paymentLink || "",
    provider: row.provider || "",
    providerPaymentId: row.providerPaymentId || "",
    createdAt: row.createdAt || "",
    paidAt: row.paidAt || "",
    appointmentStartAt: row.appointmentStartAt || "",
    expiresAt: row.expiresAt || ""
  };
}

function serviceNameMap(tenantId, rows = []) {
  const ids = [...new Set(rows.flatMap((row) => row.serviceIds).filter(Boolean))];
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  return new Map(db.prepare(`SELECT id, name FROM services WHERE tenantId = ? AND id IN (${placeholders})`).all(tenantId, ...ids).map((service) => [service.id, service.name]));
}

export const appointmentDepositGateService = {
  quote(payload = {}, access = {}) {
    const tenantId = access.tenantId;
    if (!tenantId) throw badRequest("tenantId is required");
    const branchId = payload.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const lines = bookingLines(payload);
    const services = serviceRows(tenantId, lines);
    const totalAmount = serviceTotal(services, lines);
    const depositAmount = totalAmount >= THRESHOLD_AMOUNT ? money((totalAmount * DEPOSIT_PERCENT) / 100) : 0;
    return {
      required: depositAmount > 0,
      thresholdAmount: THRESHOLD_AMOUNT,
      percent: DEPOSIT_PERCENT,
      totalAmount,
      depositAmount,
      reason: depositAmount > 0 ? "high_value_service_deposit" : "below_threshold",
      services: services.map((service) => ({ id: service.id, name: service.name, price: money(service.price) }))
    };
  },

  createBooking(payload = {}, access = {}, req = null) {
    const quote = this.quote(payload, access);
    if (!quote.required) {
      return {
        ...enterpriseSchedulerService.createMultiServiceBooking(payload, access, req),
        deposit: quote
      };
    }

    const gatedPayload = {
      ...payload,
      lines: bookingLines(payload),
      status: "payment_pending",
      notifyTargets: []
    };
    const result = enterpriseSchedulerService.createMultiServiceBooking(gatedPayload, access, req);
    const firstAppointment = result.appointments?.[0];
    if (!firstAppointment?.id) throw badRequest("Unable to create pending appointment for deposit");

    const link = razorpayBookingService.createPaymentLink({
      tenantId: access.tenantId,
      appointmentId: firstAppointment.id,
      amount: quote.depositAmount,
      currency: "INR",
      customerDetails: clientDetails(access.tenantId, payload.clientId),
      notes: {
        reason: quote.reason,
        totalAmount: quote.totalAmount,
        depositPercent: DEPOSIT_PERCENT,
        bookingGroupId: result.bookingGroupId || "",
        createdBy: access.userId || ""
      },
      expiresInMinutes: payload.depositExpiresInMinutes || 60
    });

    return {
      ...result,
      deposit: {
        ...quote,
        status: "pending",
        appointmentId: firstAppointment.id,
        paymentLinkId: link.linkId,
        paymentLink: link.shortUrl,
        expiresAt: link.expiresAt
      }
    };
  },

  report(query = {}, access = {}) {
    const tenantId = access.tenantId;
    if (!tenantId) throw badRequest("tenantId is required");
    const branchId = query.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const params = { tenantId, branchId, from: query.from || "", to: query.to || "" };
    const where = ["l.tenantId = @tenantId"];
    if (branchId) where.push("a.branchId = @branchId");
    if (params.from) where.push("date(COALESCE(a.startAt, l.createdAt)) >= date(@from)");
    if (params.to) where.push("date(COALESCE(a.startAt, l.createdAt)) <= date(@to)");
    const rows = db.prepare(`
      SELECT
        l.id AS paymentLinkId,
        l.tenantId,
        l.appointmentId,
        l.provider,
        l.providerPaymentId,
        l.paymentLink,
        l.amount,
        l.currency,
        l.status AS linkStatus,
        l.createdAt,
        l.webhookReceivedAt AS paidAt,
        l.expiresAt,
        a.branchId,
        a.clientId,
        a.staffId,
        a.serviceIds,
        a.status AS appointmentStatus,
        a.depositStatus,
        a.startAt AS appointmentStartAt,
        c.name AS clientName,
        c.phone AS clientPhone
      FROM booking_payment_links l
      LEFT JOIN appointments a ON a.id = l.appointmentId AND a.tenantId = l.tenantId
      LEFT JOIN clients c ON c.id = a.clientId AND c.tenantId = l.tenantId
      WHERE ${where.join(" AND ")}
      ORDER BY datetime(l.createdAt) DESC
      LIMIT 500
    `).all(params).map(rowToReport);
    const names = serviceNameMap(tenantId, rows);
    for (const row of rows) {
      row.serviceNames = row.serviceIds.map((id) => names.get(id) || id).join(", ");
    }
    const stats = rows.reduce((acc, row) => {
      acc.totalAmount += row.amount;
      if (row.depositStatus === "paid" || row.depositStatus === "refunded" || row.providerPaymentId) acc.paidAmount += row.amount;
      if (row.depositStatus === "forfeited") acc.forfeitedAmount += row.amount;
      if (row.depositStatus === "pending" || row.appointmentStatus === "payment_pending") acc.pendingAmount += row.amount;
      return acc;
    }, { count: rows.length, totalAmount: 0, paidAmount: 0, pendingAmount: 0, forfeitedAmount: 0 });
    return { stats, rows };
  }
};
