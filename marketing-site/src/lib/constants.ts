import type { NavLink, Feature, PricingTier, Testimonial, BlogPost, FeaturePageData } from "./types";

/* ===== NAVIGATION ===== */
export const NAV_LINKS: NavLink[] = [
  { label: "Platform", href: "/platform" },
  { label: "Owner CRM", href: "/owner-crm" },
  { label: "Customer App", href: "/customer-app" },
  { label: "Staff App", href: "/staff-app" },
  { label: "Workflows", href: "/workflows" },
  { label: "Pricing", href: "/pricing" },
];

export const CTA_LINKS = {
  login: "/demo",
  trial: "/demo",
  demo: "/demo",
};

/* ===== FEATURES ===== */
export const FEATURES: Feature[] = [
  {
    icon: "calendar",
    title: "Smart Booking",
    description: "Slot guidance, online booking, waitlist management and QR check-ins.",
    href: "/features/appointments",
    color: "#6F4FD8",
  },
  {
    icon: "credit-card",
    title: "POS & Billing",
    description: "GST-ready invoicing, split payments (UPI/card/cash/wallet), thermal printing, and daily closing.",
    href: "/features/billing",
    color: "#7C3AED",
  },
  {
    icon: "users",
    title: "Customer 360",
    description: "Client profiles, purchase history, loyalty, wallet, WhatsApp history and follow-up context.",
    href: "/features/client-crm",
    color: "#8B5CF6",
  },
  {
    icon: "user-check",
    title: "Staff OS",
    description: "Attendance (face/biometric), shift scheduling, commissions, payroll, and performance dashboards.",
    href: "/features/staff-management",
    color: "#6366F1",
  },
  {
    icon: "package",
    title: "Inventory Brain",
    description: "Batch tracking, FIFO, expiry alerts, usage-based reorder guidance, suppliers and waste records.",
    href: "/features/inventory",
    color: "#9333EA",
  },
  {
    icon: "megaphone",
    title: "Marketing Workflows",
    description: "Birthday campaigns, WhatsApp sequences, SMS campaigns, lead follow-up and performance tracking.",
    href: "/features/marketing-ai",
    color: "#8A4FFF",
  },
  {
    icon: "trending-up",
    title: "Finance Engine",
    description: "Daily closing, cash drawer, expenses, balance sheet, profit intelligence, and GST reports.",
    href: "/features/finance",
    color: "#059669",
  },
  {
    icon: "shield-check",
    title: "Compliance",
    description: "PF, ESI, TDS, professional tax, gratuity and bonus calculation and record workflows.",
    href: "/features/compliance",
    color: "#6D28D9",
  },
];

export const FEATURES_OVERVIEW: Feature[] = [
  ...FEATURES,
  {
    icon: "palette",
    title: "White Label",
    description: "Custom branding, domain, logo for multi-location salon chains and franchises.",
    href: "/features/white-label",
    color: "#A855F7",
  },
];

/* ===== LANDING PAGE STATS ===== */
export const STATS = [
  { value: 500, suffix: "+", label: "Appointments processed daily" },
  { value: 98, suffix: "%", label: "Uptime commitment" },
  { value: 45, suffix: "min", label: "Average setup time" },
  { value: 12, suffix: "+", label: "States covered" },
];

/* ===== HOW IT WORKS ===== */
export const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Sign Up in 2 Minutes",
    description: "Create your salon account, set up your branch, and you're ready. No complex setup required.",
  },
  {
    step: 2,
    title: "Import Your Data",
    description: "Bring existing client, service and staff records through a guided setup and migration process.",
  },
  {
    step: 3,
    title: "Start Running Your Salon",
    description: "Manage appointments, billing, staff, inventory, and marketing — all from one dashboard.",
  },
];

