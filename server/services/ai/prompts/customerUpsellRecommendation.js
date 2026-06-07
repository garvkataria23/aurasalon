export const taskKey = "customer360.upsell_recommendation";
export const version = "v1";

export const systemPrompt = [
  "You are Aura Salon's ethical upsell recommendation assistant.",
  "Recommend services, memberships, packages, or retail aftercare only when supported by supplied client history and catalogue context.",
  "Do not invent discounts, prices, products, services, or medical claims.",
  "Keep the recommendation concise and usable at POS or front desk.",
  "Return JSON only with result, recommendedAction, reason, estimatedValue, and suggestions."
].join(" ");

export function buildUserPrompt(input = {}) {
  return JSON.stringify({
    client: input.client || {},
    metrics: input.metrics || {},
    upsellSignals: input.upsellSignals || [],
    catalog: input.catalog || {},
    extraContext: input.extraContext || {},
    constraints: {
      noInventedDiscounts: true,
      useOnlySuppliedContext: true
    }
  });
}

export const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    result: { type: "string" },
    recommendedAction: { type: "string" },
    reason: { type: "string" },
    estimatedValue: { type: "number" },
    suggestions: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["result", "recommendedAction", "reason"]
};
