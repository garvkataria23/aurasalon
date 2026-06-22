import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { db } from "../server/db.js";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function headers(role = "owner", tenantId = "tenant_aura", authToken = "") {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": role,
    ...(authToken ? { authorization: `Bearer ${authToken}` } : {})
  };
}

async function api(baseUrl, path, { method = "GET", body, role = "owner", tenantId = "tenant_aura", authToken = "" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(role, tenantId, authToken),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

function ensureTenant(id, slug) {
  const now = new Date().toISOString();
  const plan = db.prepare("SELECT id FROM subscription_plans ORDER BY createdAt ASC LIMIT 1").get();
  db.prepare(`INSERT OR IGNORE INTO tenants (id, name, slug, status, planId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, `Tenant ${slug}`, slug, "active", plan?.id || null, now, now);
}

test("remaining Flexi employee masters persist service assignment, payroll definitions, and bulk update", async () => {
  ensureTenant("tenant_staff_master_final_other", "staff-master-final-other");
  const server = await listen(createApp());
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const baseUrlV1 = `http://127.0.0.1:${port}/api/v1`;
  const stamp = Date.now();

  try {
    const branchId = `branch_final_${stamp}`;
    const category = await api(baseUrl, "/staff-os/staff-categories", {
      method: "POST",
      body: {
        branchId,
        name: `Final Stylist ${stamp}`,
        scope: "operator",
        defaultDesignation: "Senior Stylist"
      }
    });
    assert.equal(category.response.status, 201);

    const staffA = await api(baseUrl, "/staff-os/staff", {
      method: "POST",
      body: {
        branchId,
        firstName: "Flexi",
        lastName: "Operator",
        employeeCode: `FIN-A-${stamp}`,
        gender: "female",
        dob: "1995-01-15",
        staffCategoryId: category.payload.id,
        employeeDetails: {
          shortName: `FXA${String(stamp).slice(-4)}`,
          attendanceSalary: { panNo: "AAAAA1111A", aadharNo: "111122223333" }
        }
      }
    });
    assert.equal(staffA.response.status, 201);

    const staffB = await api(baseUrl, "/staff-os/staff", {
      method: "POST",
      body: {
        branchId,
        firstName: "Flexi",
        lastName: "Admin",
        employeeCode: `FIN-B-${stamp}`,
        roleId: "admin",
        staffCategoryId: category.payload.id
      }
    });
    assert.equal(staffB.response.status, 201);

    const services = [
      { id: `svc_bleach_${stamp}`, name: "Face & Neck Bleach", category: "BLEACH", price: 700, durationMinutes: 45 },
      { id: `svc_makeup_${stamp}`, name: "Bridal Basic Make-up", category: "BRIDAL MAKE-OVER", price: 8000, durationMinutes: 180 }
    ];

    const serviceAssignment = await api(baseUrl, "/staff-os/service-assignments", {
      method: "POST",
      body: {
        staffId: staffA.payload.id,
        roleScope: "operator",
        serviceIds: services.map((service) => service.id),
        services,
        categoryFilters: ["BLEACH"],
        notes: "Employee-wise service assign"
      }
    });
    assert.equal(serviceAssignment.response.status, 201);
    assert.equal(serviceAssignment.payload.staffId, staffA.payload.id);
    assert.deepEqual(serviceAssignment.payload.serviceIds, services.map((service) => service.id));
    assert.equal(serviceAssignment.payload.services[1].category, "BRIDAL MAKE-OVER");

    const copiedAssignment = await api(baseUrl, `/staff-os/service-assignments/${serviceAssignment.payload.id}/copy`, {
      method: "POST",
      body: { targets: [{ staffId: staffB.payload.id, staffName: staffB.payload.fullName, branchId }] }
    });
    assert.equal(copiedAssignment.response.status, 200);
    assert.equal(copiedAssignment.payload[0].staffId, staffB.payload.id);
    assert.equal(copiedAssignment.payload[0].serviceIds.length, 2);

    const fine = await api(baseUrl, "/staff-os/fine-penalties", {
      method: "POST",
      body: { branchId, name: `Late mark penalty ${stamp}`, amount: 250, notes: "Flexi fine penalty" }
    });
    assert.equal(fine.response.status, 201);
    assert.equal(fine.payload.amount, 250);

    const staleFine = await api(baseUrl, `/staff-os/fine-penalties/${fine.payload.id}`, {
      method: "PATCH",
      body: { version: 0, amount: 100 }
    });
    assert.equal(staleFine.response.status, 409);

    const updatedFine = await api(baseUrl, `/staff-os/fine-penalties/${fine.payload.id}`, {
      method: "PATCH",
      body: { version: fine.payload.version, name: fine.payload.name, amount: 300, hide: false }
    });
    assert.equal(updatedFine.response.status, 200);
    assert.equal(updatedFine.payload.version, 2);
    assert.equal(updatedFine.payload.amount, 300);

    const allowance = await api(baseUrl, "/staff-os/allowance-deductions", {
      method: "POST",
      body: { branchId, description: `Travel allowance ${stamp}`, entryType: "allowance" }
    });
    assert.equal(allowance.response.status, 201);
    assert.equal(allowance.payload.entryType, "allowance");

    const deduction = await api(baseUrl, "/staff-os/allowance-deductions", {
      method: "POST",
      body: { branchId, description: `Uniform deduction ${stamp}`, entryType: "deduction" }
    });
    assert.equal(deduction.response.status, 201);

    const filteredDeductions = await api(baseUrl, "/staff-os/allowance-deductions?entryType=deduction");
    assert.equal(filteredDeductions.response.status, 200);
    assert.ok(filteredDeductions.payload.some((item) => item.id === deduction.payload.id));
    assert.equal(filteredDeductions.payload.some((item) => item.id === allowance.payload.id), false);

    const payroll = await api(baseUrl, "/staff-os/payroll-structures", {
      method: "POST",
      body: {
        branchId,
        name: "Payroll Salary Structure",
        providentFund: {
          applicable: true,
          includeBasicSalary: true,
          includeIncentives: true,
          pfNo: `PF-${stamp}`,
          employeeSharePercent: 12,
          pfContributionEmployerPercent: 3.67,
          epsContributionEmployerPercent: 8.33,
          maxSalaryPf: 15000
        },
        professionalTax: {
          applicable: true,
          includeBasicSalary: true,
          ptNo: `PT-${stamp}`,
          mvatrcNo: `MVAT-${stamp}`,
          slabs: [{ sNo: 1, fromAmount: 0, toAmount: 10000, taxAmount: 200 }]
        },
        esic: {
          applicable: true,
          includeBasicSalary: true,
          esicNo: `ESIC-${stamp}`,
          employeeSharePercent: 0.75,
          employerSharePercent: 3.25,
          maxSalaryEsic: 21000
        },
        tds: {
          applicable: true,
          employeeRules: [{ staffId: staffA.payload.id, amount: 500 }]
        }
      }
    });
    assert.equal(payroll.response.status, 201);
    assert.equal(payroll.payload.providentFund.applicable, true);
    assert.equal(payroll.payload.providentFund.pfNo, `PF-${stamp}`);
    assert.equal(payroll.payload.professionalTax.slabs[0].taxAmount, 200);
    assert.equal(payroll.payload.esic.maxSalaryEsic, 21000);
    assert.equal(payroll.payload.tds.employeeRules[0].staffId, staffA.payload.id);

    const updatedPayroll = await api(baseUrl, `/staff-os/payroll-structures/${payroll.payload.id}`, {
      method: "PATCH",
      body: {
        version: payroll.payload.version,
        branchId,
        name: "Payroll Salary Structure",
        providentFund: { ...payroll.payload.providentFund, employeeSharePercent: 10 },
        professionalTax: payroll.payload.professionalTax,
        esic: payroll.payload.esic,
        tds: payroll.payload.tds
      }
    });
    assert.equal(updatedPayroll.response.status, 200);
    assert.equal(updatedPayroll.payload.version, 2);
    assert.equal(updatedPayroll.payload.providentFund.employeeSharePercent, 10);

    const bulkRows = await api(baseUrl, `/staff-os/bulk-employee-update?branchId=${branchId}&includeArchived=true`);
    assert.equal(bulkRows.response.status, 200);
    const targetRow = bulkRows.payload.find((item) => item.staffId === staffA.payload.id);
    assert.ok(targetRow);

    const bulkJob = await api(baseUrl, "/staff-os/bulk-employee-update", {
      method: "POST",
      body: {
        branchId,
        rows: [{
          ...targetRow,
          employeeName: "Flexi Operator Updated",
          shortName: `FXU${String(stamp).slice(-4)}`,
          designation: "Creative Director",
          joiningDate: "2026-01-01",
          leftDate: "2026-02-01",
          hide: false,
          gender: "female",
          dateOfBirth: "1995-02-15",
          anniversaryDate: "2026-05-30",
          panNo: "BBBBB2222B",
          aadharNo: "444455556666"
        }]
      }
    });
    assert.equal(bulkJob.response.status, 200);
    assert.equal(bulkJob.payload.updatedRows, 1);
    assert.equal(bulkJob.payload.failedRows, 0);

    const refreshedBulkRows = await api(baseUrl, `/staff-os/bulk-employee-update?branchId=${branchId}&includeArchived=true`);
    const refreshed = refreshedBulkRows.payload.find((item) => item.staffId === staffA.payload.id);
    assert.equal(refreshed.employeeName, "Flexi Operator Updated");
    assert.equal(refreshed.shortName, `FXU${String(stamp).slice(-4)}`);
    assert.equal(refreshed.designation, "Creative Director");
    assert.equal(refreshed.leftDate, "2026-02-01");
    assert.equal(refreshed.panNo, "BBBBB2222B");
    assert.equal(refreshed.aadharNo, "444455556666");

    const login = await fetch(`${baseUrlV1}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "tenant_aura",
        email: "owner@aurasalon.example",
        password: process.env.DEMO_ADMIN_PASSWORD || "AuraOwner#2026"
      })
    });
    assert.equal(login.status, 201);
    const loginBody = await login.json();
    const token = loginBody.data.accessToken;

    const v1Assignments = await api(baseUrlV1, `/staff-os/service-assignments?roleScope=operator&branchId=${branchId}`, { authToken: token });
    assert.equal(v1Assignments.response.status, 200);
    assert.ok(v1Assignments.payload.data.some((item) => item.id === serviceAssignment.payload.id));

    const v1Payroll = await api(baseUrlV1, `/staff-os/payroll-structures?branchId=${branchId}`, { authToken: token });
    assert.equal(v1Payroll.response.status, 200);
    assert.ok(v1Payroll.payload.data.some((item) => item.id === payroll.payload.id));

    const isolated = await api(baseUrl, "/staff-os/fine-penalties", {
      tenantId: "tenant_staff_master_final_other"
    });
    assert.equal(isolated.response.status, 200);
    assert.equal(isolated.payload.some((item) => item.id === fine.payload.id), false);
  } finally {
    await close(server);
  }
});