/* ===== PRICING ===== */
export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Starter",
    monthlyPrice: 999,
    yearlyPrice: 799,
    description: "Perfect for single-salon owners getting started",
    features: [
      "1 Branch",
      "Unlimited Appointments",
      "POS & Billing (GST)",
      "Client CRM",
      "Basic Reports",
      "Online Booking Portal",
      "WhatsApp Notifications",
      "Email Support",
    ],
    cta: "Discuss Trial Access",
  },
  {
    name: "Growth",
    monthlyPrice: 2499,
    yearlyPrice: 1999,
    description: "For growing salons that need automation and intelligence",
    features: [
      "Up to 5 Branches",
      "Everything in Starter",
      "Staff OS (Attendance, Payroll)",
      "Inventory Management",
      "Marketing Campaign Workflows",
      "Finance Engine",
      "Customer 360 Intelligence",
      "Discount Rules (Happy Hours)",
      "Priority Support",
      "API Access",
    ],
    highlighted: true,
    cta: "Discuss Trial Access",
  },
  {
    name: "Enterprise",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Custom solutions for large salon chains and franchises",
    features: [
      "Unlimited Branches",
      "Everything in Growth",
      "White Label Branding",
      "Custom Domain & Logo",
      "Compliance (PF/ESI/TDS)",
      "Franchise Management",
      "Digital Twin Simulator",
      "Dedicated Account Manager",
      "Custom Integrations",
      "SLA Guarantee",
    ],
    cta: "Contact Sales",
  },
];

export const PRICING_FAQ = [
  {
    question: "Can we evaluate Aura before committing?",
    answer: "Yes. Request a demo and discuss trial access for your salon. Trial scope, duration and included modules are confirmed in the proposal rather than promised as a universal instant trial.",
  },
  {
    question: "Can I switch plans later?",
    answer: "Plan changes can be discussed as your operation evolves. Timing, migration between tiers and any billing adjustment are confirmed in your proposal.",
  },
  {
    question: "How does multi-branch pricing work?",
    answer: "Starter plan is for single branches. Growth plan supports up to 5 branches. Enterprise plan has unlimited branches with custom pricing.",
  },
  {
    question: "Do you offer annual discounts?",
    answer: "The published monthly and annual-equivalent prices show the current plan structure. Final billing terms and any annual saving are confirmed in the proposal.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "Subscription payment methods and payment-provider details are confirmed in the proposal. Customer bookings shown on this site use the current pay-at-salon flow.",
  },
  {
    question: "Is my data secure?",
    answer: "Aura is designed around tenant and branch isolation, role-based access and audit trails. Hosting, backup, retention and security commitments are confirmed in the proposal and data-processing terms.",
  },
];

/** Canonical plan collection used by pricing pages and previews. */
export const PRICING_PLANS = PRICING_TIERS;

/* ===== TESTIMONIALS ===== */
export const TESTIMONIALS: Testimonial[] = [
  {
    quote: "We went from managing everything on paper to having a complete digital system in just one week. GST billing that used to take our accountant two hours now happens in seconds. Our revenue increased by 40% in the first quarter after switching — the online booking portal alone brings in 15-20 new clients monthly from Bandra and Andheri.",
    name: "Priya Sharma",
    role: "Owner",
    salon: "Glow Studio",
    city: "Mumbai",
    rating: 5,
  },
  {
    quote: "The staff management module is a game-changer for our three locations across Delhi NCR. Attendance tracking, payroll, commissions — everything automated. We save 15 hours every week on admin tasks that used to be spreadsheet nightmares. Our stylists love seeing their commission breakdown in real time.",
    name: "Rahul Mehta",
    role: "Director",
    salon: "The Style Lounge",
    city: "Delhi",
    rating: 5,
  },
  {
    quote: "Customer 360 completely changed how we approach retention. I know every client's history, preferences, and spending patterns. When a regular like Mrs. Patel comes in, the system reminds me she prefers the senior stylist and likes the keratin treatment — that personal touch brought our repeat visit rate from 55% to 78% in Koramangala.",
    name: "Anjali Kapoor",
    role: "Manager",
    salon: "Bloom Beauty Bar",
    city: "Bangalore",
    rating: 5,
  },
  {
    quote: "We switched from Fresha to Aura and never looked back. The Indian GST billing, UPI payments, and WhatsApp integration make it perfect for salons in Jaipur. Earlier we were juggling three different apps — one for billing, one for appointments, one for messages. Now it's all in one place and our front desk team actually has time to greet clients properly.",
    name: "Vikram Singh",
    role: "Owner",
    salon: "Royal Men's Grooming",
    city: "Jaipur",
    rating: 5,
  },
  {
    quote: "The marketing automation alone pays for the subscription three times over. Birthday campaigns, follow-up messages, and re-engagement — all running on autopilot. Last Diwali, the festival campaign template brought in ₹2.8 lakhs in advance bookings across our two Kochi locations. The WhatsApp reminders reduced no-shows from 25% to under 8%.",
    name: "Meera Nair",
    role: "Owner",
    salon: "Serenity Spa",
    city: "Kochi",
    rating: 5,
  },
  {
    quote: "Managing 12 branches across Gujarat and Maharashtra was chaos before Aura. Now I have a single dashboard with real-time data from every location. The multi-branch analytics showed us that our Surat branch had 30% idle chair time — we restructured shifts and recovered ₹4.5 lakhs in monthly revenue. That kind of visibility was impossible before.",
    name: "Arjun Patel",
    role: "CEO",
    salon: "StyleCraft Chain",
    city: "Ahmedabad",
    rating: 5,
  },
];

