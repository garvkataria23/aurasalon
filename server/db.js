import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, "salon-crm.sqlite"));
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

export const DEFAULT_TENANT_ID = "tenant_aura";

export const jsonColumns = {
  subscription_plans: ["limits", "features"],
  feature_toggles: ["rules"],
  super_admin_audit: ["details"],
  platform_analytics_snapshots: ["metrics", "insights"],
  tenant_users: ["branchIds"],
  auth_refresh_tokens: [],
  mobile_devices: ["capabilities"],
  push_subscriptions: ["metadata"],
  push_notifications: ["payload"],
  realtime_events: ["payload"],
  realtime_queue_items: ["payload", "history"],
  staff_presence: [],
  staff_attendance: [],
  staff_shifts: ["serviceIds"],
  staff_commission_runs: ["summary", "entries"],
  payroll_exports: ["rows", "totals"],
  suppliers: [],
  inventory_batches: [],
  inventory_predictions: ["metrics", "suggestions"],
  inventory_waste_events: [],
  ai_marketing_generations: ["input", "segment", "output", "actions"],
  marketing_workflows: ["triggerRule", "steps", "metrics"],
  marketing_sequences: ["audienceRule", "steps", "metrics"],
  email_templates: ["variables"],
  booking_recommendations: ["request", "recommendations", "selectedSlot", "signals"],
  booking_waitlist: ["serviceIds", "preferences", "recommendations"],
  online_booking_requests: ["serviceIds", "clientInfo", "preferences", "recommendedSlots"],
  qr_checkins: ["metadata"],
  security_audit_logs: ["details"],
  security_activity_events: ["metadata"],
  security_sessions: ["metadata"],
  security_backups: ["manifest", "result"],
  security_permissions: ["actions", "conditions"],
  role_definitions: ["permissions"],
  encrypted_secrets: ["metadata"],
  quality_runs: ["result", "details"],
  deployment_events: ["result"],
  offline_sync_items: ["payload", "conflicts", "result"],
  offline_cache_snapshots: ["data", "metadata"],
  white_label_profiles: ["theme", "assets", "settings"],
  branch_branding: ["theme", "assets"],
  innovation_runs: ["input", "signals", "output", "actions"],
  voice_booking_sessions: ["transcript", "entities", "actions"],
  kiosk_sessions: ["state", "events"],
  workflow_definitions: ["trigger", "conditions", "actions"],
  workflow_runs: ["triggerSource", "audience", "actionResult"],
  finance_daily_closings: ["totals", "payments", "expenses", "refunds", "payouts"],
  coupon_codes: ["rules"],
  wallet_transactions: ["metadata"],
  credit_notes: ["lineItems"],
  invoice_documents: ["payload"],
  customer_intelligence_snapshots: ["metrics", "insights", "nextBestAction"],
  customer_timeline_events: ["metadata"],
  booking_portal_events: ["payload"],
  analytics_snapshots: ["input", "metrics", "insights"],
  ai_interactions: ["input", "context", "output", "actions"],
  whatsapp_threads: ["tags", "metadata"],
  whatsapp_messages: ["metadata"],
  whatsapp_automation_rules: ["conditions", "actions"],
  whatsapp_handoffs: ["history"],
  clients: ["tags", "visitHistory", "purchaseHistory", "whatsappHistory", "consentForms"],
  appointments: ["serviceIds"],
  services: ["assignedStaff", "requiredProducts", "addOns", "packageServices"],
  products: [],
  inventory_transactions: [],
  sales: ["items", "splitPayments", "membershipRedeem"],
  invoices: ["lineItems"],
  payments: [],
  memberships: ["serviceCredits", "redeemHistory"],
  staff: ["assignedServices", "commissionRule", "attendance", "performance"],
  branches: [],
  campaigns: ["segmentRule"],
  notifications: [],
  settings: ["value"],
  gift_cards: ["redeemHistory"]
};

export const resources = {
  tenants: { table: "tenants", required: ["name", "slug"], tenantScoped: false },
  subscriptionPlans: { table: "subscription_plans", required: ["name", "code"], tenantScoped: false },
  featureToggles: { table: "feature_toggles", required: ["key", "name"], tenantScoped: false },
  platformAnalytics: { table: "platform_analytics_snapshots", required: ["type", "metrics"], tenantScoped: false },
  superAdminAudit: { table: "super_admin_audit", required: ["action"], tenantScoped: false },
  subscriptions: { table: "subscriptions", required: ["planId", "status"], tenantScoped: true },
  tenantUsers: { table: "tenant_users", required: ["name", "email", "role"], tenantScoped: true },
  domainMappings: { table: "domain_mappings", required: ["domain"], tenantScoped: true },
  usageEvents: { table: "usage_events", required: ["metric", "quantity"], tenantScoped: true },
  mobileDevices: { table: "mobile_devices", required: ["userId", "platform"], tenantScoped: true },
  pushSubscriptions: { table: "push_subscriptions", required: ["userId", "deviceId", "endpoint"], tenantScoped: true },
  pushNotifications: { table: "push_notifications", required: ["title", "message"], tenantScoped: true },
  realtimeEvents: { table: "realtime_events", required: ["channel", "type", "payload"], tenantScoped: true },
  realtimeQueue: { table: "realtime_queue_items", required: ["branchId", "type", "title"], tenantScoped: true },
  staffPresence: { table: "staff_presence", required: ["userId", "status"], tenantScoped: true },
  staffAttendance: { table: "staff_attendance", required: ["staffId", "date", "status"], tenantScoped: true },
  staffShifts: { table: "staff_shifts", required: ["staffId", "branchId", "date", "startTime", "endTime"], tenantScoped: true },
  staffCommissionRuns: { table: "staff_commission_runs", required: ["periodStart", "periodEnd", "entries"], tenantScoped: true },
  payrollExports: { table: "payroll_exports", required: ["periodStart", "periodEnd", "rows"], tenantScoped: true },
  suppliers: { table: "suppliers", required: ["name"], tenantScoped: true },
  inventoryBatches: { table: "inventory_batches", required: ["productId", "branchId", "batchNumber"], tenantScoped: true },
  inventoryPredictions: { table: "inventory_predictions", required: ["type", "metrics", "suggestions"], tenantScoped: true },
  inventoryWasteEvents: { table: "inventory_waste_events", required: ["productId", "branchId", "quantity", "reason"], tenantScoped: true },
  aiMarketingGenerations: { table: "ai_marketing_generations", required: ["type", "output"], tenantScoped: true },
  marketingWorkflows: { table: "marketing_workflows", required: ["name", "trigger"], tenantScoped: true },
  marketingSequences: { table: "marketing_sequences", required: ["name", "channel"], tenantScoped: true },
  emailTemplates: { table: "email_templates", required: ["name", "subject", "body"], tenantScoped: true },
  bookingRecommendations: { table: "booking_recommendations", required: ["request", "recommendations"], tenantScoped: true },
  bookingWaitlist: { table: "booking_waitlist", required: ["clientId", "branchId"], tenantScoped: true },
  onlineBookingRequests: { table: "online_booking_requests", required: ["branchId", "clientInfo"], tenantScoped: true },
  qrCheckins: { table: "qr_checkins", required: ["branchId", "source"], tenantScoped: true },
  securityAuditLogs: { table: "security_audit_logs", required: ["action"], tenantScoped: true },
  securityActivityEvents: { table: "security_activity_events", required: ["method", "path"], tenantScoped: true },
  securitySessions: { table: "security_sessions", required: ["userId"], tenantScoped: true },
  securityBackups: { table: "security_backups", required: ["type"], tenantScoped: true },
  securityPermissions: { table: "security_permissions", required: ["role", "resource"], tenantScoped: true },
  roleDefinitions: { table: "role_definitions", required: ["role", "name"], tenantScoped: true },
  encryptedSecrets: { table: "encrypted_secrets", required: ["name", "ciphertext"], tenantScoped: true },
  qualityRuns: { table: "quality_runs", required: ["type", "status"], tenantScoped: true },
  deploymentEvents: { table: "deployment_events", required: ["type", "status"], tenantScoped: true },
  offlineSyncItems: { table: "offline_sync_items", required: ["deviceId", "entity", "operation"], tenantScoped: true },
  offlineCacheSnapshots: { table: "offline_cache_snapshots", required: ["deviceId", "resource", "data"], tenantScoped: true },
  whiteLabelProfiles: { table: "white_label_profiles", required: ["name"], tenantScoped: true },
  branchBranding: { table: "branch_branding", required: ["branchId"], tenantScoped: true },
  innovationRuns: { table: "innovation_runs", required: ["type", "output"], tenantScoped: true },
  voiceBookingSessions: { table: "voice_booking_sessions", required: ["channel"], tenantScoped: true },
  kioskSessions: { table: "kiosk_sessions", required: ["branchId", "mode"], tenantScoped: true },
  workflowDefinitions: { table: "workflow_definitions", required: ["name"], tenantScoped: true },
  workflowRuns: { table: "workflow_runs", required: ["workflowId"], tenantScoped: true },
  financeCashDrawers: { table: "finance_cash_drawers", required: ["branchId"], tenantScoped: true },
  financeExpenses: { table: "finance_expenses", required: ["branchId", "category", "amount"], tenantScoped: true },
  financeDailyClosings: { table: "finance_daily_closings", required: ["branchId", "businessDate"], tenantScoped: true },
  financeRefunds: { table: "finance_refunds", required: ["invoiceId", "amount"], tenantScoped: true },
  financeStaffPayouts: { table: "finance_staff_payouts", required: ["staffId", "periodStart", "periodEnd"], tenantScoped: true },
  couponCodes: { table: "coupon_codes", required: ["code", "name", "type", "value"], tenantScoped: true },
  walletTransactions: { table: "wallet_transactions", required: ["clientId", "type", "amount"], tenantScoped: true },
  creditNotes: { table: "credit_notes", required: ["invoiceId", "amount"], tenantScoped: true },
  invoiceDocuments: { table: "invoice_documents", required: ["invoiceId", "format"], tenantScoped: true },
  customerIntelligenceSnapshots: { table: "customer_intelligence_snapshots", required: ["clientId", "metrics"], tenantScoped: true },
  customerTimelineEvents: { table: "customer_timeline_events", required: ["clientId", "type", "title"], tenantScoped: true },
  bookingPortalEvents: { table: "booking_portal_events", required: ["type"], tenantScoped: true },
  analyticsSnapshots: { table: "analytics_snapshots", required: ["type", "metrics"], tenantScoped: true },
  aiInteractions: { table: "ai_interactions", required: ["type", "prompt"], tenantScoped: true },
  whatsappThreads: { table: "whatsapp_threads", required: ["phone"], tenantScoped: true },
  whatsappMessages: { table: "whatsapp_messages", required: ["threadId", "direction", "body"], tenantScoped: true },
  whatsappRules: { table: "whatsapp_automation_rules", required: ["name", "trigger", "template"], tenantScoped: true },
  whatsappHandoffs: { table: "whatsapp_handoffs", required: ["threadId", "reason"], tenantScoped: true },
  clients: { table: "clients", required: ["name", "phone"] },
  appointments: { table: "appointments", required: ["clientId", "staffId", "branchId", "startAt"] },
  services: { table: "services", required: ["name", "category", "price", "durationMinutes"] },
  products: { table: "products", required: ["name", "sku", "branchId"] },
  inventory: { table: "inventory_transactions", required: ["productId", "branchId", "type", "quantity"] },
  sales: { table: "sales", required: ["clientId", "branchId", "items"] },
  invoices: { table: "invoices", required: ["saleId", "clientId", "invoiceNumber"] },
  payments: { table: "payments", required: ["invoiceId", "mode", "amount"] },
  memberships: { table: "memberships", required: ["planName", "clientId"] },
  staff: { table: "staff", required: ["name", "role", "branchId"] },
  marketing: { table: "campaigns", required: ["name", "channel"] },
  branches: { table: "branches", required: ["name", "city"] },
  settings: { table: "settings", required: ["key", "value"] },
  notifications: { table: "notifications", required: ["channel", "message"] },
  giftCards: { table: "gift_cards", required: ["code", "initialValue"] }
};

