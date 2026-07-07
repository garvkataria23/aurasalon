import { db } from "../db.js";

const CARD_ORDER = [
  "referrals",
  "giftCards",
  "campaigns",
  "automations",
  "coupons",
  "rewards",
  "marketplace",
  "deals",
  "boost"
];

const nowIso = () => new Date().toISOString();

function tableExists(table) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = @table").get({ table }));
}

const columnCache = new Map();

function columns(table) {
  if (!tableExists(table)) return new Set();
  if (!columnCache.has(table)) {
    columnCache.set(table, new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name)));
  }
  return columnCache.get(table);
}

function hasColumn(table, column) {
  return columns(table).has(column);
}

function scope(table, access, params) {
  const clauses = [];
  if (hasColumn(table, "tenantId")) {
    params.tenantId = access?.tenantId || "tenant_aura";
    clauses.push("tenantId = @tenantId");
  }
  if (hasColumn(table, "branchId") && access?.branchId) {
    params.branchId = access.branchId;
    clauses.push("(branchId = @branchId OR branchId IS NULL OR branchId = '')");
  }
  return clauses;
}

function scalar(table, expression, access, extraClauses = [], extraParams = {}) {
  if (!tableExists(table)) return 0;
  const params = { ...extraParams };
  const clauses = [...scope(table, access, params), ...extraClauses];
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const row = db.prepare(`SELECT ${expression} AS value FROM ${table}${where}`).get(params);
  return Number(row?.value || 0);
}

function textScalar(table, expression, access, extraClauses = [], extraParams = {}) {
  if (!tableExists(table)) return "";
  const params = { ...extraParams };
  const clauses = [...scope(table, access, params), ...extraClauses];
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const row = db.prepare(`SELECT ${expression} AS value FROM ${table}${where}`).get(params);
  return String(row?.value || "");
}

function statusFrom(value, fallback = "No data") {
  return Number(value || 0) > 0 ? "Active" : fallback;
}

function card({ title, description, status, primaryRoute, metrics, actions }) {
  return {
    title,
    description,
    status,
    primaryRoute,
    metrics,
    actions
  };
}

function money(value) {
  return Number(value || 0);
}

function referrals(access) {
  const hasReferralSource = hasColumn("clients", "referralSource");
  const hasReferral = hasColumn("clients", "referral");
  const clauses = [];
  if (hasReferralSource) clauses.push("COALESCE(referralSource, '') <> ''");
  if (hasReferral) clauses.push("COALESCE(referral, '') <> ''");
  const total = clauses.length ? scalar("clients", "COUNT(*)", access, [`(${clauses.join(" OR ")})`]) : 0;
  const revenue = clauses.length && hasColumn("clients", "totalSpend") ? scalar("clients", "SUM(COALESCE(totalSpend, 0))", access, [`(${clauses.join(" OR ")})`]) : 0;
  return card({
    title: "Referral System",
    description: "Referral source, converted clients aur pending rewards ka quick command.",
    status: statusFrom(total, "Setup required"),
    primaryRoute: "/leads",
    metrics: [
      { label: "Total referrals", value: total },
      { label: "Converted", value: total },
      { label: "Referral revenue", value: money(revenue), type: "money" },
      { label: "Pending rewards", value: 0, type: "money" }
    ],
    actions: [
      { label: "Open referrals", route: "/leads" },
      { label: "Client sources", route: "/client-masters" }
    ]
  });
}

function giftCards(access) {
  const total = scalar("gift_cards", "COUNT(*)", access);
  const outstanding = scalar("gift_cards", "SUM(COALESCE(balance, 0))", access);
  const issued = scalar("gift_cards", "SUM(COALESCE(initialValue, 0))", access);
  const redeemed = Math.max(0, issued - outstanding);
  const expiredOrVoid = scalar("gift_cards", "COUNT(*)", access, ["LOWER(COALESCE(status, '')) IN ('expired', 'void', 'voided', 'cancelled')"]);
  return card({
    title: "Gift Card",
    description: "Gift card sale, balance, redemption aur history control.",
    status: statusFrom(total),
    primaryRoute: "/memberships",
    metrics: [
      { label: "Total gift cards", value: total },
      { label: "Outstanding balance", value: money(outstanding), type: "money" },
      { label: "Redeemed amount", value: money(redeemed), type: "money" },
      { label: "Expired / void", value: expiredOrVoid }
    ],
    actions: [
      { label: "Open Gift Card", route: "/memberships" },
      { label: "Add Gift Card", route: "/pos" },
      { label: "Gift Card History", route: "/reports/financial-summary" }
    ]
  });
}

