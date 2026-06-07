import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/pages/ai-assistant.component.ts", "utf8");

test("AI assistant page exposes governed enterprise cockpit and supported workflows", () => {
  for (const phrase of [
    "AI Enterprise Copilot Command Center",
    "Workflow router",
    "Governance rail",
    "Decision output",
    "Draft-first mode",
    "Human review queue",
    "Persisted AI history"
  ]) {
    assert.ok(page.includes(phrase), `${phrase} appears on AI assistant page`);
  }

  for (const endpoint of [
    "ai/observability",
    "ai/governance/settings",
    "ai/governance/task-overrides",
    "ai/automation/suggestions",
    "ai/whatsapp-agent/drafts",
    "ai/history"
  ]) {
    assert.ok(page.includes(endpoint), `${endpoint} is loaded by the AI assistant`);
  }

  const workflowIds = [...page.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  assert.ok(workflowIds.length >= 30, "AI assistant should expose the enterprise workflow catalog");
  assert.ok(workflowIds.includes("dashboard-owner-daily-brief"));
  assert.ok(workflowIds.includes("inventory-purchase-plan"));
  assert.ok(workflowIds.includes("whatsapp-payment-reminder-draft"));
  assert.ok(!workflowIds.includes("chatbot"), "legacy unsupported /ai/chatbot workflow should not be exposed");
});
