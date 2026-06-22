import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appComponent = readFileSync("src/app/app.component.ts", "utf8");
const appRoutes = readFileSync("src/app/app.routes.ts", "utf8");
const serverApp = readFileSync("server/app.js", "utf8");
const rbac = readFileSync("server/middleware/rbac.js", "utf8");
const depositRoutes = readFileSync("server/routes/appointment-deposit-gate.routes.js", "utf8");
const bookingPaymentRoutes = readFileSync("server/routes/booking-payments.routes.js", "utf8");
const depositGateService = readFileSync("server/services/appointment-deposit-gate.service.js", "utf8");
const bookingDepositService = readFileSync("server/services/booking-deposit.service.js", "utf8");
const razorpayBookingService = readFileSync("server/services/razorpay-booking.service.js", "utf8");
const appointmentEnterprisePage = readFileSync("src/app/pages/appointments-enterprise.component.ts", "utf8");
const depositReportPage = readFileSync("src/app/pages/appointment-deposit-report.component.ts", "utf8");

test("Appointment deposit routes and sidebar report are wired", () => {
  assert.ok(appComponent.includes("path: '/appointment-deposits'"), "Deposit report should be visible in sidebar");
  assert.match(appRoutes, /path:\s*'appointment-deposits'[\s\S]*AppointmentDepositReportComponent/, "Deposit report route should load report page");
  assert.match(appRoutes, /path:\s*'appointment-deposits'[\s\S]*permissionGuard[\s\S]*read:appointment_deposits/, "Deposit report route should require read permission");
  assert.match(serverApp, /app\.use\("\/api\/v1", bookingPaymentsPublicRouter\)/, "Razorpay webhook should be public on /api/v1");
  assert.match(serverApp, /app\.use\("\/api", bookingPaymentsPublicRouter\)/, "Razorpay webhook should be public on legacy /api");
  assert.match(serverApp, /app\.use\("\/api\/v1", appointmentDepositGateRouter\)/, "Deposit gate should be mounted on /api/v1");
  assert.match(serverApp, /app\.use\("\/api", appointmentDepositGateRouter\)/, "Deposit gate should be mounted on legacy /api");
});

test("Deposit APIs enforce appointment and deposit permissions", () => {
  assert.match(depositRoutes, /\/appointment-deposits\/quote[\s\S]*requirePermission\("read",\s*\(\) => "appointments"\)[\s\S]*requirePermission\("read",\s*\(\) => "appointment_deposits"\)/, "Quote should require appointment and deposit read permission");
  assert.match(depositRoutes, /\/appointment-deposits\/multi-service-bookings[\s\S]*requirePermission\("write",\s*\(\) => "appointments"\)[\s\S]*requirePermission\("write",\s*\(\) => "appointment_deposits"\)/, "Deposit booking should require appointment and deposit write permission");
  assert.match(depositRoutes, /\/appointment-deposits\/report[\s\S]*requirePermission\("read",\s*\(\) => "appointment_deposits"\)/, "Report should require deposit read permission");
  assert.match(rbac, /read:appointment_deposits/, "RBAC should include deposit read grant");
  assert.match(rbac, /write:appointment_deposits/, "RBAC should include deposit write grant");
});

test("High-value appointment quote requires 20 percent deposit at 2000 threshold", () => {
  assert.match(depositGateService, /const THRESHOLD_AMOUNT = 2000/, "Deposit threshold should be 2000");
  assert.match(depositGateService, /const DEPOSIT_PERCENT = 20/, "Deposit percent should be 20");
  assert.match(depositGateService, /totalAmount >= THRESHOLD_AMOUNT \? money\(\(totalAmount \* DEPOSIT_PERCENT\) \/ 100\) : 0/, "Deposit should be 20 percent of total amount");
  assert.match(depositGateService, /tenantService\.assertBranchAccess\(access,\s*branchId\)/, "Quote should enforce branch access");
});

