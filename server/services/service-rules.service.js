import { db } from "../db.js";
import { repositories } from "../repositories/repository-registry.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
}

function pairKey(a, b) {
  return [a, b].sort().join("::");
}

function daysBetween(a, b) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

export const serviceRulesService = {
  resolveServiceChain(tenantId, requestedServiceIds = []) {
    const ids = [...new Set((requestedServiceIds || []).filter(Boolean))];
    if (!ids.length) throw badRequest("At least one service is required");
    const final = ids.map((serviceId, index) => ({ serviceId, isAuto: false, isChargeable: true, position: index }));
    const seen = new Set(ids);
    for (const serviceId of ids) {
      const deps = db.prepare(
        `SELECT * FROM service_dependencies
         WHERE tenantId = ? AND serviceId = ? AND autoAdd = 1
         ORDER BY dependencyType ASC, createdAt ASC`
      ).all(tenantId, serviceId);
      for (const dep of deps) {
        if (seen.has(dep.requiredServiceId)) continue;
        seen.add(dep.requiredServiceId);
        const item = {
          serviceId: dep.requiredServiceId,
          parentServiceId: serviceId,
          dependencyType: dep.dependencyType,
          isAuto: true,
          isChargeable: Number(dep.isChargeable || 0) === 1,
          position: dep.dependencyType === "required_before" ? -1 : final.length + 1
        };
        if (dep.dependencyType === "required_before") final.unshift(item);
        else final.push(item);
      }
    }
    return final.map((item, index) => ({ ...item, position: index }));
  },

  validateServiceCombo(tenantId, customerId, requestedServiceIds = [], appointmentDate) {
    const ids = [...new Set((requestedServiceIds || []).filter(Boolean))];
    const rules = db.prepare(
      `SELECT * FROM service_restrictions WHERE tenantId = ?`
    ).all(tenantId);
    const ruleMap = new Map(rules.map((rule) => [pairKey(rule.serviceAId, rule.serviceBId), rule]));
    const violations = [];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const rule = ruleMap.get(pairKey(ids[i], ids[j]));
        if (rule) violations.push(this.violationFromRule(rule));
      }
    }
    if (customerId && appointmentDate) {
      const existing = repositories.appointments
        .list({ limit: 10000 }, { tenantId })
        .filter((item) => item.clientId === customerId && !["cancelled", "no-show"].includes(item.status));
      for (const appointment of existing) {
        const existingIds = appointment.serviceIds || [];
        for (const serviceId of ids) {
          for (const existingServiceId of existingIds) {
            const rule = ruleMap.get(pairKey(serviceId, existingServiceId));
            if (!rule) continue;
            if (rule.restrictionType === "same_day_blocked" && appointment.startAt?.slice(0, 10) === new Date(appointmentDate).toISOString().slice(0, 10)) {
              violations.push(this.violationFromRule(rule, appointment.id));
            }
            if (rule.restrictionType === "min_gap_days" && daysBetween(appointment.startAt, appointmentDate) < Number(rule.minGapDays || 0)) {
              violations.push(this.violationFromRule(rule, appointment.id));
            }
          }
        }
      }
    }
    return { valid: violations.length === 0, violations };
  },

  violationFromRule(rule, appointmentId = "") {
    return {
      ruleId: rule.id,
      appointmentId,
      restrictionType: rule.restrictionType,
      warningMessage: rule.warningMessage,
      allowOverride: Number(rule.allowOverride || 0) === 1,
      overrideRole: rule.overrideRole || "manager"
    };
  },

  canOverride(violation, role) {
    if (!violation?.allowOverride) return false;
    const levels = { staff: 1, receptionist: 2, frontDesk: 2, manager: 3, admin: 4, owner: 5, superAdmin: 6 };
    return (levels[role] || 0) >= (levels[violation.overrideRole] || 3);
  },

  createDependency(payload, access) {
    const tenantId = access.tenantId;
    for (const id of [payload.serviceId, payload.requiredServiceId]) {
      if (!repositories.services.getById(id, tenantService.accessScope(access))) throw notFound(`Service not found: ${id}`);
    }
    const row = {
      id: payload.id || makeId("sdep"),
      tenantId,
      serviceId: payload.serviceId,
      requiredServiceId: payload.requiredServiceId,
      dependencyType: payload.dependencyType || "required_before",
      autoAdd: payload.autoAdd === false ? 0 : 1,
      isChargeable: payload.isChargeable === false ? 0 : 1
    };
    db.prepare(
      `INSERT INTO service_dependencies (id, tenantId, serviceId, requiredServiceId, dependencyType, autoAdd, isChargeable)
       VALUES (@id, @tenantId, @serviceId, @requiredServiceId, @dependencyType, @autoAdd, @isChargeable)`
    ).run(row);
    return row;
  },

  createRestriction(payload, access) {
    const row = {
      id: payload.id || makeId("sres"),
      tenantId: access.tenantId,
      serviceAId: payload.serviceAId,
      serviceBId: payload.serviceBId,
      restrictionType: payload.restrictionType || "requires_consent",
      minGapDays: payload.minGapDays || null,
      warningMessage: payload.warningMessage || "This service combination needs manager review.",
      allowOverride: payload.allowOverride === false ? 0 : 1,
      overrideRole: payload.overrideRole || "manager"
    };
    db.prepare(
      `INSERT INTO service_restrictions (id, tenantId, serviceAId, serviceBId, restrictionType, minGapDays, warningMessage, allowOverride, overrideRole)
       VALUES (@id, @tenantId, @serviceAId, @serviceBId, @restrictionType, @minGapDays, @warningMessage, @allowOverride, @overrideRole)`
    ).run(row);
    return row;
  }
};

