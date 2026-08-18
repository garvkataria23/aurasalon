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
    <section className="relative py-20 md:py-28 overflow-hidden bg-gradient-to-br from-[#7651D8] via-[#6540C7] to-[#4A269E] text-white shadow-xl">
      {/* Decorative background aura shapes */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#361775]/50 blur-3xl" />
      </div>

      <Container className="relative z-10">
        {/* Section Header */}
        <div className="mb-14 max-w-3xl">
          <h2 className="text-[clamp(2.25rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-[-0.03em] !text-white text-balance">
            Real results for real salons
          </h2>
        </div>

        {/* 4 Purple Glassmorphic Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((item, idx) => (
            <div
              key={idx}
              className="group rounded-[var(--aura-radius-xl)] border border-white/20 bg-white/10 p-6 backdrop-blur-md transition-all duration-300 hover:bg-white/15 hover:border-white/35 hover:-translate-y-1 shadow-lg flex flex-col"
            >
              <div className="mb-6">
                <span className="text-5xl font-bold text-white tabular-nums tracking-tight">
                  {item.value}
                </span>
              </div>
              <h3 className="text-lg font-bold !text-white leading-snug">
                {item.title}
              </h3>
              <p className="mt-2.5 text-xs leading-relaxed text-white/70">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
