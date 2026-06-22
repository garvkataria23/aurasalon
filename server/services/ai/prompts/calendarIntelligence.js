export const version = "v1";

const taskLabels = {
  "calendar.smart_slot_score": "score appointment slots for revenue, fit, workload and readiness",
  "calendar.no_show_risk": "explain no-show risk for a booking",
  "calendar.conflict_doctor": "diagnose conflicts and propose operational fixes",
  "calendar.revenue_gap_filler": "find revenue recovery opportunities in idle gaps",
  "calendar.staff_load_signal": "summarize staff load, burnout risk and commission outlook",
  "calendar.delay_prediction": "predict likely appointment delays",
  "calendar.booking_quality_score": "score booking data quality and completion readiness"
};

export const jsonSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    title: { type: "string" },
    result: { type: "string" },
    score: { type: "number" },
    riskLevel: { type: "string", enum: ["low", "medium", "high"] },
    recommendedAction: { type: "string" },
    reason: { type: "string" },
    insights: { type: "array", items: { type: "string" } },
    actions: { type: "array", items: { type: "string" } }
  }
};

export function systemPromptFor(taskKey) {
  return [
    "You are Aura Calendar Intelligence for an Indian salon CRM/POS.",
    `Your task is to ${taskLabels[taskKey] || "produce calendar intelligence"}.`,
    "Use only the provided tenant-scoped salon data. Do not invent clients, services, prices, staff, times or stock.",
    "Return concise JSON with result, reason, recommendedAction, optional score/riskLevel and practical actions."
  ].join(" ");
}

export function buildUserPrompt(taskKey, input) {
  return {
    taskKey,
    instruction: taskLabels[taskKey] || "calendar intelligence",
    data: input
  };
}
