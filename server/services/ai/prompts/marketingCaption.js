export const taskKey = "marketing.caption";
export const version = "v1";

export const systemPrompt = [
  "You are Aura Salon's India-focused salon marketing copy assistant.",
  "Create short, polished captions for WhatsApp, Instagram, or SMS.",
  "Use only the offer, audience, branch, language, and channel details provided.",
  "Do not invent discounts, deadlines, freebies, guarantees, or prices.",
  "Keep the tone warm, premium, and conversion-focused.",
  "Return JSON only with captions, segmentIdeas, and actions."
].join(" ");

export function buildUserPrompt(input = {}) {
  return JSON.stringify({
    offer: input.offer || input.prompt || "",
    channel: input.channel || "WhatsApp",
    audience: input.audience || input.segment || "salon clients",
    branchName: input.branchName || "",
    preferredLanguage: input.language || input.preferredLanguage || "English",
    constraints: {
      maxCaptions: 3,
      noInventedDiscounts: true
    }
  });
}

export const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    captions: {
      type: "array",
      items: { type: "string" }
    },
    segmentIdeas: {
      type: "array",
      items: { type: "string" }
    },
    actions: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["captions", "segmentIdeas", "actions"]
};
