import { randomBytes, randomUUID } from "node:crypto";
import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";

const eventOrder = new Map([
  "portal_visit",
  "branch_selected",
  "service_selected",
  "staff_selected",
  "slot_selected",
  "hold_created",
  "customer_details_entered",
  "otp_sent",
  "otp_verified",
  "payment_started",
  "payment_succeeded",
  "booking_confirmed",
  "booking_abandoned"
].map((name, index) => [name, index + 1]));

function makeId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 10)}`;
}

export const bookingSessionService = {
  createSession({ tenantId, branchId, source = "portal", deviceType = "", ip = "", userAgent = "", utm = {} }) {
    if (!tenantId || !branchId) throw badRequest("tenantId and branchId are required");
    const row = {
      id: makeId("obs"),
      tenantId,
      branchId,
      sessionToken: randomBytes(24).toString("hex"),
      source,
      deviceType,
      ipAddress: ip,
      userAgent,
      utmSource: utm.utmSource || utm.utm_source || "",
      utmMedium: utm.utmMedium || utm.utm_medium || "",
      utmCampaign: utm.utmCampaign || utm.utm_campaign || ""
    };
    db.prepare(
      `INSERT INTO online_booking_sessions
       (id, tenantId, branchId, sessionToken, source, deviceType, ipAddress, userAgent, utmSource, utmMedium, utmCampaign)
       VALUES (@id, @tenantId, @branchId, @sessionToken, @source, @deviceType, @ipAddress, @userAgent, @utmSource, @utmMedium, @utmCampaign)`
    ).run(row);
    this.recordFunnelEvent({ tenantId, sessionId: row.id, eventName: "portal_visit", eventData: { source }, stepOrder: 1 });
    return { sessionId: row.id, sessionToken: row.sessionToken };
  },

  recordFunnelEvent({ tenantId, sessionId, eventName, eventData = {}, stepOrder = 0 }) {
    if (!tenantId || !sessionId || !eventName) throw badRequest("tenantId, sessionId and eventName are required");
    const session = db.prepare("SELECT id FROM online_booking_sessions WHERE id = ? AND tenantId = ?").get(sessionId, tenantId);
    if (!session) throw notFound("Booking session not found");
    const row = {
      id: makeId("bfe"),
      tenantId,
      sessionId,
      eventName,
      eventData: JSON.stringify(eventData || {}),
      stepOrder: Number(stepOrder || eventOrder.get(eventName) || 0)
    };
    db.prepare(
      `INSERT INTO booking_funnel_events (id, tenantId, sessionId, eventName, eventData, stepOrder)
       VALUES (@id, @tenantId, @sessionId, @eventName, @eventData, @stepOrder)`
    ).run(row);
    return row;
  },

  markCompleted(tenantId, sessionId, appointmentId = "") {
    db.prepare("UPDATE online_booking_sessions SET status = 'completed', completedAt = CURRENT_TIMESTAMP, customerId = COALESCE(customerId, '') WHERE id = ? AND tenantId = ?").run(sessionId, tenantId);
    db.prepare("UPDATE booking_abandonments SET recoveryStatus = 'converted', convertedAppointmentId = ?, convertedAt = CURRENT_TIMESTAMP WHERE sessionId = ? AND tenantId = ?").run(appointmentId, sessionId, tenantId);
    return this.recordFunnelEvent({ tenantId, sessionId, eventName: "booking_confirmed", eventData: { appointmentId } });
  },

  markAbandoned(tenantId, sessionId, lastStep = 0, cartValue = 0) {
    const row = {
      id: makeId("aband"),
      tenantId,
      sessionId,
      lastStep: Number(lastStep || 0),
      cartValue: Number(cartValue || 0)
    };
    db.prepare(
      `INSERT OR IGNORE INTO booking_abandonments (id, tenantId, sessionId, lastStep, cartValue)
       VALUES (@id, @tenantId, @sessionId, @lastStep, @cartValue)`
    ).run(row);
    db.prepare("UPDATE online_booking_sessions SET status = 'abandoned' WHERE id = ? AND tenantId = ?").run(sessionId, tenantId);
    return row;
  },

  getSession(tenantId, sessionTokenOrId) {
    const session = db.prepare(
      "SELECT * FROM online_booking_sessions WHERE tenantId = ? AND (id = ? OR sessionToken = ?)"
    ).get(tenantId, sessionTokenOrId, sessionTokenOrId);
    if (!session) throw notFound("Booking session not found");
    return session;
  }
};
