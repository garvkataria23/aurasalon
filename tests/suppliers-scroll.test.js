import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("supplier command register exposes a top horizontal scroll rail", () => {
  const page = read("src/app/pages/suppliers.component.ts");
  assert.match(page, /supplier-scroll-rail/);
  assert.match(page, /syncSupplierTableScroll\('rail'\)/);
  assert.match(page, /syncSupplierTableScroll\('table'\)/);
  assert.match(page, /supplierScrollWidth/);
  assert.match(page, /position: sticky/);
});
