import { db } from "../db.js";
import { badRequest } from "../utils/app-error.js";
import { ensureAppointmentDepositFollowupSchema } from "./appointment-deposit-followup-schema.service.js";
import { enterpriseSchedulerService } from "./enterprise-scheduler.service.js";
import { razorpayBookingService } from "./razorpay-booking.service.js";
import { tenantService } from "./tenant.service.js";

const THRESHOLD_AMOUNT = 2000;
const DEPOSIT_PERCENT = 20;
const BOOKING_STATUSES = new Set([
  "payment_pending",
  "booked",
  "confirmed",
  "arrived",
  "waiting",
  "in-service",
  "completed",
  "cancelled",
  "no-show"
]);

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

function bookingStatus(value, fallback = "booked") {
  const normalized = String(value || "").trim().toLowerCase();
  return BOOKING_STATUSES.has(normalized) ? normalized : fallback;
}

function paymentMode(payment = {}) {
  return String(payment.payment_mode || payment.mode || payment.paymentMode || "").toLowerCase();
}

function bookingAdvanceAdjustedAmount(payments = []) {
  return money(payments
    .filter((payment) => paymentMode(payment) === "booking_advance")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
}

function counterPaymentCollectedAmount(invoice = {}, payments = []) {
  const paid = Number(invoice.paid || invoice.paid_amount || invoice.paidAmount || 0);
  return money(Math.max(0, paid - bookingAdvanceAdjustedAmount(payments)));
}

function counterPaymentDueAmount(invoice = {}) {
  return money(Math.max(0, Number(invoice.balance || invoice.due || invoice.due_amount || invoice.dueAmount || 0)));
}

function invoiceSettlementMap(tenantId, appointmentIds = []) {
  const ids = [...new Set(appointmentIds.filter(Boolean))];
  if (!tenantId || !ids.length) return new Map();
  try {
    const placeholders = ids.map(() => "?").join(",");
    const invoices = db.prepare(
      `SELECT * FROM invoices WHERE tenant_id = ? AND appointment_id IN (${placeholders}) ORDER BY id DESC`
    ).all(tenantId, ...ids);
    if (!invoices.length) return new Map();

    const invoiceByAppointment = new Map();
    for (const invoice of invoices) {
      const appointmentId = String(invoice.appointment_id || invoice.appointmentId || "");
      if (appointmentId && !invoiceByAppointment.has(appointmentId)) {
        invoiceByAppointment.set(appointmentId, invoice);
      }
    }

    const invoiceIds = [...new Set(Array.from(invoiceByAppointment.values()).map((invoice) => String(invoice.id || "")).filter(Boolean))];
    const paymentsByInvoice = new Map();
    if (invoiceIds.length) {
      const invoicePlaceholders = invoiceIds.map(() => "?").join(",");
      const payments = db.prepare(
        `SELECT * FROM invoice_payments WHERE tenant_id = ? AND invoice_id IN (${invoicePlaceholders}) AND status = 'paid' ORDER BY created_at, id`
      ).all(tenantId, ...invoiceIds);
      for (const payment of payments) {
        const invoiceId = String(payment.invoice_id || payment.invoiceId || "");
        if (!paymentsByInvoice.has(invoiceId)) paymentsByInvoice.set(invoiceId, []);
        paymentsByInvoice.get(invoiceId).push(payment);
      }
    }

    const settlements = new Map();
    for (const [appointmentId, invoice] of invoiceByAppointment.entries()) {
      const payments = paymentsByInvoice.get(String(invoice.id || "")) || [];
      settlements.set(appointmentId, {
        invoiceId: String(invoice.id || ""),
        advanceAdjusted: bookingAdvanceAdjustedAmount(payments),
        counterPaid: counterPaymentCollectedAmount(invoice, payments),
        counterDue: counterPaymentDueAmount(invoice)
      });
    }
    return settlements;
  } catch {
    return new Map();
  }
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
    advanceAdjusted: money(row.advanceAdjusted),
    counterPaid: money(row.counterPaid),
    counterDue: money(row.counterDue),
    currency: row.currency || "INR",
    paymentLink: row.paymentLink || "",
    provider: row.provider || "",
    providerPaymentId: row.providerPaymentId || "",
    invoiceId: row.invoiceId || "",
    followUpStatus: row.followUpStatus || "",
    followUpReminderChannel: row.followUpReminderChannel || "",
    followUpReminderSentAt: row.followUpReminderSentAt || "",
    followUpDoneAt: row.followUpDoneAt || "",
    followUpNote: row.followUpNote || "",
    followUpUpdatedAt: row.followUpUpdatedAt || "",
    createdAt: row.createdAt || "",
    paidAt: row.paidAt || "",
    appointmentStartAt: row.appointmentStartAt || "",
    expiresAt: row.expiresAt || ""
  };
}

