import { randomUUID } from "node:crypto";
import { DEFAULT_TENANT_ID, columnsFor, db } from "../db.js";
import { badRequest, forbidden, notFound } from "../utils/app-error.js";
import { computeLeadScore, decorateLeadIntelligence } from "./lead-intelligence-rules.service.js";
import { ensureLeadManagementSchema } from "./lead-management-schema.service.js";

const DEFAULT_STAGES = [
  ["lead_in", "Lead In", 10, "#2563eb", 0, 0],
  ["contact_made", "Contact Made", 20, "#0f766e", 0, 0],
  ["negotiations_started", "Negotiations Started", 30, "#7c3aed", 0, 0],
  ["proposal_made", "Proposal Made", 40, "#c2410c", 0, 0],
  ["finalized", "Finalized", 50, "#334155", 0, 0],
  ["won", "Won", 60, "#15803d", 1, 0],
  ["lost", "Lost", 70, "#b91c1c", 0, 1]
];

const DEFAULT_TYPES = [
  ["facial", "Facial"],
  ["smoothening", "Smoothening"],
  ["general_inquiry", "General Inquiry"]
];

const OWNER_ROLES = new Set(["owner", "admin", "superAdmin"]);
const OPEN_STATUSES = new Set(["open", "follow_up", "won", "lost"]);

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${randomUUID().slice(0, 10)}`;
const text = (value = "") => String(value || "").trim();
function key(value = "") {
  const input = text(value).toLowerCase();
  let output = "";
  let needsSeparator = false;
  for (const char of input) {
    const code = char.charCodeAt(0);
    const isAlphaNumeric = (code >= 48 && code <= 57) || (code >= 97 && code <= 122);
    if (isAlphaNumeric) {
      if (needsSeparator && output) output += "_";
      output += char;
      needsSeparator = false;
    } else if (output) {
      needsSeparator = true;
    }
  }
  return output || "general";
}
const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
const boolInt = (value) => value ? 1 : 0;
const toJson = (value) => JSON.stringify(value ?? {});
const todayIso = () => new Date().toISOString().slice(0, 10);

function parseJson(value, fallback = {}) {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function tableExists(table) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = @table").get({ table }));
}

function hasColumn(table, column) {
  try {
    return columnsFor(table).includes(column);
  } catch {
    return false;
  }
}

function scope(access = {}) {
  return {
    tenantId: access.tenantId || DEFAULT_TENANT_ID,
    branchId: access.branchId || "",
    userId: access.userId || access.staffId || "",
    role: access.role || "owner",
    branchIds: Array.isArray(access.branchIds) ? access.branchIds : []
  };
}

function assertWrite(access = {}) {
  const scoped = scope(access);
  if (["owner", "admin", "superAdmin", "manager", "staff"].includes(scoped.role)) return scoped;
  throw forbidden("Lead management write access is restricted");
}

function assertOwnerOrManager(access = {}) {
  const scoped = scope(access);
  if (OWNER_ROLES.has(scoped.role) || scoped.role === "manager") return scoped;
  throw forbidden("Lead settings require owner or manager access");
}

function normalizePhone(value = "") {
  return text(value).replace(/[^\d+]/g, "");
}

function moneyPaise(payload = {}) {
  if (payload.quotedAmountPaise !== undefined) return Math.max(0, int(payload.quotedAmountPaise, 0));
  const rupees = payload.quotedAmount ?? payload.quotedPrice ?? payload.price ?? 0;
  return Math.max(0, Math.round(Number(rupees || 0) * 100));
}

function stageStatus(stage = {}) {
  if (stage.isWon) return "won";
  if (stage.isLost) return "lost";
  return "open";
}

function computeScore(payload = {}, clientMatch = null) {
  const scored = computeLeadScore(payload, clientMatch);
  return {
    leadScore: scored.leadScore,
    leadTemperature: scored.leadTemperature
  };
}

function slaStatus(row = {}) {
  if (row.status === "won" || row.status === "lost") return row.status;
  if (!row.followUpAt) return "collecting";
  const due = Date.parse(row.followUpAt);
  if (!Number.isFinite(due)) return "collecting";
  const diff = due - Date.now();
  if (diff < -3600000) return "missed";
  if (diff < 0) return "overdue";
  if (new Date(due).toISOString().slice(0, 10) === todayIso()) return "due_today";
  return "on_time";
}

function mapStage(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId || "",
    name: row.name,
    stageKey: row.stageKey,
    sortOrder: int(row.sortOrder, 0),
    color: row.color || "",
    isWon: Boolean(row.isWon),
    isLost: Boolean(row.isLost),
    active: Boolean(row.active),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapType(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId || "",
    name: row.name,
    typeKey: row.typeKey,
    active: Boolean(row.active),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapLead(row = {}) {
  const lead = {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    title: row.title,
    quotedAmountPaise: int(row.quotedAmountPaise, 0),
    quotedAmount: int(row.quotedAmountPaise, 0) / 100,
    convertedAmountPaise: int(row.convertedAmountPaise, 0),
    convertedAmount: int(row.convertedAmountPaise, 0) / 100,
    currency: row.currency || "INR",
    customerName: row.customerName,
    phone: row.phone,
    email: row.email || "",
    clientId: row.clientId || "",
    typeId: row.typeId || "",
    typeName: row.typeName || "",
    stageId: row.stageId || "",
    stageName: row.stageName || "",
    assignedTo: row.assignedTo || "",
    assignedName: row.assignedName || "",
    source: row.source || "",
    followUpAt: row.followUpAt || "",
    notes: row.notes || "",
    leadScore: int(row.leadScore, 0),
    leadTemperature: row.leadTemperature || "cold",
    slaStatus: row.slaStatus || slaStatus(row),
    status: row.status || "open",
    wonAt: row.wonAt || "",
    lostAt: row.lostAt || "",
    lostReason: row.lostReason || "",
    invoiceId: row.invoiceId || "",
    appointmentId: row.appointmentId || "",
    createdBy: row.createdBy || "",
    updatedBy: row.updatedBy || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
  return decorateLeadIntelligence(lead);
}

function mapEvent(row = {}) {
  return {
    id: row.id,
    leadId: row.leadId || "",
    action: row.action,
    fromStageId: row.fromStageId || "",
    toStageId: row.toStageId || "",
    beforePayload: parseJson(row.beforePayload, {}),
    afterPayload: parseJson(row.afterPayload, {}),
    status: row.status || "recorded",
    createdAt: row.createdAt,
    actorUserId: row.actorUserId || ""
  };
}

function mapFollowUp(row = {}) {
  return {
    id: row.id,
    leadId: row.leadId,
    dueAt: row.dueAt,
    note: row.note || "",
    status: row.status || "pending",
    completedAt: row.completedAt || "",
    createdBy: row.createdBy || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function stripMessagePrefix(value = "", prefixes = []) {
  const raw = text(value);
  const lower = raw.toLowerCase();
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix.toLowerCase())) return text(raw.slice(prefix.length));
  }
  return raw;
}

function noteTimelineItem(row = {}) {
  const noteType = text(row.noteType || "note").toLowerCase();
  let channel = "note";
  let kind = "Note";
  let icon = "N";
  let title = "Note added";
  let status = "recorded";
  let body = text(row.note);
  if (noteType === "initial") title = "Initial note";
  if (noteType === "whatsapp_draft") {
    channel = "whatsapp";
    kind = "WhatsApp";
    icon = "W";
    title = "WhatsApp draft";
    status = "draft";
    body = stripMessagePrefix(body, ["WhatsApp draft:"]);
  } else if (noteType === "whatsapp_send") {
    channel = "whatsapp";
    kind = "WhatsApp";
    icon = "W";
    const match = body.match(/^WhatsApp\s+([^:]+):\s*(.*)$/i);
    status = text(match?.[1] || "requested");
    title = status === "send_blocked" ? "WhatsApp send blocked" : "WhatsApp send requested";
    body = text(match?.[2] || body);
  } else if (noteType === "call_log") {
    channel = "call";
    kind = "Call";
    icon = "C";
    title = "Call logged";
    status = "attempted";
    body = stripMessagePrefix(body, ["Call attempted:", "Call logged:"]);
  } else if (noteType === "email_action") {
    channel = "email";
    kind = "Email";
    icon = "E";
    title = "Email action";
    status = "opened";
    body = stripMessagePrefix(body, ["Email opened:", "Email logged:"]);
  } else if (noteType === "ai_call_script") {
    channel = "ai";
    kind = "AI script";
    icon = "AI";
    title = "AI call script";
    status = "draft";
  }
  return {
    id: row.id,
    source: "note",
    channel,
    kind,
    icon,
    title,
    body,
    status,
    noteType,
    createdAt: row.createdAt,
    actorUserId: row.createdBy || ""
  };
}

function followUpTimelineItem(row = {}) {
  return {
    id: row.id,
    source: "follow_up",
    channel: "follow",
    kind: "Follow-up",
    icon: "F",
    title: row.status === "done" ? "Follow-up completed" : "Follow-up scheduled",
    body: row.note || "Manual follow-up",
    status: row.status || "pending",
    dueAt: row.dueAt,
    createdAt: row.dueAt || row.createdAt,
    actorUserId: row.createdBy || ""
  };
}

function eventTitle(action = "") {
  const labels = {
    "lead.created": "Lead created",
    "lead.updated": "Lead updated",
    "lead.stage_changed": "Stage changed",
    "lead.marked_won_opportunity": "Lead marked won",
    "lead.marked_lost": "Lead marked lost",
    "lead.client_linked": "Client linked",
    "lead.client_created": "Client created",
    "lead.appointment_booked": "Appointment booked",
    "lead.invoice_linked": "Invoice linked",
    "lead.assigned": "Lead assigned",
    "lead.follow_up_completed": "Follow-up completed",
    "lead.manager_escalated": "Manager escalated",
    "lead.win_back_created": "Win-back created",
    "lead.hot_sla_task_created": "Hot SLA task created",
    "lead.automation_run": "Automation run"
  };
  return labels[action] || text(action).replace(/^lead\./, "").replace(/_/g, " ") || "Lead event";
}

function eventTimelineItem(row = {}) {
  return {
    id: row.id,
    source: "event",
    channel: "system",
    kind: "System",
    icon: "•",
    title: eventTitle(row.action),
    body: row.afterPayload?.note || row.afterPayload?.status || row.status || "Lead activity recorded.",
    status: row.status || "recorded",
    createdAt: row.createdAt,
    actorUserId: row.actorUserId || ""
  };
}

function communicationTimeline(notes = [], followUps = [], events = []) {
  const hiddenEvents = new Set([
    "lead.note_added",
    "lead.follow_up_added",
    "lead.whatsapp_draft_created",
    "lead.whatsapp_send_requested",
    "lead.call_logged",
    "lead.email_logged"
  ]);
  return [
    ...notes.map(noteTimelineItem),
    ...followUps.map(followUpTimelineItem),
    ...events.filter((row) => !hiddenEvents.has(row.action)).map(eventTimelineItem)
  ].sort((left, right) => (Date.parse(right.createdAt || "") || 0) - (Date.parse(left.createdAt || "") || 0));
}

function ensureDefaults(access) {
  ensureLeadManagementSchema();
  const scoped = scope(access);
  const stamp = now();
  for (const [stageKey, name, sortOrder, color, isWon, isLost] of DEFAULT_STAGES) {
    db.prepare(`
      INSERT OR IGNORE INTO leadStages
        (id, tenantId, branchId, name, stageKey, sortOrder, color, isWon, isLost, active, createdAt, updatedAt)
      VALUES
        (@id, @tenantId, @branchId, @name, @stageKey, @sortOrder, @color, @isWon, @isLost, 1, @createdAt, @updatedAt)
    `).run({ id: id("lead_stage"), tenantId: scoped.tenantId, branchId: scoped.branchId, name, stageKey, sortOrder, color, isWon, isLost, createdAt: stamp, updatedAt: stamp });
  }
  for (const [typeKey, name] of DEFAULT_TYPES) {
    db.prepare(`
      INSERT OR IGNORE INTO leadTypes
        (id, tenantId, branchId, name, typeKey, active, createdAt, updatedAt)
      VALUES
        (@id, @tenantId, @branchId, @name, @typeKey, 1, @createdAt, @updatedAt)
    `).run({ id: id("lead_type"), tenantId: scoped.tenantId, branchId: scoped.branchId, name, typeKey, createdAt: stamp, updatedAt: stamp });
  }
}

function stages(access, includeInactive = false) {
  const scoped = scope(access);
  ensureDefaults(scoped);
  const filters = ["tenantId = @tenantId", "branchId = @branchId"];
  if (!includeInactive) filters.push("active = 1");
  return db.prepare(`
    SELECT * FROM leadStages
    WHERE ${filters.join(" AND ")}
    ORDER BY sortOrder ASC, name COLLATE NOCASE ASC
  `).all({ tenantId: scoped.tenantId, branchId: scoped.branchId }).map(mapStage);
}

function types(access, includeInactive = false) {
  const scoped = scope(access);
  ensureDefaults(scoped);
  const filters = ["tenantId = @tenantId", "branchId = @branchId"];
  if (!includeInactive) filters.push("active = 1");
  return db.prepare(`
    SELECT * FROM leadTypes
    WHERE ${filters.join(" AND ")}
    ORDER BY name COLLATE NOCASE ASC
  `).all({ tenantId: scoped.tenantId, branchId: scoped.branchId }).map(mapType);
}

function firstStage(access) {
  return stages(access)[0] || null;
}

function findStage(access, stageIdOrName) {
  const scoped = scope(access);
  ensureDefaults(scoped);
  const value = text(stageIdOrName);
  if (!value) return firstStage(scoped);
  return db.prepare(`
    SELECT * FROM leadStages
    WHERE tenantId = @tenantId AND branchId = @branchId AND active = 1
      AND (id = @value OR stageKey = @key OR lower(name) = lower(@value))
    ORDER BY sortOrder ASC
    LIMIT 1
  `).get({ tenantId: scoped.tenantId, branchId: scoped.branchId, value, key: key(value) });
}

function findType(access, typeIdOrName) {
  const scoped = scope(access);
  ensureDefaults(scoped);
  const value = text(typeIdOrName);
  if (!value) return types(scoped)[0] || null;
  return db.prepare(`
    SELECT * FROM leadTypes
    WHERE tenantId = @tenantId AND branchId = @branchId AND active = 1
      AND (id = @value OR typeKey = @key OR lower(name) = lower(@value))
    ORDER BY name ASC
    LIMIT 1
  `).get({ tenantId: scoped.tenantId, branchId: scoped.branchId, value, key: key(value) });
}

function staffName(access, staffId) {
  const scoped = scope(access);
  if (!staffId || !tableExists("staff")) return "";
  const row = db.prepare("SELECT name FROM staff WHERE tenantId = @tenantId AND id = @id LIMIT 1").get({ tenantId: scoped.tenantId, id: staffId });
  return row?.name || "";
}

function clientMatch(access, payload = {}) {
  const scoped = scope(access);
  if (!tableExists("clients")) return { clientId: "", duplicateWarning: "" };
  const phone = normalizePhone(payload.phone);
  const email = text(payload.email).toLowerCase();
  const matches = [];
  const tenantClause = hasColumn("clients", "tenantId") ? "tenantId = @tenantId AND" : "";
  if (phone) {
    matches.push(...db.prepare(`
      SELECT id, name, phone, email FROM clients
      WHERE ${tenantClause} REPLACE(REPLACE(REPLACE(COALESCE(phone, ''), ' ', ''), '-', ''), '+', '') = REPLACE(@phone, '+', '')
      LIMIT 5
    `).all({ tenantId: scoped.tenantId, phone }));
  }
  if (!matches.length && email) {
    matches.push(...db.prepare(`SELECT id, name, phone, email FROM clients WHERE ${tenantClause} lower(COALESCE(email, '')) = @email LIMIT 5`).all({ tenantId: scoped.tenantId, email }));
  }
  const unique = [...new Map(matches.map((row) => [row.id, row])).values()];
  return {
    clientId: unique.length === 1 ? unique[0].id : "",
    duplicateWarning: unique.length > 1 ? "Multiple existing clients match this lead" : "",
    matches: unique
  };
}

function columnSet(table) {
  try {
    return new Set(columnsFor(table));
  } catch {
    return new Set();
  }
}

function putColumn(row, columns, names, value) {
  const name = names.find((item) => columns.has(item));
  if (name) row[name] = value;
}

function insertDynamic(table, row) {
  const columns = Object.keys(row);
  const names = columns.map((column) => `"${column}"`).join(", ");
  const params = columns.map((column) => `@${column}`).join(", ");
  db.prepare(`INSERT INTO ${table} (${names}) VALUES (${params})`).run(row);
}

function updateLeadLinks(scoped, leadId, updates = {}) {
  const next = {
    id: leadId,
    tenantId: scoped.tenantId,
    branchId: scoped.branchId,
    updatedBy: scoped.userId,
    updatedAt: now(),
    ...updates
  };
  const assignments = Object.keys(updates).map((column) => `${column} = @${column}`);
  assignments.push("updatedBy = @updatedBy", "updatedAt = @updatedAt");
  db.prepare(`
    UPDATE leadRecords
    SET ${assignments.join(", ")}
    WHERE id = @id AND tenantId = @tenantId AND branchId = @branchId
  `).run(next);
}

function clientById(access, clientId) {
  const scoped = scope(access);
  if (!tableExists("clients") || !clientId) return null;
  const clauses = ["id = @clientId"];
  if (hasColumn("clients", "tenantId")) clauses.push("tenantId = @tenantId");
  return db.prepare(`SELECT * FROM clients WHERE ${clauses.join(" AND ")} LIMIT 1`).get({ tenantId: scoped.tenantId, clientId }) || null;
}

function firstStaffId(access, branchId = "") {
  const scoped = scope(access);
  if (!tableExists("staff")) return "";
  const clauses = [];
  if (hasColumn("staff", "tenantId")) clauses.push("tenantId = @tenantId");
  if (hasColumn("staff", "branchId") && branchId) clauses.push("branchId = @branchId");
  if (hasColumn("staff", "status")) clauses.push("COALESCE(status, 'active') != 'inactive'");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const row = db.prepare(`SELECT id FROM staff ${where} ORDER BY name COLLATE NOCASE ASC LIMIT 1`).get({ tenantId: scoped.tenantId, branchId });
  return row?.id || "";
}

function invoiceByRef(access, ref) {
  const scoped = scope(access);
  const value = text(ref);
  if (!tableExists("invoices") || !value) return null;
  const columns = columnSet("invoices");
  const refClauses = ["id = @value"];
  if (columns.has("invoiceNumber")) refClauses.push("invoiceNumber = @value");
  if (columns.has("invoice_no")) refClauses.push("invoice_no = @value");
  const clauses = [`(${refClauses.join(" OR ")})`];
  if (columns.has("tenantId")) clauses.push("tenantId = @tenantId");
  if (columns.has("tenant_id")) clauses.push("tenant_id = @tenantId");
  return db.prepare(`SELECT * FROM invoices WHERE ${clauses.join(" AND ")} LIMIT 1`).get({ tenantId: scoped.tenantId, value }) || null;
}

function invoiceClientId(invoice = {}) {
  return text(invoice.clientId || invoice.customer_id || invoice.customerId);
}

function invoiceAmountPaise(invoice = {}) {
  const amount = Number(invoice.grand_total || invoice.total || invoice.paid_amount || invoice.paid || 0);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function invoiceLabel(invoice = {}) {
  return text(invoice.invoiceNumber || invoice.invoice_no || invoice.id);
}

function appointmentFromInvoice(access, invoice = {}) {
  const scoped = scope(access);
  if (text(invoice.appointmentId)) return text(invoice.appointmentId);
  if (!tableExists("sales") || !invoice.saleId) return "";
  const clauses = ["id = @saleId"];
  if (hasColumn("sales", "tenantId")) clauses.push("tenantId = @tenantId");
  const sale = db.prepare(`SELECT appointmentId FROM sales WHERE ${clauses.join(" AND ")} LIMIT 1`).get({ tenantId: scoped.tenantId, saleId: invoice.saleId });
  return text(sale?.appointmentId);
}

function leadBusinessLinks(access, lead = {}) {
  const scoped = scope(access);
  const match = clientMatch(scoped, lead);
  const client = lead.clientId ? clientById(scoped, lead.clientId) : match.clientId ? clientById(scoped, match.clientId) : null;
  const invoice = lead.invoiceId ? invoiceByRef(scoped, lead.invoiceId) : null;
  const appointment = tableExists("appointments") && lead.appointmentId
    ? db.prepare("SELECT * FROM appointments WHERE id = @appointmentId LIMIT 1").get({ appointmentId: lead.appointmentId }) || null
    : null;
  return {
    client: client ? { id: client.id, name: client.name, phone: client.phone, email: client.email, branchId: client.branchId || "", totalSpend: client.totalSpend || 0, visitCount: client.visitCount || 0 } : null,
    clientMatches: match.matches || [],
    duplicateWarning: match.duplicateWarning,
    appointment: appointment ? { id: appointment.id, startAt: appointment.startAt, status: appointment.status, staffId: appointment.staffId, serviceIds: parseJson(appointment.serviceIds, []) } : null,
    invoice: invoice ? { id: invoice.id, invoiceNumber: invoiceLabel(invoice), total: invoice.grand_total || invoice.total || 0, paid: invoice.paid_amount || invoice.paid || 0, status: invoice.payment_status || invoice.status || "", clientId: invoiceClientId(invoice) } : null
  };
}

function insertEvent(access, payload = {}) {
  const scoped = scope(access);
  const row = {
    id: id("lead_evt"),
    tenantId: scoped.tenantId,
    branchId: payload.branchId || scoped.branchId,
    leadId: payload.leadId || "",
    actorUserId: scoped.userId,
    action: payload.action || "lead.updated",
    fromStageId: payload.fromStageId || "",
    toStageId: payload.toStageId || "",
    beforePayload: toJson(payload.beforePayload || {}),
    afterPayload: toJson(payload.afterPayload || {}),
    status: payload.status || "recorded",
    createdAt: now()
  };
  db.prepare(`
    INSERT INTO leadEvents
      (id, tenantId, branchId, leadId, actorUserId, action, fromStageId, toStageId, beforePayload, afterPayload, status, createdAt)
    VALUES
      (@id, @tenantId, @branchId, @leadId, @actorUserId, @action, @fromStageId, @toStageId, @beforePayload, @afterPayload, @status, @createdAt)
  `).run(row);
  return mapEvent(row);
}

function leadById(access, leadId) {
  const scoped = scope(access);
  const lead = db.prepare("SELECT * FROM leadRecords WHERE tenantId = @tenantId AND branchId = @branchId AND id = @id").get({ tenantId: scoped.tenantId, branchId: scoped.branchId, id: leadId });
  if (!lead) throw notFound("Lead not found");
  return lead;
}

function queryLeads(access, query = {}) {
  const scoped = scope(access);
  ensureDefaults(scoped);
  const params = { tenantId: scoped.tenantId, branchId: scoped.branchId, limit: Math.min(500, Math.max(1, int(query.limit, 200))) };
  const filters = ["tenantId = @tenantId", "branchId = @branchId"];
  if (query.stageId) {
    filters.push("stageId = @stageId");
    params.stageId = text(query.stageId);
  }
  if (query.typeId) {
    filters.push("typeId = @typeId");
    params.typeId = text(query.typeId);
  }
  if (query.assignedTo) {
    filters.push("assignedTo = @assignedTo");
    params.assignedTo = text(query.assignedTo);
  }
  if (query.source) {
    filters.push("lower(source) = lower(@source)");
    params.source = text(query.source);
  }
  if (query.status && OPEN_STATUSES.has(text(query.status))) {
    filters.push("status = @status");
    params.status = text(query.status);
  }
  if (query.from) {
    filters.push("date(COALESCE(NULLIF(followUpAt, ''), createdAt)) >= date(@from)");
    params.from = text(query.from);
  }
  if (query.to) {
    filters.push("date(COALESCE(NULLIF(followUpAt, ''), createdAt)) <= date(@to)");
    params.to = text(query.to);
  }
  if (query.q) {
    filters.push("(lower(title) LIKE @q OR lower(customerName) LIKE @q OR phone LIKE @q OR lower(email) LIKE @q)");
    params.q = `%${text(query.q).toLowerCase()}%`;
  }
  return db.prepare(`
    SELECT * FROM leadRecords
    WHERE ${filters.join(" AND ")}
    ORDER BY updatedAt DESC
    LIMIT @limit
  `).all(params).map(mapLead);
}

function followUps(access, query = {}) {
  const scoped = scope(access);
  ensureDefaults(scoped);
  const params = { tenantId: scoped.tenantId, branchId: scoped.branchId, limit: Math.min(500, Math.max(1, int(query.limit, 200))) };
  const filters = ["f.tenantId = @tenantId", "f.branchId = @branchId"];
  if (query.from) {
    filters.push("date(f.dueAt) >= date(@from)");
    params.from = text(query.from);
  }
  if (query.to) {
    filters.push("date(f.dueAt) <= date(@to)");
    params.to = text(query.to);
  }
  if (query.stageId) {
    filters.push("l.stageId = @stageId");
    params.stageId = text(query.stageId);
  }
  if (query.assignedTo) {
    filters.push("l.assignedTo = @assignedTo");
    params.assignedTo = text(query.assignedTo);
  }
  if (query.status) {
    filters.push("f.status = @status");
    params.status = text(query.status);
  }
  return db.prepare(`
    SELECT f.*, l.title, l.customerName, l.phone, l.email, l.stageName, l.assignedName
    FROM leadFollowUps f
    LEFT JOIN leadRecords l ON l.id = f.leadId AND l.tenantId = f.tenantId AND l.branchId = f.branchId
    WHERE ${filters.join(" AND ")}
    ORDER BY f.dueAt ASC
    LIMIT @limit
  `).all(params).map((row) => ({ ...mapFollowUp(row), lead: mapLead(row) }));
}

function reportCards(rows = [], followUpRows = []) {
  const won = rows.filter((row) => row.status === "won");
  const lost = rows.filter((row) => row.status === "lost");
  const overdue = followUpRows.filter((row) => Date.parse(row.dueAt) < Date.now() && row.status !== "done");
  const revenue = won.reduce((sum, row) => sum + int(row.convertedAmountPaise || row.quotedAmountPaise, 0), 0);
  return [
    { key: "total", label: "Total leads", value: rows.length, detail: "Selected period" },
    { key: "hot", label: "Hot leads", value: rows.filter((row) => row.leadTemperature === "hot").length, detail: "Score 70+" },
    { key: "won", label: "Won leads", value: won.length, detail: lost.length ? `${lost.length} lost` : "No lost leads" },
    { key: "overdue", label: "Overdue follow-ups", value: overdue.length, detail: "Needs action" },
    { key: "revenue", label: "Revenue from won leads", value: revenue / 100, detail: "Opportunity amount" }
  ];
}

function grouped(rows, field) {
  const map = new Map();
  for (const row of rows) {
    const label = row[field] || "Unassigned";
    map.set(label, (map.get(label) || 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function managerAttentionRows(rows = []) {
  const rank = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
  return rows
    .filter((row) => row.needsAttention)
    .map((row) => ({
      id: row.id,
      title: row.title,
      customerName: row.customerName,
      phone: row.phone,
      leadScore: row.leadScore,
      leadTemperature: row.leadTemperature,
      nextBestAction: row.nextBestAction,
      managerAttention: row.managerAttention,
      attentionPriority: row.attentionPriority,
      assignedName: row.assignedName,
      source: row.source,
      followUpAt: row.followUpAt
    }))
    .sort((left, right) => (rank[left.attentionPriority] ?? 5) - (rank[right.attentionPriority] ?? 5) || right.leadScore - left.leadScore)
    .slice(0, 12);
}

function percent(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function rupeesFromPaise(value) {
  return int(value, 0) / 100;
}

function leadRevenuePaise(row = {}) {
  return int(row.convertedAmountPaise || row.quotedAmountPaise, 0);
}

function labelCounts(rows = [], field) {
  const counts = new Map();
  for (const row of rows) {
    const label = text(row[field]) || "Unassigned";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function reportRecommendations({ rows = [], sourceRoi = [], staffConversion = [], lostReasonAnalysis = [], revenueAttribution = {}, followUpRows = [] } = {}) {
  const recommendations = [];
  const overdue = followUpRows.filter((row) => Date.parse(row.dueAt) < Date.now() && row.status !== "done").length;
  const hotUnassigned = rows.filter((row) => row.leadTemperature === "hot" && !text(row.assignedTo)).length;
  const attention = rows.filter((row) => row.needsAttention).length;
  const weakSource = sourceRoi.find((row) => row.leadCount >= 2 && row.conversionRate < 25);
  const strongSource = sourceRoi.find((row) => row.wonRevenue > 0 || row.conversionRate >= 50);
  const staffRisk = staffConversion.find((row) => row.overdueFollowUps > 0 || row.needsAttention > 0);
  const lostReason = lostReasonAnalysis[0];

  if (hotUnassigned) {
    recommendations.push({
      key: "hot_unassigned",
      priority: "urgent",
      title: "Assign hot leads now",
      detail: `${hotUnassigned} hot lead${hotUnassigned === 1 ? "" : "s"} are still unassigned.`,
      action: "Assign owner and schedule same-day follow-up"
    });
  }
  if (overdue) {
    recommendations.push({
      key: "overdue_followups",
      priority: "high",
      title: "Clear overdue follow-ups",
      detail: `${overdue} follow-up${overdue === 1 ? "" : "s"} crossed SLA.`,
      action: "Call first, then log outcome or escalation"
    });
  }
  if (weakSource) {
    recommendations.push({
      key: "weak_source",
      priority: "medium",
      title: `Audit ${weakSource.source}`,
      detail: `${weakSource.leadCount} leads with ${weakSource.conversionRate}% conversion.`,
      action: "Review lead quality, script and offer fit"
    });
  }
  if (strongSource) {
    recommendations.push({
      key: "strong_source",
      priority: "low",
      title: `Double down on ${strongSource.source}`,
      detail: `${strongSource.conversionRate}% conversion and ₹${strongSource.wonRevenue} won revenue.`,
      action: "Route faster response and staff capacity to this source"
    });
  }
  if (staffRisk) {
    recommendations.push({
      key: "staff_attention",
      priority: staffRisk.overdueFollowUps ? "high" : "medium",
      title: `Coach ${staffRisk.staff}`,
      detail: `${staffRisk.needsAttention} attention lead${staffRisk.needsAttention === 1 ? "" : "s"} and ${staffRisk.overdueFollowUps} overdue follow-up${staffRisk.overdueFollowUps === 1 ? "" : "s"}.`,
      action: "Review queue ownership and next-action discipline"
    });
  }
  if (lostReason && lostReason.lostCount) {
    recommendations.push({
      key: "lost_reason",
      priority: lostReason.lostOpportunity > 0 ? "medium" : "low",
      title: `Reduce ${lostReason.reason} losses`,
      detail: `${lostReason.lostCount} lost lead${lostReason.lostCount === 1 ? "" : "s"} worth ₹${lostReason.lostOpportunity}.`,
      action: "Create objection script and manager review rule"
    });
  }
  if (revenueAttribution.unlinkedWonRevenue > 0) {
    recommendations.push({
      key: "unlinked_revenue",
      priority: "medium",
      title: "Link won revenue",
      detail: `₹${revenueAttribution.unlinkedWonRevenue} won revenue is not linked to invoice or appointment.`,
      action: "Connect won leads to invoice and booking records"
    });
  }
  if (!recommendations.length && attention) {
    recommendations.push({
      key: "review_attention",
      priority: "medium",
      title: "Review attention queue",
      detail: `${attention} lead${attention === 1 ? "" : "s"} need owner review.`,
      action: "Open manager attention list"
    });
  }
  if (!recommendations.length) {
    recommendations.push({
      key: "healthy_pipeline",
      priority: "low",
      title: "Pipeline is stable",
      detail: "No urgent lead intelligence risks in the selected period.",
      action: "Keep response SLA and follow-up cadence active"
    });
  }
  return recommendations.slice(0, 8);
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

function isOpenLead(row = {}) {
  return row.status !== "won" && row.status !== "lost";
}

function leadAutomationQueue(rows = [], followUpRows = []) {
  const queue = [];
  const activeFollowUpsByLead = new Map();
  for (const followUp of followUpRows) {
    if (followUp.status === "done") continue;
    if (!activeFollowUpsByLead.has(followUp.leadId)) activeFollowUpsByLead.set(followUp.leadId, []);
    activeFollowUpsByLead.get(followUp.leadId).push(followUp);
  }
  const push = (lead, item) => {
    queue.push({
      id: `${item.type}:${lead.id}:${item.refId || ""}`,
      leadId: lead.id,
      leadTitle: lead.title,
      customerName: lead.customerName,
      phone: lead.phone,
      source: lead.source || "Unknown",
      assignedTo: lead.assignedTo || "",
      assignedName: lead.assignedName || "",
      leadScore: lead.leadScore,
      leadTemperature: lead.leadTemperature,
      status: lead.status,
      followUpAt: lead.followUpAt,
      attentionPriority: lead.attentionPriority || "normal",
      ...item
    });
  };

  for (const lead of rows) {
    const activeFollowUps = activeFollowUpsByLead.get(lead.id) || [];
    const overdueFollowUps = activeFollowUps.filter((row) => Date.parse(row.dueAt) < Date.now());
    const staleHours = Math.max(0, Math.round((Date.now() - Date.parse(lead.updatedAt || lead.createdAt || now())) / 3600000));
    if (isOpenLead(lead) && lead.leadTemperature === "hot" && !text(lead.assignedTo)) {
      push(lead, {
        type: "staff_assignment",
        priority: "urgent",
        title: "Hot lead unassigned",
        description: "Assign owner immediately so response SLA is not missed.",
        action: "assign_owner",
        actionLabel: "Assign owner"
      });
    }
    for (const followUp of overdueFollowUps.slice(0, 2)) {
      push(lead, {
        type: "overdue_alert",
        priority: lead.leadTemperature === "hot" ? "urgent" : "high",
        title: "Overdue follow-up",
        description: followUp.note || "Follow-up due time has passed.",
        action: "complete_follow_up",
        actionLabel: "Mark done",
        followUpId: followUp.id,
        dueAt: followUp.dueAt,
        refId: followUp.id
      });
    }
    if (isOpenLead(lead) && !lead.followUpAt && !activeFollowUps.length) {
      push(lead, {
        type: "auto_follow_up",
        priority: lead.leadTemperature === "hot" ? "high" : "medium",
        title: "No follow-up scheduled",
        description: "Create the next reminder so manual follow-up is not missed.",
        action: "schedule_follow_up",
        actionLabel: "Schedule"
      });
    }
    if (isOpenLead(lead) && lead.leadTemperature === "hot" && ["missed", "overdue", "due_today"].includes(String(lead.slaStatus || "").toLowerCase())) {
      push(lead, {
        type: "hot_sla",
        priority: lead.slaStatus === "missed" ? "urgent" : "high",
        title: "Hot lead response SLA",
        description: `SLA status is ${lead.slaStatus}. Contact now and log outcome.`,
        action: "hot_sla_response",
        actionLabel: "Create SLA task"
      });
    }
    if (isOpenLead(lead) && (lead.needsAttention || staleHours >= 72)) {
      push(lead, {
        type: "manager_escalation",
        priority: lead.attentionPriority === "urgent" ? "urgent" : staleHours >= 120 ? "high" : "medium",
        title: "Manager escalation",
        description: staleHours >= 72 ? `${staleHours}h without meaningful progress.` : "Lead intelligence marked this lead for manager review.",
        action: "escalate_manager",
        actionLabel: "Escalate"
      });
    }
    if (lead.status === "lost") {
      push(lead, {
        type: "lost_win_back",
        priority: int(lead.quotedAmountPaise, 0) >= 100000 ? "high" : "medium",
        title: "Lost lead win-back",
        description: lead.lostReason ? `Lost reason: ${lead.lostReason}` : "Create a win-back reminder and outreach note.",
        action: "win_back",
        actionLabel: "Win-back"
      });
    }
  }
  const rank = { urgent: 0, high: 1, medium: 2, low: 3, normal: 4 };
  return queue
    .sort((left, right) => (rank[left.priority] ?? 5) - (rank[right.priority] ?? 5) || right.leadScore - left.leadScore)
    .slice(0, 100);
}

function automationSummary(queue = []) {
  const count = (type) => queue.filter((item) => item.type === type).length;
  return {
    total: queue.length,
    urgent: queue.filter((item) => item.priority === "urgent").length,
    high: queue.filter((item) => item.priority === "high").length,
    autoFollowUps: count("auto_follow_up"),
    overdueAlerts: count("overdue_alert"),
    staffAssignments: count("staff_assignment"),
    managerEscalations: count("manager_escalation"),
    lostWinBack: count("lost_win_back"),
    hotSla: count("hot_sla")
  };
}

function intelligenceReports(rows = [], followUpRows = [], stageRows = []) {
  const won = rows.filter((row) => row.status === "won");
  const lost = rows.filter((row) => row.status === "lost");
  const open = rows.filter((row) => row.status !== "won" && row.status !== "lost");

  const sourceRoi = [...new Set(rows.map((row) => text(row.source) || "Unknown"))].map((source) => {
    const sourceRows = rows.filter((row) => (text(row.source) || "Unknown") === source);
    const sourceWon = sourceRows.filter((row) => row.status === "won");
    const sourceLost = sourceRows.filter((row) => row.status === "lost");
    const wonRevenuePaise = sourceWon.reduce((sum, row) => sum + leadRevenuePaise(row), 0);
    return {
      source,
      leadCount: sourceRows.length,
      wonCount: sourceWon.length,
      lostCount: sourceLost.length,
      openCount: sourceRows.length - sourceWon.length - sourceLost.length,
      conversionRate: percent(sourceWon.length, sourceRows.length),
      wonRevenue: rupeesFromPaise(wonRevenuePaise),
      pipelineValue: rupeesFromPaise(sourceRows.filter((row) => row.status !== "lost").reduce((sum, row) => sum + leadRevenuePaise(row), 0)),
      averageScore: sourceRows.length ? Math.round(sourceRows.reduce((sum, row) => sum + int(row.leadScore, 0), 0) / sourceRows.length) : 0,
      needsAttention: sourceRows.filter((row) => row.needsAttention).length,
      revenuePerLead: sourceRows.length ? rupeesFromPaise(wonRevenuePaise) / sourceRows.length : 0
    };
  }).sort((left, right) => right.wonRevenue - left.wonRevenue || right.conversionRate - left.conversionRate)
    .map((row, index) => ({ ...row, revenuePerLead: Math.round(row.revenuePerLead), roiRank: index + 1 }));

  const staffConversion = [...new Set(rows.map((row) => text(row.assignedName || row.assignedTo) || "Unassigned"))].map((staff) => {
    const staffRows = rows.filter((row) => (text(row.assignedName || row.assignedTo) || "Unassigned") === staff);
    const staffWon = staffRows.filter((row) => row.status === "won");
    const staffLost = staffRows.filter((row) => row.status === "lost");
    const leadIds = new Set(staffRows.map((row) => row.id));
    const overdueFollowUps = followUpRows.filter((row) => leadIds.has(row.leadId) && Date.parse(row.dueAt) < Date.now() && row.status !== "done").length;
    const convertedHours = staffWon
      .map((row) => Math.max(0, Date.parse(row.wonAt || row.updatedAt) - Date.parse(row.createdAt)) / 3600000)
      .filter((value) => Number.isFinite(value));
    return {
      staff,
      assignedTo: staffRows.find((row) => text(row.assignedTo))?.assignedTo || "",
      leadCount: staffRows.length,
      wonCount: staffWon.length,
      lostCount: staffLost.length,
      openCount: staffRows.length - staffWon.length - staffLost.length,
      conversionRate: percent(staffWon.length, staffRows.length),
      hotLeadCount: staffRows.filter((row) => row.leadTemperature === "hot").length,
      needsAttention: staffRows.filter((row) => row.needsAttention).length,
      overdueFollowUps,
      wonRevenue: rupeesFromPaise(staffWon.reduce((sum, row) => sum + leadRevenuePaise(row), 0)),
      averageConversionHours: convertedHours.length ? Math.round(convertedHours.reduce((sum, value) => sum + value, 0) / convertedHours.length) : 0
    };
  }).sort((left, right) => right.wonRevenue - left.wonRevenue || right.conversionRate - left.conversionRate);

  const stageOrder = stageRows.length
    ? stageRows.map((stage) => stage.name)
    : [...new Set(rows.map((row) => row.stageName || row.status || "Open"))];
  const missingStages = [...new Set(rows.map((row) => row.stageName || row.status || "Open"))].filter((name) => !stageOrder.includes(name));
  const funnelConversion = [...stageOrder, ...missingStages].filter(Boolean).map((stageName, index, list) => {
    const stageRowsForName = rows.filter((row) => (row.stageName || row.status || "Open") === stageName);
    const wonCount = stageRowsForName.filter((row) => row.status === "won").length;
    const lostCount = stageRowsForName.filter((row) => row.status === "lost").length;
    const previousCount = index ? rows.filter((row) => (row.stageName || row.status || "Open") === list[index - 1]).length : stageRowsForName.length;
    const dropOffCount = Math.max(0, previousCount - stageRowsForName.length);
    return {
      stage: stageName,
      sortOrder: stageRows.find((stage) => stage.name === stageName)?.sortOrder ?? index,
      leadCount: stageRowsForName.length,
      openCount: stageRowsForName.length - wonCount - lostCount,
      wonCount,
      lostCount,
      conversionRate: percent(wonCount, stageRowsForName.length),
      dropOffCount,
      dropOffRate: percent(dropOffCount, previousCount),
      revenue: rupeesFromPaise(stageRowsForName.filter((row) => row.status === "won").reduce((sum, row) => sum + leadRevenuePaise(row), 0))
    };
  }).sort((left, right) => left.sortOrder - right.sortOrder);

  const lostReasonAnalysis = [...new Set(lost.map((row) => text(row.lostReason) || "Unspecified"))].map((reason) => {
    const reasonRows = lost.filter((row) => (text(row.lostReason) || "Unspecified") === reason);
    const topSource = labelCounts(reasonRows, "source")[0]?.[0] || "-";
    const topStaff = labelCounts(reasonRows, "assignedName")[0]?.[0] || "-";
    return {
      reason,
      lostCount: reasonRows.length,
      lostOpportunity: rupeesFromPaise(reasonRows.reduce((sum, row) => sum + int(row.quotedAmountPaise || row.convertedAmountPaise, 0), 0)),
      averageScore: reasonRows.length ? Math.round(reasonRows.reduce((sum, row) => sum + int(row.leadScore, 0), 0) / reasonRows.length) : 0,
      topSource,
      topStaff
    };
  }).sort((left, right) => right.lostOpportunity - left.lostOpportunity || right.lostCount - left.lostCount);

  const wonRevenuePaise = won.reduce((sum, row) => sum + leadRevenuePaise(row), 0);
  const unlinkedWonRows = won.filter((row) => !text(row.invoiceId) && !text(row.appointmentId));
  const revenueAttribution = {
    wonLeadCount: won.length,
    wonRevenue: rupeesFromPaise(wonRevenuePaise),
    averageWonRevenue: won.length ? Math.round(rupeesFromPaise(wonRevenuePaise) / won.length) : 0,
    invoiceLinkedCount: won.filter((row) => text(row.invoiceId)).length,
    appointmentLinkedCount: won.filter((row) => text(row.appointmentId)).length,
    unlinkedWonCount: unlinkedWonRows.length,
    unlinkedWonRevenue: rupeesFromPaise(unlinkedWonRows.reduce((sum, row) => sum + leadRevenuePaise(row), 0)),
    openPipelineValue: rupeesFromPaise(open.reduce((sum, row) => sum + int(row.quotedAmountPaise, 0), 0)),
    lostOpportunityValue: rupeesFromPaise(lost.reduce((sum, row) => sum + int(row.quotedAmountPaise || row.convertedAmountPaise, 0), 0)),
    topWonSource: labelCounts(won, "source")[0]?.[0] || "-"
  };

  const recommendations = reportRecommendations({ rows, sourceRoi, staffConversion, lostReasonAnalysis, revenueAttribution, followUpRows });
  return { sourceRoi, staffConversion, funnelConversion, lostReasonAnalysis, revenueAttribution, recommendations };
}

function csvEscape(value) {
  const raw = String(value ?? "");
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function parseCsv(csv = "") {
  const rows = [];
  let current = "";
  let row = [];
  let quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

class LeadManagementService {
  overview(query = {}, access = {}) {
    const scoped = scope(access);
    ensureDefaults(scoped);
    const rows = queryLeads(scoped, query);
    const stageRows = stages(scoped, true);
    const followUpRows = followUps(scoped, { ...query, limit: 500 });
    const managerAttention = managerAttentionRows(rows);
    const automationQueue = leadAutomationQueue(rows, followUpRows);
    const columns = stageRows.filter((stage) => stage.active).map((stage) => ({
      ...stage,
      leads: rows.filter((lead) => lead.stageId === stage.id)
    }));
    return {
      stages: stageRows,
      types: types(scoped, true),
      rows,
      columns,
      followUps: followUpRows,
      summary: {
        total: rows.length,
        overdue: followUpRows.filter((row) => Date.parse(row.dueAt) < Date.now() && row.status !== "done").length,
        today: followUpRows.filter((row) => String(row.dueAt || "").slice(0, 10) === todayIso()).length,
        upcoming: followUpRows.filter((row) => Date.parse(row.dueAt) > Date.now()).length,
        won: rows.filter((row) => row.status === "won").length,
        lost: rows.filter((row) => row.status === "lost").length,
        needsAttention: managerAttention.length,
        urgentAttention: managerAttention.filter((row) => row.attentionPriority === "urgent").length
      },
      managerAttention,
      automationQueue,
      automationSummary: automationSummary(automationQueue),
      cards: reportCards(rows, followUpRows),
      reports: this.reports(query, scoped)
    };
  }

  list(query = {}, access = {}) {
    return { rows: queryLeads(scope(access), query), stages: stages(access), types: types(access) };
  }

  create(payload = {}, access = {}) {
    const scoped = assertWrite(access);
    ensureDefaults(scoped);
    if (!text(payload.title)) throw badRequest("Lead title is required");
    if (!text(payload.customerName || payload.name)) throw badRequest("Customer name is required");
    if (!normalizePhone(payload.phone || payload.contact)) throw badRequest("Customer phone is required");
    const stage = findStage(scoped, payload.stageId || payload.stageName);
    const type = findType(scoped, payload.typeId || payload.typeName || payload.leadType);
    const match = clientMatch(scoped, { phone: payload.phone || payload.contact, email: payload.email });
    const base = {
      id: id("lead"),
      tenantId: scoped.tenantId,
      branchId: text(payload.branchId) || scoped.branchId,
      title: text(payload.title),
      quotedAmountPaise: moneyPaise(payload),
      convertedAmountPaise: 0,
      currency: text(payload.currency || "INR").toUpperCase(),
      customerName: text(payload.customerName || payload.name),
      phone: normalizePhone(payload.phone || payload.contact),
      email: text(payload.email).toLowerCase(),
      clientId: text(payload.clientId) || match.clientId || "",
      typeId: type?.id || "",
      typeName: type?.name || text(payload.typeName || payload.leadType || ""),
      stageId: stage?.id || "",
      stageName: stage?.name || "",
      assignedTo: text(payload.assignedTo || payload.staffId),
      assignedName: text(payload.assignedName) || staffName(scoped, payload.assignedTo || payload.staffId),
      source: text(payload.source),
      followUpAt: text(payload.followUpAt || payload.followUpDateTime || payload.followUpDate),
      notes: text(payload.notes),
      status: stageStatus(stage),
      wonAt: "",
      lostAt: "",
      lostReason: "",
      invoiceId: "",
      appointmentId: "",
      createdBy: scoped.userId,
      updatedBy: scoped.userId,
      createdAt: now(),
      updatedAt: now()
    };
    const scored = computeScore(base, match);
    const row = { ...base, ...scored, slaStatus: slaStatus(base) };
    db.prepare(`
      INSERT INTO leadRecords
        (id, tenantId, branchId, title, quotedAmountPaise, convertedAmountPaise, currency, customerName, phone, email, clientId, typeId, typeName, stageId, stageName, assignedTo, assignedName, source, followUpAt, notes, leadScore, leadTemperature, slaStatus, status, wonAt, lostAt, lostReason, invoiceId, appointmentId, createdBy, updatedBy, createdAt, updatedAt)
      VALUES
        (@id, @tenantId, @branchId, @title, @quotedAmountPaise, @convertedAmountPaise, @currency, @customerName, @phone, @email, @clientId, @typeId, @typeName, @stageId, @stageName, @assignedTo, @assignedName, @source, @followUpAt, @notes, @leadScore, @leadTemperature, @slaStatus, @status, @wonAt, @lostAt, @lostReason, @invoiceId, @appointmentId, @createdBy, @updatedBy, @createdAt, @updatedAt)
    `).run(row);
    if (row.notes) this.addNote(row.id, { note: row.notes, noteType: "initial" }, scoped);
    if (row.followUpAt) this.addFollowUp(row.id, { dueAt: row.followUpAt, note: "Initial follow-up" }, scoped);
    insertEvent(scoped, { leadId: row.id, action: "lead.created", afterPayload: { ...mapLead(row), duplicateWarning: match.duplicateWarning }, status: match.duplicateWarning ? "warning" : "recorded" });
    return { lead: mapLead(row), duplicateWarning: match.duplicateWarning, clientMatches: match.matches || [] };
  }

  detail(leadId, access = {}) {
    const scoped = scope(access);
    ensureDefaults(scoped);
    const rawLead = mapLead(leadById(scoped, leadId));
    const match = clientMatch(scoped, rawLead);
    const lead = decorateLeadIntelligence(rawLead, match);
    const notes = db.prepare("SELECT * FROM leadNotes WHERE tenantId = @tenantId AND branchId = @branchId AND leadId = @leadId ORDER BY createdAt DESC").all({ tenantId: scoped.tenantId, branchId: scoped.branchId, leadId }).map((row) => ({ ...row }));
    const leadFollowUps = db.prepare("SELECT * FROM leadFollowUps WHERE tenantId = @tenantId AND branchId = @branchId AND leadId = @leadId ORDER BY dueAt DESC").all({ tenantId: scoped.tenantId, branchId: scoped.branchId, leadId }).map(mapFollowUp);
    const events = db.prepare("SELECT * FROM leadEvents WHERE tenantId = @tenantId AND branchId = @branchId AND leadId = @leadId ORDER BY createdAt DESC LIMIT 100").all({ tenantId: scoped.tenantId, branchId: scoped.branchId, leadId }).map(mapEvent);
    return { lead, notes, followUps: leadFollowUps, events, communicationTimeline: communicationTimeline(notes, leadFollowUps, events), clientMatch: match, businessLinks: leadBusinessLinks(scoped, lead), stages: stages(scoped), types: types(scoped) };
  }

  update(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const before = leadById(scoped, leadId);
    const stage = payload.stageId || payload.stageName ? findStage(scoped, payload.stageId || payload.stageName) : null;
    const type = payload.typeId || payload.typeName ? findType(scoped, payload.typeId || payload.typeName) : null;
    const next = {
      ...before,
      title: text(payload.title ?? before.title),
      quotedAmountPaise: payload.quotedAmountPaise !== undefined || payload.quotedAmount !== undefined ? moneyPaise(payload) : int(before.quotedAmountPaise, 0),
      currency: text(payload.currency ?? before.currency).toUpperCase(),
      customerName: text(payload.customerName ?? before.customerName),
      phone: normalizePhone(payload.phone ?? before.phone),
      email: text(payload.email ?? before.email).toLowerCase(),
      typeId: type ? type.id : before.typeId,
      typeName: type ? type.name : before.typeName,
      stageId: stage ? stage.id : before.stageId,
      stageName: stage ? stage.name : before.stageName,
      assignedTo: text(payload.assignedTo ?? before.assignedTo),
      assignedName: text(payload.assignedName) || staffName(scoped, payload.assignedTo) || before.assignedName,
      source: text(payload.source ?? before.source),
      followUpAt: text(payload.followUpAt ?? before.followUpAt),
      notes: text(payload.notes ?? before.notes),
      status: stage ? stageStatus(stage) : before.status,
      updatedBy: scoped.userId,
      updatedAt: now()
    };
    const scored = computeScore(next, clientMatch(scoped, next));
    Object.assign(next, scored, { slaStatus: slaStatus(next) });
    db.prepare(`
      UPDATE leadRecords
      SET title = @title, quotedAmountPaise = @quotedAmountPaise, currency = @currency, customerName = @customerName, phone = @phone, email = @email,
          typeId = @typeId, typeName = @typeName, stageId = @stageId, stageName = @stageName, assignedTo = @assignedTo, assignedName = @assignedName,
          source = @source, followUpAt = @followUpAt, notes = @notes, leadScore = @leadScore, leadTemperature = @leadTemperature, slaStatus = @slaStatus,
          status = @status, updatedBy = @updatedBy, updatedAt = @updatedAt
      WHERE id = @id AND tenantId = @tenantId AND branchId = @branchId
    `).run(next);
    insertEvent(scoped, { leadId, action: "lead.updated", beforePayload: mapLead(before), afterPayload: mapLead(next) });
    return this.detail(leadId, scoped);
  }

  moveStage(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const before = leadById(scoped, leadId);
    const stage = findStage(scoped, payload.stageId || payload.stageName);
    if (!stage) throw badRequest("Valid stage is required");
    const stamp = now();
    db.prepare(`
      UPDATE leadRecords
      SET stageId = @stageId, stageName = @stageName, status = @status, wonAt = @wonAt, lostAt = @lostAt, updatedBy = @updatedBy, updatedAt = @updatedAt
      WHERE id = @id AND tenantId = @tenantId AND branchId = @branchId
    `).run({
      id: leadId,
      tenantId: scoped.tenantId,
      branchId: scoped.branchId,
      stageId: stage.id,
      stageName: stage.name,
      status: stageStatus(stage),
      wonAt: stage.isWon ? stamp : before.wonAt || "",
      lostAt: stage.isLost ? stamp : before.lostAt || "",
      updatedBy: scoped.userId,
      updatedAt: stamp
    });
    const after = leadById(scoped, leadId);
    insertEvent(scoped, { leadId, action: "lead.stage_changed", fromStageId: before.stageId, toStageId: stage.id, beforePayload: mapLead(before), afterPayload: mapLead(after) });
    return this.detail(leadId, scoped);
  }

  linkClient(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const before = leadById(scoped, leadId);
    const match = clientMatch(scoped, before);
    const clientId = text(payload.clientId) || match.clientId;
    if (!clientId) throw badRequest("clientId is required");
    const client = clientById(scoped, clientId);
    if (!client) throw badRequest("Client not found");
    updateLeadLinks(scoped, leadId, { clientId });
    const after = leadById(scoped, leadId);
    insertEvent(scoped, { leadId, action: "lead.client_linked", beforePayload: mapLead(before), afterPayload: { clientId, clientName: client.name || "", clientPhone: client.phone || "" } });
    this.addNote(leadId, { note: `Client linked: ${client.name || clientId}`, noteType: "client_link" }, scoped);
    return this.detail(leadId, scoped);
  }

  createClientFromLead(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const before = leadById(scoped, leadId);
    if (!tableExists("clients")) throw badRequest("Clients table is not available");
    const match = clientMatch(scoped, before);
    if (match.clientId && !payload.forceCreate) return this.linkClient(leadId, { clientId: match.clientId }, scoped);
    if (match.duplicateWarning && !payload.forceCreate) throw badRequest(match.duplicateWarning);
    const columns = columnSet("clients");
    const stamp = now();
    const row = {};
    putColumn(row, columns, ["id"], id("client"));
    putColumn(row, columns, ["tenantId"], scoped.tenantId);
    putColumn(row, columns, ["branchId"], before.branchId || scoped.branchId);
    putColumn(row, columns, ["name"], text(payload.name || before.customerName || before.title));
    putColumn(row, columns, ["phone"], normalizePhone(payload.phone || before.phone));
    putColumn(row, columns, ["email"], text(payload.email || before.email).toLowerCase());
    putColumn(row, columns, ["notes"], text(payload.notes || before.notes || `Created from lead ${before.title || before.id}`));
    putColumn(row, columns, ["tags"], JSON.stringify(["lead-converted"]));
    putColumn(row, columns, ["createdAt"], stamp);
    putColumn(row, columns, ["updatedAt"], stamp);
    putColumn(row, columns, ["totalSpend"], 0);
    putColumn(row, columns, ["visitCount"], 0);
    if (!row.name) throw badRequest("Client name is required");
    if (!row.phone) throw badRequest("Client phone is required");
    insertDynamic("clients", row);
    updateLeadLinks(scoped, leadId, { clientId: row.id });
    insertEvent(scoped, { leadId, action: "lead.client_created", beforePayload: mapLead(before), afterPayload: { clientId: row.id, clientName: row.name } });
    this.addNote(leadId, { note: `Client created from lead: ${row.name}`, noteType: "client_create" }, scoped);
    return this.detail(leadId, scoped);
  }

  bookAppointmentFromLead(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const before = leadById(scoped, leadId);
    if (!tableExists("appointments")) throw badRequest("Appointments table is not available");
    let clientId = text(before.clientId);
    if (!clientId) {
      const match = clientMatch(scoped, before);
      if (match.clientId) {
        updateLeadLinks(scoped, leadId, { clientId: match.clientId });
        clientId = match.clientId;
      } else {
        const created = this.createClientFromLead(leadId, { forceCreate: payload.forceCreateClient !== false }, scoped);
        clientId = text(created.lead?.clientId);
      }
    }
    if (!clientId) throw badRequest("Client link is required before booking");
    const startAt = text(payload.startAt || payload.appointmentAt);
    if (!startAt) throw badRequest("Appointment startAt is required");
    const durationMinutes = Math.max(15, int(payload.durationMinutes, 60));
    const startTime = Date.parse(startAt);
    const endAt = Number.isFinite(startTime) ? new Date(startTime + durationMinutes * 60000).toISOString() : "";
    const staffId = text(payload.staffId || before.assignedTo) || firstStaffId(scoped, before.branchId || scoped.branchId);
    if (!staffId) throw badRequest("Staff is required before booking");
    const serviceIds = Array.isArray(payload.serviceIds)
      ? payload.serviceIds.filter(Boolean)
      : text(payload.serviceId || before.typeId)
        ? [text(payload.serviceId || before.typeId)]
        : [];
    const columns = columnSet("appointments");
    const stamp = now();
    const row = {};
    putColumn(row, columns, ["id"], id("appt"));
    putColumn(row, columns, ["tenantId"], scoped.tenantId);
    putColumn(row, columns, ["clientId"], clientId);
    putColumn(row, columns, ["staffId"], staffId);
    putColumn(row, columns, ["branchId"], before.branchId || scoped.branchId);
    putColumn(row, columns, ["serviceIds"], JSON.stringify(serviceIds));
    putColumn(row, columns, ["startAt"], startAt);
    putColumn(row, columns, ["endAt"], endAt);
    putColumn(row, columns, ["status"], text(payload.status || "booked"));
    putColumn(row, columns, ["source"], "lead-management");
    putColumn(row, columns, ["notes"], text(payload.notes || `Booked from lead ${before.title || before.id}`));
    putColumn(row, columns, ["billable"], 1);
    putColumn(row, columns, ["createdAt"], stamp);
    putColumn(row, columns, ["updatedAt"], stamp);
    insertDynamic("appointments", row);
    updateLeadLinks(scoped, leadId, { clientId, appointmentId: row.id });
    insertEvent(scoped, { leadId, action: "lead.appointment_booked", beforePayload: mapLead(before), afterPayload: { appointmentId: row.id, clientId, staffId, startAt } });
    this.addNote(leadId, { note: `Appointment booked from lead: ${startAt}`, noteType: "appointment_booked" }, scoped);
    return { ...this.detail(leadId, scoped), appointment: row };
  }

  linkInvoice(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const before = leadById(scoped, leadId);
    const invoice = invoiceByRef(scoped, payload.invoiceId || payload.invoiceNumber || payload.ref);
    if (!invoice) throw badRequest("Invoice not found");
    const wonStage = stages(scoped, true).find((stage) => stage.isWon) || findStage(scoped, "Won");
    const clientId = invoiceClientId(invoice) || before.clientId || "";
    const appointmentId = text(payload.appointmentId) || appointmentFromInvoice(scoped, invoice) || before.appointmentId || "";
    const convertedAmountPaise = payload.convertedAmountPaise !== undefined ? int(payload.convertedAmountPaise, 0) : invoiceAmountPaise(invoice) || int(before.convertedAmountPaise || before.quotedAmountPaise, 0);
    const stamp = now();
    db.prepare(`
      UPDATE leadRecords
      SET status = 'won', stageId = @stageId, stageName = @stageName, clientId = @clientId,
          invoiceId = @invoiceId, appointmentId = @appointmentId, convertedAmountPaise = @convertedAmountPaise,
          wonAt = COALESCE(NULLIF(wonAt, ''), @wonAt), updatedBy = @updatedBy, updatedAt = @updatedAt
      WHERE id = @id AND tenantId = @tenantId AND branchId = @branchId
    `).run({
      id: leadId,
      tenantId: scoped.tenantId,
      branchId: scoped.branchId,
      stageId: wonStage?.id || before.stageId,
      stageName: wonStage?.name || before.stageName || "Won",
      clientId,
      invoiceId: invoice.id,
      appointmentId,
      convertedAmountPaise,
      wonAt: stamp,
      updatedBy: scoped.userId,
      updatedAt: stamp
    });
    const after = leadById(scoped, leadId);
    insertEvent(scoped, { leadId, action: "lead.invoice_linked", beforePayload: mapLead(before), afterPayload: { invoiceId: invoice.id, invoiceNumber: invoiceLabel(invoice), convertedAmountPaise } });
    this.addNote(leadId, { note: `Invoice linked: ${invoiceLabel(invoice)}`, noteType: "invoice_link" }, scoped);
    return this.detail(leadId, scoped);
  }

  addNote(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const lead = leadById(scoped, leadId);
    const note = text(payload.note || payload.body);
    if (!note) throw badRequest("Note is required");
    const row = { id: id("lead_note"), tenantId: scoped.tenantId, branchId: lead.branchId, leadId, note, noteType: text(payload.noteType || "note"), createdBy: scoped.userId, createdAt: now() };
    db.prepare(`
      INSERT INTO leadNotes (id, tenantId, branchId, leadId, note, noteType, createdBy, createdAt)
      VALUES (@id, @tenantId, @branchId, @leadId, @note, @noteType, @createdBy, @createdAt)
    `).run(row);
    insertEvent(scoped, { leadId, action: "lead.note_added", afterPayload: row });
    return { note: row };
  }

  addFollowUp(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const lead = leadById(scoped, leadId);
    const dueAt = text(payload.dueAt || payload.followUpAt);
    if (!dueAt) throw badRequest("Follow-up dueAt is required");
    const row = {
      id: id("lead_fu"),
      tenantId: scoped.tenantId,
      branchId: lead.branchId,
      leadId,
      dueAt,
      note: text(payload.note),
      status: text(payload.status || "pending"),
      completedAt: "",
      createdBy: scoped.userId,
      createdAt: now(),
      updatedAt: now()
    };
    db.prepare(`
      INSERT INTO leadFollowUps (id, tenantId, branchId, leadId, dueAt, note, status, completedAt, createdBy, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @leadId, @dueAt, @note, @status, @completedAt, @createdBy, @createdAt, @updatedAt)
    `).run(row);
    db.prepare("UPDATE leadRecords SET followUpAt = @followUpAt, slaStatus = @slaStatus, updatedAt = @updatedAt WHERE id = @id AND tenantId = @tenantId AND branchId = @branchId").run({
      id: leadId,
      tenantId: scoped.tenantId,
      branchId: scoped.branchId,
      followUpAt: dueAt,
      slaStatus: slaStatus({ ...lead, followUpAt: dueAt }),
      updatedAt: now()
    });
    insertEvent(scoped, { leadId, action: "lead.follow_up_added", afterPayload: row });
    return { followUp: mapFollowUp(row) };
  }

  completeFollowUp(leadId, followUpId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const lead = leadById(scoped, leadId);
    const row = db.prepare(`
      SELECT * FROM leadFollowUps
      WHERE id = @id AND leadId = @leadId AND tenantId = @tenantId AND branchId = @branchId
      LIMIT 1
    `).get({ id: followUpId, leadId, tenantId: scoped.tenantId, branchId: lead.branchId });
    if (!row) throw notFound("Follow-up not found");
    const stamp = now();
    db.prepare(`
      UPDATE leadFollowUps
      SET status = 'done', completedAt = @completedAt, updatedAt = @updatedAt
      WHERE id = @id AND leadId = @leadId AND tenantId = @tenantId AND branchId = @branchId
    `).run({ id: followUpId, leadId, tenantId: scoped.tenantId, branchId: lead.branchId, completedAt: stamp, updatedAt: stamp });
    const next = db.prepare(`
      SELECT dueAt FROM leadFollowUps
      WHERE leadId = @leadId AND tenantId = @tenantId AND branchId = @branchId AND status != 'done'
      ORDER BY datetime(dueAt) ASC LIMIT 1
    `).get({ leadId, tenantId: scoped.tenantId, branchId: lead.branchId });
    db.prepare("UPDATE leadRecords SET followUpAt = @followUpAt, slaStatus = @slaStatus, updatedAt = @updatedAt WHERE id = @id AND tenantId = @tenantId AND branchId = @branchId").run({
      id: leadId,
      tenantId: scoped.tenantId,
      branchId: lead.branchId,
      followUpAt: next?.dueAt || "",
      slaStatus: slaStatus({ ...lead, followUpAt: next?.dueAt || "" }),
      updatedAt: stamp
    });
    if (payload.note) this.addNote(leadId, { note: payload.note, noteType: "follow_up_done" }, scoped);
    insertEvent(scoped, { leadId, action: "lead.follow_up_completed", afterPayload: { followUpId, note: text(payload.note) } });
    return this.detail(leadId, scoped);
  }

  assignLead(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const before = leadById(scoped, leadId);
    const assignedTo = text(payload.assignedTo || payload.staffId) || firstStaffId(scoped, before.branchId || scoped.branchId);
    if (!assignedTo) throw badRequest("assignedTo is required");
    const assignedName = text(payload.assignedName) || staffName(scoped, assignedTo) || assignedTo;
    updateLeadLinks(scoped, leadId, { assignedTo, assignedName });
    const after = leadById(scoped, leadId);
    insertEvent(scoped, { leadId, action: "lead.assigned", beforePayload: mapLead(before), afterPayload: { assignedTo, assignedName, reason: text(payload.note || "Assigned by lead automation") } });
    this.addNote(leadId, { note: text(payload.note || `Assigned to ${assignedName}`), noteType: "staff_assignment" }, scoped);
    return this.detail(leadId, scoped);
  }

  escalateLead(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const lead = leadById(scoped, leadId);
    const note = text(payload.note || `Manager escalation: ${lead.customerName || lead.title} needs review.`);
    this.addNote(leadId, { note, noteType: "manager_escalation" }, scoped);
    insertEvent(scoped, { leadId, action: "lead.manager_escalated", afterPayload: { note, priority: text(payload.priority || "high") }, status: "attention" });
    return this.detail(leadId, scoped);
  }

  createWinBack(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const lead = leadById(scoped, leadId);
    const dueAt = text(payload.dueAt) || hoursFromNow(72);
    const note = text(payload.note || `Win-back follow-up for lost lead. Reason: ${lead.lostReason || "not captured"}`);
    this.addFollowUp(leadId, { dueAt, note, status: "pending" }, scoped);
    this.addNote(leadId, { note, noteType: "win_back" }, scoped);
    insertEvent(scoped, { leadId, action: "lead.win_back_created", afterPayload: { dueAt, note } });
    return this.detail(leadId, scoped);
  }

  automationQueue(query = {}, access = {}) {
    const scoped = scope(access);
    const rows = queryLeads(scoped, { ...query, limit: 500 });
    const followUpRows = followUps(scoped, { ...query, limit: 500 });
    const queue = leadAutomationQueue(rows, followUpRows);
    return { generatedAt: now(), summary: automationSummary(queue), queue };
  }

  runAutomation(payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const query = payload.query || {};
    const queue = payload.leadId
      ? leadAutomationQueue(queryLeads(scoped, { ...query, limit: 500 }).filter((row) => row.id === payload.leadId), followUps(scoped, { ...query, limit: 500 }))
      : this.automationQueue(query, scoped).queue;
    const selected = queue
      .filter((item) => !payload.type || item.type === payload.type)
      .filter((item) => !payload.leadId || item.leadId === payload.leadId)
      .slice(0, Math.min(25, Math.max(1, int(payload.limit, payload.leadId ? 1 : 10))));
    const results = [];
    for (const item of selected) {
      try {
        if (item.action === "assign_owner") {
          results.push({ item, result: this.assignLead(item.leadId, { assignedTo: payload.assignedTo, note: "Assigned by Stage 5 automation" }, scoped) });
        } else if (item.action === "complete_follow_up" && item.followUpId) {
          results.push({ item, result: this.completeFollowUp(item.leadId, item.followUpId, { note: "Completed from automation queue" }, scoped) });
        } else if (item.action === "schedule_follow_up") {
          results.push({ item, result: this.addFollowUp(item.leadId, { dueAt: payload.dueAt || hoursFromNow(24), note: "Auto follow-up reminder from lead automation" }, scoped) });
        } else if (item.action === "hot_sla_response") {
          results.push({ item, result: this.addFollowUp(item.leadId, { dueAt: payload.dueAt || hoursFromNow(2), note: "Hot lead SLA response required" }, scoped) });
          insertEvent(scoped, { leadId: item.leadId, action: "lead.hot_sla_task_created", afterPayload: item, status: "attention" });
        } else if (item.action === "escalate_manager") {
          results.push({ item, result: this.escalateLead(item.leadId, { note: item.description, priority: item.priority }, scoped) });
        } else if (item.action === "win_back") {
          results.push({ item, result: this.createWinBack(item.leadId, { dueAt: payload.dueAt || hoursFromNow(72), note: item.description }, scoped) });
        }
        insertEvent(scoped, { leadId: item.leadId, action: "lead.automation_run", afterPayload: { type: item.type, action: item.action }, status: "recorded" });
      } catch (error) {
        results.push({ item, error: error.message });
      }
    }
    return { processed: results.length, results, queue: this.automationQueue(query, scoped) };
  }

  markWon(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const before = leadById(scoped, leadId);
    const convertedAmountPaise = payload.convertedAmountPaise !== undefined ? int(payload.convertedAmountPaise, 0) : Math.round(Number(payload.convertedAmount || before.quotedAmountPaise / 100 || 0) * 100);
    if (!convertedAmountPaise && !payload.invoiceId && !payload.appointmentId && !payload.note) throw badRequest("Converted amount or reference note is required");
    const wonStage = stages(scoped, true).find((stage) => stage.isWon) || findStage(scoped, "Won");
    const stamp = now();
    db.prepare(`
      UPDATE leadRecords
      SET status = 'won', stageId = @stageId, stageName = @stageName, convertedAmountPaise = @convertedAmountPaise,
          wonAt = @wonAt, invoiceId = @invoiceId, appointmentId = @appointmentId, updatedBy = @updatedBy, updatedAt = @updatedAt
      WHERE id = @id AND tenantId = @tenantId AND branchId = @branchId
    `).run({
      id: leadId,
      tenantId: scoped.tenantId,
      branchId: scoped.branchId,
      stageId: wonStage?.id || before.stageId,
      stageName: wonStage?.name || "Won",
      convertedAmountPaise,
      wonAt: stamp,
      invoiceId: text(payload.invoiceId),
      appointmentId: text(payload.appointmentId),
      updatedBy: scoped.userId,
      updatedAt: stamp
    });
    const after = leadById(scoped, leadId);
    insertEvent(scoped, { leadId, action: "lead.marked_won_opportunity", beforePayload: mapLead(before), afterPayload: { ...mapLead(after), note: text(payload.note) } });
    return this.detail(leadId, scoped);
  }

  markLost(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const reason = text(payload.lostReason || payload.reason || payload.note);
    if (!reason) throw badRequest("Lost reason is required");
    const before = leadById(scoped, leadId);
    const lostStage = stages(scoped, true).find((stage) => stage.isLost) || findStage(scoped, "Lost");
    const stamp = now();
    db.prepare(`
      UPDATE leadRecords
      SET status = 'lost', stageId = @stageId, stageName = @stageName, lostAt = @lostAt, lostReason = @lostReason, updatedBy = @updatedBy, updatedAt = @updatedAt
      WHERE id = @id AND tenantId = @tenantId AND branchId = @branchId
    `).run({ id: leadId, tenantId: scoped.tenantId, branchId: scoped.branchId, stageId: lostStage?.id || before.stageId, stageName: lostStage?.name || "Lost", lostAt: stamp, lostReason: reason, updatedBy: scoped.userId, updatedAt: stamp });
    const after = leadById(scoped, leadId);
    insertEvent(scoped, { leadId, action: "lead.marked_lost", beforePayload: mapLead(before), afterPayload: mapLead(after) });
    return this.detail(leadId, scoped);
  }

  whatsappDraft(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const lead = leadById(scoped, leadId);
    const body = text(payload.body || `Hi ${lead.customerName}, following up on your ${lead.title} inquiry.`);
    const draft = { id: id("lead_msg"), leadId, phone: lead.phone, body, status: "draft", channel: "whatsapp", createdAt: now() };
    insertEvent(scoped, { leadId, action: "lead.whatsapp_draft_created", afterPayload: draft });
    this.addNote(leadId, { note: `WhatsApp draft: ${body}`, noteType: "whatsapp_draft" }, scoped);
    return { message: draft };
  }

  whatsappSend(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const lead = leadById(scoped, leadId);
    const body = text(payload.body || `Hi ${lead.customerName}, following up on your ${lead.title} inquiry.`);
    const providerReady = tableExists("whatsapp_messages") && hasColumn("whatsapp_messages", "status");
    const status = providerReady ? "queued" : "send_blocked";
    let messageId = id("lead_msg");
    if (providerReady) {
      const row = {
        id: messageId,
        tenantId: scoped.tenantId,
        threadId: `lead_${leadId}`,
        clientId: lead.clientId || "",
        branchId: lead.branchId,
        direction: "outbound",
        eventType: "lead_follow_up",
        body,
        templateKey: "lead_follow_up",
        intent: "lead_follow_up",
        status,
        providerMessageId: "",
        metadata: toJson({ leadId, explicitAction: true }),
        createdAt: now(),
        updatedAt: now()
      };
      db.prepare(`
        INSERT INTO whatsapp_messages
          (id, tenantId, threadId, clientId, branchId, direction, eventType, body, templateKey, intent, status, providerMessageId, metadata, createdAt, updatedAt)
        VALUES
          (@id, @tenantId, @threadId, @clientId, @branchId, @direction, @eventType, @body, @templateKey, @intent, @status, @providerMessageId, @metadata, @createdAt, @updatedAt)
      `).run(row);
    }
    insertEvent(scoped, { leadId, action: "lead.whatsapp_send_requested", afterPayload: { messageId, body, status, explicitAction: true }, status });
    this.addNote(leadId, { note: `WhatsApp ${status}: ${body}`, noteType: "whatsapp_send" }, scoped);
    return { message: { id: messageId, leadId, phone: lead.phone, body, status } };
  }

  callLog(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const lead = leadById(scoped, leadId);
    const status = text(payload.status || payload.outcome || "attempted");
    const phone = normalizePhone(payload.phone || lead.phone);
    const body = text(payload.note) || `Call attempted: ${phone || lead.customerName || lead.title}`;
    const note = this.addNote(leadId, { note: body, noteType: "call_log" }, scoped).note;
    insertEvent(scoped, { leadId, action: "lead.call_logged", afterPayload: { noteId: note.id, phone, status, note: body }, status });
    return { log: { id: note.id, leadId, phone, status, note: body, channel: "call", createdAt: note.createdAt } };
  }

  emailLog(leadId, payload = {}, access = {}) {
    const scoped = assertWrite(access);
    const lead = leadById(scoped, leadId);
    const status = text(payload.status || "opened");
    const email = text(payload.email || lead.email).toLowerCase();
    const subject = text(payload.subject || `Follow-up for ${lead.title}`);
    const body = text(payload.note) || `Email opened: ${subject}${email ? ` (${email})` : ""}`;
    const note = this.addNote(leadId, { note: body, noteType: "email_action" }, scoped).note;
    insertEvent(scoped, { leadId, action: "lead.email_logged", afterPayload: { noteId: note.id, email, subject, status, note: body }, status });
    return { log: { id: note.id, leadId, email, subject, status, note: body, channel: "email", createdAt: note.createdAt } };
  }

  stages(query = {}, access = {}) {
    return { stages: stages(scope(access), query.includeInactive === "true" || query.includeInactive === true) };
  }

  saveStage(payload = {}, access = {}) {
    const scoped = assertOwnerOrManager(access);
    ensureDefaults(scoped);
    const name = text(payload.name);
    if (!name) throw badRequest("Stage name is required");
    const row = {
      id: text(payload.id) || id("lead_stage"),
      tenantId: scoped.tenantId,
      branchId: scoped.branchId,
      name,
      stageKey: key(payload.stageKey || name),
      sortOrder: int(payload.sortOrder, 100),
      color: text(payload.color),
      isWon: boolInt(payload.isWon),
      isLost: boolInt(payload.isLost),
      active: payload.active === undefined ? 1 : boolInt(payload.active),
      createdAt: now(),
      updatedAt: now()
    };
    db.prepare(`
      INSERT INTO leadStages (id, tenantId, branchId, name, stageKey, sortOrder, color, isWon, isLost, active, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @name, @stageKey, @sortOrder, @color, @isWon, @isLost, @active, @createdAt, @updatedAt)
      ON CONFLICT(tenantId, branchId, stageKey) DO UPDATE SET
        name = excluded.name, sortOrder = excluded.sortOrder, color = excluded.color, isWon = excluded.isWon, isLost = excluded.isLost, active = excluded.active, updatedAt = excluded.updatedAt
    `).run(row);
    return this.stages({ includeInactive: true }, scoped);
  }

  types(query = {}, access = {}) {
    return { types: types(scope(access), query.includeInactive === "true" || query.includeInactive === true) };
  }

  saveType(payload = {}, access = {}) {
    const scoped = assertOwnerOrManager(access);
    ensureDefaults(scoped);
    const name = text(payload.name);
    if (!name) throw badRequest("Lead type name is required");
    const row = { id: text(payload.id) || id("lead_type"), tenantId: scoped.tenantId, branchId: scoped.branchId, name, typeKey: key(payload.typeKey || name), active: payload.active === undefined ? 1 : boolInt(payload.active), createdAt: now(), updatedAt: now() };
    db.prepare(`
      INSERT INTO leadTypes (id, tenantId, branchId, name, typeKey, active, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @name, @typeKey, @active, @createdAt, @updatedAt)
      ON CONFLICT(tenantId, branchId, typeKey) DO UPDATE SET
        name = excluded.name, active = excluded.active, updatedAt = excluded.updatedAt
    `).run(row);
    return this.types({ includeInactive: true }, scoped);
  }

  followUps(query = {}, access = {}) {
    return { followUps: followUps(scope(access), query) };
  }

  sampleCsv() {
    const headers = ["title", "quotedAmount", "currency", "customerName", "phone", "email", "leadType", "stage", "assignedTo", "source", "followUpAt", "notes"];
    const row = ["Hair smoothening inquiry", "9000", "INR", "Aftab", "9820889915", "client@example.com", "Smoothening", "Lead In", "", "Google", `${todayIso()}T12:15:00`, "Imported lead sample"];
    return `${headers.join(",")}\n${row.map(csvEscape).join(",")}\n`;
  }

  importCsv(payload = {}, access = {}) {
    const scoped = assertWrite(access);
    ensureDefaults(scoped);
    const csv = text(payload.csv || payload.content);
    if (!csv) throw badRequest("CSV content is required");
    const rows = parseCsv(csv);
    if (rows.length < 2) throw badRequest("CSV must include header and at least one row");
    const headers = rows[0].map((item) => key(item));
    const result = { imported: [], skipped: [], duplicates: [] };
    for (const cells of rows.slice(1)) {
      const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
      try {
        const duplicate = clientMatch(scoped, { phone: record.phone, email: record.email });
        const created = this.create({
          title: record.title,
          quotedAmount: record.quotedamount,
          currency: record.currency,
          customerName: record.customername || record.name,
          phone: record.phone || record.contact,
          email: record.email,
          leadType: record.leadtype || record.type,
          stageName: record.stage,
          assignedTo: record.assignedto,
          source: record.source,
          followUpAt: record.followupat || record.followupdate,
          notes: record.notes
        }, scoped);
        result.imported.push(created.lead.id);
        if (duplicate.duplicateWarning || duplicate.clientId) result.duplicates.push({ leadId: created.lead.id, warning: duplicate.duplicateWarning || "Existing client matched" });
      } catch (error) {
        result.skipped.push({ row: record, error: error.message });
      }
    }
    const importRow = {
      id: id("lead_import"),
      tenantId: scoped.tenantId,
      branchId: scoped.branchId,
      fileName: text(payload.fileName || "lead-import.csv"),
      rowCount: rows.length - 1,
      importedCount: result.imported.length,
      skippedCount: result.skipped.length,
      duplicateCount: result.duplicates.length,
      errorCount: result.skipped.length,
      resultJson: toJson(result),
      createdBy: scoped.userId,
      createdAt: now()
    };
    db.prepare(`
      INSERT INTO leadImports (id, tenantId, branchId, fileName, rowCount, importedCount, skippedCount, duplicateCount, errorCount, resultJson, createdBy, createdAt)
      VALUES (@id, @tenantId, @branchId, @fileName, @rowCount, @importedCount, @skippedCount, @duplicateCount, @errorCount, @resultJson, @createdBy, @createdAt)
    `).run(importRow);
    return { import: importRow, result };
  }

  reports(query = {}, access = {}) {
    const scoped = scope(access);
    const rows = queryLeads(scoped, { ...query, limit: 500 });
    const followUpRows = followUps(scoped, { ...query, limit: 500 });
    const stageRows = stages(scoped, true);
    const intelligence = intelligenceReports(rows, followUpRows, stageRows);
    const won = rows.filter((row) => row.status === "won");
    const lost = rows.filter((row) => row.status === "lost");
    const conversionRate = rows.length ? Math.round((won.length / rows.length) * 100) : 0;
    const avgConversionHours = won.length
      ? Math.round(won.reduce((sum, row) => sum + Math.max(0, Date.parse(row.wonAt || row.updatedAt) - Date.parse(row.createdAt)), 0) / won.length / 3600000)
      : 0;
    const topSource = intelligence.sourceRoi[0]?.source || "-";
    const topStaff = intelligence.staffConversion[0]?.staff || "-";
    return {
      cards: reportCards(rows, followUpRows),
      bySource: grouped(rows, "source"),
      byStaff: grouped(rows, "assignedName"),
      byStage: grouped(rows, "stageName"),
      managerAttention: managerAttentionRows(rows),
      ...intelligence,
      summary: {
        totalLeads: rows.length,
        hotLeads: rows.filter((row) => row.leadTemperature === "hot").length,
        wonLeads: won.length,
        lostLeads: lost.length,
        conversionRate,
        overdueFollowUps: followUpRows.filter((row) => Date.parse(row.dueAt) < Date.now() && row.status !== "done").length,
        needsAttention: rows.filter((row) => row.needsAttention).length,
        revenueFromWonLeads: won.reduce((sum, row) => sum + int(row.convertedAmountPaise || row.quotedAmountPaise, 0), 0) / 100,
        revenueFromLeads: won.reduce((sum, row) => sum + int(row.convertedAmountPaise || row.quotedAmountPaise, 0), 0) / 100,
        averageTimeToConvertHours: avgConversionHours,
        openPipelineValue: intelligence.revenueAttribution.openPipelineValue,
        lostOpportunityValue: intelligence.revenueAttribution.lostOpportunityValue,
        topLeadSource: topSource,
        topStaff,
        sourceCount: intelligence.sourceRoi.length,
        staffCount: intelligence.staffConversion.length
      }
    };
  }
}

export const leadManagementService = new LeadManagementService();
