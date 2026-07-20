import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "bill.settings";

const DEFAULT_COMMON = {
  feedback: {
    showBill: true,
    showFeedbackLink: true,
    showInvoiceLink: true
  },
  print: {
    shortPrint: false,
    a4Print: true
  },
  invoice: {
    headerIncludingLogo: true,
    businessName: true,
    invoiceId: true,
    dateTime: true,
    paymentMethod: true,
    displayStaff: true,
    displayTime: true,
    showAppointmentTime: true,
    displayEwalletBalance: true,
    displayPendingServices: true,
    showClientName: true,
    showClientContactNumber: true,
    showDiscount: true,
    showBillNotes: true,
    showDownloadInvoiceButton: true,
    showSignature: true,
    showPackageOfferPrice: true
  },
  messages: {
    heading: "INVOICE",
    invoiceNumberPrefix: "",
    thanksMessage: "Thank You For Visiting S.Sense Salon",
    poweredBy: "S.Sense Salon"
  },
  room: {
    roomHeading: ""
  }
};

const LANGUAGE_DEFAULTS = {
  salonName: "S.SENSE SALON",
  email: "",
  contact: "",
  address: "",
  thanksMessage: "Thank You For Visiting S.Sense Salon",
  poweredBy: "S.Sense Salon",
  extraText1: "Have a Great Day.",
  extraText2: "Visit Again",
  taxInvoiceText: "",
  gstinLabel: "GSTIN",
  dateLabel: "Date",
  invoiceIdLabel: "Invoice ID",
  customerNameLabel: "Customer Name",
  customerContactLabel: "Customer Contact",
  servicesLabel: "Services",
  qtyLabel: "Qty",
  priceLabel: "Price",
  discountLabel: "Discount",
  totalLabel: "Total",
  productLabel: "Product",
  packageLabel: "Package",
  membershipLabel: "Membership",
  validLabel: "Valid",
  staffLabel: "Staff",
  paidLabel: "Paid",
  dueLabel: "Due"
};

const DEFAULT_SETTINGS = {
  common: DEFAULT_COMMON,
  terms: {
    showTermsOnShortPrint: true,
    items: [""]
  },
  dualLanguage: {
    english: LANGUAGE_DEFAULTS,
    other: Object.fromEntries(Object.keys(LANGUAGE_DEFAULTS).map((key) => [key, ""]))
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

function textValue(value, fallback = "", maxLength = 500) {
  return String(value ?? fallback).trim().slice(0, maxLength);
}

function normalizeBoolGroup(input = {}, defaults = {}) {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [key, boolValue(input[key], fallback)])
  );
}

function normalizeTextGroup(input = {}, defaults = {}, maxLength = 500) {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [key, textValue(input[key], fallback, maxLength)])
  );
}

function normalizeTerms(input = {}) {
  const rawItems = Array.isArray(input.items) ? input.items : DEFAULT_SETTINGS.terms.items;
  const items = rawItems.map((item) => textValue(item, "", 1000)).filter((item, index) => item || index === 0);
  return {
    showTermsOnShortPrint: boolValue(input.showTermsOnShortPrint, DEFAULT_SETTINGS.terms.showTermsOnShortPrint),
    items: items.length ? items : [""]
  };
}

function normalizeSettings(input = {}) {
  const common = input.common || {};
  const dualLanguage = input.dualLanguage || {};
  return {
    common: {
      feedback: normalizeBoolGroup(common.feedback || {}, DEFAULT_COMMON.feedback),
      print: normalizeBoolGroup(common.print || {}, DEFAULT_COMMON.print),
      invoice: normalizeBoolGroup(common.invoice || {}, DEFAULT_COMMON.invoice),
      messages: normalizeTextGroup(common.messages || {}, DEFAULT_COMMON.messages, 200),
      room: normalizeTextGroup(common.room || {}, DEFAULT_COMMON.room, 120)
    },
    terms: normalizeTerms(input.terms || {}),
    dualLanguage: {
      english: normalizeTextGroup(dualLanguage.english || {}, LANGUAGE_DEFAULTS, 300),
      other: normalizeTextGroup(dualLanguage.other || {}, DEFAULT_SETTINGS.dualLanguage.other, 300)
    }
  };
}

export const billSettingsService = {
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
