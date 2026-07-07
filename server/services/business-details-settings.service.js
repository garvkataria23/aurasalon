import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "business.details.settings";

const DEFAULT_SETTINGS = {
  businessProfile: {
    businessName: "Aura Salon",
    branchDisplayName: "",
    ownerName: ""
  },
  contactDetails: {
    phone: "",
    whatsappNumber: "",
    email: "",
    website: ""
  },
  addressLocation: {
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateProvince: "",
    country: "India",
    postalCode: ""
  },
  invoiceIdentity: {
    invoiceBusinessName: "Aura Salon",
    invoiceFooterName: "Aura Salon",
    showBusinessDetailsOnInvoice: true,
    showLogoOnInvoice: true
  },
  branding: {
    logoUrl: "",
    brandColor: "#07956f"
  },
  socialOnlineProfile: {
    instagramLink: "",
    facebookLink: "",
    googleProfileLink: "",
    onlineBookingProfileSlug: ""
  },
  legalRegistration: {
    registrationLabel: "GSTIN / Tax ID / TRN / VAT No",
    registrationNumber: ""
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

function textValue(value, fallback = "", maxLength = 500) {
  return String(value ?? fallback).trim().slice(0, maxLength);
}

function boolValue(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function colorValue(value, fallback) {
  const text = textValue(value, fallback, 20);
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}

function normalizeSettings(input = {}) {
  const businessProfile = input.businessProfile || {};
  const contactDetails = input.contactDetails || {};
  const addressLocation = input.addressLocation || {};
  const invoiceIdentity = input.invoiceIdentity || {};
  const branding = input.branding || {};
  const socialOnlineProfile = input.socialOnlineProfile || {};
  const legalRegistration = input.legalRegistration || {};

  return {
    businessProfile: {
      businessName: textValue(businessProfile.businessName, DEFAULT_SETTINGS.businessProfile.businessName),
      branchDisplayName: textValue(businessProfile.branchDisplayName, DEFAULT_SETTINGS.businessProfile.branchDisplayName),
      ownerName: textValue(businessProfile.ownerName, DEFAULT_SETTINGS.businessProfile.ownerName)
    },
    contactDetails: {
      phone: textValue(contactDetails.phone, DEFAULT_SETTINGS.contactDetails.phone, 80),
      whatsappNumber: textValue(contactDetails.whatsappNumber, DEFAULT_SETTINGS.contactDetails.whatsappNumber, 80),
      email: textValue(contactDetails.email, DEFAULT_SETTINGS.contactDetails.email, 160),
      website: textValue(contactDetails.website, DEFAULT_SETTINGS.contactDetails.website, 240)
    },
    addressLocation: {
      addressLine1: textValue(addressLocation.addressLine1, DEFAULT_SETTINGS.addressLocation.addressLine1, 240),
      addressLine2: textValue(addressLocation.addressLine2, DEFAULT_SETTINGS.addressLocation.addressLine2, 240),
      city: textValue(addressLocation.city, DEFAULT_SETTINGS.addressLocation.city, 120),
      stateProvince: textValue(addressLocation.stateProvince, DEFAULT_SETTINGS.addressLocation.stateProvince, 120),
      country: textValue(addressLocation.country, DEFAULT_SETTINGS.addressLocation.country, 120),
      postalCode: textValue(addressLocation.postalCode, DEFAULT_SETTINGS.addressLocation.postalCode, 40)
    },
    invoiceIdentity: {
      invoiceBusinessName: textValue(invoiceIdentity.invoiceBusinessName, DEFAULT_SETTINGS.invoiceIdentity.invoiceBusinessName),
      invoiceFooterName: textValue(invoiceIdentity.invoiceFooterName, DEFAULT_SETTINGS.invoiceIdentity.invoiceFooterName),
      showBusinessDetailsOnInvoice: boolValue(invoiceIdentity.showBusinessDetailsOnInvoice, DEFAULT_SETTINGS.invoiceIdentity.showBusinessDetailsOnInvoice),
      showLogoOnInvoice: boolValue(invoiceIdentity.showLogoOnInvoice, DEFAULT_SETTINGS.invoiceIdentity.showLogoOnInvoice)
    },
    branding: {
      logoUrl: textValue(branding.logoUrl, DEFAULT_SETTINGS.branding.logoUrl, 500),
      brandColor: colorValue(branding.brandColor, DEFAULT_SETTINGS.branding.brandColor)
    },
    socialOnlineProfile: {
      instagramLink: textValue(socialOnlineProfile.instagramLink, DEFAULT_SETTINGS.socialOnlineProfile.instagramLink, 300),
      facebookLink: textValue(socialOnlineProfile.facebookLink, DEFAULT_SETTINGS.socialOnlineProfile.facebookLink, 300),
      googleProfileLink: textValue(socialOnlineProfile.googleProfileLink, DEFAULT_SETTINGS.socialOnlineProfile.googleProfileLink, 300),
      onlineBookingProfileSlug: textValue(socialOnlineProfile.onlineBookingProfileSlug, DEFAULT_SETTINGS.socialOnlineProfile.onlineBookingProfileSlug, 120)
    },
    legalRegistration: {
      registrationLabel: textValue(legalRegistration.registrationLabel, DEFAULT_SETTINGS.legalRegistration.registrationLabel, 120),
      registrationNumber: textValue(legalRegistration.registrationNumber, DEFAULT_SETTINGS.legalRegistration.registrationNumber, 120)
    }
  };
}

export const businessDetailsSettingsService = {
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
