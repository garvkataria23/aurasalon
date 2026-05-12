import { resources } from "../db.js";
import { notFound } from "../utils/app-error.js";
import { repositoryForResource, repositories } from "../repositories/repository-registry.js";
import { tenantService } from "./tenant.service.js";

function serviceDuration(serviceIds = []) {
  return serviceIds.reduce((minutes, serviceId) => {
    const service = repositories.services.getById(serviceId);
    return minutes + Number(service?.durationMinutes || 0);
  }, 0);
}

export class ResourceService {
  list(resource, query, access) {
    if (query?.branchId) tenantService.assertBranchAccess(access, query.branchId);
    return this.repository(resource).list(query, tenantService.accessScope(access, resource));
  }

  get(resource, id, access) {
    const row = this.repository(resource).getById(id, tenantService.accessScope(access, resource));
    if (!row) throw notFound(`${resource} record not found`);
    if (row.branchId) tenantService.assertBranchAccess(access, row.branchId);
    return row;
  }

  create(resource, payload, access) {
    tenantService.ensureSubscriptionActive(access.tenantId);
    tenantService.enforceUsageLimit(access.tenantId, resource);
    const nextPayload = { ...payload };
    if (nextPayload.branchId) tenantService.assertBranchAccess(access, nextPayload.branchId);
    if (resource === "appointments" && !nextPayload.endAt) {
      const minutes = serviceDuration(nextPayload.serviceIds);
      nextPayload.endAt = new Date(new Date(nextPayload.startAt).getTime() + Math.max(minutes, 30) * 60000).toISOString();
    }
    const created = this.repository(resource).create(nextPayload, tenantService.accessScope(access, resource));
    tenantService.recordUsage({
      tenantId: access.tenantId,
      metric: resource,
      referenceType: resource,
      referenceId: created.id
    });
    return created;
  }

  update(resource, id, payload, access) {
    this.get(resource, id, access);
    if (payload.branchId) tenantService.assertBranchAccess(access, payload.branchId);
    return this.repository(resource).update(id, payload, tenantService.accessScope(access, resource));
  }

  delete(resource, id, access) {
    this.get(resource, id, access);
    return this.repository(resource).delete(id, tenantService.accessScope(access, resource));
  }

  repository(resource) {
    if (!resources[resource]) throw notFound(`Unknown API resource: ${resource}`);
    return repositoryForResource(resource);
  }
}

export const resourceService = new ResourceService();
