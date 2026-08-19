"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";

/* ── Count-Up Hook ── */
function useCountUp(target: string, duration = 1600) {
  const [display, setDisplay] = useState("0");
  const triggered = useRef(false);

  const start = () => {
    if (triggered.current) return;
    triggered.current = true;

    // Extract numeric part and suffix (e.g. "85%" → 85, "%")
    const match = target.match(/^([\d.]+)(.*)$/);
    if (!match) { setDisplay(target); return; }
    const end = parseFloat(match[1]);
    const suffix = match[2];
    const isFloat = target.includes(".");
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * end;
      setDisplay((isFloat ? current.toFixed(1) : Math.round(current).toString()) + suffix);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  return { display, start };
}

export function Stats() {
  const sectionRef = useRef<HTMLElement>(null);
  const metrics = [
    { value: "85%",  title: "Reduction in No-Shows",  description: "With automated WhatsApp reminders" },
    { value: "3x",   title: "Faster Checkout",         description: "GST billing in under 30 seconds" },
    { value: "40%",  title: "More Repeat Visits",      description: "Smart rebooking and loyalty programs" },
    { value: "4hrs", title: "Saved Daily",             description: "Automate operations that drain your time" },
  ];

  const counters = metrics.map((m) => useCountUp(m.value));

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          counters.forEach((c) => c.start());
          obs.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-24 md:py-32 overflow-hidden bg-[#1D1B2F] text-white"
    >
      {/* Ambient purple glow orbs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-[var(--aura-purple)]/20 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-[#9B7FE6]/15 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-[var(--aura-purple)]/8 blur-[80px]" />
      </div>

      {/* Subtle dot grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        aria-hidden="true"
      />

      <Container className="relative z-10">
        {/* Section Header */}
        <div className="mb-16 max-w-3xl">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[#C4B5FD] mb-4 backdrop-blur-sm">
            PROVEN RESULTS
          </span>
          <h2 className="text-[clamp(2.25rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-[-0.03em] text-white text-balance">
            Real results for real salons
          </h2>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((item, idx) => (
            <div
              key={idx}
              className="group rounded-[var(--aura-radius-xl)] border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/8 flex flex-col"
            >
              <div className="mb-6">
                <span className="text-5xl font-bold text-[#C4B5FD] tabular-nums tracking-tight drop-shadow-[0_0_20px_rgba(196,181,253,0.4)]">
                  {counters[idx].display}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white leading-snug">
                {item.title}
              </h3>
              <p className="mt-2.5 text-xs leading-relaxed text-white/55">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

