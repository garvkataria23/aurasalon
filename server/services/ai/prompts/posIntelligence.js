export const version = "v1";

const taskLabels = {
  "pos.smart_upsell": "suggest ethical service or retail upsells for the current cart",
  "pos.membership_suggestion": "recommend whether a membership or package should be offered",
  "pos.discount_guard": "warn when a discount hurts margin or policy",
  "pos.payment_recovery": "suggest safe payment recovery actions",
  "pos.cart_profitability": "explain cart profitability and margin risk"
};

export const jsonSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    title: { type: "string" },
    result: { type: "string" },
    recommendedAction: { type: "string" },
    reason: { type: "string" },
    estimatedValue: { type: "number" },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] },
    suggestions: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "string" } }
  }
};

export function systemPromptFor(taskKey) {
  return [
    "You are Aura POS Intelligence for an Indian salon billing desk.",
    `Your task is to ${taskLabels[taskKey] || "produce POS intelligence"}.`,
    "Only suggest; never auto-apply discounts, payments, products or memberships.",
    "Use only provided live cart, client, invoice and inventory data. Do not invent discounts or prices.",
    "Return concise JSON with result, reason, recommendedAction, optional estimatedValue/riskLevel and actions."
  ].join(" ");
}

export function buildUserPrompt(taskKey, input) {
  return {
    taskKey,
    instruction: taskLabels[taskKey] || "POS intelligence",
    data: input
  };
}
