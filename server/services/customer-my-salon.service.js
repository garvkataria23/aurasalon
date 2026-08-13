/**
 * Phase 1 — My Salon Mode
 *
 * Aggregates all salon-specific data for the customer's primary salon
 * into a single API call. This eliminates the need for the frontend
 * to make 6-8 separate calls on home page load.
 *
 * Endpoint: GET /customer/my-salon/dashboard
 *
 * Returns:
 *  - salon profile (name, address, phone, hours, slug, cover image)
 *  - customer's wallet balance + recent transactions
 *  - customer's loyalty points + tier
 *  - active membership at this salon
 *  - active packages at this salon
 *  - recent bookings at this salon (last 5)
 *  - relationship info (visit count, type, last visit)
 *  - salon services (top 10 active)
 *  - salon staff (active, public-bookable)
 *  - active offers
 */
import { db, tableHasColumn, columnsFor } from "../db.js";
import { unauthorized } from "../utils/app-error.js";
import {
  getPrimarySalon,
  getPrimarySalons,
  getAllRelationships,
} from "./customer-salon-relationship.service.js";

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const DEFAULT_OPEN = "10:00";
const DEFAULT_CLOSE = "20:00";

function assertCustomer(access = {}) {
  if (access.role !== "customer" || !access.userId) {
    throw unauthorized("Customer session is required");
  }
}

function requestedSalon(access, context = {}) {
  const tenantId = String(context.tenantId || "").trim();
  const branchId = String(context.branchId || "").trim();
  if (!tenantId || !branchId) return getPrimarySalon(access.userId);

  const relationship = getAllRelationships(access.userId).find(
    (row) => row.tenantId === tenantId && row.branchId === branchId
  );
  const primary = getPrimarySalon(access.userId);
  const multiPrimary = getPrimarySalons(access.userId).find(
    (row) => row.tenantId === tenantId && row.branchId === branchId
  );
  const salon = relationship || multiPrimary || (primary?.tenantId === tenantId && primary.branchId === branchId ? primary : null);
  if (!salon) throw unauthorized("Customer does not have access to this salon context");
  return {
    tenantId: salon.tenantId,
    branchId: salon.branchId,
    businessId: salon.businessId,
    businessName: salon.businessName,
  };
}

function json(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function paiseFromRupees(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function hasColumn(table, column) {
  return columnsFor(table).includes(column);
}

function tableExists(table) {
  return Boolean(
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = @table"
      )
      .get({ table })
  );
}

function slugify(value, fallback = "business") {
  const slug = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

// ─── Salon Profile ────────────────────────────────────────────────

function resolveSalonProfile(tenantId, branchId) {
  const row = db
    .prepare(
      `
    SELECT
      t.id AS tenantId,
      t.name AS tenantName,
      t.slug AS tenantSlug,
      b.id AS branchId,
      b.name AS branchName,
      b.city,
      b.address,
      b.phone,
      b.timezone,
      b.slug AS branchSlug,
      b.themeConfig,
      b.seoConfig,
      b.onlineBookingEnabled,
      b.createdAt
    FROM branches b
    JOIN tenants t ON t.id = b.tenantId
    WHERE t.id = @tenantId AND b.id = @branchId
    LIMIT 1
  `
    )
    .get({ tenantId, branchId });

  if (!row) return null;

  const timezone = row.timezone || DEFAULT_TIMEZONE;
  const hours = json(row.themeConfig?.businessHours, {});

  return {
    tenantId: row.tenantId,
    branchId: row.branchId,
    name: row.branchName || row.tenantName || "Salon",
    businessName: row.tenantName || row.branchName || "Salon",
    slug: slugify(`${row.branchName || row.branchId}-${row.branchId}`),
    address: row.address || "",
    city: row.city || "",
    phone: row.phone || "",
    timezone,
    onlineBookingEnabled: Boolean(row.onlineBookingEnabled ?? true),
    coverImage: row.themeConfig?.coverImage || "",
    logoImage: row.themeConfig?.logoImage || "",
    galleryImages: json(row.themeConfig?.galleryImages, []),
    isOpen: isOpenNow(hours, timezone),
    hoursLabel: hoursLabel(hours, timezone),
  };
}

// ─── Business hours helpers ───────────────────────────────────────

function timeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function displayTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatTime(value) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return "";
  return displayTime(minutes);
}

function todayKey(timezone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: timezone,
  })
    .format(new Date())
    .toLowerCase();
}

