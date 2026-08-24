import type { ComponentType } from "react";
import {
  Activity,
  Award,
  Building2,
  Crown,
  Flower2,
  Gem,
  HeartHandshake,
  Home,
  Leaf,
  Palette,
  Scissors,
  Sparkles,
  Stethoscope,
  Store,
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
];

export function getSegmentContent(slug: string): SegmentContent | undefined {
  return SEGMENT_CONTENT.find((item) => item.slug === slug);
}
