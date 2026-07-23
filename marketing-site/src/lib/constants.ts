import type { NavLink, Feature, PricingTier, Testimonial, BlogPost, FeaturePageData } from "./types";

/* ===== NAVIGATION ===== */
export const NAV_LINKS: NavLink[] = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Customers", href: "/customers" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
];

export const CTA_LINKS = {
  login: "http://localhost:4300/home",
  trial: "http://localhost:4300/saas",
  demo: "http://localhost:4300/book",
};

/* ===== FEATURES ===== */
export const FEATURES: Feature[] = [
  {
    icon: "calendar",
    title: "Smart Booking",
    description: "AI-powered slot recommendations, online booking portal, waitlist management, and QR check-ins.",
    href: "/features/appointments",
    color: "#7C3AED",
  },
  {
    icon: "credit-card",
    title: "POS & Billing",
    description: "GST-ready invoicing, split payments (UPI/card/cash/wallet), thermal printing, and daily closing.",
    href: "/features/billing",
    color: "#E879A8",
  },
  {
    icon: "users",
    title: "Customer 360",
    description: "Complete client profiles, purchase history, loyalty, wallet, WhatsApp history, and AI insights.",
    href: "/features/client-crm",
    color: "#3B82F6",
  },
  {
    icon: "user-check",
    title: "Staff OS",
    description: "Attendance (face/biometric), shift scheduling, commissions, payroll, and performance dashboards.",
    href: "/features/staff-management",
    color: "#10B981",
  },
  {
    icon: "package",
    title: "Inventory Brain",
    description: "Batch tracking, FIFO, expiry alerts, AI reorder suggestions, supplier management, and waste analysis.",
    href: "/features/inventory",
    color: "#F59E0B",
  },
  {
    icon: "megaphone",
    title: "AI Marketing",
    description: "Automated birthday campaigns, WhatsApp sequences, SMS blasts, lead management, and growth tracking.",
    href: "/features/marketing-ai",
    color: "#EF4444",
  },
  {
    icon: "trending-up",
    title: "Finance Engine",
    description: "Daily closing, cash drawer, expenses, balance sheet, profit intelligence, and GST reports.",
    href: "/features/finance",
    color: "#C87D4B",
  },
  {
    icon: "shield-check",
    title: "Compliance",
    description: "PF, ESI, TDS, professional tax, gratuity, bonus — all automated with payroll integration.",
    href: "/features/compliance",
    color: "#8B5CF6",
  },
];

export const FEATURES_OVERVIEW: Feature[] = [
  ...FEATURES,
  {
    icon: "palette",
    title: "White Label",
    description: "Custom branding, domain, logo for multi-location salon chains and franchises.",
    href: "/features/white-label",
    color: "#EC4899",
  },
];

/* ===== LANDING PAGE STATS ===== */
export const STATS = [
  { value: 10000, suffix: "+", label: "Appointments Booked" },
  { value: 500, suffix: "+", label: "Salons Trust Aura" },
  { value: 50, suffix: "Cr+", prefix: "₹", label: "Transactions Processed" },
  { value: 99.9, suffix: "%", label: "Uptime Guarantee" },
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
    description: "Bring your existing clients, services, and staff data with our AI-powered migration tool.",
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
    cta: "Start Free Trial",
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
      "AI Marketing Automation",
      "Finance Engine",
      "Customer 360 Intelligence",
      "Discount Rules (Happy Hours)",
      "Priority Support",
      "API Access",
    ],
    highlighted: true,
    cta: "Start Free Trial",
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
    question: "Is there a free trial?",
    answer: "Yes! Every plan comes with a 14-day free trial. No credit card required. You get full access to all features in your chosen plan.",
  },
  {
    question: "Can I switch plans later?",
    answer: "Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the difference.",
  },
  {
    question: "How does multi-branch pricing work?",
    answer: "Starter plan is for single branches. Growth plan supports up to 5 branches. Enterprise plan has unlimited branches with custom pricing.",
  },
  {
    question: "Do you offer annual discounts?",
    answer: "Yes! Annual billing saves you 20% compared to monthly billing. That's 2 months free every year.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept UPI, credit/debit cards, net banking, and bank transfers. All payments are processed through Razorpay with bank-grade security.",
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We use enterprise-grade encryption, regular backups, and SOC 2 compliant infrastructure. Your data is always yours.",
  },
];