function campaigns(access) {
  const total = scalar("message_logs", "COUNT(*)", access);
  const sent = scalar("message_logs", "COUNT(*)", access, ["LOWER(COALESCE(status, '')) IN ('sent', 'send successfully', 'delivered', 'queued')"]);
  const failed = scalar("message_logs", "COUNT(*)", access, ["LOWER(COALESCE(status, '')) IN ('failed', 'error', 'provider_failed')"]);
  const lastSent = textScalar("message_logs", "MAX(createdAt)", access);
  return card({
    title: "SMS / WhatsApp Campaigns",
    description: "Campaign create, sent history, templates aur delivery audit.",
    status: statusFrom(total),
    primaryRoute: "/message-templates",
    metrics: [
      { label: "Total campaigns", value: total },
      { label: "Sent count", value: sent },
      { label: "Failed count", value: failed },
      { label: "Last sent", value: lastSent || "-" }
    ],
    actions: [
      { label: "Create Campaign", route: "/marketing" },
      { label: "Campaign Sent", route: "/message-logs" },
      { label: "Message Templates", route: "/message-templates" },
      { label: "Message History", route: "/message-logs" }
    ]
  });
}

function automations(access) {
  const active = scalar("notification_preferences", "COUNT(*)", access, ["enabled = 1"]);
  const disabled = scalar("notification_preferences", "COUNT(*)", access, ["enabled = 0"]);
  const failed = scalar("message_logs", "COUNT(*)", access, ["LOWER(COALESCE(status, '')) IN ('failed', 'error', 'provider_failed')"]);
  return card({
    title: "Automation",
    description: "Notification settings, enabled automations aur failed jobs.",
    status: statusFrom(active, "Setup required"),
    primaryRoute: "/message-templates",
    metrics: [
      { label: "Active automations", value: active },
      { label: "Disabled", value: disabled },
      { label: "Failed / paused", value: failed },
      { label: "Channels", value: "SMS / WhatsApp / Email" }
    ],
    actions: [
      { label: "Open Automation", route: "/marketing" },
      { label: "Notification Settings", route: "/message-templates" }
    ]
  });
}

function coupons(access) {
  const today = new Date().toISOString().slice(0, 10);
  const active = scalar("discountCoupons", "COUNT(*)", access, ["LOWER(status) = 'active'"]);
  const expired = scalar("discountCoupons", "COUNT(*)", access, ["(LOWER(status) = 'expired' OR (validTo IS NOT NULL AND validTo <> '' AND validTo < @today))"], { today });
  const used = scalar("discountCoupons", "SUM(COALESCE(usedCount, 0))", access);
  const discountGiven = scalar("discountCouponUsage", "SUM(COALESCE(discountPaise, 0))", access) / 100;
  return card({
    title: "Coupons",
    description: "Coupon engine, usage limits, redemption aur leakage monitor.",
    status: statusFrom(active, "Setup required"),
    primaryRoute: "/discount-rules/coupon-engine",
    metrics: [
      { label: "Active coupons", value: active },
      { label: "Expired coupons", value: expired },
      { label: "Used count", value: used },
      { label: "Discount given", value: money(discountGiven), type: "money" }
    ],
    actions: [
      { label: "Open Coupons", route: "/discount-rules/coupon-engine" },
      { label: "Add Coupon", route: "/discount-rules/coupon-engine" }
    ]
  });
}

