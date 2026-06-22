import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/pages/ai-assistant.component.ts", "utf8");
const routes = readFileSync("server/routes/ai.routes.js", "utf8");
const llmService = readFileSync("server/services/ai-assistant-llm.service.js", "utf8");

test("AI assistant page exposes governed enterprise cockpit and supported workflows", () => {
  for (const phrase of [
    "AI Enterprise Copilot Command Center",
    "Workflow router",
    "Governance rail",
    "Decision output",
    "Draft-first mode",
    "Human review queue",
    "Persisted AI history",
    "Prompt registry"
  ]) {
    assert.ok(page.includes(phrase), `${phrase} appears on AI assistant page`);
  }

  for (const endpoint of [
    "ai/observability",
    "ai/governance/settings",
    "ai/prompt-registry",
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

test("AI prompt registry exposes prompt versions, safety controls and local fallback status", () => {
  assert.match(routes, /\/ai\/prompt-registry/, "prompt registry route should be mounted");
  assert.match(routes, /requireAiAdmin\(req\.access\)[\s\S]*aiAssistantLlmService\.promptRegistry/, "prompt registry should require AI admin access");
  assert.match(llmService, /promptRegistry\(access\)/, "LLM service should expose a prompt registry");
  assert.match(llmService, /safetyPolicy:[\s\S]*piiRedaction:[\s\S]*rolePolicy:[\s\S]*promptLengthGuard:/, "registry should expose safety policy flags");
  assert.match(llmService, /fallbackMode:\s*"local-business-rules"/, "registry should expose local fallback mode");
  assert.match(llmService, /promptVersion:[\s\S]*prompt\.version/, "registry should expose prompt versions");
  assert.match(page, /promptRegistry = signal/, "AI page should hold prompt registry state");
  assert.match(page, /rows\(promptRegistry\(\)\?\.prompts\)/, "AI page should render registry prompts");
  assert.match(page, /PII redaction[\s\S]*Role policy[\s\S]*Usage limits/, "AI page should show safety controls");
});
