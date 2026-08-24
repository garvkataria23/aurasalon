import type { BlogPost } from "@/lib/types";

type CategoryPlaybook = {
  ownerReality: string;
  firstMove: string;
  operatingSystem: string;
  mistakes: string[];
  metrics: string[];
  auraAngle: string;
};

const PLAYBOOKS: Record<string, CategoryPlaybook> = {
  "Business Growth": {
    ownerReality:
      "Growth in a salon rarely comes from one big trick. It usually comes from noticing where money leaks quietly: empty chair time, weak follow-up, discounts that never end, packages that are sold but not managed, and services that look popular but do not leave enough margin.",
    firstMove:
      "Start by writing the current process exactly as your team follows it today. Do not write the ideal version. Write the real version: who does what, where the handoff happens, and which decision still depends on memory or owner approval.",
    operatingSystem:
      "A growth system connects pricing, booking, billing, client history and reporting. When those pieces are separate, owners see revenue but miss the reasons behind it. When they are connected, you can see which services bring profit, which clients are slipping away and where the team needs coaching.",
    mistakes: ["confusing revenue with profit", "running discounts without margin checks", "tracking packages outside billing", "looking at reports only at month-end"],
    metrics: ["average ticket", "repeat visit rate", "chair utilisation", "gross margin by service", "cash collected vs bills raised"],
    auraAngle:
      "Aura helps by keeping booking, POS, CRM, packages, payments and owner reports in one workflow, so growth decisions are based on real salon activity instead of scattered spreadsheets.",
  },
  Marketing: {
    ownerReality:
      "Most salon marketing fails because it is either too generic or too frequent. Clients do not want another random offer. They respond when the message is useful, timely and connected to what they actually did in your salon.",
    firstMove:
      "Pull your client list into simple groups before sending anything. Recent colour clients, inactive clients, birthday clients, VIP clients and first-time visitors all need different messages.",
    operatingSystem:
      "Marketing becomes easier when CRM, booking and billing data are connected. A campaign should know the client's last service, branch, stylist, spend, visit gap and consent status before it sends a message.",
    mistakes: ["blasting every client with the same offer", "sending without consent", "discounting when education would work better", "not measuring bookings from campaigns"],
    metrics: ["campaign replies", "booking conversion", "redemption rate", "repeat visits after campaign", "opt-out rate"],
    auraAngle:
      "Aura supports smarter salon campaigns by connecting client segments, WhatsApp-ready workflows, birthday reminders, rebooking nudges and win-back lists around the same CRM data.",
  },
  Operations: {
    ownerReality:
      "Operations problems usually show up as stress: late appointments, missing stock, billing queues, staff confusion and clients waiting without updates. The root cause is often not laziness; it is an unclear workflow.",
    firstMove:
      "Choose one repeating operational problem and map the handoff. For example: client books, reminder goes out, stylist is assigned, product is consumed, bill is raised, follow-up is sent. Wherever the chain breaks, write the rule.",
    operatingSystem:
      "A strong salon operation turns daily work into a repeatable rhythm. Calendar, inventory, staff, billing and follow-ups should not be managed as separate islands.",
    mistakes: ["overbooking without buffer time", "buying stock without usage data", "letting every branch invent its own process", "depending on WhatsApp messages for critical tasks"],
    metrics: ["on-time starts", "no-show rate", "stock-out incidents", "service duration accuracy", "daily closing mismatch"],
    auraAngle:
      "Aura helps operations teams run with one connected flow: appointments, waitlists, staff schedules, inventory usage, billing and daily owner review stay visible together.",
  },
  "Staff Management": {
    ownerReality:
      "Salon teams need clarity more than speeches. Most staff conflicts come from unclear attendance rules, changing commission expectations, weak onboarding or performance feedback that arrives only when something goes wrong.",
    firstMove:
      "Put the rule in writing before enforcing it. Attendance, shift swaps, commissions, targets, training and service responsibility should be clear enough that two managers would make the same decision.",
    operatingSystem:
      "Staff management works when attendance, rosters, appointments, commissions and performance reviews use the same data. If each part lives in a different notebook, payroll and coaching become emotional.",
    mistakes: ["changing commission rules mid-month", "reviewing stylists only on revenue", "leaving new joiners without a 30-day plan", "tracking attendance manually without approvals"],
    metrics: ["attendance consistency", "repeat clients by stylist", "retail attachment", "service rework rate", "training completion"],
    auraAngle:
      "Aura connects staff attendance, shifts, appointment attribution, commissions and performance dashboards, giving both owners and stylists a clearer view of work.",
  },
  "Client CRM": {
    ownerReality:
      "A salon client does not want to repeat their story every visit. They expect you to remember colour history, allergies, preferred stylist, package balance and what went wrong last time.",
    firstMove:
      "Start with the five notes that change service quality: allergy/sensitivity, last service, formula or preference, preferred stylist and next recommended visit. Make these visible before the client sits down.",
    operatingSystem:
      "A useful CRM is not just a contact list. It is a living memory that connects booking, consultation, billing, packages, wallet, feedback and follow-up.",
    mistakes: ["saving important notes in personal phones", "not recording complaints", "treating VIP clients from memory", "sending the same campaign to every segment"],
    metrics: ["repeat visit gap", "client lifetime value", "win-back conversion", "complaint recovery", "referral conversion"],
    auraAngle:
      "Aura's Client CRM keeps visit history, preferences, notes, package context and follow-up workflows together so every branch can serve the client with memory.",
  },
  Compliance: {
    ownerReality:
      "Compliance feels boring until a record is missing. In salons, the risky gaps are usually invoice numbering, refunds, consent, staff documentation, payment reconciliation and product traceability.",
    firstMove:
      "Identify the records you would need if someone asked for proof tomorrow. Then make sure the record is created during the workflow, not after the fact.",
    operatingSystem:
      "Compliance becomes lighter when it is part of daily operations. Billing, refunds, packages, consent and payments should leave an audit trail automatically.",
    mistakes: ["deleting bills instead of recording corrections", "mixing payment screenshots with invoice records", "using vague invoice line items", "keeping consent outside the client profile"],
    metrics: ["daily reconciliation status", "invoice sequence gaps", "refund reasons", "pending package liability", "consent completion"],
    auraAngle:
      "Aura helps by keeping GST-ready billing records, payment splits, package activity, client notes and role-based access organised for owner and professional review.",
  },
  "Industry Insights": {
    ownerReality:
      "The salon industry is moving toward connected, data-aware service. Clients want convenience, staff want clarity and owners need visibility without calling every manager at closing time.",
    firstMove:
      "Look at which parts of the salon still depend on manual memory. Those are the areas most likely to break as volume grows.",
    operatingSystem:
      "Modern salon operations are becoming platform-led: booking, POS, CRM, staff, inventory and marketing work better when they share context.",
    mistakes: ["buying tools that do not connect", "copying trends without process readiness", "ignoring data ownership", "confusing feature count with operational fit"],
    metrics: ["digital booking share", "repeat rate", "multi-branch visibility", "automation adoption", "support resolution time"],
    auraAngle:
      "Aura is built around this shift: one connected operating layer for Indian salons instead of separate tools for every department.",
  },
};

