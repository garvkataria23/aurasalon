import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appComponent = readFileSync("src/app/app.component.ts", "utf8");
const directive = readFileSync("src/app/shared/directives/auto-name-case.directive.ts", "utf8");

test("auto name-case directive is attached globally at the app root", () => {
  assert.match(appComponent, /AutoNameCaseDirective/, "App root should import the directive");
  assert.match(appComponent, /hostDirectives:\s*\[AutoNameCaseDirective\]/, "App root should host the global directive");
});

test("auto name-case targets add-form name fields and skips unsafe fields", () => {
  assert.match(directive, /selector:\s*'\[appAutoNameCase\]'/, "Directive selector should be stable");
  assert.match(directive, /document:input/, "Directive should listen globally for input events");
  for (const hint of ["name", "client", "staff", "service", "product", "brand", "supplier", "account", "category"]) {
    assert.ok(directive.includes(`'${hint}'`), `${hint} fields should be auto-formatted`);
  }
  for (const hint of ["email", "phone", "password", "token", "amount", "price", "date", "search", "sku", "url"]) {
    assert.ok(directive.includes(`'${hint}'`), `${hint} fields should be excluded`);
  }
  assert.match(directive, /key === 'id' \|\| key\.endsWith\('id'\)/, "ID fields should be excluded without blocking paid/account name fields");
});

test("name-case formatter makes first letter capital and remaining letters small", () => {
  assert.match(directive, /word\.charAt\(0\)\.toUpperCase\(\) \+ word\.slice\(1\)\.toLowerCase\(\)/, "Words should become Title Case");
  assert.match(directive, /\[A-Za-z\]\+\(\?:\['-\]\[A-Za-z\]\+\)\*/, "Formatter should handle hyphen/apostrophe name words");
  assert.match(directive, /dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/, "Directive should dispatch input so Angular forms receive normalized values");
});
