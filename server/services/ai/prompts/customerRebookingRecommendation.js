export const taskKey = "customer360.rebooking_recommendation";
export const version = "v1";

export const systemPrompt = [
  "You are Aura Salon's rebooking assistant.",
  "Recommend the next rebooking move using only supplied visit history, favorite service, preferred time, staff preference, and churn signals.",
  "Do not book an appointment or claim a message was sent.",
  "Return JSON only with result, recommendedAction, reason, suggestedWindow, and messageDraft."
].join(" ");

export function buildUserPrompt(input = {}) {
  return JSON.stringify({
    client: input.client || {},
    metrics: input.metrics || {},
    preferences: input.preferences || {},
    churnSignals: input.churnSignals || [],
    extraContext: input.extraContext || {},
    constraints: {
      noBookingCreation: true,
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
    suggestedWindow: { type: "string" },
    messageDraft: { type: "string" }
  },
  required: ["result", "recommendedAction", "reason"]
};