/* ===== TESTIMONIALS ===== */
export const TESTIMONIALS: Testimonial[] = [
  {
    quote: "Aura transformed how we run our salon. We went from managing everything on paper to having a complete digital system in just one week. Our revenue increased by 40% in the first quarter.",
    name: "Priya Sharma",
    role: "Owner",
    salon: "Glow Studio",
    city: "Mumbai",
    rating: 5,
  },
  {
    quote: "The staff management module is a game-changer. Attendance tracking, payroll, commissions — everything automated. We save 15 hours every week on admin tasks.",
    name: "Rahul Mehta",
    role: "Director",
    salon: "The Style Lounge",
    city: "Delhi",
    rating: 5,
  },
  {
    quote: "Customer 360 is incredible. I know every client's history, preferences, and spending patterns. The AI recommendations help us upsell naturally without being pushy.",
    name: "Anjali Kapoor",
    role: "Manager",
    salon: "Bloom Beauty Bar",
    city: "Bangalore",
    rating: 5,
  },
  {
    quote: "We switched from Fresha to Aura and never looked back. The Indian GST billing, UPI payments, and WhatsApp integration make it perfect for Indian salons.",
    name: "Vikram Singh",
    role: "Owner",
    salon: "Royal Men's Grooming",
    city: "Jaipur",
    rating: 5,
  },
  {
    quote: "The marketing automation alone pays for the subscription. Birthday campaigns, follow-up messages, and re-engagement — all running on autopilot.",
    name: "Meera Nair",
    role: "Owner",
    salon: "Serenity Spa",
    city: "Kochi",
    rating: 5,
  },
  {
    quote: "Managing 12 branches was chaos before Aura. Now I have a single dashboard with real-time data from every location. The multi-branch analytics are phenomenal.",
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
    excerpt: "Learn how to create automated birthday campaigns, re-engagement sequences, and WhatsApp marketing funnels that work 24/7.",
    date: "2025-06-20",
    readTime: "9 min read",
    category: "Marketing",
  },
  {
    slug: "salon-inventory-management",
    title: "Stop Losing Money on Inventory: A Salon Owner's Guide",
    excerpt: "Discover how AI-powered inventory management can reduce waste by 60% and prevent stockouts that cost you revenue.",
    date: "2025-06-15",
    readTime: "7 min read",
    category: "Operations",
  },
];

