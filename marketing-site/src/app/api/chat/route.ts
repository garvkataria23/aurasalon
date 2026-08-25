import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const chatSchema = z.object({
  message: z.string().min(1).max(800),
  phone: z.string().max(24).optional(),
  email: z.string().email().max(200).optional(),
  history: z
    .array(z.object({ role: z.enum(["assistant", "user"]), content: z.string().max(1000) }))
    .max(10)
    .optional(),
});

const knowledge = [
  {
    keys: ["price", "pricing", "plan", "cost", "charge", "starter"],
    reply:
      "Aura has transparent salon-friendly plans, starting from the Starter plan for single-branch salons, with higher plans for growing teams and enterprise/multi-branch operations. Pricing includes the platform features in your plan, with no per-booking commission. For exact fit, book a demo so the team can map your branch count, team size and modules.",
  },
  {
    keys: ["demo", "book", "call", "schedule", "mobile", "phone"],
    reply:
      "I can help with a demo request. Share your mobile number and email here, then send 'Book demo'. The Aura team can walk you through setup, pricing, booking, POS, CRM, staff and inventory workflows for your salon.",
  },
  {
    keys: ["gst", "billing", "invoice", "pos", "upi", "payment", "split"],
    reply:
      "Aura includes salon POS and billing workflows for Indian salons: GST-ready invoices, UPI/card/cash/wallet payments, split payments, daily closing and checkout context connected with customer history.",
  },
  {
    keys: ["appointment", "booking", "calendar", "slot", "no-show", "noshow", "waitlist"],
    reply:
      "Aura booking helps with appointment calendar, slot guidance, online booking, waitlist management, reminders and QR check-ins. It is designed to reduce manual front-desk work and missed appointments.",
  },
  {
    keys: ["client", "crm", "customer", "loyalty", "wallet", "history", "profile"],
    reply:
      "Aura Customer 360 stores client profiles, visit and purchase history, preferences, notes, tags, consent, loyalty, wallet and follow-up context so the salon team can personalize every visit.",
  },
  {
    keys: ["staff", "payroll", "attendance", "commission", "salary", "shift"],
    reply:
      "Aura Staff OS supports attendance, shifts, commissions, payroll and performance dashboards. It is built for salon teams where stylist schedules, services and incentives must stay connected.",
  },
  {
    keys: ["inventory", "stock", "expiry", "supplier", "product", "waste"],
    reply:
      "Aura inventory tracks products, batches, expiry alerts, usage-based reorder guidance, suppliers and waste records. It keeps retail sales and service consumption connected to operations.",
  },
  {
    keys: ["marketing", "whatsapp", "campaign", "birthday", "follow", "retention", "sms"],
    reply:
      "Aura supports marketing workflows such as birthday campaigns, reminders, re-engagement, lead follow-up and WhatsApp/SMS/email workflow planning. The website chat no longer redirects to WhatsApp; it answers here first and can capture demo interest.",
  },
  {
    keys: ["multi", "branch", "franchise", "chain", "white label"],
    reply:
      "Aura supports growing salon operations with multi-branch reporting, role-based workflows, franchise/chain requirements and white-label options on suitable plans.",
  },
  {
    keys: ["setup", "migration", "import", "training", "onboarding"],
    reply:
      "Setup is guided: create the salon account, configure branch/team/services, import existing data where needed, train front desk and team, then go live with booking, billing and CRM workflows.",
  },
  {
    keys: ["support", "help", "email", "contact"],
    reply:
      "Aura provides support through the contact/demo flow. You can ask me product questions here, or share your phone/email and I will pass your request to the team when delivery is configured.",
  },
];

const systemPrompt = `You are Aura AI, the product expert for Aura Salon CRM/POS.
Answer website visitors clearly and confidently about Aura software.
Aura is an Indian salon CRM/POS and salon operating system covering: online booking, appointments, GST POS billing, UPI/card/cash/wallet payments, Customer 360 CRM, loyalty, memberships, packages, inventory, staff attendance, shifts, payroll, commissions, marketing workflows, WhatsApp/SMS/email campaigns, finance, reporting, multi-branch and white-label operations.
Keep answers concise, practical and sales-support oriented. If the visitor asks for pricing or demo, ask for phone/email and tell them the Aura team can confirm exact fit. Never claim actions are completed unless the API says leadCaptured is true. Do not redirect to WhatsApp.`;

function buildReply(message: string) {
  const normalized = message.toLowerCase();
  const match = knowledge.find((item) => item.keys.some((key) => normalized.includes(key)));
  if (match) return match.reply;

  return "Aura is a connected salon CRM/POS for Indian salons. It covers booking, GST billing, Customer 360 CRM, staff payroll, inventory, marketing workflows, finance and multi-branch operations. Ask about any module, pricing, setup, or demo booking.";
}


function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

async function buildAiReply(message: string, history: z.infer<typeof chatSchema>["history"] = []) {
  const apiKey = envValue("AI_CONCIERGE_API_KEY", "OPENAI_API_KEY");
  if (!apiKey) return { reply: buildReply(message), provider: "local_rules" };

  const model = envValue("AI_CONCIERGE_MODEL", "OPENAI_MODEL") || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 380,
      messages: [
        { role: "system", content: systemPrompt },
        ...(history || []).slice(-8).map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok && model !== "gpt-4.1-mini") {
    return buildAiReplyWithModel(apiKey, message, history, "gpt-4.1-mini");
  }
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);

  const data = await response.json();
  const reply = String(data?.choices?.[0]?.message?.content || "").trim();
  return { reply: reply || buildReply(message), provider: "openai" };
}

async function buildAiReplyWithModel(apiKey: string, message: string, history: z.infer<typeof chatSchema>["history"], model: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 380,
      messages: [
        { role: "system", content: systemPrompt },
        ...(history || []).slice(-8).map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: message },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
  const data = await response.json();
  const reply = String(data?.choices?.[0]?.message?.content || "").trim();
  return { reply: reply || buildReply(message), provider: "openai" };
}

async function captureLead(message: string, phone?: string, email?: string) {
  if (!phone && !email) return false;
  const wantsDemo = /demo|book|call|price|pricing|plan|contact|schedule|mobile|phone/i.test(message);
  if (!wantsDemo) return false;

  const apiKey = process.env.RESEND_API_KEY;
  const contactEmail = process.env.CONTACT_EMAIL;
  if (!apiKey || !contactEmail) return false;

  const resend = new Resend(apiKey);
  const emailPayload = {
    from: process.env.RESEND_FROM || "Aura Chat <onboarding@resend.dev>",
    to: contactEmail,
    subject: "[Aura Chat] Demo lead from AI assistant",
    text: [`Phone: ${phone || "Not provided"}`, `Email: ${email || "Not provided"}`, "", "Message:", message].join("\n"),
  };
  const result = await resend.emails.send(email ? { ...emailPayload, replyTo: email } : emailPayload);

  return !result.error;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const { message, phone, email, history } = parsed.data;
    const [leadCaptured, aiAnswer] = await Promise.all([
      captureLead(message, phone, email),
      buildAiReply(message, history).catch((error) => {
        console.error("[Chat Assistant LLM Fallback]", error);
        return { reply: buildReply(message), provider: "local_rules" };
      }),
    ]);

    return NextResponse.json({ reply: aiAnswer.reply, leadCaptured, provider: aiAnswer.provider });
  } catch (error) {
    console.error("[Chat Assistant Error]", error);
    return NextResponse.json({ error: "Failed to process chat request" }, { status: 500 });
  }
}
