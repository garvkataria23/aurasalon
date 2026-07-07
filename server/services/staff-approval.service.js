import { db } from "../db.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/app-error.js";
import {
  assertBranch,
  branchIdFrom,
  camel,
  emitStaffEvent,
  makeId,
  managerRoles,
  normalizeRole,
  now,
  number,
  requireManager,
  requireTenant,
  scopedBranchWhere,
  staffAudit,
  toJson
} from "./staff-os-advanced-utils.js";

function parseSteps(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [{ order: 1, role: "manager" }];
  try {
    return JSON.parse(value);
  } catch {
    return [{ order: 1, role: "manager" }];
  }
}

export class StaffApprovalService {
  list(query = {}, access) {
    access = requireTenant(access);
    const params = {
      tenant_id: access.tenantId,
      branch_id: query.branchId || query.branch_id || access.requestedBranchId || "",
      status: query.status || "",
      limit: Math.min(Number(query.limit || 100), 500)
    };
    const filters = [scopedBranchWhere(access, params)];
    if (params.status) filters.push("status = @status");
    return db.prepare(`SELECT * FROM approval_requests WHERE ${filters.join(" AND ")} ORDER BY created_at DESC LIMIT @limit`).all(params).map(camel);
  }

  create(payload = {}, access) {
    access = requireTenant(access);
    const branchId = branchIdFrom(payload, access);
    if (branchId) assertBranch(access, branchId);
    const requestType = payload.requestType || payload.request_type || "";
    if (!requestType) throw badRequest("requestType is required");
    const amount = number(payload.amount, 0);
    const policy = this.matchPolicy(requestType, branchId, amount, access);
    const row = {
      id: makeId("appr"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      policy_id: policy?.id || "",
      request_type: requestType,
      entity_type: payload.entityType || payload.entity_type || "",
      entity_id: payload.entityId || payload.entity_id || "",
      amount,
      status: "pending",
      requested_by: access.userId || "",
      expires_at: payload.expiresAt || payload.expires_at || "",
      payload_json: toJson(payload.payload || payload)
    };
    const steps = parseSteps(policy?.steps_json || payload.steps || [{ order: 1, role: "manager" }]);
    db.transaction(() => {
      db.prepare(`INSERT INTO approval_requests
        (id, tenant_id, branch_id, policy_id, request_type, entity_type, entity_id, amount, status, requested_by, expires_at, payload_json)
        VALUES (@id, @tenant_id, @branch_id, @policy_id, @request_type, @entity_type, @entity_id, @amount, @status, @requested_by, @expires_at, @payload_json)`).run(row);
      steps.forEach((step, index) => {
        db.prepare(`INSERT INTO approval_steps (id, tenant_id, approval_request_id, step_order, approver_role, status, assigned_to)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
          makeId("apstep"), access.tenantId, row.id, Number(step.order || index + 1), step.role || step.approverRole || "manager",
          index === 0 ? "pending" : "waiting", step.assignedTo || ""
        );
      });
      db.prepare(`INSERT INTO approval_actions (id, tenant_id, approval_request_id, action, actor_user_id, actor_role, comments)
        VALUES (?, ?, ?, 'requested', ?, ?, ?)`).run(makeId("apact"), access.tenantId, row.id, access.userId || "", access.role || "", payload.comments || "");
      staffAudit("staff.approval_requested", "approval_requests", row.id, access, { after: row, branchId });
    })();
    emitStaffEvent("staff:approval_requested", access, branchId, row.id);
    return this.withSteps(row.id, access);
  }

  approve(id, payload = {}, access) {
    return this.decide(id, "approved", payload, access);
  }

  reject(id, payload = {}, access) {
    return this.decide(id, "rejected", payload, access);
  }

  escalate(id, payload = {}, access) {
    access = requireTenant(access);
    requireManager(access);
    const request = this.request(id, access);
    db.transaction(() => {
      db.prepare("UPDATE approval_requests SET status = 'escalated', updated_at = ? WHERE id = ? AND tenant_id = ?").run(now(), id, access.tenantId);
      db.prepare(`INSERT INTO approval_actions (id, tenant_id, approval_request_id, action, actor_user_id, actor_role, comments)
        VALUES (?, ?, ?, 'escalated', ?, ?, ?)`).run(makeId("apact"), access.tenantId, id, access.userId || "", access.role || "", payload.comments || "");
      staffAudit("staff.approval_escalated", "approval_requests", id, access, { before: request, branchId: request.branch_id });
    })();
    emitStaffEvent("staff:approval_escalated", access, request.branch_id, id);
    return this.withSteps(id, access);
  }

  policies(query = {}, access) {
    access = requireTenant(access);
    const params = {
      tenant_id: access.tenantId,
      branch_id: query.branchId || query.branch_id || access.requestedBranchId || "",
      limit: Math.min(Number(query.limit || 100), 500)
    };
    const filters = ["tenant_id = @tenant_id"];
    if (params.branch_id) filters.push("(branch_id = @branch_id OR branch_id IS NULL OR branch_id = '')");
    return db.prepare(`SELECT * FROM approval_policies WHERE ${filters.join(" AND ")} ORDER BY created_at DESC LIMIT @limit`).all(params).map(camel);
  }

  createPolicy(payload = {}, access) {
    access = requireTenant(access);
    requireManager(access);
    const branchId = branchIdFrom(payload, access);
    if (branchId) assertBranch(access, branchId);
    const row = {
      id: makeId("appol"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      policy_key: payload.policyKey || payload.policy_key || "",
      policy_name: payload.policyName || payload.policy_name || "",
      applies_to: payload.appliesTo || payload.applies_to || "",
      amount_threshold: number(payload.amountThreshold || payload.amount_threshold, 0),
      steps_json: toJson(payload.steps || [{ order: 1, role: "manager" }]),
      escalation_hours: Number(payload.escalationHours || payload.escalation_hours || 24),
      status: payload.status || "active"
    };
    if (!row.policy_key || !row.policy_name || !row.applies_to) throw badRequest("policyKey, policyName and appliesTo are required");
    db.prepare(`INSERT INTO approval_policies
      (id, tenant_id, branch_id, policy_key, policy_name, applies_to, amount_threshold, steps_json, escalation_hours, status)
      VALUES (@id, @tenant_id, @branch_id, @policy_key, @policy_name, @applies_to, @amount_threshold, @steps_json, @escalation_hours, @status)`).run(row);
    return camel(db.prepare("SELECT * FROM approval_policies WHERE id = ? AND tenant_id = ?").get(row.id, access.tenantId));
  }

  decide(id, decision, payload, access) {
    access = requireTenant(access);
    const request = this.request(id, access);
    const step = db.prepare("SELECT * FROM approval_steps WHERE tenant_id = ? AND approval_request_id = ? AND status = 'pending' ORDER BY step_order LIMIT 1")
      .get(access.tenantId, id);
    if (!step) throw conflict("No pending approval step");
    const role = normalizeRole(access.role);
    if (!managerRoles.has(role) && role !== step.approver_role) throw forbidden("Current role cannot approve this step");
    db.transaction(() => {
      db.prepare("UPDATE approval_steps SET status = ?, decided_by = ?, decided_at = ?, comments = ? WHERE id = ? AND tenant_id = ?")
        .run(decision, access.userId || "", now(), payload.comments || "", step.id, access.tenantId);
      db.prepare(`INSERT INTO approval_actions (id, tenant_id, approval_request_id, step_id, action, actor_user_id, actor_role, comments)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(makeId("apact"), access.tenantId, id, step.id, decision, access.userId || "", access.role || "", payload.comments || "");
      if (decision === "rejected") {
        db.prepare("UPDATE approval_requests SET status = 'rejected', updated_at = ? WHERE id = ? AND tenant_id = ?").run(now(), id, access.tenantId);
      } else {
        const nextStep = db.prepare("SELECT * FROM approval_steps WHERE tenant_id = ? AND approval_request_id = ? AND status = 'waiting' ORDER BY step_order LIMIT 1")
          .get(access.tenantId, id);
        if (nextStep) {
          db.prepare("UPDATE approval_steps SET status = 'pending' WHERE id = ? AND tenant_id = ?").run(nextStep.id, access.tenantId);
          db.prepare("UPDATE approval_requests SET current_step = ?, updated_at = ? WHERE id = ? AND tenant_id = ?").run(nextStep.step_order, now(), id, access.tenantId);
        } else {
          db.prepare("UPDATE approval_requests SET status = 'approved', updated_at = ? WHERE id = ? AND tenant_id = ?").run(now(), id, access.tenantId);
        }
      }
      staffAudit(`staff.approval_${decision}`, "approval_requests", id, access, { before: request, branchId: request.branch_id });
    })();
    emitStaffEvent(decision === "approved" ? "staff:approval_approved" : "staff:approval_rejected", access, request.branch_id, id);
    return this.withSteps(id, access);
  }

  matchPolicy(requestType, branchId, amount, access) {
    return db.prepare(`SELECT * FROM approval_policies
      WHERE tenant_id = ? AND applies_to = ? AND status = 'active' AND (branch_id = ? OR branch_id IS NULL OR branch_id = '') AND amount_threshold <= ?
      ORDER BY amount_threshold DESC, branch_id = ? DESC LIMIT 1`).get(access.tenantId, requestType, branchId || "", amount, branchId || "");
  }

  request(id, access) {
    const row = db.prepare("SELECT * FROM approval_requests WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Approval request not found");
    if (row.branch_id) assertBranch(access, row.branch_id);
    return row;
  }

  withSteps(id, access) {
    const request = camel(this.request(id, access));
    const steps = db.prepare("SELECT * FROM approval_steps WHERE tenant_id = ? AND approval_request_id = ? ORDER BY step_order")
      .all(access.tenantId, id).map(camel);
    const actions = db.prepare("SELECT * FROM approval_actions WHERE tenant_id = ? AND approval_request_id = ? ORDER BY created_at")
      .all(access.tenantId, id).map(camel);
    return { ...request, steps, actions };
  }
}

export const staffApprovalService = new StaffApprovalService();
