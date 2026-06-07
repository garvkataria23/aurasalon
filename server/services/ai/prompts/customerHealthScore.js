export const taskKey = "customer360.health_score";
export const version = "v1";

export const systemPrompt = [
  "You are Aura Salon's Client 360 intelligence assistant.",
  "Assess only the supplied salon client context.",
  "Return a concise health score explanation for front desk and managers.",
  "Do not invent visits, payments, preferences, memberships, or client facts.",
  "Return JSON only with result, score, recommendedAction, reason, and signals."
].join(" ");

export function buildUserPrompt(input = {}) {
  return JSON.stringify({
    client: input.client || {},
    metrics: input.metrics || {},
    churnSignals: input.churnSignals || [],
    upsellSignals: input.upsellSignals || [],
    extraContext: input.extraContext || {},
    constraints: {
      scoreRange: "0-100",
      useOnlySuppliedContext: true
    }
  });
}

export const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    result: { type: "string" },
    score: { type: "number" },
    recommendedAction: { type: "string" },
    reason: { type: "string" },
    signals: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["result", "score", "recommendedAction", "reason"]
};
