import { createHash, randomUUID } from "node:crypto";
import { db } from "../../db.js";
import { env } from "../../config/env.js";
import { taskConfig } from "../../config/aiTasks.js";
import { redactAiInput } from "./piiRedactor.js";
import { aiGovernanceService } from "./aiGovernance.service.js";

const now = () => new Date().toISOString();
const money = (value) => Math.round((Number(value) || 0) * 1000000) / 1000000;

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function estimateTokens(value) {
  return Math.max(1, Math.ceil(String(value || "").length / 4));
}

function promptCharCount(...parts) {
  return parts.reduce((sum, part) => {
    const value = typeof part === "string" ? part : JSON.stringify(part || "");
    return sum + value.length;
  }, 0);
}

function changedByRedaction(original, redacted) {
  return JSON.stringify(original) !== JSON.stringify(redacted);
}

function estimateCostUsd(provider, model, inputTokens, outputTokens) {
  if (provider !== "openai") return 0;
  const lowered = String(model || "").toLowerCase();
  const inputPerMillion = lowered.includes("mini") ? 0.15 : 5;
  const outputPerMillion = lowered.includes("mini") ? 0.6 : 15;
  return money((inputTokens / 1_000_000) * inputPerMillion + (outputTokens / 1_000_000) * outputPerMillion);
}

function cacheKey({ taskKey, tenantId, systemPrompt, userPrompt, promptVersion, model }) {
  return hash(stableJson({ taskKey, tenantId, systemPrompt, userPrompt, promptVersion, model }));
}

function readCache(key) {
  const row = db.prepare("SELECT * FROM ai_response_cache WHERE cache_key = ? AND expires_at > ?").get(key, now());
  if (!row) return null;
  db.prepare("UPDATE ai_response_cache SET hit_count = hit_count + 1 WHERE cache_key = ?").run(key);
  return {
    output: safeJsonParse(row.output, {}),
    usage: safeJsonParse(row.usage, {}),
    model: row.model || "local-business-rules",
    promptVersion: row.prompt_version || "",
    provider: row.provider || "local"
  };
}

function writeCache({ key, taskKey, tenantId, output, usage, model, provider, promptVersion, ttl }) {
  const stamp = now();
  const expires = new Date(Date.now() + Number(ttl || 3600) * 1000).toISOString();
  db.prepare(`
    INSERT INTO ai_response_cache
      (cache_key, task_key, tenantId, output, usage, model, provider, prompt_version, created_at, expires_at, hit_count)
    VALUES
      (@cache_key, @task_key, @tenantId, @output, @usage, @model, @provider, @prompt_version, @created_at, @expires_at, 0)
    ON CONFLICT(cache_key) DO UPDATE SET
      output = excluded.output,
      usage = excluded.usage,
      model = excluded.model,
      provider = excluded.provider,
      prompt_version = excluded.prompt_version,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at
  `).run({
    cache_key: key,
    task_key: taskKey,
    tenantId,
    output: JSON.stringify(output || {}),
    usage: JSON.stringify(usage || {}),
    model,
    provider,
    prompt_version: promptVersion || "",
    created_at: stamp,
    expires_at: expires
  });
}

function todaySpend(tenantId) {
  return db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) AS spend
    FROM ai_cost_ledger
    WHERE tenantId = ? AND substr(created_at, 1, 10) = ?
  `).get(tenantId, now().slice(0, 10)).spend || 0;
}

function insertCostLedger({
  tenantId,
  branchId,
  taskKey,
  provider,
  model,
  usage,
  costUsd,
  cached,
  latencyMs,
  requestId
}) {
  db.prepare(`
    INSERT INTO ai_cost_ledger
      (tenantId, branchId, task_key, provider, model, input_tokens, output_tokens, cost_usd, cached, latency_ms, request_id, created_at)
    VALUES
      (@tenantId, @branchId, @task_key, @provider, @model, @input_tokens, @output_tokens, @cost_usd, @cached, @latency_ms, @request_id, @created_at)
  `).run({
    tenantId,
    branchId: branchId || "",
    task_key: taskKey,
    provider,
    model,
    input_tokens: Number(usage?.inputTokens || 0),
    output_tokens: Number(usage?.outputTokens || 0),
    cost_usd: Number(costUsd || 0),
    cached: cached ? 1 : 0,
    latency_ms: Number(latencyMs || 0),
    request_id: requestId || "",
    created_at: now()
  });
}

function localComplete(localOutput, userPrompt) {
  const output = localOutput || { text: "AI local fallback response generated." };
  const usage = {
    inputTokens: estimateTokens(userPrompt),
    outputTokens: estimateTokens(JSON.stringify(output))
  };
  return { output, usage };
}

function extractOpenAiText(data) {
  return data.output_text ||
    data.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join("\n") ||
    "";
}

function parseProviderOutput(text, localOutput) {
  const parsed = safeJsonParse(text);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return { ...localOutput, ...parsed };
  }
  return { ...localOutput, modelText: text };
}

async function callOpenAi({ systemPrompt, userPrompt, jsonSchema, model, temperature, maxTokens, signal, localOutput }) {
  const body = {
    model,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: typeof userPrompt === "string" ? userPrompt : JSON.stringify(userPrompt) }
    ],
    temperature: Number(temperature ?? 0.2),
    max_output_tokens: Number(maxTokens || 500)
  };
  if (jsonSchema) {
    body.text = {
      format: {
        type: "json_schema",
        name: "aura_ai_response",
        schema: jsonSchema,
        strict: false
      }
    };
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openaiApiKey}`
    },
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
  const data = await response.json();
  const text = extractOpenAiText(data);
  const output = parseProviderOutput(text, localOutput);
  const usage = {
    inputTokens: Number(data.usage?.input_tokens || data.usage?.inputTokens || estimateTokens(userPrompt)),
    outputTokens: Number(data.usage?.output_tokens || data.usage?.outputTokens || estimateTokens(text))
  };
  return { output, usage };
}

