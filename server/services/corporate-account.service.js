import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

export class CorporateAccountService {
  create(payload = {}, access = {}) {
    const branchId = payload.branch_id || payload.branchId || access.branchId || "";
    const companyName = payload.company_name || payload.companyName || payload.account_name || payload.accountName;
    if (!companyName) throw badRequest("company_name is required");
    const id = `corp_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO corporate_accounts
        (id, tenant_id, branch_id, company_name, gstin, billing_email, phone, credit_limit,
         current_outstanding, payment_terms_days, status, created_by, created_at, updated_at)
       VALUES
        (@id, @tenantId, @branchId, @companyName, @gstin, @billingEmail, @phone, @creditLimit,
         0, @paymentTermsDays, 'active', @createdBy, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run({
      id,
      tenantId: access.tenantId,
      branchId,
      companyName,
      gstin: payload.gstin || "",
      billingEmail: payload.billing_email || payload.billingEmail || "",
      phone: payload.phone || "",
      creditLimit: money(payload.credit_limit ?? payload.creditLimit ?? 0),
      paymentTermsDays: Number(payload.payment_terms_days || payload.paymentTermsDays || 30),
      createdBy: access.userId || ""
    });
    return this.get(id, access);
  }

  list(query = {}, access = {}) {
    const where = ["tenant_id = @tenantId"];
    const params = { tenantId: access.tenantId };
    if (query.branchId || query.branch_id) {
      where.push("branch_id = @branchId");
      params.branchId = query.branchId || query.branch_id;
    }
    return db.prepare(`SELECT * FROM corporate_accounts WHERE ${where.join(" AND ")} ORDER BY created_at DESC`).all(params);
  }

  get(id, access = {}) {
    const row = db.prepare("SELECT * FROM corporate_accounts WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Corporate account not found");
    return row;
  }

  addMember(accountId, payload = {}, access = {}) {
    this.get(accountId, access);
    if (!payload.customer_id && !payload.customerId) throw badRequest("customer_id is required");
    const id = `cmem_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO corporate_account_members
        (id, tenant_id, corporate_account_id, customer_id, employee_code, department, spending_limit, status, created_at)
       VALUES
        (@id, @tenantId, @accountId, @customerId, @employeeCode, @department, @spendingLimit, 'active', CURRENT_TIMESTAMP)`
    ).run({
      id,
      tenantId: access.tenantId,
      accountId,
      customerId: payload.customer_id || payload.customerId,
      employeeCode: payload.employee_code || payload.employeeCode || "",
      department: payload.department || "",
      spendingLimit: money(payload.spending_limit || payload.spendingLimit || 0)
    });
    return { id, accountId, customerId: payload.customer_id || payload.customerId };
  }

  assertCanIssueCredit(accountId, amount, access = {}) {
    const account = this.get(accountId, access);
    if (account.status !== "active") throw conflict("Corporate account is inactive");
    if (Number(account.current_outstanding || 0) + Number(amount || 0) > Number(account.credit_limit || 0)) {
      throw conflict("Corporate credit limit exceeded");
    }
    return account;
  }
}

export const corporateAccountService = new CorporateAccountService();