function currentMinutes(timezone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).formatToParts(new Date());
  const hour = Number(
    parts.find((part) => part.type === "hour")?.value || 0
  );
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || 0
  );
  return hour * 60 + minute;
}

function currentHours(hours = {}, timezone = DEFAULT_TIMEZONE) {
  const key = todayKey(timezone);
  return hours?.[key] || null;
}

function isOpenNow(hours = {}, timezone = DEFAULT_TIMEZONE) {
  if (!Object.keys(hours || {}).length) return true;
  const today = currentHours(hours, timezone);
  if (!today || today.open === false) return false;
  const open = timeToMinutes(today.opensAt || today.openingTime || DEFAULT_OPEN);
  const close = timeToMinutes(today.closesAt || today.closingTime || DEFAULT_CLOSE);
  const now = currentMinutes(timezone);
  if (open === null || close === null) return true;
  return now >= open && now < close;
}

function hoursLabel(hours = {}, timezone = DEFAULT_TIMEZONE) {
  if (!Object.keys(hours || {}).length) return "Online booking available";
  const today = currentHours(hours, timezone);
  if (!today || today.open === false) return "Closed today";
  const opensAt = today.opensAt || today.openingTime || DEFAULT_OPEN;
  const closesAt = today.closesAt || today.closingTime || DEFAULT_CLOSE;
  return `Today ${formatTime(opensAt)} - ${formatTime(closesAt)}`;
}

// ─── Wallet ───────────────────────────────────────────────────────

function walletForClient(tenantId, branchId, clientId) {
  const row = db
    .prepare(
      `SELECT walletBalance FROM clients WHERE tenantId = @tenantId AND id = @clientId LIMIT 1`
    )
    .get({ tenantId, clientId });

  const canScopeBranch = !branchId || hasColumn("wallet_transactions", "branchId");
  const branchClause = branchId && canScopeBranch ? " AND branchId = @branchId" : "";
  const transactions = tableExists("wallet_transactions") && canScopeBranch
    ? db
        .prepare(
          `SELECT * FROM wallet_transactions WHERE tenantId = @tenantId AND clientId = @clientId${branchClause} ORDER BY datetime(createdAt) DESC LIMIT 10`
        )
        .all({ tenantId, branchId, clientId })
    : [];

  return {
    balancePaise: branchId ? transactions.reduce((sum, item) => sum + paiseFromRupees(item.amount), 0) : paiseFromRupees(row?.walletBalance || 0),
    transactions: transactions.map((item) => ({
      id: item.id,
      type: item.type,
      amountPaise: paiseFromRupees(item.amount),
      balanceAfterPaise: paiseFromRupees(item.balanceAfter),
      notes: item.notes || "",
      createdAt: item.createdAt || "",
    })),
  };
}

// ─── Loyalty ──────────────────────────────────────────────────────

function loyaltyForClient(tenantId, branchId, clientId) {
  if (branchId) return { points: 0, tier: "Classic" };
  const row = db
    .prepare(
      `SELECT loyaltyPoints FROM clients WHERE tenantId = @tenantId AND id = @clientId LIMIT 1`
    )
    .get({ tenantId, clientId });

  const points = Number(row?.loyaltyPoints || 0);
  let tier = "Classic";
  if (points >= 1000) tier = "Gold";
  else if (points >= 500) tier = "Silver";

  return { points, tier };
}

// ─── Membership ───────────────────────────────────────────────────

