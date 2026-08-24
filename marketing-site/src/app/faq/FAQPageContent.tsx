"use client";

import { useState } from "react";
import { ArrowRight, Clock, Plus, Search, SearchX, ShieldCheck, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GridBackground } from "@/components/ui/GridBackground";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const FAQ_KEYS = Array.from({ length: 12 }, (_, index) => index + 1);

export default function FAQPageContent() {
  const { t } = useLanguage();
  const reveal = useScrollReveal();
  const [openIndex, setOpenIndex] = useState<number | null>(1);
  const [searchQuery, setSearchQuery] = useState("");

  const faqs = FAQ_KEYS.map((item) => ({
    id: item,
    number: String(item).padStart(2, "0"),
    question: t(`faq.q${item}`),
    answer: t(`faq.a${item}`),
  }));

  const filtered = faqs.filter((item) => {
    const query = searchQuery.toLowerCase();
    return item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query);
  });

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div ref={reveal as React.RefObject<HTMLDivElement | null>} className="overflow-x-clip">
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#FFFDFB_0%,#F8F4FF_42%,#ECE4FF_100%)] pb-16 pt-28 md:pb-24 md:pt-36">
        <GridBackground className="opacity-25" />
        <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-[var(--aura-purple)]/12 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#B89CFF]/20 blur-3xl" aria-hidden="true" />
        <Container size="narrow" className="relative z-10">
          <div className="fade-in-up mx-auto max-w-2xl text-center">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/15 bg-white/75 px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)] shadow-[0_10px_30px_rgba(111,79,216,0.08)] backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t("faq.page.badge")}
            </span>
            <h1 className="text-balance text-[clamp(2.5rem,6vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.05em] text-[var(--aura-heading)]">
              {t("faq.page.title")}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-8 text-[var(--aura-body)] md:text-lg">
              {t("faq.page.body")}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 text-sm font-semibold text-[var(--aura-heading)] sm:flex-row">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-[var(--aura-shadow-sm)]">
                <Clock className="h-4 w-4 text-[var(--aura-purple)]" aria-hidden="true" /> 5-min read
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-[var(--aura-shadow-sm)]">
                <ShieldCheck className="h-4 w-4 text-[var(--aura-purple)]" aria-hidden="true" /> Straight answers
              </span>
            </div>
          </div>
        </Container>
      </section>

      <section className="relative bg-[var(--aura-off-white)] py-14 md:py-20">
        <Container size="narrow">
          <div className="reveal mb-8 rounded-[2rem] border border-white/80 bg-white/70 p-2.5 shadow-[0_18px_60px_rgba(72,45,151,0.10)] backdrop-blur-xl">
            <div className="relative">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--aura-muted)]" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("faq.page.search")}
                aria-label={t("faq.page.searchLabel")}
                className="w-full rounded-[1.5rem] border border-transparent bg-white py-4 pl-14 pr-5 text-sm font-medium text-[var(--aura-heading)] shadow-[0_1px_0_rgba(111,79,216,0.04)] transition-all duration-200 placeholder:text-[var(--aura-muted)] focus:border-[var(--aura-purple)] focus:outline-none focus:ring-4 focus:ring-[rgba(111,79,216,0.12)]"
              />
            </div>
            {isSearching && (
              <p className="mt-3 px-2 pb-1 text-right" aria-live="polite">
                <span className="inline-flex items-center rounded-full bg-[var(--aura-lavender)] px-3 py-1 text-xs font-bold text-[var(--aura-purple)]">
                  {filtered.length} / {faqs.length}
                </span>
              </p>
            )}
          </div>

          <div className="reveal space-y-3.5">
            {filtered.map((item) => {
              const isOpen = openIndex === item.id;

              return (
                <div
                  key={item.id}
                  className={`group overflow-hidden rounded-[1.25rem] border backdrop-blur transition-all duration-300 motion-reduce:transition-none ${
                    isOpen
                      ? "border-[var(--aura-purple)]/25 bg-white shadow-[var(--aura-shadow-md)]"
                      : "border-[var(--aura-border)] bg-white/80 hover:-translate-y-0.5 hover:border-[var(--aura-border-strong)] hover:bg-white hover:shadow-[var(--aura-shadow-md)] motion-reduce:hover:translate-y-0"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : item.id)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${item.id}`}
                    id={`faq-trigger-${item.id}`}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                  >
                    <span
                      aria-hidden="true"
                      className={`w-8 shrink-0 text-xs font-bold tabular-nums tracking-widest transition-colors duration-300 ${
                        isOpen ? "text-[var(--aura-purple)]" : "text-[var(--aura-muted)] group-hover:text-[var(--aura-purple)]/60"
                      }`}
                    >
                      {item.number}
                    </span>
                    <span className="flex-1 text-sm font-semibold leading-snug text-[var(--aura-heading)] sm:text-base">
                      {item.question}
                    </span>
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                        isOpen
                          ? "bg-[var(--aura-purple)] text-white"
                          : "bg-[var(--aura-lavender)] text-[var(--aura-purple)] group-hover:bg-[var(--aura-lavender-strong)]"
                      }`}
                    >
                      <Plus
                        className={`h-4 w-4 transition-transform duration-300 ease-out motion-reduce:transition-none ${isOpen ? "rotate-45" : ""}`}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                  <div
                    id={`faq-panel-${item.id}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${item.id}`}
                    aria-hidden={!isOpen}
                    className={`grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none ${
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <p className="pb-5 pl-[4.5rem] pr-5 text-sm leading-7 text-[var(--aura-body)] sm:pb-6 sm:pl-[4.75rem] sm:pr-6">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="rounded-[1.5rem] border border-dashed border-[var(--aura-border-strong)] bg-white/70 px-6 py-14 text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--aura-lavender)] ring-8 ring-[var(--aura-lavender-strong)]/50">
                  <SearchX className="h-7 w-7 text-[var(--aura-purple)]" aria-hidden="true" />
                </div>
                <p className="mx-auto max-w-sm text-sm leading-6 text-[var(--aura-body)]">{t("faq.page.empty")}</p>
              </div>
            )}
          </div>

          <div className="reveal relative mt-12 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#2A173D_0%,#6F4FD8_58%,#A98AFF_100%)] px-6 py-10 text-center shadow-[0_28px_90px_rgba(72,45,151,0.28)] sm:py-12 md:mt-16">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
            <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-[#B89CFF]/30 blur-3xl" aria-hidden="true" />
            <div className="relative z-10 mx-auto max-w-md">
              <h2 className="text-balance text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">
                {t("faq.page.more")}
              </h2>
              <a
                href="/contact"
                className="group mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-[var(--aura-purple)] shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                {t("faq.page.contact")}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
