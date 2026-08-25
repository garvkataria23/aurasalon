import type { ComponentType } from "react";
import {
  Activity,
  Award,
  Baby,
  Brush,
  Building2,
  Car,
  Crown,
  Dog,
  Droplet,
  Eye,
  Feather,
  Flame,
  Flower2,
  Gem,
  GraduationCap,
  HeartHandshake,
  Home,
  Hotel,
  Leaf,
  Palette,
  Scale,
  Scissors,
  Smile,
  Sparkles,
  Stethoscope,
  Store,
  Sun,
  Waves,
  Wind,
  Zap,
} from "lucide-react";

export type SegmentIcon = ComponentType<{ className?: string }>;

export interface SegmentStat {
  value: string;
  label: string;
}

export interface SegmentChallenge {
  title: string;
  problem: string;
  fix: string;
}

export interface SegmentFaq {
  question: string;
  answer: string;
}

export interface SegmentContent {
  slug: string;
  icon: SegmentIcon;
  tagline: string;
  intro: string;
  stats: SegmentStat[];
  challenges: SegmentChallenge[];
  outcomes: string[];
  faqs: SegmentFaq[];
}

const SHARED_FAQ_TAIL = (name: string): SegmentFaq => ({
  question: `How fast can we move our ${name.toLowerCase()} onto Aura?`,
  answer:
    "Most teams import clients and services, run parallel for a few days and switch fully within a week. Onboarding checklists inside the product guide each step.",
});

