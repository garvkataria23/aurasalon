"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Check, X } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const COMPARISON = [
  { feature: "GST-Ready Billing", aura: true, fresha: false, vagaro: false, local: true },
  { feature: "UPI Payments", aura: true, fresha: false, vagaro: false, local: false },
  { feature: "WhatsApp Integration", aura: true, fresha: false, vagaro: false, local: false },
  { feature: "AI Marketing Automation", aura: true, fresha: false, vagaro: false, local: false },
  { feature: "Indian Payroll (PF/ESI)", aura: true, fresha: false, vagaro: false, local: false },
  { feature: "Multi-Branch Dashboard", aura: true, fresha: true, vagaro: true, local: false },
  { feature: "Online Booking Portal", aura: true, fresha: true, vagaro: true, local: false },
  { feature: "Client CRM & 360 View", aura: true, fresha: true, vagaro: true, local: false },
  { feature: "Inventory Management", aura: true, fresha: false, vagaro: true, local: false },
  { feature: "Starting Price", aura: "₹999/mo", fresha: "Free*", vagaro: "$30/mo", local: "Varies" },
  { feature: "Indian Market Support", aura: true, fresha: false, vagaro: false, local: true },
];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
    ) : (
      <X className="w-5 h-5 text-red-400/60 mx-auto" />
    );
  }
  return <span className="text-sm font-semibold text-aura-text">{value}</span>;
}

export function CompetitorComparison() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="py-20 md:py-28 bg-aura-bg">
      <Container>
        <SectionHeading
          badge="Why Aura?"
          title="Aura vs The Rest"
          subtitle="See how Aura compares to international tools and local alternatives — built specifically for Indian salons."
        />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 overflow-x-auto max-w-5xl mx-auto"
        >
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-aura-border">
                <th className="text-left py-4 px-4 text-sm font-semibold text-aura-text w-1/3">Feature</th>
                <th className="text-center py-4 px-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-neon-violet to-aura-rose text-white text-xs font-bold">
                    ✨ Aura
                  </div>
                </th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-aura-text-muted">Fresha</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-aura-text-muted">Vagaro</th>
                <th className="text-center py-4 px-4 text-sm font-semibold text-aura-text-muted">Local Tools</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={row.feature} className={`border-b border-aura-border/50 ${i % 2 === 0 ? "bg-white/50" : ""}`}>
                  <td className="py-3.5 px-4 text-sm text-aura-text-secondary font-medium">{row.feature}</td>
                  <td className="py-3.5 px-4 text-center bg-neon-violet/[0.03]">
                    <Cell value={row.aura} />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <Cell value={row.fresha} />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <Cell value={row.vagaro} />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <Cell value={row.local} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-aura-text-muted mt-6"
        >
          * Fresha is free for basic use but charges commission on online bookings. Vagaro pricing is in USD and not optimized for India.
        </motion.p>
      </Container>
    </section>
  );
}