/* ===== BLOG POSTS ===== */
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "how-to-increase-salon-revenue",
    title: "7 Proven Strategies to Increase Your Salon Revenue in 2025",
    excerpt: "Discover actionable techniques that top-performing salons use to boost revenue by 30-50% through smart pricing, upselling, and client retention.",
    date: "2025-07-15",
    readTime: "8 min read",
    category: "Business Growth",
  },
  {
    slug: "salon-staff-management-guide",
    title: "The Complete Guide to Salon Staff Management",
    excerpt: "From attendance tracking to performance-based commissions — learn how leading salons manage their teams efficiently with technology.",
    date: "2025-07-10",
    readTime: "12 min read",
    category: "Staff Management",
  },
  {
    slug: "digital-transformation-salon",
    title: "Why Your Salon Needs Digital Transformation Now",
    excerpt: "The salon industry is evolving rapidly. Here's why going digital isn't optional anymore and how to make the transition smooth.",
    date: "2025-07-05",
    readTime: "6 min read",
    category: "Industry Insights",
  },
  {
    slug: "gst-billing-salon-guide",
    title: "GST Billing for Salons: Everything You Need to Know",
    excerpt: "A complete guide to GST compliance for salon businesses — from invoicing to filing returns with practical examples.",
    date: "2025-06-28",
    readTime: "10 min read",
    category: "Compliance",
  },
  {
    slug: "salon-marketing-automation",
    title: "How to Set Up Automated Marketing for Your Salon",
    excerpt: "Build practical birthday, re-engagement and WhatsApp follow-up workflows with clear timing and consent.",
    date: "2025-06-20",
    readTime: "9 min read",
    category: "Marketing",
  },
  {
    slug: "salon-inventory-management",
    title: "Stop Losing Money on Inventory: A Salon Owner's Guide",
    excerpt: "Use batch, expiry, service-recipe and reorder records to make stock decisions with better context.",
    date: "2025-06-15",
    readTime: "7 min read",
    category: "Operations",
  },
];

