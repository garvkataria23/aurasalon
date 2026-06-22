import { randomBytes, randomUUID } from "node:crypto";
import { db } from "../db.js";
import { AppError, badRequest, notFound } from "../utils/app-error.js";

const actions = new Set(["view", "cancel", "reschedule"]);

function makeId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 10)}`;
}

function expiry(hours) {
  return new Date(Date.now() + Number(hours || 168) * 60 * 60 * 1000).toISOString();
}

function gone(message, details = undefined) {
  return new AppError(message, 410, details);
}

function publicToken(row) {
  return {
    id: row.id,
    appointmentId: row.appointmentId,
    actionType: row.actionType,
    token: row.token,
    expiresAt: row.expiresAt,
    used: Number(row.used || 0) === 1
  };
}

export const publicActionTokenService = {
  generateToken({ tenantId, appointmentId, actionType = "view", expiresInHours = 168 }) {
    if (!tenantId || !appointmentId) throw badRequest("tenantId and appointmentId are required");
    if (!actions.has(actionType)) throw badRequest("Unsupported public action type");
    const row = {
      id: makeId("pat"),
      tenantId,
      appointmentId,
      actionType,
      token: randomBytes(32).toString("hex"),
      expiresAt: expiry(expiresInHours)
    };
    db.prepare(
      `INSERT INTO public_action_tokens
       (id, tenantId, appointmentId, actionType, token, expiresAt)
       VALUES (@id, @tenantId, @appointmentId, @actionType, @token, @expiresAt)`
    ).run(row);
    return publicToken(row);
  },

  generateTokenSet({ tenantId, appointmentId, expiresInHours = 168 }) {
    return {
      view: this.generateToken({ tenantId, appointmentId, actionType: "view", expiresInHours }),
      cancel: this.generateToken({ tenantId, appointmentId, actionType: "cancel", expiresInHours }),
      reschedule: this.generateToken({ tenantId, appointmentId, actionType: "reschedule", expiresInHours })
    };
  },

  verifyToken(token, actionType = "") {
    if (!token) throw badRequest("Public action token is required");
    const row = actionType
      ? db.prepare("SELECT * FROM public_action_tokens WHERE token = ? AND actionType = ?").get(token, actionType)
      : db.prepare("SELECT * FROM public_action_tokens WHERE token = ?").get(token);
    if (!row) throw notFound("Public action token not found");
    if (Number(row.used || 0) === 1) throw gone("This booking link has already been used");
    if (new Date(row.expiresAt).getTime() < Date.now()) throw gone("This booking link has expired");
    return row;
  },

  consumeToken(token) {
    const row = this.verifyToken(token);
    db.prepare("UPDATE public_action_tokens SET used = 1, usedAt = CURRENT_TIMESTAMP WHERE token = ?").run(token);
    return { consumed: true, actionType: row.actionType, appointmentId: row.appointmentId };
  },

  recordAttempt(token, ip = "") {
    const row = db.prepare("SELECT attempts, ipHistory FROM public_action_tokens WHERE token = ?").get(token);
    if (!row) return { attempts: 0 };
    let ipHistory = [];
    try {
      ipHistory = JSON.parse(row.ipHistory || "[]");
    } catch {
      ipHistory = [];
    }
    if (ip && !ipHistory.includes(ip)) ipHistory.push(ip);
    const attempts = Number(row.attempts || 0) + 1;
    db.prepare("UPDATE public_action_tokens SET attempts = ?, ipHistory = ? WHERE token = ?")
      .run(attempts, JSON.stringify(ipHistory.slice(-20)), token);
    return { attempts, ipCount: ipHistory.length };
  }
};
