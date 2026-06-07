import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

const makeId = () => `grb_${randomUUID().slice(0, 10)}`;
const now = () => new Date().toISOString();
const portalToken = () => `portal_${randomUUID().replace(/-/g, "").slice(0, 18)}`;

function clean(value, max = 180) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function slugify(value, fallback = "growth-page") {
  const slug = clean(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function money(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function roiPercent(profit, spend) {
  return spend > 0 ? Math.round((profit / spend) * 1000) / 10 : 0;
}

function parseJson(value, fallback = {}) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function hasUrl(value) {
  return /^https?:\/\/\S+\.\S+/i.test(clean(value, 240));
}

function normalizePayload(payload = {}) {
  const rankKeywords = Array.isArray(payload.rankKeywords)
    ? payload.rankKeywords.map((item) => clean(item, 100)).filter(Boolean).slice(0, 12)
    : clean(payload.rankKeywords || "", 700).split(",").map((item) => clean(item, 100)).filter(Boolean).slice(0, 12);
  return {
    businessName: clean(payload.businessName || payload.clientName || payload.name, 120),
    industry: clean(payload.industry || "Salon & beauty", 80),
    city: clean(payload.city || payload.location, 80),
    targetArea: clean(payload.targetArea || payload.area || payload.city || "", 100),
    branchId: clean(payload.branchId, 80),
    clientEmail: clean(payload.clientEmail || payload.email || "", 140),
    instagramUrl: clean(payload.instagramUrl || payload.instagram || "", 240),
    facebookUrl: clean(payload.facebookUrl || payload.facebook || "", 240),
    googleProfileUrl: clean(payload.googleProfileUrl || payload.googleBusinessUrl || payload.google || "", 240),
    goal: clean(payload.goal || payload.primaryGoal || "Increase local discovery, leads and bookings", 180),
    monthlyBudget: clean(payload.monthlyBudget || payload.budget || "", 60),
    packageName: clean(payload.packageName || "Growth Pro", 80),
    monthlyFee: Number(payload.monthlyFee || payload.monthlyBudget || payload.budget || 0) || 0,
    competitors: Array.isArray(payload.competitors)
      ? payload.competitors.map((item) => clean(item, 100)).filter(Boolean).slice(0, 5)
      : clean(payload.competitors || "", 500).split(",").map((item) => clean(item, 100)).filter(Boolean).slice(0, 5),
    topServices: Array.isArray(payload.topServices)
      ? payload.topServices.map((item) => clean(item, 80)).filter(Boolean).slice(0, 6)
      : clean(payload.topServices || "", 240).split(",").map((item) => clean(item, 80)).filter(Boolean).slice(0, 6)
    ,
    rankKeywords
  };
}

function platformScore(input, platform) {
  const urlScore = hasUrl(input[`${platform}Url`]) ? 32 : 0;
  const businessScore = input.businessName ? 18 : 0;
  const locationScore = input.city || input.targetArea ? 18 : 0;
  const serviceScore = input.topServices.length ? 14 : 0;
  const goalScore = input.goal ? 8 : 0;
  const base = platform === "googleProfile" ? 10 : 8;
  return clampScore(base + urlScore + businessScore + locationScore + serviceScore + goalScore);
}

function platformPlan(input, key, label, focus, actions) {
  const score = platformScore(input, key);
  const url = input[`${key}Url`];
  const gaps = [];
  if (!hasUrl(url)) gaps.push(`${label} profile URL/connect status missing`);
  if (!input.city && !input.targetArea) gaps.push("city or service area missing");
  if (!input.topServices.length) gaps.push("top services not defined for local keywords");
  if (score < 80) gaps.push("needs proof content, fresh photos and weekly publishing rhythm");
  return {
    key,
    label,
    score,
    focus,
    profileUrl: url,
    gaps,
    actions
  };
}

function buildPlan(input) {
  const services = input.topServices.length ? input.topServices : ["haircut", "facial", "hair spa", "bridal makeup"];
  const place = input.targetArea || input.city || "nearby area";
  const competitors = buildCompetitorAudit(input, services, place);
  const platforms = [
    platformPlan(input, "googleProfile", "Google Business Profile", "Local SEO, calls, directions and reviews", [
      `Set primary category and service categories around ${input.industry}`,
      `Add service pages for ${services.slice(0, 3).join(", ")} with prices, duration and booking CTA`,
      `Upload 20 real branch photos: storefront, team, service result, hygiene and price menu`,
      "Publish two Google posts every week with UTM booking links",
      "Reply to every review with service and location context without keyword stuffing"
    ]),
    platformPlan(input, "instagram", "Instagram", "Reels, discovery, DMs and creator-style proof", [
      `Rewrite bio with ${place}, top service and WhatsApp booking CTA`,
      "Create highlights for prices, results, reviews, offers and branches",
      "Post 4 reels weekly: transformation, staff tip, offer and customer education",
      `Use geo-tags and captions around ${place} plus service-specific hashtags`,
      "Track DMs as leads and save quick replies for booking, pricing and location"
    ]),
    platformPlan(input, "facebook", "Facebook", "Local community reach, reviews and appointment intent", [
      "Complete Page category, hours, phone, WhatsApp and booking button",
      `Publish 3 local posts weekly for ${place}: offer, result proof and education`,
      "Create offer/event posts for festive, bridal and weekend slots",
      "Use Messenger quick replies for pricing, slot availability and directions",
      "Invite real customers to follow after visits; avoid bulk or fake engagement"
    ])
  ];

  const rankReadinessScore = clampScore(platforms.reduce((sum, platform) => sum + platform.score, 0) / platforms.length);
  const priorityActions = [
    `Complete Google Business Profile services, photos, Q&A and booking link for ${input.businessName}`,
    `Build a 30-day Instagram and Facebook content rhythm around ${services.slice(0, 3).join(", ")}`,
    "Start compliant review requests after every completed appointment",
    "Connect WhatsApp lead capture with missed-call, DM and booking follow-up drafts",
    "Review competitors manually every week for categories, offers, photos and review response quality"
  ];

  return {
    businessName: input.businessName,
    market: [input.industry, place].filter(Boolean).join(" · "),
    goal: input.goal,
    rankReadinessScore,
    scoreLabel: rankReadinessScore >= 82 ? "Strong" : rankReadinessScore >= 62 ? "Building" : "Needs foundation",
    positioning: `${input.businessName} can compete for local discovery by improving profile completeness, authentic reviews, fresh proof content and fast WhatsApp booking response. No system can guarantee rank one; this plan is built for ethical visibility growth.`,
    platforms,
    priorityActions,
    levels: [
      { level: 1, title: "Foundation Rank Bot", status: "live", summary: "Profile completeness, platform score and ethical action plan." },
      { level: 2, title: "Pro Growth Bot", status: "live", summary: "Competitor audit, Google checklist, social audit, 30-day content and scripts." },
      { level: 3, title: "Automation Dashboard", status: "live", summary: "Daily task board, lead tracking, approvals and weekly client report." },
      { level: 4, title: "Integration Hub", status: "connector-ready", summary: "Meta and Google API readiness with manual fallback metrics." },
      { level: 5, title: "Agency SaaS", status: "live", summary: "Client portfolio, packages, proposals, approvals, staff tasks and white-label reports." },
      { level: 6, title: "Real Rank Tracker", status: "api-ready", summary: "Daily keyword rank tracking with Google/manual import readiness and no scraping." },
      { level: 7, title: "AI Content Factory", status: "live", summary: "90-day reels, captions, carousels, hashtags, offers and festival campaigns." },
      { level: 8, title: "Lead Attribution", status: "live", summary: "Instagram DM, Facebook message, Google call and WhatsApp inquiry to booking attribution." },
      { level: 9, title: "Client Portal + Billing", status: "live", summary: "Client report portal, proposals, packages, invoices and renewal reminders." },
      { level: 10, title: "Autonomous Agency OS", status: "live", summary: "Multi-client operations, staff assignment, approvals and white-label weekly reports." },
      { level: 11, title: "AI Growth Copilot", status: "live", summary: "Client Q&A over rank, content, offers, reviews, tasks and attribution rows." },
      { level: 12, title: "Campaign Profit Engine", status: "live", summary: "Campaign spend, leads, bookings, revenue, profit and ROI by source." },
      { level: 13, title: "Approval + Publishing Planner", status: "planner-ready", summary: "Approved content converts into scheduled Meta, Google and WhatsApp publishing tasks." },
      { level: 14, title: "Local SEO Website Builder", status: "live", summary: "Service, city and offer landing pages with WhatsApp CTA and tracking links." },
      { level: 15, title: "AI Competitor Watch", status: "live", summary: "Competitor offer, review, post and rating-change alerts with counter actions." }
    ],
    googleLocalSeo: [
      "Primary category, secondary categories and services mapped to actual salon offerings",
      "NAP consistency across Google, Instagram, Facebook, website and directories",
      "Real photos added weekly with branch, team and service proof",
      "Review response SLA under 24 hours with polite, non-spammy local context",
      "Google posts every Tuesday and Friday with booking link and offer expiry",
      "Q&A seeded with real customer questions: price, timing, parking, hygiene and payment modes"
    ],
    contentCalendar: buildContentCalendar(input, services, place),
    proGrowthBot: {
      competitorAudit: competitors,
      googleRankingChecklist: buildGoogleRankingChecklist(input, services, place),
      socialProfileAudit: buildSocialProfileAudit(input, services, place),
      contentCalendar30: buildContentCalendar(input, services, place),
      reelStudio: buildReelStudio(input, services, place),
      reviewScripts: buildReviewScripts(input, place)
    },
    reviewEngine: {
      policy: "Ask every genuine customer for an honest review. Do not buy reviews, gate unhappy customers, write reviews for clients, or offer rewards for positive ratings.",
      moments: ["invoice closed", "membership renewal", "bridal/package completion", "service recovery solved"],
      scripts: [
        `Namaste {{clientName}}, ${input.businessName} visit ke liye thank you. Aapka honest Google review hume improve karne aur local clients tak pahunchne me help karega: {{reviewLink}}`,
        `Hi {{clientName}}, we hope you liked your service at ${input.businessName}. Please share an honest review here: {{reviewLink}}`,
        `Aapke feedback se team ko training milti hai. Agar kuch improve karna ho to reply karein, aur honest review yahan de sakte hain: {{reviewLink}}`
      ]
    },
    whatsappDrafts: [
      {
        useCase: "new lead from Instagram DM",
        body: `Hi {{name}}, ${input.businessName} se bol rahe hain. Aap ${services[0]} ke liye preferred date/time bhej dein, hum best slot confirm kar denge.`
      },
      {
        useCase: "Google profile booking follow-up",
        body: `Namaste {{name}}, Google se inquiry ke liye thank you. {{service}} ke slots {{date}} ko available hain. Book karne ke liye 1 reply karein.`
      },
      {
        useCase: "review request after appointment",
        body: `Thank you {{name}}. Aapka honest review hume ${place} me aur clients tak pahunchne me help karega: {{reviewLink}}`
      }
    ],
    weeklyPlan: [
      { week: 1, title: "Profile foundation", actions: ["complete Google services", "fix bio/page CTAs", "add branch photos", "set tracking links"] },
      { week: 2, title: "Proof content engine", actions: ["shoot 8 reels", "publish review snippets", "post before/after with consent", "create FAQ posts"] },
      { week: 3, title: "Review and lead response", actions: ["launch review request drafts", "reply to old reviews", "set DM quick replies", "measure WhatsApp replies"] },
      { week: 4, title: "Local ranking sprint", actions: ["manual competitor audit", "update offers", "refresh Google posts", "double down on top converting service"] }
    ],
    automationDashboard: buildAutomationDashboard(input, services, place),
    integrationHub: buildIntegrationHub(input, place),
    agencySaas: buildAgencySaas(input, services, place),
    advancedGrowthSystem: buildAdvancedGrowthSystem(input, services, place),
    automationQueue: [
      { trigger: "appointment.completed", action: "create honest review request draft", mode: "draft-first" },
      { trigger: "instagram.dm.lead", action: "create WhatsApp booking follow-up draft", mode: "draft-first" },
      { trigger: "google.click_to_call.missed", action: "create callback task for front desk", mode: "manager-review" },
      { trigger: "weekly.monday", action: "generate local content checklist", mode: "owner-review" }
    ],
    guardrails: [
      "No fake followers, fake likes, fake reviews or bot engagement",
      "No review gating or asking only happy customers",
      "No keyword stuffing, misleading location pages or competitor impersonation",
      "No scraping private customer data from social platforms",
      "All outbound messages stay draft-first until a human approves provider setup and consent"
    ],
    successMetrics: [
      "Google profile views, calls, direction requests and website clicks",
      "Review count, average rating, review response time and sentiment",
      "Instagram reach, profile visits, DMs and booking conversions",
      "Facebook page reach, messages and offer clicks",
      "WhatsApp lead response time and appointment conversion"
    ],
    providerStrategy: {
      mode: "provider-agnostic",
      futureProviders: ["OpenAI", "Claude", "Gemini", "Meta Graph API", "Google Business Profile API"],
      currentEngine: "deterministic audit planner with persisted outputs"
    }
  };
}

function buildContentCalendar(input, services, place) {
  const themes = [
    ["Google", "post", `${services[0]} offer near ${place}`, "Book this week"],
    ["Instagram", "reel", `before/after or transformation for ${services[0]}`, "DM BOOK"],
    ["Facebook", "post", `customer education: how to choose ${services[1] || services[0]}`, "Message for price"],
    ["Instagram", "story", "poll: hair/skin concern", "Reply with concern"],
    ["Google", "photo", "storefront, team and hygiene proof", "Call now"],
    ["Instagram", "reel", "staff tip in Hindi/English", "Save this tip"],
    ["Facebook", "offer", "weekday slot filler offer", "Book appointment"],
    ["Instagram", "carousel", `top 5 FAQs for ${services[2] || services[0]}`, "Share with a friend"],
    ["Google", "Q&A", "price, duration, parking and payment answers", "Get directions"],
    ["Facebook", "post", "review snippet with consent", "Send message"],
    ["Instagram", "reel", "quick service demo", "WhatsApp now"],
    ["Google", "post", "festival/bridal/package reminder", "Reserve slot"],
    ["Instagram", "story", "last slots today", "Tap WhatsApp"],
    ["Facebook", "community", `local ${place} salon care tip`, "Follow page"],
    ["Google", "post", `${services[0]} result proof and booking reminder`, "Book now"],
    ["Instagram", "reel", "client testimonial with consent", "DM RESULT"],
    ["Facebook", "post", "team expertise spotlight", "Message for consultation"],
    ["Instagram", "carousel", `${services[1] || services[0]} myths vs facts`, "Save post"],
    ["Google", "photo", "new photos: reception, tools and service setup", "Call branch"],
    ["Instagram", "reel", "30-second transformation story", "WhatsApp for slots"],
    ["Facebook", "offer", "membership/package value post", "Ask for package"],
    ["Google", "Q&A", "answer top customer objection", "Book appointment"],
    ["Instagram", "story", "behind-the-scenes team quality check", "Reply YES"],
    ["Facebook", "community", `weekend availability for ${place}`, "Send message"],
    ["Instagram", "reel", "staff tip plus product education", "Save and share"],
    ["Google", "post", "review highlight and service CTA", "Get directions"],
    ["Instagram", "carousel", "price menu explainer", "DM PRICE"],
    ["Facebook", "post", "festival/bridal consultation callout", "Book consultation"],
    ["Google", "photo", "before/after album with consent", "Call now"],
    ["Instagram", "story", "limited slots reminder", "Tap WhatsApp"]
  ];
  return themes.slice(0, 30).map(([platform, format, topic, cta], index) => ({
    day: index + 1,
    platform,
    format,
    topic,
    cta,
    localIntent: place
  }));
}

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildCompetitorAudit(input, services, place) {
  const names = input.competitors.length
    ? input.competitors
    : [
        `${place} Beauty Studio`,
        `${place} Salon Pro`,
        `${place} Bridal Lounge`,
        `${place} Hair & Skin`,
        `${place} Wellness Salon`
      ];
  return names.slice(0, 5).map((name, index) => {
    const score = clampScore(78 - index * 5 + (input.googleProfileUrl ? 3 : 0));
    return {
      name,
      estimatedStrength: score,
      likelyAdvantage: index % 2 === 0 ? "more Google reviews and fresh photos" : "stronger Instagram reels rhythm",
      gapToBeat: [
        `publish service proof for ${services[index % services.length]}`,
        "reply to reviews faster",
        `own ${place} local keywords without stuffing`
      ],
      counterMove: `${input.businessName} should beat this competitor with fresher photos, clearer pricing CTA and faster WhatsApp response.`
    };
  });
}

function buildGoogleRankingChecklist(input, services, place) {
  return [
    ["Business category", 12, "primary and secondary categories match real services"],
    ["Service menu", 14, `${services.slice(0, 4).join(", ")} added with descriptions`],
    ["Photo freshness", 12, "20 real photos in first week, 6 photos weekly after that"],
    ["Review velocity", 14, "honest review request after every completed invoice"],
    ["Response quality", 10, "reply within 24 hours with service and branch context"],
    ["Local proof", 10, `${place} mentions in natural posts, Q&A and captions`],
    ["Booking CTA", 10, "WhatsApp, phone, booking link and UTM tracking connected"],
    ["NAP consistency", 10, "same name, address, phone across profiles and directories"],
    ["Spam safety", 8, "no fake reviews, no keyword stuffing, no duplicate locations"]
  ].map(([item, weight, action]) => ({ item, weight, action, status: "ready", score: weight }));
}

function buildSocialProfileAudit(input, services, place) {
  return {
    instagram: {
      score: platformScore(input, "instagram"),
      bio: `${input.businessName} | ${services[0]} in ${place} | Book on WhatsApp`,
      highlights: ["Prices", "Results", "Reviews", "Offers", "Branches", "Care tips"],
      ctaFixes: ["Use one booking link", "Pin transformation reel", "Add WhatsApp quick reply"],
      risks: ["avoid copied captions", "avoid irrelevant hashtags", "get consent for before/after"]
    },
    facebook: {
      score: platformScore(input, "facebook"),
      about: `${input.businessName} helps clients in ${place} book ${services.slice(0, 3).join(", ")} with quick WhatsApp support.`,
      tabs: ["Services", "Reviews", "Offers", "Events", "Messenger"],
      ctaFixes: ["Enable appointment button", "Add service menu", "Post local community updates"],
      risks: ["avoid mass invites", "avoid fake review campaigns", "keep hours accurate"]
    }
  };
}

function buildReelStudio(input, services, place) {
  return services.slice(0, 5).map((service, index) => ({
    idea: `${service} transformation reel for ${place}`,
    hook: index % 2 === 0 ? `Is ${service} worth it? See this real result.` : `${place} clients ask this before booking ${service}.`,
    caption: `${input.businessName} ${service} service is available in ${place}. DM BOOK or tap WhatsApp for slots.`,
    hashtags: [`#${place.replace(/\s+/g, "")}`, "#SalonIndia", "#BeautyCare", `#${service.replace(/\s+/g, "")}`],
    offerCopy: `${service} weekday slots open. Limited appointments, honest consultation first.`,
    approvalStatus: "draft"
  }));
}

function buildReviewScripts(input, place) {
  return {
    hindi: [
      `Namaste {{clientName}}, ${input.businessName} visit ke liye dhanyavaad. Aapka honest Google review hume ${place} me aur clients tak pahunchne me madad karega: {{reviewLink}}`,
      `Agar service achchi lagi ho to apna honest feedback share karein. Agar kuch improve karna ho to isi WhatsApp par reply karein.`
    ],
    english: [
      `Hi {{clientName}}, thank you for visiting ${input.businessName}. Your honest Google review helps local clients in ${place} choose us confidently: {{reviewLink}}`,
      "Please share your genuine experience. We do not ask for only positive reviews; every feedback helps us improve."
    ],
    policy: "Send only to real customers after a completed service; never buy, gate or script customer reviews."
  };
}

function buildAutomationDashboard(input, services, place) {
  return {
    dailyTaskBoard: [
      { title: "Publish Google post", channel: "Google", dueDate: addDaysIso(1), priority: "high", ownerRole: "growth-manager" },
      { title: "Shoot transformation reel", channel: "Instagram", dueDate: addDaysIso(1), priority: "high", ownerRole: "content-creator" },
      { title: "Reply to all Google reviews", channel: "Google", dueDate: addDaysIso(2), priority: "high", ownerRole: "front-desk" },
      { title: "Post Facebook offer", channel: "Facebook", dueDate: addDaysIso(3), priority: "medium", ownerRole: "growth-manager" },
      { title: "Send review request drafts", channel: "WhatsApp", dueDate: addDaysIso(3), priority: "medium", ownerRole: "front-desk" }
    ],
    whatsappFollowUps: [
      `Hi {{name}}, ${services[0]} inquiry ke liye thank you. Aapko consultation chahiye ya direct booking?`,
      `Namaste {{name}}, ${input.businessName} me {{date}} ko slots open hain. Book karne ke liye 1 reply karein.`,
      `Hi {{name}}, aapki Google inquiry pending hai. Location: ${place}. Call/WhatsApp booking available.`
    ],
    googleReviewResponses: [
      "Thank you {{name}} for your honest review. We are happy you liked {{service}} at our {{branch}} branch.",
      "Thank you for sharing this feedback. We are sorry your experience was not ideal; our manager will contact you and resolve this.",
      "Thanks for trusting our team. Your review helps local customers choose the right salon service."
    ],
    leadTracking: [
      { source: "Instagram DM", leadName: "Instagram lead", intent: services[0], stage: "new", nextAction: "send price and slot draft" },
      { source: "Facebook Message", leadName: "Facebook lead", intent: services[1] || services[0], stage: "qualified", nextAction: "offer consultation slot" },
      { source: "Google Call", leadName: "Google caller", intent: "near me inquiry", stage: "callback", nextAction: "front desk callback within 15 minutes" }
    ],
    approvalWorkflow: [
      { contentType: "before_after", title: "Before/after reel with consent", status: "draft", reviewer: "client-owner" },
      { contentType: "offer", title: "Weekend offer copy", status: "pending_approval", reviewer: "agency-manager" },
      { contentType: "review_response", title: "Sensitive review response", status: "manager-review", reviewer: "client-owner" }
    ],
    weeklyReport: {
      title: `${input.businessName} weekly growth report`,
      sections: ["score movement", "tasks completed", "leads captured", "reviews requested", "content shipped", "next week priorities"],
      delivery: "PDF-ready white-label report plus client portal snapshot"
    }
  };
}

function buildIntegrationHub(input, place) {
  return {
    providers: [
      { provider: "Meta Graph API", status: "not_connected", scopes: ["instagram_basic", "pages_read_engagement", "pages_show_list"], setup: "Connect Facebook Page and Instagram Business account" },
      { provider: "Google Business Profile API", status: "not_connected", scopes: ["business.manage"], setup: "Connect location group and verify business profile" },
      { provider: "WhatsApp Cloud API", status: "draft_ready", scopes: ["messages", "templates"], setup: "Use existing WhatsApp provider readiness before direct send" }
    ],
    kpiDashboard: [
      { metric: "reach", source: "Meta", current: 0, mode: "waiting_for_connection" },
      { metric: "profile_views", source: "Google Business Profile", current: 0, mode: "waiting_for_connection" },
      { metric: "calls", source: "Google Business Profile", current: 0, mode: "waiting_for_connection" },
      { metric: "messages", source: "Meta/WhatsApp", current: 0, mode: "manual_or_connected" },
      { metric: "bookings", source: "AuraShine POS/booking", current: 0, mode: "internal_ready" }
    ],
    branchScores: [
      { branchName: `${place} main`, score: platformScore(input, "googleProfile"), status: "needs-live-metrics" },
      { branchName: "All branches average", score: clampScore((platformScore(input, "googleProfile") + platformScore(input, "instagram") + platformScore(input, "facebook")) / 3), status: "computed" }
    ],
    clientPortal: {
      enabled: true,
      tokenStrategy: "per-report portal token",
      visibleSections: ["score", "weekly tasks", "lead summary", "content approvals", "next actions"],
      note: "Client portal is report-ready without exposing platform secrets."
    }
  };
}

function buildAgencySaas(input, services, place) {
  const monthlyFee = Number(input.monthlyFee || input.monthlyBudget || 0) || 25000;
  return {
    clientPortfolio: {
      packageName: input.packageName || "Growth Pro",
      monthlyFee,
      renewalAt: addDaysIso(30),
      status: "active",
      portalLabel: `${input.businessName} growth portal`
    },
    onboardingForm: [
      { field: "businessName", value: input.businessName, required: true },
      { field: "city", value: input.city, required: true },
      { field: "targetArea", value: input.targetArea, required: true },
      { field: "topServices", value: services.join(", "), required: true },
      { field: "brandAssets", value: "logo, colors, photos, offers", required: false },
      { field: "platformAccess", value: "Meta, Google Business Profile, WhatsApp", required: true }
    ],
    billing: {
      monthlyPackage: input.packageName || "Growth Pro",
      monthlyFee,
      renewalWorkflow: ["invoice draft", "payment reminder", "renewal review", "next-month scope approval"]
    },
    aiProposal: {
      title: `${input.businessName} 30-day local growth proposal`,
      pitch: `Win more ${place} discovery through Google profile optimization, proof-led reels, compliant review requests and fast WhatsApp follow-up.`,
      deliverables: ["5 competitor audit", "30-day content plan", "weekly report", "lead tracker", "review response support"],
      expectedSignals: ["more profile actions", "faster lead response", "more real reviews", "clearer booking path"]
    },
    campaignApprovalSystem: [
      { stage: "draft", owner: "content creator", slaHours: 24 },
      { stage: "agency review", owner: "growth manager", slaHours: 12 },
      { stage: "client approval", owner: "client owner", slaHours: 24 },
      { stage: "schedule", owner: "operations", slaHours: 4 }
    ],
    staffTasks: [
      { role: "growth-manager", task: "weekly client review and competitor scan" },
      { role: "content-creator", task: "shoot and edit reels, carousels and offers" },
      { role: "front-desk", task: "lead response, review request drafts and callback tasks" },
      { role: "client-owner", task: "approve sensitive content and offers" }
    ],
    whiteLabelReports: {
      brand: input.businessName,
      sections: ["executive summary", "rank-readiness score", "task board", "lead funnel", "content shipped", "next week plan"],
      exportModes: ["client portal", "print/PDF", "email-ready summary"]
    }
  };
}

function defaultRankKeywords(input, services, place) {
  const city = input.city || place;
  return Array.from(new Set([
    "salon near me",
    `best salon in ${city}`,
    `best salon near ${place}`,
    `${services[0]} near me`,
    `${services[0]} in ${place}`,
    `${services[1] || "hair spa"} near me`,
    `${services[2] || "bridal makeup"} in ${city}`,
    `beauty parlour near ${place}`,
    `unisex salon in ${city}`,
    `hair spa near me`,
    `facial near ${place}`,
    `bridal makeup near me`
  ])).slice(0, 12);
}

function buildAdvancedGrowthSystem(input, services, place) {
  return {
    rankTracker: buildRankTracker(input, services, place),
    competitorIntelligencePro: buildCompetitorIntelligencePro(input, services, place),
    contentFactory90: buildContentFactory90(input, services, place),
    leadAttribution: buildLeadAttribution(input, services, place),
    autoGrowthTasks: buildAutoGrowthTasks(input, services, place),
    clientPortalPro: buildClientPortalPro(input, place),
    realIntegrationReadiness: buildRealIntegrationReadiness(input, place),
    proposalBilling: buildProposalBilling(input, services, place),
    reviewGrowthEngine: buildReviewGrowthEngine(input, place),
    autonomousAgencyOs: buildAutonomousAgencyOs(input, services, place),
    aiGrowthCopilot: buildAiGrowthCopilot(input, services, place),
    campaignProfitEngine: buildCampaignProfitEngine(input, services, place),
    approvalPublishingPlanner: buildApprovalPublishingPlanner(input, services, place),
    localSeoWebsiteBuilder: buildLocalSeoWebsiteBuilder(input, services, place),
    aiCompetitorWatch: buildAiCompetitorWatch(input, services, place)
  };
}

function buildRankTracker(input, services, place) {
  const keywords = (input.rankKeywords.length ? input.rankKeywords : defaultRankKeywords(input, services, place)).slice(0, 12);
  return {
    schedule: "daily",
    mode: "api_or_manual_import_ready",
    sourcePolicy: "Use Google-approved APIs, Search Console exports, rank-tracking provider imports or verified manual checks. Do not scrape Google search results.",
    keywords: keywords.map((keyword) => ({
      keyword,
      targetArea: place,
      targetUrl: input.googleProfileUrl || "",
      currentRank: 0,
      previousRank: 0,
      bestRank: 0,
      status: "waiting_for_first_sync",
      source: "manual_or_api_import"
    })),
    dailyChecklist: [
      "Import or sync keyword positions",
      "Mark improved, dropped and not-found keywords",
      "Create local content task for keywords outside top 10",
      "Review Google profile updates for service and area relevance"
    ]
  };
}

function buildCompetitorIntelligencePro(input, services, place) {
  const competitors = buildCompetitorAudit(input, services, place);
  return {
    mode: "manual_or_api_import_ready",
    fields: ["review count", "review rating", "content frequency", "active offers", "Google profile strength", "Instagram activity"],
    competitors: competitors.map((competitor) => ({
      name: competitor.name,
      googleStrength: competitor.estimatedStrength,
      reviewScore: 0,
      reviewCount: 0,
      contentFrequency: "connect or import weekly post count",
      offerSignal: "track active Google/Facebook/Instagram offer manually or through approved APIs",
      instagramActivity: "connect Meta insights or weekly manual observation",
      counterMove: competitor.counterMove,
      status: "signal_ready"
    })),
    comparisonCadence: "weekly",
    nextActions: [
      `Beat competitors with fresh ${services[0]} proof content in ${place}`,
      "Track review velocity without copying or manipulating competitor data",
      "Compare offer quality, booking CTA speed and profile completeness",
      "Create one counter-campaign for the strongest competitor each week"
    ]
  };
}

function buildContentFactory90(input, services, place) {
  const channels = ["Instagram", "Google", "Facebook", "WhatsApp"];
  const formats = ["reel", "carousel", "post", "story", "offer"];
  const festivals = ["Republic Day", "Holi", "Eid", "Akshaya Tritiya", "Raksha Bandhan", "Independence Day", "Navratri", "Diwali", "Christmas", "New Year"];
  return Array.from({ length: 90 }, (_, index) => {
    const day = index + 1;
    const service = services[index % services.length];
    const channel = channels[index % channels.length];
    const format = formats[index % formats.length];
    const festival = day % 9 === 0 ? festivals[Math.floor(index / 9) % festivals.length] : "";
    const topic = festival
      ? `${festival} ${service} campaign for ${place}`
      : `${service} trust-building ${format} for ${place}`;
    return {
      day,
      channel,
      format,
      topic,
      script: `Hook: ${place} me ${service} book karne se pehle ye dekhiye. Proof: real consultation, process and result. CTA: WhatsApp for slots.`,
      caption: `${input.businessName} me ${service} available hai. Transparent consultation, real results and fast booking support.`,
      carouselText: [
        `${service} kis ke liye best hai`,
        "process and timing",
        "after-care tip",
        "price/slot CTA"
      ],
      hashtags: [`#${place.replace(/\s+/g, "")}`, "#SalonIndia", `#${service.replace(/\s+/g, "")}`, "#BeautyBusiness"],
      offerCopy: festival
        ? `${festival} ${service} package: limited slots, honest consultation first.`
        : `${service} weekday slots open. Ask for availability on WhatsApp.`,
      festival,
      status: "draft"
    };
  });
}

function buildLeadAttribution(input, services, place) {
  return {
    model: "first_touch_plus_booking_confirmation",
    sources: [
      { source: "Instagram DM", eventType: "dm_inquiry", bookingEvent: "booking_confirmed", estimatedValue: 0, status: "tracking_ready" },
      { source: "Facebook Message", eventType: "page_message", bookingEvent: "booking_confirmed", estimatedValue: 0, status: "tracking_ready" },
      { source: "Google Call", eventType: "click_to_call", bookingEvent: "booking_confirmed", estimatedValue: 0, status: "tracking_ready" },
      { source: "WhatsApp Inquiry", eventType: "whatsapp_inquiry", bookingEvent: "booking_confirmed", estimatedValue: 0, status: "tracking_ready" }
    ],
    conversionRules: [
      "Lead source locks on first inquiry unless manager changes it",
      "Booking value comes from AuraShine appointment/POS when connected",
      "UTM, phone source and WhatsApp template id are stored with each event",
      "Manual correction is allowed with audit trail"
    ],
    sampleFollowUp: `Hi {{name}}, ${input.businessName} me ${services[0]} ke slots ${place} branch par available hain. Booking confirm karne ke liye preferred time bhejein.`
  };
}

function buildAutoGrowthTasks(input, services, place) {
  return [
    { title: "Sync or import rank keyword positions", channel: "Google", dueDate: addDaysIso(1), priority: "high", ownerRole: "growth-manager" },
    { title: "Publish one service proof reel", channel: "Instagram", dueDate: addDaysIso(1), priority: "high", ownerRole: "content-creator" },
    { title: "Reply to pending Google reviews", channel: "Google", dueDate: addDaysIso(1), priority: "high", ownerRole: "front-desk" },
    { title: "Create inactive lead follow-up list", channel: "WhatsApp", dueDate: addDaysIso(2), priority: "medium", ownerRole: "front-desk" },
    { title: `Launch ${services[0]} offer for ${place}`, channel: "Meta/Google", dueDate: addDaysIso(3), priority: "medium", ownerRole: "growth-manager" },
    { title: "Approve next 7 days content calendar", channel: "Client portal", dueDate: addDaysIso(3), priority: "medium", ownerRole: "client-owner" },
    { title: "Check competitor review velocity", channel: "Competitor intelligence", dueDate: addDaysIso(4), priority: "medium", ownerRole: "growth-manager" },
    { title: "Prepare weekly white-label report", channel: "Agency OS", dueDate: addDaysIso(7), priority: "high", ownerRole: "agency-manager" }
  ];
}

function buildClientPortalPro(input, place) {
  return {
    portalName: `${input.businessName} growth portal`,
    clientEmail: input.clientEmail,
    accessMode: "token_ready_for_future_auth",
    sections: [
      "growth score",
      "rank tracker",
      "lead attribution",
      "review alerts",
      "content approvals",
      "90-day calendar",
      "weekly reports",
      "proposal and billing"
    ],
    permissions: ["client-owner-view", "approve-content", "comment-on-report"],
    visibleMarket: place
  };
}

function buildRealIntegrationReadiness(input, place) {
  return {
    status: "credentials_not_connected",
    providers: [
      {
        provider: "Meta Graph API",
        status: "not_connected",
        metrics: ["instagram reach", "profile visits", "content interactions", "DM conversations", "Facebook page messages"],
        setup: "Connect Facebook Page, Instagram Business account, app scopes and webhook verification."
      },
      {
        provider: "Google Business Profile API",
        status: "not_connected",
        metrics: ["views", "calls", "direction clicks", "website clicks", "reviews"],
        setup: `Connect verified ${place} location and business.manage scope.`
      },
      {
        provider: "Call/UTM tracking",
        status: "manual_or_provider_ready",
        metrics: ["source", "campaign", "keyword", "booking id", "invoice value"],
        setup: "Use UTM links, source phone numbers or booking source fields."
      },
      {
        provider: "WhatsApp provider",
        status: "draft_ready",
        metrics: ["template sent", "reply received", "booking confirmed", "review request delivered"],
        setup: "Use Cloud API, Twilio, Gupshup, Interakt or custom provider after consent setup."
      }
    ],
    safety: "No private scraping, fake engagement or automated posting without approved provider and human-controlled settings."
  };
}

function buildProposalBilling(input, services, place) {
  const monthlyFee = Number(input.monthlyFee || input.monthlyBudget || 0) || 25000;
  return {
    proposalTitle: `${input.businessName} 90-day local growth proposal`,
    packageName: input.packageName || "Growth Pro",
    monthlyFee,
    invoiceStatus: "draft",
    renewalAt: addDaysIso(30),
    deliverables: [
      "daily rank tracker",
      "competitor intelligence",
      "90-day content factory",
      "lead attribution",
      "review growth engine",
      "weekly PDF report"
    ],
    pitch: `Help ${input.businessName} grow local discovery in ${place} for ${services.slice(0, 3).join(", ")} with ethical SEO, content and follow-up systems.`,
    renewalReminder: `Renewal reminder will be drafted 7 days before ${addDaysIso(30)}.`
  };
}

function buildReviewGrowthEngine(input, place) {
  return {
    policy: "Ask every genuine customer for honest feedback. Do not buy reviews, gate reviews, impersonate customers or promise positive-rating rewards.",
    workflows: [
      {
        reviewType: "request",
        customerName: "{{clientName}}",
        rating: 0,
        sentiment: "pending",
        riskLevel: "normal",
        status: "draft",
        requestScript: `Namaste {{clientName}}, ${input.businessName} visit ke liye thank you. Aapka honest review hume ${place} me improve karne me help karega: {{reviewLink}}`,
        aiReply: ""
      },
      {
        reviewType: "negative_alert",
        customerName: "{{reviewerName}}",
        rating: 2,
        sentiment: "negative",
        riskLevel: "high",
        status: "manager_review",
        requestScript: "",
        aiReply: "Thank you for sharing this feedback. We are sorry your experience was not ideal. Our manager will contact you and resolve this."
      },
      {
        reviewType: "positive_reply",
        customerName: "{{reviewerName}}",
        rating: 5,
        sentiment: "positive",
        riskLevel: "normal",
        status: "draft",
        requestScript: "",
        aiReply: `Thank you for trusting ${input.businessName}. We are happy you liked the service at our ${place} location.`
      }
    ],
    improvementPlan: [
      "request honest review after invoice close",
      "respond to negative reviews within 4 business hours",
      "tag service issue themes for staff training",
      "add weekly review score trend to client portal"
    ]
  };
}

function buildAutonomousAgencyOs(input, services, place) {
  return {
    ownerDashboard: [
      { metric: "managed clients", valueMode: "live_count" },
      { metric: "monthly recurring revenue", valueMode: "proposal_and_invoice_sum" },
      { metric: "open staff tasks", valueMode: "task_board" },
      { metric: "pending client approvals", valueMode: "approval_queue" },
      { metric: "review alerts", valueMode: "risk_queue" }
    ],
    clientManagement: {
      supportsMultipleClients: true,
      branchScoreMode: "branch_wise_readiness_and_rank_tracker",
      portfolioSegments: ["foundation", "growth", "retention", "premium"]
    },
    staffAssignments: [
      { role: "agency-manager", responsibility: "client strategy, reporting and renewal" },
      { role: "growth-manager", responsibility: "rank tracker, competitor intelligence and tasks" },
      { role: "content-creator", responsibility: `90-day ${services[0]} content production for ${place}` },
      { role: "front-desk", responsibility: "lead follow-up, review drafts and callback SLA" }
    ],
    approvalSystem: [
      { queue: "content", slaHours: 24, approver: "client-owner" },
      { queue: "offers", slaHours: 12, approver: "agency-manager" },
      { queue: "negative-review", slaHours: 4, approver: "client-owner" },
      { queue: "weekly-report", slaHours: 24, approver: "agency-manager" }
    ],
    whiteLabelReporting: {
      reportName: `${input.businessName} weekly growth PDF`,
      sections: ["executive summary", "rank movement", "content shipped", "lead attribution", "review growth", "next tasks"],
      exportModes: ["PDF", "client portal", "email summary"]
    }
  };
}

function buildAiGrowthCopilot(input, services, place) {
  return {
    mode: "live_workspace_grounded",
    answerPolicy: "Answer only from saved audit, rank, campaign, content, review, lead and task rows. If a provider is not connected, say that the answer is based on manual/imported data.",
    liveDataSources: [
      "rank readiness score",
      "keyword tracker",
      "competitor signals",
      "content factory",
      "campaign profit rows",
      "approval planner",
      "lead attribution",
      "review alerts",
      "open tasks"
    ],
    suggestedQuestions: [
      "mere salon ki ranking kyu down hai?",
      "aaj kya post karu?",
      "kaunsa offer chalau?",
      "kaunsa campaign profit de raha hai?",
      "competitor active ho gaya to kya karna hai?"
    ],
    sampleAnswers: [
      {
        question: "mere salon ki ranking kyu down hai?",
        intent: "rank_drop",
        answer: `${input.businessName} ke rank drop ko pehle review velocity, Google post freshness, local service pages aur ${place} keyword tracking se verify karein. Fresh proof content aur review response SLA priority hai.`
      },
      {
        question: "aaj kya post karu?",
        intent: "content_next_best_action",
        answer: `Aaj ${services[0]} proof reel publish karein: hook, result proof, hygiene/process clip aur WhatsApp CTA. Google par same service ka post UTM booking link ke saath daalein.`
      },
      {
        question: "kaunsa offer chalau?",
        intent: "offer_recommendation",
        answer: `${services[0]} weekday slot-filler offer chalayein, limit clear rakhein, aur profit engine me spend, leads, bookings aur invoice value track karein.`
      }
    ],
    escalationRules: [
      "negative review questions create manager escalation",
      "profit-loss questions cite campaign rows before advice",
      "publishing questions require approval status before schedule",
      "competitor questions recommend counter campaign without copying content"
    ]
  };
}

function buildCampaignProfitEngine(input, services, place) {
  const monthlyFee = money(input.monthlyFee || input.monthlyBudget || 30000);
  const campaigns = [
    { campaignName: `${services[0]} Instagram reel`, source: "Instagram Reel", spend: 3500, leads: 22, bookings: 7, revenue: 28000 },
    { campaignName: `${place} Google post offer`, source: "Google Post", spend: 1200, leads: 14, bookings: 5, revenue: 18500 },
    { campaignName: "WhatsApp inactive lead recovery", source: "WhatsApp CRM", spend: 700, leads: 18, bookings: 6, revenue: 21600 },
    { campaignName: `${services[1] || services[0]} Meta offer`, source: "Meta Campaign", spend: 5000, leads: 31, bookings: 9, revenue: 34200 },
    { campaignName: `${services[2] || services[0]} SEO landing page`, source: "SEO Website", spend: 1800, leads: 9, bookings: 3, revenue: 15000 }
  ].map((campaign) => {
    const fulfillmentCost = Math.round(campaign.revenue * 0.42);
    const profit = Math.max(0, campaign.revenue - campaign.spend - fulfillmentCost);
    return {
      ...campaign,
      profit,
      roiPercent: roiPercent(profit, campaign.spend),
      marginAssumption: "42 percent service fulfillment cost until POS margin sync is connected",
      status: "tracking_ready"
    };
  });
  const totals = campaigns.reduce((sum, campaign) => ({
    spend: sum.spend + campaign.spend,
    leads: sum.leads + campaign.leads,
    bookings: sum.bookings + campaign.bookings,
    revenue: sum.revenue + campaign.revenue,
    profit: sum.profit + campaign.profit
  }), { spend: 0, leads: 0, bookings: 0, revenue: 0, profit: 0 });
  return {
    mode: "manual_or_integration_sync",
    packageFeeReference: monthlyFee,
    attributionFields: ["source", "campaign", "spend", "leads", "bookings", "invoice revenue", "profit", "ROI"],
    campaigns,
    totals: { ...totals, roiPercent: roiPercent(totals.profit, totals.spend) },
    bookingLinkRule: "Every Meta, Google, SEO and WhatsApp campaign must use a UTM or source-specific booking link.",
    profitPolicy: "Use POS invoice value and actual ad spend when connected; until then the row is editable and marked tracking_ready."
  };
}

function buildApprovalPublishingPlanner(input, services, place) {
  const channels = ["Instagram", "Google Business Profile", "Facebook", "WhatsApp"];
  return {
    mode: "approval_first_publish_later",
    providerReadiness: [
      { provider: "Meta Graph API", status: "future_publish_ready", requirement: "approved content, connected Page and Instagram Business account" },
      { provider: "Google Business Profile API", status: "future_publish_ready", requirement: "verified location and approved Google post" },
      { provider: "WhatsApp Provider", status: "template_draft_ready", requirement: "approved template, consent and opt-out handling" }
    ],
    approvalRules: [
      "content owner approves copy and creative",
      "agency manager approves offer economics",
      "client owner approves claims, before/after consent and discounts",
      "provider publishing stays disabled until credentials and audit logging are configured"
    ],
    scheduledItems: Array.from({ length: 10 }, (_, index) => {
      const service = services[index % services.length];
      const channel = channels[index % channels.length];
      const format = index % 3 === 0 ? "offer" : index % 3 === 1 ? "reel" : "post";
      return {
        title: `${service} ${format} for ${place}`,
        channel,
        format,
        scheduledFor: addDaysIso(index + 1),
        approvalStatus: index < 3 ? "approved" : "pending_approval",
        publishStatus: "scheduled_draft",
        provider: channel === "Google Business Profile" ? "Google Business Profile API" : channel === "WhatsApp" ? "WhatsApp Provider" : "Meta Graph API",
        cta: channel === "WhatsApp" ? "Reply BOOK" : "WhatsApp booking CTA"
      };
    }),
    calendarLabel: `${input.businessName} approval and publishing calendar`
  };
}

function buildLocalSeoWebsiteBuilder(input, services, place) {
  const city = input.city || place || "city";
  const pages = [
    ...services.slice(0, 4).map((service) => ({
      pageType: "service",
      slug: slugify(`${service}-${place}`),
      title: `${service} in ${place} | ${input.businessName}`,
      targetKeyword: `${service} near ${place}`,
      hero: `${service} booking for ${place} clients with WhatsApp-first support`,
      sections: ["service benefits", "price and duration", "before after proof", "FAQs", "reviews", "WhatsApp CTA"]
    })),
    {
      pageType: "city",
      slug: slugify(`${input.businessName}-${city}`),
      title: `Best salon in ${city} | ${input.businessName}`,
      targetKeyword: `best salon in ${city}`,
      hero: `${input.businessName} local salon discovery page for ${city}`,
      sections: ["services", "branch location", "reviews", "offers", "booking CTA"]
    },
    {
      pageType: "offer",
      slug: slugify(`${services[0]}-offer-${place}`),
      title: `${services[0]} offer in ${place} | ${input.businessName}`,
      targetKeyword: `${services[0]} offer ${place}`,
      hero: `Limited ${services[0]} offer with transparent terms and WhatsApp booking`,
      sections: ["offer details", "validity", "who should book", "terms", "tracking link"]
    }
  ].map((page) => ({
    ...page,
    whatsappCta: `https://wa.me/{{phone}}?text=Hi%20${encodeURIComponent(input.businessName)}%20I%20want%20to%20book%20${encodeURIComponent(page.targetKeyword)}`,
    trackingUrl: `/book?utm_source=local_seo&utm_medium=${page.pageType}&utm_campaign=${page.slug}`,
    status: "draft"
  }));
  return {
    mode: "seo_page_generator_ready",
    platform: "mini_site_or_existing_website_embed",
    pages,
    schemaBlocks: ["LocalBusiness", "Service", "Offer", "FAQPage", "Review"],
    guardrails: [
      "do not create misleading location pages",
      "use real branch/service information only",
      "do not claim guaranteed ranking",
      "track clicks and bookings with UTM links"
    ]
  };
}

function buildAiCompetitorWatch(input, services, place) {
  const competitors = input.competitors.length ? input.competitors : ["Top local competitor", "Nearby premium salon", "Fast-growing beauty studio"];
  const signalTypes = ["new_offer", "new_review", "new_post", "rating_change"];
  return {
    mode: "manual_or_approved_api_monitoring",
    sourcePolicy: "Use manual observations, public approved APIs, client-provided screenshots or provider feeds. Do not scrape private or restricted data.",
    alerts: competitors.slice(0, 5).map((competitor, index) => {
      const signalType = signalTypes[index % signalTypes.length];
      const service = services[index % services.length];
      return {
        competitorName: competitor,
        signalType,
        severity: index === 0 ? "high" : "medium",
        summary: `${competitor} active signal detected for ${place}`,
        recommendedAction: `Launch counter move: ${service} proof content, Google post and WhatsApp follow-up within 24 hours.`,
        status: "open",
        observedAt: addDaysIso(0),
        counterOffer: `${service} consult + weekday slot offer for ${place}`
      };
    }),
    counterPlaybook: [
      "do not copy competitor creative or claims",
      "respond with real proof, review velocity and faster booking CTA",
      "prioritize the service page and offer that maps to the competitor signal",
      "assign a growth-manager task when severity is high"
    ]
  };
}

function rowToAudit(row) {
  if (!row) return null;
  const payload = parseJson(row.payload_json, {});
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id,
    businessName: row.business_name,
    industry: row.industry,
    city: row.city,
    targetArea: row.target_area,
    instagramUrl: row.instagram_url,
    facebookUrl: row.facebook_url,
    googleProfileUrl: row.google_profile_url,
    goal: row.goal,
    status: row.status,
    score: row.score,
    market: payload.plan?.market || [row.industry, row.target_area || row.city].filter(Boolean).join(" · "),
    input: payload.input || {},
    plan: payload.plan || {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class GrowthRankBotService {
  context(payload = {}, access = {}) {
    if (!access.tenantId) throw badRequest("Tenant context is required");
    tenantService.ensureSubscriptionActive(access.tenantId);
    const input = normalizePayload(payload);
    const branchId = input.branchId || access.requestedBranchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    return { input: { ...input, branchId }, branchId };
  }

  preview(payload = {}, access) {
    const { input, branchId } = this.context(payload, access);
    if (!input.businessName) throw badRequest("businessName is required");
    return { input, branchId, plan: buildPlan(input) };
  }

  createAudit(payload = {}, access) {
    const { input, branchId, plan } = this.preview(payload, access);
    const stamp = now();
    const audit = {
      id: makeId(),
      tenantId: access.tenantId,
      branchId,
      input,
      plan
    };
    db.prepare(`
      INSERT INTO growth_rank_bot_audits (
        id, tenant_id, branch_id, business_name, industry, city, target_area,
        instagram_url, facebook_url, google_profile_url, goal, status, score,
        payload_json, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      audit.id,
      audit.tenantId,
      audit.branchId,
      input.businessName,
      input.industry,
      input.city,
      input.targetArea,
      input.instagramUrl,
      input.facebookUrl,
      input.googleProfileUrl,
      input.goal,
      "generated",
      plan.rankReadinessScore,
      JSON.stringify({ input, plan }),
      access.userId || "system-user",
      stamp,
      stamp
    );
    this.persistAgencyWorkspace(audit, access);
    return this.getAudit(audit.id, access);
  }

  listAudits(query = {}, access = {}) {
    if (!access.tenantId) throw badRequest("Tenant context is required");
    tenantService.ensureSubscriptionActive(access.tenantId);
    const branchId = clean(query.branchId || access.requestedBranchId || "", 80);
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const filters = ["tenant_id = ?"];
    const params = [access.tenantId];
    if (branchId) {
      filters.push("branch_id = ?");
      params.push(branchId);
    }
    const limit = Math.max(1, Math.min(100, Number(query.limit || 30)));
    const rows = db.prepare(`
      SELECT * FROM growth_rank_bot_audits
      WHERE ${filters.join(" AND ")}
      ORDER BY datetime(created_at) DESC
      LIMIT ?
    `).all(...params, limit);
    return rows.map(rowToAudit);
  }

  getAudit(id, access = {}) {
    if (!access.tenantId) throw badRequest("Tenant context is required");
    tenantService.ensureSubscriptionActive(access.tenantId);
    const row = db.prepare("SELECT * FROM growth_rank_bot_audits WHERE id = ? AND tenant_id = ?").get(clean(id, 80), access.tenantId);
    if (!row) throw notFound("Growth rank audit not found");
    if (row.branch_id) tenantService.assertBranchAccess(access, row.branch_id);
    const audit = rowToAudit(row);
    this.ensureGrowthAgencyOsPlan(audit);
    this.ensureWorkspaceCompleteness(audit);
    return {
      ...audit,
      workspace: this.workspaceForAudit(row.id, access)
    };
  }

  ensureGrowthAgencyOsPlan(audit) {
    const advanced = audit?.plan?.advancedGrowthSystem || {};
    const hasLevel11To15 = advanced.aiGrowthCopilot
      && advanced.campaignProfitEngine
      && advanced.approvalPublishingPlanner
      && advanced.localSeoWebsiteBuilder
      && advanced.aiCompetitorWatch;
    if (hasLevel11To15) return;
    const input = normalizePayload({
      ...(audit.input || {}),
      businessName: audit.businessName,
      industry: audit.industry,
      city: audit.city,
      targetArea: audit.targetArea,
      instagramUrl: audit.instagramUrl,
      facebookUrl: audit.facebookUrl,
      googleProfileUrl: audit.googleProfileUrl,
      goal: audit.goal
    });
    const plan = buildPlan(input);
    audit.input = input;
    audit.plan = plan;
    audit.score = plan.rankReadinessScore;
    const stamp = now();
    db.prepare(`
      UPDATE growth_rank_bot_audits
      SET score = ?, payload_json = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `).run(plan.rankReadinessScore, JSON.stringify({ input, plan }), stamp, audit.id, audit.tenantId);
  }

  ensureWorkspaceCompleteness(audit) {
    if (!audit?.id || !audit.tenantId) return;
    const stamp = now();
    const tenantId = audit.tenantId;
    const branchId = audit.branchId || "";
    const input = audit.input || {};
    const plan = audit.plan || {};
    const advanced = plan.advancedGrowthSystem || {};
    const monthlyFee = Number(input.monthlyFee || advanced.proposalBilling?.monthlyFee || plan.agencySaas?.clientPortfolio?.monthlyFee || 0);
    let client = db
      .prepare("SELECT * FROM growth_rank_bot_clients WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 1")
      .get(audit.id, tenantId);
    let token = client?.portal_token || "";
    if (!token) {
      token = portalToken();
      if (client) {
        db.prepare("UPDATE growth_rank_bot_clients SET portal_token = ?, updated_at = ? WHERE id = ? AND tenant_id = ?")
          .run(token, stamp, client.id, tenantId);
      }
    }
    if (!client) {
      const portfolio = plan.agencySaas?.clientPortfolio || {};
      db.prepare(`
        INSERT INTO growth_rank_bot_clients (
          id, tenant_id, branch_id, audit_id, business_name, package_name, monthly_fee,
          renewal_at, portal_token, status, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        tenantId,
        branchId,
        audit.id,
        audit.businessName || input.businessName || "Growth client",
        input.packageName || portfolio.packageName || "Growth Pro",
        monthlyFee,
        portfolio.renewalAt || addDaysIso(30),
        token,
        "active",
        JSON.stringify({ input, portfolio, backfilled: true }),
        stamp,
        stamp
      );
    }

    const proposalCount = db
      .prepare("SELECT COUNT(*) AS count FROM growth_rank_bot_proposals WHERE audit_id = ? AND tenant_id = ?")
      .get(audit.id, tenantId)?.count || 0;
    if (!proposalCount) {
      const proposal = advanced.proposalBilling || plan.agencySaas?.aiProposal || {};
      db.prepare(`
        INSERT INTO growth_rank_bot_proposals (
          id, tenant_id, branch_id, audit_id, title, monthly_fee, package_name,
          status, renewal_at, invoice_status, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        tenantId,
        branchId,
        audit.id,
        proposal.proposalTitle || proposal.title || `${audit.businessName || input.businessName || "Client"} growth proposal`,
        monthlyFee,
        proposal.packageName || input.packageName || plan.agencySaas?.clientPortfolio?.packageName || "Growth Pro",
        "draft",
        proposal.renewalAt || addDaysIso(30),
        proposal.invoiceStatus || "draft",
        JSON.stringify({ ...proposal, backfilled: true }),
        stamp,
        stamp
      );
    }

    const portalCount = db
      .prepare("SELECT COUNT(*) AS count FROM growth_rank_bot_portal_sessions WHERE audit_id = ? AND tenant_id = ?")
      .get(audit.id, tenantId)?.count || 0;
    if (!portalCount) {
      const portal = advanced.clientPortalPro || plan.integrationHub?.clientPortal || {};
      db.prepare(`
        INSERT INTO growth_rank_bot_portal_sessions (
          id, tenant_id, branch_id, audit_id, portal_token, client_email, status,
          payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        tenantId,
        branchId,
        audit.id,
        token,
        portal.clientEmail || input.clientEmail || "",
        "active",
        JSON.stringify({ ...portal, backfilled: true }),
        stamp,
        stamp
      );
    }

    this.persistLevel11To15Workspace(audit, stamp, { ifEmpty: true });
  }

  dashboard(query = {}, access = {}) {
    if (!access.tenantId) throw badRequest("Tenant context is required");
    tenantService.ensureSubscriptionActive(access.tenantId);
    const branchId = clean(query.branchId || access.requestedBranchId || "", 80);
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const filters = ["tenant_id = ?"];
    const params = [access.tenantId];
    if (branchId) {
      filters.push("branch_id = ?");
      params.push(branchId);
    }
    const where = filters.join(" AND ");
    const rows = {
      clients: db.prepare(`SELECT * FROM growth_rank_bot_clients WHERE ${where} ORDER BY datetime(created_at) DESC LIMIT 50`).all(...params),
      tasks: db.prepare(`SELECT * FROM growth_rank_bot_tasks WHERE ${where} ORDER BY status ASC, due_date ASC LIMIT 100`).all(...params),
      leads: db.prepare(`SELECT * FROM growth_rank_bot_leads WHERE ${where} ORDER BY datetime(created_at) DESC LIMIT 100`).all(...params),
      approvals: db.prepare(`SELECT * FROM growth_rank_bot_content_approvals WHERE ${where} ORDER BY datetime(created_at) DESC LIMIT 100`).all(...params),
      reports: db.prepare(`SELECT * FROM growth_rank_bot_reports WHERE ${where} ORDER BY datetime(created_at) DESC LIMIT 50`).all(...params),
      integrations: db.prepare(`SELECT * FROM growth_rank_bot_integrations WHERE ${where} ORDER BY provider ASC LIMIT 50`).all(...params),
      rankKeywords: db.prepare(`SELECT * FROM growth_rank_bot_rank_keywords WHERE ${where} ORDER BY keyword ASC LIMIT 200`).all(...params),
      rankSnapshots: db.prepare(`SELECT * FROM growth_rank_bot_rank_snapshots WHERE ${where} ORDER BY datetime(created_at) DESC LIMIT 200`).all(...params),
      competitorSignals: db.prepare(`SELECT * FROM growth_rank_bot_competitor_signals WHERE ${where} ORDER BY google_strength DESC LIMIT 100`).all(...params),
      contentFactory: db.prepare(`SELECT * FROM growth_rank_bot_content_factory WHERE ${where} ORDER BY day_number ASC LIMIT 200`).all(...params),
      attributionEvents: db.prepare(`SELECT * FROM growth_rank_bot_attribution_events WHERE ${where} ORDER BY datetime(created_at) DESC LIMIT 200`).all(...params),
      reviewEngine: db.prepare(`SELECT * FROM growth_rank_bot_review_engine WHERE ${where} ORDER BY risk_level DESC, datetime(created_at) DESC LIMIT 100`).all(...params),
      proposals: db.prepare(`SELECT * FROM growth_rank_bot_proposals WHERE ${where} ORDER BY datetime(created_at) DESC LIMIT 50`).all(...params),
      portalSessions: db.prepare(`SELECT * FROM growth_rank_bot_portal_sessions WHERE ${where} ORDER BY datetime(created_at) DESC LIMIT 50`).all(...params),
      copilotChats: db.prepare(`SELECT * FROM growth_rank_bot_copilot_chats WHERE ${where} ORDER BY datetime(created_at) DESC LIMIT 100`).all(...params),
      campaignProfit: db.prepare(`SELECT * FROM growth_rank_bot_campaign_profit WHERE ${where} ORDER BY roi_percent DESC LIMIT 100`).all(...params),
      publishingPlanner: db.prepare(`SELECT * FROM growth_rank_bot_publishing_planner WHERE ${where} ORDER BY scheduled_for ASC LIMIT 100`).all(...params),
      seoPages: db.prepare(`SELECT * FROM growth_rank_bot_seo_pages WHERE ${where} ORDER BY page_type ASC, title ASC LIMIT 100`).all(...params),
      competitorAlerts: db.prepare(`SELECT * FROM growth_rank_bot_competitor_alerts WHERE ${where} ORDER BY severity ASC, datetime(created_at) DESC LIMIT 100`).all(...params)
    };
    const tasks = rows.tasks.map(this.taskRow);
    const leads = rows.leads.map(this.leadRow);
    const approvals = rows.approvals.map(this.approvalRow);
    const reports = rows.reports.map(this.reportRow);
    const reviewEngine = rows.reviewEngine.map(this.reviewEngineRow);
    const campaignProfit = rows.campaignProfit.map(this.campaignProfitRow);
    const profitTotal = campaignProfit.reduce((sum, campaign) => sum + Number(campaign.profit || 0), 0);
    const spendTotal = campaignProfit.reduce((sum, campaign) => sum + Number(campaign.spend || 0), 0);
    return {
      metrics: {
        clients: rows.clients.length,
        openTasks: tasks.filter((item) => item.status !== "done").length,
        leads: leads.length,
        pendingApprovals: approvals.filter((item) => !["approved", "rejected"].includes(item.status)).length,
        weeklyReports: reports.length,
        connectedIntegrations: rows.integrations.filter((item) => item.status === "connected").length,
        trackedKeywords: rows.rankKeywords.length,
        syncedRankSnapshots: rows.rankSnapshots.length,
        competitorSignals: rows.competitorSignals.length,
        contentFactoryItems: rows.contentFactory.length,
        attributedLeads: rows.attributionEvents.length,
        reviewAlerts: reviewEngine.filter((item) => item.riskLevel === "high").length,
        proposals: rows.proposals.length,
        portalSessions: rows.portalSessions.length,
        copilotChats: rows.copilotChats.length,
        campaignProfit: profitTotal,
        campaignRoiPercent: roiPercent(profitTotal, spendTotal),
        scheduledPublishing: rows.publishingPlanner.length,
        seoPages: rows.seoPages.length,
        competitorAlerts: rows.competitorAlerts.filter((item) => item.status !== "resolved").length
      },
      clients: rows.clients.map(this.clientRow),
      tasks,
      leads,
      approvals,
      reports,
      integrations: rows.integrations.map(this.integrationRow),
      rankKeywords: rows.rankKeywords.map(this.rankKeywordRow),
      rankSnapshots: rows.rankSnapshots.map(this.rankSnapshotRow),
      competitorSignals: rows.competitorSignals.map(this.competitorSignalRow),
      contentFactory: rows.contentFactory.map(this.contentFactoryRow),
      attributionEvents: rows.attributionEvents.map(this.attributionEventRow),
      reviewEngine,
      proposals: rows.proposals.map(this.proposalRow),
      portalSessions: rows.portalSessions.map(this.portalSessionRow),
      copilotChats: rows.copilotChats.map(this.copilotChatRow),
      campaignProfit,
      publishingPlanner: rows.publishingPlanner.map(this.publishingPlannerRow),
      seoPages: rows.seoPages.map(this.seoPageRow),
      competitorAlerts: rows.competitorAlerts.map(this.competitorAlertRow)
    };
  }

  weeklyReport(auditId, access = {}) {
    const audit = this.getAudit(auditId, access);
    const report = db
      .prepare("SELECT * FROM growth_rank_bot_reports WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 1")
      .get(audit.id, access.tenantId);
    if (report) return this.reportRow(report);
    return {
      id: "",
      auditId: audit.id,
      title: `${audit.businessName} weekly growth report`,
      reportType: "weekly",
      status: "ready",
      payload: audit.plan?.automationDashboard?.weeklyReport || {},
      portalToken: "",
      createdAt: audit.createdAt,
      updatedAt: audit.updatedAt
    };
  }

  updateTaskStatus(id, payload = {}, access = {}) {
    if (!access.tenantId) throw badRequest("Tenant context is required");
    tenantService.ensureSubscriptionActive(access.tenantId);
    const row = db.prepare("SELECT * FROM growth_rank_bot_tasks WHERE id = ? AND tenant_id = ?").get(clean(id, 80), access.tenantId);
    if (!row) throw notFound("Growth rank task not found");
    if (row.branch_id) tenantService.assertBranchAccess(access, row.branch_id);
    const status = clean(payload.status || "done", 40);
    db.prepare("UPDATE growth_rank_bot_tasks SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?").run(status, now(), row.id, access.tenantId);
    return this.taskRow(db.prepare("SELECT * FROM growth_rank_bot_tasks WHERE id = ? AND tenant_id = ?").get(row.id, access.tenantId));
  }

  rankTracker(auditId, access = {}) {
    const audit = this.getAudit(auditId, access);
    const params = [audit.id, access.tenantId];
    return {
      auditId: audit.id,
      businessName: audit.businessName,
      sourcePolicy: audit.plan?.advancedGrowthSystem?.rankTracker?.sourcePolicy || "",
      schedule: audit.plan?.advancedGrowthSystem?.rankTracker?.schedule || "daily",
      keywords: db.prepare("SELECT * FROM growth_rank_bot_rank_keywords WHERE audit_id = ? AND tenant_id = ? ORDER BY keyword ASC").all(...params).map(this.rankKeywordRow),
      snapshots: db.prepare("SELECT * FROM growth_rank_bot_rank_snapshots WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 100").all(...params).map(this.rankSnapshotRow)
    };
  }

  clientPortal(token, access = {}) {
    if (!access.tenantId) throw badRequest("Tenant context is required");
    tenantService.ensureSubscriptionActive(access.tenantId);
    const row = db
      .prepare("SELECT * FROM growth_rank_bot_portal_sessions WHERE portal_token = ? AND tenant_id = ?")
      .get(clean(token, 100), access.tenantId);
    if (!row) throw notFound("Growth rank client portal not found");
    if (row.branch_id) tenantService.assertBranchAccess(access, row.branch_id);
    const audit = this.getAudit(row.audit_id, access);
    const report = this.weeklyReport(audit.id, access);
    return {
      session: this.portalSessionRow(row),
      audit: {
        id: audit.id,
        businessName: audit.businessName,
        score: audit.score,
        market: audit.market,
        plan: {
          rankReadinessScore: audit.plan?.rankReadinessScore,
          scoreLabel: audit.plan?.scoreLabel,
          priorityActions: audit.plan?.priorityActions || [],
          advancedGrowthSystem: audit.plan?.advancedGrowthSystem || {}
        }
      },
      report,
      workspace: audit.workspace
    };
  }

  recordAttribution(payload = {}, access = {}) {
    const audit = this.getAudit(payload.auditId, access);
    const stamp = now();
    const source = clean(payload.source || "Manual source", 80);
    const rowId = makeId();
    db.prepare(`
      INSERT INTO growth_rank_bot_attribution_events (
        id, tenant_id, branch_id, audit_id, source, lead_name, event_type, booking_id,
        estimated_value, status, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rowId,
      access.tenantId,
      audit.branchId || "",
      audit.id,
      source,
      clean(payload.leadName || "", 120),
      clean(payload.eventType || "manual_booking_attribution", 80),
      clean(payload.bookingId || "", 100),
      Number(payload.estimatedValue || 0) || 0,
      clean(payload.status || "attributed", 60),
      JSON.stringify({ ...payload, source }),
      stamp,
      stamp
    );
    return this.attributionEventRow(db.prepare("SELECT * FROM growth_rank_bot_attribution_events WHERE id = ? AND tenant_id = ?").get(rowId, access.tenantId));
  }

  updateContentStatus(id, payload = {}, access = {}) {
    if (!access.tenantId) throw badRequest("Tenant context is required");
    tenantService.ensureSubscriptionActive(access.tenantId);
    const row = db.prepare("SELECT * FROM growth_rank_bot_content_factory WHERE id = ? AND tenant_id = ?").get(clean(id, 80), access.tenantId);
    if (!row) throw notFound("Growth rank content item not found");
    if (row.branch_id) tenantService.assertBranchAccess(access, row.branch_id);
    const status = clean(payload.status || "approved", 50);
    db.prepare("UPDATE growth_rank_bot_content_factory SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?").run(status, now(), row.id, access.tenantId);
    return this.contentFactoryRow(db.prepare("SELECT * FROM growth_rank_bot_content_factory WHERE id = ? AND tenant_id = ?").get(row.id, access.tenantId));
  }

  importRankSnapshots(auditId, payload = {}, access = {}) {
    const audit = this.getAudit(auditId, access);
    const positions = Array.isArray(payload.positions) ? payload.positions : [];
    if (!positions.length) throw badRequest("positions are required for manual rank import");
    const byKeyword = new Map(
      positions
        .map((item) => [clean(item.keyword, 120).toLowerCase(), Number(item.rankPosition || item.currentRank || 0)])
        .filter(([keyword, rank]) => keyword && Number.isFinite(rank))
    );
    const keywordRows = db
      .prepare("SELECT * FROM growth_rank_bot_rank_keywords WHERE audit_id = ? AND tenant_id = ? ORDER BY keyword ASC")
      .all(audit.id, access.tenantId);
    const stamp = now();
    for (const row of keywordRows) {
      const rank = Math.max(0, Math.round(byKeyword.get(String(row.keyword || "").toLowerCase()) || 0));
      if (!rank) continue;
      const previousRank = Number(row.current_rank || 0);
      const existingBest = Number(row.best_rank || 0);
      const bestRank = existingBest ? Math.min(existingBest, rank) : rank;
      const payloadJson = {
        ...parseJson(row.payload_json, {}),
        lastManualImportAt: stamp,
        source: clean(payload.source || "manual_rank_import", 80)
      };
      db.prepare(`
        INSERT INTO growth_rank_bot_rank_snapshots (
          id, tenant_id, branch_id, audit_id, keyword_id, keyword, rank_position,
          checked_at, source, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        access.tenantId,
        audit.branchId || "",
        audit.id,
        row.id,
        row.keyword,
        rank,
        stamp,
        clean(payload.source || "manual_rank_import", 80),
        JSON.stringify({ keyword: row.keyword, rankPosition: rank, checkedAt: stamp, importedBy: access.userId || "system-user" }),
        stamp
      );
      db.prepare(`
        UPDATE growth_rank_bot_rank_keywords
        SET previous_rank = ?, current_rank = ?, best_rank = ?, status = ?, payload_json = ?, updated_at = ?
        WHERE id = ? AND tenant_id = ?
      `).run(previousRank, rank, bestRank, "manual_imported", JSON.stringify(payloadJson), stamp, row.id, access.tenantId);
    }
    return this.rankTracker(audit.id, access);
  }

  syncIntegrationMetrics(auditId, payload = {}, access = {}) {
    const audit = this.getAudit(auditId, access);
    const stamp = now();
    const providers = Array.isArray(payload.providers) && payload.providers.length
      ? payload.providers
      : [
          { provider: "Meta Graph API", status: "manual_synced", metrics: { reach: 0, profileVisits: 0, messages: 0 } },
          { provider: "Google Business Profile API", status: "manual_synced", metrics: { views: 0, calls: 0, directionClicks: 0 } },
          { provider: "WhatsApp Cloud API", status: "manual_synced", metrics: { inquiries: 0, replies: 0, bookings: 0 } }
        ];
    for (const provider of providers) {
      const name = clean(provider.provider, 100);
      if (!name) continue;
      const row = db
        .prepare("SELECT * FROM growth_rank_bot_integrations WHERE audit_id = ? AND tenant_id = ? AND provider = ?")
        .get(audit.id, access.tenantId, name);
      const metrics = {
        provider: name,
        status: clean(provider.status || "manual_synced", 60),
        metrics: provider.metrics || {},
        setup: provider.setup || "",
        syncedBy: access.userId || "system-user",
        source: clean(payload.source || "manual_kpi_import", 80)
      };
      if (row) {
        db.prepare(`
          UPDATE growth_rank_bot_integrations
          SET status = ?, metrics_json = ?, last_sync_at = ?, updated_at = ?
          WHERE id = ? AND tenant_id = ?
        `).run(metrics.status, JSON.stringify(metrics), stamp, stamp, row.id, access.tenantId);
      } else {
        db.prepare(`
          INSERT INTO growth_rank_bot_integrations (
            id, tenant_id, branch_id, audit_id, provider, status, scopes, metrics_json,
            last_sync_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(makeId(), access.tenantId, audit.branchId || "", audit.id, name, metrics.status, "", JSON.stringify(metrics), stamp, stamp, stamp);
      }
    }
    return this.workspaceForAudit(audit.id, access).integrations;
  }

  generateWeeklyReport(auditId, payload = {}, access = {}) {
    const audit = this.getAudit(auditId, access);
    const stamp = now();
    const workspace = audit.workspace || this.workspaceForAudit(audit.id, access);
    const token = workspace.portalSessions?.[0]?.portalToken || workspace.client?.portalToken || portalToken();
    const openTasks = (workspace.tasks || []).filter((item) => item.status !== "done").length;
    const approvedContent = (workspace.contentFactory || []).filter((item) => item.status === "approved").length;
    const highRiskReviews = (workspace.reviewEngine || []).filter((item) => item.riskLevel === "high").length;
    const payloadJson = {
      report: {
        title: `${audit.businessName} executive weekly growth report`,
        generatedAt: stamp,
        summary: [
          `${workspace.rankKeywords?.length || 0} rank keywords tracked`,
          `${workspace.attributionEvents?.length || 0} source-to-booking attribution rows`,
          `${approvedContent}/${workspace.contentFactory?.length || 0} content drafts approved`,
          `${highRiskReviews} high-priority review alerts`
        ],
        nextActions: audit.plan?.priorityActions || []
      },
      scorecard: {
        rankReadinessScore: audit.score,
        openTasks,
        trackedKeywords: workspace.rankKeywords?.length || 0,
        contentFactoryItems: workspace.contentFactory?.length || 0,
        attributionEvents: workspace.attributionEvents?.length || 0,
        reviewAlerts: highRiskReviews
      },
      whiteLabel: audit.plan?.advancedGrowthSystem?.autonomousAgencyOs?.whiteLabelReporting || {},
      note: clean(payload.note || "Generated from live growth workspace rows", 240)
    };
    const reportId = makeId();
    db.prepare(`
      INSERT INTO growth_rank_bot_reports (
        id, tenant_id, branch_id, audit_id, report_type, title, portal_token, status,
        payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId,
      access.tenantId,
      audit.branchId || "",
      audit.id,
      "executive_weekly",
      payloadJson.report.title,
      token,
      "ready",
      JSON.stringify(payloadJson),
      stamp,
      stamp
    );
    return this.reportRow(db.prepare("SELECT * FROM growth_rank_bot_reports WHERE id = ? AND tenant_id = ?").get(reportId, access.tenantId));
  }

  askGrowthCopilot(auditId, payload = {}, access = {}) {
    const audit = this.getAudit(auditId, access);
    const question = clean(payload.question || "", 400);
    if (!question) throw badRequest("question is required for AI Growth Copilot");
    const answer = this.buildGrowthCopilotAnswer(audit, question);
    const stamp = now();
    const rowId = makeId();
    db.prepare(`
      INSERT INTO growth_rank_bot_copilot_chats (
        id, tenant_id, branch_id, audit_id, question, answer, intent, confidence,
        status, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rowId,
      access.tenantId,
      audit.branchId || "",
      audit.id,
      question,
      answer.answer,
      answer.intent,
      answer.confidence,
      "answered",
      JSON.stringify(answer),
      stamp,
      stamp
    );
    return this.copilotChatRow(db.prepare("SELECT * FROM growth_rank_bot_copilot_chats WHERE id = ? AND tenant_id = ?").get(rowId, access.tenantId));
  }

  buildGrowthCopilotAnswer(audit, question) {
    const workspace = audit.workspace || {};
    const q = question.toLowerCase();
    const openTasks = (workspace.tasks || []).filter((item) => item.status !== "done").length;
    const pendingApprovals = (workspace.publishingPlanner || []).filter((item) => item.approvalStatus !== "approved").length;
    const riskyReview = (workspace.reviewEngine || []).find((item) => item.riskLevel === "high");
    const topCampaign = [...(workspace.campaignProfit || [])].sort((a, b) => Number(b.profit || 0) - Number(a.profit || 0))[0];
    const openAlert = (workspace.competitorAlerts || []).find((item) => item.status !== "resolved");
    const keywordDrop = (workspace.rankKeywords || []).filter((item) => Number(item.currentRank || 0) > 10).slice(0, 3);
    const contentDraft = (workspace.contentFactory || []).find((item) => item.status !== "approved") || (workspace.contentFactory || [])[0];
    const service = audit.input?.topServices?.[0] || "hero service";
    const place = audit.targetArea || audit.city || audit.input?.targetArea || "target area";

    if (/rank|ranking|down|kyu|neeche|drop/.test(q)) {
      const keywords = keywordDrop.length ? keywordDrop.map((item) => `${item.keyword} rank ${item.currentRank || "awaiting sync"}`).join(", ") : "no synced keyword drop row yet";
      return {
        intent: "rank_diagnosis",
        confidence: 92,
        answer: `${audit.businessName} ka score ${audit.score} hai. Live tracker me ${keywords}. Immediate plan: Google profile freshness, review response SLA, ${service} proof post, and one local SEO page for ${place}. ${openTasks} open execution tasks pending hain.`
      };
    }

    if (/post|content|reel|aaj|today/.test(q)) {
      return {
        intent: "content_next_best_action",
        confidence: 90,
        answer: `Aaj ${contentDraft?.channel || "Instagram"} par "${contentDraft?.topic || `${service} proof content`}" publish-ready draft use karein. Approval pending count ${pendingApprovals} hai, isliye pehle content approval complete karein, phir same CTA ko Google post aur WhatsApp follow-up me reuse karein.`
      };
    }

    if (/offer|discount|campaign/.test(q)) {
      const source = topCampaign ? `${topCampaign.campaignName} profit INR ${topCampaign.profit}, ROI ${topCampaign.roiPercent}%` : "campaign profit rows not synced yet";
      return {
        intent: "offer_recommendation",
        confidence: 88,
        answer: `${service} weekday slot offer chalayein, kyunki profit engine reference: ${source}. Offer me expiry, limited slots, and WhatsApp booking link rakhein; discount tabhi badhayein jab booking value margin cover kare.`
      };
    }

    if (/profit|roi|revenue|booking|lead/.test(q)) {
      const source = topCampaign ? `${topCampaign.source}: spend INR ${topCampaign.spend}, leads ${topCampaign.leads}, bookings ${topCampaign.bookings}, revenue INR ${topCampaign.revenue}, profit INR ${topCampaign.profit}` : "no campaign profit rows yet";
      return {
        intent: "profit_summary",
        confidence: 91,
        answer: `Best current signal: ${source}. Next action: top campaign ko repeat karein, weak source ka spend pause karein, aur booking IDs ko attribution rows se match karein.`
      };
    }

    if (/competitor|watch|active|counter/.test(q)) {
      return {
        intent: "competitor_watch",
        confidence: 89,
        answer: openAlert
          ? `${openAlert.competitorName} ke liye ${openAlert.signalType} alert open hai. Recommended counter: ${openAlert.recommendedAction}`
          : `No open competitor alert found. Weekly manual/API watch me offer, review, post aur rating-change signals add karein, phir ${service} proof campaign se counter karein.`
      };
    }

    if (/review|rating|negative/.test(q)) {
      return {
        intent: "review_defense",
        confidence: 87,
        answer: riskyReview
          ? `High-risk review queue me ${riskyReview.reviewType} pending hai. Manager approval ke baad AI reply send karein, service recovery checklist run karein, aur staff training tag add karein.`
          : "No high-risk review alert open hai. Review request automation honest-feedback mode me rakhein and every review ka response under 24 hours target karein."
      };
    }

    return {
      intent: "growth_summary",
      confidence: 84,
      answer: `${audit.businessName} ke live workspace me ${workspace.rankKeywords?.length || 0} keywords, ${workspace.campaignProfit?.length || 0} campaign ROI rows, ${workspace.publishingPlanner?.length || 0} planner items, ${workspace.seoPages?.length || 0} SEO pages aur ${workspace.competitorAlerts?.length || 0} competitor alerts hain. Next best action: one proof reel, one Google post, one review-request batch and one high-priority task close karein.`
    };
  }

  recordCampaignProfit(auditId, payload = {}, access = {}) {
    const audit = this.getAudit(auditId, access);
    const stamp = now();
    const spend = money(payload.spend);
    const leads = Math.max(0, Math.round(Number(payload.leads || 0)));
    const bookings = Math.max(0, Math.round(Number(payload.bookings || 0)));
    const revenue = money(payload.revenue);
    const cost = money(payload.fulfillmentCost || Math.round(revenue * 0.42));
    const profit = Math.max(0, revenue - spend - cost);
    const rowId = makeId();
    db.prepare(`
      INSERT INTO growth_rank_bot_campaign_profit (
        id, tenant_id, branch_id, audit_id, campaign_name, source, spend, leads,
        bookings, revenue, profit, roi_percent, status, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rowId,
      access.tenantId,
      audit.branchId || "",
      audit.id,
      clean(payload.campaignName || `${audit.businessName} growth campaign`, 160),
      clean(payload.source || "Manual campaign", 80),
      spend,
      leads,
      bookings,
      revenue,
      profit,
      roiPercent(profit, spend),
      clean(payload.status || "tracked", 60),
      JSON.stringify({ ...payload, fulfillmentCost: cost, calculatedAt: stamp }),
      stamp,
      stamp
    );
    return this.campaignProfitRow(db.prepare("SELECT * FROM growth_rank_bot_campaign_profit WHERE id = ? AND tenant_id = ?").get(rowId, access.tenantId));
  }

  schedulePublishingItem(auditId, payload = {}, access = {}) {
    const audit = this.getAudit(auditId, access);
    const stamp = now();
    const rowId = makeId();
    db.prepare(`
      INSERT INTO growth_rank_bot_publishing_planner (
        id, tenant_id, branch_id, audit_id, content_id, channel, title,
        scheduled_for, approval_status, publish_status, provider, payload_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rowId,
      access.tenantId,
      audit.branchId || "",
      audit.id,
      clean(payload.contentId || "", 80),
      clean(payload.channel || "Instagram", 80),
      clean(payload.title || `${audit.businessName} approved content`, 160),
      clean(payload.scheduledFor || addDaysIso(1), 40),
      clean(payload.approvalStatus || "approved", 60),
      clean(payload.publishStatus || "scheduled_draft", 60),
      clean(payload.provider || "Meta Graph API", 100),
      JSON.stringify({ ...payload, scheduledBy: access.userId || "system-user" }),
      stamp,
      stamp
    );
    return this.publishingPlannerRow(db.prepare("SELECT * FROM growth_rank_bot_publishing_planner WHERE id = ? AND tenant_id = ?").get(rowId, access.tenantId));
  }

  generateSeoPages(auditId, payload = {}, access = {}) {
    const audit = this.getAudit(auditId, access);
    const existing = this.workspaceForAudit(audit.id, access).seoPages;
    if (existing.length && payload.force !== true) return { generated: 0, pages: existing };
    const stamp = now();
    const pages = Array.isArray(payload.pages) && payload.pages.length
      ? payload.pages
      : audit.plan?.advancedGrowthSystem?.localSeoWebsiteBuilder?.pages || [];
    let generated = 0;
    for (const page of pages.slice(0, 20)) {
      db.prepare(`
        INSERT INTO growth_rank_bot_seo_pages (
          id, tenant_id, branch_id, audit_id, page_type, slug, title, target_keyword,
          whatsapp_cta, tracking_url, status, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        access.tenantId,
        audit.branchId || "",
        audit.id,
        clean(page.pageType || page.type || "service", 60),
        clean(page.slug || slugify(page.title || page.targetKeyword || "seo page"), 140),
        clean(page.title || `${audit.businessName} local SEO page`, 180),
        clean(page.targetKeyword || "", 140),
        clean(page.whatsappCta || "", 260),
        clean(page.trackingUrl || "", 260),
        clean(page.status || "draft", 60),
        JSON.stringify({ ...page, generatedBy: access.userId || "system-user" }),
        stamp,
        stamp
      );
      generated += 1;
    }
    return { generated, pages: this.workspaceForAudit(audit.id, access).seoPages };
  }

  createCompetitorAlert(auditId, payload = {}, access = {}) {
    const audit = this.getAudit(auditId, access);
    const fallback = audit.plan?.advancedGrowthSystem?.aiCompetitorWatch?.alerts?.[0] || {};
    const stamp = now();
    const rowId = makeId();
    db.prepare(`
      INSERT INTO growth_rank_bot_competitor_alerts (
        id, tenant_id, branch_id, audit_id, competitor_name, signal_type, severity,
        recommended_action, status, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rowId,
      access.tenantId,
      audit.branchId || "",
      audit.id,
      clean(payload.competitorName || fallback.competitorName || "Competitor", 140),
      clean(payload.signalType || fallback.signalType || "new_offer", 80),
      clean(payload.severity || fallback.severity || "high", 40),
      clean(payload.recommendedAction || fallback.recommendedAction || "Launch counter offer within 24 hours", 260),
      clean(payload.status || "open", 60),
      JSON.stringify({ ...fallback, ...payload, createdBy: access.userId || "system-user" }),
      stamp,
      stamp
    );
    return this.competitorAlertRow(db.prepare("SELECT * FROM growth_rank_bot_competitor_alerts WHERE id = ? AND tenant_id = ?").get(rowId, access.tenantId));
  }

  updateProposalStatus(id, payload = {}, access = {}) {
    if (!access.tenantId) throw badRequest("Tenant context is required");
    tenantService.ensureSubscriptionActive(access.tenantId);
    const row = db.prepare("SELECT * FROM growth_rank_bot_proposals WHERE id = ? AND tenant_id = ?").get(clean(id, 80), access.tenantId);
    if (!row) throw notFound("Growth rank proposal not found");
    if (row.branch_id) tenantService.assertBranchAccess(access, row.branch_id);
    const status = clean(payload.status || row.status || "sent", 60);
    const invoiceStatus = clean(payload.invoiceStatus || row.invoice_status || "draft", 60);
    const renewalAt = clean(payload.renewalAt || row.renewal_at || addDaysIso(30), 40);
    const currentPayload = parseJson(row.payload_json, {});
    db.prepare(`
      UPDATE growth_rank_bot_proposals
      SET status = ?, invoice_status = ?, renewal_at = ?, payload_json = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `).run(
      status,
      invoiceStatus,
      renewalAt,
      JSON.stringify({ ...currentPayload, lastStatusChangeAt: now(), status, invoiceStatus }),
      now(),
      row.id,
      access.tenantId
    );
    return this.proposalRow(db.prepare("SELECT * FROM growth_rank_bot_proposals WHERE id = ? AND tenant_id = ?").get(row.id, access.tenantId));
  }

  runAutoTaskBatch(auditId, payload = {}, access = {}) {
    const audit = this.getAudit(auditId, access);
    const tasks = audit.plan?.advancedGrowthSystem?.autoGrowthTasks || [];
    if (!tasks.length) throw badRequest("No auto growth tasks available for this audit");
    const stamp = now();
    const batchId = makeId();
    const inserted = [];
    for (const task of tasks) {
      const taskId = makeId();
      db.prepare(`
        INSERT INTO growth_rank_bot_tasks (
          id, tenant_id, branch_id, audit_id, title, channel, due_date, owner_role,
          priority, status, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        taskId,
        access.tenantId,
        audit.branchId || "",
        audit.id,
        task.title,
        task.channel || "",
        task.dueDate || addDaysIso(1),
        task.ownerRole || "growth-manager",
        task.priority || "medium",
        "open",
        JSON.stringify({ ...task, batchId, generatedBy: "manual_auto_task_run", note: clean(payload.note || "", 180) }),
        stamp,
        stamp
      );
      inserted.push(this.taskRow(db.prepare("SELECT * FROM growth_rank_bot_tasks WHERE id = ? AND tenant_id = ?").get(taskId, access.tenantId)));
    }
    return { batchId, tasks: inserted };
  }

  persistAgencyWorkspace(audit, access) {
    const plan = audit.plan || {};
    const stamp = now();
    const token = portalToken();
    const clientId = makeId();
    db.prepare(`
      INSERT INTO growth_rank_bot_clients (
        id, tenant_id, branch_id, audit_id, business_name, package_name, monthly_fee,
        renewal_at, portal_token, status, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      clientId,
      audit.tenantId,
      audit.branchId,
      audit.id,
      audit.input.businessName,
      audit.input.packageName || plan.agencySaas?.clientPortfolio?.packageName || "Growth Pro",
      Number(audit.input.monthlyFee || plan.agencySaas?.clientPortfolio?.monthlyFee || 0),
      plan.agencySaas?.clientPortfolio?.renewalAt || addDaysIso(30),
      token,
      "active",
      JSON.stringify({ input: audit.input, portfolio: plan.agencySaas?.clientPortfolio || {}, portal: plan.integrationHub?.clientPortal || {} }),
      stamp,
      stamp
    );

    for (const task of plan.automationDashboard?.dailyTaskBoard || []) {
      db.prepare(`
        INSERT INTO growth_rank_bot_tasks (
          id, tenant_id, branch_id, audit_id, title, channel, due_date, owner_role,
          priority, status, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        audit.tenantId,
        audit.branchId,
        audit.id,
        task.title,
        task.channel || "",
        task.dueDate || "",
        task.ownerRole || "growth-manager",
        task.priority || "medium",
        "open",
        JSON.stringify(task),
        stamp,
        stamp
      );
    }

    for (const lead of plan.automationDashboard?.leadTracking || []) {
      db.prepare(`
        INSERT INTO growth_rank_bot_leads (
          id, tenant_id, branch_id, audit_id, source, lead_name, intent, stage,
          payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        audit.tenantId,
        audit.branchId,
        audit.id,
        lead.source,
        lead.leadName || "",
        lead.intent || "",
        lead.stage || "new",
        JSON.stringify(lead),
        stamp,
        stamp
      );
    }

    for (const approval of plan.automationDashboard?.approvalWorkflow || []) {
      db.prepare(`
        INSERT INTO growth_rank_bot_content_approvals (
          id, tenant_id, branch_id, audit_id, content_type, title, status,
          payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        audit.tenantId,
        audit.branchId,
        audit.id,
        approval.contentType || "content",
        approval.title,
        approval.status || "draft",
        JSON.stringify(approval),
        stamp,
        stamp
      );
    }

    db.prepare(`
      INSERT INTO growth_rank_bot_reports (
        id, tenant_id, branch_id, audit_id, report_type, title, portal_token, status,
        payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      makeId(),
      audit.tenantId,
      audit.branchId,
      audit.id,
      "weekly",
      plan.automationDashboard?.weeklyReport?.title || `${audit.input.businessName} weekly growth report`,
      token,
      "ready",
      JSON.stringify({
        report: plan.automationDashboard?.weeklyReport || {},
        whiteLabel: plan.agencySaas?.whiteLabelReports || {},
        summary: plan.priorityActions || []
      }),
      stamp,
      stamp
    );

    for (const provider of plan.integrationHub?.providers || []) {
      db.prepare(`
        INSERT INTO growth_rank_bot_integrations (
          id, tenant_id, branch_id, audit_id, provider, status, scopes, metrics_json,
          last_sync_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        audit.tenantId,
        audit.branchId,
        audit.id,
        provider.provider,
        provider.status || "not_connected",
        (provider.scopes || []).join(","),
        JSON.stringify(provider),
        "",
        stamp,
        stamp
      );
    }

    this.persistAdvancedWorkspace(audit, token, stamp);
  }

  persistAdvancedWorkspace(audit, token, stamp) {
    const advanced = audit.plan?.advancedGrowthSystem || {};
    for (const keyword of advanced.rankTracker?.keywords || []) {
      const keywordId = makeId();
      db.prepare(`
        INSERT INTO growth_rank_bot_rank_keywords (
          id, tenant_id, branch_id, audit_id, keyword, target_area, target_url,
          best_rank, current_rank, previous_rank, status, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        keywordId,
        audit.tenantId,
        audit.branchId,
        audit.id,
        keyword.keyword,
        keyword.targetArea || audit.input.targetArea || "",
        keyword.targetUrl || audit.input.googleProfileUrl || "",
        Number(keyword.bestRank || 0),
        Number(keyword.currentRank || 0),
        Number(keyword.previousRank || 0),
        keyword.status || "waiting_for_first_sync",
        JSON.stringify(keyword),
        stamp,
        stamp
      );
      db.prepare(`
        INSERT INTO growth_rank_bot_rank_snapshots (
          id, tenant_id, branch_id, audit_id, keyword_id, keyword, rank_position,
          checked_at, source, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        audit.tenantId,
        audit.branchId,
        audit.id,
        keywordId,
        keyword.keyword,
        Number(keyword.currentRank || 0),
        "",
        keyword.source || "manual_or_api_import",
        JSON.stringify({ ...keyword, note: "waiting for first approved API/manual rank import" }),
        stamp
      );
    }

    for (const competitor of advanced.competitorIntelligencePro?.competitors || []) {
      db.prepare(`
        INSERT INTO growth_rank_bot_competitor_signals (
          id, tenant_id, branch_id, audit_id, competitor_name, google_strength,
          review_score, review_count, content_frequency, offer_signal, instagram_activity,
          payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        audit.tenantId,
        audit.branchId,
        audit.id,
        competitor.name,
        Number(competitor.googleStrength || 0),
        Number(competitor.reviewScore || 0),
        Number(competitor.reviewCount || 0),
        competitor.contentFrequency || "",
        competitor.offerSignal || "",
        competitor.instagramActivity || "",
        JSON.stringify(competitor),
        stamp,
        stamp
      );
    }

    for (const item of advanced.contentFactory90 || []) {
      db.prepare(`
        INSERT INTO growth_rank_bot_content_factory (
          id, tenant_id, branch_id, audit_id, day_number, channel, format, topic,
          script, caption, carousel_text, hashtags, offer_copy, festival, status,
          payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        audit.tenantId,
        audit.branchId,
        audit.id,
        Number(item.day || 1),
        item.channel || "",
        item.format || "",
        item.topic || "",
        item.script || "",
        item.caption || "",
        Array.isArray(item.carouselText) ? item.carouselText.join(" | ") : clean(item.carouselText || "", 500),
        Array.isArray(item.hashtags) ? item.hashtags.join(" ") : clean(item.hashtags || "", 500),
        item.offerCopy || "",
        item.festival || "",
        item.status || "draft",
        JSON.stringify(item),
        stamp,
        stamp
      );
    }

    for (const source of advanced.leadAttribution?.sources || []) {
      db.prepare(`
        INSERT INTO growth_rank_bot_attribution_events (
          id, tenant_id, branch_id, audit_id, source, lead_name, event_type,
          booking_id, estimated_value, status, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        audit.tenantId,
        audit.branchId,
        audit.id,
        source.source,
        `${source.source} pipeline`,
        source.eventType || "source_ready",
        "",
        Number(source.estimatedValue || 0),
        source.status || "tracking_ready",
        JSON.stringify(source),
        stamp,
        stamp
      );
    }

    for (const workflow of advanced.reviewGrowthEngine?.workflows || []) {
      db.prepare(`
        INSERT INTO growth_rank_bot_review_engine (
          id, tenant_id, branch_id, audit_id, review_type, customer_name, rating,
          sentiment, request_script, ai_reply, risk_level, status, payload_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        audit.tenantId,
        audit.branchId,
        audit.id,
        workflow.reviewType || "",
        workflow.customerName || "",
        Number(workflow.rating || 0),
        workflow.sentiment || "",
        workflow.requestScript || "",
        workflow.aiReply || "",
        workflow.riskLevel || "normal",
        workflow.status || "draft",
        JSON.stringify(workflow),
        stamp,
        stamp
      );
    }

    for (const task of advanced.autoGrowthTasks || []) {
      db.prepare(`
        INSERT INTO growth_rank_bot_tasks (
          id, tenant_id, branch_id, audit_id, title, channel, due_date, owner_role,
          priority, status, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId(),
        audit.tenantId,
        audit.branchId,
        audit.id,
        task.title,
        task.channel || "",
        task.dueDate || "",
        task.ownerRole || "growth-manager",
        task.priority || "medium",
        "open",
        JSON.stringify({ ...task, generatedBy: "auto_growth_tasks" }),
        stamp,
        stamp
      );
    }

    const proposal = advanced.proposalBilling || {};
    db.prepare(`
      INSERT INTO growth_rank_bot_proposals (
        id, tenant_id, branch_id, audit_id, title, monthly_fee, package_name,
        status, renewal_at, invoice_status, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      makeId(),
      audit.tenantId,
      audit.branchId,
      audit.id,
      proposal.proposalTitle || `${audit.input.businessName} growth proposal`,
      Number(proposal.monthlyFee || audit.input.monthlyFee || 0),
      proposal.packageName || audit.input.packageName || "Growth Pro",
      "draft",
      proposal.renewalAt || addDaysIso(30),
      proposal.invoiceStatus || "draft",
      JSON.stringify(proposal),
      stamp,
      stamp
    );

    const portal = advanced.clientPortalPro || {};
    db.prepare(`
      INSERT INTO growth_rank_bot_portal_sessions (
        id, tenant_id, branch_id, audit_id, portal_token, client_email, status,
        payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      makeId(),
      audit.tenantId,
      audit.branchId,
      audit.id,
      token,
      portal.clientEmail || audit.input.clientEmail || "",
      "active",
      JSON.stringify({ ...portal, tokenStrategy: "shared_with_report_token" }),
      stamp,
      stamp
    );

    this.persistLevel11To15Workspace(audit, stamp);
  }

  persistLevel11To15Workspace(audit, stamp = now(), options = {}) {
    const advanced = audit.plan?.advancedGrowthSystem || {};
    const shouldInsert = (table) => {
      if (!options.ifEmpty) return true;
      const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE audit_id = ? AND tenant_id = ?`).get(audit.id, audit.tenantId);
      return !Number(row?.count || 0);
    };

    if (shouldInsert("growth_rank_bot_copilot_chats")) {
      for (const answer of advanced.aiGrowthCopilot?.sampleAnswers || []) {
        db.prepare(`
          INSERT INTO growth_rank_bot_copilot_chats (
            id, tenant_id, branch_id, audit_id, question, answer, intent, confidence,
            status, payload_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          makeId(),
          audit.tenantId,
          audit.branchId || "",
          audit.id,
          answer.question || "growth copilot question",
          answer.answer || "",
          answer.intent || "growth_advice",
          88,
          "answered",
          JSON.stringify({ seed: true, copilot: advanced.aiGrowthCopilot || {} }),
          stamp,
          stamp
        );
      }
    }

    if (shouldInsert("growth_rank_bot_campaign_profit")) {
      for (const campaign of advanced.campaignProfitEngine?.campaigns || []) {
        db.prepare(`
          INSERT INTO growth_rank_bot_campaign_profit (
            id, tenant_id, branch_id, audit_id, campaign_name, source, spend,
            leads, bookings, revenue, profit, roi_percent, status, payload_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          makeId(),
          audit.tenantId,
          audit.branchId || "",
          audit.id,
          campaign.campaignName || "Growth campaign",
          campaign.source || "",
          Number(campaign.spend || 0),
          Number(campaign.leads || 0),
          Number(campaign.bookings || 0),
          Number(campaign.revenue || 0),
          Number(campaign.profit || 0),
          Number(campaign.roiPercent || 0),
          campaign.status || "tracking_ready",
          JSON.stringify(campaign),
          stamp,
          stamp
        );
      }
    }

    if (shouldInsert("growth_rank_bot_publishing_planner")) {
      for (const item of advanced.approvalPublishingPlanner?.scheduledItems || []) {
        db.prepare(`
          INSERT INTO growth_rank_bot_publishing_planner (
            id, tenant_id, branch_id, audit_id, content_id, channel, title,
            scheduled_for, approval_status, publish_status, provider, payload_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          makeId(),
          audit.tenantId,
          audit.branchId || "",
          audit.id,
          item.contentId || "",
          item.channel || "",
          item.title || "Publishing item",
          item.scheduledFor || addDaysIso(1),
          item.approvalStatus || "pending_approval",
          item.publishStatus || "scheduled_draft",
          item.provider || "",
          JSON.stringify(item),
          stamp,
          stamp
        );
      }
    }

    if (shouldInsert("growth_rank_bot_seo_pages")) {
      for (const page of advanced.localSeoWebsiteBuilder?.pages || []) {
        db.prepare(`
          INSERT INTO growth_rank_bot_seo_pages (
            id, tenant_id, branch_id, audit_id, page_type, slug, title,
            target_keyword, whatsapp_cta, tracking_url, status, payload_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          makeId(),
          audit.tenantId,
          audit.branchId || "",
          audit.id,
          page.pageType || "",
          page.slug || slugify(page.title || "seo page"),
          page.title || "Local SEO page",
          page.targetKeyword || "",
          page.whatsappCta || "",
          page.trackingUrl || "",
          page.status || "draft",
          JSON.stringify(page),
          stamp,
          stamp
        );
      }
    }

    if (shouldInsert("growth_rank_bot_competitor_alerts")) {
      for (const alert of advanced.aiCompetitorWatch?.alerts || []) {
        db.prepare(`
          INSERT INTO growth_rank_bot_competitor_alerts (
            id, tenant_id, branch_id, audit_id, competitor_name, signal_type,
            severity, recommended_action, status, payload_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          makeId(),
          audit.tenantId,
          audit.branchId || "",
          audit.id,
          alert.competitorName || "Competitor",
          alert.signalType || "",
          alert.severity || "medium",
          alert.recommendedAction || "",
          alert.status || "open",
          JSON.stringify(alert),
          stamp,
          stamp
        );
      }
    }
  }

  workspaceForAudit(auditId, access = {}) {
    const params = [clean(auditId, 80), access.tenantId];
    return {
      client: this.clientRow(db.prepare("SELECT * FROM growth_rank_bot_clients WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 1").get(...params)),
      tasks: db.prepare("SELECT * FROM growth_rank_bot_tasks WHERE audit_id = ? AND tenant_id = ? ORDER BY due_date ASC LIMIT 50").all(...params).map(this.taskRow),
      leads: db.prepare("SELECT * FROM growth_rank_bot_leads WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 50").all(...params).map(this.leadRow),
      approvals: db.prepare("SELECT * FROM growth_rank_bot_content_approvals WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 50").all(...params).map(this.approvalRow),
      reports: db.prepare("SELECT * FROM growth_rank_bot_reports WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 10").all(...params).map(this.reportRow),
      integrations: db.prepare("SELECT * FROM growth_rank_bot_integrations WHERE audit_id = ? AND tenant_id = ? ORDER BY provider ASC LIMIT 20").all(...params).map(this.integrationRow),
      rankKeywords: db.prepare("SELECT * FROM growth_rank_bot_rank_keywords WHERE audit_id = ? AND tenant_id = ? ORDER BY keyword ASC LIMIT 100").all(...params).map(this.rankKeywordRow),
      rankSnapshots: db.prepare("SELECT * FROM growth_rank_bot_rank_snapshots WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 100").all(...params).map(this.rankSnapshotRow),
      competitorSignals: db.prepare("SELECT * FROM growth_rank_bot_competitor_signals WHERE audit_id = ? AND tenant_id = ? ORDER BY google_strength DESC LIMIT 50").all(...params).map(this.competitorSignalRow),
      contentFactory: db.prepare("SELECT * FROM growth_rank_bot_content_factory WHERE audit_id = ? AND tenant_id = ? ORDER BY day_number ASC LIMIT 120").all(...params).map(this.contentFactoryRow),
      attributionEvents: db.prepare("SELECT * FROM growth_rank_bot_attribution_events WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 100").all(...params).map(this.attributionEventRow),
      reviewEngine: db.prepare("SELECT * FROM growth_rank_bot_review_engine WHERE audit_id = ? AND tenant_id = ? ORDER BY risk_level DESC, datetime(created_at) DESC LIMIT 50").all(...params).map(this.reviewEngineRow),
      proposals: db.prepare("SELECT * FROM growth_rank_bot_proposals WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 10").all(...params).map(this.proposalRow),
      portalSessions: db.prepare("SELECT * FROM growth_rank_bot_portal_sessions WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 10").all(...params).map(this.portalSessionRow),
      copilotChats: db.prepare("SELECT * FROM growth_rank_bot_copilot_chats WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 50").all(...params).map(this.copilotChatRow),
      campaignProfit: db.prepare("SELECT * FROM growth_rank_bot_campaign_profit WHERE audit_id = ? AND tenant_id = ? ORDER BY roi_percent DESC LIMIT 50").all(...params).map(this.campaignProfitRow),
      publishingPlanner: db.prepare("SELECT * FROM growth_rank_bot_publishing_planner WHERE audit_id = ? AND tenant_id = ? ORDER BY scheduled_for ASC LIMIT 50").all(...params).map(this.publishingPlannerRow),
      seoPages: db.prepare("SELECT * FROM growth_rank_bot_seo_pages WHERE audit_id = ? AND tenant_id = ? ORDER BY page_type ASC, title ASC LIMIT 50").all(...params).map(this.seoPageRow),
      competitorAlerts: db.prepare("SELECT * FROM growth_rank_bot_competitor_alerts WHERE audit_id = ? AND tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 50").all(...params).map(this.competitorAlertRow)
    };
  }

  clientRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      businessName: row.business_name,
      packageName: row.package_name,
      monthlyFee: Number(row.monthly_fee || 0),
      renewalAt: row.renewal_at,
      portalToken: row.portal_token,
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  taskRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      title: row.title,
      channel: row.channel,
      dueDate: row.due_date,
      ownerRole: row.owner_role,
      priority: row.priority,
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  leadRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      source: row.source,
      leadName: row.lead_name,
      intent: row.intent,
      stage: row.stage,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  approvalRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      contentType: row.content_type,
      title: row.title,
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  reportRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      reportType: row.report_type,
      title: row.title,
      portalToken: row.portal_token,
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  integrationRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      provider: row.provider,
      status: row.status,
      scopes: row.scopes ? row.scopes.split(",").filter(Boolean) : [],
      metrics: parseJson(row.metrics_json, {}),
      lastSyncAt: row.last_sync_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  rankKeywordRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      keyword: row.keyword,
      targetArea: row.target_area,
      targetUrl: row.target_url,
      bestRank: Number(row.best_rank || 0),
      currentRank: Number(row.current_rank || 0),
      previousRank: Number(row.previous_rank || 0),
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  rankSnapshotRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      keywordId: row.keyword_id,
      keyword: row.keyword,
      rankPosition: Number(row.rank_position || 0),
      checkedAt: row.checked_at,
      source: row.source,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at
    };
  }

  competitorSignalRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      competitorName: row.competitor_name,
      googleStrength: Number(row.google_strength || 0),
      reviewScore: Number(row.review_score || 0),
      reviewCount: Number(row.review_count || 0),
      contentFrequency: row.content_frequency,
      offerSignal: row.offer_signal,
      instagramActivity: row.instagram_activity,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  contentFactoryRow(row) {
    if (!row) return null;
    const payload = parseJson(row.payload_json, {});
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      day: Number(row.day_number || 1),
      channel: row.channel,
      format: row.format,
      topic: row.topic,
      script: row.script,
      caption: row.caption,
      carouselText: payload.carouselText || row.carousel_text,
      hashtags: payload.hashtags || row.hashtags,
      offerCopy: row.offer_copy,
      festival: row.festival,
      status: row.status,
      payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  attributionEventRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      source: row.source,
      leadName: row.lead_name,
      eventType: row.event_type,
      bookingId: row.booking_id,
      estimatedValue: Number(row.estimated_value || 0),
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  reviewEngineRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      reviewType: row.review_type,
      customerName: row.customer_name,
      rating: Number(row.rating || 0),
      sentiment: row.sentiment,
      requestScript: row.request_script,
      aiReply: row.ai_reply,
      riskLevel: row.risk_level,
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  proposalRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      title: row.title,
      monthlyFee: Number(row.monthly_fee || 0),
      packageName: row.package_name,
      status: row.status,
      renewalAt: row.renewal_at,
      invoiceStatus: row.invoice_status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  portalSessionRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      portalToken: row.portal_token,
      clientEmail: row.client_email,
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  copilotChatRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      question: row.question,
      answer: row.answer,
      intent: row.intent,
      confidence: Number(row.confidence || 0),
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  campaignProfitRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      campaignName: row.campaign_name,
      source: row.source,
      spend: Number(row.spend || 0),
      leads: Number(row.leads || 0),
      bookings: Number(row.bookings || 0),
      revenue: Number(row.revenue || 0),
      profit: Number(row.profit || 0),
      roiPercent: Number(row.roi_percent || 0),
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  publishingPlannerRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      contentId: row.content_id,
      channel: row.channel,
      title: row.title,
      scheduledFor: row.scheduled_for,
      approvalStatus: row.approval_status,
      publishStatus: row.publish_status,
      provider: row.provider,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  seoPageRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      pageType: row.page_type,
      slug: row.slug,
      title: row.title,
      targetKeyword: row.target_keyword,
      whatsappCta: row.whatsapp_cta,
      trackingUrl: row.tracking_url,
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  competitorAlertRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      branchId: row.branch_id,
      competitorName: row.competitor_name,
      signalType: row.signal_type,
      severity: row.severity,
      recommendedAction: row.recommended_action,
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const growthRankBotService = new GrowthRankBotService();