/* ===== FEATURE PAGES DATA ===== */
export const FEATURE_PAGES: Record<string, FeaturePageData> = {
  appointments: {
    translationKey: "appointments",
    title: "Smart Booking & Appointments",
    subtitle: "Practical scheduling, waitlists and booking controls for a busy salon day",
    heroDescription: "Give your clients the freedom to book 24/7 while your calendar stays perfectly organized. Aura\u2019s smart scheduling eliminates double-bookings, reduces no-shows with automated WhatsApp reminders, and fills last-minute gaps with intelligent waitlist management.",
    icon: "calendar",
    gradient: "from-aura-burgundy to-aura-rose",
    painPoints: [
      "Phone tag and missed calls losing potential bookings during busy hours",
      "Double-bookings and scheduling conflicts causing client frustration",
      "High no-show rates eating into daily revenue with no automated reminders",
    ],
    solutions: [
      "24/7 self-service booking portal accessible from any device",
      "Conflict-free smart scheduling with real-time staff availability",
      "Automated WhatsApp & SMS reminders cutting no-shows by up to 65%",
    ],
    capabilities: [
      { title: "Working Calendar", description: "Day, week and month views with rescheduling, walk-ins and multi-staff context." },
      { title: "Online Booking Portal", description: "A public pay-at-salon booking flow with service and professional selection." },
      { title: "Slot Guidance", description: "Use staff availability, service duration and salon capacity to suggest practical slots." },
      { title: "Waitlist & QR Check-in", description: "Keep waitlist requests beside the calendar and support QR check-in for walk-ins." },
      { title: "Multi-Staff Booking", description: "Let clients book specific stylists or opt for the next available professional." },
      { title: "Recurring Appointments", description: "Set up weekly or monthly repeat bookings for regular clients automatically." },
    ],
    stats: [
      { value: "24/7", label: "Online booking" },
      { value: "65%", label: "Fewer no-shows" },
      { value: "3x", label: "Faster check-in" },
    ],
    impactMetrics: [
      { value: "65%", label: "Fewer No-Shows", description: "Automated reminders via WhatsApp, SMS and email drastically reduce missed appointments." },
      { value: "24/7", label: "Booking Availability", description: "Clients book anytime from your website, Google, or WhatsApp \u2014 even after hours." },
      { value: "3x", label: "Faster Check-in", description: "QR walk-in check-in and pre-filled client profiles speed up the front desk." },
    ],
    relatedFeatures: [
      { label: "POS & GST Invoicing", href: "/features/billing" },
      { label: "Client CRM & Loyalty", href: "/features/client-crm" },
      { label: "Staff Roster & Payroll", href: "/features/staff-management" },
    ],
  },
  billing: {
    translationKey: "billing",
    title: "POS & GST Invoicing",
    subtitle: "GST-ready invoicing, split payments, thermal printing and daily closing",
    heroDescription: "Process payments in 3 clicks with India\u2019s most complete salon POS. Generate GST-compliant invoices, handle split payments across UPI/card/cash, and close your day with automated reconciliation \u2014 all from one screen.",
    icon: "credit-card",
    gradient: "from-aura-amber to-aura-burgundy",
    painPoints: [
      "Manual GST calculation errors leading to compliance issues and CA headaches",
      "Split payment nightmares when clients use multiple payment modes",
      "End-of-day cash discrepancies with no audit trail or variance tracking",
    ],
    solutions: [
      "Auto-calculated GST with HSN/SAC codes on every invoice",
      "Seamless split payments across UPI, cards, cash, wallet & gift cards",
      "Automated daily closing with Z-reports and complete audit trails",
    ],
    capabilities: [
      { title: "GST-Ready Invoicing", description: "GST calculation, HSN/SAC context and invoice records with thermal printer support." },
      { title: "Split Payments", description: "Accept UPI, cards, cash, wallet, and gift card payments in any combination on a single invoice." },
      { title: "Daily Closing & Z-Report", description: "End-of-day reconciliation with cash drawer records and variance tracking." },
      { title: "Invoice Management", description: "Hold, void, refund, and track every invoice with complete audit trails and event history." },
      { title: "Thermal Printing", description: "Direct integration with thermal receipt printers for instant professional invoices." },
      { title: "Refund & Credit Notes", description: "Process refunds, issue credit notes, and track void invoices with complete history." },
    ],
    stats: [
      { value: "3 Clicks", label: "To invoice" },
      { value: "100%", label: "GST compliant" },
      { value: "\u20B90", label: "Billing errors" },
    ],
    impactMetrics: [
      { value: "3 Clicks", label: "Checkout Speed", description: "From service selection to printed invoice in under 10 seconds." },
      { value: "100%", label: "GST Compliant", description: "Automatic GST calculation, HSN codes, and GSTR-ready reports." },
      { value: "\u20B90", label: "Billing Errors", description: "Automated calculations eliminate manual entry mistakes." },
    ],
    relatedFeatures: [
      { label: "Online Booking", href: "/features/appointments" },
      { label: "Inventory Control", href: "/features/inventory" },
      { label: "Finance Engine", href: "/features/finance" },
    ],
  },
  "client-crm": {
    translationKey: "client-crm",
    title: "Customer 360 Intelligence",
    subtitle: "Keep visit history, preferences, wallet and follow-up context together",
    heroDescription: "Know every client like your best stylist does. Aura builds a complete 360\u00B0 profile \u2014 visit history, preferences, allergies, loyalty points, wallet balance, and WhatsApp conversations \u2014 so every interaction feels personalized.",
    icon: "users",
    gradient: "from-electric-blue to-aura-burgundy",
    painPoints: [
      "Client preferences lost in paper notes or scattered spreadsheets",
      "No visibility into which clients are at risk of churning",
      "Manual loyalty tracking leading to redemption errors and disputes",
    ],
    solutions: [
      "Digital client profiles with complete history, preferences & allergy notes",
      "Automated churn risk scoring and suggested follow-up actions",
      "Points-based loyalty with digital wallet, store credits & auto-redemption",
    ],
    capabilities: [
      { title: "Complete Client Profiles", description: "Visit history, purchase patterns, preferences, notes, tags, consent forms, and WhatsApp communication." },
      { title: "Value & Follow-up Context", description: "Use formulas and configured rules for LTV, risk context and suggested follow-up." },
      { title: "Loyalty & Wallet", description: "Points-based loyalty programs, digital wallet, credit notes, and store credits." },
      { title: "Client Memory", description: "Keep preferences, allergies, product reactions and visit context attached to the client record." },
      { title: "Client Segmentation", description: "Group clients by visit frequency, spend, services, and custom tags for targeted actions." },
      { title: "Consent & Forms", description: "Digital consent forms, allergy questionnaires, and consultation notes attached to profiles." },
    ],
    stats: [
      { value: "360\u00B0", label: "Client view" },
      { value: "40%", label: "Repeat boost" },
      { value: "Smart", label: "Churn alerts" },
    ],
    impactMetrics: [
      { value: "360\u00B0", label: "Client View", description: "Every visit, purchase, preference, and communication in one profile." },
      { value: "40%", label: "Repeat Boost", description: "Personalized follow-ups and loyalty rewards drive repeat visits." },
      { value: "Smart", label: "Churn Alerts", description: "Get notified when high-value clients haven\u2019t visited in a while." },
    ],
    relatedFeatures: [
      { label: "Marketing AI", href: "/features/marketing-ai" },
      { label: "Online Booking", href: "/features/appointments" },
      { label: "POS & Billing", href: "/features/billing" },
    ],
  },
  "staff-management": {
    translationKey: "staff-management",
    title: "Staff OS & Payroll",
    subtitle: "Attendance, roster, commission and payroll records with owner policy controls",
    heroDescription: "From attendance to commissions, manage your entire team from one dashboard. Aura handles shift scheduling, biometric check-ins, performance tracking, commission calculations, and payroll preparation \u2014 so you can focus on growing your team.",
    icon: "user-check",
    gradient: "from-aura-success to-electric-blue",
    painPoints: [
      "Manual attendance tracking with buddy-punching and time theft",
      "Commission disputes due to unclear attribution rules",
      "Hours spent on payroll calculations every month with spreadsheets",
    ],
    solutions: [
      "Biometric & face-recognition attendance with geo-fencing",
      "Transparent commission rules visible to staff with auto-calculation",
      "One-click payroll preparation with attendance, commissions & deductions",
    ],
    capabilities: [
      { title: "Attendance Controls", description: "Face, biometric and manual records; secure Staff App attendance is Android-only when policy enables it." },
      { title: "Commission Rules", description: "Set attribution rules for services, products and memberships with permission-gated staff views." },
      { title: "Payroll Records", description: "Bring attendance, commission, deductions and payroll exports into one review flow." },
      { title: "Performance Context", description: "Review targets, contribution and permitted performance measures without inventing coaching claims." },
      { title: "Shift Planning", description: "Create weekly rosters, manage swaps, and ensure optimal coverage across time slots." },
      { title: "Staff App Access", description: "Stylists view their schedule, earnings, and targets from the dedicated mobile app." },
    ],
    stats: [
      { value: "90%", label: "Time saved" },
      { value: "Zero", label: "Disputes" },
      { value: "Smart", label: "Scheduling" },
    ],
    impactMetrics: [
      { value: "90%", label: "Time Saved", description: "Automated payroll prep replaces hours of manual spreadsheet work." },
      { value: "Zero", label: "Disputes", description: "Transparent commission rules and real-time earnings visibility." },
      { value: "Smart", label: "Scheduling", description: "Optimal staff coverage based on historical booking patterns." },
    ],
    relatedFeatures: [
      { label: "Online Booking", href: "/features/appointments" },
      { label: "POS & Billing", href: "/features/billing" },
      { label: "Finance Engine", href: "/features/finance" },
    ],
  },
  inventory: {
    translationKey: "inventory",
    title: "Inventory & Recipe Control",
    subtitle: "Track batches, expiry, service usage and reorder context without relying on guesswork",
    heroDescription: "Never run out of color tubes or overstock products again. Aura tracks every SKU with batch-level detail, auto-deducts usage through service recipes, alerts you before stock runs low, and generates purchase orders in one click.",
    icon: "package",
    gradient: "from-aura-amber to-aura-burgundy",
    painPoints: [
      "Running out of key products mid-service because of manual tracking",
      "No visibility into per-service product costs eating into margins",
      "Expired products sitting on shelves with no batch tracking",
    ],
    solutions: [
      "Real-time stock levels with automated low-stock alerts and auto-PO",
      "Recipe-based auto-deduction tracking exact cost per service",
      "Batch-wise FIFO tracking with expiry alerts and wastage analysis",
    ],
    capabilities: [
      { title: "Batch & FIFO Tracking", description: "Batch-wise inventory with first-in-first-out costing, expiry tracking, and wastage analysis." },
      { title: "Reorder Guidance", description: "Review historical usage, lead time, seasonality and upcoming booking context before ordering." },
      { title: "Supplier Management", description: "Keep vendor profiles, purchase bills and procurement records together." },
      { title: "Service Recipes", description: "Link products to services for automatic consumption tracking and cost analysis per service." },
      { title: "Purchase Orders", description: "Generate POs from reorder suggestions, track deliveries, and match against invoices." },
      { title: "Multi-Branch Stock", description: "View and transfer inventory across locations with inter-branch stock requests." },
    ],
    stats: [
      { value: "30%", label: "Less waste" },
      { value: "Auto", label: "Deductions" },
      { value: "1-Click", label: "Reorders" },
    ],
    impactMetrics: [
      { value: "30%", label: "Less Waste", description: "Batch tracking and expiry alerts prevent product wastage." },
      { value: "Auto", label: "Deductions", description: "Service recipes auto-deduct products used per appointment." },
      { value: "1-Click", label: "Reorders", description: "Smart purchase orders based on usage patterns and lead times." },
    ],
    relatedFeatures: [
      { label: "POS & Billing", href: "/features/billing" },
      { label: "Finance Engine", href: "/features/finance" },
      { label: "Staff Management", href: "/features/staff-management" },
    ],
  },
  "marketing-ai": {
    translationKey: "marketing-ai",
    title: "Marketing AI & Automation",
    subtitle: "Plan birthday, follow-up and re-engagement campaigns with clear rules and templates",
    heroDescription: "Turn one-time visitors into lifelong clients with automated marketing that works while you sleep. Set up birthday campaigns, no-show follow-ups, winback journeys, and festival offers \u2014 all delivered through WhatsApp, SMS, and email.",
    icon: "megaphone",
    gradient: "from-aura-burgundy to-aura-rose",
    painPoints: [
      "Inactive clients slipping away with no follow-up system in place",
      "Generic blast messages that feel impersonal and get ignored",
      "Hours spent manually sending birthday wishes and promotional reminders",
    ],
    solutions: [
      "Automated trigger-based journeys for birthdays, follow-ups & winbacks",
      "Personalized messages using client name, service history & preferences",
      "Set-and-forget campaigns that run 24/7 across WhatsApp, SMS & email",
    ],
    capabilities: [
      { title: "Birthday & Festival Campaigns", description: "Use templates and rules for birthday messages, festival campaigns and seasonal offers." },
      { title: "WhatsApp Workflows", description: "Prepare booking confirmations, reminders, follow-ups and payment reminders for WhatsApp." },
      { title: "Lead Management", description: "Track enquiries and planned follow-up from first contact to conversion." },
      { title: "Content Assistance", description: "Draft captions and campaign copy through a configured provider, with local fallback where available." },
      { title: "WhatsApp 2-Way Chat", description: "Clients reply to automated messages, and your team responds \u2014 all tracked in Aura." },
      { title: "AI Content Assist", description: "Draft campaign copy, captions, and offers with AI-powered content suggestions." },
    ],
    stats: [
      { value: "45%", label: "Client return" },
      { value: "2-Way", label: "WhatsApp" },
      { value: "10x", label: "Campaign ROI" },
    ],
    impactMetrics: [
      { value: "45%", label: "Client Return Rate", description: "Automated winback campaigns bring dormant clients back." },
      { value: "2-Way", label: "WhatsApp", description: "Real conversations, not just broadcast \u2014 clients can reply and book." },
      { value: "10x", label: "ROI", description: "Targeted campaigns outperform generic blasts by 10x on engagement." },
    ],
    relatedFeatures: [
      { label: "Client CRM", href: "/features/client-crm" },
      { label: "Online Booking", href: "/features/appointments" },
      { label: "Staff Management", href: "/features/staff-management" },
    ],
  },
  finance: {
    translationKey: "finance",
    title: "Finance Engine",
    subtitle: "Daily closing, ledger context and profitability review for the owner",
    heroDescription: "See your salon\u2019s financial health at a glance. Aura handles daily closing, double-entry bookkeeping, profit intelligence, GST reports, and balance sheets \u2014 giving owners the clarity they need to make smart decisions.",
    icon: "trending-up",
    gradient: "from-aura-amber to-aura-burgundy",
    painPoints: [
      "No visibility into true profitability after accounting for all costs",
      "Manual end-of-day reconciliation taking hours with cash discrepancies",
      "Scattered financial data across Tally, spreadsheets, and POS systems",
    ],
    solutions: [
      "Real-time profit intelligence with cost centers and margin analysis",
      "Automated daily closing with cash drawer reconciliation and Z-reports",
      "Full double-entry ledger with auto-grouped accounts and balance sheet",
    ],
    capabilities: [
      { title: "Daily Closing", description: "Review cash drawer, expenses, payments and variance at the end of the day." },
      { title: "Balance Sheet & Ledger", description: "Full double-entry bookkeeping with journal entries, auto-grouped ledger, and balance sheet." },
      { title: "Profit Intelligence", description: "Formula-based margin, cost-centre and profitability context for owner review." },
      { title: "GST & Tax Reports", description: "Prepare GST calculation and reporting data with TDS tracking; filing stays outside this claim." },
      { title: "Cost Center Analysis", description: "Break down profitability by service, staff member, product line, or branch." },
      { title: "Tally Integration", description: "Sync journal entries and ledger data with Tally for your CA\u2019s review." },
    ],
    stats: [
      { value: "Real-time", label: "P&L visibility" },
      { value: "Auto", label: "Reconciliation" },
      { value: "100%", label: "Audit ready" },
    ],
    impactMetrics: [
      { value: "Real-time", label: "P&L Visibility", description: "Know your salon\u2019s profitability at any moment, not just month-end." },
      { value: "Auto", label: "Reconciliation", description: "Daily closing with zero manual calculation or cash counting errors." },
      { value: "100%", label: "Audit Ready", description: "Complete journal entries, ledger, and balance sheet for compliance." },
    ],
    relatedFeatures: [
      { label: "POS & Billing", href: "/features/billing" },
      { label: "Inventory Control", href: "/features/inventory" },
      { label: "Compliance", href: "/features/compliance" },
    ],
  },
  compliance: {
    translationKey: "compliance",
    title: "Statutory Compliance",
    subtitle: "Calculation, records and reminders for PF, ESI, TDS and professional tax workflows",
    heroDescription: "Stay compliant without the headache. Aura automates PF, ESI, TDS, and professional tax calculations \u2014 with reminders for due dates and ready-to-file reports that your CA will love.",
    icon: "shield-check",
    gradient: "from-deep-navy to-aura-burgundy",
    painPoints: [
      "Missing compliance deadlines leading to penalties and interest charges",
      "Manual PF/ESI calculations prone to errors across employee categories",
      "No centralized view of compliance status across all statutory requirements",
    ],
    solutions: [
      "Automated compliance calendar with due date reminders and alerts",
      "Auto-calculated PF, ESI, TDS deductions integrated with payroll",
      "Centralized compliance dashboard with filing-ready reports",
    ],
    capabilities: [
      { title: "PF & ESI Records", description: "Support calculation, deduction and payroll records for owner or professional review." },
      { title: "TDS Section 192", description: "Support salary TDS computation, declarations, proofs and Form 16 workflow records." },
      { title: "Professional Tax", description: "Keep state-based professional tax calculation and deduction context." },
      { title: "Compliance Calendar", description: "Track due dates, reminders and review status in one place." },
      { title: "Form 16 Workflow", description: "Generate salary TDS computation, collect declarations, and prepare Form 16 data." },
      { title: "State PT Rules", description: "Auto-apply professional tax slabs based on employee state and salary brackets." },
    ],
    stats: [
      { value: "Zero", label: "Penalties" },
      { value: "Auto", label: "Calculations" },
      { value: "Ready", label: "CA reports" },
    ],
    impactMetrics: [
      { value: "Zero", label: "Penalties", description: "Never miss a compliance deadline with automated reminders." },
      { value: "Auto", label: "Calculations", description: "PF, ESI, TDS computed automatically from payroll data." },
      { value: "Ready", label: "CA Reports", description: "Filing-ready reports that save your CA hours of preparation." },
    ],
    relatedFeatures: [
      { label: "Staff Management", href: "/features/staff-management" },
      { label: "Finance Engine", href: "/features/finance" },
      { label: "POS & Billing", href: "/features/billing" },
    ],
  },
  "white-label": {
    translationKey: "white-label",
    title: "White Label SaaS",
    subtitle: "Your brand, your domain, your rules \u2014 run Aura under your own identity",
    heroDescription: "Launch your own branded salon management platform. Aura\u2019s white-label infrastructure lets you run the entire system under your brand \u2014 your logo, your domain, your mobile app \u2014 while we handle the technology.",
    icon: "palette",
    gradient: "from-aura-burgundy to-aura-rose",
    painPoints: [
      "Your salon brand gets diluted by third-party software branding everywhere",
      "No control over the booking experience clients see when they visit",
      "Paying for generic software that doesn\u2019t reflect your premium positioning",
    ],
    solutions: [
      "Complete brand customization \u2014 logo, colors, fonts, domain",
      "White-labeled client booking portal on your own domain",
      "Multi-tenant architecture with full data isolation per location",
    ],
    capabilities: [
      { title: "Custom Branding", description: "Your logo, colors, fonts, and brand identity throughout the entire platform." },
      { title: "Custom Domain", description: "Run your salon portal on your own domain \u2014 e.g., booking.yoursalon.com." },
      { title: "Multi-Tenant Architecture", description: "Complete data isolation between tenants with shared infrastructure efficiency." },
      { title: "Multi-Location Identity", description: "Keep approved branding and location context consistent across authorised branches." },
      { title: "Custom Mobile App", description: "Branded mobile app for clients with your logo, colors, and app store listing." },
      { title: "API Access", description: "Full API access for custom integrations with your existing systems." },
    ],
    stats: [
      { value: "100%", label: "Your brand" },
      { value: "Custom", label: "Domain" },
      { value: "Isolated", label: "Data" },
    ],
    impactMetrics: [
      { value: "100%", label: "Your Brand", description: "Clients see only your brand \u2014 no \u2018Powered by\u2019 watermarks." },
      { value: "Custom", label: "Domain", description: "Run your booking portal on booking.yoursalon.com." },
      { value: "Isolated", label: "Data", description: "Complete data separation between tenants for security." },
    ],
    relatedFeatures: [
      { label: "Online Booking", href: "/features/appointments" },
      { label: "Client CRM", href: "/features/client-crm" },
      { label: "Marketing AI", href: "/features/marketing-ai" },
    ],
  },
};

/* ===== INTEGRATIONS ===== */
export const INTEGRATIONS = [
  { name: "WhatsApp Business", description: "Automated messaging" },
  { name: "Razorpay", description: "Payment processing" },
  { name: "Google Reviews", description: "Reputation management" },
  { name: "Tally", description: "Accounting sync" },
  { name: "SMS Gateway", description: "Bulk messaging" },
  { name: "Thermal Printers", description: "Invoice printing" },
];

/* ===== FOOTER LINKS ===== */
export const FOOTER_LINKS = {
  product: [
    { label: "Platform", href: "/platform" },
    { label: "Owner CRM", href: "/owner-crm" },
    { label: "Customer App", href: "/customer-app" },
    { label: "Staff App", href: "/staff-app" },
    { label: "Workflows", href: "/workflows" },
    { label: "Pricing", href: "/pricing" },
  ],
  company: [
    { label: "About Us", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
    { label: "Careers", href: "/about" },
  ],
  resources: [
    { label: "FAQ", href: "/faq" },
    { label: "Documentation", href: "/blog" },
    { label: "Help Center", href: "/contact" },
    { label: "Status Page", href: "/contact" },
    { label: "API Reference", href: "/features" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
  ],
};
