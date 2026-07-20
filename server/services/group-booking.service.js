import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { repositories } from "../repositories/repository-registry.js";
import { resourceService } from "./resource.service.js";
import { salonOperationsService } from "./salon-operations.service.js";
import { smartBookingService } from "./smart-booking.service.js";
import { tenantService } from "./tenant.service.js";

const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {}, "appointments");
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function minutesBetween(a, b) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60000;
}

function insertGroup(row) {
  db.prepare(`
    INSERT INTO booking_groups (
      id, tenantId, groupName, coordinatorCustomerId, groupType, parallelStart,
      consolidatedBilling, totalMembers, membersJson, planJson, status, updatedAt
    ) VALUES (
      @id, @tenantId, @groupName, @coordinatorCustomerId, @groupType, @parallelStart,
      @consolidatedBilling, @totalMembers, @membersJson, @planJson, @status, CURRENT_TIMESTAMP
    )
  `).run(row);
  return getGroupById(row.id, { tenantId: row.tenantId });
}

function getGroupById(id, access) {
  const row = db.prepare(`SELECT * FROM booking_groups WHERE id = ? AND tenantId = ?`).get(id, access.tenantId);
  if (!row) throw notFound("Booking group not found");
  return {
    ...row,
    members: parseJson(row.membersJson, []),
    plan: parseJson(row.planJson, []),
    confirmedSlots: parseJson(row.confirmedSlotsJson, [])
  };
}

function synchronizedPlan(memberRecommendations, parallelStart) {
  if (!memberRecommendations.length) return [];
  if (!parallelStart) {
    return [{
      strategy: "staggered",
      confidence: memberRecommendations.every((member) => member.recommendations.length) ? "high" : "low",
      slots: memberRecommendations.map((member) => ({
        memberIndex: member.memberIndex,
        customerId: member.customerId,
        serviceIds: member.serviceIds,
        slot: member.recommendations[0] || null
      }))
    }];
  }
  const [first, ...rest] = memberRecommendations;
  const plans = [];
  for (const candidate of first.recommendations.slice(0, 8)) {
    const slots = [{
      memberIndex: first.memberIndex,
      customerId: first.customerId,
      serviceIds: first.serviceIds,
      slot: candidate
    }];
    let ok = true;
    for (const member of rest) {
      const match = member.recommendations.find((slot) => minutesBetween(slot.startAt, candidate.startAt) <= 15);
      if (!match) {
        ok = false;
        break;
      }
      slots.push({
        memberIndex: member.memberIndex,
        customerId: member.customerId,
        serviceIds: member.serviceIds,
        slot: match
      });
    }
    if (ok) {
      plans.push({
        strategy: "parallel",
        confidence: "high",
        anchorStartAt: candidate.startAt,
        slots
      });
    }
    if (plans.length >= 5) break;
  }
  return plans;
}

