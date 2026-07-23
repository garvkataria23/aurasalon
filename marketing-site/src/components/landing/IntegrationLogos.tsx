"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { INTEGRATIONS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";

const COLORS = [
  { from: "from-emerald-500/15", to: "to-emerald-400/10", text: "text-emerald-600", border: "hover:border-emerald-400/30" },
  { from: "from-blue-500/15", to: "to-blue-400/10", text: "text-blue-600", border: "hover:border-blue-400/30" },
  { from: "from-neon-violet/15", to: "to-aura-rose/10", text: "text-neon-violet", border: "hover:border-neon-violet/30" },
  { from: "from-amber-500/15", to: "to-amber-400/10", text: "text-amber-600", border: "hover:border-amber-400/30" },
  { from: "from-rose-500/15", to: "to-rose-400/10", text: "text-rose-600", border: "hover:border-rose-400/30" },
  { from: "from-slate-500/15", to: "to-slate-400/10", text: "text-slate-600", border: "hover:border-slate-400/30" },
];

export function IntegrationLogos() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  const doubled = [...INTEGRATIONS, ...INTEGRATIONS];

  return (
    <section ref={ref} className="py-16 md:py-24 bg-white border-t border-aura-border overflow-hidden">
      <Container>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center text-sm font-medium text-aura-text-muted mb-12 uppercase tracking-wider"
        >
          Integrates with your favorite tools
        </motion.p>
      </Container>

      {/* Row 1 — scrolls left */}
      <div className="relative group">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex w-max animate-marquee group-hover:[animation-play-state:paused]"
        >
          {doubled.map((item, i) => {
            const color = COLORS[i % COLORS.length];
            return (
              <div
                key={`r1-${item.name}-${i}`}
                className={`flex items-center gap-3 px-6 py-3 mx-1.5 rounded-2xl border border-aura-border bg-white shadow-sm hover:shadow-md hover:scale-[1.03] transition-all duration-300 cursor-default ${color.border}`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color.from} ${color.to} flex items-center justify-center text-sm font-bold ${color.text}`}>
                  {item.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-aura-text">{item.name}</div>
                  <div className="text-xs text-aura-text-muted">{item.description}</div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Row 2 — scrolls right (reverse direction) */}
      <div className="relative group mt-3">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-aura-bg to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-aura-bg to-transparent z-10 pointer-events-none" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex w-max animate-marquee-reverse group-hover:[animation-play-state:paused]"
        >
          {doubled.map((item, i) => {
            const color = COLORS[(i + 3) % COLORS.length];
            return (
              <div
                key={`r2-${item.name}-${i}`}
                className={`flex items-center gap-3 px-6 py-3 mx-1.5 rounded-2xl border border-aura-border bg-white shadow-sm hover:shadow-md hover:scale-[1.03] transition-all duration-300 cursor-default ${color.border}`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color.from} ${color.to} flex items-center justify-center text-sm font-bold ${color.text}`}>
                  {item.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-aura-text">{item.name}</div>
                  <div className="text-xs text-aura-text-muted">{item.description}</div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Caption */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ delay: 0.4 }}
        className="text-center text-sm text-aura-text-muted mt-10"
      >
        And many more integrations coming soon
      </motion.p>
    </section>
  );
}