function playbookFor(category: string) {
  return PLAYBOOKS[category] ?? PLAYBOOKS["Business Growth"];
}

function titleTopic(post: BlogPost) {
  return post.title.replace(/:.*/, "").trim();
}

export function buildOriginalBlogContent(post: BlogPost, language: string) {
  if (language === "hi") return buildHindiOriginalBlogContent(post);

  const playbook = playbookFor(post.category);
  const topic = titleTopic(post);
  const mistakes = playbook.mistakes.map((item) => `- ${item}`).join("\n");
  const metrics = playbook.metrics.map((item) => `- ${item}`).join("\n");

  return `${post.excerpt}

If you run a busy salon, ${topic.toLowerCase()} is not a theoretical topic. It shows up in real moments: a client waiting at reception, a stylist asking for approval, a manager chasing a missing record, or an owner trying to understand why the month looked busy but cash still feels tight. The goal of this guide is to turn that messy daily reality into a practical operating habit.

## The Real Salon Problem

${playbook.ownerReality}

The mistake many owners make is trying to fix the symptom first. They add one more discount, one more WhatsApp reminder, one more spreadsheet, one more staff instruction. That may help for a week, but it does not create a system. A system means the right thing happens even when the owner is not standing there.

## What Good Looks Like

A strong approach to ${topic.toLowerCase()} has three qualities. First, the team understands the rule. Second, the rule is visible inside the workflow. Third, the owner can measure whether the rule is working. If any one of these is missing, the process depends on memory.

${playbook.operatingSystem}

## Step 1: Start With the Current Reality

${playbook.firstMove}

Do this with the people who actually run the floor. Ask the receptionist, manager and stylists where the process gets stuck. Their answers will usually be more useful than a generic best-practice checklist.

## Step 2: Turn It Into a Simple Rule

The rule should be short enough for the team to repeat. For example: no high-value booking without confirmation, no refund without reason, no package redemption outside billing, no campaign without segment and consent, no stock purchase before checking transfer options. A clear rule beats a complicated policy that nobody follows.

## Step 3: Put the Rule Inside the System

Rules fail when they live only in training conversations. Put the rule where the work happens: booking screen, client profile, POS, inventory flow, staff roster or owner dashboard. The best process is the one your team can follow while serving clients, not after closing time.

## Common Mistakes to Avoid

${mistakes}

These mistakes are common because they are easy in the moment. The real discipline is designing the workflow so the easy path is also the correct path.

## Metrics to Watch

${metrics}

Review these weekly, not once a quarter. Weekly review lets you correct behaviour while the team still remembers what happened.

## How Aura Fits Into This Workflow

${playbook.auraAngle}

This matters because salons do not need more isolated tools. They need fewer gaps between the tools they already depend on: booking, billing, CRM, staff, inventory and reporting.

## 30-Day Implementation Plan

Week 1: document the current workflow and identify the three biggest gaps. Week 2: write one simple rule for each gap. Week 3: train the team and start recording the data consistently. Week 4: review the numbers and keep only the changes that improved the salon day.

## Final Takeaway

${topic} becomes valuable when it changes daily behaviour. Keep the process simple, visible and measurable. That is how a salon moves from owner-dependent operations to a business that can scale with confidence.`;
}

