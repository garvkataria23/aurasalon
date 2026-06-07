import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appShell = readFileSync("src/app/app.component.ts", "utf8");
const appRoutes = readFileSync("src/app/app.routes.ts", "utf8");
const proxyConfig = readFileSync("proxy.conf.json", "utf8");

test("AI Platform sidebar keeps all 19 modules routed and proxy-safe", () => {
  const aiBlock = appShell.match(/id: 'ai-platform'[\s\S]*?items: \[([\s\S]*?)\n\s*\]/)?.[1] || "";
  const paths = [...aiBlock.matchAll(/path: '([^']+)'/g)].map((match) => match[1]);

  assert.equal(paths.length, 19, "AI Platform should expose 19 sidebar modules");
  assert.ok(paths.includes("/developer-api"), "API Platform uses a non-/api route so Angular dev proxy does not intercept it");
  assert.ok(!paths.includes("/api-platform"), "AI sidebar must not link to /api-platform because proxy.conf.json catches /api* paths");
  assert.match(proxyConfig, /"\/api"/, "dev proxy still owns API calls");

  for (const path of paths) {
    assert.ok(appRoutes.includes(`path: '${path.slice(1)}'`), `${path} has an Angular route`);
  }
});
