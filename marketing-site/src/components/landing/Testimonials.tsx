"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Quote, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { TESTIMONIALS } from "@/lib/constants";

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

/* We take the top 3 authentic review highlights */
const FEATURED_TESTIMONIALS = TESTIMONIALS.slice(0, 3);

export function Testimonials() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      className="py-20 md:py-28 bg-[var(--aura-off-white)] border-t border-[var(--aura-border)]"
    >
      <Container>
        {/* Section Heading */}
        <div
          className="mx-auto max-w-3xl text-center mb-16"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
          }}
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            Salon Owner Feedback
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Loved by salon owners across India
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
            Hear how beauty and wellness managers streamlined their front desk, eliminated manual spreadsheets, and scaled their profits.
          </p>
        </div>

        {/* 3 Premium Testimonial Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURED_TESTIMONIALS.map((t, i) => {
            const initials = t.name
              .split(" ")
              .map((w) => w[0])
              .join("");

            return (
              <article
                key={t.name}
                className="group relative flex flex-col justify-between rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-7 shadow-[var(--aura-shadow-xs)] transition-all duration-300 hover:shadow-[var(--aura-shadow-md)] hover:-translate-y-1"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 0.5s ease-out ${0.1 + i * 0.08}s, transform 0.5s ease-out ${0.1 + i * 0.08}s`,
                }}
              >
                <div>
                  {/* Top rating & quote icon */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-1" aria-label={`${t.rating} out of 5 stars`}>
                      {Array.from({ length: t.rating }, (_, idx) => (
                        <Star
                          key={idx}
                          className="h-4 w-4 fill-amber-400 text-amber-400"
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                    <Quote className="h-6 w-6 text-[var(--aura-purple)]/20" aria-hidden="true" />
                  </div>

                  {/* Quote text */}
                  <blockquote className="text-sm leading-relaxed text-[var(--aura-heading)] font-medium">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                </div>

                {/* Author Info */}
                <div className="mt-6 pt-5 border-t border-[var(--aura-border)] flex items-center gap-3.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--aura-lavender)] text-xs font-bold text-[var(--aura-purple)]">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-[var(--aura-heading)] truncate">{t.name}</p>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-label="Verified Customer" />
                    </div>
                    <p className="text-xs text-[var(--aura-body)] truncate">
                      {t.role}, <span className="font-medium text-[var(--aura-heading)]">{t.salon}</span> &bull; {t.city}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