export const groupBookingService = {
  createGroup(payload = {}, access) {
    const branchId = payload.branchId || access.branchId;
    if (!branchId) throw badRequest("branchId is required");
    tenantService.assertBranchAccess(access, branchId);
    if (!payload.coordinatorCustomerId && !payload.coordinatorClientId) throw badRequest("coordinatorCustomerId is required");
    const members = Array.isArray(payload.members) ? payload.members : [];
    if (!members.length) throw badRequest("At least one group member is required");
    const normalizedMembers = members.map((member, index) => {
      const customerId = member.customerId || member.clientId;
      const serviceIds = member.serviceIds || [member.serviceId].filter(Boolean);
      if (!customerId || !serviceIds.length) throw badRequest(`Member ${index + 1} needs customerId and serviceIds`);
      return { ...member, memberIndex: index, customerId, serviceIds };
    });
    const memberRecommendations = normalizedMembers.map((member) => {
      const result = smartBookingService.recommendSlots({
        branchId,
        clientId: member.customerId,
        serviceIds: member.serviceIds,
        staffId: member.preferredStaffId || member.staffId || "",
        date: payload.date,
        days: payload.days || 7,
        limit: payload.limit || 12,
        source: "group-booking"
      }, access);
      return {
        memberIndex: member.memberIndex,
        customerId: member.customerId,
        serviceIds: member.serviceIds,
        recommendations: result.recommendations || []
      };
    });
    const plan = synchronizedPlan(memberRecommendations, Number(payload.parallelStart ?? 1) === 1);
    const row = insertGroup({
      id: makeId("grp"),
      tenantId: access.tenantId,
      groupName: payload.groupName || "",
      coordinatorCustomerId: payload.coordinatorCustomerId || payload.coordinatorClientId,
      groupType: payload.groupType || "friends",
      parallelStart: Number(payload.parallelStart ?? 1) ? 1 : 0,
      consolidatedBilling: Number(payload.consolidatedBilling || 0) ? 1 : 0,
      totalMembers: normalizedMembers.length,
      membersJson: JSON.stringify(normalizedMembers),
      planJson: JSON.stringify(plan),
      status: plan.length ? "planning" : "needs-attention"
    });
    return { group: row, plan };
  },

  getGroup(groupId, access) {
    const group = getGroupById(groupId, access);
    const appointments = repositories.appointments
      .list({ limit: 10000 }, scope(access))
      .filter((appointment) => appointment.bookingGroupId === groupId);
    return { group, appointments };
  },

  confirmGroup(groupId, payload = {}, access, req = null) {
    const group = getGroupById(groupId, access);
    const slots = payload.confirmedSlots || payload.slots || group.plan?.[0]?.slots || [];
    if (!Array.isArray(slots) || !slots.length) throw badRequest("confirmedSlots are required");
    const membersByIndex = new Map((group.members || []).map((member) => [Number(member.memberIndex), member]));
    const created = [];
    const txn = db.transaction(() => {
      for (const item of slots) {
        const member = membersByIndex.get(Number(item.memberIndex)) || item;
        const slot = item.slot || item;
        if (!slot?.startAt) throw badRequest("Each confirmed slot needs startAt");
        const appointment = resourceService.create("appointments", {
          clientId: member.customerId || item.customerId,
          staffId: slot.staffId || member.staffId || "",
          branchId: slot.branchId || payload.branchId || access.branchId,
          serviceIds: member.serviceIds || item.serviceIds || [],
          startAt: slot.startAt,
          endAt: slot.endAt,
          status: payload.status || "booked",
          source: "group-booking",
          sourceChannel: "group",
          chair: slot.chair || member.chair || "",
          bookingGroupId: groupId,
          groupMemberRole: (member.customerId || item.customerId) === group.coordinatorCustomerId ? "coordinator" : "member",
          notes: [member.notes || "", `Group booking ${groupId}`].filter(Boolean).join(" | ")
        }, access, { req });
        created.push(appointment);
      }
      db.prepare(`
        UPDATE booking_groups
        SET status = 'confirmed', confirmedSlotsJson = @confirmedSlotsJson, updatedAt = CURRENT_TIMESTAMP
        WHERE id = @id AND tenantId = @tenantId
      `).run({ id: groupId, tenantId: access.tenantId, confirmedSlotsJson: JSON.stringify(slots) });
    });
    txn();
    return { group: getGroupById(groupId, access), appointments: created };
  },

  updateGroup(groupId, payload = {}, access) {
    getGroupById(groupId, access);
    const updates = {
      groupName: payload.groupName,
      groupType: payload.groupType,
      status: payload.status,
      consolidatedBilling: payload.consolidatedBilling === undefined ? undefined : Number(payload.consolidatedBilling) ? 1 : 0,
      parallelStart: payload.parallelStart === undefined ? undefined : Number(payload.parallelStart) ? 1 : 0,
      membersJson: payload.members ? JSON.stringify(payload.members) : undefined
    };
    const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (!entries.length) return this.getGroup(groupId, access);
    const setSql = entries.map(([key]) => `${key} = @${key}`).join(", ");
    db.prepare(`UPDATE booking_groups SET ${setSql}, updatedAt = CURRENT_TIMESTAMP WHERE id = @id AND tenantId = @tenantId`)
      .run(Object.fromEntries([...entries, ["id", groupId], ["tenantId", access.tenantId]]));
    return this.getGroup(groupId, access);
  },

  calendarView(groupId, access) {
    const { group, appointments } = this.getGroup(groupId, access);
    return {
      group,
      swimlanes: appointments.map((appointment) => ({
        appointmentId: appointment.id,
        customerId: appointment.clientId,
        staffId: appointment.staffId,
        serviceIds: appointment.serviceIds || [],
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        status: appointment.status
      }))
    };
  },

  consolidateGroupBilling(groupId, payload = {}, access) {
    const { group, appointments } = this.getGroup(groupId, access);
    if (!Number(group.consolidatedBilling || 0)) throw conflict("Group is not configured for consolidated billing");
    if (!appointments.length) throw badRequest("No group appointments found");
    const items = appointments.flatMap((appointment) => (appointment.serviceIds || []).map((serviceId) => ({
      type: "service",
      id: serviceId,
      quantity: 1
    })));
    if (!items.length) throw badRequest("No billable services found for group");
    return salonOperationsService.checkoutSale({
      clientId: group.coordinatorCustomerId,
      branchId: payload.branchId || appointments[0]?.branchId || access.branchId,
      staffId: payload.staffId || appointments[0]?.staffId || "",
      items,
      payments: payload.payments || [],
      notes: `Consolidated bill for group ${groupId}`
    }, access);
  }
};
