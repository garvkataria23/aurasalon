import { qualityService } from "../server/services/quality.service.js";

const access = {
  tenantId: process.env.SEED_TENANT_ID || "tenant_aura",
  role: "owner",
  userId: "seed-script",
  branchId: process.env.SEED_BRANCH_ID || "branch_blr",
  branchIds: ["branch_blr", "branch_hyd"]
};

const result = qualityService.seedDemoData({ branchId: access.branchId }, access);
console.log(JSON.stringify({
  ok: true,
  branchId: access.branchId,
  created: result.run.result.created,
  runId: result.run.id
}, null, 2));
