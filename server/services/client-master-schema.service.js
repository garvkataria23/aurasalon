import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_TENANT_ID, db } from "../db.js";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPaths = [
  join(__dirname, "..", "db", "migrations", "20260531_client_master_definitions.sql")
];

let ensured = false;

export function ensureClientMasterSchema() {
  if (ensured) return;
  for (const migrationPath of migrationPaths) {
    db.exec(readFileSync(migrationPath, "utf8"));
  }
  seedDefaultClientMasters();
  ensured = true;
  logger.info("client_master_schema_ensured", {
    migrations: migrationPaths.map((migrationPath) => migrationPath.split(/[\\/]/).pop())
  });
}

function seedDefaultClientMasters() {
  const tenant = db.prepare("SELECT id FROM tenants WHERE id = ?").get(DEFAULT_TENANT_ID);
  if (!tenant) return;
  const stamp = new Date().toISOString();
  const base = { tenant_id: DEFAULT_TENANT_ID, branch_id: "", created_by: "system", created_at: stamp, updated_at: stamp };
  const categories = [
    { id: "ccat_default_new", code: "NEW", name: "New Client", description: "First-time client category", color: "#2563eb", discount_percent: 0, loyalty_multiplier: 1, visit_threshold: 0, spend_threshold: 0 },
    { id: "ccat_default_regular", code: "REGULAR", name: "Regular Client", description: "Repeat guest with standard loyalty", color: "#15803d", discount_percent: 0, loyalty_multiplier: 1.25, visit_threshold: 3, spend_threshold: 10000 },
    { id: "ccat_default_vip", code: "VIP", name: "VIP Client", description: "High value guest with elevated service rules", color: "#7c3aed", discount_percent: 10, loyalty_multiplier: 1.5, visit_threshold: 6, spend_threshold: 25000 }
  ];
  const sources = [
    { id: "csrc_default_walkin", code: "WALKIN", name: "Walk In", source_type: "walk_in", default_campaign_id: "", referral_required: 0, attribution_window_days: 1, notes: "" },
    { id: "csrc_default_referral", code: "REF", name: "Referral", source_type: "referral", default_campaign_id: "", referral_required: 1, attribution_window_days: 30, notes: "" },
    { id: "csrc_default_whatsapp", code: "WA", name: "WhatsApp", source_type: "whatsapp", default_campaign_id: "", referral_required: 0, attribution_window_days: 14, notes: "" },
    { id: "csrc_default_instagram", code: "IG", name: "Instagram", source_type: "instagram", default_campaign_id: "", referral_required: 0, attribution_window_days: 14, notes: "" },
    { id: "csrc_default_google", code: "GOOGLE", name: "Google", source_type: "google", default_campaign_id: "", referral_required: 0, attribution_window_days: 14, notes: "" }
  ];
  const preferences = [
    { id: "cpref_default_allergy", code: "ALLERGY", name: "Allergy Alert", preference_type: "allergy", options_json: JSON.stringify(["PPD", "Ammonia", "Fragrance", "Latex"]), risk_level: "high", consent_required: 1, notes: "" },
    { id: "cpref_default_skin", code: "SKIN", name: "Skin Sensitivity", preference_type: "skin", options_json: JSON.stringify(["Sensitive", "Acne prone", "Dry", "Oily"]), risk_level: "medium", consent_required: 1, notes: "" },
    { id: "cpref_default_contact", code: "CONTACT", name: "Communication Preference", preference_type: "communication", options_json: JSON.stringify(["WhatsApp", "Call", "SMS", "Email"]), risk_level: "none", consent_required: 0, notes: "" }
  ];
  const consultations = [
    {
      id: "cform_default_hair",
      code: "HAIRCONSULT",
      name: "Hair Consultation",
      template_type: "hair",
      sections_json: JSON.stringify([{ title: "Hair History", fields: ["Texture", "Chemical history", "Scalp condition", "Expected result"] }]),
      consent_required: 1,
      validity_days: 180,
      notes: ""
    },
    {
      id: "cform_default_skin",
      code: "SKINCONSULT",
      name: "Skin Consultation",
      template_type: "skin",
      sections_json: JSON.stringify([{ title: "Skin Assessment", fields: ["Sensitivity", "Allergies", "Medication", "Treatment goal"] }]),
      consent_required: 1,
      validity_days: 180,
      notes: ""
    }
  ];
  const feedback = [
    {
      id: "cfdbk_default_service",
      code: "SERVICE",
      name: "Service Feedback",
      feedback_type: "service",
      trigger_event: "service_completed",
      rating_scale: 5,
      questions_json: JSON.stringify([{ label: "Service quality", type: "rating", required: true }, { label: "Would you recommend us?", type: "yes_no", required: true }]),
      score_rules_json: JSON.stringify({ detractorBelow: 3, promoterAbove: 4 }),
      notes: ""
    },
    {
      id: "cfdbk_default_visit",
      code: "VISIT",
      name: "Visit Feedback",
      feedback_type: "visit",
      trigger_event: "visit_completed",
      rating_scale: 5,
      questions_json: JSON.stringify([{ label: "Overall visit experience", type: "rating", required: true }, { label: "Cleanliness", type: "rating", required: true }]),
      score_rules_json: JSON.stringify({ detractorBelow: 3, promoterAbove: 4 }),
      notes: ""
    }
  ];
  db.transaction(() => {
    for (const row of categories) {
      db.prepare(`INSERT OR IGNORE INTO client_category_master (
        id, tenant_id, branch_id, code, name, description, color, discount_percent,
        loyalty_multiplier, visit_threshold, spend_threshold, hide, status, version,
        created_by, created_at, updated_at
      ) VALUES (
        @id, @tenant_id, @branch_id, @code, @name, @description, @color, @discount_percent,
        @loyalty_multiplier, @visit_threshold, @spend_threshold, 0, 'active', 1,
        @created_by, @created_at, @updated_at
      )`).run({ ...base, ...row });
    }
    for (const row of sources) {
      db.prepare(`INSERT OR IGNORE INTO client_source_master (
        id, tenant_id, branch_id, code, name, source_type, default_campaign_id,
        referral_required, attribution_window_days, hide, notes, status, version,
        created_by, created_at, updated_at
      ) VALUES (
        @id, @tenant_id, @branch_id, @code, @name, @source_type, @default_campaign_id,
        @referral_required, @attribution_window_days, 0, @notes, 'active', 1,
        @created_by, @created_at, @updated_at
      )`).run({ ...base, ...row });
    }
    for (const row of preferences) {
      db.prepare(`INSERT OR IGNORE INTO client_preference_master (
        id, tenant_id, branch_id, code, name, preference_type, options_json, risk_level,
        consent_required, hide, notes, status, version, created_by, created_at, updated_at
      ) VALUES (
        @id, @tenant_id, @branch_id, @code, @name, @preference_type, @options_json, @risk_level,
        @consent_required, 0, @notes, 'active', 1, @created_by, @created_at, @updated_at
      )`).run({ ...base, ...row });
    }
    for (const row of consultations) {
      db.prepare(`INSERT OR IGNORE INTO client_consultation_template_master (
        id, tenant_id, branch_id, code, name, template_type, sections_json, consent_required,
        validity_days, hide, notes, status, version, created_by, created_at, updated_at
      ) VALUES (
        @id, @tenant_id, @branch_id, @code, @name, @template_type, @sections_json, @consent_required,
        @validity_days, 0, @notes, 'active', 1, @created_by, @created_at, @updated_at
      )`).run({ ...base, ...row });
    }
    for (const row of feedback) {
      db.prepare(`INSERT OR IGNORE INTO client_feedback_definition_master (
        id, tenant_id, branch_id, code, name, feedback_type, trigger_event, rating_scale,
        questions_json, score_rules_json, hide, notes, status, version, created_by,
        created_at, updated_at
      ) VALUES (
        @id, @tenant_id, @branch_id, @code, @name, @feedback_type, @trigger_event, @rating_scale,
        @questions_json, @score_rules_json, 0, @notes, 'active', 1, @created_by,
        @created_at, @updated_at
      )`).run({ ...base, ...row });
    }
  })();
}
