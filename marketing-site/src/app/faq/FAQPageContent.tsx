"use client";

import { useState } from "react";
import { Plus, Minus, Search } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GridBackground } from "@/components/ui/GridBackground";
import { useLanguage } from "@/components/providers/LanguageProvider";

const FAQ_KEYS = Array.from({ length: 12 }, (_, index) => index + 1);

export default function FAQPageContent() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const faqs = FAQ_KEYS.map((item) => ({
    question: t(`faq.q${item}`),
    answer: t(`faq.a${item}`),
  }));

  const filtered = faqs.filter((item) => {
    const query = searchQuery.toLowerCase();
    return item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query);
  });

  return (
    <>
      <GridBackground />
      <section className="pt-28 pb-20 md:pt-36">
        <Container size="narrow">
          <div className="mb-12">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-aura-primary mb-4">{t("faq.page.badge")}</p>
            <h1 className="text-3xl md:text-4xl font-bold text-aura-text leading-tight mb-4">
              {t("faq.page.title")}
            </h1>
            <p className="text-base text-aura-text-secondary max-w-xl">
              {t("faq.page.body")}
            </p>
          </div>

          <div className="relative mb-8">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-aura-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("faq.page.search")}
              className="w-full rounded-xl border border-aura-border bg-white pl-10 pr-4 py-3 text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:border-aura-primary focus:ring-2 focus:ring-aura-primary/10 transition-all"
              aria-label={t("faq.page.searchLabel")}
            />
          </div>

          <div className="space-y-2">
            {filtered.map((item, i) => {
              const isOpen = openIndex === i;
              const question = item.question;
              const answer = item.answer;

              return (
                <div
                  key={i}
                  className="rounded-xl border border-aura-border bg-white overflow-hidden transition-colors hover:border-aura-primary-light"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                   aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-trigger-${i}`}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-aura-text">{question}</span>
                    <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md bg-aura-surface-muted text-aura-text-muted">
                      {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-trigger-${i}`}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 text-sm text-aura-text-secondary leading-relaxed">
                        {answer}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="py-16 text-center text-sm text-aura-text-muted">
                  {t("faq.page.empty")}
              </div>
            )}
          </div>

          <div className="mt-16 text-center">
            <p className="text-sm text-aura-text-secondary mb-4">
              {t("faq.page.more")}
            </p>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl bg-aura-primary px-6 py-3 text-sm font-medium text-white transition-all hover:bg-aura-primary-dark hover:shadow-lg"
            >
              {t("faq.page.contact")}
            </a>
          </div>
        </Container>
      </section>
    </>
  );
}