const schema = [
  `CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    priceMonthly REAL DEFAULT 0,
    trialDays INTEGER DEFAULT 14,
    limits TEXT DEFAULT '{}',
    features TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS feature_toggles (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    scope TEXT DEFAULT 'global',
    tenantId TEXT DEFAULT '',
    planId TEXT DEFAULT '',
    enabled INTEGER DEFAULT 0,
    rules TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS super_admin_audit (
    id TEXT PRIMARY KEY,
    actorUserId TEXT DEFAULT '',
    action TEXT NOT NULL,
    targetType TEXT DEFAULT '',
    targetId TEXT DEFAULT '',
    details TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS platform_analytics_snapshots (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    periodStart TEXT DEFAULT '',
    periodEnd TEXT DEFAULT '',
    metrics TEXT DEFAULT '{}',
    insights TEXT DEFAULT '[]',
    status TEXT DEFAULT 'generated',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'trialing',
    planId TEXT DEFAULT '',
    subscriptionStatus TEXT DEFAULT 'trialing',
    trialEndsAt TEXT DEFAULT '',
    ownerEmail TEXT DEFAULT '',
    primaryDomain TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(planId) REFERENCES subscription_plans(id)
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    planId TEXT NOT NULL,
    status TEXT DEFAULT 'trialing',
    trialStart TEXT DEFAULT '',
    trialEndsAt TEXT DEFAULT '',
    currentPeriodStart TEXT DEFAULT '',
    currentPeriodEnd TEXT DEFAULT '',
    cancelAt TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(planId) REFERENCES subscription_plans(id)
  )`,
  `CREATE TABLE IF NOT EXISTS tenant_users (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    branchIds TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS domain_mappings (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending',
    isPrimary INTEGER DEFAULT 0,
    verifiedAt TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    metric TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    periodStart TEXT DEFAULT '',
    periodEnd TEXT DEFAULT '',
    referenceType TEXT DEFAULT '',
    referenceId TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    userId TEXT NOT NULL,
    tokenHash TEXT NOT NULL UNIQUE,
    deviceId TEXT DEFAULT '',
    role TEXT DEFAULT '',
    branchId TEXT DEFAULT '',
    expiresAt TEXT NOT NULL,
    revokedAt TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS mobile_devices (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    userId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    platform TEXT NOT NULL,
    deviceToken TEXT DEFAULT '',
    pushProvider TEXT DEFAULT 'fcm',
    appVersion TEXT DEFAULT '',
    capabilities TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    lastSeenAt TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    userId TEXT NOT NULL,
    deviceId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    endpoint TEXT NOT NULL,
    platform TEXT DEFAULT '',
    provider TEXT DEFAULT 'fcm',
    authSecret TEXT DEFAULT '',
    p256dh TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS push_notifications (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    userId TEXT DEFAULT '',
    branchId TEXT DEFAULT '',
    deviceId TEXT DEFAULT '',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    payload TEXT DEFAULT '{}',
    status TEXT DEFAULT 'queued',
    providerMessageId TEXT DEFAULT '',
    sentAt TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS realtime_events (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    channel TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS realtime_queue_items (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    clientId TEXT DEFAULT '',
    appointmentId TEXT DEFAULT '',
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'waiting',
    assignedStaffId TEXT DEFAULT '',
    payload TEXT DEFAULT '{}',
    history TEXT DEFAULT '[]',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS staff_presence (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    userId TEXT NOT NULL,
    staffId TEXT DEFAULT '',
    status TEXT DEFAULT 'offline',
    deviceId TEXT DEFAULT '',
    lastSeenAt TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS staff_attendance (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    staffId TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'present',
    clockIn TEXT DEFAULT '',
    clockOut TEXT DEFAULT '',
    minutesWorked REAL DEFAULT 0,
    overtimeMinutes REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(staffId) REFERENCES staff(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS staff_shifts (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    staffId TEXT NOT NULL,
    date TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    role TEXT DEFAULT '',
    chair TEXT DEFAULT '',
    serviceIds TEXT DEFAULT '[]',
    status TEXT DEFAULT 'planned',
    notes TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(staffId) REFERENCES staff(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS staff_commission_runs (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    periodStart TEXT NOT NULL,
    periodEnd TEXT NOT NULL,
    summary TEXT DEFAULT '{}',
    entries TEXT DEFAULT '[]',
    status TEXT DEFAULT 'calculated',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS payroll_exports (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    periodStart TEXT NOT NULL,
    periodEnd TEXT NOT NULL,
    format TEXT DEFAULT 'csv',
    rows TEXT DEFAULT '[]',
    totals TEXT DEFAULT '{}',
    status TEXT DEFAULT 'ready',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    name TEXT NOT NULL,
    contactName TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    gstin TEXT DEFAULT '',
    address TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_batches (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    productId TEXT NOT NULL,
    supplierId TEXT DEFAULT '',
    batchNumber TEXT NOT NULL,
    expiryDate TEXT DEFAULT '',
    quantityReceived REAL DEFAULT 0,
    quantityAvailable REAL DEFAULT 0,
    unitCost REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(branchId) REFERENCES branches(id),
    FOREIGN KEY(productId) REFERENCES products(id)
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_predictions (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    type TEXT NOT NULL,
    periodStart TEXT DEFAULT '',
    periodEnd TEXT DEFAULT '',
    metrics TEXT DEFAULT '{}',
    suggestions TEXT DEFAULT '[]',
    status TEXT DEFAULT 'generated',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_waste_events (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    productId TEXT NOT NULL,
    batchId TEXT DEFAULT '',
    quantity REAL DEFAULT 0,
    reason TEXT NOT NULL,
    costImpact REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(branchId) REFERENCES branches(id),
    FOREIGN KEY(productId) REFERENCES products(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ai_marketing_generations (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    type TEXT NOT NULL,
    campaignId TEXT DEFAULT '',
    input TEXT DEFAULT '{}',
    segment TEXT DEFAULT '{}',
    output TEXT DEFAULT '{}',
    actions TEXT DEFAULT '[]',
    status TEXT DEFAULT 'generated',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS marketing_workflows (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    name TEXT NOT NULL,
    trigger TEXT NOT NULL,
    channel TEXT DEFAULT 'WhatsApp',
    status TEXT DEFAULT 'draft',
    triggerRule TEXT DEFAULT '{}',
    steps TEXT DEFAULT '[]',
    metrics TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS marketing_sequences (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    campaignId TEXT DEFAULT '',
    audienceRule TEXT DEFAULT '{}',
    steps TEXT DEFAULT '[]',
    status TEXT DEFAULT 'draft',
    metrics TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    purpose TEXT DEFAULT '',
    variables TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS booking_recommendations (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    clientId TEXT DEFAULT '',
    source TEXT DEFAULT 'smart-booking',
    request TEXT DEFAULT '{}',
    recommendations TEXT DEFAULT '[]',
    selectedSlot TEXT DEFAULT '{}',
    signals TEXT DEFAULT '{}',
    status TEXT DEFAULT 'generated',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS booking_waitlist (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    clientId TEXT NOT NULL,
    serviceIds TEXT DEFAULT '[]',
    preferredDate TEXT DEFAULT '',
    preferredStaffId TEXT DEFAULT '',
    preferences TEXT DEFAULT '{}',
    recommendations TEXT DEFAULT '[]',
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'waiting',
    convertedAppointmentId TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(branchId) REFERENCES branches(id),
    FOREIGN KEY(clientId) REFERENCES clients(id)
  )`,
  `CREATE TABLE IF NOT EXISTS online_booking_requests (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    clientId TEXT DEFAULT '',
    clientInfo TEXT DEFAULT '{}',
    serviceIds TEXT DEFAULT '[]',
    preferences TEXT DEFAULT '{}',
    recommendedSlots TEXT DEFAULT '[]',
    selectedSlotAt TEXT DEFAULT '',
    status TEXT DEFAULT 'requested',
    source TEXT DEFAULT 'online-portal',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS qr_checkins (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    appointmentId TEXT DEFAULT '',
    clientId TEXT DEFAULT '',
    source TEXT NOT NULL,
    code TEXT DEFAULT '',
    queueItemId TEXT DEFAULT '',
    status TEXT DEFAULT 'arrived',
    metadata TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS security_audit_logs (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    actorUserId TEXT DEFAULT '',
    actorRole TEXT DEFAULT '',
    action TEXT NOT NULL,
    targetType TEXT DEFAULT '',
    targetId TEXT DEFAULT '',
    severity TEXT DEFAULT 'info',
    ipAddress TEXT DEFAULT '',
    userAgent TEXT DEFAULT '',
    details TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS security_activity_events (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    userId TEXT DEFAULT '',
    role TEXT DEFAULT '',
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    statusCode INTEGER DEFAULT 0,
    durationMs INTEGER DEFAULT 0,
    ipAddress TEXT DEFAULT '',
    userAgent TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS security_sessions (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    userId TEXT NOT NULL,
    role TEXT DEFAULT '',
    branchId TEXT DEFAULT '',
    deviceId TEXT DEFAULT '',
    ipAddress TEXT DEFAULT '',
    userAgent TEXT DEFAULT '',
    startedAt TEXT DEFAULT '',
    lastSeenAt TEXT DEFAULT '',
    expiresAt TEXT DEFAULT '',
    revokedAt TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    metadata TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS security_backups (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    type TEXT NOT NULL,
    filePath TEXT DEFAULT '',
    fileSizeBytes INTEGER DEFAULT 0,
    checksum TEXT DEFAULT '',
    manifest TEXT DEFAULT '{}',
    result TEXT DEFAULT '{}',
    status TEXT DEFAULT 'completed',
    createdBy TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS security_permissions (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    role TEXT NOT NULL,
    resource TEXT NOT NULL,
    actions TEXT DEFAULT '[]',
    effect TEXT DEFAULT 'allow',
    conditions TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS role_definitions (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    permissions TEXT DEFAULT '[]',
    isSystem INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    createdBy TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS encrypted_secrets (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    name TEXT NOT NULL,
    purpose TEXT DEFAULT '',
    algorithm TEXT DEFAULT 'aes-256-gcm',
    iv TEXT DEFAULT '',
    authTag TEXT DEFAULT '',
    ciphertext TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS quality_runs (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    result TEXT DEFAULT '{}',
    details TEXT DEFAULT '[]',
    startedAt TEXT DEFAULT '',
    completedAt TEXT DEFAULT '',
    createdBy TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS deployment_events (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    type TEXT NOT NULL,
    environment TEXT DEFAULT 'production',
    version TEXT DEFAULT '',
    status TEXT NOT NULL,
    result TEXT DEFAULT '{}',
    createdBy TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS offline_sync_items (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    deviceId TEXT NOT NULL,
    entity TEXT NOT NULL,
    operation TEXT NOT NULL,
    localId TEXT DEFAULT '',
    serverId TEXT DEFAULT '',
    payload TEXT DEFAULT '{}',
    conflicts TEXT DEFAULT '[]',
    result TEXT DEFAULT '{}',
    status TEXT DEFAULT 'queued',
    attemptedAt TEXT DEFAULT '',
    syncedAt TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS offline_cache_snapshots (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    deviceId TEXT NOT NULL,
    resource TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    metadata TEXT DEFAULT '{}',
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'fresh',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS white_label_profiles (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    name TEXT NOT NULL,
    brandName TEXT DEFAULT '',
    logoUrl TEXT DEFAULT '',
    faviconUrl TEXT DEFAULT '',
    domain TEXT DEFAULT '',
    theme TEXT DEFAULT '{}',
    assets TEXT DEFAULT '{}',
    settings TEXT DEFAULT '{}',
    isDefault INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS branch_branding (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    profileId TEXT DEFAULT '',
    brandName TEXT DEFAULT '',
    logoUrl TEXT DEFAULT '',
    theme TEXT DEFAULT '{}',
    assets TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS innovation_runs (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    type TEXT NOT NULL,
    input TEXT DEFAULT '{}',
    signals TEXT DEFAULT '{}',
    output TEXT DEFAULT '{}',
    actions TEXT DEFAULT '[]',
    confidence REAL DEFAULT 0,
    status TEXT DEFAULT 'generated',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS voice_booking_sessions (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    clientId TEXT DEFAULT '',
    channel TEXT NOT NULL,
    transcript TEXT DEFAULT '[]',
    entities TEXT DEFAULT '{}',
    actions TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS kiosk_sessions (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    mode TEXT NOT NULL,
    clientId TEXT DEFAULT '',
    state TEXT DEFAULT '{}',
    events TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS workflow_definitions (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    trigger TEXT DEFAULT '{}',
    conditions TEXT DEFAULT '{}',
    actions TEXT DEFAULT '[]',
    delayMinutes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    lastRunAt TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    workflowId TEXT NOT NULL,
    triggerSource TEXT DEFAULT '{}',
    audience TEXT DEFAULT '[]',
    actionResult TEXT DEFAULT '{}',
    status TEXT DEFAULT 'completed',
    startedAt TEXT DEFAULT '',
    completedAt TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(workflowId) REFERENCES workflow_definitions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS finance_cash_drawers (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    openedBy TEXT DEFAULT '',
    closedBy TEXT DEFAULT '',
    openingFloat REAL DEFAULT 0,
    expectedCash REAL DEFAULT 0,
    countedCash REAL DEFAULT 0,
    variance REAL DEFAULT 0,
    status TEXT DEFAULT 'open',
    openedAt TEXT DEFAULT '',
    closedAt TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS finance_expenses (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    category TEXT NOT NULL,
    vendor TEXT DEFAULT '',
    amount REAL DEFAULT 0,
    taxAmount REAL DEFAULT 0,
    paymentMode TEXT DEFAULT 'cash',
    paidAt TEXT DEFAULT '',
    staffId TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'paid',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS finance_daily_closings (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    businessDate TEXT NOT NULL,
    cashDrawerId TEXT DEFAULT '',
    totals TEXT DEFAULT '{}',
    payments TEXT DEFAULT '{}',
    expenses TEXT DEFAULT '[]',
    refunds TEXT DEFAULT '[]',
    payouts TEXT DEFAULT '[]',
    variance REAL DEFAULT 0,
    status TEXT DEFAULT 'closed',
    notes TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS finance_refunds (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    invoiceId TEXT NOT NULL,
    saleId TEXT DEFAULT '',
    paymentId TEXT DEFAULT '',
    clientId TEXT DEFAULT '',
    amount REAL DEFAULT 0,
    mode TEXT DEFAULT 'original',
    reason TEXT DEFAULT '',
    status TEXT DEFAULT 'processed',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(invoiceId) REFERENCES invoices(id)
  )`,
  `CREATE TABLE IF NOT EXISTS finance_staff_payouts (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    staffId TEXT NOT NULL,
    periodStart TEXT NOT NULL,
    periodEnd TEXT NOT NULL,
    commissionAmount REAL DEFAULT 0,
    incentiveAmount REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    netAmount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    paidAt TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(staffId) REFERENCES staff(id)
  )`,
  `CREATE TABLE IF NOT EXISTS coupon_codes (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL DEFAULT 0,
    maxDiscount REAL DEFAULT 0,
    minSubtotal REAL DEFAULT 0,
    startsAt TEXT DEFAULT '',
    endsAt TEXT DEFAULT '',
    usageLimit INTEGER DEFAULT 0,
    usedCount INTEGER DEFAULT 0,
    rules TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    clientId TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    balanceAfter REAL DEFAULT 0,
    referenceType TEXT DEFAULT '',
    referenceId TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(clientId) REFERENCES clients(id)
  )`,
  `CREATE TABLE IF NOT EXISTS credit_notes (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    invoiceId TEXT NOT NULL,
    saleId TEXT DEFAULT '',
    clientId TEXT NOT NULL,
    creditNoteNumber TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT DEFAULT '',
    lineItems TEXT DEFAULT '[]',
    status TEXT DEFAULT 'issued',
    createdBy TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(invoiceId) REFERENCES invoices(id),
    FOREIGN KEY(clientId) REFERENCES clients(id)
  )`,
  `CREATE TABLE IF NOT EXISTS invoice_documents (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    invoiceId TEXT NOT NULL,
    invoiceNumber TEXT NOT NULL,
    format TEXT DEFAULT 'html',
    content TEXT DEFAULT '',
    payload TEXT DEFAULT '{}',
    status TEXT DEFAULT 'generated',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(invoiceId) REFERENCES invoices(id)
  )`,
  `CREATE TABLE IF NOT EXISTS customer_intelligence_snapshots (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    clientId TEXT NOT NULL,
    metrics TEXT DEFAULT '{}',
    insights TEXT DEFAULT '[]',
    nextBestAction TEXT DEFAULT '{}',
    status TEXT DEFAULT 'generated',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(clientId) REFERENCES clients(id)
  )`,
  `CREATE TABLE IF NOT EXISTS customer_timeline_events (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    clientId TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(clientId) REFERENCES clients(id)
  )`,
  `CREATE TABLE IF NOT EXISTS booking_portal_events (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    appointmentId TEXT DEFAULT '',
    clientId TEXT DEFAULT '',
    sessionId TEXT DEFAULT '',
    type TEXT NOT NULL,
    payload TEXT DEFAULT '{}',
    status TEXT DEFAULT 'completed',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ai_interactions (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    clientId TEXT DEFAULT '',
    appointmentId TEXT DEFAULT '',
    type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    input TEXT DEFAULT '{}',
    context TEXT DEFAULT '{}',
    output TEXT DEFAULT '{}',
    actions TEXT DEFAULT '[]',
    model TEXT DEFAULT 'local-business-rules',
    status TEXT DEFAULT 'completed',
    confidence REAL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    type TEXT NOT NULL,
    periodStart TEXT DEFAULT '',
    periodEnd TEXT DEFAULT '',
    input TEXT DEFAULT '{}',
    metrics TEXT DEFAULT '{}',
    insights TEXT DEFAULT '[]',
    status TEXT DEFAULT 'generated',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_threads (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    branchId TEXT DEFAULT '',
    clientId TEXT DEFAULT '',
    phone TEXT NOT NULL,
    displayName TEXT DEFAULT '',
    source TEXT DEFAULT 'inbound',
    status TEXT DEFAULT 'open',
    intent TEXT DEFAULT 'unknown',
    leadScore REAL DEFAULT 0,
    assignedUserId TEXT DEFAULT '',
    handoffStatus TEXT DEFAULT 'none',
    lastMessageAt TEXT DEFAULT '',
    lastMessagePreview TEXT DEFAULT '',
    unreadCount INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    threadId TEXT NOT NULL,
    clientId TEXT DEFAULT '',
    branchId TEXT DEFAULT '',
    direction TEXT NOT NULL,
    eventType TEXT DEFAULT '',
    body TEXT NOT NULL,
    templateKey TEXT DEFAULT '',
    intent TEXT DEFAULT '',
    status TEXT DEFAULT 'queued',
    providerMessageId TEXT DEFAULT '',
    metadata TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(threadId) REFERENCES whatsapp_threads(id)
  )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_automation_rules (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    name TEXT NOT NULL,
    trigger TEXT NOT NULL,
    template TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    delayMinutes INTEGER DEFAULT 0,
    conditions TEXT DEFAULT '{}',
    actions TEXT DEFAULT '[]',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_handoffs (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL,
    threadId TEXT NOT NULL,
    clientId TEXT DEFAULT '',
    branchId TEXT DEFAULT '',
    reason TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'open',
    assignedTo TEXT DEFAULT '',
    history TEXT DEFAULT '[]',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(tenantId) REFERENCES tenants(id),
    FOREIGN KEY(threadId) REFERENCES whatsapp_threads(id)
  )`,
  `CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    gstin TEXT DEFAULT '',
    timezone TEXT DEFAULT 'Asia/Kolkata',
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT DEFAULT '',
    gender TEXT DEFAULT '',
    birthday TEXT DEFAULT '',
    anniversary TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    notes TEXT DEFAULT '',
    walletBalance REAL DEFAULT 0,
    loyaltyPoints INTEGER DEFAULT 0,
    membershipId TEXT DEFAULT '',
    branchId TEXT,
    totalSpend REAL DEFAULT 0,
    visitCount INTEGER DEFAULT 0,
    lastVisitAt TEXT DEFAULT '',
    visitHistory TEXT DEFAULT '[]',
    purchaseHistory TEXT DEFAULT '[]',
    whatsappHistory TEXT DEFAULT '[]',
    consentForms TEXT DEFAULT '[]',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    branchId TEXT NOT NULL,
    shift TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    assignedServices TEXT DEFAULT '[]',
    commissionRule TEXT DEFAULT '{}',
    attendance TEXT DEFAULT '[]',
    performance TEXT DEFAULT '{}',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    durationMinutes INTEGER NOT NULL,
    assignedStaff TEXT DEFAULT '[]',
    requiredProducts TEXT DEFAULT '[]',
    addOns TEXT DEFAULT '[]',
    packageServices TEXT DEFAULT '[]',
    gstRate REAL DEFAULT 18,
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    category TEXT DEFAULT '',
    usageType TEXT DEFAULT 'retail',
    supplier TEXT DEFAULT '',
    branchId TEXT NOT NULL,
    stock REAL DEFAULT 0,
    lowStockThreshold REAL DEFAULT 5,
    expiryDate TEXT DEFAULT '',
    unitCost REAL DEFAULT 0,
    price REAL DEFAULT 0,
    gstRate REAL DEFAULT 18,
    status TEXT DEFAULT 'active',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL,
    staffId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    serviceIds TEXT DEFAULT '[]',
    startAt TEXT NOT NULL,
    endAt TEXT DEFAULT '',
    status TEXT DEFAULT 'booked',
    source TEXT DEFAULT 'front-desk',
    onlineStatus TEXT DEFAULT 'not-online',
    chair TEXT DEFAULT '',
    room TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    billable INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(clientId) REFERENCES clients(id),
    FOREIGN KEY(staffId) REFERENCES staff(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_transactions (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    batchId TEXT DEFAULT '',
    supplierId TEXT DEFAULT '',
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    unitCost REAL DEFAULT 0,
    totalCost REAL DEFAULT 0,
    reason TEXT DEFAULT '',
    referenceType TEXT DEFAULT '',
    referenceId TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    FOREIGN KEY(productId) REFERENCES products(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL,
    appointmentId TEXT DEFAULT '',
    branchId TEXT NOT NULL,
    staffId TEXT DEFAULT '',
    items TEXT DEFAULT '[]',
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    gstAmount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    commissionTotal REAL DEFAULT 0,
    membershipRedeem TEXT DEFAULT '{}',
    splitPayments TEXT DEFAULT '[]',
    status TEXT DEFAULT 'completed',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(clientId) REFERENCES clients(id),
    FOREIGN KEY(branchId) REFERENCES branches(id)
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    saleId TEXT NOT NULL,
    clientId TEXT NOT NULL,
    invoiceNumber TEXT NOT NULL UNIQUE,
    lineItems TEXT DEFAULT '[]',
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    gstAmount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    paid REAL DEFAULT 0,
    balance REAL DEFAULT 0,
    status TEXT DEFAULT 'unpaid',
    dueDate TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(saleId) REFERENCES sales(id),
    FOREIGN KEY(clientId) REFERENCES clients(id)
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoiceId TEXT NOT NULL,
    mode TEXT NOT NULL,
    amount REAL NOT NULL,
    reference TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    FOREIGN KEY(invoiceId) REFERENCES invoices(id)
  )`,
  `CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL,
    planName TEXT NOT NULL,
    price REAL DEFAULT 0,
    planCredits INTEGER DEFAULT 0,
    creditsRemaining INTEGER DEFAULT 0,
    serviceCredits TEXT DEFAULT '[]',
    validityDate TEXT DEFAULT '',
    autoRenew INTEGER DEFAULT 0,
    loyaltyMultiplier REAL DEFAULT 1,
    status TEXT DEFAULT 'active',
    redeemHistory TEXT DEFAULT '[]',
    branchId TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(clientId) REFERENCES clients(id)
  )`,
  `CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    segmentRule TEXT DEFAULT '{}',
    template TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    scheduledAt TEXT DEFAULT '',
    sentCount INTEGER DEFAULT 0,
    conversionValue REAL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    clientId TEXT DEFAULT '',
    type TEXT DEFAULT '',
    channel TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'queued',
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT DEFAULT '{}',
    scope TEXT DEFAULT 'global',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS gift_cards (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    clientId TEXT DEFAULT '',
    initialValue REAL DEFAULT 0,
    balance REAL DEFAULT 0,
    expiryDate TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    redeemHistory TEXT DEFAULT '[]',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`
];

