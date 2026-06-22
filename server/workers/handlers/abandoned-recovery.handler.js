import { db } from "../../db.js";
import { run as sendWhatsapp } from "./whatsapp-send.handler.js";

export async function run(job) {
  const payload = job.payload || {};
  const abandonmentId = payload.abandonmentId || "";
  const sessionId = payload.sessionId || "";
  if (!job.tenantId || (!abandonmentId && !sessionId)) {
    return { success: false, error: "tenantId and abandonmentId or sessionId are required" };
  }

  const abandonment = db.prepare(
    `SELECT * FROM booking_abandonments
     WHERE tenantId = ?
       AND (? = '' OR id = ?)
       AND (? = '' OR sessionId = ?)
     ORDER BY abandonedAt DESC
     LIMIT 1`
  ).get(job.tenantId, abandonmentId, abandonmentId, sessionId, sessionId);
  if (!abandonment) return { success: true, skipped: true, reason: "abandonment_not_found" };

  const phone = payload.mobile || payload.phone || abandonment.customerMobile || "";
  if (!phone) {
    db.prepare("UPDATE booking_abandonments SET recoveryStatus = 'no_contact' WHERE id = ? AND tenantId = ?").run(abandonment.id, job.tenantId);
    return { success: true, skipped: true, reason: "missing_recipient" };
  }

  const sent = await sendWhatsapp({
    ...job,
    payload: {
      ...payload,
      phone,
      template: payload.template || payload.templateName || "abandoned_cart_recovery",
      sessionId: abandonment.sessionId,
      variables: {
        ...(payload.variables || {}),
        client_name: payload.clientName || "Guest",
        booking_id: abandonment.sessionId,
        cart_value: String(abandonment.cartValue || 0)
      }
    }
  });

  if (sent?.success === false) return sent;
  db.prepare(
    `UPDATE booking_abandonments
     SET recoveryStatus = 'message_sent',
         recoveryMessageSentAt = CURRENT_TIMESTAMP,
         recoveryAttempts = CASE WHEN recoveryStatus = 'message_queued' THEN recoveryAttempts ELSE recoveryAttempts + 1 END
     WHERE id = ? AND tenantId = ?`
  ).run(abandonment.id, job.tenantId);
  return { success: true, abandonmentId: abandonment.id, messageId: sent.messageId || "", threadId: sent.threadId || "" };
}
