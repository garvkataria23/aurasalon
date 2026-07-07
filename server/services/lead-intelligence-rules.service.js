const HOT_SCORE = 70;
const WARM_SCORE = 45;

const text = (value = "") => String(value || "").trim();
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function parseTime(value = "") {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function amountPaise(row = {}) {
  if (row.quotedAmountPaise !== undefined) return Math.max(0, Math.round(number(row.quotedAmountPaise, 0)));
  if (row.convertedAmountPaise !== undefined) return Math.max(0, Math.round(number(row.convertedAmountPaise, 0)));
  if (row.quotedAmount !== undefined) return Math.max(0, Math.round(number(row.quotedAmount, 0) * 100));
  if (row.convertedRevenue !== undefined) return Math.max(0, Math.round(number(row.convertedRevenue, 0) * 100));
  return 0;
}

function isUnassigned(row = {}) {
  const owner = `${row.assignedTo || ""} ${row.assignedName || ""}`.trim().toLowerCase();
  return !owner || owner === "unassigned";
}

function status(row = {}) {
  return text(row.status || row.stageName).toLowerCase();
}

function slaState(row = {}) {
  const explicit = text(row.slaStatus || row.followUpStatus).toLowerCase();
  if (["missed", "overdue", "due_today", "today", "on_time", "upcoming", "won", "lost"].includes(explicit)) return explicit;
  const dueAt = text(row.followUpAt || row.nextFollowUpDue);
  if (!dueAt) return "collecting";
  const due = parseTime(dueAt);
  if (!due) return "collecting";
  const diff = due - Date.now();
  if (diff < -3600000) return "missed";
  if (diff < 0) return "overdue";
  if (new Date(due).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)) return "due_today";
  return "on_time";
}

function temperature(score) {
  if (score >= HOT_SCORE) return "hot";
  if (score >= WARM_SCORE) return "warm";
  return "cold";
}

function contribution(key, label, value, detail, tone = value >= 0 ? "positive" : "warning") {
  return { key, label, value, detail, tone };
}

export function computeLeadScore(row = {}, clientMatch = null) {
  const breakdown = [contribution("base", "Base intent", 25, "Lead captured in pipeline", "neutral")];
  const amount = amountPaise(row);
  const source = text(row.source || row.channel).toLowerCase();
  const type = text(row.typeName || row.leadType || row.interestService);
  const linked = Boolean(row.clientId || row.client_id || clientMatch?.clientId || clientMatch?.id);
  const dueAt = text(row.followUpAt || row.nextFollowUpDue);
  const due = parseTime(dueAt);
  const sla = slaState(row);
  const phone = text(row.phone || row.contact);
  const email = text(row.email);

  if (amount >= 1000000) breakdown.push(contribution("value", "High quoted value", 25, "Opportunity is above ₹10,000"));
  else if (amount >= 300000) breakdown.push(contribution("value", "Strong quoted value", 15, "Opportunity is above ₹3,000"));
  else if (amount >= 100000) breakdown.push(contribution("value", "Quoted value", 8, "Opportunity amount is captured"));
  else breakdown.push(contribution("value", "Low or missing value", 0, "No strong revenue signal", "neutral"));

  if (["google", "instagram", "facebook", "whatsapp", "referral"].some((item) => source.includes(item))) {
    breakdown.push(contribution("source", "High-intent source", 12, text(row.source || row.channel || "Captured source")));
  } else if (source.includes("walk")) {
    breakdown.push(contribution("source", "Walk-in source", 6, "In-person intent"));
  } else {
    breakdown.push(contribution("source", "Source not qualified", 0, "No source quality boost", "neutral"));
  }

  breakdown.push(linked
    ? contribution("client", "Client linked", 10, "Existing guest profile matched")
    : contribution("client", "Client not linked", 0, "No existing profile match", "neutral"));

  if (type && !/general|not captured|unknown/i.test(type)) breakdown.push(contribution("service", "Service interest captured", 8, type));
  else breakdown.push(contribution("service", "Service interest missing", -4, "Capture service or package interest"));

  if (due) {
    const hours = (due - Date.now()) / 3600000;
    if (hours >= 0 && hours <= 24) breakdown.push(contribution("follow_up", "Follow-up due soon", 12, "Next action is within 24 hours"));
    else if (hours > 24) breakdown.push(contribution("follow_up", "Follow-up scheduled", 6, "Future follow-up exists"));
    else breakdown.push(contribution("follow_up", "Follow-up overdue", -10, "Due time has passed"));
  } else {
    breakdown.push(contribution("follow_up", "No follow-up scheduled", -6, "Needs next action"));
  }

  if (["missed", "overdue"].includes(sla)) breakdown.push(contribution("sla", "SLA missed", -10, "Manager attention required"));
  else if (["due_today", "today"].includes(sla)) breakdown.push(contribution("sla", "SLA due today", 4, "Action due today"));
  else breakdown.push(contribution("sla", "SLA healthy", 2, "No immediate SLA risk", "neutral"));

  breakdown.push(isUnassigned(row)
    ? contribution("owner", "Owner missing", -6, "Assign staff owner")
    : contribution("owner", "Owner assigned", 6, text(row.assignedName || row.assignedTo)));

  if (!phone && !email) breakdown.push(contribution("contact", "Contact missing", -18, "Phone or email is required"));
  else if (!phone || !email) breakdown.push(contribution("contact", "Contact partial", -4, "One contact field is missing"));
  else breakdown.push(contribution("contact", "Contact complete", 4, "Phone and email available"));

  if (status(row) === "won") breakdown.push(contribution("terminal", "Won lead", 5, "Converted lead"));
  if (status(row) === "lost") breakdown.push(contribution("terminal", "Lost lead", -8, "Closed lost"));

  const leadScore = Math.max(0, Math.min(100, Math.round(breakdown.reduce((sum, item) => sum + number(item.value, 0), 0))));
  return {
    leadScore,
    leadTemperature: temperature(leadScore),
    scoreBreakdown: breakdown
  };
}

