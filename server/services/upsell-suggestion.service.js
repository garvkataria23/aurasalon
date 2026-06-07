import { db } from "../db.js";

const rules = [
  { pattern: /color|keratin/i, suggestions: ["hair_wash", "shine_treatment", "finishing_blowdry"] },
  { pattern: /facial|skin/i, suggestions: ["face_wash", "eye_care", "de_tan"] },
  { pattern: /massage/i, suggestions: ["head_massage", "foot_massage"] },
  { pattern: /bridal|party/i, suggestions: ["trial_session", "nail_art", "makeup_setting"] },
  { pattern: /hair|cut|trim/i, suggestions: ["hair_spa", "blowdry"] }
];

export const upsellSuggestionService = {
  suggestAddOns(access, serviceIds = [], customerId = "") {
    const ids = Array.isArray(serviceIds) ? serviceIds : String(serviceIds || "").split(",").filter(Boolean);
    const services = ids.length
      ? db.prepare(`SELECT * FROM services WHERE tenantId = ? AND id IN (${ids.map(() => "?").join(",")})`).all(access.tenantId, ...ids)
      : [];
    const seen = new Set(ids);
    const suggestions = [];
    for (const service of services) {
      const text = `${service.name || ""} ${service.category || ""}`;
      for (const rule of rules) {
        if (!rule.pattern.test(text)) continue;
        for (const code of rule.suggestions) {
          if (seen.has(code)) continue;
          suggestions.push({
            code,
            reason: `Pairs well with ${service.name || service.category || "selected service"}`,
            confidence: "rule_based",
            transparent: true
          });
          seen.add(code);
        }
      }
    }
    return {
      customerId,
      requestedServiceIds: ids,
      suggestions: suggestions.slice(0, 8),
      note: "Rule-based suggestions only; no dynamic pricing or automatic blocking is applied."
    };
  }
};
