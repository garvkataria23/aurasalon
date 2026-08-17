"use client";

import { Container } from "@/components/ui/Container";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ShieldCheck, Building2, Zap, Calendar } from "lucide-react";

export function Stats() {
  const { t } = useLanguage();
  const foundations = [
    { key: "tenant", icon: ShieldCheck, num: "01", title: "Tenant Isolation", body: "Tenant-owned data and access remain strictly scoped to your salon organization." },
    { key: "branch", icon: Building2, num: "02", title: "Branch-Aware Records", body: "Bookings, staff, stock and reports respect authorized branch context." },
    { key: "realtime", icon: Zap, num: "03", title: "Real-Time Events", body: "Booking, dashboard, queue and notification changes flow instantly across terminals." },
    { key: "dates", icon: Calendar, num: "04", title: "IST Business Dates", body: "Operational dates, daily closing shifts and GST billing follow Indian business time." },
  ];

  return (
    <section className="bg-white py-20 md:py-28 border-t border-[var(--aura-border)]">
      <Container>
        <div className="mb-12 max-w-3xl">
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            Core Architecture
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Built for operational integrity
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl">
            Enterprise multi-tenant isolation, real-time sync, and Indian business compliance built into the core.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {foundations.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-6 shadow-[var(--aura-shadow-xs)] transition-all hover:shadow-[var(--aura-shadow-md)] hover:border-[var(--aura-purple)]/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xl font-bold text-[var(--aura-purple)] tabular-nums">{item.num}</span>
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-white border border-[var(--aura-border)] text-[var(--aura-purple)] shadow-xs">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-[var(--aura-heading)]">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--aura-body)]">
                    {item.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
