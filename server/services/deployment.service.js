import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "../config/env.js";
import { repositories } from "../repositories/repository-registry.js";
import { securityService } from "./security.service.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function fileExists(path) {
  return existsSync(join(process.cwd(), path));
}

function packageJson() {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  } catch {
    return {};
  }
}

function item(name, passed, detail = "") {
  return { name, passed: Boolean(passed), detail };
}

export class DeploymentService {
  summary(_query = {}, access) {
    const events = repositories.deploymentEvents.list({ limit: 50 }, scope(access));
    const backups = repositories.securityBackups.list({ limit: 20 }, scope(access));
    const checklist = this.checklist();
    return {
      metrics: {
        checklistItems: checklist.length,
        readyItems: checklist.filter((entry) => entry.passed).length,
        events: events.length,
        backups: backups.length
      },
      environment: {
        nodeEnv: env.nodeEnv,
        host: env.host,
        port: env.port,
        allowedOrigins: env.allowedOrigins,
        apiVersion: env.apiVersion
      },
      checklist,
      events,
      backups
    };
  }

  preflight(payload = {}, access, req = null) {
    const checklist = this.checklist();
    const failed = checklist.filter((entry) => !entry.passed);
    const event = repositories.deploymentEvents.create({
      id: makeId("deploy"),
      branchId: payload.branchId || "",
      type: "preflight",
      environment: payload.environment || "production",
      version: payload.version || "local",
      status: failed.length ? "blocked" : "ready",
      result: { checklist, failed: failed.length },
      createdBy: access.userId || ""
    }, scope(access, payload.branchId || ""));
    securityService.audit({ action: "deployment.preflight", targetType: "deployment_event", targetId: event.id, details: event.result, severity: failed.length ? "warning" : "info" }, access, req);
    return event;
  }

  record(payload = {}, access, req = null) {
    const event = repositories.deploymentEvents.create({
      id: makeId("deploy"),
      branchId: payload.branchId || "",
      type: payload.type || "release",
      environment: payload.environment || "production",
      version: payload.version || "local",
      status: payload.status || "recorded",
      result: payload.result || {},
      createdBy: access.userId || ""
    }, scope(access, payload.branchId || ""));
    securityService.audit({ action: "deployment.recorded", targetType: "deployment_event", targetId: event.id, details: { type: event.type, status: event.status, version: event.version } }, access, req);
    return event;
  }

  backup(payload = {}, access, req = null) {
    const backup = securityService.createBackup({ ...payload, type: payload.type || "deployment-backup", reason: payload.reason || "deployment-readiness" }, access, req);
    const event = repositories.deploymentEvents.create({
      id: makeId("deploy"),
      branchId: payload.branchId || "",
      type: "database-backup",
      environment: payload.environment || "production",
      version: payload.version || "local",
      status: "completed",
      result: { backupId: backup.id, checksum: backup.checksum, fileSizeBytes: backup.fileSizeBytes },
      createdBy: access.userId || ""
    }, scope(access, payload.branchId || ""));
    return { backup, event };
  }

  checklist() {
    const pkg = packageJson();
    const scripts = pkg.scripts || {};
    return [
      item("Dockerfile", fileExists("Dockerfile"), "Container image can build frontend and run API"),
      item("docker-compose", fileExists("docker-compose.yml"), "Local production-like stack"),
      item(".env.example", fileExists(".env.example"), "Environment contract documented"),
      item("Production build script", Boolean(scripts.build), "npm run build"),
      item("Backend start script", Boolean(scripts.start || scripts["start:api"]), "node server/index.js"),
      item("Database backup script", Boolean(scripts["backup:db"]) && fileExists("scripts/backup-database.mjs"), "npm run backup:db"),
      item("Deployment guide", fileExists("docs/DEPLOYMENT_GUIDE.md"), "docs/DEPLOYMENT_GUIDE.md")
    ];
  }
}

export const deploymentService = new DeploymentService();