function rewards(access) {
  const rewardClients = scalar("clients", "COUNT(*)", access, ["COALESCE(loyaltyPoints, 0) > 0"]);
  const pointsIssued = scalar("clients", "SUM(COALESCE(loyaltyPoints, 0))", access);
  return card({
    title: "Reward / Loyalty Points",
    description: "Rewards ledger, ROI, expiry reminders aur abuse alerts.",
    status: statusFrom(rewardClients),
    primaryRoute: "/memberships",
    metrics: [
      { label: "Reward clients", value: rewardClients },
      { label: "Points issued", value: pointsIssued },
      { label: "Points redeemed", value: 0 },
      { label: "Expiring points", value: 0 }
    ],
    actions: [
      { label: "Rewards Ledger", route: "/memberships" },
      { label: "Reward ROI", route: "/memberships" },
      { label: "Expiring Rewards", route: "/memberships" },
      { label: "Abuse Alerts", route: "/memberships" }
    ]
  });
}

function marketplace(access) {
  const connections = scalar("marketplace_connections", "COUNT(*)", access);
  const connected = scalar("marketplace_connections", "COUNT(*)", access, ["LOWER(COALESCE(status, '')) IN ('connected', 'active', 'healthy')"]);
  return card({
    title: "Marketplace Profile",
    description: "Marketplace listing, leads, sales, feedback aur integration health.",
    status: statusFrom(connected, connections ? "Setup required" : "No data"),
    primaryRoute: "/settings/marketplace",
    metrics: [
      { label: "Marketplace leads", value: 0 },
      { label: "Marketplace sales", value: 0, type: "money" },
      { label: "Paid amount", value: 0, type: "money" },
      { label: "Balance amount", value: 0, type: "money" }
    ],
    actions: [
      { label: "Marketplace Profile", route: "/settings/marketplace" },
      { label: "Customer Feedback", route: "/reputation" }
    ]
  });
}

function deals(access) {
  const today = new Date().toISOString().slice(0, 10);
  const active = scalar("promotionCalendar", "COUNT(*)", access, ["LOWER(status) = 'active'"]);
  const upcoming = scalar("promotionCalendar", "COUNT(*)", access, ["startDate > @today"], { today });
  const expired = scalar("promotionCalendar", "COUNT(*)", access, ["(LOWER(status) = 'expired' OR endDate < @today)"], { today });
  return card({
    title: "Deals & Promotions",
    description: "Promotion calendar, deals, public offers aur performance.",
    status: statusFrom(active + upcoming, "Setup required"),
    primaryRoute: "/discount-rules/promotion-calendar",
    metrics: [
      { label: "Active deals", value: active },
      { label: "Upcoming deals", value: upcoming },
      { label: "Expired deals", value: expired },
      { label: "Promotion revenue", value: 0, type: "money" }
    ],
    actions: [
      { label: "Deals List", route: "/discount-rules/promotion-calendar" },
      { label: "New Deal", route: "/discount-rules/promotion-calendar" },
      { label: "Performance", route: "/discount-rules/offer-roi-score" }
    ]
  });
}

function boost(access) {
  const apps = scalar("app_marketplace_apps", "COUNT(*)", access);
  return card({
    title: "Boost Your Account",
    description: "Boost plan, checkout status aur marketplace promotion payments.",
    status: apps ? "Setup required" : "No data",
    primaryRoute: "/saas",
    metrics: [
      { label: "Boost status", value: apps ? "Available" : "Not configured" },
      { label: "Current plan", value: "No active boost" },
      { label: "Payable amount", value: 0, type: "money" },
      { label: "Last payment", value: "-" }
    ],
    actions: [
      { label: "Open Boost", route: "/saas" },
      { label: "Checkout", route: "/saas" },
      { label: "Payment History", route: "/reports/financial-summary" }
    ]
  });
}

function buildCards(access) {
  return {
    referrals: referrals(access),
    giftCards: giftCards(access),
    campaigns: campaigns(access),
    automations: automations(access),
    coupons: coupons(access),
    rewards: rewards(access),
    marketplace: marketplace(access),
    deals: deals(access),
    boost: boost(access)
  };
}

export const salesToolsSummaryService = {
  summary(_query = {}, access = {}) {
    const cards = buildCards(access);
    const statuses = CARD_ORDER.map((key) => cards[key]?.status || "No data");
    return {
      summary: {
        totalTools: CARD_ORDER.length,
        activeTools: statuses.filter((status) => status === "Active").length,
        setupRequired: statuses.filter((status) => status === "Setup required").length,
        noData: statuses.filter((status) => status === "No data").length,
        lastUpdatedAt: nowIso()
      },
      cards
    };
  }
};
