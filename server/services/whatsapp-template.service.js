import { db } from "../db.js";
import { onlineBookingWhatsappTemplates, supportedBookingTemplateLanguages } from "../templates/whatsapp/online-booking.templates.js";

function normalizeLanguage(language = "en") {
  return supportedBookingTemplateLanguages.includes(language) ? language : "en";
}

function variablesIn(template = "") {
  return Array.from(new Set(Array.from(String(template).matchAll(/\{\{(\w+)\}\}/g)).map((match) => match[1])));
}

function render(template = "", variables = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = variables[key] ?? variables[toCamel(key)] ?? "";
    return value === undefined || value === null ? "" : String(value);
  });
}

function toCamel(value = "") {
  return String(value).replace(/_([a-z])/g, (_match, char) => char.toUpperCase());
}

export const whatsappTemplateService = {
  supportedLanguages: supportedBookingTemplateLanguages,

  renderTemplate(templateName, language = "en", variables = {}) {
    const templateSet = onlineBookingWhatsappTemplates[templateName];
    if (!templateSet) {
      return {
        body: String(variables.body || variables.message || ""),
        language: normalizeLanguage(language),
        missingVariables: [],
        templateName
      };
    }
    const selectedLanguage = normalizeLanguage(language);
    const template = templateSet[selectedLanguage] || templateSet.en;
    const missingVariables = variablesIn(template).filter((key) => {
      return variables[key] === undefined && variables[toCamel(key)] === undefined;
    });
    return {
      body: render(template, variables),
      language: selectedLanguage,
      missingVariables,
      templateName
    };
  },

  getCustomerLanguage(tenantId, customerId) {
    if (!tenantId || !customerId) return "en";
    const row = db.prepare("SELECT preferredLanguage FROM clients WHERE id = ? AND tenantId = ?").get(customerId, tenantId);
    return normalizeLanguage(row?.preferredLanguage || "en");
  },

  getOptOutStatus(tenantId, customerId) {
    if (!tenantId || !customerId) return false;
    const row = db.prepare("SELECT preferredChannel FROM clients WHERE id = ? AND tenantId = ?").get(customerId, tenantId);
    return String(row?.preferredChannel || "").toLowerCase() === "no_communication";
  }
};
