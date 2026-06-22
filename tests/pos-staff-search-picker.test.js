import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const posComponent = readFileSync("src/app/pages/pos.component.ts", "utf8");

test("POS invoice staff selector is searchable instead of a native dropdown", () => {
  assert.match(posComponent, /staffSearchText = '';/, "staff search text state should exist");
  assert.match(posComponent, /placeholder="Search staff by name, phone, role"/, "staff field should render as a search input");
  assert.match(posComponent, /setStaffSearch\(\$event\)/, "staff input should update search state");
  assert.match(posComponent, /filteredStaff\(\)/, "staff search should use filtered results");
  assert.match(posComponent, /selectStaff\(person\)/, "staff result click should select the staff member");
  assert.doesNotMatch(posComponent, /<select formControlName="staffId">/, "invoice staff selector should not be the browser dropdown");
});

test("POS search dropdowns are scoped as solid floating panels", () => {
  assert.match(posComponent, /client-search-results/, "client results should have a POS-specific results class");
  assert.match(posComponent, /staff-search-results/, "staff results should have a POS-specific results class");
  assert.match(posComponent, /z-index:\s*1000;/, "search results should float above lower POS fields");
  assert.match(posComponent, /background:\s*rgba\(255,\s*255,\s*255,\s*0\.98\);/, "search results should not be transparent over lower controls");
});

test("POS selected client input stays clean because KPI strip owns the detail", () => {
  assert.match(posComponent, /return String\(client\.name \|\| client\.phone \|\| client\.email \|\| client\.id \|\| 'Client'\);/, "selected client display should be name-only fallback text");
  assert.match(posComponent, /clientMembershipSearchSnapshot\(client\)/, "client intelligence can stay in the dropdown result context");
  assert.doesNotMatch(posComponent, /client\.phone \|\| client\.email \|\| client\.id\} - \$\{this\.clientMembershipSearchSnapshot/, "selected client display should not duplicate wallet or membership KPI details");
});

test("POS staff list filters inactive staff before search", () => {
  assert.match(posComponent, /staff:\s*this\.safeList\('staff-os\/staff',\s*this\.staffQueryParams\(\)\)/, "POS should load staff from Staff OS employee master");
  assert.doesNotMatch(posComponent, /staff:\s*this\.safeList\('staff',\s*\{\s*limit:\s*1000\s*\}\)/, "POS should not use the legacy staff resource for the invoice selector");
  assert.match(posComponent, /this\.staff\.set\(this\.activeStaff\(this\.normalizeStaffRows\(staff \|\| \[\],\s*branches \|\| \[\]\)\)\);/, "loaded Staff OS rows should be normalized and filtered");
  assert.match(posComponent, /inactiveStatuses = new Set\(\['archived', 'blocked', 'deleted', 'inactive'/, "inactive staff statuses should be excluded");
  assert.match(posComponent, /person\.active === false/, "boolean inactive staff should be excluded");
});

test("POS staff reloads from Staff OS when branch changes", () => {
  assert.match(posComponent, /branchControl\.valueChanges\.pipe\(distinctUntilChanged\(\)\)/, "branch selector should trigger scoped staff reloads");
  assert.match(posComponent, /this\.safeList\('staff-os\/staff',\s*this\.staffQueryParams\(branchId\)\)/, "branch reload should use Staff OS source");
  assert.match(posComponent, /clearUnavailableStaffSelection\(\)/, "staff selected from another branch should be cleared");
});
