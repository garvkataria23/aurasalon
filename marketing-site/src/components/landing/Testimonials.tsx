"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Quote } from "lucide-react";
import { Container } from "@/components/ui/Container";

const TESTIMONIALS = [
  {
    name: "Priya Sharma",
    salon: "Glow Salon",
    city: "Mumbai",
    quote: "Aura has completely transformed how we manage appointments. The time saved on front-desk tasks allows us to focus entirely on our clients' experience.",
  },
  {
    name: "Rajesh Khanna",
    salon: "Style Studio",
    city: "Delhi",
    quote: "Since switching to Aura, our daily revenue has grown consistently. The automated follow-ups and seamless billing have made a huge impact on our bottom line.",
  },
  {
    name: "Anita Desai",
    salon: "Blossom Spa",
    city: "Bangalore",
    quote: "Client retention is crucial for our spa, and Aura makes it effortless. The detailed client profiles and easy rebooking features keep our customers coming back.",
  }
];

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
          className={`mx-auto max-w-3xl text-center mb-16 transition-all duration-700 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            TESTIMONIALS
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Loved by salon owners across India
          </h2>
        </div>

        {/* 3-column grid of testimonial cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => {
            const initials = t.name
              .split(" ")
              .map((w) => w[0])
              .join("");

            return (
              <article
                key={t.name}
                className={`group relative flex flex-col justify-between rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-7 shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:shadow-[var(--aura-shadow-md)] hover:-translate-y-1 card-hover reveal stagger-${i + 1}`}
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 0.5s ease-out ${0.1 + i * 0.08}s, transform 0.5s ease-out ${0.1 + i * 0.08}s`,
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-1" aria-label="5 out of 5 stars">
                      {Array.from({ length: 5 }, (_, idx) => (
                        <Star
                          key={idx}
                          className="h-4 w-4 fill-amber-400 text-amber-400"
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>

                  <blockquote className="text-sm leading-relaxed text-[var(--aura-heading)] font-medium">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                </div>

                <div className="mt-6 pt-5 border-t border-[var(--aura-border)] flex items-center gap-3.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--aura-lavender)] text-xs font-bold text-[var(--aura-purple)]">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-[var(--aura-heading)] truncate">{t.name}</p>
                    </div>
                    <p className="text-xs text-[var(--aura-muted)] truncate">
                      {t.salon} &bull; {t.city}
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
