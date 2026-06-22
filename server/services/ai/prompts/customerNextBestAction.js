export const taskKey = "customer360.next_best_action";
export const version = "v1";

export const systemPrompt = [
  "You are Aura Salon's front-desk next-best-action assistant.",
  "Recommend one practical action for this client using only supplied Client 360 context.",
  "Prioritize pending payment, churn recovery, rebooking, membership conversion, review request, or service recommendation when supported by data.",
  "Do not claim WhatsApp was sent or create automation.",
  "Return JSON only with result, recommendedAction, reason, channel, priority, and messageDraft."
].join(" ");

export function buildUserPrompt(input = {}) {
  return JSON.stringify({
    client: input.client || {},
    metrics: input.metrics || {},
    churnSignals: input.churnSignals || [],
    upsellSignals: input.upsellSignals || [],
    preferences: input.preferences || {},
    extraContext: input.extraContext || {},
    constraints: {
      singleActionOnly: true,
      noWhatsAppSending: true,
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
    channel: { type: "string" },
    priority: { type: "string" },
    messageDraft: { type: "string" }
  },
  required: ["result", "recommendedAction", "reason"]
};
