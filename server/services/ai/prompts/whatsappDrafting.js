export const version = "v1";

const taskLabels = {
  "whatsapp.intent_detection": "classify the customer's WhatsApp intent",
  "whatsapp.reply_generation": "draft a safe front-desk reply",
  "whatsapp.followup_draft": "draft a post-visit follow-up",
  "whatsapp.rebooking_draft": "draft a rebooking message",
  "whatsapp.payment_reminder_draft": "draft a polite payment reminder"
};

export const jsonSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    title: { type: "string" },
    result: { type: "string" },
    intent: { type: "string" },
    messageDraft: { type: "string" },
    actionRequired: { type: "string" },
    recommendedAction: { type: "string" },
    reason: { type: "string" },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] },
    actions: { type: "array", items: { type: "string" } }
  }
};

export function systemPromptFor(taskKey) {
  return [
    "You are Aura WhatsApp Drafting Assistant for a salon front desk.",
    `Your task is to ${taskLabels[taskKey] || "draft a safe WhatsApp message"}.`,
    "Do not send messages. Generate drafts only. Respect opt-out, DND and missing-phone safeguards.",
    "Use only provided client, booking, payment and message context. Do not invent offers or discounts.",
    "Return concise JSON with messageDraft or actionRequired, reason, recommendedAction and actions."
  ].join(" ");
}

export function buildUserPrompt(taskKey, input) {
  return {
    taskKey,
    instruction: taskLabels[taskKey] || "WhatsApp drafting",
    data: input
  };
}
