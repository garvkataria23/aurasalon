import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const posPage = readFileSync("src/app/pages/pos.component.ts", "utf8");
const salonOperationsService = readFileSync("server/services/salon-operations.service.js", "utf8");

test("POS auto-applies and explains mapped membership redemptions", () => {
  assert.match(posPage, /autoSuggestMembershipRedemption\(/, "single matching service-credit benefits should auto-select");
  assert.match(posPage, /eligibleAutoCreditBenefits\(/, "POS should calculate matching visit, service, combo and unlimited benefits");
  assert.match(posPage, /membershipCreditAdjustmentAmount\(\)/, "mapped service credits should reduce invoice totals");
  assert.match(posPage, /membershipLineBenefitState\(/, "service rows should show credit, unlimited or conflict badges");
  assert.match(posPage, /serviceCreditEntryMatchesItem\(/, "service credits should match by id, name or category");
  assert.match(posPage, /Multiple membership benefits matched/, "multiple matching benefits should require manual selection");
});

test("Backend deducts nested service credits and records redemption audit history", () => {
  assert.match(salonOperationsService, /planServiceCreditRedemption\(/, "backend should normalize mapped redemption deductions");
  assert.match(salonOperationsService, /serviceCreditMatchesMapping\(/, "backend should validate selected services against service credit rows");
  assert.match(salonOperationsService, /nextServiceCredits\[index\]\.remaining = available - used/, "service credit remaining counts should reduce after redemption");
  assert.match(salonOperationsService, /unlimitedMonthlyUsage\(/, "unlimited benefits should check current-month fair usage");
  assert.match(salonOperationsService, /redeemedAt:\s*now\(\)/, "redeem history should include exact redemption timestamp");
  assert.match(salonOperationsService, /creditsBefore/, "redeem history should include before and after balances");
});
