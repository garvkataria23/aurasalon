"use client";

import { useState } from "react";
import { Search, ChevronDown, HelpCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { useLanguage } from "@/components/providers/LanguageProvider";

const FAQ_ITEMS = [
  { questionKey: "home.faq.q1", answerKey: "home.faq.a1" },
  { questionKey: "home.faq.q2", answerKey: "home.faq.a2" },
  { questionKey: "home.faq.q3", answerKey: "home.faq.a3" },
  { questionKey: "home.faq.q4", answerKey: "home.faq.a4" },
  { questionKey: "home.faq.q5", answerKey: "home.faq.a5" },
  { questionKey: "home.faq.q6", answerKey: "home.faq.a6" },
  { questionKey: "home.faq.q7", answerKey: "home.faq.a7" },
  { questionKey: "home.faq.q8", answerKey: "home.faq.a8" },
  { questionKey: "home.faq.q9", answerKey: "home.faq.a9" },
  { questionKey: "home.faq.q10", answerKey: "home.faq.a10" },
];

export function InteractiveFAQ() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const translatedFaqs = FAQ_ITEMS.map((faq) => ({
    question: t(faq.questionKey),
    answer: t(faq.answerKey),
  }));

  const filteredFaqs = translatedFaqs.filter((faq) =>
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
            {t("home.faq.badge")}
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            {t("home.faq.title")}
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
            {t("home.faq.body")}
          </p>
        </div>

        {/* Search Bar */}
        <div className="mx-auto max-w-xl relative mb-10">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-[var(--aura-muted)]" />
          <input
            aria-label={t("home.faq.searchLabel")}
            type="text"
            placeholder={t("home.faq.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-[var(--aura-border)] bg-white pl-11 pr-4 py-3 text-xs sm:text-sm text-[var(--aura-heading)] outline-none focus:border-[var(--aura-purple)] focus:ring-2 focus:ring-[var(--aura-purple-soft)] shadow-xs transition-all placeholder:text-[var(--aura-muted)]"
          />
        </div>

        {/* Accordion List */}
        <div className="mx-auto max-w-3xl space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-10 rounded-2xl border border-[var(--aura-border)] bg-white p-6">
              <p className="text-xs text-[var(--aura-muted)]">{t("home.faq.empty", { query })}</p>
              <p className="text-xs font-semibold text-[var(--aura-purple)] mt-1">{t("home.faq.emptyHelp")}</p>
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
