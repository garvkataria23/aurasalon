import test from "node:test";
import assert from "node:assert/strict";
import "../server/db.js";
import { can } from "../server/middleware/rbac.js";

const access = { tenantId: "tenant_aura" };

test("owner can manage every resource", () => {
  assert.equal(can("owner", "admin", "security", access), true);
  assert.equal(can("owner", "write", "finance", access), true);
});

test("accountant can manage finance but not inventory writes", () => {
  assert.equal(can("accountant", "write", "finance", access), true);
  assert.equal(can("accountant", "write", "inventory", access), false);
});

test("inventory manager can write inventory but not finance", () => {
  assert.equal(can("inventoryManager", "write", "inventory", access), true);
  assert.equal(can("inventoryManager", "write", "finance", access), false);
});

test("custom roles are resolved from persisted permissions", () => {
  assert.equal(can("customMarketingLead", "write", "marketing", access), true);
  assert.equal(can("customMarketingLead", "write", "finance", access), false);
});
