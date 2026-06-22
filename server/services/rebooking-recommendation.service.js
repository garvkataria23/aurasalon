import { db } from "../db.js";
import { notFound } from "../utils/app-error.js";
import { jobQueueService } from "./job-queue.service.js";

const defaultsByCategory = [
  { pattern: /color|keratin|straight/i, days: 60 },
  { pattern: /facial|skin/i, days: 21 },
  { pattern: /hair|cut|trim/i, days: 35 }
];

function serviceDefault(service = {}) {
  const text = `${service.name || ""} ${service.category || ""}`;
  return defaultsByCategory.find((rule) => rule.pattern.test(text))?.days || 45;
}

function addDays(dateValue, days) {
  return new Date(new Date(dateValue).getTime() + Number(days || 0) * 864e5).toISOString();
}

export const rebookingRecommendationService = {
  recommendNextDate(access, customerId, serviceId = "") {
    const client = db.prepare("SELECT * FROM clients WHERE id = ? AND tenantId = ?").get(customerId, access.tenantId);
    if (!client) throw notFound("Customer not found");
    const lastAppointment = db.prepare(
      `SELECT * FROM appointments
       WHERE tenantId = ? AND clientId = ? AND status IN ('completed', 'billed', 'paid')
       ORDER BY startAt DESC LIMIT 1`
    ).get(access.tenantId, customerId);
    const metrics = db.prepare("SELECT * FROM customer_metrics WHERE tenant_id = ? AND customer_id = ?").get(access.tenantId, customerId);
    const service = serviceId ? db.prepare("SELECT * FROM services WHERE id = ? AND tenantId = ?").get(serviceId, access.tenantId) : null;
    const gapDays = Number(metrics?.avg_gap_days || 0) || serviceDefault(service);
    const baseDate = lastAppointment?.startAt || new Date().toISOString();
    return {
      customerId,
      lastAppointmentId: lastAppointment?.id || "",
      serviceId: serviceId || "",
      avgGapDays: gapDays,
      recommendedDate: addDays(baseDate, gapDays)
    };
  },

  shouldSendRebookingReminder(access, customerId) {
    const recommendation = this.recommendNextDate(access, customerId);
    const future = db.prepare(
      "SELECT id FROM appointments WHERE tenantId = ? AND clientId = ? AND startAt > ? AND status NOT IN ('cancelled', 'no-show') LIMIT 1"
    ).get(access.tenantId, customerId, new Date().toISOString());
    if (future) return { send: false, reason: "future_booking_exists", recommendation };
    const dueAt = new Date(recommendation.recommendedDate).getTime();
    const thresholdAt = dueAt + Number(recommendation.avgGapDays || 45) * 0.1 * 864e5;
    return {
      send: Date.now() > thresholdAt,
      reason: Date.now() > thresholdAt ? "customer_over_gap" : "not_due_yet",
      recommendation
    };
  },

  generateRebookingMessage(access, customerId) {
    const client = db.prepare("SELECT * FROM clients WHERE id = ? AND tenantId = ?").get(customerId, access.tenantId);
    if (!client) throw notFound("Customer not found");
    const decision = this.shouldSendRebookingReminder(access, customerId);
    const message = `Hi ${client.name || "there"}, it may be time for your next salon visit around ${decision.recommendation.recommendedDate.slice(0, 10)}.`;
    return { ...decision, customerId, message };
  },

  queueReminder(access, customerId) {
    const draft = this.generateRebookingMessage(access, customerId);
    if (!draft.send) return { queued: false, ...draft };
    const job = jobQueueService.enqueue({
      tenantId: access.tenantId,
      jobType: "whatsapp-send",
      payload: { customerId, message: draft.message, templateName: "rebooking_recommendation" }
    });
    return { queued: true, jobId: job.id, ...draft };
  }
};
