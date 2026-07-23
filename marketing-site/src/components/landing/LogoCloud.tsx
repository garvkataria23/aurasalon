"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

const SALON_NAMES = [
  "Glow Studio",
  "The Style Lounge",
  "Bloom Beauty",
  "Royal Grooming",
  "Serenity Spa",
  "StyleCraft",
  "Lux Hair Studio",
  "Aura Beauty",
  "Velvet Salon",
  "Bliss Spa",
];

const GRADIENT_PAIRS = [
  ["from-neon-violet/20", "to-aura-rose/20"],
  ["from-aura-rose/20", "to-aura-amber/20"],
  ["from-aura-amber/20", "to-emerald-400/20"],
  ["from-emerald-400/20", "to-neon-violet/20"],
  ["from-neon-violet/15", "to-aura-amber/15"],
  ["from-aura-rose/15", "to-neon-violet/15"],
  ["from-aura-amber/15", "to-aura-rose/15"],
  ["from-emerald-400/15", "to-aura-amber/15"],
  ["from-neon-violet/20", "to-emerald-400/20"],
  ["from-aura-rose/20", "to-neon-violet/20"],
];

export function LogoCloud() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section ref={ref} className="py-16 md:py-20 border-y border-aura-border bg-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center text-sm font-medium text-aura-text-muted mb-10 uppercase tracking-wider"
        >
          Trusted by forward-thinking salons across India
        </motion.p>
      </div>

      {/* Infinite marquee — continuous scroll with pause on hover */}
      <div className="relative group">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex w-max animate-marquee group-hover:[animation-play-state:paused]"
        >
          {[...SALON_NAMES, ...SALON_NAMES].map((name, i) => {
            const colors = GRADIENT_PAIRS[i % GRADIENT_PAIRS.length];
            return (
              <div
                key={`${name}-${i}`}
                className="inline-flex items-center gap-2.5 px-7 py-3 mx-1.5 rounded-2xl border border-aura-border bg-white shadow-sm hover:shadow-md hover:border-aura-border-strong hover:scale-[1.04] transition-all duration-300 cursor-default"
              >
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[0]} ${colors[1]} flex items-center justify-center text-xs font-bold text-neon-violet`}>
                  {name.charAt(0)}
                </div>
                <span className="text-sm font-semibold text-aura-text-secondary whitespace-nowrap">
                  {name}
                </span>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
