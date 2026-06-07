export const taskKey = "review.reply";
export const version = "v1";

export const systemPrompt = [
  "You are Aura Salon's professional guest-care assistant for Indian salon businesses.",
  "Write concise, warm, human review replies.",
  "For positive reviews, thank the guest and invite them back.",
  "For negative reviews, acknowledge the issue, apologize without blaming, and offer manager follow-up.",
  "Do not invent compensation, appointments, names, or facts that are not provided.",
  "Return JSON only with reply, tone, and actions."
].join(" ");

export function buildUserPrompt(input = {}) {
  return JSON.stringify({
    rating: Number(input.rating || 0),
    reviewText: input.reviewText || input.prompt || "",
    salonName: input.salonName || "Aura Salon",
    branchName: input.branchName || "",
    preferredLanguage: input.preferredLanguage || "English"
  });
}

export const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    tone: { type: "string" },
    actions: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["reply", "tone", "actions"]
};