export const SEGMENT_CONTENT: SegmentContent[] = [
  {
    slug: "spa-software",
    icon: Flower2,
    tagline: "Calm front desk. Fully booked therapy rooms.",
    intro:
      "Aura gives spas and wellness studios online booking, prepaid package tracking, therapist-wise rosters and GST-ready billing in one calm workflow.",
    stats: [
      { value: "24×7", label: "Online bookings" },
      { value: "-38%", label: "No-shows with reminders" },
      { value: "+22%", label: "Package renewals" },
      { value: "<60s", label: "Checkout time" },
    ],
    challenges: [
      {
        title: "Therapy slots double-booked",
        problem: "Rooms, therapists and machines are booked on paper and clash at peak hours.",
        fix: "Resource-aware appointment calendar blocks room, therapist and equipment together.",
      },
      {
        title: "Packages tracked in registers",
        problem: "Prepaid session balances live in notebooks, so redemptions get disputed.",
        fix: "Every package sale deducts sessions automatically at billing with a client-visible balance.",
      },
      {
        title: "Silent clients disappear",
        problem: "Guests who enjoyed a therapy never return because nobody follows up.",
        fix: "Auto win-back lists flag guests 45+ days after their last visit for WhatsApp rebooking.",
      },
    ],
    outcomes: [
      "Therapy-wise online booking with duration buffers",
      "Session balance visible on every bill",
      "Therapist commission auto-calculated per visit",
      "Owner dashboard with revenue per therapy category",
    ],
    faqs: [
      {
        question: "Can Aura handle couple therapies and longer spa durations?",
        answer:
          "Yes. Services support custom durations, buffer times and multi-therapist allocation so couple or extended sessions block resources correctly.",
      },
      {
        question: "Does it track prepaid packages across branches?",
        answer:
          "Packages are stored against the client profile and can be configured single-centre or redeemable across your locations.",
      },
      SHARED_FAQ_TAIL("Spa"),
    ],
  },
  {
    slug: "bridal-salon-software",
    icon: Crown,
    tagline: "Every wedding booking planned to the minute.",
    intro:
      "Aura helps bridal makeup and premium styling teams manage consultations, trial sessions, artist assignments and large-value invoices without spreadsheets.",
    stats: [
      { value: "1 screen", label: "For trials to wedding day" },
      { value: "0", label: "Artist double-bookings" },
      { value: "100%", label: "Advance tracked before date" },
      { value: "+31%", label: "Add-on service uptake" },
    ],
    challenges: [
      {
        title: "Wedding dates clash",
        problem: "Peak-season dates get promised twice because enquiries sit in WhatsApp chats.",
        fix: "Date-hold and advance-payment flow blocks the artist team the moment a token is received.",
      },
      {
        title: "Trials disconnected from the final look",
        problem: "Trial notes, references and approved looks are scattered across phones.",
        fix: "Client 360 keeps consultation notes, trial photos references and preferences on one profile.",
      },
      {
        title: "Big invoices, messy payments",
        problem: "Package pricing, add-ons and advances make manual bills error-prone.",
        fix: "Quotation-to-invoice flow with advance adjustments produces GST-ready bills in one click.",
      },
    ],
    outcomes: [
      "Date-hold with advance tracking per booking",
      "Artist-wise assignment and payout view",
      "Trial-to-final look history on client profile",
      "GST invoice with package and add-on breakdown",
    ],
    faqs: [
      {
        question: "Can we hold a date before full payment?",
        answer:
          "Yes. Configure token or advance amounts that convert a soft hold into a confirmed booking automatically once received.",
      },
      {
        question: "How does artist payout work for weddings?",
        answer:
          "Assign multiple artists per booking; commissions are computed per service and artist, visible in payroll reports.",
      },
      SHARED_FAQ_TAIL("Bridal studio"),
    ],
  },
  {
    slug: "salon-chain-software",
    icon: Building2,
    tagline: "One brain. Every branch under control.",
    intro:
      "Aura gives multi-branch salon chains central pricing, cross-branch client profiles, stock transfers between outlets and consolidated owner reporting.",
    stats: [
      { value: "All", label: "Branches on one dashboard" },
      { value: "Live", label: "Cross-branch client history" },
      { value: "-27%", label: "Inter-branch stock loss" },
      { value: "1 login", label: "For owner across outlets" },
    ],
    challenges: [
      {
        title: "Every branch runs differently",
        problem: "Prices, discounts and service menus drift apart across locations.",
        fix: "Central catalogue controls services, pricing and offer rules with branch-level overrides you approve.",
      },
      {
        title: "Clients repeat themselves",
        problem: "A regular at one branch is a stranger at another, hurting trust.",
        fix: "Shared client CRM means history, packages and preferences travel with the client anywhere.",
      },
      {
        title: "Consolidated numbers arrive late",
        problem: "Owners stitch together weekly Excel sheets to understand performance.",
        fix: "Consolidated dashboards show revenue, staff and stock by branch, updated as bills happen.",
      },
    ],
    outcomes: [
      "Branch-wise and consolidated P&L-style views",
      "Stock transfer and indent workflow between outlets",
      "Role-based access for owners, managers and staff",
      "Client packages valid across the chain",
    ],
    faqs: [
      {
        question: "Can branches have local offers?",
        answer:
          "Yes. Headquarters defines the base catalogue while approved branch-level overrides handle local pricing and promotions.",
      },
      {
        question: "How are inter-branch transfers tracked?",
        answer:
          "Each transfer has an issue and receive record, keeping branch-level stock and valuation accurate end to end.",
      },
      SHARED_FAQ_TAIL("Chain"),
    ],
  },
  {
    slug: "barber-shop-software",
    icon: Scissors,
    tagline: "Walk-ins managed. Chairs always moving.",
    intro:
      "Aura keeps barber shops and men's grooming studios running with quick POS billing, walk-in queue management and staff-wise performance tracking.",
    stats: [
      { value: "30s", label: "Per-cut billing" },
      { value: "Queue", label: "Visible to waiting clients" },
      { value: "-35%", label: "Idle chair time" },
      { value: "+18%", label: "Membership renewals" },
    ],
    challenges: [
      {
        title: "Walk-in rush chaos",
        problem: "Peak evenings turn into shouting matches over who is next.",
        fix: "Digital queue assigns tokens, shows wait status and notifies clients when their turn nears.",
      },
      {
        title: "Memberships on paper cards",
        problem: "Punch cards get lost and loyalty value leaks away.",
        fix: "Digital memberships track cuts remaining or wallet balance right inside the client profile.",
      },
      {
        title: "Barber performance unknown",
        problem: "Owners cannot tell which barber drives repeat clients and revenue.",
        fix: "Staff dashboards rank cuts, rebooks and revenue per barber for fair incentives.",
      },
    ],
    outcomes: [
      "One-tap billing for high-volume cuts",
      "Barber check-in and commission tracking",
      "Membership and wallet sales at POS",
      "Daily cash-up report per chair",
    ],
    faqs: [
      {
        question: "Does it work for appointment-only and walk-in mixed flow?",
        answer:
          "Yes. Online appointments and walk-in queue entries share the same chair calendar, so both stay accurate.",
      },
      {
        question: "Can barbers be paid per service or per day?",
        answer:
          "Configure salary, per-service commission or hybrid structures; reports compute payouts automatically.",
      },
      SHARED_FAQ_TAIL("Barber shop"),
    ],
  },
  {
    slug: "hair-salon-software",
    icon: Zap,
    tagline: "Stylists booked. Colour stock exact. Clients returning.",
    intro:
      "Aura helps hair salons and styling studios connect stylist calendars, colour-service recipes, rebooking nudges and retail sales into one growth loop.",
    stats: [
      { value: "+26%", label: "Rebooking rate" },
      { value: "Recipe", label: "Based colour usage" },
      { value: "-40%", label: "Colour wastage" },
      { value: "5-star", label: "Review requests automated" },
    ],
    challenges: [
      {
        title: "Rebooking left to memory",
        problem: "Clients mean to rebook at checkout but leave without a date.",
        fix: "Billing triggers a rebook nudge suggesting the ideal next visit based on the service done.",
      },
      {
        title: "Colour stock guesswork",
        problem: "Tube usage is eyeballed, so orders run short mid-week.",
        fix: "Service recipes deduct exact product quantities per head, keeping reorder points accurate.",
      },
      {
        title: "Stylist books unevenly",
        problem: "Some stylists are overloaded while chairs sit empty.",
        fix: "Load-balanced calendar views highlight gaps so the desk can fill them proactively.",
      },
    ],
    outcomes: [
      "Stylist-wise online booking with service mapping",
      "Formula and preference notes on every client",
      "Retail product suggestions linked at billing",
      "Gap-filling offers for empty slots",
    ],
    faqs: [
      {
        question: "Can clients choose their stylist online?",
        answer:
          "Yes. Publish stylist-level availability so regulars book their preferred stylist while new clients get balanced options.",
      },
      {
        question: "How do service recipes help inventory?",
        answer:
          "Define quantity per service once; every billing event deducts stock automatically, giving true consumption data.",
      },
      SHARED_FAQ_TAIL("Hair salon"),
    ],
  },
  {
    slug: "beauty-salon-software",
    icon: Sparkles,
    tagline: "Facials, waxing, parlour services — perfectly scheduled.",
    intro:
      "Aura helps beauty salons and parlours manage high-frequency services, staff rosters, package selling and daily cash discipline in one simple system.",
    stats: [
      { value: "2 min", label: "To learn daily workflow" },
      { value: "+24%", label: "Package conversions" },
      { value: "Daily", label: "Cash reconciliation" },
      { value: "-29%", label: "Appointment no-shows" },
    ],
    challenges: [
      {
        title: "Parlour-day rush at the desk",
        problem: "Festive days overwhelm manual registers and billing slips.",
        fix: "Fast POS with service presets and split payments keeps queues moving on peak days.",
      },
      {
        title: "Packages sold but not tracked",
        problem: "Discounted bundles lose money when redemption is not monitored.",
        fix: "Package builder prices bundles correctly and tracks every session redeemed.",
      },
      {
        title: "Staff rosters on WhatsApp",
        problem: "Leave changes cause gaps nobody notices until clients arrive.",
        fix: "Roster view maps staff availability against bookings and flags understaffed hours.",
      },
    ],
    outcomes: [
      "Quick service presets for high-volume menus",
      "Package builder with margin protection",
      "Roster-linked appointment capacity",
      "End-of-day cash and UPI summary",
    ],
    faqs: [
      {
        question: "Is Aura easy for non-tech-savvy parlour staff?",
        answer:
          "Yes. The billing screen uses large service tiles and guided flows designed for first-time computer users.",
      },
      {
        question: "Can we sell and track combo packages?",
        answer:
          "Build combos from existing services, set bundle pricing and let the system track sessions used per client.",
      },
      SHARED_FAQ_TAIL("Beauty salon"),
    ],
  },
  {
    slug: "bridal-makeup-studio-software",
    icon: Gem,
    tagline: "Premium studio. Premium client experience.",
    intro:
      "Aura supports bridal makeup studios with enquiry pipelines, artist scheduling, kit planning and elegant quotations that close high-ticket bookings faster.",
    stats: [
      { value: "Pipeline", label: "Enquiry to wedding stage" },
      { value: "2×", label: "Faster quote turnaround" },
      { value: "0", label: "Missed trial appointments" },
      { value: "100%", label: "Advance visibility" },
    ],
    challenges: [
      {
        title: "Enquiries lost in DMs",
        problem: "Instagram and WhatsApp enquiries wait hours for a reply and go cold.",
        fix: "Enquiry pipeline stages with reminders ensure every lead gets a same-day response.",
      },
      {
        title: "Quotes take days",
        problem: "Manual quotations delay decisions during peak season.",
        fix: "Templated quotation builder generates branded quotes from packages in minutes.",
      },
      {
        title: "Kit and artist prep ad hoc",
        problem: "Wedding-morning surprises happen when kits are not checked.",
        fix: "Booking checklists cover kit prep, trial sign-offs and artist call times.",
      },
    ],
    outcomes: [
      "Lead pipeline with follow-up reminders",
      "Branded quotations with e-confirmation",
      "Trial, rehearsal and wedding-day timeline",
      "Advance and balance payment schedule",
    ],
    faqs: [
      {
        question: "Can we track leads from Instagram and WhatsApp together?",
        answer:
          "Yes. Log enquiries from any source into one pipeline so nothing slips during peak season.",
      },
      {
        question: "Do quotations support packages and custom looks?",
        answer:
          "Create package-based quotes and adjust line items per bride; confirmations update the booking automatically.",
      },
      SHARED_FAQ_TAIL("Makeup studio"),
    ],
  },
  {
    slug: "nail-salon-software",
    icon: Palette,
    tagline: "Nail art menus, artists and refills — organised.",
    intro:
      "Aura helps nail salons and nail art studios manage detailed service menus, refill cycles, artist skills and retail care products in one stylish system.",
    stats: [
      { value: "+21%", label: "Refill rebookings" },
      { value: "Skill", label: "Matched appointments" },
      { value: "-32%", label: "Product overstock" },
      { value: "Photo", label: "Look history per client" },
    ],
    challenges: [
      {
        title: "Complex art menu pricing",
        problem: "Lengths, shapes and art levels make manual pricing inconsistent.",
        fix: "Variant-based services price length, shape and art level combinations consistently.",
      },
      {
        title: "Refills forgotten",
        problem: "Clients return late for refills or not at all.",
        fix: "Refill-cycle reminders reach clients at the right interval after every full set.",
      },
      {
        title: "Only some artists do advanced art",
        problem: "Bookings land with wrong artists and disappoint clients.",
        fix: "Skill tags restrict advanced services to certified artists during booking.",
      },
    ],
    outcomes: [
      "Variant pricing for sets, refills and art",
      "Refill-cycle reminder automation",
      "Artist skill-based assignment",
      "Retail care-product sales at checkout",
    ],
    faqs: [
      {
        question: "Can we price by nail length and art complexity?",
        answer:
          "Yes. Build variants so every combination of length, shape and art level has a fixed, transparent price.",
      },
      {
        question: "How do refill reminders work?",
        answer:
          "Set a default refill window; Aura messages clients when their set is due and offers direct rebooking.",
      },
      SHARED_FAQ_TAIL("Nail salon"),
    ],
  },
  {
    slug: "skin-clinic-software",
    icon: Stethoscope,
    tagline: "Clinical discipline meets salon comfort.",
    intro:
      "Aura helps skin clinics and aesthetic studios manage consultations, treatment courses, consent workflows and session-wise billing with clinical clarity.",
    stats: [
      { value: "Course", label: "Sessions auto-tracked" },
      { value: "Before", label: "After photo timeline" },
      { value: "0", label: "Missed follow-ups" },
      { value: "+19%", label: "Course completions" },
    ],
    challenges: [
      {
        title: "Treatment courses lose count",
        problem: "Six-session plans get miscounted across paper files.",
        fix: "Course builder schedules sessions, tracks completion and prompts renewals at the right time.",
      },
      {
        title: "Consultation notes scattered",
        problem: "Skin assessments live in separate files from billing records.",
        fix: "Client 360 links consultation notes, photos and protocols to every visit and invoice.",
      },
      {
        title: "Follow-ups rely on memory",
        problem: "Missed review calls stall treatment results and revenue.",
        fix: "Protocol-driven follow-up tasks appear for the desk exactly when reviews are due.",
      },
    ],
    outcomes: [
      "Session-course packages with expiry control",
      "Consultation and protocol documentation",
      "Follow-up task list for the front desk",
      "Practitioner-wise schedule and revenue",
    ],
    faqs: [
      {
        question: "Can we document consultations inside Aura?",
        answer:
          "Yes. Structured notes, concerns and recommended protocols attach to the client timeline alongside visits.",
      },
      {
        question: "How are multi-session courses billed?",
        answer:
          "Sell a course upfront or per session; balances and expiries are tracked automatically either way.",
      },
      SHARED_FAQ_TAIL("Skin clinic"),
    ],
  },
  {
    slug: "wellness-center-software",
    icon: Leaf,
    tagline: "Yoga, therapy and wellness programs in rhythm.",
    intro:
      "Aura helps wellness centers manage memberships, class and therapy calendars, trainer rosters and renewals so programs run on schedule and members stay engaged.",
    stats: [
      { value: "+23%", label: "Membership renewals" },
      { value: "Class", label: "Capacity control" },
      { value: "-30%", label: "Admin hours weekly" },
      { value: "Live", label: "Attendance insights" },
    ],
    challenges: [
      {
        title: "Memberships expire silently",
        problem: "Members keep attending after expiry or drop off without renewal nudge.",
        fix: "Expiry tracking with automatic renewal reminders keeps memberships continuous.",
      },
      {
        title: "Class capacity guesswork",
        problem: "Popular classes overflow while others run half-empty.",
        fix: "Capacity-managed booking shows real-time seats and suggests alternate slots when full.",
      },
      {
        title: "Trainer payments debated",
        problem: "Session counts for trainers are disputed month-end.",
        fix: "Attendance-linked logs compute trainer sessions and payouts transparently.",
      },
    ],
    outcomes: [
      "Membership plans with freeze and expiry rules",
      "Class and therapy calendar with capacity",
      "Trainer roster and payout reports",
      "Member engagement and churn signals",
    ],
    faqs: [
      {
        question: "Can members book classes themselves?",
        answer:
          "Yes. Share a booking link where members pick classes within their active plan and capacity limits.",
      },
      {
        question: "Does it support membership freezes?",
        answer:
          "Configure freeze policies with maximum days; expiry dates extend automatically during approved freezes.",
      },
      SHARED_FAQ_TAIL("Wellness center"),
    ],
  },
  {
    slug: "medspa-software",
    icon: Activity,
    tagline: "Aesthetic treatments with medical-grade tracking.",
    intro:
      "Aura supports medspas and aesthetic clinics with injector scheduling, treatment consents, lot tracking and high-value client journeys in one compliant-feeling workflow.",
    stats: [
      { value: "Lot", label: "Batch-tracked consumables" },
      { value: "+28%", label: "Treatment plan upgrades" },
      { value: "Consent", label: "Recorded per visit" },
      { value: "-25%", label: "Schedule gaps" },
    ],
    challenges: [
      {
        title: "Injector calendars conflict",
        problem: "Treatment rooms and injectors are booked separately, causing clashes.",
        fix: "Combined resource booking blocks injector, room and device in one action.",
      },
      {
        title: "Consumable lots untraceable",
        problem: "Batch numbers matter for aesthetics but are written nowhere.",
        fix: "Batch and expiry tracking records the lot used on every treatment visit.",
      },
      {
        title: "High-value clients go quiet",
        problem: "Treatment plans stall between sessions without structured follow-up.",
        fix: "Plan-progress tracking nudges clients at ideal intervals for their next session.",
      },
    ],
    outcomes: [
      "Injector and device-aware scheduling",
      "Batch/expiry traceability at billing",
      "Treatment plan progress timeline",
      "High-ticket package instalment options",
    ],
    faqs: [
      {
        question: "Can Aura record which batch was used on a client?",
        answer:
          "Yes. Billing can capture batch numbers from tracked inventory, building a full treatment audit trail.",
      },
      {
        question: "Does it handle multi-session aesthetic plans?",
        answer:
          "Build plans with staged sessions, pricing and reminders so progress and revenue stay on track.",
      },
      SHARED_FAQ_TAIL("Medspa"),
    ],
  },
  {
    slug: "franchise-salon-software",
    icon: Store,
    tagline: "Franchise consistency without micromanaging.",
    intro:
      "Aura helps franchise salon owners enforce brand standards, compare outlet performance, control royalties and keep every franchisee on the same playbook.",
    stats: [
      { value: "Same", label: "Menu & pricing everywhere" },
      { value: "Royalty", label: "Computed automatically" },
      { value: "Benchmark", label: "Outlet comparisons" },
      { value: "Audit", label: "Ready operations logs" },
    ],
    challenges: [
      {
        title: "Franchisees improvise menus",
        problem: "Off-brand services and pricing damage the brand promise.",
        fix: "Locked central catalogue with approval-gated overrides keeps menus consistent.",
      },
      {
        title: "Royalty math arguments",
        problem: "Monthly royalty calculations are disputed over spreadsheet versions.",
        fix: "Royalty rules compute from actual billing data with transparent statements.",
      },
      {
        title: "Best practices don't spread",
        problem: "What works in one outlet never reaches the others.",
        fix: "Benchmark reports surface top-performing outlets and the workflows behind them.",
      },
    ],
    outcomes: [
      "Central brand catalogue enforcement",
      "Automated royalty statements",
      "Outlet-vs-outlet benchmark dashboards",
      "Standard onboarding playbooks per outlet",
    ],
    faqs: [
      {
        question: "How is royalty calculated?",
        answer:
          "Define percentage or slab rules per agreement; statements generate from real billing automatically.",
      },
      {
        question: "Can franchisees see each other's data?",
        answer:
          "No. Role-based access lets owners see everything while each franchisee sees only their own outlet.",
      },
      SHARED_FAQ_TAIL("Franchise"),
    ],
  },
  {
    slug: "home-salon-business-software",
    icon: Home,
    tagline: "Big-salon systems for a home-salon budget.",
    intro:
      "Aura gives home salon businesses online booking, digital payments tracking, client memory and simple daily reports without needing a receptionist.",
    stats: [
      { value: "24×7", label: "Bookings via link" },
      { value: "1 person", label: "Runs the whole system" },
      { value: "+34%", label: "Repeat visit rate" },
      { value: "Zero", label: "Missed payment records" },
    ],
    challenges: [
      {
        title: "DMs replace a front desk",
        problem: "Bookings scatter across chats and get forgotten.",
        fix: "A shareable booking link fills your calendar even while you are with a client.",
      },
      {
        title: "Payments hard to reconcile",
        problem: "Cash, UPI and app payments blur together by month-end.",
        fix: "Every appointment records its payment mode, giving clean day-end totals.",
      },
      {
        title: "No time for marketing",
        problem: "Between clients there is zero bandwidth for follow-ups.",
        fix: "Automated birthday, rebooking and win-back messages run without your involvement.",
      },
    ],
    outcomes: [
      "Instagram-bio-ready booking link",
      "Payment-mode wise daily summary",
      "Client preference notes for personalised service",
      "One-screen view of today's plan",
    ],
    faqs: [
      {
        question: "Is Aura too heavy for a one-person salon?",
        answer:
          "No. Home salons typically use booking link, billing and reminders — all designed for solo operation.",
      },
      {
        question: "Can clients pay online when booking?",
        answer:
          "Yes. Configure advance or full prepayment on your booking link to secure appointments.",
      },
      SHARED_FAQ_TAIL("Home salon"),
    ],
  },
  {
    slug: "unisex-salon-software",
    icon: HeartHandshake,
    tagline: "Hair, beauty and grooming — one happy counter.",
    intro:
      "Aura helps unisex salons run diverse service menus, mixed stylist teams and family client accounts smoothly from a single counter.",
    stats: [
      { value: "Family", label: "Accounts with shared wallet" },
      { value: "Mixed", label: "Menus handled simply" },
      { value: "+17%", label: "Cross-service trials" },
      { value: "Fair", label: "Transparent commissions" },
    ],
    challenges: [
      {
        title: "Two worlds, one desk",
        problem: "Hair and beauty sides maintain separate registers that never match.",
        fix: "Category-tagged services unify reporting while keeping departmental views separate.",
      },
      {
        title: "Family spends invisible",
        problem: "Husband-wife-kid visits are tracked as strangers.",
        fix: "Family linking shows combined spend and shares packages across members.",
      },
      {
        title: "Commission disputes",
        problem: "Assists and cross-department work complicate payouts.",
        fix: "Split-commission rules credit assisting stylists fairly and automatically.",
      },
    ],
    outcomes: [
      "Unified menu with departmental filters",
      "Linked family accounts and wallets",
      "Split commissions for assists",
      "Gender/service mix analytics",
    ],
    faqs: [
      {
        question: "Can one bill cover hair and beauty services together?",
        answer:
          "Yes. Mixed carts bill in one invoice while reports still break down by department.",
      },
      {
        question: "How does family account sharing work?",
        answer:
          "Link member profiles to a family group; wallets and packages can be shared per your policy.",
      },
      SHARED_FAQ_TAIL("Unisex salon"),
    ],
  },
  {
    slug: "luxury-salon-software",
    icon: Award,
    tagline: "White-glove service, backed by perfect data.",
    intro:
      "Aura helps premium and luxury salons deliver concierge-level experiences with preference-led service, discreet VIP handling and flawless billing polish.",
    stats: [
      { value: "VIP", label: "Recognition at check-in" },
      { value: "100%", label: "Preference recall" },
      { value: "+42%", label: "Retail attachment" },
      { value: "Invite", label: "Only private events" },
    ],
    challenges: [
      {
        title: "VIPs explain themselves twice",
        problem: "High-value clients repeat preferences that should be remembered.",
        fix: "Rich client profiles surface formula, style, allergies and rituals before they speak.",
      },
      {
        title: "Discounting erodes prestige",
        problem: "Ad-hoc discounts undermine premium positioning.",
        fix: "Value-first gestures — upgrades, gifts, priority slots — replace blanket discounting.",
      },
      {
        title: "Quiet luxury needs quiet ops",
        problem: "Front-desk friction is visible to discerning clients.",
        fix: "Streamlined check-in, discreet billing flows and pre-scheduled follow-ups remove friction.",
      },
    ],
    outcomes: [
      "Preference-rich client dossiers",
      "Priority booking windows for tiers",
      "Complimentary-gesture tracking instead of discounts",
      "Concierge-style follow-up sequences",
    ],
    faqs: [
      {
        question: "Can we tier our clients and treat them differently?",
        answer:
          "Yes. Client tiers unlock priority slots, gestures and communication cadences per level.",
      },
      {
        question: "Does Aura support complimentary services cleanly?",
        answer:
          "Log gestures as zero-value or courtesy items so hospitality stays generous yet fully accounted.",
      },
      SHARED_FAQ_TAIL("Luxury salon"),
    ],
  },
  {
    slug: "tattoo-studio-software",
    icon: Flame,
    tagline: "Digital consent forms. Artist chair splits. Hourly billing.",
    intro:
      "Run your tattoo studio and piercing parlour with paperless digital consent forms, artist percentage splits, custom deposit collection, and needle & ink inventory tracking.",
    stats: [
      { value: "100%", label: "Digital waiver capture" },
      { value: "0", label: "Commission dispute" },
      { value: "Auto", label: "Deposit link on WhatsApp" },
      { value: "Hourly", label: "Session rate tracker" },
    ],
    challenges: [
      {
        title: "Paper liability waivers get lost",
        problem: "Physical consent and medical disclosure forms create storage hassle and legal liability risks.",
        fix: "Digital client consent forms signed on tablets and linked permanently to the client profile.",
      },
      {
        title: "Complex guest artist revenue splits",
        problem: "Calculating 60/40 or 70/30 artist commission splits minus supply fees takes hours at month-end.",
        fix: "Real-time artist attribution ledger with automatic chair rental and disposable deduction.",
      },
      {
        title: "High no-show losses on multi-hour slots",
        problem: "A client missing a 4-hour custom sleeve booking kills half a day's revenue.",
        fix: "Integrated non-refundable advance deposits and 2-way WhatsApp appointment confirmations.",
      },
    ],
    outcomes: [
      "Tablet-based digital waiver and medical history signing",
      "Per-artist portfolio gallery and hourly rate billing",
      "Ink, needle cartridge and hygiene supply batch tracking",
      "Automated aftercare instruction broadcasts on WhatsApp",
    ],
    faqs: [
      {
        question: "Can clients sign consent forms on their own phone or salon tablet?",
        answer:
          "Yes. Aura supports in-studio digital signatures on iPads/tablets or pre-visit links sent via WhatsApp.",
      },
      {
        question: "Does Aura handle booth rent and guest artist commission tiers?",
        answer:
          "Yes. Set custom fixed chair-rent or percentage splits per resident and visiting tattoo artist.",
      },
      SHARED_FAQ_TAIL("Tattoo studio"),
    ],
  },
  {
    slug: "pet-grooming-software",
    icon: Dog,
    tagline: "Breed-specific slots. Vaccination alerts. Pet profiles.",
    intro:
      "The complete operating system for pet salons, dog grooming spas, and mobile groomers. Track breed temperaments, coat care notes, medical history, and express grooming check-ins.",
    stats: [
      { value: "100%", label: "Breed & weight context" },
      { value: "-70%", label: "Check-in time" },
      { value: "Auto", label: "Vaccination due reminders" },
      { value: "0%", label: "Booking overlap" },
    ],
    challenges: [
      {
        title: "Breed-specific time differences",
        problem: "A Husky deshedding takes 3x longer than a Pug bath, breaking generic salon calendars.",
        fix: "Smart duration rules configured by pet breed, size, weight, and coat condition.",
      },
      {
        title: "Missing vaccination records and bite risks",
        problem: "Groomers unaware of expired rabies shots or aggressive temperaments face safety risks.",
        fix: "Pet health passbook with mandatory vaccination upload and prominent handling flags.",
      },
      {
        title: "Pet parents missing regular grooming cycles",
        problem: "Dogs needing 4-week nail trimming and bath cycles drop off without reminders.",
        fix: "Automated recurring grooming recall messages sent via WhatsApp 25 days after last bath.",
      },
    ],
    outcomes: [
      "Pet profiles with breed, coat type, allergies and vet details",
      "Dynamic pricing based on pet size (Small, Medium, Large, Giant)",
      "Shampoo, flea treatment and spa product batch tracking",
      "Ready-to-use vaccination expiry and recurring visit alerts",
    ],
    faqs: [
      {
        question: "Can pet parents add multiple pets under one customer account?",
        answer:
          "Yes. Single parent profiles can hold multiple dogs, cats, and pets with distinct breed profiles.",
      },
      {
        question: "Does Aura support mobile grooming vans and home grooming routes?",
        answer:
          "Yes. Manage appointment zones, travel buffers, and mobile POS checkouts seamlessly.",
      },
      SHARED_FAQ_TAIL("Pet grooming salon"),
    ],
  },
  {
    slug: "hair-clinic-software",
    icon: Stethoscope,
    tagline: "Multi-session packages. Trichology notes. Scalp photo logs.",
    intro:
      "Built for hair clinics, trichology studios, and hair transplant centers. Manage doctor/technician rosters, PRP & mesotherapy packages, clinical before/after photos, and follow-up sequences.",
    stats: [
      { value: "100%", label: "Session package tracking" },
      { value: "HD", label: "Clinical photo timeline" },
      { value: "Auto", label: "Post-care WhatsApp nudges" },
      { value: "Clean", label: "Doctor & therapist splits" },
    ],
    challenges: [
      {
        title: "Tracking 6-month multi-visit treatment packages",
        problem: "Clients forget remaining PRP or laser sessions, leading to billing disputes.",
        fix: "Digital treatment passbooks with session balance redemption and expiry tracking.",
      },
      {
        title: "Scattered scalp assessment photos and notes",
        problem: "Progress photos saved on personal doctor phones get lost between visits.",
        fix: "Encrypted before/after photo timeline stored directly in the patient's CRM file.",
      },
      {
        title: "Coordinating clinical staff and therapy suites",
        problem: "Trichologist consultations, technician suites, and laser equipment get double-booked.",
        fix: "Unified equipment and provider resource scheduling that blocks both doctor and room.",
      },
    ],
    outcomes: [
      "Clinical session redemption and advance treatment payment ledger",
      "Trichology consultation checklists and scalp microscope logs",
      "GST-compliant pharmacy and clinical consumable invoicing",
      "Automated clinical follow-up protocols via WhatsApp",
    ],
    faqs: [
      {
        question: "Can we track both clinical consultations and retail hair care sales?",
        answer:
          "Yes. Bill medical consultation fees, procedure packages, and retail hair serums on one invoice.",
      },
      {
        question: "Is patient medical history kept private from regular salon staff?",
        answer:
          "Yes. Role-based permissions ensure clinical dossiers are only accessible to authorized trichologists.",
      },
      SHARED_FAQ_TAIL("Hair clinic"),
    ],
  },
  {
    slug: "ayurvedic-spa-software",
    icon: Leaf,
    tagline: "Panchakarma treatment plans. Herbal oil stock. Room suites.",
    intro:
      "Designed for Ayurvedic wellness centers, Panchakarma resorts, and holistic healing spas. Manage multi-day therapy regimes, Doshic consultation notes, specialized therapist assignments, and herbal dispensary batches.",
    stats: [
      { value: "7-21d", label: "Multi-day therapy plans" },
      { value: "Batch", label: "Herbal oil stock ledger" },
      { value: "100%", label: "Therapy room allocation" },
      { value: "Clean", label: "Diet & lifestyle follow-ups" },
    ],
    challenges: [
      {
        title: "Complex 7 to 21-day Panchakarma package scheduling",
        problem: "Scheduling Abhyanga, Shirodhara, and Swedana over consecutive days creates calendar bottlenecks.",
        fix: "Multi-day treatment blueprinting that auto-reserves treatment suites, therapists, and herbal baths.",
      },
      {
        title: "Herbal oil and kashayam dispensary leakage",
        problem: "Unmeasured use of expensive medicated oils (Mahanarayana, Ksheerabala) drains profit margins.",
        fix: "Milliliter-level herbal recipe deduction linked directly to the client's therapy voucher.",
      },
      {
        title: "Vaidya consultation notes disconnected from therapy floor",
        problem: "Therapists miss doctor-specified pressure points, oil temperatures, and contraindications.",
        fix: "Digital Vaidya prescription summary automatically pushed to the assigned therapist's tablet.",
      },
    ],
    outcomes: [
      "Sequential multi-day Panchakarma package management",
      "Vaidya consultation dossiers with Prakriti/Vikriti recording",
      "Herbal dispensary and raw formulation batch expiry tracking",
      "Therapy suite and steam chamber resource allocation",
    ],
    faqs: [
      {
        question: "Can we bill multi-day wellness retreats with accommodation and therapies?",
        answer:
          "Yes. Aura handles bundled wellness retreat packages, individual daily treatments, and retail ayurvedic medicines.",
      },
      {
        question: "Does the system support male/female therapist gender preferences for treatments?",
        answer:
          "Yes. Configure therapist gender allocation rules strictly based on traditional Ayurvedic protocols.",
      },
      SHARED_FAQ_TAIL("Ayurvedic spa"),
    ],
  },
  {
    slug: "booth-renter-software",
    icon: Gem,
    tagline: "Private client lists. Chair rent tracking. Independent payouts.",
    intro:
      "The perfect solution for booth rental salons, chair leasing studios, and salon suites. Give independent stylists their own private booking link, client notes, and payouts while owners manage chair lease rents effortlessly.",
    stats: [
      { value: "100%", label: "Private client privacy" },
      { value: "Auto", label: "Weekly chair rent billing" },
      { value: "0", label: "Data leak between renters" },
      { value: "Direct", label: "UPI & card payouts" },
    ],
    challenges: [
      {
        title: "Stylists worried about salon owners taking their clients",
        problem: "Independent renters leave when owners have unrestricted access to their private client phone numbers.",
        fix: "Multi-tenant permission walls keeping renter client lists 100% private to the specific stylist.",
      },
      {
        title: "Chasing weekly and monthly chair rent payments",
        problem: "Manual rent collection leads to awkward disputes, delayed payments, and messy accounting.",
        fix: "Automated recurring chair lease invoicing with instant UPI payment links and auto-receipts.",
      },
      {
        title: "Split card payments and retail commission mess",
        problem: "Clients paying at reception create complicated reconciliation for who gets paid what.",
        fix: "Direct stylist payout routing or automated net settlement minus rent and product usage fees.",
      },
    ],
    outcomes: [
      "Separate stylist profiles with private client CRM and schedules",
      "Automated chair rental invoices and digital payment logging",
      "Independent stylist online booking links and portfolios",
      "Owner revenue overview for chair occupancy and facility margins",
    ],
    faqs: [
      {
        question: "Can booth renters access their own appointments without seeing other stylists?",
        answer:
          "Yes. Booth renters have restricted logins showing only their personal bookings, revenue, and clients.",
      },
      {
        question: "Can the salon owner collect fixed weekly rent plus a percentage of retail sales?",
        answer:
          "Yes. Combine flat chair-rent terms with dynamic retail commission cuts on salon-supplied products.",
      },
      SHARED_FAQ_TAIL("Booth rental salon"),
    ],
  },
  {
    slug: "salon-academy-software",
    icon: GraduationCap,
    tagline: "Student batch rosters. Salon practice floor. Tuition fee ledger.",
    intro:
      "Engineered for hair and makeup academies that run active student training clinics alongside commercial salons. Track student course batches, attendance, kit inventory, and training-floor client practice appointments.",
    stats: [
      { value: "100%", label: "Fee installment tracking" },
      { value: "Batch", label: "Student roster schedule" },
      { value: "Live", label: "Practice chair allocation" },
      { value: "Zero", label: "Kit consumable leakage" },
    ],
    challenges: [
      {
        title: "Tracking course fee installments and student dues",
        problem: "Manual registers for 3-installment course payments result in delayed collections and confusion.",
        fix: "Automated student tuition fee ledger with milestone receipts, due date alerts, and GST invoices.",
      },
      {
        title: "Managing model and client practice appointments",
        problem: "Practice floor bookings clash with commercial senior stylist clients.",
        fix: "Separate Academy Floor and Commercial Salon station calendars with discounted student service rates.",
      },
      {
        title: "Vanishing training kits and mannequin heads",
        problem: "Expensive cosmetology kits given to students go untracked and vanish from studio storage.",
        fix: "Student kit dispatch logs tied to admission IDs with batch serial tracking.",
      },
    ],
    outcomes: [
      "Student admission, course enrollment and installment fee management",
      "Dedicated Academy Practice Floor appointment and model booking",
      "Student attendance and practical training log verification",
      "Combined Academy + Commercial Salon consolidated financial P&L",
    ],
    faqs: [
      {
        question: "Can we offer discounted practice services to clients booked with senior students?",
        answer:
          "Yes. Set student-tier service pricing with supervisor sign-off requirements before checkout.",
      },
      {
        question: "Can students view their own batch attendance and schedule on their phones?",
        answer:
          "Yes. Students receive dedicated logins to view class rosters, workshop timings, and assigned models.",
      },
      SHARED_FAQ_TAIL("Salon academy"),
    ],
  },
  {
    slug: "lash-brow-studio-software",
    icon: Eye,
    tagline: "Refill cycle reminders. Mapping photo logs. Patch test alerts.",
    intro:
      "Tailored for lash extension artists, microblading clinics, and brow lamination studios. Automate 2-3 week infill recall sequences, track glue batch humidity and patch tests, and showcase high-resolution lash mapping.",
    stats: [
      { value: "2-3w", label: "Infill cycle automation" },
      { value: "100%", label: "Patch test compliance" },
      { value: "HD", label: "Lash mapping archives" },
      { value: "+38%", label: "Client rebooking rate" },
    ],
    challenges: [
      {
        title: "Clients missing 2-3 week lash refill windows",
        problem: "When clients delay infills past 3 weeks, they need a full set, causing schedule delays and disputes.",
        fix: "Automated WhatsApp refill nudges triggered 14 and 18 days post-appointment with 1-click booking.",
      },
      {
        title: "Adhesive allergy reactions and liability",
        problem: "Applying lash adhesive without recorded patch tests creates severe allergic reactions and legal issues.",
        fix: "Mandatory patch-test date tracking with digital waiver signature before first lash application.",
      },
      {
        title: "Remembering lash curl, length and mapping style",
        problem: "Clients want the exact same C-curl 12mm Cat-Eye look but stylists lose hand-written notes.",
        fix: "Visual lash mapping dossier with curl, thickness, length, and adhesive batch logs per eye.",
      },
    ],
    outcomes: [
      "Automated lash refill and brow touch-up retention cycles",
      "Visual lash map and microblading pigment formula records",
      "Mandatory patch-test expiry and client consent compliance",
      "Aftercare cleanser and serum retail upselling at checkout",
    ],
    faqs: [
      {
        question: "Does Aura automate 2-week and 3-week lash refill reminders?",
        answer:
          "Yes. Refill nudges are scheduled automatically the moment a full-set appointment is closed.",
      },
      {
        question: "Can lash technicians save photos of client lash mapping on their phone/tablet?",
        answer:
          "Yes. Capture before, mapping, and after photos directly into the client's beauty dossier.",
      },
      SHARED_FAQ_TAIL("Lash and brow studio"),
    ],
  },
  {
    slug: "blow-dry-bar-software",
    icon: Wind,
    tagline: "High-volume chair turns. Monthly blow-dry memberships. Add-on upselling.",
    intro:
      "Engineered for fast-paced blow dry bars, styling lounges, and express wash bars. Power through 30-minute high-frequency styling slots with express QR walk-in check-in and automated monthly membership billing.",
    stats: [
      { value: "30min", label: "Express chair turnover" },
      { value: "Auto", label: "Monthly membership billing" },
      { value: "+45%", label: "Scalp scrub add-on rate" },
      { value: "3 Clicks", label: "Express check-out" },
    ],
    challenges: [
      {
        title: "Weekend queue chaos and long wait times",
        problem: "Walk-in rushes before parties and weddings overwhelm the front desk.",
        fix: "Express QR walk-in queue tokens with live estimated wait time on lounge screens.",
      },
      {
        title: "Managing recurring blow-dry monthly subscriptions",
        problem: "Tracking 2-blowout or 4-blowout monthly packages manually leads to missed renewals.",
        fix: "Auto-debit recurring membership plans with live session passbooks on client phones.",
      },
      {
        title: "Stylists forgetting to upsell scalp scrubs & hair masks",
        problem: "Low ticket averages when staff don't pitch express conditioning add-ons.",
        fix: "POS prompt nudges for add-on treatments at wash basins with instant stylist incentives.",
      },
    ],
    outcomes: [
      "Rapid 30/45-minute express styling slot booking",
      "Automated monthly blow-dry subscription & club passbook",
      "Live digital walk-in queue management with SMS alerts",
      "Stylist retail serum & heat protectant commission tracking",
    ],
    faqs: [
      {
        question: "Can we sell monthly unlimited or 4-session blow-dry packages?",
        answer:
          "Yes. Create recurring membership tiers that auto-credit sessions on the 1st of every month.",
      },
      {
        question: "How fast is checkout during busy Saturday peak hours?",
        answer:
          "Express checkout takes under 5 seconds with saved UPI QR codes or pre-loaded membership passbooks.",
      },
      SHARED_FAQ_TAIL("Blow dry bar"),
    ],
  },
  {
    slug: "tanning-salon-software",
    icon: Sun,
    tagline: "Booth timer tracking. Solution batch logs. Prep guidelines.",
    intro:
      "The dedicated management platform for spray tanning studios, custom airbrush bronze bars, and sunbed salons. Automate shade formula history, skin tone consultation, and UV bed safety timer limits.",
    stats: [
      { value: "100%", label: "Shade formula recall" },
      { value: "Timer", label: "Booth safety locks" },
      { value: "Auto", label: "Pre-tan prep SMS instructions" },
      { value: "+30%", label: "Exfoliant retail sales" },
    ],
    challenges: [
      {
        title: "Clients showing up improperly prepped",
        problem: "Clients wearing moisturizers or perfume get patchy tans and demand refunds.",
        fix: "Automated 24-hour pre-tan prep instructions sent via WhatsApp with exfoliation rules.",
      },
      {
        title: "Forgetting custom DHA bronze shade formulas",
        problem: "Clients want their exact 'Venetian 12%' holiday glow but staff mix the wrong ratio.",
        fix: "Stored skin undertone profiles with DHA percentage, solution brand, and bronzer drop logs.",
      },
      {
        title: "Tracking tanning booth sanitization cycles",
        problem: "Unscheduled booth cleaning leads to client hygiene complaints.",
        fix: "Automated 10-minute sanitation buffer blocks auto-inserted between booth sessions.",
      },
    ],
    outcomes: [
      "Custom airbrush shade formulation records per client",
      "Automated pre-tan preparation and post-tan care guides",
      "Spray tan solution & disposable sticky feet inventory tracking",
      "Multi-session holiday glow and bridal tan package redemption",
    ],
    faqs: [
      {
        question: "Can we send automated pre-appointment prep guidelines to clients?",
        answer:
          "Yes. WhatsApp broadcasts automatically deliver exfoliation and loose clothing guidelines 24 hours prior.",
      },
      {
        question: "Does Aura support tanning package series (e.g. 5 spray tans for bridal parties)?",
        answer:
          "Yes. Track multi-session bridal packages with shared family or group redemption rules.",
      },
      SHARED_FAQ_TAIL("Tanning salon"),
    ],
  },
  {
    slug: "mobile-beauty-software",
    icon: Car,
    tagline: "Route buffers. Travel fee calculation. On-location booking.",
    intro:
      "Built for freelance makeup artists, mobile hairdressers, and traveling beauty therapists. Plan travel buffers between clients, calculate automated pin-code travel fees, and accept instant UPI payments on location.",
    stats: [
      { value: "GPS", label: "Travel buffer automation" },
      { value: "0%", label: "Double-booking on road" },
      { value: "Mobile", label: "POS billing on phone" },
      { value: "Direct", label: "Instant UPI QR settlement" },
    ],
    challenges: [
      {
        title: "Traffic delays causing chain-reaction late arrivals",
        problem: "Booking back-to-back home visits without travel buffers ruins customer satisfaction.",
        fix: "Smart travel buffer engine that automatically adds 30-45 min commute time between zones.",
      },
      {
        title: "Calculating distance and pin-code travel surcharges",
        problem: "Manually calculating travel costs for out-of-station or distant bookings creates friction.",
        fix: "Zone-based travel fee rules calculated automatically at booking checkout.",
      },
      {
        title: "Lugging bulky hardware for payments on the road",
        problem: "Mobile artists needing card machines face connectivity and battery failures.",
        fix: "Complete mobile app POS that generates dynamic UPI QR codes and WhatsApp invoices on your phone.",
      },
    ],
    outcomes: [
      "Location-aware calendar with automatic driving buffer gaps",
      "Zone and distance-based travel convenience surcharge calculator",
      "Client home address and landmark storage with 1-tap Google Maps launch",
      "Instant on-location mobile billing with digital payment verification",
    ],
    faqs: [
      {
        question: "Does the mobile app work smoothly on smartphones for freelance artists?",
        answer:
          "Yes. Full calendar management, client notes, and instant POS billing run directly on Android and iOS.",
      },
      {
        question: "Can we set minimum booking amounts for home service visits?",
        answer:
          "Yes. Configure minimum cart values and location surcharges per neighborhood or city zone.",
      },
      SHARED_FAQ_TAIL("Mobile beauty business"),
    ],
  },
  {
    slug: "kids-salon-software",
    icon: Baby,
    tagline: "First haircut certificates. Distraction chairs. Parent family profiles.",
    intro:
      "Created specifically for children's hair salons, family grooming studios, and teen nail bars. Track sibling profiles under one parent, generate digital First Haircut Certificates, and manage themed styling stations.",
    stats: [
      { value: "1-Click", label: "Sibling family booking" },
      { value: "Digital", label: "First haircut memory cards" },
      { value: "-50%", label: "Desk chaos during weekends" },
      { value: "Fun", label: "Themed station allocation" },
    ],
    challenges: [
      {
        title: "Booking 2 or 3 siblings simultaneously",
        problem: "Parents get frustrated when they cannot book hair cuts for multiple kids in the same slot.",
        fix: "Family multi-child booking flow that reserves adjacent styling chairs in 1 click.",
      },
      {
        title: "Remembering sensory triggers and favorite cartoons",
        problem: "Stylists unaware of child sensory sensitivities (sound/clippers) cause meltdowns.",
        fix: "Child personality notes highlighting favorite characters, clipper fears, and sensory tips.",
      },
      {
        title: "Creating memorable first haircut milestone keepsakes",
        problem: "Parents expect keepsake certificates and lock-of-hair envelopes for milestone cuts.",
        fix: "Automated digital 'First Haircut Certificate' generated with child's photo and date.",
      },
    ],
    outcomes: [
      "Family tree CRM linking multiple children under parent WhatsApp IDs",
      "Themed station booking (Car chairs, gaming screens, teen bays)",
      "Child milestone logs and photo keepsake generator",
      "Kids gentle organic shampoo & detangler retail tracking",
    ],
    faqs: [
      {
        question: "Can parents book multiple children under one phone number?",
        answer:
          "Yes. Parent accounts can hold unlimited child profiles with unique names, birthdates, and notes.",
      },
      {
        question: "Does Aura support milestone reminders like birthday discounts for kids?",
        answer:
          "Yes. Automated birthday greetings and milestone haircut offers are triggered on WhatsApp.",
      },
      SHARED_FAQ_TAIL("Kids salon"),
    ],
  },
  {
    slug: "cosmetic-dentistry-software",
    icon: Smile,
    tagline: "Smile makeover packages. Before/After shade logs. Consultation waivers.",
    intro:
      "Tailored for cosmetic teeth whitening lounges, smile aesthetics bars, and dental spa clinics. Manage shade guide improvements (e.g. VITA shade A1-D4), treatment series, consent waivers, and clinical product inventory.",
    stats: [
      { value: "VITA", label: "Shade guide scale tracker" },
      { value: "100%", label: "Medical consent logging" },
      { value: "Auto", label: "Sensitivity post-care reminders" },
      { value: "Series", label: "Smile package redemption" },
    ],
    challenges: [
      {
        title: "Proving visible teeth whitening shade improvements",
        problem: "Clients forget their baseline tooth shade and question whitening effectiveness.",
        fix: "Standardized before-and-after VITA shade logging with comparison photos.",
      },
      {
        title: "Gingival barrier and sensitivity consent liability",
        problem: "Bleaching procedures require clear disclosures on enamel sensitivity and restorations.",
        fix: "Digital dental aesthetic consent waivers signed on tablets before treatment begins.",
      },
      {
        title: "Peroxide gel and hygiene kit batch expiry tracking",
        problem: "Expired bleaching gels lose potency, reducing whitening results.",
        fix: "Batch-tracked whitening gel, barrier resin, and disposable tray inventory ledger.",
      },
    ],
    outcomes: [
      "Before & after VITA tooth shade grading and photographic archive",
      "Digital aesthetic consent and tooth sensitivity disclaimer signing",
      "Whitening gel and remineralization paste inventory control",
      "Automated 6-month smile touch-up and maintenance recall broadcasts",
    ],
    faqs: [
      {
        question: "Can we record both pre-treatment and post-treatment tooth shade levels?",
        answer:
          "Yes. Log standardized shade values (e.g., from A3 to B1) and attach high-res smile photos.",
      },
      {
        question: "Does Aura help automate post-whitening diet instructions (White Diet)?",
        answer:
          "Yes. Automated WhatsApp messages deliver 48-hour dietary guidelines (no coffee/red wine) immediately after treatment.",
      },
      SHARED_FAQ_TAIL("Cosmetic smile studio"),
    ],
  },
  {
    slug: "laser-clinic-software",
    icon: Zap,
    tagline: "Fitzpatrick skin typing. Energy joule logs. 6-8 session packages.",
    intro:
      "Designed for laser hair removal clinics, skin aesthetic studios, and IPL treatment centers. Track Fitzpatrick skin types, laser fluence (Joules/cm²), treatment intervals, and multi-session package balances.",
    stats: [
      { value: "Type I-VI", label: "Fitzpatrick skin scale" },
      { value: "J/cm²", label: "Fluence & pulse log" },
      { value: "6-8", label: "Session series tracking" },
      { value: "0", label: "Contraindication oversight" },
    ],
    challenges: [
      {
        title: "Tracking 6 to 8 session treatment packages over 12 months",
        problem: "Clients losing track of remaining full-body or underarm laser sessions causes disputes.",
        fix: "Digital treatment series passbook with remaining session counts and body zone logs.",
      },
      {
        title: "Recording critical laser machine parameters safely",
        problem: "Switching technicians without recording previous Joule fluence or spot size risks skin burns.",
        fix: "Mandatory laser log sheets (Machine, Fluence J/cm², Pulse Width, Cooling) saved per zone.",
      },
      {
        title: "Sun exposure and contraindication safety checks",
        problem: "Treating tanned skin or clients on photosensitive medication leads to adverse events.",
        fix: "Pre-session digital safety checklists and mandatory skin assessment protocols.",
      },
    ],
    outcomes: [
      "Multi-session body area laser package and payment tracking",
      "Comprehensive laser parameter dossier (Joules, Spot Size, Pulses)",
      "Fitzpatrick skin typing and pre-treatment safety waiver integration",
      "Automated 4-6 week interval appointment reminders for optimal hair growth cycles",
    ],
    faqs: [
      {
        question: "Can we track specific body areas (e.g., Full Legs vs Underarms) separately?",
        answer:
          "Yes. Create custom multi-area packages with individual session tracking per body zone.",
      },
      {
        question: "Does the software enforce interval gaps between laser sessions?",
        answer:
          "Yes. Calendar booking rules prevent clients from booking repeat sessions before the 4-6 week biological hair cycle.",
      },
      SHARED_FAQ_TAIL("Laser aesthetics clinic"),
    ],
  },
  {
    slug: "massage-therapy-software",
    icon: Droplet,
    tagline: "Therapist gender preferences. Room turnover buffers. Bodywork charting.",
    intro:
      "Engineered for massage therapy clinics, deep tissue studios, and sports rehabilitation centers. Manage therapist room scheduling, SOAP notes, body pressure intake forms, and prepaid massage memberships.",
    stats: [
      { value: "SOAP", label: "Digital clinical charting" },
      { value: "100%", label: "Therapist preference match" },
      { value: "15min", label: "Sanitization buffer lock" },
      { value: "+40%", label: "Monthly package retention" },
    ],
    challenges: [
      {
        title: "Therapist fatigue and burnout from back-to-back deep tissue sessions",
        problem: "Unregulated scheduling forces therapists through 5 continuous heavy bodywork sessions.",
        fix: "Automated therapist rest gap rules and daily max-hour limits enforced in the booking engine.",
      },
      {
        title: "Paper intake forms missing acute injury contraindications",
        problem: "Therapists unaware of herniated discs or recent surgeries risk injuring clients.",
        fix: "Digital musculoskeletal intake waivers with interactive body diagram pain mapping.",
      },
      {
        title: "Managing recurring massage subscription credits",
        problem: "Tracking monthly 60-min massage credits manually leads to expiration disputes.",
        fix: "Automated monthly recurring membership billing with rollover credit passbooks.",
      },
    ],
    outcomes: [
      "Digital SOAP notes and musculoskeletal body pain mapping",
      "Therapist gender and pressure level (Light/Medium/Deep) matching",
      "Therapy suite, heated table, and shower turnover automation",
      "Prepaid monthly massage membership auto-billing",
    ],
    faqs: [
      {
        question: "Can therapists record SOAP notes privately after each session?",
        answer:
          "Yes. Therapists can document Subjective, Objective, Assessment, and Plan notes securely on their tablet.",
      },
      {
        question: "Does Aura support couples massage room scheduling?",
        answer:
          "Yes. Book tandem dual-therapist couples packages reserving one shared suite simultaneously.",
      },
      SHARED_FAQ_TAIL("Massage therapy clinic"),
    ],
  },
  {
    slug: "permanent-makeup-software",
    icon: Feather,
    tagline: "PMU touch-up cycles. Pigment batch logs. Medical consent waivers.",
    intro:
      "Tailored for permanent makeup artists, microblading studios, lip blush technicians, and powder brow specialists. Track pigment lot numbers, 6-week touch-up recall cycles, and digital medical consent agreements.",
    stats: [
      { value: "6-Week", label: "Touch-up cycle recall" },
      { value: "Lot #", label: "Pigment batch compliance" },
      { value: "100%", label: "Digital waiver signing" },
      { value: "HD", label: "Before/After healing log" },
    ],
    challenges: [
      {
        title: "Clients missing complimentary 6-week PMU touch-ups",
        problem: "Delayed healing touch-ups lead to uneven pigment retention and unhappy clients.",
        fix: "Automated 6-week touch-up scheduling locked in during initial procedure checkout.",
      },
      {
        title: "Pigment brand and needle lot traceability",
        problem: "Unable to recall exact pigment blend (e.g., Warm Brown 3 drops + Yellow 1 drop) during annual color boosts.",
        fix: "Stored PMU pigment mixing recipes, brand lot numbers, and needle configuration archives.",
      },
      {
        title: "Strict contraindication and medical consent compliance",
        problem: "Treating clients on blood thinners, keloid-prone skin, or pregnancy leads to legal risk.",
        fix: "Comprehensive digital PMU consent forms with mandatory medical pre-clearance questions.",
      },
    ],
    outcomes: [
      "Automated initial + 6-week perfecting session paired bookings",
      "Pigment color formula, needle cartridge, and depth logging",
      "Comprehensive digital consent waiver and photo release archive",
      "Annual color boost recall campaigns sent via WhatsApp",
    ],
    faqs: [
      {
        question: "Can we record exact pigment mixing formulas for annual color refreshes?",
        answer:
          "Yes. Store drop ratios, pigment brand shades, and needle configurations in the client's beauty file.",
      },
      {
        question: "Does the system require client consent signatures before appointment check-in?",
        answer:
          "Yes. Send digital pre-procedure consent links via WhatsApp or capture signatures on studio iPads.",
      },
      SHARED_FAQ_TAIL("Permanent makeup studio"),
    ],
  },
  {
    slug: "scalp-micropigmentation-software",
    icon: Scissors,
    tagline: "SMP density multi-sessions. Norwood scale logs. Needle depth records.",
    intro:
      "Designed specifically for scalp micropigmentation (SMP) clinics and hair density specialists. Manage 3-session SMP treatment plans, Norwood scale hair loss records, follicle needle gauges, and payment milestones.",
    stats: [
      { value: "3-Session", label: "Treatment series plan" },
      { value: "Norwood", label: "Scale staging tracker" },
      { value: "Milestone", label: "Split fee payments" },
      { value: "100%", label: "Density mapping archive" },
    ],
    challenges: [
      {
        title: "Managing 3 distinct SMP sessions spaced 10 days apart",
        problem: "Clients losing track of Session 1 (Base), Session 2 (Density), and Session 3 (Blending).",
        fix: "Automated 3-stage SMP package scheduling with interval reminders and pigment settling times.",
      },
      {
        title: "Tracking hair loss stages and hairline design photos",
        problem: "Hairline mockup photos and Norwood scale evaluations lost across technician chat apps.",
        fix: "High-resolution hairline design photos and scalp zone density logs stored in the patient file.",
      },
      {
        title: "Managing multi-session installment payment milestones",
        problem: "Collecting split payments across 3 sessions creates revenue leakage and manual tracking chaos.",
        fix: "Milestone-based package invoicing with automated per-session payment collection.",
      },
    ],
    outcomes: [
      "3-Session sequential SMP treatment series management",
      "Norwood/Ludwig scale hair loss evaluation documentation",
      "Follicle needle size, dilution ratio, and impression depth logs",
      "Automated scalp healing and post-care reminder sequences",
    ],
    faqs: [
      {
        question: "Can we set up payment milestones (e.g. 50% on Session 1, 30% on Session 2, 20% on Session 3)?",
        answer:
          "Yes. Configure custom milestone payment schedules linked directly to multi-session packages.",
      },
      {
        question: "Does Aura store hairline design comparison photos securely?",
        answer:
          "Yes. High-resolution before, hairline mapping, and healed result photos are encrypted in the patient profile.",
      },
      SHARED_FAQ_TAIL("Scalp micropigmentation studio"),
    ],
  },
  {
    slug: "float-spa-software",
    icon: Waves,
    tagline: "Float pod filtration cycles. Contrast therapy suites. Infrared saunas.",
    intro:
      "Built for sensory deprivation float centers, infrared sauna lounges, and contrast therapy spas. Automate 15-minute pod filtration buffer cycles, Epsom salt consumption tracking, and multi-amenity suite reservations.",
    stats: [
      { value: "15min", label: "Pod filtration auto-lock" },
      { value: "Multi", label: "Contrast suite scheduling" },
      { value: "Kg", label: "Epsom salt batch stock" },
      { value: "+50%", label: "Membership renewal rate" },
    ],
    challenges: [
      {
        title: "Booking float pods before 100% filtration cycle completion",
        problem: "Clients booked too soon after a float session enter unsterilized pods, causing hygiene violations.",
        fix: "Mandatory 15-20 minute pod UV/H2O2 filtration buffer blocks auto-locked in the calendar.",
      },
      {
        title: "Coordinating multi-service contrast circuits (Float + Sauna + Cold Plunge)",
        problem: "Scheduling a 60-min float followed by a 30-min sauna and cold plunge creates booking clashes.",
        fix: "Circuit booking workflows that automatically sequence consecutive rooms without double-booking.",
      },
      {
        title: "Managing thousands of kilograms of Epsom salt inventory",
        problem: "Unmonitored magnesium sulfate usage leads to sudden salt shortages and pod downtime.",
        fix: "Kilogram-level salt replenishment logs tied to pod water density checks.",
      },
    ],
    outcomes: [
      "Automated float tank filtration and sanitation buffer blocks",
      "Circuit packages (Float + Infrared Sauna + Cold Plunge)",
      "Epsom salt, ear plug, and shower amenity inventory tracking",
      "Monthly float wellness club subscriptions with auto-billing",
    ],
    faqs: [
      {
        question: "Does the calendar automatically account for post-float shower and pod cleaning time?",
        answer:
          "Yes. Configure custom buffer durations (e.g. 20 min) that automatically block out the room between sessions.",
      },
      {
        question: "Can we sell monthly 2-float or 4-float wellness memberships?",
        answer:
          "Yes. Set up recurring membership auto-debits with shareable guest pass perks.",
      },
      SHARED_FAQ_TAIL("Float therapy spa"),
    ],
  },
  {
    slug: "weight-loss-clinic-software",
    icon: Scale,
    tagline: "Body composition logs. Inch-loss packages. Dietician rosters.",
    intro:
      "Engineered for slimming centers, body contouring clinics, and aesthetic weight management studios. Track Body Mass Index (BMI), inch-loss measurement charts, multi-treatment slimming packages, and dietician appointments.",
    stats: [
      { value: "BMI", label: "Body composition charts" },
      { value: "Inch", label: "Circumference logs per zone" },
      { value: "10-20", label: "Session slimming packages" },
      { value: "Diet", label: "Nutritionist consultation CRM" },
    ],
    challenges: [
      {
        title: "Clients questioning inch-loss results without structured data",
        problem: "Inconsistent manual measurement registers lead to client disputes over package guarantees.",
        fix: "Standardized 8-point body circumference logs (Waist, Hips, Thighs, Arms) with progress graph exports.",
      },
      {
        title: "Coordinating slimming machines (Cryolipolysis, Cavitation) with therapists",
        problem: "Therapists available but body contouring machines double-booked.",
        fix: "Equipment-resource scheduling that synchronizes machine, therapy room, and dietician.",
      },
      {
        title: "Tracking 10 to 20 session slimming & detox packages",
        problem: "Disorganized paper cards for 20-session packages lead to lost sessions and missed billing.",
        fix: "Digital session redemption passbooks with real-time remaining session alerts on client phones.",
      },
    ],
    outcomes: [
      "Standardized 8-zone body measurement & inch-loss tracking",
      "Body contouring machine and treatment suite allocation",
      "10/20-session slimming package passbook and advance payment ledger",
      "Automated weekly weigh-in and nutrition check-in WhatsApp reminders",
    ],
    faqs: [
      {
        question: "Can we log body measurements (waist, hips, arms in inches) at every visit?",
        answer:
          "Yes. The client CRM includes dedicated measurement charting with automated visual progress graphs.",
      },
      {
        question: "Does Aura handle combined slimming therapy + dietary supplement packages?",
        answer:
          "Yes. Bundle machine therapy sessions with retail protein and detox supplements on a single invoice.",
      },
      SHARED_FAQ_TAIL("Weight loss clinic"),
    ],
  },
  {
    slug: "nail-art-academy-software",
    icon: Brush,
    tagline: "Nail technician batches. Student practice stations. Gel kit logs.",
    intro:
      "Created for professional nail art academies, acrylic extension training studios, and nail technician institutes. Manage course batches, student practice tables, UV gel kit dispatch, and student model appointments.",
    stats: [
      { value: "Batch", label: "Student class schedules" },
      { value: "Kit", label: "Acrylic & gel product logs" },
      { value: "100%", label: "Installment fee tracking" },
      { value: "Live", label: "Practice table allocation" },
    ],
    challenges: [
      {
        title: "Managing practice table allocation for 20+ students",
        problem: "Student practice models clashing over limited manicure tables and UV lamps.",
        fix: "Dedicated Academy Floor table reservation system with student and model assignments.",
      },
      {
        title: "Tracking expensive acrylic powders, gel polishes & e-files",
        problem: "High-value professional nail kits given to students get misplaced or consumed unmonitored.",
        fix: "Student kit issuance ledger with barcode tracking linked to student enrollment IDs.",
      },
      {
        title: "Collecting certification course fee installments",
        problem: "Students attending advanced 3D nail art modules with pending fee installments.",
        fix: "Automated student fee installment schedules with WhatsApp payment links and receipt generation.",
      },
    ],
    outcomes: [
      "Nail technician certification batch and attendance management",
      "Student practice table and client model scheduling",
      "Nail starter kit and acrylic monomer consumable inventory tracking",
      "Commercial Nail Salon + Academy consolidated revenue accounting",
    ],
    faqs: [
      {
        question: "Can students practice on real clients with supervisor approval before checkout?",
        answer:
          "Yes. Practice services can require digital supervisor sign-off before invoice generation.",
      },
      {
        question: "Does the system track course completion and student practical hours?",
        answer:
          "Yes. Log practical hours, technique assessments (Acrylic, Polygel, 3D Art), and attendance.",
      },
      SHARED_FAQ_TAIL("Nail art academy"),
    ],
  },
  {
    slug: "hotel-resort-spa-software",
    icon: Hotel,
    tagline: "Guest room billing. Concierge booking. Spa facility management.",
    intro:
      "Tailored for luxury hotel spas, 5-star resort wellness pavilions, and boutique destination properties. Post spa invoices directly to guest room folios, empower hotel concierges to book slots, and manage premium hydrotherapy facilities.",
    stats: [
      { value: "Room", label: "Folio charge posting" },
      { value: "Concierge", label: "1-Click guest booking portal" },
      { value: "100%", label: "Facility capacity control" },
      { value: "VIP", label: "Guest preference synchronization" },
    ],
    challenges: [
      {
        title: "Manual room charge voucher reconciliation with front desk PMS",
        problem: "Paper spa chits lost between spa reception and hotel front desk lead to uncollected bills at checkout.",
        fix: "Direct room folio posting integration with guest name and room number verification.",
      },
      {
        title: "Concierge desk unable to see live spa availability",
        problem: "Hotel concierges calling busy spa reception to check open massage slots annoys high-paying guests.",
        fix: "Dedicated Concierge Booking Portal showing real-time therapist and suite availability.",
      },
      {
        title: "Managing day-pass visitors vs. in-house hotel guests",
        problem: "Outside visitors overcrowding hydrotherapy pools and saunas meant for staying resort guests.",
        fix: "Separate in-house guest priority booking rules and outside day-pass capacity limits.",
      },
    ],
    outcomes: [
      "Hotel PMS guest room billing integration and verified charge signatures",
      "Concierge and butler iPad portal for instant in-room spa booking",
      "Multi-facility scheduling (Hydrotherapy, Jacuzzi, Hammam, Private Cabanas)",
      "High-value guest preference profile shared across resort amenities",
    ],
    faqs: [
      {
        question: "Can spa charges be posted directly to the guest's hotel room bill?",
        answer:
          "Yes. Aura supports room folio charge posting with guest signature capture on tablets.",
      },
      {
        question: "Can the hotel concierge book spa treatments directly for VIP guests?",
        answer:
          "Yes. A streamlined Concierge Portal allows front desk and concierge staff to reserve slots instantly.",
      },
      SHARED_FAQ_TAIL("Hotel resort spa"),
    ],
  },
];

export function getSegmentContent(slug: string): SegmentContent | undefined {
  return SEGMENT_CONTENT.find((item) => item.slug === slug);
}