test("Deposit booking creates payment-pending appointment and payment link", () => {
  assert.match(depositGateService, /const BOOKING_STATUSES = new Set\(\[[\s\S]*"payment_pending"[\s\S]*"completed"[\s\S]*"cancelled"[\s\S]*"no-show"[\s\S]*\]\)/, "Booking truth should stay limited to appointment lifecycle statuses");
  assert.match(depositGateService, /status:\s*bookingStatus\(payload\.status\)/, "Deposit gate should normalize requested booking status before create");
  assert.match(depositGateService, /status:\s*"payment_pending"/, "High-value booking should stay payment pending until deposit is paid");
  assert.match(depositGateService, /enterpriseSchedulerService\.createMultiServiceBooking\(gatedPayload,\s*access,\s*req\)/, "Deposit booking should use enterprise scheduler");
  assert.match(depositGateService, /holdCreatedAppointmentsForDeposit\(result,\s*access\.tenantId\)/, "Deposit booking should force created appointments back to payment pending after link creation");
  assert.ok(depositGateService.indexOf("holdCreatedAppointmentsForDeposit(result, access.tenantId)") < depositGateService.indexOf("razorpayBookingService.createPaymentLink"), "Appointments should be held payment_pending before payment link creation can fail");
  assert.match(depositGateService, /SET status = 'payment_pending',\s*depositStatus = 'pending'/, "Pending deposit appointments must not look booked or paid before webhook confirmation");
  assert.match(depositGateService, /razorpayBookingService\.createPaymentLink\(\{[\s\S]*amount:\s*quote\.depositAmount/, "Deposit booking should create a payment link for the deposit amount");
  assert.match(depositGateService, /paymentLinkId:\s*link\.linkId[\s\S]*paymentLink:\s*link\.shortUrl/, "Deposit result should return payment link details");
  assert.match(appointmentEnterprisePage, /appointment-deposits\/multi-service-bookings/, "Appointment page should use deposit-gated booking endpoint");
  assert.match(appointmentEnterprisePage, /20% advance link sent/, "Appointment page should tell staff/client that 20 percent advance link was sent");
  assert.doesNotMatch(appointmentEnterprisePage, /'billed'/, "Appointment drawer should not expose billed as a booking status");
  assert.doesNotMatch(appointmentEnterprisePage, /'paid'/, "Appointment drawer should not expose paid as a booking status");
});

test("Payment webhook confirms appointment after deposit is paid", () => {
  assert.match(bookingPaymentRoutes, /\/booking-payments\/webhook\/razorpay[\s\S]*verifyAndProcessWebhook/, "Razorpay webhook should process payment events");
  assert.match(razorpayBookingService, /if \(status === "paid"\) \{[\s\S]*bookingDepositService\.markDepositPaid/, "Paid webhook should mark deposit paid");
  assert.match(razorpayBookingService, /else if \(status === "failed"\) \{[\s\S]*bookingDepositService\.markDepositFailed/, "Failed webhook should mark deposit failed");
  assert.match(razorpayBookingService, /link\.providerEventId === event\.eventId && link\.webhookReceivedAt/, "Webhook processing should be idempotent");
  assert.match(bookingDepositService, /depositStatus:\s*"paid"[\s\S]*status:\s*appointment\.status === "payment_pending" \? "booked" : appointment\.status/, "Paid deposit should confirm payment-pending appointment");
  assert.match(bookingDepositService, /bookingGroupId[\s\S]*SELECT id FROM appointments WHERE tenantId = \? AND bookingGroupId = \?/, "Paid deposit should confirm the whole booking group");
  assert.match(bookingDepositService, /details:\s*\{[\s\S]*appointmentIds:\s*targetIds/, "Paid deposit audit should include every appointment confirmed by the group payment");
  assert.match(bookingDepositService, /action:\s*"deposit\.paid"/, "Paid deposit should be audited");
});

test("Deposit report tracks paid, pending and forfeited advance amounts", () => {
  assert.match(depositReportPage, /appointment-deposits\/report/, "Deposit report page should load report API");
  assert.match(depositReportPage, /Payment link[\s\S]*row\.paymentLink/, "Deposit report should show payment links");
  assert.match(depositGateService, /LEFT JOIN appointments a ON a\.id = l\.appointmentId AND a\.tenantId = l\.tenantId/, "Report should connect links to appointments");
  assert.match(depositGateService, /LEFT JOIN clients c ON c\.id = a\.clientId AND c\.tenantId = l\.tenantId/, "Report should connect appointment clients");
  assert.match(depositGateService, /paidAmount \+= row\.amount/, "Report should total paid deposits");
  assert.match(depositGateService, /forfeitedAmount \+= row\.amount/, "Report should total forfeited deposits");
  assert.match(depositGateService, /pendingAmount \+= row\.amount/, "Report should total pending deposits");
});
