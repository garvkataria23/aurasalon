"use client";

import { Check, X } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { LandingDecor } from "./LandingDecor";

const FEATURES = [
  {
    name: "Online Booking",
    aura: true,
    traditional: false,
    excel: false,
  },
  {
    name: "GST Billing",
    aura: true,
    traditional: true,
    excel: false,
  },
  {
    name: "Client CRM",
    aura: true,
    traditional: true,
    excel: false,
  },
  {
    name: "Staff Management",
    aura: true,
    traditional: true,
    excel: false,
  },
  {
    name: "Inventory",
    aura: true,
    traditional: true,
    excel: false,
  },
  {
    name: "WhatsApp Marketing",
    aura: true,
    traditional: false,
    excel: false,
  },
  {
    name: "Real-time Reports",
    aura: true,
    traditional: true,
    excel: false,
  },
  {
    name: "Multi-branch Support",
    aura: true,
    traditional: false,
    excel: false,
  },
];

export function ComparisonSection() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28 bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF] border-t border-[var(--aura-border)]">
      <LandingDecor variant="soft" />
      <Container className="relative z-10">
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center mb-14 reveal">
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            COMPARISON
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Why choose Aura over others?
          </h2>
        </div>

        {/* Comparison Table */}
        <div className="reveal mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/50 bg-white/30 shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-[var(--aura-border)]">
                  <th className="p-5 font-semibold text-[var(--aura-heading)] bg-white/25 backdrop-blur-sm">Feature</th>
                  <th className="p-5 font-bold text-white bg-[var(--aura-purple)]">
                    Aura
                  </th>
                  <th className="p-5 font-semibold text-[var(--aura-heading)] bg-white/25 text-center backdrop-blur-sm">
                    Traditional Software
                  </th>
                  <th className="p-5 font-semibold text-[var(--aura-heading)] bg-white/25 text-center backdrop-blur-sm">
                    Excel/WhatsApp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--aura-border)]">
                {FEATURES.map((row, i) => (
                  <tr key={i} className="hover:bg-[var(--aura-off-white)]/50 transition-colors">
                    <td className="p-5 font-medium text-[var(--aura-heading)]">
                      {row.name}
                    </td>
                    <td className="p-5 bg-[var(--aura-lavender)]/30 border-x border-[var(--aura-border)]">
                      <div className="flex justify-center">
                        <Check className="h-5 w-5 text-emerald-500" aria-label="Yes" />
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex justify-center">
                        {row.traditional ? (
                          <Check className="h-5 w-5 text-emerald-500" aria-label="Yes" />
                        ) : (
                          <X className="h-5 w-5 text-red-500" aria-label="No" />
                        )}
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex justify-center">
                        {row.excel ? (
                          <Check className="h-5 w-5 text-emerald-500" aria-label="Yes" />
                        ) : (
                          <X className="h-5 w-5 text-red-500" aria-label="No" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Container>
    </section>
  );
}
