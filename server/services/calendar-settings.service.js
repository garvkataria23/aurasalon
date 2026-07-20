import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "calendar.settings";

const DEFAULT_COLORS = [
  { key: "confirmed", enabled: true, color: "#84cfb1", label: "Confirmed" },
  { key: "arrived", enabled: true, color: "#9fd6fd", label: "Arrived" },
  { key: "start", enabled: true, color: "#ffa500", label: "Start" },
  { key: "completed", enabled: true, color: "#323ec7", label: "Completed" },
  { key: "cancel", enabled: true, color: "#fc8e8f", label: "Cancel" },
  { key: "notCame", enabled: true, color: "#23e830", label: "Not Came" },
  { key: "notConfirmed", enabled: true, color: "#8893d3", label: "Not Confirmed" },
  { key: "rescheduleBooking", enabled: true, color: "#2a2c32", label: "Reschedule Booking" },
  { key: "addPayment", enabled: true, color: "#bd60e8", label: "Add Payment" },
  { key: "delete", enabled: true, color: "#ff0000", label: "Delete" }
];

const DEFAULT_SETTINGS = {
  overlapTimeSlot: true,
  previousTimeSlot: true,
  weekStartFrom: "Sunday",
  timeSlot: "15 Mins",
  timeFormat: "12 Hours",
  roomNumberOption: false,
  staffCalendar: true,
  appointmentStatus: "Confirmed",
  colors: DEFAULT_COLORS
};

const DEFAULT_AUDIT = {
  lastChangedBy: "Not saved yet",
  lastChangedAt: ""
};

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function tenantIdFrom(access = {}) {
  const tenantId = access.tenantId || "";
  if (!tenantId) throw badRequest("tenantId is required");
  return tenantId;
}

function branchIdFrom(input = {}, access = {}) {
  const branchId = input.branchId || access.branchId || "";
  if (branchId) tenantService.assertBranchAccess(access, branchId);
  return branchId;
}

function settingKey(branchId) {
  return `${SETTING_PREFIX}.${branchId || "all"}`;
}

function boolValue(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function stringValue(value, fallback, allowed = null) {
  const next = String(value ?? fallback).trim() || fallback;
  return allowed && !allowed.includes(next) ? fallback : next;
}

function normalizeColors(input = []) {
  const savedColors = Array.isArray(input) ? input : [];
  return DEFAULT_COLORS.map((item) => {
    const match = savedColors.find((row) => row?.key === item.key) || {};
    return {
      key: item.key,
      enabled: boolValue(match.enabled, item.enabled),
      color: /^#[0-9a-fA-F]{6}$/.test(String(match.color || "")) ? match.color : item.color,
      label: stringValue(match.label, item.label)
    };
  });
}

function normalizeSettings(input = {}) {
  return {
    overlapTimeSlot: boolValue(input.overlapTimeSlot, DEFAULT_SETTINGS.overlapTimeSlot),
    previousTimeSlot: boolValue(input.previousTimeSlot, DEFAULT_SETTINGS.previousTimeSlot),
    weekStartFrom: stringValue(input.weekStartFrom, DEFAULT_SETTINGS.weekStartFrom, ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]),
    timeSlot: stringValue(input.timeSlot, DEFAULT_SETTINGS.timeSlot, ["5 Mins", "10 Mins", "15 Mins", "20 Mins", "30 Mins", "45 Mins", "60 Mins"]),
    timeFormat: stringValue(input.timeFormat, DEFAULT_SETTINGS.timeFormat, ["12 Hours", "24 Hours"]),
    roomNumberOption: boolValue(input.roomNumberOption, DEFAULT_SETTINGS.roomNumberOption),
    staffCalendar: boolValue(input.staffCalendar, DEFAULT_SETTINGS.staffCalendar),
    appointmentStatus: stringValue(input.appointmentStatus, DEFAULT_SETTINGS.appointmentStatus, DEFAULT_COLORS.map((item) => item.label)),
    colors: normalizeColors(input.colors)
  };
}

function normalizeAudit(input = {}) {
  return {
    lastChangedBy: input.lastChangedBy || DEFAULT_AUDIT.lastChangedBy,
    lastChangedAt: input.lastChangedAt || DEFAULT_AUDIT.lastChangedAt
  };
}

export const calendarSettingsService = {
  get(query = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(query, access);
    const key = settingKey(branchId);
    const row = db.prepare("SELECT value FROM settings WHERE tenantId = @tenantId AND key = @key").get({ tenantId, key });
    const saved = parseJson(row?.value, null);
    return {
      branchId,
      settings: normalizeSettings(saved?.settings || saved || DEFAULT_SETTINGS),
      audit: normalizeAudit(saved?.audit)
    };
  },

  save(payload = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(payload, access);
    const key = settingKey(branchId);
    const settings = normalizeSettings(payload.settings || payload);
    const now = new Date().toISOString();
    const audit = {
      lastChangedBy: access.user?.email || access.user?.id || access.role || "system",
      lastChangedAt: now
    };
    const id = `setting_${tenantId}_${key}`.replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 120);
    db.prepare(`
      INSERT INTO settings (id, tenantId, key, value, scope, createdAt, updatedAt)
      VALUES (@id, @tenantId, @key, @value, @scope, @createdAt, @updatedAt)
      ON CONFLICT(tenantId, key) DO UPDATE SET
        value = excluded.value,
        scope = excluded.scope,
        updatedAt = excluded.updatedAt
    `).run({
      id,
      tenantId,
      key,
      value: JSON.stringify({ branchId, settings, audit }),
      scope: branchId ? "branch" : "tenant",
      createdAt: now,
      updatedAt: now
    });
    return { branchId, settings, audit };
  }
};
