import crypto from "node:crypto";
import { db } from "../db.js";
import { ensureDashboardSchema } from "../services/dashboard-schema.service.js";

ensureDashboardSchema();

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SKIP_PREFIXES = [
  "/health",
  "/auth/refresh",
  "/dashboard",
  "/socket.io",
  "/realtime"
];

const ENTITY_TABLES = {
  appointments: "appointments",
  appointment: "appointments",
  clients: "clients",
  client: "clients",
  customers: "clients",
  customer: "clients",
  staff: "staff",
  services: "services",
  products: "products",
  inventory: "products",
  sales: "sales",
  sale: "sales",
  invoices: "invoices",
  invoice: "invoices",
  payments: "payments",
  payment: "payments",
  memberships: "memberships",
  membership: "memberships",
  branches: "branches",
  branch: "branches"
};

function safeJson(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ error: "unserializable" });
  }
}

function parseEntity(req) {
  const parts = req.path.split("/").filter(Boolean);
  const entityType = parts[0] || "unknown";
  const entityId = req.params?.id || parts[1] || req.body?.id || "";
  return { entityType, entityId };
}

function oldValueFor(entityType, entityId, tenantId) {
  const table = ENTITY_TABLES[entityType];
  if (!table || !entityId) return {};
  try {
    return db.prepare(`SELECT * FROM ${table} WHERE id = @entityId AND tenantId = @tenantId`).get({ entityId, tenantId }) || {};
  } catch {
    return {};
  }
}

function shouldSkip(req) {
  if (!MUTATION_METHODS.has(req.method)) return true;
  return SKIP_PREFIXES.some((prefix) => req.path.startsWith(prefix));
}

export function auditLogMiddleware(req, res, next) {
  if (shouldSkip(req)) {
    next();
    return;
  }
  const tenantId = req.access?.tenantId || req.headers["x-tenant-id"] || "tenant_aura";
  const { entityType, entityId } = parseEntity(req);
  const oldValue = ["PUT", "PATCH", "DELETE"].includes(req.method) ? oldValueFor(entityType, entityId, tenantId) : {};
  const startedAt = new Date().toISOString();

  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    setImmediate(() => {
      try {
        db.prepare(
          `INSERT INTO audit_log (
            id, tenant_id, user_id, action, entity_type, entity_id,
            old_value, new_value, ip_address, user_agent, created_at
          ) VALUES (
            @id, @tenantId, @userId, @action, @entityType, @entityId,
            @oldValue, @newValue, @ipAddress, @userAgent, @createdAt
          )`
        ).run({
          id: crypto.randomUUID(),
          tenantId,
          userId: req.user?.id || req.user?.sub || req.access?.userId || "system",
          action: `${req.method} ${req.originalUrl.split("?")[0]}`,
          entityType,
          entityId,
          oldValue: safeJson(oldValue),
          newValue: safeJson(req.body),
          ipAddress: req.ip || req.socket?.remoteAddress || "",
          userAgent: req.headers["user-agent"] || "",
          createdAt: startedAt
        });
      } catch {
        // Audit writes must never break the business request.
      }
    });
  });

  next();
}
