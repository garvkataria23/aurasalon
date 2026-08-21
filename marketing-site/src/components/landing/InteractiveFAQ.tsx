"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/Container";

const ALL_FAQS = [
  {
    question: "What is the best salon and spa management software?",
    answer: "The best salon/spa software is the one that helps owners and managers book more clients, automate operations and is easy to use. Aura salon software is built to do all these tasks with multi-channel booking, 3-click GST billing, real-time staff commission tracking, recipe-level inventory control, and automated 2-way WhatsApp retention marketing.",
  },
  {
    question: "What features are important in salon and spa management software?",
    answer: "The essential features every salon needs are: (1) 24/7 self-service online booking, (2) Fast & GST-ready POS checkout, (3) CRM with client visit history & preferences, (4) Staff shift roster & commission calculator, (5) Inventory consumption & recipe tracking, (6) Automated WhatsApp reminders & birthday campaigns, (7) Multi-location franchise dashboard.",
  },
  {
    question: "How can I choose the best salon software for my business?",
    answer: "Look for software designed specifically for your region's needs: (1) Simple and fully integrated dashboard with no steep learning curve, (2) 100% GST-ready invoicing with HSAC codes, (3) Built-in WhatsApp communication without third-party fees, (4) Cloud & offline reliability, and (5) 24/7 dedicated support with free data migration.",
  },
  {
    question: "How much does salon and spa management software cost?",
    answer: "Aura offers transparent, flat-fee pricing starting with our starter plan for single-chair studios up to enterprise multi-outlet plans. We do not charge per-booking commissions or hidden payment gateway markups. We also offer a free live demo with your salon's actual data.",
  },
  {
    question: "Can salon and spa software help increase revenue?",
    answer: "Yes! Aura customers report a +42% average increase in repeat visits within 90 days. Features like automated WhatsApp reminders reduce no-shows to under 3%, smart waitlists auto-fill last-minute cancelled chairs, and personalized birthday coupons drive off-peak footfall.",
  },
  {
    question: "How do I effectively manage multi-location salons or franchises?",
    answer: "Aura's centralized multi-outlet system lets you view live sales, chair occupancy, and inventory levels across all branches from a single login. You can set branch-specific pricing, transfer stock between outlets, and compare staff performance across locations in real time.",
  },
  {
    question: "Can I integrate online booking and payments with my salon website and Instagram?",
    answer: "Yes. Aura provides a clean embeddable booking widget and custom link for your website, Instagram bio, and Google Maps listing. Clients can select services, choose preferred stylists, and book in seconds.",
  },
  {
    question: "How long does data migration from my old software or Excel take?",
    answer: "Less than 15 minutes. Our onboarding specialists migrate all your client contact details, visit history, loyalty points, service price menus, and stock inventory at zero additional cost.",
  },
];

export function InteractiveFAQ() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return ALL_FAQS;
    const q = searchQuery.toLowerCase();
    return ALL_FAQS.filter(
      (item) => item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <section className="relative bg-white py-20 md:py-28 overflow-hidden border-t border-[var(--aura-border)]" id="faq">
      <Container className="relative z-10">
        
        {/* Heading */}
        <div className="mx-auto max-w-3xl text-center mb-10">
          <p className="font-serif italic text-base md:text-lg text-[var(--aura-purple)] font-medium mb-2">
            Got Questions?
          </p>
          <h2 className="text-[clamp(2.2rem,4.5vw,3.4rem)] font-extrabold tracking-[-0.04em] text-[var(--aura-heading)] leading-tight">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-base text-[var(--aura-body)]">
            Everything you need to know about setting up and scaling with Aura.
          </p>
        </div>

        {/* Search Input Bar */}
        <div className="mx-auto max-w-2xl mb-12">
          <div className="relative flex items-center">
            <Search className="absolute left-5 h-5 w-5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search FAQs (e.g. GST, pricing, migration, WhatsApp, multi-branch)..."
              className="w-full rounded-2xl border border-[var(--aura-border)] bg-[#FCFBF8] py-4 pl-14 pr-5 text-sm font-medium text-[var(--aura-heading)] shadow-sm outline-none transition-all placeholder:text-zinc-400 focus:border-[var(--aura-purple)] focus:bg-white focus:ring-4 focus:ring-[var(--aura-purple)]/10"
            />
          </div>
          {searchQuery && (
            <p className="mt-2 text-xs text-[var(--aura-muted)] text-right">
              Showing {filteredFaqs.length} result{filteredFaqs.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {/* Accordion FAQ Cards */}
        <div className="mx-auto max-w-3xl space-y-3.5">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl border transition-all duration-200 ${
                    isOpen
                      ? "border-[var(--aura-purple)]/30 bg-[#FCFBF8] shadow-md"
                      : "border-[var(--aura-border)] bg-white hover:border-zinc-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="flex w-full cursor-pointer items-center justify-between p-5 text-left text-base font-bold text-[var(--aura-heading)]"
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-[var(--aura-purple)] transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-[var(--aura-border)]/60 px-5 pb-5 pt-3 text-sm leading-relaxed text-[var(--aura-body)]">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--aura-border)] p-8 text-center text-sm text-[var(--aura-muted)]">
              No matching questions found for &ldquo;{searchQuery}&rdquo;. Ask our support team directly!
            </div>
          )}
        </div>

      </Container>
    </section>
  );
}
