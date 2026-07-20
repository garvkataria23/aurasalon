import { env } from "../config/env.js";

const DEFAULT_OPENAI_MODEL = "gpt-4.1";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const MAX_BUSINESSES = 12;
const MAX_PHOTOS = 5;
const MAX_BASE64_PHOTO_BYTES = 4 * 1024 * 1024;
const SYSTEM_PROMPT = [
  "You are Aura Shine Live Consultation AI for a salon, spa, barber, nail, skin clinic and wellness marketplace.",
  "Act like a senior salon consultation manager: practical, premium, safety-aware, and booking-ready.",
  "Use the supplied marketplace context only for salon/service recommendations. Do not invent unavailable salons.",
  "If photos are attached, analyze visible hair, skin, nail or style cues carefully. If photos are not attached, say what photos/details are needed instead of pretending to see them.",
  "Do not diagnose medical conditions. Escalate irritation, infection, wounds, pregnancy concerns, active acne treatment, allergies or severe scalp/skin issues to a qualified professional.",
  "Return only valid JSON."
].join(" ");

export async function createLiveConsultation(payload = {}) {
  const request = sanitizeConsultationRequest(payload);
  const local = buildLocalConsultation(request);
  const ai = await maybeRunAiConsultation(request, local).catch((error) => ({
    ...local,
    mode: "local",
    provider: "local_rules",
    providerWarning: error?.message || "AI consultation unavailable"
  }));
  return {
    consultationId: `consult_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...ai
  };
}

function sanitizeConsultationRequest(payload) {
  const message = cleanText(payload.message, 1600);
  const goals = arrayOfText(payload.goals, 8, 80);
  const location = sanitizeLocation(payload.location || {});
  const businesses = Array.isArray(payload.businesses)
    ? payload.businesses.slice(0, MAX_BUSINESSES).map(sanitizeBusiness).filter(Boolean)
    : [];
  const photos = Array.isArray(payload.photos)
    ? payload.photos.slice(0, MAX_PHOTOS).map(sanitizePhoto).filter(Boolean)
    : [];
  const conversation = Array.isArray(payload.conversation)
    ? payload.conversation.slice(-12).map(sanitizeConversationTurn).filter(Boolean)
    : [];
  const problemProfile = sanitizeProblemProfile(payload.problemProfile || payload.problem_profile || {});
  return { message, goals, location, businesses, photos, conversation, problemProfile };
}

function sanitizeConversationTurn(turn) {
  const role = turn?.role === "assistant" ? "assistant" : "customer";
  const text = cleanText(turn?.text, 700);
  return text ? { role, text } : null;
}

function sanitizeProblemProfile(profile) {
  return {
    concern: cleanText(profile.concern, 260),
    timeframe: cleanText(profile.timeframe, 120),
    budget: cleanText(profile.budget, 120),
    event: cleanText(profile.event, 120),
    history: cleanText(profile.history, 220),
    sensitivities: cleanText(profile.sensitivities, 220),
    desiredOutcome: cleanText(profile.desiredOutcome || profile.desired_outcome, 220)
  };
}

function sanitizeLocation(location) {
  return {
    label: cleanText(location.label, 120) || "Current area",
    lat: finiteNumber(location.lat),
    lng: finiteNumber(location.lng)
  };
}

function sanitizeBusiness(business) {
  const services = Array.isArray(business.services)
    ? business.services.slice(0, 8).map((service) => ({
      id: cleanText(service.id, 80),
      name: cleanText(service.name, 120),
      category: cleanText(service.category, 80),
      description: cleanText(service.description, 220),
      pricePaise: finiteNumber(service.pricePaise) || 0,
      durationMinutes: finiteNumber(service.durationMinutes) || 0
    })).filter((service) => service.name)
    : [];
  const item = {
    id: cleanText(business.id, 80),
    slug: cleanText(business.slug, 120),
    businessName: cleanText(business.businessName, 160),
    category: cleanText(business.category, 80),
    description: cleanText(business.description, 260),
    address: cleanText(business.address, 220),
    area: cleanText(business.area, 100),
    city: cleanText(business.city, 100),
    state: cleanText(business.state, 100),
    country: cleanText(business.country, 100),
    phone: cleanText(business.phone || business.mobileNumber || business.appointmentNumber, 80),
    mapsUrl: cleanText(business.mapsUrl, 320),
    ratingAverage: finiteNumber(business.ratingAverage) || 0,
    ratingCount: finiteNumber(business.ratingCount) || 0,
    distanceKm: finiteNumber(business.distanceKm),
    isOpen: Boolean(business.isOpen),
    hoursLabel: cleanText(business.hoursLabel, 120),
    nextAvailableSlot: cleanText(business.nextAvailableSlot, 120),
    startingPricePaise: finiteNumber(business.startingPricePaise) || 0,
    popularService: cleanText(business.popularService, 120),
    services
  };
  return item.businessName ? item : null;
}

function sanitizePhoto(photo) {
  const dataUrl = cleanText(photo.dataUrl, MAX_BASE64_PHOTO_BYTES + 80);
  const type = cleanText(photo.type, 80);
  if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(dataUrl)) return null;
  if (dataUrl.length > MAX_BASE64_PHOTO_BYTES + 80) return null;
  return {
    name: cleanText(photo.name, 140) || "consultation-photo",
    type: type || "image/jpeg",
    sizeBytes: Math.min(finiteNumber(photo.sizeBytes) || 0, MAX_BASE64_PHOTO_BYTES),
    dataUrl
  };
}

async function maybeRunOpenAiConsultation(request, fallback) {
  const apiKey = env.openaiApiKey || process.env.OPENAI_API_KEY || "";
  if (!apiKey) return fallback;

  const prompt = buildConsultationPrompt(request);
  const content = [{ type: "text", text: prompt }];
  request.photos.forEach((photo) => {
    content.push({ type: "image_url", image_url: { url: photo.dataUrl } });
  });

  const response = await callOpenAiChat(apiKey, env.openaiModel || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL, [
    {
      role: "system",
      content: SYSTEM_PROMPT
    },
    { role: "user", content }
  ]);
  let finalResponse = response;
  if (!finalResponse.ok && [400, 404].includes(finalResponse.status) && (env.openaiModel || process.env.OPENAI_MODEL) !== DEFAULT_OPENAI_MODEL) {
    finalResponse = await callOpenAiChat(apiKey, DEFAULT_OPENAI_MODEL, [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      { role: "user", content }
    ]);
  }
  if (!finalResponse.ok) throw new Error(`OpenAI returned ${finalResponse.status}`);
  const data = await finalResponse.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const parsed = parseJsonObject(text);
  return normalizeAiConsultation(parsed, fallback, "openai");
}

async function callOpenAiChat(apiKey, model, messages) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.25,
      max_completion_tokens: 2200,
      response_format: { type: "json_object" }
    })
  });
}


async function maybeRunAiConsultation(request, fallback) {
  const provider = selectedAiProvider();
  if (provider === "gemini") return maybeRunGeminiConsultation(request, fallback);
  if (provider === "local") return fallback;
  return maybeRunOpenAiConsultation(request, fallback);
}

async function maybeRunGeminiConsultation(request, fallback) {
  const apiKey = env.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
  if (!apiKey) return fallback;

  const prompt = buildConsultationPrompt(request);
  const parts = [{ text: prompt }, ...request.photos.map(geminiImagePart).filter(Boolean)];
  const model = encodeURIComponent(env.geminiModel || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 1400,
        responseMimeType: "application/json"
      },
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      }
    })
  });
  if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  const parsed = parseJsonObject(text);
  return normalizeAiConsultation(parsed, fallback, "gemini");
}

function selectedAiProvider() {
  const requested = cleanText(env.liveConsultationProvider || process.env.AI_CONSULTATION_PROVIDER || process.env.LIVE_CONSULTATION_PROVIDER, 40).toLowerCase();
  if (requested === "gemini" || requested === "openai" || requested === "chatgpt" || requested === "local") return requested === "chatgpt" ? "openai" : requested;
  if (env.openaiApiKey || process.env.OPENAI_API_KEY) return "openai";
  if (env.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY) return "gemini";
  return "local";
}

function geminiImagePart(photo) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(photo.dataUrl || "");
  if (!match) return null;
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2]
    }
  };
}

function buildConsultationPrompt(request) {
  return [
    "Create an advanced customer-facing salon consultation using the supplied live marketplace context and conversation history.",
    "First understand the user problem: concern, current condition, desired result, deadline/event, budget, history, sensitivity/allergy flags, previous services, and what is still unknown.",
    "Do not jump straight to salons. Give a consultative answer that explains what the issue likely needs, what to avoid, what to ask next, and only then which services/salons fit.",
    "Think through: customer goal, visible photo cues, hair/skin/nail suitability, risk flags, service sequencing, budget, timing, salon availability, distance, map/contact clues, and booking next steps.",
    "For hair questions, include what hair service should be done: cut, color, gloss, toner, root touch-up, global color, balayage/highlights, keratin/smoothening, repair treatment, scalp/hair spa, styling, or when to avoid chemical service.",
    "For skin/facial questions, include facial type, patch-test/prep, contraindications, and after-care without diagnosis.",
    "For nails/spa/barber/bridal, recommend the right service bundle, prep and appointment sequence.",
    "Location A-to-Z must include area fit, travel clue, full address/area/city when available, open/slot signal, map/contact clue when available, and backup option.",
    "Prefer businesses and services from the supplied context. If the supplied businesses do not fit, say what to search for instead.",
    "Return strict JSON with these keys: answer, concernSummary, consultationStage, confidence, missingInfo, suggestedReplies, visualAssessment, hairPlan, actionPlan, recommendedSalons, recommendedServices, locationInsights, preparationChecklist, afterCare, budgetInsights, followUpQuestions, safetyNote.",
    "answer must be 4-7 customer-facing sentences and should respond to the latest message like a real chat consultant. concernSummary is one sentence. consultationStage is one of: intake, clarification, plan_ready, booking_ready. confidence is one of: low, medium, high. missingInfo and suggestedReplies contain short strings the customer can answer with.",
    "visualAssessment, hairPlan, actionPlan, locationInsights, preparationChecklist, afterCare, budgetInsights and followUpQuestions must each contain 3-6 short practical strings.",
    "recommendedSalons items: businessName, slug, reason, location, distanceKm, rating, openStatus, nextStep.",
    "recommendedServices items: name, businessName, slug, priceLabel, durationLabel, reason.",
    `Latest customer message: ${request.message || "Customer wants a beauty/wellness recommendation."}`,
    `Selected goals: ${request.goals.join(", ") || "not specified"}`,
    `Problem profile: ${JSON.stringify(request.problemProfile)}`,
    `Conversation history: ${JSON.stringify(request.conversation)}`,
    `Customer location: ${JSON.stringify(request.location)}`,
    `Photos attached: ${request.photos.length}`,
    `Marketplace context: ${JSON.stringify(request.businesses)}`
  ].join("\n");
}

function normalizeAiConsultation(parsed, fallback, provider) {
  return {
    mode: provider,
    provider,
    answer: richAnswer(cleanText(parsed.answer, 1600), fallback.answer),
    concernSummary: cleanText(parsed.concernSummary, 320) || fallback.concernSummary,
    consultationStage: cleanText(parsed.consultationStage, 40) || fallback.consultationStage,
    confidence: cleanText(parsed.confidence, 40) || fallback.confidence,
    missingInfo: arrayOrFallback(parsed.missingInfo, fallback.missingInfo, 6, 140),
    suggestedReplies: arrayOrFallback(parsed.suggestedReplies, fallback.suggestedReplies, 5, 120),
    visualAssessment: arrayOrFallback(parsed.visualAssessment, fallback.visualAssessment, 6, 180),
    hairPlan: arrayOrFallback(parsed.hairPlan, fallback.hairPlan, 6, 200),
    actionPlan: arrayOrFallback(parsed.actionPlan, fallback.actionPlan, 6, 180),
    recommendedSalons: normalizeSalonRecommendations(parsed.recommendedSalons, fallback.recommendedSalons),
    recommendedServices: normalizeServiceRecommendations(parsed.recommendedServices, fallback.recommendedServices),
    locationInsights: arrayOrFallback(parsed.locationInsights, fallback.locationInsights, 6, 180),
    preparationChecklist: arrayOrFallback(parsed.preparationChecklist, fallback.preparationChecklist, 6, 170),
    afterCare: arrayOrFallback(parsed.afterCare, fallback.afterCare, 6, 170),
    budgetInsights: arrayOrFallback(parsed.budgetInsights, fallback.budgetInsights, 5, 170),
    followUpQuestions: arrayOrFallback(parsed.followUpQuestions, fallback.followUpQuestions, 5, 160),
    safetyNote: cleanText(parsed.safetyNote, 220) || fallback.safetyNote
  };
}

function buildLocalConsultation(request) {
  const ranked = rankBusinesses(request);
  const services = ranked.flatMap((business) => business.services.slice(0, 3).map((service) => ({ business, service }))).slice(0, 6);
  const goalText = request.goals.length ? request.goals.join(", ") : "your concern";
  const hairPlan = localHairPlan(request);
  const problem = inferProblemContext(request);
  return {
    mode: "local",
    provider: "local_rules",
    answer: `I understand this as ${problem.summary}. ${problem.primaryAdvice} ${problem.riskAdvice} I will keep the salon shortlist secondary until your condition, timing and budget are clear enough for a safe booking.`,
    concernSummary: problem.summary,
    consultationStage: problem.missingInfo.length ? "clarification" : "plan_ready",
    confidence: problem.missingInfo.length > 2 ? "medium" : "high",
    missingInfo: problem.missingInfo,
    suggestedReplies: problem.suggestedReplies,
    visualAssessment: request.photos.length
      ? ["Photos are attached for visual context; confirm current hair/skin history before any chemical or intensive service.", "Use natural-light front, side and back photos for the final staff handoff."]
      : ["No photo is attached yet, so the plan uses your message and marketplace context.", "For hair, add front, side, back and close-up photos in natural light for a sharper recommendation."],
    hairPlan,
    actionPlan: [
      "Confirm the exact concern, current condition, event date, budget and time window.",
      "Shortlist one nearby salon and one backup option.",
      "Choose the safest service sequence with duration, patch-test needs and after-care.",
      "Book the slot, then keep photos, allergy notes and target reference attached for staff handoff."
    ],
    recommendedSalons: ranked.slice(0, 4).map((business) => ({
      businessName: business.businessName,
      slug: business.slug,
      reason: [business.popularService || business.category, business.ratingAverage ? `${business.ratingAverage}/5 rating` : "", business.isOpen ? "open now" : business.hoursLabel].filter(Boolean).join(" | "),
      location: [business.area, business.city, business.state].filter(Boolean).join(", ") || business.address,
      distanceKm: business.distanceKm,
      rating: business.ratingAverage,
      openStatus: business.isOpen ? "Open now" : business.hoursLabel || "Check hours",
      nextStep: business.nextAvailableSlot ? `Book ${business.nextAvailableSlot}` : "View services and available slots"
    })),
    recommendedServices: services.map(({ business, service }) => ({
      name: service.name,
      businessName: business.businessName,
      slug: business.slug,
      priceLabel: moneyLabel(service.pricePaise || business.startingPricePaise),
      durationLabel: service.durationMinutes ? `${service.durationMinutes} min` : "Duration on booking",
      reason: service.description || `Matches ${business.category || "salon"} consultation intent`
    })),
    locationInsights: [
      `Current area: ${request.location.label || "not detected"}.`,
      ranked[0] ? `Best first option: ${ranked[0].businessName} in ${ranked[0].area || ranked[0].city || "nearby area"}.` : "No live salon context is available yet.",
      ranked[0]?.address ? `Address clue: ${ranked[0].address}.` : "Open the salon profile for exact address and directions.",
      ranked[0]?.phone ? `Contact clue: ${ranked[0].phone}.` : "Use in-app booking when phone is not visible.",
      "Check map, travel time, open status and next available slot before confirming."
    ],
    preparationChecklist: [
      "Share previous color/chemical history, allergies, scalp or skin sensitivity and medication/active treatment history.",
      "Carry reference photos and current-condition photos.",
      "Avoid oiling, strong exfoliation or new actives before color/facial services unless the salon advises it.",
      "For color, request strand/patch test when bleach, toner, allergy or major correction is involved."
    ],
    afterCare: [
      "Use the salon-recommended shampoo, conditioner or soothing care for the first week.",
      "Avoid heat, harsh actives, swimming and heavy sweating for the service-specific cool-down window.",
      "Book a follow-up touch-up or review if color, texture or skin response needs adjustment."
    ],
    budgetInsights: [
      services[0] ? `Closest starting point: ${services[0].service.name} at ${moneyLabel(services[0].service.pricePaise || services[0].business.startingPricePaise)}.` : "Ask for a quote before confirming if live prices are not available.",
      "Keep a buffer for add-ons such as toner, treatment mask, nail art, blow-dry, taxes or long-hair charges.",
      "If budget is tight, choose consultation plus maintenance treatment before a high-risk transformation."
    ],
    followUpQuestions: [
      "What result do you want and by when?",
      "Any allergy, sensitivity, previous color, acne treatment or recent procedure?",
      "What budget and travel radius should I keep?",
      "Do you prefer a specific staff gender or specialist?"
    ],
    safetyNote: "This is beauty guidance, not medical diagnosis. For irritation, wounds, infection, pregnancy concerns or active skin conditions, consult a qualified professional before booking."
  };
}

function inferProblemContext(request) {
  const text = [request.message, request.problemProfile.concern, request.problemProfile.history, request.problemProfile.sensitivities, ...request.goals].join(" ").toLowerCase();
  const summary = request.problemProfile.concern || request.message || request.goals.join(", ") || "a beauty or wellness concern that needs consultation before booking";
  const missingInfo = [];
  if (!request.message && !request.problemProfile.concern) missingInfo.push("What exactly is the problem or result you want?");
  if (!request.problemProfile.timeframe && !/(today|tomorrow|week|wedding|event|urgent|date|month)/.test(text)) missingInfo.push("When do you need the result or appointment?");
  if (!request.problemProfile.budget && !/(budget|under|inr|rs\.?|₹|rupee|price)/.test(text)) missingInfo.push("What budget range should I keep?");
  if (!request.problemProfile.history && !/(color|bleach|keratin|smooth|acne|treatment|chemical|last time|previous)/.test(text)) missingInfo.push("Any previous color, chemical, facial, treatment or product history?");
  if (!request.problemProfile.sensitivities && !/(allergy|itch|burn|sensitive|pregnan|wound|infection|acne|medication)/.test(text)) missingInfo.push("Any allergy, sensitivity, scalp/skin issue, pregnancy or active treatment?");
  const primaryAdvice = /(damage|dry|frizz|break|hair fall|hairfall|scalp)/.test(text)
    ? "Start with condition assessment and repair/scalp-safe service before color or texture work."
    : /(color|colour|highlight|bleach|toner|balayage|global|root)/.test(text)
      ? "Treat this as a color consultation first: check old color, porosity, patch test and strand test before deciding toner, gloss, root touch-up or correction."
      : /(skin|facial|acne|tan|pigment|glow)/.test(text)
        ? "Treat this as a skin consultation first: choose a gentle facial path and avoid aggressive actives if there is irritation or active treatment."
        : "Start with a consultation-first service path, then move to booking once risk, budget and timing are clear.";
  const riskAdvice = /(itch|burn|wound|infection|pregnan|allergy|severe|active acne|medication)/.test(text)
    ? "Because you mentioned a possible risk flag, a qualified professional should check it before any chemical or intensive service."
    : "If there is hidden sensitivity, allergy or recent treatment, mention it before booking.";
  const suggestedReplies = [
    request.photos.length ? "Use these photos and tell me what service is safest" : "I will upload photos for visual review",
    "My budget is INR ____ and I need it by ____",
    "My previous treatment/color history is ____",
    "I have no allergy or sensitivity issues"
  ];
  return { summary, missingInfo: missingInfo.slice(0, 5), primaryAdvice, riskAdvice, suggestedReplies };
}

function localHairPlan(request) {
  const text = [request.message, ...request.goals].join(" ").toLowerCase();
  const plan = [];
  if (/(color|colour|highlight|balayage|global|bleach|toner|grey|gray|root)/.test(text)) {
    plan.push("For hair color, start with strand/patch test, current color history and porosity check before bleach or toner.");
    plan.push("If the hair is previously colored or uneven, choose color correction or gloss/toner first instead of direct global color.");
    plan.push("For a wedding or event within 7 days, prefer gloss, root touch-up, blow-dry or low-risk highlights over aggressive bleach.");
  }
  if (/(cut|haircut|style|layer|bang|fringe|face)/.test(text)) {
    plan.push("For haircut, decide face-framing layers, cleanup trim or full restyle after checking length, density and daily styling time.");
  }
  if (/(frizz|keratin|smooth|straight|dry|damage|repair|spa)/.test(text)) {
    plan.push("For frizz or dry hair, start with repair treatment or hair spa; use keratin/smoothening only after scalp and chemical-history check.");
  }
  if (/(dandruff|scalp|itch|hair fall|hairfall)/.test(text)) {
    plan.push("For scalp discomfort, avoid chemical color or texture service until a professional checks scalp condition.");
  }
  if (!plan.length) {
    plan.push("For hair, share current length, texture, previous color/chemical history and target photo so the stylist can choose cut, color or treatment safely.");
    plan.push("If unsure, book consultation plus wash/cut/blow-dry or hair spa before committing to color or texture change.");
  }
  return plan.slice(0, 6);
}

function rankBusinesses(request) {
  const text = [request.message, ...request.goals].join(" ").toLowerCase();
  return [...request.businesses].sort((left, right) => scoreBusiness(right, text) - scoreBusiness(left, text));
}

function scoreBusiness(business, text) {
  const serviceMatch = business.services.some((service) => text && [service.name, service.category, service.description].join(" ").toLowerCase().includes(text)) ? 18 : 0;
  const categoryMatch = text && [business.category, business.popularService, business.description].join(" ").toLowerCase().split(/\s+/).some((word) => word.length > 3 && text.includes(word)) ? 12 : 0;
  const distanceScore = Number.isFinite(business.distanceKm) ? Math.max(0, 8 - business.distanceKm) : 2;
  return serviceMatch + categoryMatch + Number(business.ratingAverage || 0) + distanceScore + (business.isOpen ? 4 : 0);
}

function normalizeSalonRecommendations(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  return value.slice(0, 4).map((item) => ({
    businessName: cleanText(item.businessName, 160),
    slug: cleanText(item.slug, 120),
    reason: cleanText(item.reason, 240),
    location: cleanText(item.location, 220),
    distanceKm: finiteNumber(item.distanceKm),
    rating: finiteNumber(item.rating),
    openStatus: cleanText(item.openStatus, 120),
    nextStep: cleanText(item.nextStep, 180)
  })).filter((item) => item.businessName);
}

function normalizeServiceRecommendations(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  return value.slice(0, 6).map((item) => ({
    name: cleanText(item.name, 140),
    businessName: cleanText(item.businessName, 160),
    slug: cleanText(item.slug, 120),
    priceLabel: cleanText(item.priceLabel, 80),
    durationLabel: cleanText(item.durationLabel, 80),
    reason: cleanText(item.reason, 220)
  })).filter((item) => item.name);
}

function cleanText(value, maxLength) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function arrayOfText(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function arrayOrFallback(value, fallback, maxItems, maxLength) {
  const items = arrayOfText(value, maxItems, maxLength);
  if (items.length >= Math.min(3, maxItems)) return items;
  return uniqueTexts([...items, ...(fallback || [])]).slice(0, maxItems);
}

function richAnswer(answer, fallback) {
  if (!answer) return fallback;
  if (answer.length >= 160 || !fallback) return answer;
  return `${answer} ${fallback}`.slice(0, 1200);
}

function uniqueTexts(values) {
  const seen = new Set();
  return values.map((value) => cleanText(value, 220)).filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseJsonObject(value) {
  const text = String(value || "").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
    if (fenced?.[1]) return parseJsonObject(fenced[1]);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function moneyLabel(pricePaise) {
  const paise = finiteNumber(pricePaise) || 0;
  return paise > 0 ? `Rs ${Math.round(paise / 100).toLocaleString("en-IN")}` : "Price on selection";
}




