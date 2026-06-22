import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { billingService } from "./billing.service.js";

export class BillingMembershipService {
  applyMembership(invoiceId, { membershipId, benefitId = "", discountAmount = 0, serviceId = "" } = {}, access = {}) {
    if (!membershipId) throw badRequest("membershipId is required");
    const invoice = billingService.requireInvoice(invoiceId, access);
    const membership = db.prepare("SELECT * FROM memberships WHERE tenantId = ? AND id = ?").get(access.tenantId, membershipId);
    if (!membership) throw notFound("Membership not found");
    if (membership.status && membership.status !== "active") throw conflict("Membership is not active");
    if (membership.expiresAt && membership.expiresAt < new Date().toISOString()) throw conflict("Membership is expired");
    const existing = db.prepare("SELECT id FROM membership_redemptions WHERE tenant_id = ? AND invoice_id = ? AND membership_id = ?").get(access.tenantId, invoiceId, membershipId);
    if (existing) throw conflict("Membership already redeemed on this invoice");
    const amount = Number(discountAmount || invoice.grand_total * 0.1 || 0);
    db.prepare(
      `INSERT INTO membership_redemptions
        (id, tenant_id, invoice_id, customer_id, membership_id, benefit_id, discount_amount, service_id, created_at)
       VALUES
        (@id, @tenantId, @invoiceId, @customerId, @membershipId, @benefitId, @discountAmount, @serviceId, CURRENT_TIMESTAMP)`
    ).run({
      id: `mred_${crypto.randomUUID().slice(0, 12)}`,
      tenantId: access.tenantId,
      invoiceId,
      customerId: invoice.customer_id,
      membershipId,
      benefitId,
      discountAmount: amount,
      serviceId
    });
    billingService.writeEvent({ tenantId: access.tenantId, invoiceId, eventType: "membership.redeemed", actorUserId: access.userId || "", payload: { membershipId, amount } });
    return billingService.applyBillDiscount(invoiceId, { type: "amount", value: amount, reason: "membership_benefit" }, access);
  }
}

export const billingMembershipService = new BillingMembershipService();
