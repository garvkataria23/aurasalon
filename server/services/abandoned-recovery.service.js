import { db } from "../db.js";
import { jobQueueService } from "./job-queue.service.js";

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
}

function latestEvent(tenantId, sessionId) {
  return db.prepare(
    `SELECT * FROM booking_funnel_events
     WHERE tenantId = ? AND sessionId = ?
     ORDER BY stepOrder DESC, createdAt DESC
     LIMIT 1`
  ).get(tenantId, sessionId);
}

function parseJson(value, fallback = {}) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return fallback;
  }
}

export const abandonedRecoveryService = {
  detectAbandonments({ olderThanMinutes = 10 } = {}) {
    const sessions = db.prepare(
      `SELECT s.*
       FROM online_booking_sessions s
       WHERE s.status = 'active'
         AND s.completedAt IS NULL
         AND s.startedAt < datetime('now', ?)
         AND NOT EXISTS (
           SELECT 1 FROM booking_abandonments a
           WHERE a.tenantId = s.tenantId AND a.sessionId = s.id
         )`
    ).all(`-${Number(olderThanMinutes || 10)} minutes`);
    const inserted = [];
    for (const session of sessions) {
      const event = latestEvent(session.tenantId, session.id);
      const eventData = parseJson(event?.eventData, {});
      const row = {
        id: makeId("aband"),
        tenantId: session.tenantId,
        sessionId: session.id,
        customerMobile: eventData.mobile || eventData.phone || "",
        customerEmail: eventData.email || "",
        lastStep: Number(event?.stepOrder || 0),
        cartValue: Number(eventData.cartValue || eventData.totalAmount || 0)
      };
      db.prepare(
        `INSERT INTO booking_abandonments
         (id, tenantId, sessionId, customerMobile, customerEmail, lastStep, cartValue)
         VALUES (@id, @tenantId, @sessionId, @customerMobile, @customerEmail, @lastStep, @cartValue)`
      ).run(row);
      db.prepare("UPDATE online_booking_sessions SET status = 'abandoned' WHERE id = ? AND tenantId = ?").run(session.id, session.tenantId);
      inserted.push(row);
    }
    return { count: inserted.length, abandonments: inserted };
  },

  attemptRecovery(abandonmentId, tenantId = "") {
    const row = db.prepare(
      `SELECT * FROM booking_abandonments
       WHERE id = ? AND (? = '' OR tenantId = ?)`
    ).get(abandonmentId, tenantId, tenantId);
    if (!row) return { recovered: false, reason: "not_found" };
    if (!row.customerMobile) {
      db.prepare("UPDATE booking_abandonments SET recoveryStatus = 'no_contact' WHERE id = ?").run(row.id);
      return { recovered: false, reason: "no_contact" };
    }
    if (Number(row.recoveryAttempts || 0) >= 2) {
      db.prepare("UPDATE booking_abandonments SET recoveryStatus = 'exhausted' WHERE id = ?").run(row.id);
      return { recovered: false, reason: "max_attempts" };
    }
    const job = jobQueueService.enqueue({
      tenantId: row.tenantId,
      jobType: "abandoned-recovery",
      payload: {
        abandonmentId: row.id,
        sessionId: row.sessionId,
        mobile: row.customerMobile,
        templateName: "abandoned_cart_recovery"
      }
    });
    db.prepare(
      `UPDATE booking_abandonments
       SET recoveryStatus = 'message_queued',
           recoveryMessageSentAt = CURRENT_TIMESTAMP,
           recoveryAttempts = recoveryAttempts + 1
       WHERE id = ?`
    ).run(row.id);
    return { queued: true, jobId: job.id };
  },

  processPendingRecoveries(limit = 25) {
    const rows = db.prepare(
      `SELECT * FROM booking_abandonments
       WHERE recoveryStatus IN ('pending', 'message_queued')
         AND recoveryAttempts < 2
         AND (recoveryMessageSentAt IS NULL OR recoveryMessageSentAt < datetime('now', '-24 hours'))
       ORDER BY abandonedAt ASC
       LIMIT ?`
    ).all(Number(limit || 25));
    return rows.map((row) => this.attemptRecovery(row.id, row.tenantId));
  },

  markRecovered(tenantId, sessionId, appointmentId) {
    db.prepare(
      `UPDATE booking_abandonments
       SET recoveryStatus = 'converted', convertedAppointmentId = ?, convertedAt = CURRENT_TIMESTAMP
       WHERE tenantId = ? AND sessionId = ?`
    ).run(appointmentId, tenantId, sessionId);
  }
};
