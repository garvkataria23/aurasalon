"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, Minus, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";

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

const COMPARISON_ROWS = [
  {
    capability: "Appointments & Online Self-Booking",
    aura: "Real-time calendar + Pay-at-salon portal",
    auraStatus: true,
    manual: "Notebook registers / Phone calls only",
    manualStatus: false,
    genericPos: "Basic calendar / No self-booking",
    genericStatus: "partial",
  },
  {
    capability: "GST Invoicing & Dynamic UPI QR",
    aura: "Auto itemized GST + Instant QR on screen",
    auraStatus: true,
    manual: "Handwritten paper bills",
    manualStatus: false,
    genericPos: "Standard billing / No split taxes",
    genericStatus: "partial",
  },
  {
    capability: "Client 360 CRM & Formula History",
    aura: "Color formulas, visit logs & preferences",
    auraStatus: true,
    manual: "Memory / Lost notes in registers",
    manualStatus: false,
    genericPos: "Only basic phone number & name",
    genericStatus: "partial",
  },
  {
    capability: "Live Stock Deduction per Service",
    aura: "Auto-deducts shampoo, color & kits at checkout",
    auraStatus: true,
    manual: "Manual weekend stock counts",
    manualStatus: false,
    genericPos: "Retail only / No service recipes",
    genericStatus: false,
  },
  {
    capability: "Staff Attendance, Shifts & Commissions",
    aura: "Transparent commission engine & payroll",
    auraStatus: true,
    manual: "Spreadsheets & end-of-month disputes",
    manualStatus: false,
    genericPos: "Fixed hourly pay / No tiered turns",
    genericStatus: "partial",
  },
  {
    capability: "Memberships, Packages & Wallets",
    aura: "Prepaid packages + Family wallet sharing",
    auraStatus: true,
    manual: "Paper punch cards / Stamp vouchers",
    manualStatus: false,
    genericPos: "Basic gift cards only",
    genericStatus: false,
  },
  {
    capability: "Automated WhatsApp Retention Flows",
    aura: "Win-backs, birthdays & reminder triggers",
    auraStatus: true,
    manual: "Manual texting when remembered",
    manualStatus: false,
    genericPos: "No native WhatsApp automation",
    genericStatus: false,
  },
  {
    capability: "Real-Time Profit & Margin Analytics",
    aura: "Live net margin, staff occupancy & revenue",
    auraStatus: true,
    manual: "Wait 30 days for accountant summary",
    manualStatus: false,
    genericPos: "End-of-day sales totals only",
    genericStatus: "partial",
  },
  {
    capability: "Multi-Location Enterprise Control",
    aura: "Centralized stock transfers & unified reports",
    auraStatus: true,
    manual: "Impossible without endless phone sync",
    manualStatus: false,
    genericPos: "Extra licensing fee per terminal",
    genericStatus: "partial",
  },
];

export function ComparisonSection() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      className="py-20 md:py-28 bg-[var(--aura-off-white)] border-t border-[var(--aura-border)]"
    >
      <Container>
        {/* Section Heading */}
        <div
          className="mx-auto max-w-3xl text-center mb-14"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
          }}
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            Clear Advantage
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Why replace disconnected tools with Aura?
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
            Stop juggling notebooks, WhatsApp web, paper receipts, and unlinked card swipers. See how Aura compares side by side.
          </p>
        </div>

        {/* Comparison Matrix Table */}
        <div
          className="overflow-x-auto rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-md)]"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease-out 0.1s, transform 0.6s ease-out 0.1s",
          }}
        >
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[var(--aura-border)] bg-[var(--aura-off-white)]">
                <th className="p-4 sm:p-5 font-semibold text-[var(--aura-heading)] w-1/3">Capability</th>
                <th className="p-4 sm:p-5 font-bold text-[var(--aura-purple)] bg-[var(--aura-lavender)]/50 w-1/3 border-x border-[var(--aura-border)]">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    <span>Aura Salon OS</span>
                  </div>
                </th>
                <th className="p-4 sm:p-5 font-semibold text-[var(--aura-muted)] w-1/6">Manual Tools</th>
                <th className="p-4 sm:p-5 font-semibold text-[var(--aura-muted)] w-1/6">Generic POS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--aura-border)]">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.capability} className="hover:bg-[var(--aura-off-white)]/60 transition-colors">
                  {/* Capability name */}
                  <td className="p-4 sm:p-5 font-semibold text-[var(--aura-heading)]">
                    {row.capability}
                  </td>

                  {/* Aura Column */}
                  <td className="p-4 sm:p-5 bg-[var(--aura-lavender)]/25 border-x border-[var(--aura-border)]">
                    <div className="flex items-start gap-2">
                      <div className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="font-medium text-[var(--aura-heading)] text-xs sm:text-sm">
                        {row.aura}
                      </span>
                    </div>
                  </td>

                  {/* Manual Tools Column */}
                  <td className="p-4 sm:p-5">
                    <div className="flex items-start gap-2">
                      <div className="grid h-5 w-5 place-items-center rounded-full bg-red-100 text-red-700 shrink-0 mt-0.5">
                        <X className="h-3 w-3" />
                      </div>
                      <span className="text-xs text-[var(--aura-body)] hidden sm:inline">{row.manual}</span>
                    </div>
                  </td>

                  {/* Generic POS Column */}
                  <td className="p-4 sm:p-5">
                    <div className="flex items-start gap-2">
                      {row.genericStatus === "partial" ? (
                        <div className="grid h-5 w-5 place-items-center rounded-full bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                          <Minus className="h-3 w-3" />
                        </div>
                      ) : (
                        <div className="grid h-5 w-5 place-items-center rounded-full bg-red-100 text-red-700 shrink-0 mt-0.5">
                          <X className="h-3 w-3" />
                        </div>
                      )}
                      <span className="text-xs text-[var(--aura-body)] hidden sm:inline">{row.genericPos}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}