async function withTimeout(work, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(timeoutMs || 30000));
  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function complete({
  taskKey,
  systemPrompt = "",
  userPrompt = "",
  jsonSchema = null,
  temperature = 0.2,
  maxTokens = 500,
  tenantId,
  branchId = "",
  context = {},
  promptVersion = "v1",
  localOutput = null
}) {
  const requestId = randomUUID();
  const started = Date.now();
  const config = taskConfig(taskKey);
  const provider = env.aiProvider === "openai" && env.openaiApiKey ? "openai" : "local";
  const model = provider === "openai" ? env.openaiModel : "local-business-rules";
  if (tenantId) {
    aiGovernanceService.enforceUsageLimit({
      tenantId,
      branchId,
      taskKey,
      role: context?.access?.role || context?.role || ""
    });
  }
  const key = cacheKey({ taskKey, tenantId, systemPrompt, userPrompt, promptVersion, model });
  const maxPromptChars = Number(process.env.AI_MAX_PROMPT_CHARS || 12000);
  const promptChars = promptCharCount(systemPrompt, userPrompt);

  if (maxPromptChars > 0 && promptChars > maxPromptChars) {
    const { output, usage } = localComplete({ ...localOutput, providerWarning: "AI prompt exceeded safe length" }, userPrompt);
    const latencyMs = Date.now() - started;
    insertCostLedger({
      tenantId,
      branchId,
      taskKey,
      provider: "local",
      model: "local-business-rules",
      usage,
      costUsd: 0,
      cached: false,
      latencyMs,
      requestId
    });
    return { output, usage, cached: false, provider: "local", model: "local-business-rules", latencyMs, requestId, context };
  }

  if (config.cacheable) {
    const cached = readCache(key);
    if (cached) {
      const latencyMs = Date.now() - started;
      insertCostLedger({
        tenantId,
        branchId,
        taskKey,
        provider: cached.provider,
        model: cached.model,
        usage: cached.usage,
        costUsd: 0,
        cached: true,
        latencyMs,
        requestId
      });
      return { output: cached.output, usage: cached.usage, cached: true, provider: cached.provider, model: cached.model, latencyMs, requestId };
    }
  }

  const budget = Number(process.env.AI_COST_BUDGET_USD_PER_TENANT_PER_DAY || 5);
  if (provider !== "local" && budget >= 0 && todaySpend(tenantId) >= budget) {
    const { output, usage } = localComplete({ ...localOutput, providerWarning: "AI daily budget exceeded" }, userPrompt);
    const latencyMs = Date.now() - started;
    insertCostLedger({ tenantId, branchId, taskKey, provider: "local", model: "local-business-rules", usage, costUsd: 0, cached: false, latencyMs, requestId });
    return { output, usage, cached: false, provider: "local", model: "local-business-rules", latencyMs, requestId };
  }

  let result;
  let usedProvider = provider;
  let usedModel = model;
  let redactionChanged = false;
  try {
    if (provider === "openai") {
      const redactedSystemPrompt = redactAiInput(systemPrompt);
      const redactedUserPrompt = redactAiInput(userPrompt);
      redactionChanged = changedByRedaction(systemPrompt, redactedSystemPrompt) || changedByRedaction(userPrompt, redactedUserPrompt);
      const providerLocalOutput = redactionChanged
        ? { ...localOutput, providerWarning: "PII redacted before provider call" }
        : localOutput;
      const retries = Math.max(0, Number(process.env.AI_MAX_RETRIES || 2));
      let lastError = null;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          result = await withTimeout(
            (signal) => callOpenAi({
              systemPrompt: redactedSystemPrompt,
              userPrompt: redactedUserPrompt,
              jsonSchema,
              model,
              temperature,
              maxTokens,
              signal,
              localOutput: providerLocalOutput
            }),
            Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000)
          );
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError) throw lastError;
    } else {
      result = localComplete(localOutput, userPrompt);
    }
  } catch (error) {
    usedProvider = "local";
    usedModel = "local-business-rules";
    const providerWarning = redactionChanged
      ? `PII redacted before provider call; ${error.message}`
      : error.message;
    result = localComplete({ ...localOutput, providerWarning }, userPrompt);
  }

  const latencyMs = Date.now() - started;
  const costUsd = estimateCostUsd(usedProvider, usedModel, result.usage.inputTokens, result.usage.outputTokens);
  insertCostLedger({
    tenantId,
    branchId,
    taskKey,
    provider: usedProvider,
    model: usedModel,
    usage: result.usage,
    costUsd,
    cached: false,
    latencyMs,
    requestId
  });

  if (config.cacheable) {
    writeCache({
      key,
      taskKey,
      tenantId,
      output: result.output,
      usage: result.usage,
      model: usedModel,
      provider: usedProvider,
      promptVersion,
      ttl: config.ttl
    });
  }

  return {
    output: result.output,
    usage: result.usage,
    cached: false,
    provider: usedProvider,
    model: usedModel,
    latencyMs,
    requestId,
    context
  };
}
