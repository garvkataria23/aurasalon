import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/pages/clients.component.ts", "utf8");

test("client CRM exposes Salonist-style KPI, action, and column controls", () => {
  assert.match(page, /salonist-kpis/);
  assert.match(page, /Total Clients/);
  assert.match(page, /Old Client Visits This Month/);
  assert.match(page, /New Client Visits This Month/);
  assert.match(page, /Client Groups/);
  assert.match(page, /Sample File Download/);
  assert.match(page, /Import Client/);
  assert.match(page, /Edit Columns/);
  assert.match(page, /visibleColumnKeys/);
});

test("client CRM add/edit opens in a right-side drawer", () => {
  assert.match(page, /client-drawer/);
  assert.match(page, /Add Client/);
  assert.match(page, /Select Group/);
  assert.match(page, /FREE MEMBERSHIP/);
  assert.match(page, /MEMBERSHIP RENEW FEES/);
  assert.match(page, /SMS Notifications/);
  assert.match(page, /Whatsapp Notifications/);
  assert.match(page, /openCreateForm/);
});

test("client CRM row action menu includes Salonist actions", () => {
  assert.match(page, /row-action-menu/);
  assert.match(page, /History/);
  assert.match(page, /Delete/);
  assert.match(page, /Block/);
  assert.match(page, /Reset Password/);
  assert.match(page, /Add Notes/);
  assert.match(page, /blockClient/);
});