schema.forEach((statement) => db.prepare(statement).run());

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const isJsonColumn = (table, key) => (jsonColumns[table] || []).includes(key);
export const tenantScopedTables = [
  "branches",
  "clients",
  "staff",
  "services",
  "products",
  "appointments",
  "inventory_transactions",
  "sales",
  "invoices",
  "payments",
  "memberships",
  "campaigns",
  "notifications",
  "settings",
  "gift_cards",
  "subscriptions",
  "tenant_users",
  "domain_mappings",
  "usage_events",
  "auth_refresh_tokens",
  "mobile_devices",
  "push_subscriptions",
  "push_notifications",
  "realtime_events",
  "realtime_queue_items",
  "staff_presence",
  "staff_attendance",
  "staff_shifts",
  "staff_commission_runs",
  "payroll_exports",
  "suppliers",
  "inventory_batches",
  "inventory_predictions",
  "inventory_waste_events",
  "ai_marketing_generations",
  "marketing_workflows",
  "marketing_sequences",
  "email_templates",
  "booking_recommendations",
  "booking_waitlist",
  "online_booking_requests",
  "qr_checkins",
  "security_audit_logs",
  "security_activity_events",
  "security_sessions",
  "security_backups",
  "security_permissions",
  "role_definitions",
  "encrypted_secrets",
  "quality_runs",
  "deployment_events",
  "offline_sync_items",
  "offline_cache_snapshots",
  "white_label_profiles",
  "branch_branding",
  "innovation_runs",
  "voice_booking_sessions",
  "kiosk_sessions",
  "workflow_definitions",
  "workflow_runs",
  "finance_cash_drawers",
  "finance_expenses",
  "finance_daily_closings",
  "finance_refunds",
  "finance_staff_payouts",
  "coupon_codes",
  "wallet_transactions",
  "credit_notes",
  "invoice_documents",
  "customer_intelligence_snapshots",
  "customer_timeline_events",
  "booking_portal_events",
  "analytics_snapshots",
  "ai_interactions",
  "whatsapp_threads",
  "whatsapp_messages",
  "whatsapp_automation_rules",
  "whatsapp_handoffs"
];
export const columnsFor = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
export const tableHasColumn = (table, column) => columnsFor(table).includes(column);