function signal(key, label, statusValue, detail) {
  return { key, label, status: statusValue, detail };
}

function nextAction(row = {}, score = 0) {
  const currentStatus = status(row);
  const sla = slaState(row);
  const amount = amountPaise(row);
  const linked = Boolean(row.clientId || row.client_id);
  const hasFollowUp = Boolean(text(row.followUpAt || row.nextFollowUpDue));
  const highValue = amount >= 300000;

  if (currentStatus === "won") return { key: "won_summary", label: "Won lead closed", detail: "Keep invoice and guest history updated.", priority: "low" };
  if (currentStatus === "lost") return { key: "lost_summary", label: "Lost lead closed", detail: "Review lost reason before reactivation.", priority: "low" };
  if (["missed", "overdue"].includes(sla)) return { key: "contact_now", label: "Contact now", detail: "Follow-up SLA is overdue or missed.", priority: "urgent" };
  if (score >= HOT_SCORE && isUnassigned(row)) return { key: "assign_owner", label: "Assign owner", detail: "Hot lead is unassigned.", priority: "high" };
  if (!hasFollowUp) return { key: "schedule_follow_up", label: "Schedule follow-up", detail: "No next follow-up is planned.", priority: "high" };
  if (linked || highValue) return { key: "book_consultation", label: "Book consultation", detail: linked ? "Linked client is ready for booking." : "High-value inquiry needs consultation.", priority: "medium" };
  return { key: "nurture", label: "Nurture lead", detail: "Continue normal follow-up sequence.", priority: "normal" };
}

function managerAttention(row = {}, score = 0, action = {}) {
  const items = [];
  const currentStatus = status(row);
  const terminal = currentStatus === "won" || currentStatus === "lost";
  const amount = amountPaise(row);
  const created = parseTime(row.createdAt || row.leadDateTime);
  const ageHours = created ? (Date.now() - created) / 3600000 : 0;
  const phone = text(row.phone || row.contact);
  const email = text(row.email);
  const hasFollowUp = Boolean(text(row.followUpAt || row.nextFollowUpDue));
  const sla = slaState(row);

  if (terminal) return items;
  if (["missed", "overdue"].includes(sla)) items.push({ key: "sla", label: "Missed follow-up", priority: "urgent", detail: "SLA is overdue." });
  if (score >= HOT_SCORE && isUnassigned(row)) items.push({ key: "hot_unassigned", label: "Hot unassigned", priority: "high", detail: "Assign staff immediately." });
  if (!phone && !email) items.push({ key: "missing_contact", label: "Missing contact", priority: "high", detail: "Phone/email unavailable." });
  if (ageHours >= 48 && !hasFollowUp) items.push({ key: "stale_open", label: "Stale open lead", priority: "medium", detail: "Open for more than 48 hours with no next action." });
  if (amount >= 300000 && action.key === "schedule_follow_up") items.push({ key: "high_value_no_action", label: "High value no action", priority: "high", detail: "High-value lead has no planned follow-up." });
  return items;
}

function priority(items = [], action = {}) {
  if (items.some((item) => item.priority === "urgent") || action.priority === "urgent") return "urgent";
  if (items.some((item) => item.priority === "high") || action.priority === "high") return "high";
  if (items.some((item) => item.priority === "medium") || action.priority === "medium") return "medium";
  if (items.length || action.priority === "normal") return "low";
  return "none";
}

export function decorateLeadIntelligence(row = {}, clientMatch = null) {
  const scored = computeLeadScore(row, clientMatch);
  const action = nextAction(row, scored.leadScore);
  const attention = managerAttention(row, scored.leadScore, action);
  const qualitySignals = [
    signal("temperature", `${scored.leadTemperature.toUpperCase()} lead`, scored.leadTemperature === "hot" ? "positive" : scored.leadTemperature === "warm" ? "neutral" : "warning", `Score ${scored.leadScore}/100`),
    signal("source", text(row.source || row.channel) ? "Source captured" : "Source missing", text(row.source || row.channel) ? "positive" : "warning", text(row.source || row.channel || "Capture source")),
    signal("contact", text(row.phone || row.contact || row.email) ? "Contact available" : "Contact missing", text(row.phone || row.contact || row.email) ? "positive" : "warning", text(row.phone || row.contact || row.email || "Phone/email needed")),
    signal("owner", isUnassigned(row) ? "Owner missing" : "Owner assigned", isUnassigned(row) ? "warning" : "positive", text(row.assignedName || row.assignedTo || "Assign owner")),
    signal("sla", `SLA ${slaState(row).replace(/_/g, " ")}`, ["missed", "overdue"].includes(slaState(row)) ? "warning" : "positive", text(row.followUpAt || row.nextFollowUpDue || "No due time"))
  ];
  const attentionPriority = priority(attention, action);
  return {
    ...row,
    ...scored,
    qualitySignals,
    nextBestAction: action,
    nextBestActionLabel: action.label,
    managerAttention: attention,
    managerAttentionLabels: attention.map((item) => item.label).join("; "),
    needsAttention: attention.length > 0,
    attentionPriority
  };
}

export function leadTemperature(score) {
  return temperature(number(score, 0));
}
