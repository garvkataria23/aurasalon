import { repositories } from "../repositories/repository-registry.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sameDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export function scoreSlot(slot, context = {}) {
  const breakdown = {};
  const add = (rule, points) => {
    if (points) breakdown[rule] = points;
  };

  add("preferredStaffMatch", slot.staffId && slot.staffId === context.preferredStaffId ? 20 : 0);

  if (context.customerId && slot.staffId) {
    const history = repositories.appointments
      .list({ branchId: context.branchId, limit: 10000 }, { tenantId: context.tenantId, branchId: context.branchId })
      .filter((appointment) => appointment.clientId === context.customerId && appointment.staffId === slot.staffId && appointment.status === "completed");
    add("historicalStaffMatch", history.length >= 3 ? 15 : 0);
  }

  const staffDayLoad = repositories.appointments
    .list({ branchId: context.branchId, limit: 10000 }, { tenantId: context.tenantId, branchId: context.branchId })
    .filter((appointment) => appointment.staffId === slot.staffId && appointment.startAt?.startsWith(sameDay(slot.startAt || slot.startTime))).length;
  add("mediumLoadStaff", staffDayLoad >= 2 && staffDayLoad <= 5 ? 5 : 0);
  add("staffOverloaded", staffDayLoad > 8 ? -15 : 0);

  if (context.noShowCount >= 2) add("lateNoShowRiskCustomer", -25);
  if (context.isFirstTime && !context.depositCaptured) add("newClientNoDeposit", -15);

  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 50);
  const positives = Object.values(breakdown).filter((value) => value > 0).length;
  const negatives = Object.values(breakdown).filter((value) => value < 0).length;
  const confidence = clamp(50 + positives * 10 - negatives * 10, 0, 100);
  const badges = [];
  if (breakdown.preferredStaffMatch) badges.push("preferred_staff");
  if (breakdown.historicalStaffMatch) badges.push("best_match");
  if (breakdown.mediumLoadStaff) badges.push("balanced_load");
  if (confidence >= 75) badges.push("high_confidence");

  return { score: clamp(score, 0, 100), confidence, breakdown, badges };
}
