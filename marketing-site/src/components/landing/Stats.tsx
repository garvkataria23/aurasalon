"use client";

import { Container } from "@/components/ui/Container";

export function Stats() {
  const metrics = [
    {
      value: "85%",
      title: "Reduction in No-Shows",
      description: "With automated WhatsApp reminders",
    },
    {
      value: "3x",
      title: "Faster Checkout",
      description: "GST billing in under 30 seconds",
    },
    {
      value: "40%",
      title: "More Repeat Visits",
      description: "Smart rebooking and loyalty programs",
    },
    {
      value: "4hrs",
      title: "Saved Daily",
      description: "Automate operations that drain your time",
    },
  ];

  return (
    <section className="relative py-20 md:py-28 overflow-hidden bg-gradient-to-br from-[#EEE5FF] via-[#E3D5FF] to-[#D6C3FF] text-[var(--aura-heading)] shadow-sm">
      {/* Decorative background aura shapes */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/80 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[var(--aura-purple)]/10 blur-3xl" />
      </div>

      <Container className="relative z-10">
        {/* Section Header */}
        <div className="mb-14 max-w-3xl">
          <h2 className="text-[clamp(2.25rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Real results for real salons
          </h2>
        </div>

        {/* 4 Purple Glassmorphic Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((item, idx) => (
            <div
              key={idx}
              className="group rounded-[var(--aura-radius-xl)] border border-[var(--aura-purple)]/12 bg-white/70 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[var(--aura-purple)]/25 hover:bg-white hover:shadow-[var(--aura-shadow-md)] flex flex-col"
            >
              <div className="mb-6">
                <span className="text-5xl font-bold text-[var(--aura-purple)] tabular-nums tracking-tight">
                  {item.value}
                </span>
              </div>
              <h3 className="text-lg font-bold text-[var(--aura-heading)] leading-snug">
                {item.title}
              </h3>
              <p className="mt-2.5 text-xs leading-relaxed text-[var(--aura-body)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
