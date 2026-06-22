import { db } from "../db.js";
import { jobQueueService } from "./job-queue.service.js";
import { whatsappTemplateService } from "./whatsapp-template.service.js";

function dateParts(value = "") {
  if (!value) return { date: "", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  return {
    date: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  };
}

function clientFor(tenantId, clientId) {
  if (!tenantId || !clientId) return null;
  return db.prepare("SELECT * FROM clients WHERE id = ? AND tenantId = ?").get(clientId, tenantId) || null;
}

function branchFor(tenantId, branchId) {
  if (!tenantId || !branchId) return null;
  return db.prepare("SELECT * FROM branches WHERE id = ? AND tenantId = ?").get(branchId, tenantId) || null;
}

function appointmentFor(tenantId, appointmentId) {
  if (!tenantId || !appointmentId) return null;
  return db.prepare("SELECT * FROM appointments WHERE id = ? AND tenantId = ?").get(appointmentId, tenantId) || null;
}

function servicesFor(tenantId, serviceIds = []) {
  const ids = Array.isArray(serviceIds) ? serviceIds : parseJson(serviceIds, []);
  if (!tenantId || !ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM services WHERE tenantId = ? AND id IN (${placeholders})`).all(tenantId, ...ids);
}

function staffFor(tenantId, staffId) {
  if (!tenantId || !staffId) return null;
  return db.prepare("SELECT * FROM staff WHERE id = ? AND tenantId = ?").get(staffId, tenantId) || null;
}

function parseJson(value, fallback = {}) {
  try {
    return typeof value === "string" ? JSON.parse(value || "null") ?? fallback : value ?? fallback;
  } catch {
    return fallback;
  }
}

function makeVariables({ tenantId, appointment, client, branch, staff, services, extra = {} }) {
  const serviceName = services.map((service) => service.name).join(", ") || extra.service_name || extra.serviceName || "service";
  const when = dateParts(appointment?.startAt || extra.startAt || extra.dateTime || "");
  return {
    client_name: client?.name || extra.client_name || extra.clientName || "Guest",
    salon_name: extra.salon_name || extra.salonName || "Aura Salon",
    branch_name: branch?.name || extra.branch_name || extra.branchName || "our salon",
    booking_id: appointment?.id || extra.booking_id || extra.bookingId || "",
    service_name: serviceName,
    staff_name: staff?.name || extra.staff_name || extra.staffName || "our stylist",
    date: extra.date || when.date,
    time: extra.time || when.time,
    map_link: extra.map_link || extra.mapLink || "",
    tenant_id: tenantId,
    ...extra
  };
}

function recentMessageExists({ tenantId, clientId, templateName, refId, sinceIso }) {
  if (!clientId) return false;
  const rows = db.prepare(
    `SELECT id, metadata FROM whatsapp_messages
     WHERE tenantId = ?
       AND clientId = ?
       AND templateKey = ?
       AND createdAt >= ?
     LIMIT 25`
  ).all(tenantId, clientId, templateName, sinceIso);
  return rows.some((row) => {
    const metadata = parseJson(row.metadata, {});
    return !refId || metadata.refId === refId || metadata.appointmentId === refId || metadata.sessionId === refId;
  });
}

export const onlineBookingWhatsappService = {
  enqueueTemplate({
    tenantId,
    templateName,
    clientId = "",
    phone = "",
    branchId = "",
    language = "",
    variables = {},
    refId = "",
    critical = false,
    priority = 3
  }) {
    const client = clientFor(tenantId, clientId);
    const targetClient = client?.consolidateCommunications && client.primaryAccountId ? clientFor(tenantId, client.primaryAccountId) || client : client;
    if (!critical && targetClient?.preferredChannel === "no_communication") {
      return { queued: false, skipped: true, reason: "customer_opted_out" };
    }
    const resolvedLanguage = language || targetClient?.preferredLanguage || "en";
    const rendered = whatsappTemplateService.renderTemplate(templateName, resolvedLanguage, variables);
    const recipient = phone || targetClient?.phone || variables.phone || "";
    if (!recipient && !targetClient?.id) return { queued: false, skipped: true, reason: "missing_recipient" };
    if (recentMessageExists({
      tenantId,
      clientId: targetClient?.id || clientId,
      templateName,
      refId,
      sinceIso: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    })) {
      return { queued: false, skipped: true, reason: "rate_limited_duplicate" };
    }
    const job = jobQueueService.enqueue({
      tenantId,
      jobType: "whatsapp_send",
      priority,
      payload: {
        template: templateName,
        language: rendered.language,
        body: rendered.body,
        variables,
        phone: recipient,
        clientId: targetClient?.id || clientId,
        branchId: branchId || targetClient?.branchId || "",
        refId,
        missingVariables: rendered.missingVariables
      }
    });
    return { queued: true, jobId: job.id, body: rendered.body, missingVariables: rendered.missingVariables };
  },

  sendOtp(tenantId, mobile, otp, language = "en") {
    return this.enqueueTemplate({
      tenantId,
      templateName: "otp_send",
      phone: mobile,
      language,
      variables: { otp, client_name: "Guest", salon_name: "Aura Salon" },
      refId: `otp:${mobile}`,
      critical: true,
      priority: 1
    });
  },

  sendBookingConfirmation(tenantId, appointmentId) {
    const appointment = appointmentFor(tenantId, appointmentId);
    if (!appointment) return { queued: false, skipped: true, reason: "appointment_not_found" };
    const client = clientFor(tenantId, appointment.clientId);
    const branch = branchFor(tenantId, appointment.branchId);
    const staff = staffFor(tenantId, appointment.staffId);
    const services = servicesFor(tenantId, appointment.serviceIds);
    return this.enqueueTemplate({
      tenantId,
      templateName: "booking_confirmation",
      clientId: client?.id || "",
      branchId: appointment.branchId,
      variables: makeVariables({ tenantId, appointment, client, branch, staff, services }),
      refId: appointment.id,
      critical: true
    });
  },

  sendDepositLink(tenantId, appointmentId, paymentLink, expiresAt = "", depositAmount = "") {
    const appointment = appointmentFor(tenantId, appointmentId);
    if (!appointment) return { queued: false, skipped: true, reason: "appointment_not_found" };
    const client = clientFor(tenantId, appointment.clientId);
    const branch = branchFor(tenantId, appointment.branchId);
    const staff = staffFor(tenantId, appointment.staffId);
    const services = servicesFor(tenantId, appointment.serviceIds);
    return this.enqueueTemplate({
      tenantId,
      templateName: "deposit_link",
      clientId: client?.id || "",
      branchId: appointment.branchId,
      variables: makeVariables({
        tenantId,
        appointment,
        client,
        branch,
        staff,
        services,
        extra: {
          payment_link: paymentLink,
          deposit_amount: depositAmount || appointment.depositAmount || "",
          expires_at: expiresAt
        }
      }),
      refId: `deposit:${appointment.id}`,
      critical: true
    });
  },

  sendPaymentFailedRecovery(tenantId, sessionId, retryLink, variables = {}) {
    return this.enqueueTemplate({
      tenantId,
      templateName: "payment_failed_recovery",
      phone: variables.phone || "",
      clientId: variables.clientId || "",
      variables: { client_name: variables.clientName || "Guest", payment_link: retryLink, ...variables },
      refId: `payment_failed:${sessionId}`
    });
  },

  sendReminder24h(tenantId, appointmentId) {
    return this.enqueueTemplateForAppointment(tenantId, appointmentId, "reminder_24h");
  },

  sendReminder2h(tenantId, appointmentId) {
    return this.enqueueTemplateForAppointment(tenantId, appointmentId, "reminder_2h");
  },

  sendCancellationConfirmation(tenantId, appointmentId, refundInfo = {}) {
    return this.enqueueTemplateForAppointment(tenantId, appointmentId, refundInfo.refundStatus ? "cancellation_with_refund" : "cancellation_confirmation", refundInfo);
  },

  sendRescheduleConfirmation(tenantId, appointmentId, oldTime = "", newTime = "") {
    return this.enqueueTemplateForAppointment(tenantId, appointmentId, "reschedule_confirmation", { old_time: oldTime, new_time: newTime });
  },

  sendWaitlistSlotAvailable(tenantId, waitlistId, slotDetails = {}) {
    return this.enqueueTemplate({
      tenantId,
      templateName: "waitlist_slot_available",
      clientId: slotDetails.clientId || "",
      phone: slotDetails.phone || "",
      branchId: slotDetails.branchId || "",
      variables: slotDetails,
      refId: waitlistId
    });
  },

  sendAbandonedRecovery(tenantId, abandonmentId, variables = {}) {
    return this.enqueueTemplate({
      tenantId,
      templateName: "abandoned_cart_recovery",
      phone: variables.phone || variables.customerMobile || "",
      clientId: variables.clientId || "",
      branchId: variables.branchId || "",
      variables,
      refId: abandonmentId
    });
  },

  sendReviewRequest(tenantId, appointmentId) {
    return this.enqueueTemplateForAppointment(tenantId, appointmentId, "feedback_request");
  },

  sendRebookingRecommendation(tenantId, customerId, suggestedDate = "") {
    return this.enqueueTemplate({
      tenantId,
      templateName: "rebooking_recommendation",
      clientId: customerId,
      variables: { suggested_date: suggestedDate, service_name: "your regular service" },
      refId: `rebooking:${customerId}:${suggestedDate}`
    });
  },

  sendTouchupReminder(tenantId, customerId, eligibleAppointments = []) {
    const first = eligibleAppointments[0] || {};
    return this.enqueueTemplate({
      tenantId,
      templateName: "touchup_eligibility_reminder",
      clientId: customerId,
      variables: { service_name: first.serviceName || "service", warranty_until: first.warrantyUntil || "" },
      refId: `touchup:${customerId}:${first.id || ""}`
    });
  },

  sendBirthdayOffer(tenantId, customerId, offer = "") {
    return this.enqueueTemplate({
      tenantId,
      templateName: "birthday_offer",
      clientId: customerId,
      variables: { offer },
      refId: `birthday:${customerId}:${new Date().getFullYear()}`
    });
  },

  enqueueTemplateForAppointment(tenantId, appointmentId, templateName, extra = {}) {
    const appointment = appointmentFor(tenantId, appointmentId);
    if (!appointment) return { queued: false, skipped: true, reason: "appointment_not_found" };
    const client = clientFor(tenantId, appointment.clientId);
    const branch = branchFor(tenantId, appointment.branchId);
    const staff = staffFor(tenantId, appointment.staffId);
    const services = servicesFor(tenantId, appointment.serviceIds);
    return this.enqueueTemplate({
      tenantId,
      templateName,
      clientId: client?.id || "",
      branchId: appointment.branchId,
      variables: makeVariables({ tenantId, appointment, client, branch, staff, services, extra }),
      refId: `${templateName}:${appointment.id}`,
      critical: ["booking_confirmation", "cancellation_confirmation", "cancellation_with_refund"].includes(templateName)
    });
  }
};
