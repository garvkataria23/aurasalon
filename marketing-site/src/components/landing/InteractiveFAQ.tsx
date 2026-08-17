"use client";

import { useState } from "react";
import { Search, ChevronDown, HelpCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";

const FAQ_ITEMS = [
  {
    question: "Can I migrate from another salon software?",
    answer: "Yes. Aura provides guided migration support to import your existing clients, service menus, inventory catalog, and staff lists from Excel, CSV, or other legacy systems so you can switch with zero downtime.",
  },
  {
    question: "Can multiple branches use Aura?",
    answer: "Yes. Aura natively supports multi-branch operations. You get a central owner dashboard with consolidated revenue reports, cross-branch loyalty points, and stock transfers between locations.",
  },
  {
    question: "Does it support GST billing?",
    answer: "Yes. Aura is engineered specifically for Indian tax regulations with itemized CGST/SGST splits, customizable HSN/SAC codes, B2B/B2C invoicing, and one-click export files formatted for your CA.",
  },
  {
    question: "Can staff have different permissions?",
    answer: "Yes. Aura has granular role-based access control. You can grant stylists access to only their bookings and commissions, allow front desk to handle billing, while keeping overall business margins and audit logs restricted to owners.",
  },
  {
    question: "Can customers book online?",
    answer: "Yes. Aura includes a branded online booking portal where clients can select services, pick their preferred stylist, choose a time slot, and opt for seamless pay-at-salon checkout.",
  },
  {
    question: "Can I manage memberships and packages?",
    answer: "Yes. You can configure tiered memberships (e.g. Gold VIP), bundled service packages (e.g. 6-session bridal glow), prepaid wallet top-up bonuses, and automated WhatsApp expiry notifications.",
  },
  {
    question: "Does Aura work on mobile?",
    answer: "Yes. Aura is fully responsive and cloud-accessible across iPads, Android tablets, laptops, and smartphones with dedicated views for salon owners, stylists, and receptionists.",
  },
  {
    question: "Do you provide onboarding?",
    answer: "Yes. Our team assists with initial account configuration, service menu setup, staff training, and test billing to ensure your team is completely confident from day one.",
  },
  {
    question: "How does support work?",
    answer: "We provide dedicated WhatsApp, phone, and email support during business hours to ensure your front desk never experiences disruptions during peak salon rush hours.",
  },
  {
    question: "Can I change my plan?",
    answer: "Yes. You can upgrade or adjust your branch count as your business expands. Upgrades take effect immediately with pro-rated billing.",
  },
];

export function InteractiveFAQ() {
  const [query, setQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = FAQ_ITEMS.filter(
    (faq) =>
      faq.question.toLowerCase().includes(query.toLowerCase()) ||
      faq.answer.toLowerCase().includes(query.toLowerCase())
  );

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="bg-[var(--aura-off-white)] py-20 md:py-28 border-t border-[var(--aura-border)]" id="faq">
      <Container>
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center mb-10">
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            Got Questions?
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
            Everything you need to know about setting up, running, and scaling your salon with Aura.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mx-auto max-w-xl relative mb-10">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-[var(--aura-muted)]" />
          <input
            aria-label="Search frequently asked questions"
            type="text"
            placeholder="Search questions (e.g. GST, WhatsApp, Migration, Multi-branch)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-[var(--aura-border)] bg-white pl-11 pr-4 py-3 text-xs sm:text-sm text-[var(--aura-heading)] outline-none focus:border-[var(--aura-purple)] focus:ring-2 focus:ring-[var(--aura-purple-soft)] shadow-xs transition-all placeholder:text-[var(--aura-muted)]"
          />
        </div>

        {/* Accordion List */}
        <div className="mx-auto max-w-3xl space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-10 rounded-2xl border border-[var(--aura-border)] bg-white p-6">
              <p className="text-xs text-[var(--aura-muted)]">No questions found matching "{query}".</p>
              <p className="text-xs font-semibold text-[var(--aura-purple)] mt-1">Contact our team for quick help!</p>
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={faq.question}
                  className="rounded-[var(--aura-radius-lg)] border border-[var(--aura-border)] bg-white overflow-hidden shadow-xs transition-all hover:border-[var(--aura-purple)]/30"
                >
                  <button
                    type="button"
                    onClick={() => toggle(idx)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between p-5 text-left transition-colors"
                  >
                    <span className="text-sm font-bold text-[var(--aura-heading)] pr-4">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-[var(--aura-purple)] shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-[var(--aura-body)] leading-relaxed border-t border-[var(--aura-border)]/50 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Container>
    </section>
  );
}