/* ===== FEATURE PAGES DATA ===== */
export const FEATURE_PAGES: Record<string, FeaturePageData> = {
  appointments: {
    title: "Smart Booking & Appointments",
    subtitle: "AI-powered scheduling that fills every slot and keeps clients coming back",
    icon: "calendar",
    gradient: "from-violet-500 to-purple-600",
    capabilities: [
      { title: "Enterprise Calendar", description: "Day, week, and month views with drag-drop rescheduling, walk-ins, and multi-staff views." },
      { title: "Online Booking Portal", description: "Fresha-style public booking page with service selection, staff preferences, and instant confirmation." },
      { title: "AI Slot Recommendation", description: "Smart algorithm recommends optimal time slots based on staff availability, client history, and salon capacity." },
      { title: "Waitlist & QR Check-in", description: "Automatic waitlist management when slots are full. QR code check-in for walk-in clients." },
    ],
    stats: [
      { value: "40%", label: "Fewer No-Shows" },
      { value: "2x", label: "Faster Booking" },
      { value: "95%", label: "Slot Utilization" },
    ],
  },
  billing: {
    title: "POS & Billing",
    subtitle: "GST-ready invoicing with split payments, thermal printing, and real-time analytics",
    icon: "credit-card",
    gradient: "from-pink-500 to-rose-600",
    capabilities: [
      { title: "GST-Ready Invoicing", description: "Automatic GST calculation, HSN/SAC codes, and compliant invoice generation with thermal printer support." },
      { title: "Split Payments", description: "Accept UPI, cards, cash, wallet, and gift card payments in any combination on a single invoice." },
      { title: "Daily Closing & Z-Report", description: "Automated end-of-day reconciliation with cash drawer management and variance tracking." },
      { title: "Invoice Management", description: "Hold, void, refund, and track every invoice with complete audit trails and event history." },
    ],
    stats: [
      { value: "₹50Cr+", label: "Processed Monthly" },
      { value: "100%", label: "GST Compliant" },
      { value: "30s", label: "Average Checkout" },
    ],
  },
  "client-crm": {
    title: "Customer 360 Intelligence",
    subtitle: "Know every client's story — from first visit to lifetime value",
    icon: "users",
    gradient: "from-blue-500 to-cyan-600",
    capabilities: [
      { title: "Complete Client Profiles", description: "Visit history, purchase patterns, preferences, notes, tags, consent forms, and WhatsApp communication." },
      { title: "Lifetime Value Tracking", description: "AI-calculated LTV, churn risk scores, and next-best-action recommendations for every client." },
      { title: "Loyalty & Wallet", description: "Points-based loyalty programs, digital wallet, credit notes, and store credits." },
      { title: "Client Memory Graph", description: "AI-powered client intelligence that remembers preferences, allergies, and product reactions." },
    ],
    stats: [
      { value: "35%", label: "Higher Retention" },
      { value: "2.5x", label: "Repeat Visits" },
      { value: "45%", label: "Upsell Success" },
    ],
  },
  "staff-management": {
    title: "Staff OS",
    subtitle: "Complete workforce management — from attendance to payroll in one click",
    icon: "user-check",
    gradient: "from-emerald-500 to-teal-600",
    capabilities: [
      { title: "Smart Attendance", description: "Face recognition, biometric, and manual attendance with GPS verification for mobile staff." },
      { title: "Commission Engine", description: "Flexible commission rules per service, product, and membership with real-time tracking." },
      { title: "Payroll & Compliance", description: "Automated salary calculation, PF/ESI deductions, and payroll export." },
      { title: "Performance Dashboard", description: "Staff productivity scores, revenue rankings, leaderboard, and AI coaching insights." },
    ],
    stats: [
      { value: "15hrs", label: "Saved Weekly" },
      { value: "98%", label: "Attendance Accuracy" },
      { value: "100%", label: "Payroll Compliance" },
    ],
  },
  inventory: {
    title: "Inventory Brain",
    subtitle: "Never run out of stock, never waste a product — AI-powered inventory intelligence",
    icon: "package",
    gradient: "from-amber-500 to-orange-600",
    capabilities: [
      { title: "Batch & FIFO Tracking", description: "Batch-wise inventory with first-in-first-out costing, expiry tracking, and wastage analysis." },
      { title: "AI Reorder Autopilot", description: "Machine learning predicts stock needs based on historical usage, seasonality, and upcoming bookings." },
      { title: "Supplier Management", description: "Vendor profiles, purchase bill entry, AI draft generation, and procurement tracking." },
      { title: "Service Recipes", description: "Link products to services for automatic consumption tracking and cost analysis per service." },
    ],
    stats: [
      { value: "60%", label: "Less Waste" },
      { value: "Zero", label: "Stockouts" },
      { value: "25%", label: "Cost Savings" },
    ],
  },
  "marketing-ai": {
    title: "AI Marketing Automation",
    subtitle: "Automated campaigns that work 24/7 while you focus on your clients",
    icon: "megaphone",
    gradient: "from-red-500 to-pink-600",
    capabilities: [
      { title: "Birthday & Festival Campaigns", description: "Automated birthday wishes with special offers, festival campaigns, and seasonal promotions." },
      { title: "WhatsApp Automation", description: "Booking confirmations, reminders, follow-ups, and payment reminders via WhatsApp." },
      { title: "Lead Management", description: "Track leads from inquiry to conversion with automated follow-up sequences." },
      { title: "AI Content Generator", description: "Generate marketing captions, offer copy, and campaign content with AI assistance." },
    ],
    stats: [
      { value: "3x", label: "Client Engagement" },
      { value: "80%", label: "Follow-up Rate" },
      { value: "50%", label: "More Referrals" },
    ],
  },
  finance: {
    title: "Finance Engine",
    subtitle: "Crystal-clear financial intelligence — from daily closing to profit tracking",
    icon: "trending-up",
    gradient: "from-orange-500 to-amber-600",
    capabilities: [
      { title: "Daily Closing", description: "Automated end-of-day reconciliation with cash drawer, expenses, and variance analysis." },
      { title: "Balance Sheet & Ledger", description: "Full double-entry bookkeeping with journal entries, auto-grouped ledger, and balance sheet." },
      { title: "Profit Intelligence", description: "AI-powered profit analysis with cost centers, margins, and actionable recommendations." },
      { title: "GST & Tax Reports", description: "Automated GST calculation, GSTR-1/3B reports, and TDS tracking." },
    ],
    stats: [
      { value: "100%", label: "Financial Accuracy" },
      { value: "Real-time", label: "Cash Flow View" },
      { value: "Zero", label: "Manual Errors" },
    ],
  },
  compliance: {
    title: "Statutory Compliance",
    subtitle: "PF, ESI, TDS, professional tax — all automated so you never miss a deadline",
    icon: "shield-check",
    gradient: "from-indigo-500 to-violet-600",
    capabilities: [
      { title: "PF & ESI Management", description: "Automatic Provident Fund and ESI calculation, deduction, and return filing." },
      { title: "TDS Section 192", description: "Salary TDS computation, tax declaration, proof verification, and Form 16 generation." },
      { title: "Professional Tax", description: "State-wise professional tax calculation and deduction automation." },
      { title: "Compliance Calendar", description: "Never miss a deadline with automated reminders and compliance dashboard." },
    ],
    stats: [
      { value: "100%", label: "Compliance Rate" },
      { value: "Zero", label: "Penalties" },
      { value: "Auto", label: "Filing & Returns" },
    ],
  },
  "white-label": {
    title: "White Label SaaS",
    subtitle: "Your brand, your domain, your rules — run Aura under your own identity",
    icon: "palette",
    gradient: "from-fuchsia-500 to-pink-600",
    capabilities: [
      { title: "Custom Branding", description: "Your logo, colors, fonts, and brand identity throughout the entire platform." },
      { title: "Custom Domain", description: "Run your salon portal on your own domain — e.g., booking.yoursalon.com." },
      { title: "Multi-Tenant Architecture", description: "Complete data isolation between tenants with shared infrastructure efficiency." },
      { title: "Franchise Management", description: "Manage franchise operations, royalty tracking, and brand consistency across locations." },
    ],
    stats: [
      { value: "100%", label: "Your Brand" },
      { value: "Custom", label: "Domain & Logo" },
      { value: "Unlimited", label: "Tenants" },
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
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Customers", href: "/customers" },
    { label: "Booking Portal", href: "http://localhost:4300/book" },
    { label: "Admin Dashboard", href: "http://localhost:4300/home" },
  ],
  company: [
    { label: "About Us", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
    { label: "Careers", href: "/about" },
  ],
  resources: [
    { label: "Documentation", href: "#" },
    { label: "API Reference", href: "#" },
    { label: "Help Center", href: "#" },
    { label: "Status Page", href: "#" },
  ],
  legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Cookie Policy", href: "#" },
  ],
};
