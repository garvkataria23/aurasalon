import test from "node:test";
import assert from "node:assert/strict";
import xlsx from "xlsx";

const { db } = await import("../server/db.js");
const {
  importKnowledgeWorkbook
} = await import("../server/services/ai/knowledgeSheetImporter.service.js");
const { knowledgeBaseService } = await import("../server/services/ai/knowledgeBase.service.js");

function ensureTenant(id) {
  const stamp = new Date().toISOString();
  const plan = db.prepare("SELECT id FROM subscription_plans ORDER BY createdAt ASC LIMIT 1").get();
  db.prepare(`
    INSERT OR IGNORE INTO tenants
      (id, name, slug, status, planId, subscriptionStatus, createdAt, updatedAt)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, `Importer Tenant ${id}`, id.replace(/_/g, "-"), "active", plan?.id || "", "active", stamp, stamp);
}

function ensureBranch(tenantId, id, city = "Mumbai") {
  const stamp = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO branches
      (id, tenantId, name, city, address, phone, status, createdAt, updatedAt)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, tenantId, `Branch ${id}`, city, "", "", "active", stamp, stamp);
}

function workbookWithRows({ answer = "Keratin aftercare requires sulphate-free shampoo.", includePrice = true } = {}) {
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
    ["Hair FAQ"],
    ["Category", "Question", "Answer"],
    ["Hair Treatments", "Keratin ke baad kya karein?", answer]
  ]), "Hair FAQ");
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
    ["Intent Router"],
    ["Priority", "Intent", "Trigger keywords / phrases", "Primary sheet", "Secondary sheet", "n8n route label", "Match rule", "Example user messages"],
    [1, "Hair Services", "keratin, smoothening, hair spa", "Hair FAQ", "Price List", "hair_services", "Use for hair service questions.", "keratin kitne ka?"]
  ]), "Intent Router");
  if (includePrice) {
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
      ["Price List"],
      ["Category", "Service", "Ladies", "Gents", "Duration"],
      ["Hair Treatments", "Keratin Treatment", "4500-8000", "", "120 min"]
    ]), "Price List");
  }
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
    ["Enquiry Tracker"],
    ["Client Name", "Phone / WhatsApp", "Service(s) Enquired"],
    ["Private Lead", "9999999999", "Keratin"]
  ]), "Enquiry Tracker");
  return workbook;
}

test("AuraShine workbook importer upserts FAQ/routing knowledge without cross-tenant or cross-branch leakage", () => {
  const tenantId = `tenant_import_${Date.now()}`;
  const otherTenantId = `${tenantId}_other`;
  const branchId = `branch_import_${Date.now()}`;
  const otherBranchId = `branch_other_${Date.now()}`;
  ensureTenant(tenantId);
  ensureTenant(otherTenantId);
  ensureBranch(tenantId, branchId);
  ensureBranch(tenantId, otherBranchId);
  const access = { tenantId, role: "owner", userId: "import-test", branchId, branchIds: [branchId] };

  const first = importKnowledgeWorkbook(workbookWithRows(), access, {
    branchId,
    sourceWorkbookId: "test-workbook",
    sourceWorkbookTitle: "AURASHINE SALON",
    syncStale: true
  });
  assert.equal(first.summary.created, 3);
  assert.equal(first.summary.updated, 0);
  assert.equal(first.summary.deleted, 0);
  assert.ok(first.skippedSheets.includes("Enquiry Tracker"));

  const branchSearch = knowledgeBaseService.search({ query: "keratin sulphate shampoo", branchId }, access);
  assert.ok(branchSearch.sources.some((source) => source.includes("Keratin ke baad kya karein")));

  const otherTenantSearch = knowledgeBaseService.search({ query: "keratin sulphate shampoo", branchId }, { ...access, tenantId: otherTenantId });
  assert.equal(otherTenantSearch.sources.length, 0);

  const otherBranchSearch = knowledgeBaseService.search({ query: "keratin sulphate shampoo", branchId: otherBranchId }, { ...access, branchId: otherBranchId, branchIds: [otherBranchId] });
  assert.ok(!otherBranchSearch.sources.some((source) => source.includes("Keratin ke baad kya karein")));

  const second = importKnowledgeWorkbook(workbookWithRows({
    answer: "Keratin aftercare requires sulphate-free shampoo and no wash for 72 hours.",
    includePrice: false
  }), access, {
    branchId,
    sourceWorkbookId: "test-workbook",
    sourceWorkbookTitle: "AURASHINE SALON",
    syncStale: true
  });
  assert.equal(second.summary.created, 0);
  assert.equal(second.summary.updated, 2);
  assert.equal(second.summary.deleted, 1);

  const count = db.prepare(`
    SELECT COUNT(*) AS count
    FROM ai_knowledge_documents
    WHERE tenantId = ? AND branchId = ? AND sourceType = 'google_sheet'
  `).get(tenantId, branchId).count;
  assert.equal(count, 2);

  const updatedSearch = knowledgeBaseService.search({ query: "72 hours no wash keratin", branchId }, access);
  assert.ok(updatedSearch.sources.some((source) => source.includes("Keratin ke baad kya karein")));
});
