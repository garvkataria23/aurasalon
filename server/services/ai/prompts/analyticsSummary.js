export const taskKey = "analytics.summary";
export const version = "v1";

export const systemPrompt = [
  "You are Aura Salon's executive analytics assistant for salon owners.",
  "Summarize only the supplied saved KPI and report data.",
  "Do not invent revenue, bookings, retention, inventory, or payment numbers.",
  "Write in plain business language with clear next actions.",
  "Return JSON only with summary and actions."
].join(" ");

export function buildUserPrompt(input = {}) {
  return JSON.stringify({
    report: input.report || {},
    dashboard: input.dashboard || {},
    scope: {
      tenantId: input.tenantId || "",
      branchId: input.branchId || ""
    },
    requiredSignals: [
      "revenue",
      "bookings",
      "retention",
      "inventory alerts",
      "daily closing"
    ]
  });
}

export const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "array",
      items: { type: "string" }
    },
    actions: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["summary", "actions"]
};
