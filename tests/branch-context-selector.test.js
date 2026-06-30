import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appComponent = readFileSync("src/app/app.component.ts", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

test("topbar context selector applies branch changes only on Apply", () => {
  assert.match(appComponent, /draftBranchId/);
  assert.match(appComponent, /applyContextPanel/);
  assert.match(appComponent, /toggleContextPanel/);
  assert.match(appComponent, /\[ngModel\]="draftBranchId\(\)"/);
  assert.match(appComponent, /\(ngModelChange\)="draftBranchId\.set\(\$event\)"/);
  assert.match(appComponent, /if \(tenantChanged \|\| branchChanged\) this\.state\.setBranch\(this\.draftBranchId\(\)\)/);
});

test("topbar native selects force readable light dropdown colors", () => {
  assert.match(styles, /\.topbar-detail-group select[\s\S]*color-scheme: light/);
  assert.match(styles, /\.topbar-detail-group select option[\s\S]*background: #FFFFFF/i);
  assert.match(styles, /\.topbar-detail-panel[\s\S]*overflow: visible/);
});
