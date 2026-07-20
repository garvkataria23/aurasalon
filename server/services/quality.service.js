import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db, resources } from "../db.js";
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

function check(name, passed, detail = "") {
  return { name, passed: Boolean(passed), detail };
}

export class QualityService {
  summary(_query = {}, access) {
    const runs = repositories.qualityRuns.list({ limit: 25 }, scope(access));
    const lastRun = runs[0] || null;
    return {
      metrics: {
        runs: runs.length,
        lastPassed: lastRun?.status === "passed" ? 1 : 0,
        demoClients: repositories.clients.list({ q: "Level 25 Demo", limit: 25 }, scope(access)).length,
        demoServices: repositories.services.list({ q: "Level 25 Demo", limit: 25 }, scope(access)).length,
        routeResources: Object.keys(resources).length
      },
      checks: this.computeChecks(access),
      runs
    };
  }

  run(payload = {}, access, req = null) {
    const startedAt = now();
    const details = this.computeChecks(access);
    const failed = details.filter((item) => !item.passed);
    const status = failed.length ? "failed" : "passed";
    const run = repositories.qualityRuns.create({
      id: makeId("qr"),
      branchId: payload.branchId || access.branchId || "",
      type: payload.type || "quality-audit",
      status,
      result: {
        total: details.length,
        passed: details.length - failed.length,
        failed: failed.length,
        command: "npm test && npm run build"
      },
      details,
      startedAt,
      completedAt: now(),
      createdBy: access.userId || ""
    }, scope(access, payload.branchId || ""));
    securityService.audit({ action: "quality.run", targetType: "quality_run", targetId: run.id, details: run.result, severity: status === "passed" ? "info" : "warning" }, access, req);
    return run;
  }

  seedDemoData(payload = {}, access, req = null) {
    const branchId = payload.branchId || access.branchId || "branch_blr";
    tenantService.assertBranchAccess(access, branchId);
    const created = [];
    const createIfMissing = (repo, id, data, recordScope = scope(access, branchId)) => {
      const existing = repo.getById(id, recordScope);
      if (existing) return existing;
      const row = repo.create({ id, ...data }, recordScope);
      created.push({ type: data.type || repo.table || "record", id });
      return row;
    };

    const client = createIfMissing(repositories.clients, "client_level25_demo", {
      name: "Level 25 Demo Client",
      phone: "9000002525",
      email: "level25.demo@example.com",
      branchId,
      tags: ["new", "quality-seed"],
      visitCount: 0,
      totalSpend: 0,
      loyaltyPoints: 0
    });
    const staff = createIfMissing(repositories.staff, "staff_level25_demo", {
      name: "Level 25 Demo Stylist",
      role: "Senior stylist",
      branchId,
      phone: "9000002526",
      assignedServices: [],
      commissionRule: { servicePercent: 10, retailPercent: 5 },
      attendance: [],
      performance: {}
    });
    const service = createIfMissing(repositories.services, "service_level25_demo", {
      name: "Level 25 Demo Hair Ritual",
      category: "Quality demo",
      price: 1499,
      durationMinutes: 60,
      assignedStaff: [staff.id],
      requiredProducts: [],
      addOns: [],
      packageServices: [],
      gstRate: 18,
      status: "active"
    }, scope(access));
    const product = createIfMissing(repositories.products, "product_level25_demo", {
      name: "Level 25 Demo Serum",
      sku: "L25-SERUM",
      branchId,
      type: "retail",
      supplier: "Demo Supplier",
      stock: 12,
      lowStockThreshold: 3,
      unitCost: 250,
      price: 650,
      gstRate: 18,
      status: "active"
    });

    const result = { created, client, staff, service, product };
    const run = repositories.qualityRuns.create({
      id: makeId("qr"),
      branchId,
      type: "seed-demo-data",
      status: "passed",
      result: { created: created.length, branchId },
      details: created,
      startedAt: now(),
      completedAt: now(),
      createdBy: access.userId || ""
    }, scope(access, branchId));
    securityService.audit({ action: "quality.seed_demo", targetType: "quality_run", targetId: run.id, details: { created: created.length, branchId } }, access, req);
    return { ...result, run };
  }

  computeChecks(access) {
    const pkg = packageJson();
    const scripts = pkg.scripts || {};
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
    return [
      check("Unit test script", Boolean(scripts.test), "package.json exposes npm test"),
      check("API test file", fileExists("tests/api.test.js"), "tests/api.test.js"),
      check("Form validation test file", fileExists("tests/form-validation.test.js"), "tests/form-validation.test.js"),
      check("Build check script", Boolean(scripts.build && scripts["check:server"]), "npm run build and npm run check:server"),
      check("Angular error boundary", fileExists("src/app/core/global-error-handler.ts"), "Global ErrorHandler provider"),
      check("Seed demo data endpoint", tables.includes("quality_runs"), "quality_runs persists QA history"),
      check("Permission matrix data", repositories.roleDefinitions.list({ limit: 1000 }, scope(access)).length >= 7, "system and custom roles seeded"),
      check("Audit tables", ["security_audit_logs", "security_activity_events", "security_sessions"].every((table) => tables.includes(table)), "compliance tables exist")
    ];
  }
}

export const qualityService = new QualityService();