function membershipForClient(clientId, tenantId, branchId) {
  if (!tableExists("memberships")) return null;
  const clauses = ["clientId = @clientId", "status = 'active'"];
  const params = { clientId, tenantId, branchId };
  if (hasColumn("memberships", "tenantId")) {
    clauses.push("(tenantId = @tenantId OR COALESCE(tenantId, '') = '')");
  }
  if (branchId) {
    if (!hasColumn("memberships", "branchId")) return null;
    clauses.push("branchId = @branchId");
  }
  const row = db
    .prepare(
      `SELECT * FROM memberships WHERE ${clauses.join(" AND ")} ORDER BY datetime(createdAt) DESC LIMIT 1`
    )
    .get(params);
  if (!row) return null;
  return {
    id: row.id,
    planName: row.planName,
    pricePaise: paiseFromRupees(row.price),
    planCredits: Number(row.planCredits || 0),
    creditsRemaining: Number(row.creditsRemaining || 0),
    validityDate: row.validityDate || "",
    status: row.status || "active",
    createdAt: row.createdAt || "",
  };
}

// ─── Gift Cards ──────────────────────────────────────────────────

function giftCardsForClient(tenantId, branchId, clientId) {
  if (!tableExists("gift_cards")) return [];
  const clauses = [];
  const params = { tenantId, branchId, clientId };
  if (hasColumn("gift_cards", "tenantId")) {
    clauses.push("(tenantId = @tenantId OR tenant_id = @tenantId)");
  }
  if (hasColumn("gift_cards", "clientId")) {
    clauses.push("(clientId = @clientId OR customer_id = @clientId)");
  }
  if (branchId) {
    if (!hasColumn("gift_cards", "branchId")) return [];
    clauses.push("branchId = @branchId");
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM gift_cards ${where} ORDER BY datetime(createdAt) DESC LIMIT 5`)
    .all(params);

  return rows.map((r) => ({
    id: r.id,
    code: r.code || r.display_code_last4 || "GIFT",
    balancePaise: paiseFromRupees(r.balancePaise || r.balance || r.initial_value || 0),
    expiryDate: r.expiryDate || r.expiry_date || "",
    status: r.status || "active",
  }));
}

// ─── Invoices ────────────────────────────────────────────────────

function invoicesForClient(tenantId, branchId, clientId) {
  if (!tableExists("invoices")) return [];
  const clauses = [];
  const params = { tenantId, branchId, clientId };
  if (hasColumn("invoices", "tenantId")) {
    clauses.push("(tenantId = @tenantId OR tenant_id = @tenantId)");
  }
  if (hasColumn("invoices", "clientId")) {
    clauses.push("(clientId = @clientId OR customer_id = @clientId)");
  }
  if (branchId) {
    if (!hasColumn("invoices", "branchId")) return [];
    clauses.push("branchId = @branchId");
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM invoices ${where} ORDER BY datetime(createdAt) DESC LIMIT 5`)
    .all(params);

  return rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoiceNumber || r.invoice_no || `INV-${r.id.slice(0, 6)}`,
    totalPaise: paiseFromRupees(r.grand_total_paise ? r.grand_total_paise / 100 : r.total || r.grand_total || 0),
    status: r.status || r.payment_status || "paid",
    createdAt: r.createdAt || r.created_at || "",
  }));
}

// ─── Notifications ───────────────────────────────────────────────

function notificationsForClient(tenantId, branchId, clientId) {
  if (tableExists("customerInboxNotifications")) {
    return db.prepare(`SELECT * FROM customerInboxNotifications WHERE tenantId = @tenantId AND branchId = @branchId AND customerId = @clientId AND archivedAt = '' ORDER BY datetime(scheduledAt) DESC, datetime(createdAt) DESC LIMIT 5`)
      .all({ tenantId, branchId, clientId })
      .map((n) => ({
        id: n.id,
        title: n.title || "Salon Update",
        message: n.body || "",
        createdAt: n.createdAt || "",
        readAt: n.readAt || null,
      }));
  }
  if (!tableExists("notifications")) return [];
  const clauses = ["(clientId = @clientId OR COALESCE(clientId, '') = '')"];
  const params = { tenantId, branchId, clientId };
  if (hasColumn("notifications", "tenantId")) {
    clauses.push("(tenantId = @tenantId OR COALESCE(tenantId, '') = '')");
  }
  if (branchId) {
    if (!hasColumn("notifications", "branchId")) return [];
    clauses.push("branchId = @branchId");
  }
  const rows = db
    .prepare(`SELECT * FROM notifications WHERE ${clauses.join(" AND ")} ORDER BY datetime(createdAt) DESC LIMIT 5`)
    .all(params);

  return rows.map((n) => ({
    id: n.id,
    title: n.title || "Salon Update",
    message: n.message || "",
    createdAt: n.createdAt || "",
    readAt: n.readAt || null,
  }));
}