function ensureColumn(table, column, definition) {
  if (!tableHasColumn(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function migrateTenantColumns() {
  for (const table of tenantScopedTables) {
    ensureColumn(table, "tenantId", `TEXT DEFAULT '${DEFAULT_TENANT_ID}'`);
    db.prepare(`UPDATE ${table} SET tenantId = ? WHERE tenantId IS NULL OR tenantId = ''`).run(DEFAULT_TENANT_ID);
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenantId)`).run();
  }
}

migrateTenantColumns();

function migrateTenantSettingsKey() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get();
  if (!row?.sql?.includes("key TEXT NOT NULL UNIQUE")) return;
  db.prepare("DROP TABLE IF EXISTS settings_next").run();
  db.prepare(`CREATE TABLE settings_next (
    id TEXT PRIMARY KEY,
    tenantId TEXT DEFAULT '${DEFAULT_TENANT_ID}',
    key TEXT NOT NULL,
    value TEXT DEFAULT '{}',
    scope TEXT DEFAULT 'global',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`).run();
  db.prepare(`INSERT INTO settings_next (id, tenantId, key, value, scope, createdAt, updatedAt)
    SELECT id, COALESCE(NULLIF(tenantId, ''), '${DEFAULT_TENANT_ID}'), key, value, scope, createdAt, updatedAt FROM settings`).run();
  db.prepare("DROP TABLE settings").run();
  db.prepare("ALTER TABLE settings_next RENAME TO settings").run();
}

migrateTenantSettingsKey();
db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_tenant_key ON settings(tenantId, key)").run();

function migrateOperationalColumns() {
  ensureColumn("inventory_transactions", "batchId", "TEXT DEFAULT ''");
  ensureColumn("inventory_transactions", "supplierId", "TEXT DEFAULT ''");
  ensureColumn("inventory_transactions", "unitCost", "REAL DEFAULT 0");
  ensureColumn("inventory_transactions", "totalCost", "REAL DEFAULT 0");
  ensureColumn("sales", "couponCode", "TEXT DEFAULT ''");
  ensureColumn("sales", "couponDiscount", "REAL DEFAULT 0");
  ensureColumn("invoices", "couponCode", "TEXT DEFAULT ''");
  ensureColumn("invoices", "couponDiscount", "REAL DEFAULT 0");
  db.prepare("CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON staff_attendance(tenantId, staffId, date)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_staff_shifts_branch_date ON staff_shifts(tenantId, branchId, date)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_inventory_batches_product ON inventory_batches(tenantId, productId, branchId)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product ON inventory_transactions(tenantId, productId, branchId)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_auth_refresh_user ON auth_refresh_tokens(tenantId, userId, expiresAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_mobile_devices_user ON mobile_devices(tenantId, userId, status)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_push_notifications_user ON push_notifications(tenantId, userId, status)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_realtime_events_channel ON realtime_events(tenantId, channel, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_realtime_queue_branch ON realtime_queue_items(tenantId, branchId, status, priority)").run();
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_presence_user ON staff_presence(tenantId, userId)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_feature_toggles_scope ON feature_toggles(scope, tenantId, planId)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_marketing_generations_type ON ai_marketing_generations(tenantId, type, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_marketing_workflows_trigger ON marketing_workflows(tenantId, trigger, status)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_marketing_sequences_channel ON marketing_sequences(tenantId, channel, status)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_booking_recommendations_client ON booking_recommendations(tenantId, branchId, clientId, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_booking_waitlist_status ON booking_waitlist(tenantId, branchId, status, preferredDate)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_online_booking_status ON online_booking_requests(tenantId, branchId, status, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_qr_checkins_appointment ON qr_checkins(tenantId, branchId, appointmentId, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_logs(tenantId, action, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_activity_path ON security_activity_events(tenantId, path, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_sessions_user ON security_sessions(tenantId, userId, status)").run();
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_security_permissions_role_resource ON security_permissions(tenantId, role, resource)").run();
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_role_definitions_role ON role_definitions(tenantId, role)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_quality_runs_type ON quality_runs(tenantId, type, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_deployment_events_type ON deployment_events(tenantId, type, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_offline_sync_status ON offline_sync_items(tenantId, deviceId, status, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_white_label_domain ON white_label_profiles(tenantId, domain, status)").run();
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_branch_branding_branch ON branch_branding(tenantId, branchId)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_innovation_runs_type ON innovation_runs(tenantId, type, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_workflow_definitions_status ON workflow_definitions(tenantId, status, branchId)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(tenantId, workflowId, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_finance_drawers_branch ON finance_cash_drawers(tenantId, branchId, status)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_finance_expenses_date ON finance_expenses(tenantId, branchId, paidAt)").run();
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_closing_day ON finance_daily_closings(tenantId, branchId, businessDate)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_finance_refunds_invoice ON finance_refunds(tenantId, invoiceId, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_finance_payout_staff ON finance_staff_payouts(tenantId, staffId, periodStart, periodEnd)").run();
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_codes_code ON coupon_codes(tenantId, code)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_wallet_transactions_client ON wallet_transactions(tenantId, clientId, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(tenantId, invoiceId, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_invoice_documents_invoice ON invoice_documents(tenantId, invoiceId, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_customer_intelligence_client ON customer_intelligence_snapshots(tenantId, clientId, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_customer_timeline_client ON customer_timeline_events(tenantId, clientId, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_booking_portal_events_appointment ON booking_portal_events(tenantId, appointmentId, createdAt)").run();
}

migrateOperationalColumns();

export function serialize(table, data) {
  const output = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    output[key] = isJsonColumn(table, key) ? JSON.stringify(value ?? null) : value;
  }
  return output;
}

export function deserialize(table, row) {
  if (!row) return row;
  const output = { ...row };
  for (const key of jsonColumns[table] || []) {
    try {
      output[key] = output[key] ? JSON.parse(output[key]) : null;
    } catch {
      output[key] = null;
    }
  }
  return output;
}

export function listRows(table, { q = "", branchId = "", tenantId = "", limit = 250 } = {}) {
  const columns = columnsFor(table);
  const where = [];
  const params = {};
  if (q) {
    where.push(`(${columns.map((column) => `${column} LIKE @q`).join(" OR ")})`);
    params.q = `%${q}%`;
  }
  if (branchId && columns.includes("branchId")) {
    where.push("branchId = @branchId");
    params.branchId = branchId;
  }
  if (tenantId && columns.includes("tenantId")) {
    where.push("tenantId = @tenantId");
    params.tenantId = tenantId;
  }
  params.limit = Number(limit) || 250;
  const sql = `SELECT * FROM ${table}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY createdAt DESC LIMIT @limit`;
  return db.prepare(sql).all(params).map((row) => deserialize(table, row));
}

export function getRow(table, rowId, { tenantId = "" } = {}) {
  const columns = columnsFor(table);
  if (tenantId && columns.includes("tenantId")) {
    return deserialize(table, db.prepare(`SELECT * FROM ${table} WHERE id = ? AND tenantId = ?`).get(rowId, tenantId));
  }
  return deserialize(table, db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(rowId));
}

export function insertRow(table, data) {
  const columns = columnsFor(table);
  const base = {
    id: data.id || id(table.slice(0, 4)),
    ...data
  };
  if (columns.includes("tenantId")) base.tenantId = data.tenantId || DEFAULT_TENANT_ID;
  if (columns.includes("createdAt")) base.createdAt = data.createdAt || now();
  if (columns.includes("updatedAt")) base.updatedAt = data.updatedAt || now();
  const stamped = Object.fromEntries(
    Object.entries(serialize(table, base)).filter(([key]) => columns.includes(key))
  );
  const keys = Object.keys(stamped);
  const placeholders = keys.map((key) => `@${key}`).join(", ");
  db.prepare(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`).run(stamped);
  return getRow(table, stamped.id);
}

export function updateRow(table, rowId, data, { tenantId = "" } = {}) {
  const columns = columnsFor(table);
  const base = { ...data };
  if (columns.includes("updatedAt")) base.updatedAt = now();
  const stamped = Object.fromEntries(
    Object.entries(serialize(table, base)).filter(([key]) => columns.includes(key))
  );
  const keys = Object.keys(stamped).filter((key) => key !== "id" && key !== "createdAt");
  if (!keys.length) return getRow(table, rowId);
  const setSql = keys.map((key) => `${key} = @${key}`).join(", ");
  const tenantSql = tenantId && columns.includes("tenantId") ? " AND tenantId = @tenantId" : "";
  db.prepare(`UPDATE ${table} SET ${setSql} WHERE id = @id${tenantSql}`).run({ ...stamped, id: rowId, tenantId });
  return getRow(table, rowId, { tenantId });
}

export function deleteRow(table, rowId, { tenantId = "" } = {}) {
  const existing = getRow(table, rowId, { tenantId });
  if (!existing) return false;
  const columns = columnsFor(table);
  if (tenantId && columns.includes("tenantId")) {
    db.prepare(`DELETE FROM ${table} WHERE id = ? AND tenantId = ?`).run(rowId, tenantId);
  } else {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(rowId);
  }
  return true;
}

function seedIfEmpty(table, rows) {
  const count = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  if (count > 0) return;
  rows.forEach((row) => insertRow(table, row));
}

function seedIfMissing(table, idValue, row) {
  const existing = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(idValue);
  if (existing) return;
  if (table === "security_permissions") {
    const permission = db.prepare("SELECT id FROM security_permissions WHERE tenantId = ? AND role = ? AND resource = ?").get(row.tenantId || DEFAULT_TENANT_ID, row.role, row.resource);
    if (permission) return;
  }
  if (table === "role_definitions") {
    const definition = db.prepare("SELECT id FROM role_definitions WHERE tenantId = ? AND role = ?").get(row.tenantId || DEFAULT_TENANT_ID, row.role);
    if (definition) return;
  }
  try {
    insertRow(table, row);
  } catch (error) {
    if (!String(error?.code || "").includes("SQLITE_CONSTRAINT")) throw error;
  }
}

export function applyInventoryDelta({
  productId,
  branchId,
  batchId = "",
  supplierId = "",
  quantity,
  type,
  reason,
  referenceType,
  referenceId,
  unitCost = 0,
  totalCost = 0,
  tenantId = ""
}) {
  const product = getRow("products", productId, { tenantId });
  if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
  const nextStock = Number(product.stock) + Number(quantity);
  if (nextStock < 0) throw Object.assign(new Error(`${product.name} stock cannot go below zero`), { status: 409 });
  let resolvedBatchId = batchId;
  let resolvedSupplierId = supplierId;
  let resolvedUnitCost = Number(unitCost || 0);
  let resolvedTotalCost = Number(totalCost || 0);
  if (Number(quantity) < 0 && !resolvedBatchId) {
    const batch = db.prepare(`
      SELECT * FROM inventory_batches
      WHERE tenantId = ? AND productId = ? AND branchId = ? AND quantityAvailable > 0
      ORDER BY CASE WHEN expiryDate = '' THEN 1 ELSE 0 END, expiryDate ASC, createdAt ASC
      LIMIT 1
    `).get(tenantId || product.tenantId || DEFAULT_TENANT_ID, productId, branchId || product.branchId);
    if (batch) {
      resolvedBatchId = batch.id;
      resolvedSupplierId = resolvedSupplierId || batch.supplierId || "";
      resolvedUnitCost = resolvedUnitCost || Number(batch.unitCost || 0);
      resolvedTotalCost = resolvedTotalCost || Math.abs(Number(quantity)) * resolvedUnitCost;
      const available = Number(batch.quantityAvailable || 0);
      const nextAvailable = Math.max(0, available - Math.abs(Number(quantity)));
      db.prepare("UPDATE inventory_batches SET quantityAvailable = ?, status = ?, updatedAt = ? WHERE id = ? AND tenantId = ?").run(
        nextAvailable,
        nextAvailable <= 0 ? "depleted" : batch.status || "active",
        now(),
        batch.id,
        tenantId || product.tenantId || DEFAULT_TENANT_ID
      );
    }
  }
  updateRow("products", productId, { stock: nextStock }, { tenantId: tenantId || product.tenantId });
  return insertRow("inventory_transactions", {
    productId,
    branchId: branchId || product.branchId,
    batchId: resolvedBatchId,
    supplierId: resolvedSupplierId,
    type,
    quantity,
    unitCost: resolvedUnitCost,
    totalCost: resolvedTotalCost || Number(quantity) * resolvedUnitCost,
    reason,
    referenceType,
    referenceId,
    tenantId: tenantId || product.tenantId,
    createdAt: now()
  });
}

export function deductServiceUsage(serviceIds, branchId, referenceType, referenceId, tenantId = "") {
  const deductions = [];
  for (const serviceId of serviceIds || []) {
    const service = getRow("services", serviceId, { tenantId });
    for (const usage of service?.requiredProducts || []) {
      deductions.push(
        applyInventoryDelta({
          productId: usage.productId,
          branchId,
          quantity: -Math.abs(Number(usage.quantity || 0)),
          type: "service-deduction",
          reason: `${service.name} professional usage`,
          referenceType,
          referenceId,
          tenantId
        })
      );
    }
  }
  return deductions;
}

export function updateInvoiceStatus(invoiceId, tenantId = "") {
  const invoice = getRow("invoices", invoiceId, { tenantId });
  if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });
  const paid = tenantId
    ? db.prepare("SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoiceId = ? AND tenantId = ?").get(invoiceId, tenantId).paid
    : db.prepare("SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoiceId = ?").get(invoiceId).paid;
  const balance = Math.max(0, Number(invoice.total) - Number(paid));
  const status = balance <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
  return updateRow("invoices", invoiceId, { paid, balance, status }, { tenantId });
}

export function seedDatabase() {
  const stamp = now();
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  seedIfEmpty("subscription_plans", [
    {
      id: "plan_starter",
      name: "Starter",
      code: "starter",
      priceMonthly: 2999,
      trialDays: 14,
      limits: { branches: 1, staff: 8, clients: 1000, monthlyAppointments: 1500, campaigns: 10 },
      features: ["Client CRM", "POS", "GST billing", "WhatsApp reminders"],
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "plan_growth",
      name: "Growth",
      code: "growth",
      priceMonthly: 7999,
      trialDays: 14,
      limits: { branches: 5, staff: 40, clients: 10000, monthlyAppointments: 15000, campaigns: 100 },
      features: ["Multi-branch", "Advanced reports", "Memberships", "Marketing automation"],
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "plan_enterprise",
      name: "Enterprise",
      code: "enterprise",
      priceMonthly: 24999,
      trialDays: 30,
      limits: { branches: 50, staff: 500, clients: 250000, monthlyAppointments: 500000, campaigns: 1000 },
      features: ["Custom domains", "Branch RBAC", "Enterprise reports", "Priority support"],
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("feature_toggles", [
    {
      id: "ft_ai_marketing",
      key: "ai.marketing",
      name: "AI marketing automation",
      description: "Enable AI campaign generation, offer recommendations and retargeting workflows.",
      scope: "global",
      enabled: 1,
      rules: { plans: ["growth", "enterprise"], rollout: 100 },
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "ft_super_analytics",
      key: "platform.analytics",
      name: "Global SaaS analytics",
      description: "Expose platform revenue, tenant health and cross-salon analytics.",
      scope: "global",
      enabled: 1,
      rules: { roles: ["superAdmin"] },
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "ft_realtime",
      key: "realtime.operations",
      name: "Realtime operations",
      description: "Live booking, queue, staff presence and dashboard events.",
      scope: "global",
      enabled: 1,
      rules: { plans: ["starter", "growth", "enterprise"] },
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "ft_smart_booking",
      key: "smart.booking",
      name: "Smart booking engine",
      description: "Enable intelligent slot recommendations, waitlists, online booking and QR check-in.",
      scope: "global",
      enabled: 1,
      rules: { plans: ["growth", "enterprise"], rollout: 100 },
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "ft_white_label",
      key: "white.label",
      name: "White-label SaaS",
      description: "Enable custom branding, themes, custom domains and branch-specific identity.",
      scope: "global",
      enabled: 1,
      rules: { plans: ["enterprise"], rollout: 100 },
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("tenants", [
    {
      id: DEFAULT_TENANT_ID,
      name: "Aura Salon Group",
      slug: "aura",
      status: "trialing",
      planId: "plan_growth",
      subscriptionStatus: "trialing",
      trialEndsAt,
      ownerEmail: "owner@aurasalon.example",
      primaryDomain: "aura.localhost",
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("security_permissions", [
    {
      id: "perm_owner_all",
      tenantId: DEFAULT_TENANT_ID,
      role: "owner",
      resource: "*",
      actions: ["read", "write", "admin"],
      effect: "allow",
      conditions: { branchScoped: false },
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "perm_frontdesk_booking",
      tenantId: DEFAULT_TENANT_ID,
      role: "frontDesk",
      resource: "smart-booking",
      actions: ["read", "write"],
      effect: "allow",
      conditions: { branchScoped: true },
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "perm_analyst_security_read",
      tenantId: DEFAULT_TENANT_ID,
      role: "analyst",
      resource: "security",
      actions: ["read"],
      effect: "allow",
      conditions: { branchScoped: false },
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  const defaultRoleDefinitions = [
    {
      role: "owner",
      name: "Owner",
      description: "Full salon and SaaS tenant control.",
      permissions: [{ resource: "*", actions: ["read", "write", "admin"] }],
      isSystem: 1
    },
    {
      role: "manager",
      name: "Manager",
      description: "Operational manager for bookings, clients, staff, reports and approvals.",
      permissions: [
        { resource: "*", actions: ["read"] },
        { resource: "appointments", actions: ["write"] },
        { resource: "clients", actions: ["write"] },
        { resource: "sales", actions: ["write"] },
        { resource: "payments", actions: ["write"] },
        { resource: "staff", actions: ["write"] },
        { resource: "reports", actions: ["read"] },
        { resource: "security", actions: ["read"] }
      ],
      isSystem: 1
    },
    {
      role: "receptionist",
      name: "Receptionist",
      description: "Front desk access for quick booking, walk-ins, client lookup and POS payments.",
      permissions: [
        { resource: "*", actions: ["read"] },
        { resource: "appointments", actions: ["write"] },
        { resource: "clients", actions: ["write"] },
        { resource: "sales", actions: ["write"] },
        { resource: "payments", actions: ["write"] },
        { resource: "smart-booking", actions: ["write"] },
        { resource: "booking-portal", actions: ["write"] }
      ],
      isSystem: 1
    },
    {
      role: "frontDesk",
      name: "Front desk",
      description: "Legacy alias for receptionist.",
      permissions: [
        { resource: "*", actions: ["read"] },
        { resource: "appointments", actions: ["write"] },
        { resource: "clients", actions: ["write"] },
        { resource: "sales", actions: ["write"] },
        { resource: "payments", actions: ["write"] }
      ],
      isSystem: 1
    },
    {
      role: "staff",
      name: "Staff",
      description: "Personal appointment, service and customer context access.",
      permissions: [
        { resource: "appointments", actions: ["read", "write"] },
        { resource: "clients", actions: ["read"] },
        { resource: "services", actions: ["read"] },
        { resource: "customer-360", actions: ["read"] }
      ],
      isSystem: 1
    },
    {
      role: "accountant",
      name: "Accountant",
      description: "Finance, invoices, payments, refunds, GST, closing and payout access.",
      permissions: [
        { resource: "*", actions: ["read"] },
        { resource: "finance", actions: ["write"] },
        { resource: "invoices", actions: ["write"] },
        { resource: "payments", actions: ["write"] },
        { resource: "reports", actions: ["read"] },
        { resource: "security", actions: ["read"] }
      ],
      isSystem: 1
    },
    {
      role: "inventoryManager",
      name: "Inventory manager",
      description: "Product, supplier, batch, purchase, stock transfer and waste access.",
      permissions: [
        { resource: "*", actions: ["read"] },
        { resource: "products", actions: ["write"] },
        { resource: "inventory", actions: ["write"] },
        { resource: "inventory-intelligence", actions: ["write"] },
        { resource: "branches", actions: ["write"] }
      ],
      isSystem: 1
    },
    {
      role: "customMarketingLead",
      name: "Custom marketing lead",
      description: "Demo custom role managed through the permission matrix.",
      permissions: [
        { resource: "clients", actions: ["read"] },
        { resource: "marketing", actions: ["read", "write"] },
        { resource: "whatsapp", actions: ["read", "write"] },
        { resource: "ai-marketing", actions: ["read", "write"] }
      ],
      isSystem: 0
    }
  ];
  defaultRoleDefinitions.forEach((definition) => {
    seedIfMissing("role_definitions", `role_${definition.role}`, {
      id: `role_${definition.role}`,
      tenantId: DEFAULT_TENANT_ID,
      role: definition.role,
      name: definition.name,
      description: definition.description,
      permissions: definition.permissions,
      isSystem: definition.isSystem,
      status: "active",
      createdBy: "seed",
      createdAt: stamp,
      updatedAt: stamp
    });
    definition.permissions.forEach((permission) => {
      const resourceKey = permission.resource.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "all";
      seedIfMissing("security_permissions", `perm_${definition.role}_${resourceKey}`, {
        id: `perm_${definition.role}_${resourceKey}`,
        tenantId: DEFAULT_TENANT_ID,
        role: definition.role,
        resource: permission.resource,
        actions: permission.actions,
        effect: "allow",
        conditions: { branchScoped: !["owner", "manager", "accountant"].includes(definition.role) },
        createdAt: stamp,
        updatedAt: stamp
      });
    });
  });
  seedIfEmpty("white_label_profiles", [
    {
      id: "brand_aura_default",
      tenantId: DEFAULT_TENANT_ID,
      name: "Aura default brand",
      brandName: "Aura Salon",
      logoUrl: "/assets/aura-logo.svg",
      domain: "aura.localhost",
      theme: {
        primary: "#0f766e",
        accent: "#2f5fbd",
        surface: "#ffffff",
        ink: "#17202d"
      },
      assets: { invoiceLogo: "/assets/aura-logo.svg", bookingHero: "" },
      settings: { portalTitle: "Book your Aura appointment", invoiceFooter: "Thank you for visiting Aura Salon." },
      isDefault: 1,
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("workflow_definitions", [
    {
      id: "wf_inactive_30_offer",
      tenantId: DEFAULT_TENANT_ID,
      name: "Inactive 30-day WhatsApp win-back",
      description: "If a client is inactive for 30 days, send a comeback offer on WhatsApp.",
      trigger: { type: "client-inactive", schedule: "daily" },
      conditions: { inactiveDays: 30, minSpend: 0 },
      actions: [
        {
          channel: "WhatsApp",
          template: "Hi {{name}}, we miss you at Aura. Book this week and get a personalized glow offer."
        }
      ],
      delayMinutes: 0,
      status: "active",
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("subscriptions", [
    {
      id: "sub_aura_trial",
      tenantId: DEFAULT_TENANT_ID,
      planId: "plan_growth",
      status: "trialing",
      trialStart: stamp,
      trialEndsAt,
      currentPeriodStart: stamp,
      currentPeriodEnd: trialEndsAt,
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("tenant_users", [
    {
      id: "tu_aura_owner",
      tenantId: DEFAULT_TENANT_ID,
      name: "Aura Owner",
      email: "owner@aurasalon.example",
      role: "owner",
      branchIds: ["branch_hyd", "branch_blr"],
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "system-user",
      tenantId: DEFAULT_TENANT_ID,
      name: "System Demo User",
      email: "system@aurasalon.example",
      role: "owner",
      branchIds: ["branch_hyd", "branch_blr"],
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("domain_mappings", [
    {
      id: "domain_aura_localhost",
      tenantId: DEFAULT_TENANT_ID,
      domain: "aura.localhost",
      status: "verified",
      isPrimary: 1,
      verifiedAt: stamp,
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("mobile_devices", [
    {
      id: "dev_owner_demo",
      tenantId: DEFAULT_TENANT_ID,
      userId: "tu_aura_owner",
      branchId: "branch_hyd",
      platform: "ios",
      deviceToken: "demo-mobile-device-token",
      pushProvider: "fcm",
      appVersion: "1.0.0",
      capabilities: { push: true, realtime: true, biometric: true },
      status: "active",
      lastSeenAt: stamp,
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("branches", [
    {
      id: "branch_hyd",
      name: "Aura Salon Jubilee Hills",
      city: "Hyderabad",
      address: "Road 36, Jubilee Hills",
      phone: "+91 90000 10101",
      gstin: "36AURAS1234F1Z5",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "branch_blr",
      name: "Aura Salon Indiranagar",
      city: "Bengaluru",
      address: "12th Main, Indiranagar",
      phone: "+91 90000 20202",
      gstin: "29AURAS1234F1Z6",
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("branch_branding", [
    {
      id: "brand_branch_hyd",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "branch_hyd",
      profileId: "brand_aura_default",
      brandName: "Aura Salon Jubilee Hills",
      logoUrl: "/assets/aura-logo.svg",
      theme: { primary: "#0f766e", accent: "#2f5fbd", bookingButton: "#0f766e" },
      assets: { qrPoster: "branch_hyd_qr" },
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "brand_branch_blr",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "branch_blr",
      profileId: "brand_aura_default",
      brandName: "Aura Salon Indiranagar",
      logoUrl: "/assets/aura-logo.svg",
      theme: { primary: "#2f5fbd", accent: "#0f766e", bookingButton: "#2f5fbd" },
      assets: { qrPoster: "branch_blr_qr" },
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("staff", [
    {
      id: "staff_aya",
      name: "Ayesha Khan",
      role: "Senior Stylist",
      phone: "+91 98888 12001",
      email: "ayesha@aurasalon.example",
      branchId: "branch_hyd",
      shift: "10:00-19:00",
      assignedServices: ["svc_haircut", "svc_color"],
      commissionRule: { servicePercent: 12, retailPercent: 6 },
      attendance: [{ date: "2026-05-10", status: "present" }],
      performance: { revenue: 18600, bookings: 8, rating: 4.8 },
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "staff_neha",
      name: "Neha Rao",
      role: "Skin Therapist",
      phone: "+91 98888 12002",
      email: "neha@aurasalon.example",
      branchId: "branch_hyd",
      shift: "11:00-20:00",
      assignedServices: ["svc_facial", "svc_cleanup"],
      commissionRule: { servicePercent: 10, retailPercent: 5 },
      attendance: [{ date: "2026-05-10", status: "present" }],
      performance: { revenue: 14200, bookings: 6, rating: 4.7 },
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "staff_karan",
      name: "Karan Mehta",
      role: "Front Desk",
      phone: "+91 98888 12003",
      email: "karan@aurasalon.example",
      branchId: "branch_blr",
      shift: "09:30-18:30",
      assignedServices: [],
      commissionRule: { servicePercent: 0, retailPercent: 2 },
      attendance: [{ date: "2026-05-10", status: "present" }],
      performance: { revenue: 7400, bookings: 11, rating: 4.6 },
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("staff_attendance", [
    {
      id: "att_aya_20260510",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "branch_hyd",
      staffId: "staff_aya",
      date: "2026-05-10",
      status: "present",
      clockIn: "09:52",
      clockOut: "19:12",
      minutesWorked: 560,
      overtimeMinutes: 20,
      notes: "Handled color bar bookings",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "att_neha_20260510",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "branch_hyd",
      staffId: "staff_neha",
      date: "2026-05-10",
      status: "present",
      clockIn: "10:55",
      clockOut: "20:05",
      minutesWorked: 550,
      overtimeMinutes: 10,
      notes: "Skin therapy shift",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "att_karan_20260510",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "branch_blr",
      staffId: "staff_karan",
      date: "2026-05-10",
      status: "present",
      clockIn: "09:20",
      clockOut: "18:40",
      minutesWorked: 560,
      overtimeMinutes: 20,
      notes: "Front desk and walk-ins",
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("staff_shifts", [
    {
      id: "shift_aya_20260511",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "branch_hyd",
      staffId: "staff_aya",
      date: "2026-05-11",
      startTime: "10:00",
      endTime: "19:00",
      role: "Senior Stylist",
      chair: "Chair 2",
      serviceIds: ["svc_haircut", "svc_color"],
      status: "planned",
      notes: "Color bookings preferred",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "shift_neha_20260511",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "branch_hyd",
      staffId: "staff_neha",
      date: "2026-05-11",
      startTime: "11:00",
      endTime: "20:00",
      role: "Skin Therapist",
      chair: "Room 1",
      serviceIds: ["svc_facial", "svc_cleanup"],
      status: "planned",
      notes: "Facial room coverage",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "shift_karan_20260511",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "branch_blr",
      staffId: "staff_karan",
      date: "2026-05-11",
      startTime: "09:30",
      endTime: "18:30",
      role: "Front Desk",
      chair: "Reception",
      serviceIds: [],
      status: "planned",
      notes: "Walk-in desk",
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("clients", [
    {
      id: "client_riya",
      name: "Riya Sharma",
      phone: "+91 98765 43120",
      email: "riya@example.com",
      gender: "Female",
      birthday: "1994-08-18",
      anniversary: "2020-12-02",
      tags: ["VIP", "high spender"],
      notes: "Prefers Ayesha. Sends WhatsApp confirmations.",
      walletBalance: 1200,
      loyaltyPoints: 460,
      branchId: "branch_hyd",
      totalSpend: 48600,
      visitCount: 11,
      lastVisitAt: "2026-05-09T15:30:00.000Z",
      visitHistory: [{ date: "2026-05-09", services: ["Hair Color"], staff: "Ayesha Khan" }],
      purchaseHistory: [{ date: "2026-05-09", invoice: "INV-1001", amount: 6200 }],
      whatsappHistory: [{ date: "2026-05-08", message: "Appointment reminder sent", status: "delivered" }],
      consentForms: [{ name: "Hair color patch test", signedAt: "2026-04-20" }],
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "client_dev",
      name: "Dev Patel",
      phone: "+91 98111 88720",
      email: "dev@example.com",
      gender: "Male",
      birthday: "1990-01-11",
      tags: ["new"],
      notes: "Walk-in converted to online booking account.",
      walletBalance: 0,
      loyaltyPoints: 70,
      branchId: "branch_blr",
      totalSpend: 7400,
      visitCount: 2,
      lastVisitAt: "2026-05-05T12:00:00.000Z",
      visitHistory: [{ date: "2026-05-05", services: ["Haircut"], staff: "Karan Mehta" }],
      purchaseHistory: [],
      whatsappHistory: [{ date: "2026-05-04", message: "Welcome offer", status: "read" }],
      consentForms: [],
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "client_meera",
      name: "Meera Iyer",
      phone: "+91 99880 11223",
      email: "meera@example.com",
      gender: "Female",
      birthday: "1988-03-25",
      tags: ["inactive", "membership"],
      notes: "Win-back facial offer scheduled.",
      walletBalance: 500,
      loyaltyPoints: 210,
      branchId: "branch_hyd",
      totalSpend: 21600,
      visitCount: 6,
      lastVisitAt: "2026-03-14T10:30:00.000Z",
      visitHistory: [{ date: "2026-03-14", services: ["Hydra Facial"], staff: "Neha Rao" }],
      purchaseHistory: [{ date: "2026-03-14", invoice: "INV-0992", amount: 4500 }],
      whatsappHistory: [{ date: "2026-05-01", message: "We miss you offer", status: "delivered" }],
      consentForms: [{ name: "Facial consent", signedAt: "2026-03-14" }],
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("products", [
    {
      id: "prod_shampoo",
      name: "Keratin Shampoo 250ml",
      sku: "RET-KER-250",
      category: "Retail Haircare",
      usageType: "retail",
      supplier: "GlowSupply",
      branchId: "branch_hyd",
      stock: 18,
      lowStockThreshold: 6,
      expiryDate: "2027-01-31",
      unitCost: 420,
      price: 899,
      gstRate: 18,
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "prod_color",
      name: "Professional Color Tube",
      sku: "PRO-COL-001",
      category: "Professional Hair",
      usageType: "internal",
      supplier: "SalonPro",
      branchId: "branch_hyd",
      stock: 9,
      lowStockThreshold: 10,
      expiryDate: "2026-09-15",
      unitCost: 310,
      price: 0,
      gstRate: 18,
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "prod_serum",
      name: "Argan Serum 100ml",
      sku: "RET-ARG-100",
      category: "Retail Haircare",
      usageType: "retail",
      supplier: "GlowSupply",
      branchId: "branch_blr",
      stock: 4,
      lowStockThreshold: 5,
      expiryDate: "2026-07-20",
      unitCost: 520,
      price: 1199,
      gstRate: 18,
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "prod_mask",
      name: "Facial Mask Sachet",
      sku: "PRO-FAC-MASK",
      category: "Professional Skin",
      usageType: "internal",
      supplier: "Dermacare",
      branchId: "branch_hyd",
      stock: 42,
      lowStockThreshold: 12,
      expiryDate: "2026-08-30",
      unitCost: 90,
      price: 0,
      gstRate: 18,
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("suppliers", [
    {
      id: "sup_glowsupply",
      tenantId: DEFAULT_TENANT_ID,
      name: "GlowSupply",
      contactName: "Priya Nair",
      phone: "+91 90000 30001",
      email: "orders@glowsupply.example",
      gstin: "36GLOWP1234A1Z1",
      address: "Hyderabad distribution hub",
      status: "active",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "sup_salonpro",
      tenantId: DEFAULT_TENANT_ID,
      name: "SalonPro",
      contactName: "Rohan Shah",
      phone: "+91 90000 30002",
      email: "supply@salonpro.example",
      gstin: "29SALON1234B1Z2",
      address: "Bengaluru professional supplies",
      status: "active",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "sup_dermacare",
      tenantId: DEFAULT_TENANT_ID,
      name: "Dermacare",
      contactName: "Isha Menon",
      phone: "+91 90000 30003",
      email: "care@dermacare.example",
      gstin: "36DERMA1234C1Z3",
      address: "Hyderabad skincare warehouse",
      status: "active",
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("inventory_batches", [
    {
      id: "batch_shampoo_001",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "branch_hyd",
      productId: "prod_shampoo",
      supplierId: "sup_glowsupply",
      batchNumber: "GS-KER-2026-01",
      expiryDate: "2027-01-31",
      quantityReceived: 24,
      quantityAvailable: 18,
      unitCost: 420,
      status: "active",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "batch_color_001",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "branch_hyd",
      productId: "prod_color",
      supplierId: "sup_salonpro",
      batchNumber: "SP-COL-2026-04",
      expiryDate: "2026-09-15",
      quantityReceived: 14,
      quantityAvailable: 9,
      unitCost: 310,
      status: "active",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "batch_serum_001",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "branch_blr",
      productId: "prod_serum",
      supplierId: "sup_glowsupply",
      batchNumber: "GS-ARG-2026-02",
      expiryDate: "2026-07-20",
      quantityReceived: 10,
      quantityAvailable: 4,
      unitCost: 520,
      status: "active",
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("services", [
    {
      id: "svc_haircut",
      name: "Signature Haircut",
      category: "Hair",
      price: 1200,
      durationMinutes: 45,
      assignedStaff: ["staff_aya"],
      requiredProducts: [],
      addOns: ["Hair wash", "Blow dry"],
      packageServices: [],
      gstRate: 18,
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "svc_color",
      name: "Global Hair Color",
      category: "Hair",
      price: 4800,
      durationMinutes: 120,
      assignedStaff: ["staff_aya"],
      requiredProducts: [{ productId: "prod_color", quantity: 1 }],
      addOns: ["Toner", "Hair spa"],
      packageServices: ["svc_haircut"],
      gstRate: 18,
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "svc_facial",
      name: "Hydra Glow Facial",
      category: "Skin",
      price: 3500,
      durationMinutes: 75,
      assignedStaff: ["staff_neha"],
      requiredProducts: [{ productId: "prod_mask", quantity: 1 }],
      addOns: ["LED therapy", "Neck massage"],
      packageServices: [],
      gstRate: 18,
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "svc_cleanup",
      name: "Express Cleanup",
      category: "Skin",
      price: 1600,
      durationMinutes: 40,
      assignedStaff: ["staff_neha"],
      requiredProducts: [{ productId: "prod_mask", quantity: 0.5 }],
      addOns: ["De-tan"],
      packageServices: [],
      gstRate: 18,
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("appointments", [
    {
      id: "appt_riya_today",
      clientId: "client_riya",
      staffId: "staff_aya",
      branchId: "branch_hyd",
      serviceIds: ["svc_color"],
      startAt: "2026-05-10T11:00:00.000Z",
      endAt: "2026-05-10T13:00:00.000Z",
      status: "booked",
      source: "online",
      onlineStatus: "confirmed",
      chair: "Chair 2",
      room: "Color Bar",
      notes: "Patch test done.",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "appt_dev_walkin",
      clientId: "client_dev",
      staffId: "staff_karan",
      branchId: "branch_blr",
      serviceIds: ["svc_haircut"],
      startAt: "2026-05-10T09:30:00.000Z",
      endAt: "2026-05-10T10:15:00.000Z",
      status: "arrived",
      source: "walk-in",
      onlineStatus: "not-online",
      chair: "Chair 1",
      room: "Main Floor",
      notes: "Quick checkout requested.",
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("realtime_queue_items", [
    {
      id: "queue_walkin_demo",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "branch_blr",
      clientId: "client_dev",
      appointmentId: "appt_dev_walkin",
      type: "walk-in",
      title: "Dev Patel walk-in checkout",
      priority: "normal",
      status: "waiting",
      assignedStaffId: "staff_karan",
      payload: { source: "front-desk", service: "Signature Haircut" },
      history: [{ at: stamp, status: "waiting", note: "Seeded live queue item" }],
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("memberships", [
    {
      id: "mem_meera_gold",
      clientId: "client_meera",
      planName: "Gold Glow 6",
      price: 18000,
      planCredits: 6,
      creditsRemaining: 3,
      serviceCredits: [{ serviceId: "svc_facial", credits: 3 }],
      validityDate: "2026-09-30",
      autoRenew: 1,
      loyaltyMultiplier: 1.25,
      status: "active",
      redeemHistory: [{ date: "2026-03-14", serviceId: "svc_facial", credits: 1 }],
      branchId: "branch_hyd",
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  db.prepare("UPDATE clients SET membershipId = ? WHERE id = ?").run("mem_meera_gold", "client_meera");
  seedIfEmpty("campaigns", [
    {
      id: "camp_birthday",
      name: "Birthday Glow Offer",
      channel: "WhatsApp",
      segmentRule: { occasion: "birthday", daysAhead: 7 },
      template: "Happy birthday {{name}}! Enjoy 20% off this week.",
      status: "scheduled",
      scheduledAt: "2026-05-11T09:00:00.000Z",
      sentCount: 0,
      conversionValue: 0,
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "camp_inactive",
      name: "Inactive Client Win-back",
      channel: "SMS",
      segmentRule: { tag: "inactive", minDaysSinceVisit: 45 },
      template: "We miss you at Aura. Book a facial and get a complimentary add-on.",
      status: "draft",
      scheduledAt: "",
      sentCount: 0,
      conversionValue: 0,
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("marketing_workflows", [
    {
      id: "mw_inactive_winback",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "",
      name: "Inactive client win-back",
      trigger: "client.inactive",
      channel: "WhatsApp",
      status: "active",
      triggerRule: { minDaysSinceVisit: 45, excludeTags: ["do-not-disturb"] },
      steps: [
        { day: 0, channel: "WhatsApp", template: "We miss you {{name}}. Come back for a glow refresh with a special add-on." },
        { day: 3, channel: "WhatsApp", template: "Your Aura win-back offer is still open this week." },
        { day: 7, channel: "Email", template: "Last call for your personalised salon offer." }
      ],
      metrics: { enrolled: 0, conversions: 0, revenue: 0 },
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("marketing_sequences", [
    {
      id: "seq_birthday_glow",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "",
      name: "Birthday glow sequence",
      channel: "WhatsApp",
      campaignId: "camp_birthday",
      audienceRule: { occasion: "birthday", daysAhead: 7 },
      steps: [
        { day: -7, body: "Birthday week starts soon, {{name}}. Your Aura glow offer is ready." },
        { day: 0, body: "Happy birthday {{name}}. Enjoy your special salon treat." },
        { day: 3, body: "Your birthday offer is valid this week." }
      ],
      status: "active",
      metrics: { sent: 0, clicked: 0, booked: 0 },
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("email_templates", [
    {
      id: "email_festival_offer",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "",
      name: "Festival glow offer",
      subject: "{{festival}} glow packages at Aura Salon",
      body: "Hi {{name}}, celebrate {{festival}} with curated hair, skin and retail offers from Aura Salon.",
      purpose: "festival-campaign",
      variables: ["name", "festival", "offer", "bookingLink"],
      status: "active",
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("settings", [
    {
      id: "setting_tax",
      key: "tax",
      value: { gstRate: 18, gstinRequired: true, placeOfSupply: "IN" },
      scope: "global",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "setting_payments",
      key: "payments",
      value: { cash: true, upi: true, card: true, wallet: true, splitPayment: true },
      scope: "global",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "setting_invoice",
      key: "invoice",
      value: { prefix: "AURA", printFooter: "Thank you for visiting Aura Salon" },
      scope: "global",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "setting_hours",
      key: "workingHours",
      value: { open: "10:00", close: "21:00", weeklyOff: "Tuesday" },
      scope: "global",
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("gift_cards", [
    {
      id: "gift_mothersday",
      code: "AURA-MOM-5000",
      clientId: "client_riya",
      initialValue: 5000,
      balance: 5000,
      expiryDate: "2026-12-31",
      status: "active",
      redeemHistory: [],
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("coupon_codes", [
    {
      id: "coupon_glow10",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "",
      code: "GLOW10",
      name: "Glow 10 percent offer",
      type: "percentage",
      value: 10,
      maxDiscount: 1000,
      minSubtotal: 1000,
      startsAt: "2026-01-01",
      endsAt: "2026-12-31",
      usageLimit: 1000,
      usedCount: 0,
      rules: { channels: ["front-desk", "online"], firstPurchaseOnly: false },
      status: "active",
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "coupon_WELCOME500",
      tenantId: DEFAULT_TENANT_ID,
      branchId: "",
      code: "WELCOME500",
      name: "Welcome fixed discount",
      type: "fixed",
      value: 500,
      maxDiscount: 500,
      minSubtotal: 2500,
      startsAt: "2026-01-01",
      endsAt: "2026-12-31",
      usageLimit: 500,
      usedCount: 0,
      rules: { tags: ["new"] },
      status: "active",
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
  seedIfEmpty("whatsapp_automation_rules", [
    {
      id: "wa_rule_auto_reply",
      tenantId: DEFAULT_TENANT_ID,
      name: "Auto reply to inbound leads",
      trigger: "inbound.message",
      template: "Hi {{name}}, thanks for messaging Aura Salon. Tell us the service and preferred time, and our front desk will help you book.",
      status: "active",
      delayMinutes: 0,
      conditions: { intents: ["booking", "pricing", "campaign_interest", "unknown"] },
      actions: ["detect-intent", "qualify-lead", "send-auto-reply"],
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "wa_rule_booking_confirm",
      tenantId: DEFAULT_TENANT_ID,
      name: "Booking confirmation",
      trigger: "appointment.booked",
      template: "Hi {{name}}, your {{service}} appointment is confirmed for {{time}} at {{branch}}.",
      status: "active",
      delayMinutes: 0,
      conditions: { appointmentStatus: "booked" },
      actions: ["send-confirmation"],
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "wa_rule_reminder",
      tenantId: DEFAULT_TENANT_ID,
      name: "Appointment reminder",
      trigger: "appointment.reminder",
      template: "Hi {{name}}, reminder for your {{service}} appointment at {{time}}. Reply 1 to confirm or call us to reschedule.",
      status: "active",
      delayMinutes: 1440,
      conditions: { hoursAhead: 24 },
      actions: ["send-reminder"],
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "wa_rule_payment",
      tenantId: DEFAULT_TENANT_ID,
      name: "Payment reminder",
      trigger: "invoice.pending",
      template: "Hi {{name}}, your invoice {{invoiceNumber}} has a pending balance of ₹{{balance}}. You can pay by UPI or at the salon.",
      status: "active",
      delayMinutes: 0,
      conditions: { invoiceStatus: ["unpaid", "partial"] },
      actions: ["send-payment-reminder"],
      createdAt: stamp,
      updatedAt: stamp
    },
    {
      id: "wa_rule_birthday",
      tenantId: DEFAULT_TENANT_ID,
      name: "Birthday wishes",
      trigger: "client.birthday",
      template: "Happy birthday {{name}}! Aura Salon wishes you a beautiful year. Enjoy a special birthday glow offer this week.",
      status: "active",
      delayMinutes: 0,
      conditions: { occasion: "birthday" },
      actions: ["send-birthday-wish"],
      createdAt: stamp,
      updatedAt: stamp
    }
  ]);
}

seedDatabase();
