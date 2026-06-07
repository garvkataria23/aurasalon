import { createHash, randomInt, randomUUID } from "node:crypto";
import { db } from "../db.js";
import { badRequest, conflict } from "../utils/app-error.js";
import { jobQueueService } from "./job-queue.service.js";

function makeId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 10)}`;
}

function hashOtp(tenantId, mobile, purpose, otp) {
  return createHash("sha256").update(`${tenantId}:${mobile}:${purpose}:${otp}`).digest("hex");
}

export const bookingOtpService = {
  sendOtp({ tenantId, mobile, purpose = "booking", language = "en" }) {
    if (!tenantId || !mobile) throw badRequest("tenantId and mobile are required");
    const recentFailures = db.prepare(
      `SELECT COALESCE(SUM(attempts), 0) count FROM online_booking_otps
       WHERE tenantId = ? AND mobile = ? AND purpose = ? AND createdAt > datetime('now', '-15 minutes')`
    ).get(tenantId, mobile, purpose);
    if (Number(recentFailures?.count || 0) >= 5) throw conflict("OTP temporarily locked. Try again after 15 minutes.");
    const otp = String(randomInt(1000, 10000));
    const row = {
      id: makeId("otp"),
      tenantId,
      mobile,
      purpose,
      otpHash: hashOtp(tenantId, mobile, purpose, otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    };
    db.prepare(
      `INSERT INTO online_booking_otps (id, tenantId, mobile, otpHash, purpose, expiresAt)
       VALUES (@id, @tenantId, @mobile, @otpHash, @purpose, @expiresAt)`
    ).run(row);
    jobQueueService.enqueue({ tenantId, jobType: "whatsapp_send", payload: { template: "otp_send", phone: mobile, language, variables: { otp } }, priority: 2 });
    return { sent: true, expiresAt: row.expiresAt, devOtp: process.env.NODE_ENV === "production" ? undefined : otp };
  },

  verifyOtp({ tenantId, mobile, purpose = "booking", otp }) {
    if (!tenantId || !mobile || !otp) throw badRequest("tenantId, mobile and otp are required");
    const row = db.prepare(
      `SELECT * FROM online_booking_otps
       WHERE tenantId = ? AND mobile = ? AND purpose = ? AND verifiedAt IS NULL
       ORDER BY createdAt DESC LIMIT 1`
    ).get(tenantId, mobile, purpose);
    if (!row || row.expiresAt < new Date().toISOString()) throw conflict("OTP expired");
    if (Number(row.attempts || 0) >= Number(row.maxAttempts || 5)) throw conflict("OTP attempts exceeded");
    const ok = row.otpHash === hashOtp(tenantId, mobile, purpose, otp);
    if (!ok) {
      db.prepare("UPDATE online_booking_otps SET attempts = attempts + 1 WHERE id = ? AND tenantId = ?").run(row.id, tenantId);
      throw conflict("Invalid OTP");
    }
    db.prepare("UPDATE online_booking_otps SET verifiedAt = CURRENT_TIMESTAMP WHERE id = ? AND tenantId = ?").run(row.id, tenantId);
    return { success: true, verifiedAt: new Date().toISOString() };
  },

  isVerified({ tenantId, mobile, purpose = "booking" }) {
    const row = db.prepare(
      `SELECT id FROM online_booking_otps
       WHERE tenantId = ? AND mobile = ? AND purpose = ? AND verifiedAt IS NOT NULL
         AND createdAt > datetime('now', '-30 minutes')
       ORDER BY verifiedAt DESC LIMIT 1`
    ).get(tenantId, mobile, purpose);
    return Boolean(row);
  }
};