// ─── Packages ─────────────────────────────────────────────────────

function packagesForTenant(tenantId, branchId) {
  if (!tableExists("packages")) return [];
  if (branchId && !hasColumn("packages", "branchId")) return [];
  const branchClause = branchId ? " AND branchId = @branchId" : "";
  return db
    .prepare(
      `SELECT * FROM packages WHERE tenantId = @tenantId${branchClause} AND status = 'active' ORDER BY datetime(createdAt) DESC LIMIT 5`
    )
    .all({ tenantId, branchId })
    .map((item) => ({
      id: item.id,
      name: item.name,
      pricePaise: paiseFromRupees(item.price),
      sessionsTotal: Number(item.packageCredits || item.validityDays || 5),
      sessionsUsed: Number(item.sessionsUsed || 0),
      status: item.status || "active",
      createdAt: item.createdAt || "",
    }));
}

// ─── Recent Bookings ──────────────────────────────────────────────

function recentBookings(access, tenantId, branchId) {
  const whereTenant = tableHasColumn("appointments", "tenantId")
    ? "tenantId = @tenantId AND"
    : "";
  const whereBranch = branchId && tableHasColumn("appointments", "branchId") ? " AND branchId = @branchId" : "";
  const rows = db
    .prepare(
      `SELECT * FROM appointments WHERE ${whereTenant} clientId = @clientId${whereBranch} ORDER BY datetime(startAt) DESC LIMIT 5`
    )
    .all({ tenantId, branchId, clientId: access.userId });

  return rows.map((row) => ({
    id: row.id,
    serviceName: row.serviceName || "",
    staffName: row.staffName || "",
    startAt: row.startAt || "",
    status: row.status || "",
    totalPricePaise: paiseFromRupees(row.totalAmount || row.total || 0),
  }));
}

// ─── Services ─────────────────────────────────────────────────────

function salonServices(tenantId, branchId) {
  const clauses = ["s.status = 'active'"];
  const params = { tenantId, branchId };
  if (hasColumn("services", "tenantId")) clauses.push("s.tenantId = @tenantId");
  if (hasColumn("services", "branchId")) {
    clauses.push("(s.branchId = @branchId OR COALESCE(s.branchId, '') = '')");
  }
  if (hasColumn("services", "onlineBookable")) {
    clauses.push("COALESCE(s.onlineBookable, 1) = 1");
  }
  return db
    .prepare(
      `SELECT s.*
       FROM services s
       WHERE ${clauses.join(" AND ")}
       ORDER BY s.category, s.name
       LIMIT 10`
    )
    .all(params)
    .map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category || "",
      durationMinutes: Number(s.durationMinutes || s.duration || 0),
      pricePaise: paiseFromRupees(s.price),
      description: s.description || "",
    }));
}

// ─── Staff ────────────────────────────────────────────────────────

function salonStaff(tenantId, branchId) {
  const clauses = ["s.status = 'active'"];
  const params = { tenantId, branchId };
  if (hasColumn("staff", "tenantId")) clauses.push("s.tenantId = @tenantId");
  if (hasColumn("staff", "branchId")) clauses.push("s.branchId = @branchId");

  return db
    .prepare(
      `SELECT s.*
       FROM staff s
       WHERE ${clauses.join(" AND ")}
       ORDER BY s.name
       LIMIT 10`
    )
    .all(params)
    .map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role || "",
      specialty: s.specialty || s.role || "Salon Specialist",
      avatar: s.avatar || s.photo || "",
    }));
}

// ─── Active Offers ────────────────────────────────────────────────

