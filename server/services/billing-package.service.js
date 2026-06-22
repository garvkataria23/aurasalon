import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { billingService } from "./billing.service.js";

export class BillingPackageService {
  redeemPackage(invoiceId, { packageId, serviceId, sessionsUsed = 1, amountRedeemed = 0 } = {}, access = {}) {
    if (!packageId || !serviceId) throw badRequest("packageId and serviceId are required");
    const invoice = billingService.requireInvoice(invoiceId, access);
    const pkg = db.prepare("SELECT * FROM packages WHERE tenantId = ? AND id = ?").get(access.tenantId, packageId);
    if (!pkg) throw notFound("Package not found");
    if (pkg.status && pkg.status !== "active") throw conflict("Package is not active");
    if (pkg.expiresAt && pkg.expiresAt < new Date().toISOString()) throw conflict("Package is expired");
    const existing = db.prepare("SELECT id FROM package_redemptions WHERE tenant_id = ? AND invoice_id = ? AND package_id = ? AND service_id = ?").get(access.tenantId, invoiceId, packageId, serviceId);
    if (existing) throw conflict("Package already redeemed for this service on this invoice");
    db.prepare(
      `INSERT INTO package_redemptions
        (id, tenant_id, invoice_id, customer_id, package_id, service_id, sessions_used, amount_redeemed, created_at)
       VALUES
        (@id, @tenantId, @invoiceId, @customerId, @packageId, @serviceId, @sessionsUsed, @amountRedeemed, CURRENT_TIMESTAMP)`
    ).run({
      id: `pred_${crypto.randomUUID().slice(0, 12)}`,
      tenantId: access.tenantId,
      invoiceId,
      customerId: invoice.customer_id,
      packageId,
      serviceId,
      sessionsUsed,
      amountRedeemed
    });
    billingService.writeEvent({ tenantId: access.tenantId, invoiceId, eventType: "package.redeemed", actorUserId: access.userId || "", payload: { packageId, serviceId, sessionsUsed, amountRedeemed } });
    return { invoiceId, packageId, serviceId, sessionsUsed, amountRedeemed };
  }
}

export const billingPackageService = new BillingPackageService();
