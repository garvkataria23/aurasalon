import { forbidden } from "../../utils/app-error.js";
import { aiGovernanceService } from "./aiGovernance.service.js";

const customer360Tasks = new Set([
  "customer360.health_score",
  "customer360.churn_risk",
  "customer360.next_best_action",
  "customer360.upsell_recommendation",
  "customer360.rebooking_recommendation"
]);

const calendarTasks = new Set([
  "calendar.smart_slot_score",
  "calendar.no_show_risk",
  "calendar.conflict_doctor",
  "calendar.revenue_gap_filler",
  "calendar.staff_load_signal",
  "calendar.delay_prediction",
  "calendar.booking_quality_score"
]);

const posTasks = new Set([
  "pos.smart_upsell",
  "pos.membership_suggestion",
  "pos.discount_guard",
  "pos.payment_recovery",
  "pos.cart_profitability"
]);

const inventoryTasks = new Set([
  "inventory.reorder_prediction",
  "inventory.expiry_waste_risk",
  "inventory.service_stock_readiness",
  "inventory.low_stock_reason",
  "inventory.purchase_plan"
]);

const whatsappTasks = new Set([
  "whatsapp.intent_detection",
  "whatsapp.reply_generation",
  "whatsapp.followup_draft",
  "whatsapp.rebooking_draft",
  "whatsapp.payment_reminder_draft",
  "whatsapp.agent_triage"
]);

const dashboardTasks = new Set([
  "dashboard.executive_summary",
  "dashboard.risk_briefing",
  "dashboard.revenue_actions",
  "dashboard.owner_daily_brief"
]);

const governanceTasks = new Set([
  "knowledge.search_summary",
  "automation.suggestion",
  "prediction.client_churn",
  "prediction.no_show",
  "prediction.demand_forecast",
  "prediction.inventory_stockout",
  "prediction.revenue_leakage"
]);

const staffSafeCalendarTasks = new Set([
  "calendar.no_show_risk",
  "calendar.delay_prediction",
  "calendar.booking_quality_score"
]);

const migratedTasks = new Set([
  "review.reply",
  "marketing.caption",
  "analytics.summary",
  ...customer360Tasks,
  ...calendarTasks,
  ...posTasks,
  ...inventoryTasks,
  ...whatsappTasks,
  ...dashboardTasks,
  ...governanceTasks
]);
const fullAccessRoles = new Set(["owner", "admin", "superAdmin", "manager"]);
const contentRoles = new Set(["receptionist", "frontDesk", "staff"]);
const analyticsRoles = new Set(["analyst"]);
const customerActionRoles = new Set(["receptionist", "frontDesk", "staff"]);
const frontDeskRoles = new Set(["receptionist", "frontDesk"]);

export function assertAiTaskAllowed({ taskKey, tenantId, role }) {
  if (!migratedTasks.has(taskKey)) return true;
  if (!tenantId) throw forbidden("AI tenant context is required");
  aiGovernanceService.assertTaskOverride({ taskKey, tenantId, role });
  if (fullAccessRoles.has(role)) return true;
  if (taskKey === "analytics.summary" && analyticsRoles.has(role)) return true;
  if (customer360Tasks.has(taskKey) && analyticsRoles.has(role)) return true;
  if (dashboardTasks.has(taskKey) && analyticsRoles.has(role)) return true;
  if (governanceTasks.has(taskKey) && analyticsRoles.has(role)) return true;
  if (inventoryTasks.has(taskKey) && (analyticsRoles.has(role) || role === "inventoryManager")) return true;
  if (taskKey === "prediction.inventory_stockout" && role === "inventoryManager") return true;
  if (taskKey === "pos.payment_recovery" && role === "accountant") return true;
  if (taskKey === "prediction.revenue_leakage" && role === "accountant") return true;
  if (dashboardTasks.has(taskKey) && role === "accountant") return true;
  if (calendarTasks.has(taskKey) && frontDeskRoles.has(role)) return true;
  if (posTasks.has(taskKey) && frontDeskRoles.has(role)) return true;
  if (whatsappTasks.has(taskKey) && (frontDeskRoles.has(role) || role === "staff")) return true;
  if (taskKey === "prediction.no_show" && (frontDeskRoles.has(role) || role === "staff")) return true;
  if (staffSafeCalendarTasks.has(taskKey) && role === "staff") return true;
  if (
    (taskKey === "customer360.next_best_action" || taskKey === "customer360.rebooking_recommendation") &&
    customerActionRoles.has(role)
  ) return true;
  if ((taskKey === "review.reply" || taskKey === "marketing.caption") && contentRoles.has(role)) return true;
  aiGovernanceService.logDenial({
    tenantId,
    taskKey,
    role,
    reason: "Role is not allowed to run this AI task"
  });
  throw forbidden("You do not have permission to run this AI task");
}