function activeOffers(tenantId, branchId) {
  if (!tableExists("happy_hours_campaigns")) return [];
  const rows = db
    .prepare(
      `SELECT id, title, discountType, discountValue, startDate, endDate, status
       FROM happy_hours_campaigns
       WHERE tenantId = @tenantId
         AND status = 'active'
         AND (branchId = @branchId OR COALESCE(branchId, '') = '')
         AND (endDate = '' OR datetime(endDate) >= datetime('now'))
       ORDER BY datetime(createdAt) DESC
       LIMIT 5`
    )
    .all({ tenantId, branchId });

  return rows.map((r) => ({
    id: r.id,
    title: r.title || "",
    discountType: r.discountType || "",
    discountValue: Number(r.discountValue || 0),
    validFrom: r.startDate || "",
    validTo: r.endDate || "",
  }));
}

// ─── Dashboard (main) ─────────────────────────────────────────────

export function getMySalonDashboard(access, context = {}) {
  assertCustomer(access);

  const salonContext = requestedSalon(access, context);
  if (!salonContext) {
    return {
      hasPrimarySalon: false,
      salon: null,
      wallet: null,
      loyalty: null,
      membership: null,
      packages: [],
      recentBookings: [],
      services: [],
      staff: [],
      offers: [],
      giftCards: [],
      invoices: [],
      notifications: [],
      relationship: null,
    };
  }

  const { tenantId, branchId } = salonContext;
  const salon = resolveSalonProfile(tenantId, branchId);

  // Relationship
  const allRels = getAllRelationships(access.userId);
  const relationship = allRels.find(
    (r) => r.tenantId === tenantId && r.branchId === branchId
  ) || null;

  // Client record for this tenant
  const clientRow = db
    .prepare(
      `SELECT * FROM clients WHERE tenantId = @tenantId AND id = @clientId LIMIT 1`
    )
    .get({ tenantId, clientId: access.userId });

  const wallet = clientRow
    ? walletForClient(tenantId, branchId, access.userId)
    : { balancePaise: 0, transactions: [] };
  const loyalty = clientRow
    ? loyaltyForClient(tenantId, branchId, access.userId)
    : { points: 0, tier: "Classic" };
  const membership = clientRow
    ? membershipForClient(access.userId, tenantId, branchId)
    : null;
  const packages = packagesForTenant(tenantId, branchId);
  const bookings = recentBookings(access, tenantId, branchId);
  const services = salonServices(tenantId, branchId);
  const staff = salonStaff(tenantId, branchId);
  const offers = activeOffers(tenantId, branchId);
  const giftCards = giftCardsForClient(tenantId, branchId, access.userId);
  const invoices = invoicesForClient(tenantId, branchId, access.userId);
  const notifications = notificationsForClient(tenantId, branchId, access.userId);

  return {
    hasPrimarySalon: true,
    salon,
    wallet,
    loyalty,
    membership,
    packages,
    recentBookings: bookings,
    services,
    staff,
    offers,
    giftCards,
    invoices,
    notifications,
    relationship: relationship
      ? {
          visitCount: relationship.visitCount,
          type: relationship.relationshipType || "guest",
          lastVisitAt: relationship.lastVisitAt || "",
        }
      : null,
  };
}

// ─── Services list (for lazy load / refresh) ──────────────────────

export function getMySalonServices(access, context = {}) {
  assertCustomer(access);
  const salonContext = requestedSalon(access, context);
  if (!salonContext) return { services: [] };
  return { services: salonServices(salonContext.tenantId, salonContext.branchId) };
}

// ─── Staff list (for lazy load / refresh) ─────────────────────────

export function getMySalonStaff(access, context = {}) {
  assertCustomer(access);
  const salonContext = requestedSalon(access, context);
  if (!salonContext) return { staff: [] };
  return { staff: salonStaff(salonContext.tenantId, salonContext.branchId) };
}

// ─── Offers list (for lazy load / refresh) ────────────────────────

export function getMySalonOffers(access, context = {}) {
  assertCustomer(access);
  const salonContext = requestedSalon(access, context);
  if (!salonContext) return { offers: [] };
  return { offers: activeOffers(salonContext.tenantId, salonContext.branchId) };
}