function followUpMap(tenantId, paymentLinkIds = []) {
  ensureAppointmentDepositFollowupSchema();
  const ids = [...new Set(paymentLinkIds.filter(Boolean))];
  if (!tenantId || !ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT * FROM appointment_deposit_followups WHERE tenantId = ? AND paymentLinkId IN (${placeholders})`).all(tenantId, ...ids);
  return new Map(rows.map((row) => [String(row.paymentLinkId || ""), row]));
}

function normalizeFollowUpStatus(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "done") return "done";
  if (normalized === "reminder_sent") return "reminder_sent";
  return "pending";
}

function serviceNameMap(tenantId, rows = []) {
  const ids = [...new Set(rows.flatMap((row) => row.serviceIds).filter(Boolean))];
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  return new Map(db.prepare(`SELECT id, name FROM services WHERE tenantId = ? AND id IN (${placeholders})`).all(tenantId, ...ids).map((service) => [service.id, service.name]));
}

function holdCreatedAppointmentsForDeposit(result = {}, tenantId = "") {
  const appointmentIds = (result.appointments || []).map((appointment) => appointment.id).filter(Boolean);
  if (!tenantId || !appointmentIds.length) return result;
  const placeholders = appointmentIds.map(() => "?").join(",");
  const updatedAt = new Date().toISOString();
  db.prepare(
    `UPDATE appointments
        SET status = 'payment_pending',
            depositStatus = 'pending',
            updatedAt = ?
      WHERE tenantId = ?
        AND id IN (${placeholders})
        AND COALESCE(depositStatus, '') != 'paid'`
  ).run(updatedAt, tenantId, ...appointmentIds);
  const rows = db.prepare(`SELECT * FROM appointments WHERE tenantId = ? AND id IN (${placeholders})`).all(tenantId, ...appointmentIds);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    ...result,
    appointments: result.appointments.map((appointment) => byId.get(appointment.id) || appointment)
  };
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
    const preparedPayload = {
      ...payload,
      lines: bookingLines(payload),
      status: bookingStatus(payload.status)
    };
    if (!quote.required) {
      return {
        ...enterpriseSchedulerService.createMultiServiceBooking(preparedPayload, access, req),
        deposit: quote
      };
    }

    const gatedPayload = {
      ...preparedPayload,
      status: "payment_pending",
      notifyTargets: []
    };
    const result = enterpriseSchedulerService.createMultiServiceBooking(gatedPayload, access, req);
    const pendingResult = holdCreatedAppointmentsForDeposit(result, access.tenantId);
    const firstAppointment = pendingResult.appointments?.[0];
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
      ...pendingResult,
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
    const settlements = invoiceSettlementMap(tenantId, rows.map((row) => row.appointmentId));
    const followUps = followUpMap(tenantId, rows.map((row) => row.paymentLinkId));
    for (const row of rows) {
      row.serviceNames = row.serviceIds.map((id) => names.get(id) || id).join(", ");
      const settlement = settlements.get(row.appointmentId) || {};
      const followUp = followUps.get(String(row.paymentLinkId || "")) || {};
      row.invoiceId = settlement.invoiceId || "";
      row.advanceAdjusted = money(settlement.advanceAdjusted || 0);
      row.counterPaid = money(settlement.counterPaid || 0);
      row.counterDue = money(settlement.counterDue || 0);
      row.followUpStatus = followUp.status || "";
      row.followUpReminderChannel = followUp.reminderChannel || "";
      row.followUpReminderSentAt = followUp.reminderSentAt || "";
      row.followUpDoneAt = followUp.doneAt || "";
      row.followUpNote = followUp.note || "";
      row.followUpUpdatedAt = followUp.updatedAt || "";
    }
    const stats = rows.reduce((acc, row) => {
      acc.totalAmount += row.amount;
      if (row.depositStatus === "paid" || row.depositStatus === "refunded" || row.providerPaymentId) acc.paidAmount += row.amount;
      if (row.depositStatus === "forfeited") acc.forfeitedAmount += row.amount;
      if (row.depositStatus === "pending" || row.appointmentStatus === "payment_pending") acc.pendingAmount += row.amount;
      return acc;
    }, { count: rows.length, totalAmount: 0, paidAmount: 0, pendingAmount: 0, forfeitedAmount: 0 });
    return { stats, rows };
  },

  updateFollowUp(paymentLinkId, payload = {}, access = {}) {
    const tenantId = access.tenantId;
    if (!tenantId) throw badRequest("tenantId is required");
    if (!paymentLinkId) throw badRequest("paymentLinkId is required");
    ensureAppointmentDepositFollowupSchema();

    const paymentLink = db.prepare(`
      SELECT
        l.id AS paymentLinkId,
        l.tenantId,
        l.appointmentId,
        COALESCE(a.branchId, '') AS branchId
      FROM booking_payment_links l
      LEFT JOIN appointments a ON a.id = l.appointmentId AND a.tenantId = l.tenantId
      WHERE l.tenantId = ? AND l.id = ?
      LIMIT 1
    `).get(tenantId, paymentLinkId);
    if (!paymentLink) throw badRequest("Deposit payment link not found");
    if (paymentLink.branchId) tenantService.assertBranchAccess(access, paymentLink.branchId);

    const existing = db.prepare("SELECT * FROM appointment_deposit_followups WHERE tenantId = ? AND paymentLinkId = ?").get(tenantId, paymentLinkId);
    const now = new Date().toISOString();
    const status = normalizeFollowUpStatus(payload.status || existing?.status || "pending");
    const reminderSentAt = status === "reminder_sent"
      ? (payload.reminderSentAt || existing?.reminderSentAt || now)
      : String(payload.reminderSentAt ?? existing?.reminderSentAt ?? "");
    const doneAt = status === "done"
      ? (payload.doneAt || existing?.doneAt || now)
      : "";
    const note = String(payload.note ?? existing?.note ?? "");
    const reminderChannel = String(payload.reminderChannel ?? existing?.reminderChannel ?? "");
    const invoiceId = String(payload.invoiceId ?? existing?.invoiceId ?? "");
    const actorUserId = String(access.userId || payload.actorUserId || existing?.actorUserId || "");

    if (existing) {
      db.prepare(`
        UPDATE appointment_deposit_followups
        SET branchId = ?,
            appointmentId = ?,
            invoiceId = ?,
            status = ?,
            reminderChannel = ?,
            reminderSentAt = ?,
            doneAt = ?,
            note = ?,
            actorUserId = ?,
            updatedAt = ?
        WHERE tenantId = ? AND paymentLinkId = ?
      `).run(
        paymentLink.branchId || "",
        paymentLink.appointmentId || "",
        invoiceId,
        status,
        reminderChannel,
        reminderSentAt,
        doneAt,
        note,
        actorUserId,
        now,
        tenantId,
        paymentLinkId
      );
    } else {
      db.prepare(`
        INSERT INTO appointment_deposit_followups (
          paymentLinkId, tenantId, branchId, appointmentId, invoiceId, status,
          reminderChannel, reminderSentAt, doneAt, note, actorUserId, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentLinkId,
        tenantId,
        paymentLink.branchId || "",
        paymentLink.appointmentId || "",
        invoiceId,
        status,
        reminderChannel,
        reminderSentAt,
        doneAt,
        note,
        actorUserId,
        now,
        now
      );
    }

    return db.prepare("SELECT * FROM appointment_deposit_followups WHERE tenantId = ? AND paymentLinkId = ?").get(tenantId, paymentLinkId);
  }
};
