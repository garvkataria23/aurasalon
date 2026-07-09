import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../server/db.js";
import { aiMarketingService } from "../server/services/ai-marketing.service.js";
import { resourceService } from "../server/services/resource.service.js";
import { customer360Service } from "../server/services/customer-360.service.js";

const clientId = "test_masked_marketing_client";
const tenantId = "tenant_aura";
const branchId = "branch_hyd";

function access(role) {
  return { tenantId, branchId, role, userId: `test_${role}`, branchIds: [branchId] };
}

function seedClient() {
  db.prepare("DELETE FROM clients WHERE id = @id AND tenantId = @tenantId").run({ id: clientId, tenantId });
  db.prepare(`
    INSERT INTO clients (id, tenantId, branchId, name, phone, email, createdAt, updatedAt)
    VALUES (@id, @tenantId, @branchId, @name, @phone, @email, @createdAt, @updatedAt)
  `).run({
    id: clientId,
    tenantId,
    branchId,
    name: "Masked Marketing Client",
    phone: "9876543210",
    email: "masked.client@example.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

test("marketing leads see masked client contacts", () => {
  seedClient();
  const row = resourceService.get("clients", clientId, access("marketingLead"));

  assert.equal(row.contactMasked, true);
  assert.equal(row.phone, "******3210");
  assert.equal(row.email, "m***@example.com");
});

test("privileged users still see raw client contacts", () => {
  seedClient();
  const row = resourceService.get("clients", clientId, access("owner"));

  assert.equal(row.contactMasked, undefined);
  assert.equal(row.phone, "9876543210");
  assert.equal(row.email, "masked.client@example.com");
});

test("marketing segment previews keep contacts masked", () => {
  seedClient();
  const segment = aiMarketingService.segment({ minVisits: 0, branchId }, access("marketingLead"));
  const row = segment.clients.find((client) => client.id === clientId);

  assert.ok(row);
  assert.equal(row.contactMasked, true);
  assert.equal(row.phone, "******3210");
  assert.equal(row.email, "m***@example.com");
});

test("marketing leads see masked client profile in customer360", () => {
  seedClient();
  const profile = customer360Service.profile(clientId, access("marketingLead"));

  assert.equal(profile.client.contactMasked, true);
  assert.equal(profile.client.phone, "******3210");
  assert.equal(profile.client.email, "m***@example.com");
});
