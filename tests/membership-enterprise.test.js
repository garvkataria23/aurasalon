import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("membership enterprise migration is tenant-safe and ledger-ready", () => {
  const migration = read("server/db/migrations/20260523_membership_enterprise.sql");
  for (const table of [
    "membership_plans",
    "client_membership_ledger",
    "membership_family_members",
    "membership_whatsapp_reminders",
    "membership_audit_logs",
    "membership_invoice_snapshots"
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(migration, /tenant_id TEXT NOT NULL/g);
  assert.match(migration, /branch_id TEXT/g);
  assert.match(migration, /version INTEGER DEFAULT 1/);
});

test("membership enterprise routes expose full lifecycle APIs", () => {
  const routes = read("server/routes/membership-enterprise.routes.js");
  for (const path of [
    "/membership-enterprise/plans",
    "/membership-enterprise/plans/:id/360",
    "/membership-enterprise/client/:clientId/eligibility",
    "/membership-enterprise/client/:clientId/wallet",
    "/membership-enterprise/client/:clientId/suggestion",
    "/membership-enterprise/sell",
    "/membership-enterprise/ledger",
    "/membership-enterprise/memberships/:id/360",
    "/membership-enterprise/memberships/:id/proration-preview",
    "/membership-enterprise/memberships/:id/renew",
    "/membership-enterprise/memberships/:id/upgrade",
    "/membership-enterprise/memberships/:id/downgrade",
    "/membership-enterprise/memberships/:id/cancel",
    "/membership-enterprise/family",
    "/membership-enterprise/reminders",
    "/membership-enterprise/auto-renew/queue",
    "/membership-enterprise/auto-renew/:membershipId/retry",
    "/membership-enterprise/auto-renew/:membershipId/pause",
    "/membership-enterprise/auto-renew/:membershipId/resume",
    "/membership-enterprise/reports/revenue",
    "/membership-enterprise/reports/commission",
    "/membership-enterprise/reports/risk",
    "/membership-enterprise/reports/enterprise",
    "/membership-enterprise/reports/export/csv",
    "/membership-enterprise/reports/export/pdf",
    "/membership-enterprise/client/:clientId/self-service",
    "/membership-enterprise/client/:clientId/self-service/status-link",
    "/membership-enterprise/client/:clientId/self-service/whatsapp-summary",
    "/membership-enterprise/self-service/public/:token",
    "/membership-enterprise/memberships/:id/self-service/renew-link",
    "/membership-enterprise/memberships/:id/self-service/cancel-request",
    "/membership-enterprise/memberships/:id/self-service/payment-method-update",
    "/membership-enterprise/memberships/:id/credit-adjustment-request",
    "/membership-enterprise/self-service/requests",
    "/membership-enterprise/self-service/requests/:id/approve",
    "/membership-enterprise/self-service/requests/:id/reject",
    "/membership-enterprise/risk-signals/:id/review"
  ]) {
    assert.ok(routes.includes(path), `missing ${path}`);
  }
  assert.match(routes, /requirePermission\("read", \(\) => "memberships"\)/);
  assert.match(routes, /requirePermission\("write", \(\) => "memberships"\)/);
});

test("membership desk KPI filters and backend audit search are wired", () => {
  const service = read("server/services/membership-enterprise.service.js");
  const memberships = read("src/app/pages/memberships.component.ts");
  assert.match(service, /ledgerList\(query = \{\}, access\)/);
  assert.match(service, /query\.search/);
  assert.match(service, /LEFT JOIN clients c ON c\.id = l\.client_id/);
  assert.match(service, /LOWER\(COALESCE\(l\.action/);
  assert.match(service, /LOWER\(COALESCE\(c\.name/);
  assert.match(service, /CAST\(l\.paid_amount AS TEXT\) LIKE @search/);
  assert.match(memberships, /openMembershipKpi/);
  assert.match(memberships, /visibleMemberships/);
  assert.match(memberships, /isRenewalRiskMembership/);
  assert.match(memberships, /auditLedgerSearchDraft/);
  assert.match(memberships, /searchAuditLedger/);
  assert.match(memberships, /clearAuditLedgerSearch/);
});

test("membership commission integration is staff-wise and double-count guarded", () => {
  const routes = read("server/routes/membership-enterprise.routes.js");
  const service = read("server/services/membership-enterprise.service.js");
  const memberships = read("src/app/pages/memberships.component.ts");
  assert.match(routes, /reports\/commission/);
  assert.match(service, /membershipCommissionReport/);
  assert.match(service, /COMMISSION_RATES/);
  assert.match(service, /membershipCommissionDedupeKey/);
  assert.match(service, /cancellationImpact/);
  assert.match(service, /membership\.sold/);
  assert.match(memberships, /Membership commission center/);
  assert.match(memberships, /Staff membership sales/);
  assert.match(memberships, /Commission preview/);
  assert.match(memberships, /commissionReport/);
});

test("membership risk and leakage detection exposes reviewable signals", () => {
  const routes = read("server/routes/membership-enterprise.routes.js");
  const service = read("server/services/membership-enterprise.service.js");
  const memberships = read("src/app/pages/memberships.component.ts");
  assert.match(routes, /reports\/risk/);
  assert.match(routes, /risk-signals\/:id\/review/);
  assert.match(service, /membershipRiskReport/);
  assert.match(service, /free_renewal_alert/);
  assert.match(service, /zero_paid_renewal/);
  assert.match(service, /repeated_cancellation_by_staff/);
  assert.match(service, /manual_expiry_extended_unusually/);
  assert.match(service, /high_discount_misuse/);
  assert.match(service, /downgrade_immediately_after_sale/);
  assert.match(service, /refund_credit_note_abuse/);
  assert.match(service, /membership_used_after_expiry/);
  assert.match(service, /credits_mismatch/);
  assert.match(service, /renewal_without_payment_reference/);
  assert.match(service, /reviewMembershipRiskSignal/);
  assert.match(memberships, /Membership risk center/);
  assert.match(memberships, /riskFilter/);
  assert.match(memberships, /reviewRiskSignal/);
  assert.match(memberships, /riskBadgeClass/);
});

test("membership enterprise reports cover filters and exports", () => {
  const routes = read("server/routes/membership-enterprise.routes.js");
  const service = read("server/services/membership-enterprise.service.js");
  const memberships = read("src/app/pages/memberships.component.ts");
  assert.match(routes, /reports\/enterprise/);
  assert.match(routes, /reports\/export\/csv/);
  assert.match(routes, /reports\/export\/pdf/);
  assert.match(routes, /text\/csv/);
  assert.match(routes, /application\/pdf/);
  assert.match(service, /membershipEnterpriseReports/);
  assert.match(service, /membershipReportsCsv/);
  assert.match(service, /membershipReportsPdf/);
  assert.match(service, /activeMembers/);
  assert.match(service, /expiringSoon/);
  assert.match(service, /renewalRevenue/);
  assert.match(service, /cancelledMemberships/);
  assert.match(service, /staffWiseSales/);
  assert.match(service, /planWiseProfitability/);
  assert.match(service, /creditLiability/);
  assert.match(service, /autoRenewFailedPayments/);
  assert.match(service, /membershipActionQueue/);
  assert.match(service, /expiry_alert/);
  assert.match(service, /auto_renew_recovery/);
  assert.match(service, /credit_liability/);
  assert.match(service, /package_profitability/);
  assert.match(service, /upgradeDowngrade/);
  assert.match(service, /discountLeakage/);
  assert.match(service, /paymentMode/);
  assert.match(service, /riskLevel/);
  assert.match(memberships, /Membership reports center/);
  assert.match(memberships, /Membership action queue/);
  assert.match(memberships, /actionQueueTypeLabel/);
  assert.match(memberships, /Wallet liability/);
  assert.match(memberships, /Package profitability/);
  assert.match(memberships, /reportFilters/);
  assert.match(memberships, /exportMembershipReportsCsv/);
  assert.match(memberships, /exportMembershipReportsPdf/);
});

test("checkout records immutable membership invoice snapshots", () => {
  const operations = read("server/services/salon-operations.service.js");
  assert.match(operations, /membershipEnterpriseService\.createInvoiceSnapshot/);
  assert.match(operations, /membershipEnterpriseService\.recordSoldEntitlements/);
  assert.match(operations, /planId: item\.id \|\| ""/);
});

test("frontend uses live membership APIs and 360 route", () => {
  const memberships = read("src/app/pages/memberships.component.ts");
  const pos = read("src/app/pages/pos.component.ts");
  const routes = read("src/app/app.routes.ts");
  assert.match(memberships, /membership-enterprise\/plans/);
  assert.match(memberships, /membership-enterprise\/sell/);
  assert.match(memberships, /membership-enterprise\/reminders\/generate/);
  assert.match(memberships, /membership-enterprise\/reports\/revenue/);
  assert.match(pos, /membership-enterprise\/plans/);
  assert.match(pos, /membership-enterprise\/client\/\$\{clientId\}\/eligibility/);
  assert.match(routes, /memberships\/:id/);
});

test("membership lifecycle is payment-safe and risk logged", () => {
  const memberships = read("src/app/pages/memberships.component.ts");
  const service = read("server/services/membership-enterprise.service.js");
  assert.match(memberships, /Confirm payment & renew/);
  assert.match(memberships, /Confirm payment & upgrade/);
  assert.match(memberships, /Confirm cancellation/);
  assert.match(service, /Lifecycle confirmation drawer is required/);
  assert.match(service, /Zero amount renew\/upgrade requires a reason/);
  assert.match(service, /riskFlags/);
  assert.match(service, /actor: \{/);
});

test("membership proration engine exposes preview fields and UI consumes them", () => {
  const routes = read("server/routes/membership-enterprise.routes.js");
  const service = read("server/services/membership-enterprise.service.js");
  const memberships = read("src/app/pages/memberships.component.ts");
  assert.match(routes, /proration-preview/);
  assert.match(service, /prorationPreview/);
  assert.match(service, /unusedValue/);
  assert.match(service, /creditCarryForward/);
  assert.match(service, /newExpiryDate/);
  assert.match(service, /suggestedAction/);
  assert.match(memberships, /refreshProrationPreview/);
  assert.match(memberships, /Payable difference/);
  assert.match(memberships, /Credit note/);
});

test("membership wallet powers client views and POS eligibility", () => {
  const routes = read("server/routes/membership-enterprise.routes.js");
  const service = read("server/services/membership-enterprise.service.js");
  const memberships = read("src/app/pages/memberships.component.ts");
  const membership360 = read("src/app/pages/membership-360.component.ts");
  const pos = read("src/app/pages/pos.component.ts");
  assert.match(routes, /client\/:clientId\/wallet/);
  assert.match(service, /membershipWallet\(clientId/);
  assert.match(service, /walletConnection/);
  assert.match(service, /familySharing/);
  assert.match(service, /packageSummary/);
  assert.match(service, /entitlementType/);
  assert.match(service, /wallets/);
  assert.match(memberships, /Membership Wallet/);
  assert.match(memberships, /Active packages/);
  assert.match(memberships, /selectedClientBenefitsLabel/);
  assert.match(memberships, /clientWalletOption/);
  assert.match(memberships, /membership-enterprise\/client\/\$\{clientId\}\/wallet/);
  assert.match(membership360, /Package credits/);
  assert.match(membership360, /Membership wallet snapshots/);
  assert.match(pos, /wallet'\]\?\.\['activeMembership'\]/);
  assert.match(pos, /activePackageCountForClientId/);
  assert.match(pos, /No active benefits/);
  assert.match(pos, /clientMembershipSearchSnapshot/);
});

test("membership auto-renew engine is payment-safe and audit-first", () => {
  const routes = read("server/routes/membership-enterprise.routes.js");
  const service = read("server/services/membership-enterprise.service.js");
  const memberships = read("src/app/pages/memberships.component.ts");
  assert.match(routes, /auto-renew\/queue/);
  assert.match(routes, /auto-renew\/:membershipId\/retry/);
  assert.match(routes, /auto-renew\/:membershipId\/pause/);
  assert.match(routes, /auto-renew\/:membershipId\/resume/);
  assert.match(service, /autoRenewQueue/);
  assert.match(service, /retryAutoRenew/);
  assert.match(service, /payment_provider_not_ready/);
  assert.match(service, /payment_method_missing/);
  assert.match(service, /membership\.auto_renew\.retry_failed/);
  assert.match(service, /Failed auto-renew should not extend membership|provider_confirmation_required|Membership extend/i);
  assert.match(memberships, /Auto-renew queue/);
  assert.match(memberships, /Manual retry/);
  assert.match(memberships, /pauseAutoRenew/);
  assert.match(memberships, /resumeAutoRenew/);
});

test("membership 360 timeline uses real ledger audit reminders and invoice links", () => {
  const routes = read("server/routes/membership-enterprise.routes.js");
  const service = read("server/services/membership-enterprise.service.js");
  const page = read("src/app/pages/membership-360.component.ts");
  const memberships = read("src/app/pages/memberships.component.ts");
  assert.match(routes, /memberships\/:id\/360/);
  assert.match(service, /membership360/);
  assert.match(service, /membershipLedgerRows/);
  assert.match(service, /membershipAuditRows/);
  assert.match(service, /membershipReminderRows/);
  assert.match(service, /membershipInvoiceLinks/);
  assert.match(service, /\/billing\/invoices\/\$\{invoiceId\}/);
  assert.match(service, /staffAttribution/);
  assert.match(service, /riskSignals/);
  assert.match(page, /Membership profile/);
  assert.match(page, /Payment history/);
  assert.match(page, /Lifecycle timeline/);
  assert.match(page, /Audit trail/);
  assert.match(page, /WhatsApp reminders/);
  assert.match(memberships, /\['\/memberships', membership\.id\]/);
});

test("membership self-service is request-first and approval gated", () => {
  const migration = read("server/db/migrations/20260529_membership_self_service.sql");
  const routes = read("server/routes/membership-enterprise.routes.js");
  const service = read("server/services/membership-enterprise.service.js");
  const memberships = read("src/app/pages/memberships.component.ts");
  const selfServicePage = read("src/app/pages/membership-self-service.component.ts");
  const appRoutes = read("src/app/app.routes.ts");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS membership_self_service_requests/);
  assert.match(migration, /tenant_id TEXT NOT NULL/);
  assert.match(migration, /hard delete forbidden for membership_self_service_requests/);
  assert.match(routes, /client\/:clientId\/self-service/);
  assert.match(routes, /self-service\/public\/:token/);
  assert.match(routes, /self-service\/requests\/:id\/approve/);
  assert.match(routes, /self-service\/requests\/:id\/reject/);
  assert.match(service, /membershipSelfServiceSummary/);
  assert.match(service, /createSelfServiceStatusLink/);
  assert.match(service, /createWhatsAppMembershipSummary/);
  assert.match(service, /createRenewPaymentLink/);
  assert.match(service, /createCancelRequest/);
  assert.match(service, /createPaymentMethodUpdateRequest/);
  assert.match(service, /approveSelfServiceRequest/);
  assert.match(service, /assertMembershipManager/);
  assert.match(service, /paymentProviderConfigured: false/);
  assert.match(service, /pending_approval/);
  assert.match(service, /actionApplied: false/);
  assert.match(memberships, /Membership self-service control center/);
  assert.match(memberships, /Request cancellation approval/);
  assert.match(memberships, /Owner\/manager/);
  assert.match(selfServicePage, /Request renewal payment link/);
  assert.match(selfServicePage, /Request cancellation approval/);
  assert.match(appRoutes, /memberships\/self-service\/:token/);
});

test("membership enterprise controls gate sensitive lifecycle actions", () => {
  const controlsMigration = read("server/db/migrations/20260529_membership_enterprise_controls.sql");
  const routes = read("server/routes/membership-enterprise.routes.js");
  const service = read("server/services/membership-enterprise.service.js");
  const memberships = read("src/app/pages/memberships.component.ts");
  assert.match(controlsMigration, /trg_membership_audit_no_update/);
  assert.match(controlsMigration, /trg_membership_audit_no_delete/);
  assert.match(controlsMigration, /trg_client_membership_ledger_no_update/);
  assert.match(controlsMigration, /trg_client_membership_ledger_no_delete/);
  assert.match(routes, /credit-adjustment-request/);
  assert.match(service, /MEMBERSHIP_LIFECYCLE_ROLES/);
  assert.match(service, /MEMBERSHIP_APPROVAL_ROLES/);
  assert.match(service, /createSensitiveLifecycleApprovalIfRequired/);
  assert.match(service, /membership_cancel_approval/);
  assert.match(service, /membership_refund_credit_note_approval/);
  assert.match(service, /membership_free_renewal_approval/);
  assert.match(service, /membership_expiry_extension_approval/);
  assert.match(service, /membership_manual_credit_adjustment_approval/);
  assert.match(service, /MAX_DIRECT_EXPIRY_EXTENSION_DAYS/);
  assert.match(service, /approvalBypass/);
  assert.match(service, /applyManualCreditAdjustment/);
  assert.match(service, /Only owner, super admin, manager or cashier/);
  assert.match(memberships, /Enterprise controls/);
  assert.match(memberships, /Manual credit adjustment/);
  assert.match(memberships, /pending approval/);
});
