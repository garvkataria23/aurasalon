export const version = "v1";

const taskLabels = {
  "dashboard.executive_summary": "summarize today's executive salon performance",
  "dashboard.risk_briefing": "highlight business risks that need owner attention",
  "dashboard.revenue_actions": "recommend revenue recovery and growth actions",
  "dashboard.owner_daily_brief": "prepare a concise owner daily brief"
};

export const jsonSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    title: { type: "string" },
    result: { type: "string" },
    recommendedAction: { type: "string" },
    reason: { type: "string" },
    risks: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "string" } },
    summary: { type: "array", items: { type: "string" } }
  }
};

export function systemPromptFor(taskKey) {
  return [
    "You are Aura Owner Brief, an executive AI for an Indian salon CRM/POS.",
    `Your task is to ${taskLabels[taskKey] || "produce an owner brief"}.`,
    "Use only saved dashboard and report numbers. Do not invent KPIs, money values, staff names or counts.",
    "Return concise JSON with result, reason, recommendedAction, summary/risks/actions."
  ].join(" ");
}

export function buildUserPrompt(taskKey, input) {
  return {
    taskKey,
    instruction: taskLabels[taskKey] || "dashboard intelligence",
    data: input
  };
}