function buildHindiOriginalBlogContent(post: BlogPost) {
  const playbook = playbookFor(post.category);
  const topic = titleTopic(post);
  const mistakes = playbook.mistakes.map((item) => `- ${item}`).join("\n");
  const metrics = playbook.metrics.map((item) => `- ${item}`).join("\n");

  return `${post.excerpt}

Busy salon में ${topic} कोई theory नहीं है। यह reception, billing, staff approvals, stock checks और client follow-ups में रोज़ दिखता है। इस guide का goal है कि daily chaos को simple operating habit में बदला जाए।

## असली salon problem

${playbook.ownerReality}

अक्सर owners symptom fix करते हैं: एक discount, एक reminder, एक spreadsheet या एक staff instruction. यह short term help करता है, लेकिन system नहीं बनाता। System का मतलब है owner मौजूद न हो तब भी सही काम हो।

## अच्छा workflow कैसा दिखता है

Good workflow में तीन चीज़ें होती हैं: team rule समझती है, rule workflow में visible है, और owner measure कर सकता है कि rule काम कर रहा है या नहीं।

${playbook.operatingSystem}

## Step 1: current reality लिखें

${playbook.firstMove}

Receptionist, manager और stylists से पूछें process कहाँ अटकता है। Floor team अक्सर सबसे useful truth बताती है।

## Step 2: simple rule बनाएँ

Rule इतना छोटा हो कि team repeat कर सके: high-value booking बिना confirmation नहीं, refund बिना reason नहीं, package redemption billing के बाहर नहीं, campaign बिना segment और consent नहीं।

## Step 3: rule को system में डालें

Rules training conversation में नहीं, workflow में होने चाहिए: booking screen, client profile, POS, inventory, roster या owner dashboard.

## Common mistakes

${mistakes}

ये mistakes common हैं क्योंकि moment में easy लगती हैं। सही design का मतलब है easy path ही correct path हो।

## Metrics देखें

${metrics}

इन्हें weekly review करें। Monthly या quarterly review अक्सर देर से होता है।

## Aura कैसे fit होता है

${playbook.auraAngle}

Salon को isolated tools नहीं, connected workflow चाहिए — booking, billing, CRM, staff, inventory और reports एक साथ।

## 30-day plan

Week 1: current workflow और top gaps लिखें। Week 2: हर gap के लिए simple rule बनाएँ। Week 3: team train करें और data consistently record करें। Week 4: numbers review करें और जो काम करे वही keep करें।

## Final takeaway

${topic} तब valuable है जब daily behaviour बदले। Process simple, visible और measurable रखें।`;
}
