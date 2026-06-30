import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { ensureEngagementSchema } from "./engagement-schema.service.js";

const DEFAULT_LIMIT = 500;

function nowIso() {
  return new Date().toISOString();
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJson(value, fallback) {
  try {
    if (!value) return fallback;
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function tableExists(name) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = @name").get({ name }));
}

function tableColumns(name) {
  if (!tableExists(name)) return new Set();
  return new Set(db.prepare(`PRAGMA table_info(${name})`).all().map((row) => row.name));
}

function accessBranch(access = {}, query = {}) {
  return safeText(query.branchId || access.branchId || "");
}

function sourceLabel(source = "", channel = "") {
  const raw = `${source || channel || ""}`.toLowerCase();
  if (raw.includes("instagram")) return "Instagram";
  if (raw.includes("google")) return "Google Call";
  if (raw.includes("website") || raw.includes("widget")) return "Website";
  if (raw.includes("referral")) return "Referral";
  if (raw.includes("walk")) return "Walk-in";
  if (raw.includes("missed-call")) return "Google Call";
  if (raw.includes("whatsapp") || raw.includes("inbound") || channel === "whatsapp") return "WhatsApp";
  return source || channel || "Unknown";
}

function leadTemperature(score) {
  const value = number(score, 0);
  if (value >= 70) return "hot";
  if (value >= 40) return "warm";
  return "cold";
}

function statusFromSource(status = "") {
  const raw = String(status || "").toLowerCase();
  if (["won", "converted", "resolved"].includes(raw)) return "won";
  if (["lost", "closed_lost", "archived"].includes(raw)) return "lost";
  if (["waiting_for_client", "follow_up"].includes(raw)) return "follow_up";
  if (["pending", "open"].includes(raw)) return raw;
  return raw || "new";
}

function minutesBetween(start, end) {
  const from = Date.parse(start || "");
  const to = Date.parse(end || "");
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  return Math.round((to - from) / 60000);
}

function dueState(nextFollowUpDue) {
  if (!nextFollowUpDue) return "upcoming";
  const today = new Date();
  const due = new Date(nextFollowUpDue);
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  if (startDue < startToday) return "overdue";
  if (startDue === startToday) return "today";
  return "upcoming";
}

function rupee(value) {
  return Math.round(number(value, 0));
}

function latestActions(access, branchId) {
  ensureEngagementSchema();
  const rows = db.prepare(`
    SELECT *
    FROM engagementLeadActions
    WHERE tenantId = @tenantId
      AND (@branchId = '' OR branchId = @branchId OR branchId = '')
    ORDER BY datetime(createdAt) DESC
    LIMIT 5000
  `).all({ tenantId: access.tenantId, branchId });
  const byLead = new Map();
  const historyByLead = new Map();
  for (const row of rows) {
    if (!historyByLead.has(row.leadId)) historyByLead.set(row.leadId, []);
    historyByLead.get(row.leadId).push(row);
    if (!byLead.has(row.leadId)) byLead.set(row.leadId, row);
  }
  return { byLead, historyByLead };
}

function readClients() {
  if (!tableExists("clients")) return new Map();
  return new Map(db.prepare("SELECT * FROM clients").all().map((row) => [row.id, row]));
}

function readStaff(access, branchId) {
  const staff = new Map();
  if (tableExists("staff_master")) {
    const rows = db.prepare(`
      SELECT id, full_name AS name, mobile AS phone, branch_id AS branchId
      FROM staff_master
      WHERE tenant_id = @tenantId
        AND (@branchId = '' OR branch_id = @branchId)
    `).all({ tenantId: access.tenantId, branchId });
    for (const row of rows) staff.set(row.id, row);
  }
  if (tableExists("staff")) {
    for (const row of db.prepare("SELECT id, name, phone, branchId FROM staff").all()) {
      if (!staff.has(row.id)) staff.set(row.id, row);
    }
  }
  return staff;
}

function readInvoices() {
  if (!tableExists("invoices")) return { byId: new Map(), byClient: new Map() };
  const rows = db.prepare("SELECT * FROM invoices").all();
  const byId = new Map();
  const byClient = new Map();
  for (const row of rows) {
    byId.set(row.id, row);
    if (!byClient.has(row.clientId)) byClient.set(row.clientId, []);
    byClient.get(row.clientId).push(row);
  }
  for (const clientRows of byClient.values()) {
    clientRows.sort((left, right) => Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""));
  }
  return { byId, byClient };
}

function readEngagementLeads(access, query, context) {
  if (!tableExists("engagement_threads")) return [];
  const branchId = accessBranch(access, query);
  const params = {
    tenantId: access.tenantId,
    branchId,
    fromDate: safeText(query.fromDate || ""),
    toDate: safeText(query.toDate || ""),
    limit: Math.min(number(query.limit, DEFAULT_LIMIT), 2000)
  };
  return db.prepare(`
    SELECT *
    FROM engagement_threads
    WHERE tenant_id = @tenantId
      AND (@branchId = '' OR branch_id = @branchId)
      AND (@fromDate = '' OR date(created_at) >= date(@fromDate))
      AND (@toDate = '' OR date(created_at) <= date(@toDate))
    ORDER BY datetime(updated_at) DESC
    LIMIT @limit
  `).all(params).map((row) => {
    const metadata = parseJson(row.metadata_json, {});
    const client = context.clients.get(row.client_id) || {};
    const sourceStatus = statusFromSource(row.status);
    const invoice = row.invoice_id
      ? context.invoices.byId.get(row.invoice_id)
      : sourceStatus === "won"
        ? (context.invoices.byClient.get(row.client_id) || [])[0]
        : null;
    const staff = context.staff.get(row.assigned_to || row.staff_id) || {};
    const lastInbound = context.messageByThread.get(row.id)?.firstInbound || "";
    const firstOutbound = context.messageByThread.get(row.id)?.firstOutbound || "";
    const leadScore = number(metadata.leadScore || metadata.score || (row.priority === "urgent" ? 80 : row.priority === "high" ? 65 : 35), 35);
    return {
      id: `engagement:${row.id}`,
      sourceId: row.id,
      sourceKind: "engagement",
      threadId: row.id,
      whatsappThreadId: "",
      clientId: row.client_id || "",
      leadDateTime: row.created_at,
      source: sourceLabel(row.source, row.primary_channel),
      channel: row.primary_channel || "whatsapp",
      clientName: row.display_name || client.name || "Lead",
      phone: row.phone || client.phone || "",
      interestService: metadata.interestService || metadata.service || row.subject || row.last_message_preview || "Not captured",
      leadScore,
      leadTemperature: leadTemperature(leadScore),
      status: sourceStatus,
      assignedTo: row.assigned_to || row.staff_id || "",
      assignedName: staff.name || row.assigned_to || row.staff_id || "Unassigned",
      firstResponseMinutes: minutesBetween(lastInbound || row.created_at, firstOutbound),
      lastFollowUpAt: row.last_message_at || row.updated_at || row.created_at,
      nextFollowUpDue: metadata.nextFollowUpDue || context.nextDueByThread.get(row.id) || "",
      wonInvoiceId: invoice?.id || "",
      wonInvoiceNumber: invoice?.invoiceNumber || "",
      convertedRevenue: invoice ? rupee(invoice.total || invoice.paid || 0) : 0,
      lostReason: metadata.lostReason || "",
      branchId: row.branch_id || ""
    };
  });
}

function readWhatsappLeads(access, query, context) {
  if (!tableExists("whatsapp_threads")) return [];
  const branchId = accessBranch(access, query);
  const params = {
    tenantId: access.tenantId,
    branchId,
    fromDate: safeText(query.fromDate || ""),
    toDate: safeText(query.toDate || ""),
    limit: Math.min(number(query.limit, DEFAULT_LIMIT), 2000)
  };
  return db.prepare(`
    SELECT *
    FROM whatsapp_threads
    WHERE tenantId = @tenantId
      AND (@branchId = '' OR branchId = @branchId)
      AND (@fromDate = '' OR date(createdAt) >= date(@fromDate))
      AND (@toDate = '' OR date(createdAt) <= date(@toDate))
    ORDER BY datetime(updatedAt) DESC
    LIMIT @limit
  `).all(params).map((row) => {
    const metadata = parseJson(row.metadata, {});
    const client = context.clients.get(row.clientId) || {};
    const sourceStatus = statusFromSource(row.status);
    const invoice = sourceStatus === "won" ? (context.invoices.byClient.get(row.clientId) || [])[0] : null;
    const staff = context.staff.get(row.assignedUserId) || {};
    return {
      id: `whatsapp:${row.id}`,
      sourceId: row.id,
      sourceKind: "whatsapp",
      threadId: "",
      whatsappThreadId: row.id,
      clientId: row.clientId || "",
      leadDateTime: row.createdAt,
      source: sourceLabel(row.source, "whatsapp"),
      channel: "whatsapp",
      clientName: row.displayName || client.name || "WhatsApp Lead",
      phone: row.phone || client.phone || "",
      interestService: metadata.interestService || metadata.service || row.intent || "Not captured",
      leadScore: number(row.leadScore, 0),
      leadTemperature: leadTemperature(row.leadScore),
      status: sourceStatus,
      assignedTo: row.assignedUserId || "",
      assignedName: staff.name || row.assignedUserId || "Unassigned",
      firstResponseMinutes: minutesBetween(row.createdAt, row.lastMessageAt),
      lastFollowUpAt: row.lastMessageAt || row.updatedAt || row.createdAt,
      nextFollowUpDue: metadata.nextFollowUpDue || "",
      wonInvoiceId: invoice?.id || "",
      wonInvoiceNumber: invoice?.invoiceNumber || "",
      convertedRevenue: invoice ? rupee(invoice.total || invoice.paid || 0) : 0,
      lostReason: metadata.lostReason || "",
      branchId: row.branchId || ""
    };
  });
}

function readMessageContext(access, branchId) {
  const map = new Map();
  const nextDueByThread = new Map();
  if (!tableExists("engagement_messages")) return { messageByThread: map, nextDueByThread };
  const rows = db.prepare(`
    SELECT thread_id, direction, created_at, updated_at, status, metadata_json
    FROM engagement_messages
    WHERE tenant_id = @tenantId
      AND (@branchId = '' OR branch_id = @branchId)
    ORDER BY datetime(created_at) ASC
    LIMIT 5000
  `).all({ tenantId: access.tenantId, branchId });
  for (const row of rows) {
    if (!map.has(row.thread_id)) map.set(row.thread_id, {});
    const item = map.get(row.thread_id);
    if (row.direction === "inbound" && !item.firstInbound) item.firstInbound = row.created_at;
    if (row.direction === "outbound" && !item.firstOutbound) item.firstOutbound = row.created_at;
    const meta = parseJson(row.metadata_json, {});
    if (meta.nextFollowUpDue) nextDueByThread.set(row.thread_id, meta.nextFollowUpDue);
  }
  return { messageByThread: map, nextDueByThread };
}

function applyLatestAction(row, latest, history = []) {
  if (!latest) return { ...row, followUpStatus: dueState(row.nextFollowUpDue), actionHistory: history };
  const meta = parseJson(latest.metadataJson, {});
  const patched = {
    ...row,
    status: latest.actionType === "mark_won" ? "won" : latest.actionType === "mark_lost" ? "lost" : row.status,
    assignedTo: latest.assignedTo || row.assignedTo,
    assignedName: latest.assignedTo || row.assignedName,
    lastFollowUpAt: latest.actionType === "follow_up_note" ? latest.createdAt : row.lastFollowUpAt,
    lastFollowUpNote: latest.note || row.lastFollowUpNote || "",
    lostReason: latest.actionType === "mark_lost" ? latest.note || meta.lostReason || row.lostReason : row.lostReason,
    wonInvoiceId: latest.actionType === "mark_won" ? meta.invoiceId || latest.invoiceId || row.wonInvoiceId : row.wonInvoiceId,
    wonInvoiceNumber: latest.actionType === "mark_won" ? meta.invoiceNumber || row.wonInvoiceNumber : row.wonInvoiceNumber,
    convertedRevenue: latest.actionType === "mark_won" ? rupee(meta.convertedRevenue || row.convertedRevenue) : row.convertedRevenue,
    latestActionAt: latest.createdAt,
    latestActionType: latest.actionType,
    actionHistory: history
  };
  return { ...patched, followUpStatus: dueState(patched.nextFollowUpDue) };
}

function filterRows(rows, query) {
  const source = safeText(query.source || "").toLowerCase();
  const status = safeText(query.status || "").toLowerCase();
  const score = safeText(query.score || query.leadScore || "").toLowerCase();
  const assignedTo = safeText(query.assignedTo || query.staffId || "");
  const followUp = safeText(query.followUp || "").toLowerCase();
  const service = safeText(query.service || "").toLowerCase();
  const q = safeText(query.q || query.search || "").toLowerCase();
  return rows.filter((row) => {
    const haystack = `${row.clientName} ${row.phone} ${row.source} ${row.interestService} ${row.wonInvoiceNumber}`.toLowerCase();
    return (!source || row.source.toLowerCase() === source || row.channel.toLowerCase() === source)
      && (!status || row.status === status)
      && (!score || row.leadTemperature === score)
      && (!assignedTo || row.assignedTo === assignedTo || row.assignedName === assignedTo)
      && (!followUp || row.followUpStatus === followUp)
      && (!service || String(row.interestService || "").toLowerCase().includes(service))
      && (!q || haystack.includes(q));
  });
}

function summary(rows) {
  const total = rows.length;
  const won = rows.filter((row) => row.status === "won").length;
  const lost = rows.filter((row) => row.status === "lost").length;
  const overdue = rows.filter((row) => row.followUpStatus === "overdue").length;
  const bySource = new Map();
  for (const row of rows) bySource.set(row.source, (bySource.get(row.source) || 0) + 1);
  const topLeadSource = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  const responseSamples = rows.filter((row) => row.firstResponseMinutes > 0);
  const avgResponse = responseSamples.length
    ? Math.round(responseSamples.reduce((sum, row) => sum + row.firstResponseMinutes, 0) / responseSamples.length)
    : 0;
  return {
    totalLeads: total,
    hotLeads: rows.filter((row) => row.leadTemperature === "hot").length,
    pendingFollowUps: rows.filter((row) => ["pending", "follow_up", "new", "open"].includes(row.status)).length,
    wonLeads: won,
    lostLeads: lost,
    conversionRate: total ? Math.round((won / total) * 100) : 0,
    revenueFromLeads: rows.reduce((sum, row) => sum + number(row.convertedRevenue, 0), 0),
    averageResponseMinutes: avgResponse,
    overdueFollowUps: overdue,
    topLeadSource
  };
}

export const engagementLeadIntelligenceService = {
  report(query = {}, access = {}) {
    ensureEngagementSchema();
    const branchId = accessBranch(access, query);
    const clients = readClients();
    const staff = readStaff(access, branchId);
    const invoices = readInvoices();
    const messageContext = readMessageContext(access, branchId);
    const actions = latestActions(access, branchId);
    const context = { clients, staff, invoices, ...messageContext };
    const combined = [
      ...readEngagementLeads(access, query, context),
      ...readWhatsappLeads(access, query, context)
    ].map((row) => applyLatestAction(row, actions.byLead.get(row.id), actions.historyByLead.get(row.id) || []));
    const rows = filterRows(combined, query)
      .sort((left, right) => Date.parse(right.leadDateTime || "") - Date.parse(left.leadDateTime || ""))
      .slice(0, Math.min(number(query.limit, DEFAULT_LIMIT), 2000));
    return {
      generatedAt: nowIso(),
      filters: {
        fromDate: safeText(query.fromDate || ""),
        toDate: safeText(query.toDate || ""),
        branchId,
        source: safeText(query.source || ""),
        status: safeText(query.status || ""),
        score: safeText(query.score || query.leadScore || ""),
        assignedTo: safeText(query.assignedTo || query.staffId || ""),
        followUp: safeText(query.followUp || ""),
        service: safeText(query.service || ""),
        q: safeText(query.q || query.search || "")
      },
      summary: summary(rows),
      rows
    };
  },

  action(leadId, payload = {}, access = {}, actionType = "follow_up_note") {
    ensureEngagementSchema();
    const branchId = safeText(payload.branchId || access.branchId || "");
    const metadata = {
      invoiceId: safeText(payload.invoiceId || ""),
      invoiceNumber: safeText(payload.invoiceNumber || ""),
      convertedRevenue: number(payload.convertedRevenue, 0),
      lostReason: safeText(payload.lostReason || payload.note || "")
    };
    const row = {
      id: randomUUID(),
      tenantId: access.tenantId,
      branchId,
      leadId: safeText(leadId),
      threadId: safeText(payload.threadId || ""),
      whatsappThreadId: safeText(payload.whatsappThreadId || ""),
      clientId: safeText(payload.clientId || ""),
      invoiceId: metadata.invoiceId,
      actionType,
      status: safeText(payload.status || "logged"),
      assignedTo: safeText(payload.assignedTo || payload.managerId || ""),
      note: safeText(payload.note || payload.reason || ""),
      metadataJson: JSON.stringify(metadata),
      createdBy: safeText(access.userId || payload.createdBy || "system"),
      createdAt: nowIso()
    };
    db.prepare(`
      INSERT INTO engagementLeadActions (
        id, tenantId, branchId, leadId, threadId, whatsappThreadId, clientId, invoiceId,
        actionType, status, assignedTo, note, metadataJson, createdBy, createdAt
      ) VALUES (
        @id, @tenantId, @branchId, @leadId, @threadId, @whatsappThreadId, @clientId, @invoiceId,
        @actionType, @status, @assignedTo, @note, @metadataJson, @createdBy, @createdAt
      )
    `).run(row);
    return { ok: true, action: row };
  }
};
