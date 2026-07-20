import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "booking.settings";

const DEFAULT_SETTINGS = {
  bookingControl: {
    onlineBooking: true,
    walkInBooking: true,
    allowClientStaffSelect: true,
    sameDayBooking: true,
    autoConfirmBooking: false,
    riskyBookingOwnerApproval: true
  },
  slotRules: {
    slotDurationMinutes: 15,
    minimumAdvanceHours: 2,
    maximumFutureDays: 30,
    bufferMinutes: 0,
    allowOverlapBooking: false,
    previousTimeSlotVisibility: false
  },
  cancellationReschedule: {
    allowCancellation: true,
    cancellationUntilHours: 4,
    allowReschedule: true,
    rescheduleUntilHours: 4,
    noShowAutoMark: false,
    lateChangeOwnerApproval: true
  },
  depositPayment: {
    depositRequired: false,
    depositType: "percentage",
    depositValue: 0,
    payLaterAllowed: true,
    riskyClientOnlinePayment: false,
    depositRefundRule: "Refunds follow owner approval and salon policy."
  },
  clientRules: {
    newClientBookingAllowed: true,
    blockedClientBookingBlocked: true,
    unpaidClientMode: "warn",
    memberPriorityBooking: true,
    packageClientPriorityBooking: true,
    duplicateBookingCheck: true
  },
  staffResource: {
    staffAutoAssign: false,
    respectStaffWorkingHours: true,
    respectStaffBreaks: true,
    roomChairRequired: false,
    resourceConflictCheck: true
  },
  notifications: {
    clientConfirmationSms: true,
    clientConfirmationWhatsapp: true,
    clientConfirmationEmail: false,
    reminderBeforeHours: 24,
    staffNotification: true,
    ownerHighValueNotification: true,
    ownerRiskyBookingNotification: true
  }
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

function numberValue(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function textValue(value, fallback = "", maxLength = 1000) {
  return String(value ?? fallback).trim().slice(0, maxLength);
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeSettings(input = {}) {
  const bookingControl = input.bookingControl || {};
  const slotRules = input.slotRules || {};
  const cancellationReschedule = input.cancellationReschedule || {};
  const depositPayment = input.depositPayment || {};
  const clientRules = input.clientRules || {};
  const staffResource = input.staffResource || {};
  const notifications = input.notifications || {};

  return {
    bookingControl: {
      onlineBooking: boolValue(bookingControl.onlineBooking, DEFAULT_SETTINGS.bookingControl.onlineBooking),
      walkInBooking: boolValue(bookingControl.walkInBooking, DEFAULT_SETTINGS.bookingControl.walkInBooking),
      allowClientStaffSelect: boolValue(bookingControl.allowClientStaffSelect, DEFAULT_SETTINGS.bookingControl.allowClientStaffSelect),
      sameDayBooking: boolValue(bookingControl.sameDayBooking, DEFAULT_SETTINGS.bookingControl.sameDayBooking),
      autoConfirmBooking: boolValue(bookingControl.autoConfirmBooking, DEFAULT_SETTINGS.bookingControl.autoConfirmBooking),
      riskyBookingOwnerApproval: boolValue(bookingControl.riskyBookingOwnerApproval, DEFAULT_SETTINGS.bookingControl.riskyBookingOwnerApproval)
    },
    slotRules: {
      slotDurationMinutes: oneOf(Number(slotRules.slotDurationMinutes), [5, 10, 15, 30, 45, 60], DEFAULT_SETTINGS.slotRules.slotDurationMinutes),
      minimumAdvanceHours: numberValue(slotRules.minimumAdvanceHours, DEFAULT_SETTINGS.slotRules.minimumAdvanceHours, 0, 168),
      maximumFutureDays: numberValue(slotRules.maximumFutureDays, DEFAULT_SETTINGS.slotRules.maximumFutureDays, 1, 365),
      bufferMinutes: numberValue(slotRules.bufferMinutes, DEFAULT_SETTINGS.slotRules.bufferMinutes, 0, 240),
      allowOverlapBooking: boolValue(slotRules.allowOverlapBooking, DEFAULT_SETTINGS.slotRules.allowOverlapBooking),
      previousTimeSlotVisibility: boolValue(slotRules.previousTimeSlotVisibility, DEFAULT_SETTINGS.slotRules.previousTimeSlotVisibility)
    },
    cancellationReschedule: {
      allowCancellation: boolValue(cancellationReschedule.allowCancellation, DEFAULT_SETTINGS.cancellationReschedule.allowCancellation),
      cancellationUntilHours: numberValue(cancellationReschedule.cancellationUntilHours, DEFAULT_SETTINGS.cancellationReschedule.cancellationUntilHours, 0, 168),
      allowReschedule: boolValue(cancellationReschedule.allowReschedule, DEFAULT_SETTINGS.cancellationReschedule.allowReschedule),
      rescheduleUntilHours: numberValue(cancellationReschedule.rescheduleUntilHours, DEFAULT_SETTINGS.cancellationReschedule.rescheduleUntilHours, 0, 168),
      noShowAutoMark: boolValue(cancellationReschedule.noShowAutoMark, DEFAULT_SETTINGS.cancellationReschedule.noShowAutoMark),
      lateChangeOwnerApproval: boolValue(cancellationReschedule.lateChangeOwnerApproval, DEFAULT_SETTINGS.cancellationReschedule.lateChangeOwnerApproval)
    },
    depositPayment: {
      depositRequired: boolValue(depositPayment.depositRequired, DEFAULT_SETTINGS.depositPayment.depositRequired),
      depositType: oneOf(depositPayment.depositType, ["percentage", "fixed"], DEFAULT_SETTINGS.depositPayment.depositType),
      depositValue: numberValue(depositPayment.depositValue, DEFAULT_SETTINGS.depositPayment.depositValue, 0, 1000000),
      payLaterAllowed: boolValue(depositPayment.payLaterAllowed, DEFAULT_SETTINGS.depositPayment.payLaterAllowed),
      riskyClientOnlinePayment: boolValue(depositPayment.riskyClientOnlinePayment, DEFAULT_SETTINGS.depositPayment.riskyClientOnlinePayment),
      depositRefundRule: textValue(depositPayment.depositRefundRule, DEFAULT_SETTINGS.depositPayment.depositRefundRule)
    },
    clientRules: {
      newClientBookingAllowed: boolValue(clientRules.newClientBookingAllowed, DEFAULT_SETTINGS.clientRules.newClientBookingAllowed),
      blockedClientBookingBlocked: boolValue(clientRules.blockedClientBookingBlocked, DEFAULT_SETTINGS.clientRules.blockedClientBookingBlocked),
      unpaidClientMode: oneOf(clientRules.unpaidClientMode, ["allow", "warn", "block"], DEFAULT_SETTINGS.clientRules.unpaidClientMode),
      memberPriorityBooking: boolValue(clientRules.memberPriorityBooking, DEFAULT_SETTINGS.clientRules.memberPriorityBooking),
      packageClientPriorityBooking: boolValue(clientRules.packageClientPriorityBooking, DEFAULT_SETTINGS.clientRules.packageClientPriorityBooking),
      duplicateBookingCheck: boolValue(clientRules.duplicateBookingCheck, DEFAULT_SETTINGS.clientRules.duplicateBookingCheck)
    },
    staffResource: {
      staffAutoAssign: boolValue(staffResource.staffAutoAssign, DEFAULT_SETTINGS.staffResource.staffAutoAssign),
      respectStaffWorkingHours: boolValue(staffResource.respectStaffWorkingHours, DEFAULT_SETTINGS.staffResource.respectStaffWorkingHours),
      respectStaffBreaks: boolValue(staffResource.respectStaffBreaks, DEFAULT_SETTINGS.staffResource.respectStaffBreaks),
      roomChairRequired: boolValue(staffResource.roomChairRequired, DEFAULT_SETTINGS.staffResource.roomChairRequired),
      resourceConflictCheck: boolValue(staffResource.resourceConflictCheck, DEFAULT_SETTINGS.staffResource.resourceConflictCheck)
    },
    notifications: {
      clientConfirmationSms: boolValue(notifications.clientConfirmationSms, DEFAULT_SETTINGS.notifications.clientConfirmationSms),
      clientConfirmationWhatsapp: boolValue(notifications.clientConfirmationWhatsapp, DEFAULT_SETTINGS.notifications.clientConfirmationWhatsapp),
      clientConfirmationEmail: boolValue(notifications.clientConfirmationEmail, DEFAULT_SETTINGS.notifications.clientConfirmationEmail),
      reminderBeforeHours: numberValue(notifications.reminderBeforeHours, DEFAULT_SETTINGS.notifications.reminderBeforeHours, 0, 168),
      staffNotification: boolValue(notifications.staffNotification, DEFAULT_SETTINGS.notifications.staffNotification),
      ownerHighValueNotification: boolValue(notifications.ownerHighValueNotification, DEFAULT_SETTINGS.notifications.ownerHighValueNotification),
      ownerRiskyBookingNotification: boolValue(notifications.ownerRiskyBookingNotification, DEFAULT_SETTINGS.notifications.ownerRiskyBookingNotification)
    }
  };
}

export const bookingSettingsService = {
  get(query = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(query, access);
    const key = settingKey(branchId);
    const row = db.prepare("SELECT value FROM settings WHERE tenantId = @tenantId AND key = @key").get({ tenantId, key });
    const saved = parseJson(row?.value, null);
    return {
      branchId,
      settings: normalizeSettings(saved?.settings || saved || DEFAULT_SETTINGS)
    };
  },

  save(payload = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(payload, access);
    const key = settingKey(branchId);
    const settings = normalizeSettings(payload.settings || payload);
    const now = new Date().toISOString();
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
      value: JSON.stringify({ branchId, settings }),
      scope: branchId ? "branch" : "tenant",
      createdAt: now,
      updatedAt: now
    });
    return { branchId, settings };
  }
};
