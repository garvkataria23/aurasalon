"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Shield, Globe, Headphones, Zap } from "lucide-react";

const BADGES = [
  { icon: Globe, label: "Made in India", sublabel: "Built for Indian salons" },
  { icon: Shield, label: "Bank-Level Security", sublabel: "256-bit encryption" },
  { icon: Zap, label: "GST Ready", sublabel: "Auto invoicing & filing" },
  { icon: Headphones, label: "24/7 Support", sublabel: "WhatsApp & phone" },
];

export function TrustBadges() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <section ref={ref} className="py-12 bg-white border-y border-aura-border">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {BADGES.map((badge, i) => (
            <motion.div
              key={badge.label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="flex items-center gap-3 justify-center md:justify-start"
            >
              <div className="w-10 h-10 rounded-xl bg-neon-violet/10 flex items-center justify-center flex-shrink-0">
                <badge.icon className="w-5 h-5 text-neon-violet" />
              </div>
              <div>
                <div className="text-sm font-semibold text-aura-text">{badge.label}</div>
                <div className="text-xs text-aura-text-muted">{badge.sublabel}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
