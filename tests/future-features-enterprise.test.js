import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/pages/future-features.component.ts", "utf8");
const workflowPage = readFileSync("src/app/pages/future-workflow.component.ts", "utf8");
const appRoutes = readFileSync("src/app/app.routes.ts", "utf8");
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
    "voice-receptionist",
    "dynamic-pricing",
    "smart-kiosk-mode",
    "ai-receptionist",
    "franchise-os",
    "smart-forms",
    "marketplace"
  ]) {
    assert.ok(workflowTypes.includes(type), `${type} is represented in the workflow map`);
    assert.ok(page.includes(type), `${type} is selectable in the Angular launcher`);
  }
});

test("future feature stubs open a live workflow surface instead of generic CRUD shells", () => {
  for (const route of ["voice-receptionist", "dynamic-pricing", "franchise", "smart-forms", "app-marketplace"]) {
    const routeLine = appRoutes.split("\n").find((line) => line.includes(`path: '${route}'`)) || "";
    assert.ok(routeLine.includes("FutureWorkflowComponent"), `${route} loads the live workflow component`);
    assert.ok(!routeLine.includes("component: ModulePageComponent"), `${route} is no longer a CRUD shell`);
  }

  for (const endpoint of [
    "voice-receptionist/calls",
    "dynamicPricingRules",
    "franchise-os/units",
    "smartForms",
    "formResponses",
    "marketplace/plugins",
    "marketplace/connectors"
  ]) {
    assert.ok(appRoutes.includes(endpoint), `${endpoint} is wired as a live source endpoint`);
  }
});

test("future workflow page runs live AI workflows and shows connected records", () => {
  for (const phrase of [
    "future-features/summary",
    "future-features/${this.config.workflowType}/run",
    "primaryEndpoint",
    "secondaryEndpoint",
    "Live source trace",
    "Connected records",
    "Generated output",
    "Approval",
    "Save draft",
    "saveDraft(draft)"
  ]) {
    assert.ok(workflowPage.includes(phrase), `${phrase} is present on the future workflow page`);
  }
});

test("future workflows expose advanced approval flow, action plan and draft payloads", () => {
  for (const property of [
    "approvalFlow",
    "actionPlan",
    "draftPayloads",
    "review-before-action",
    "ready_for_review"
  ]) {
    assert.ok(service.includes(property), `${property} should be emitted by advanced future workflows`);
  }

  for (const endpoint of [
    'endpoint: "dynamicPricingRules"',
    'endpoint: "voice-receptionist/calls"',
    'endpoint: "franchise-os/units"',
    'endpoint: "smartForms"',
    'endpoint: "marketplace/connectors"'
  ]) {
    assert.ok(service.includes(endpoint), `${endpoint} draft save target should exist`);
  }
});
