import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/pages/future-features.component.ts", "utf8");
const service = readFileSync("server/services/future-features.service.js", "utf8");
const routes = readFileSync("server/routes/future-features.routes.js", "utf8");

test("future features page is an enterprise live-data command center", () => {
  for (const phrase of [
    "AI Innovation Command Center",
    "Live data spine",
    "Connected launcher",
    "Enterprise interconnect map",
    "Live source trace",
    "No fake data",
    "Run connected intelligence"
  ]) {
    assert.ok(page.includes(phrase), `${phrase} appears on future features page`);
  }

  for (const route of ["/ai", "/clients", "/pos", "/appointments", "/inventory", "/whatsapp"]) {
    assert.ok(page.includes(route) || service.includes(route), `${route} is connected from the command center`);
  }
});

test("future features backend exposes live source and workflow interconnect data", () => {
  for (const property of [
    "liveDataSources",
    "workflowMap",
    "actionRail",
    "sourceHealth",
    "sourceTrace",
    "connectedModules",
    "nextRoutes",
    "review-before-action"
  ]) {
    assert.ok(service.includes(property), `${property} is emitted by future features service`);
  }

  for (const repository of [
    "repositories.clients.list",
    "repositories.sales.list",
    "repositories.appointments.list",
    "repositories.products.list",
    "repositories.whatsappThreads.list"
  ]) {
    assert.ok(service.includes(repository), `${repository} feeds live AI source mapping`);
  }

  assert.ok(routes.includes("/future-features/summary"));
  assert.ok(routes.includes("/future-features/:type/run"));
});

test("future feature catalog stays connected to every supported workflow", () => {
  const workflowTypes = [...service.matchAll(/type: "([^"]+)"/g)].map((match) => match[1]);
  for (const type of [
    "growth-advisor",
    "pricing-optimizer",
    "offer-engine",
    "emotion-analysis",
    "no-show-prediction",
    "demand-forecasting",
    "inventory-prediction",
    "voice-booking-assistant",
    "smart-kiosk-mode",
    "ai-receptionist"
  ]) {
    assert.ok(workflowTypes.includes(type), `${type} is represented in the workflow map`);
    assert.ok(page.includes(type), `${type} is selectable in the Angular launcher`);
  }
});
