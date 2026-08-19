"use client";

import { ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { LandingDecor } from "./LandingDecor";

const FAQS = [
  {
    question: "How long does it take to set up Aura?",
    answer: "15 minutes. Our team handles migration from your existing software or spreadsheets at no extra cost.",
  },
  {
    question: "Is there a free trial?",
    answer: "We offer a personalised demo where you can see Aura working with your salon's data. Book a demo to get started.",
  },
  {
    question: "Does Aura work on mobile?",
    answer: "Yes. Aura works on any device with a browser. We also have dedicated apps for staff and customers.",
  },
  {
    question: "Can I manage multiple branches?",
    answer: "Absolutely. Aura supports multi-branch management with centralized reports and branch-level controls.",
  },
  {
    question: "How does GST billing work?",
    answer: "Aura auto-generates GST-compliant invoices with HSAC codes, and provides GST reports ready for filing.",
  },
  {
    question: "What kind of support do you offer?",
    answer: "Dedicated WhatsApp support, email support, and a comprehensive help centre. Enterprise plans get a dedicated account manager.",
  },
];

export function InteractiveFAQ() {
  const col1 = FAQS.slice(0, 3);
  const col2 = FAQS.slice(3, 6);

  return (
    <section className="relative overflow-hidden py-20 md:py-28 bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF]" id="faq">
      <LandingDecor variant="quiet" />
      <Container className="reveal relative z-10">
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center mb-16">
          <span className="inline-flex items-center rounded-full border border-[var(--aura-purple)]/15 bg-white/55 px-3 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 backdrop-blur-sm">
            FAQ
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Frequently Asked Questions
          </h2>
        </div>

        {/* 2-Column FAQ Grid */}
        <div className="grid gap-4 md:grid-cols-2 max-w-5xl mx-auto">
          <div className="space-y-4">
            {col1.map((faq, i) => (
              <details
                key={i}
                className="group rounded-xl border border-white/50 bg-white/30 shadow-[0_16px_48px_rgba(109,63,209,0.14)] backdrop-blur-xl ring-1 ring-white/35 transition-all hover:border-[var(--aura-purple)]/30 hover:bg-white/45 open:border-[var(--aura-purple)]/30 open:bg-white/40"
              >
                <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-bold text-[var(--aura-heading)] list-none [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronDown className="h-4 w-4 text-[var(--aura-purple)] shrink-0 transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5 text-sm leading-relaxed text-[var(--aura-body)] border-t border-[var(--aura-border)]/50 pt-3">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
          <div className="space-y-4">
            {col2.map((faq, i) => (
              <details
                key={i}
                className="group rounded-xl border border-white/50 bg-white/30 shadow-[0_16px_48px_rgba(109,63,209,0.14)] backdrop-blur-xl ring-1 ring-white/35 transition-all hover:border-[var(--aura-purple)]/30 hover:bg-white/45 open:border-[var(--aura-purple)]/30 open:bg-white/40"
              >
                <summary className="flex cursor-pointer items-center justify-between p-5 text-sm font-bold text-[var(--aura-heading)] list-none [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <ChevronDown className="h-4 w-4 text-[var(--aura-purple)] shrink-0 transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5 text-sm leading-relaxed text-[var(--aura-body)] border-t border-[var(--aura-border)]/50 pt-3">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
