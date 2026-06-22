export const version = "v1";

const taskLabels = {
  "inventory.reorder_prediction": "predict reorder priorities from stock, sales and service usage",
  "inventory.expiry_waste_risk": "identify expiry and waste risk",
  "inventory.service_stock_readiness": "check if professional stock can support planned services",
  "inventory.low_stock_reason": "explain why low stock is happening",
  "inventory.purchase_plan": "prepare a short branch-safe purchase plan"
};

export const jsonSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    title: { type: "string" },
    result: { type: "string" },
    recommendedAction: { type: "string" },
    reason: { type: "string" },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] },
    products: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "string" } }
  }
};

export function systemPromptFor(taskKey) {
  return [
    "You are Aura Inventory Intelligence for a multi-branch salon.",
    `Your task is to ${taskLabels[taskKey] || "produce inventory intelligence"}.`,
    "Use only provided products, stock, expiry, transactions and service requirements.",
    "Do not invent suppliers, quantities or expiry dates. Keep the recommendation operational.",
    "Return concise JSON with result, reason, recommendedAction, riskLevel, products/suggestions and actions."
  ].join(" ");
}

export function buildUserPrompt(taskKey, input) {
  return {
    taskKey,
    instruction: taskLabels[taskKey] || "inventory intelligence",
    data: input
  };
}
