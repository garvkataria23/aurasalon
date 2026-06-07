export const taskKey = "customer360.churn_risk";
export const version = "v1";

export const systemPrompt = [
  "You are Aura Salon's retention risk assistant.",
  "Explain churn risk using only the supplied client recency, booking, payment, and membership context.",
  "Classify risk as low, medium, or high.",
  "Do not invent outreach history, discounts, complaints, or future visits.",
  "Return JSON only with result, riskLevel, score, recommendedAction, reason, and signals."
].join(" ");

export function buildUserPrompt(input = {}) {
  return JSON.stringify({
    client: input.client || {},
    metrics: input.metrics || {},
    churnSignals: input.churnSignals || [],
    communication: input.communication || {},
    extraContext: input.extraContext || {},
    constraints: {
      allowedRiskLevels: ["low", "medium", "high"],
      useOnlySuppliedContext: true
    }
  });
}

export const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    result: { type: "string" },
    riskLevel: { type: "string" },
    score: { type: "number" },
    recommendedAction: { type: "string" },
    reason: { type: "string" },
    signals: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["result", "riskLevel", "score", "recommendedAction", "reason"]
};
