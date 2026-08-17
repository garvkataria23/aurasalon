"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Calculator } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";

type Assumptions = { appointments: number; ticket: number; noShow: number; recovery: number; hours: number; hourValue: number };
const limits: Record<keyof Assumptions, [number, number]> = { appointments: [0, 100000], ticket: [0, 1000000], noShow: [0, 100], recovery: [0, 100], hours: [0, 744], hourValue: [0, 100000] };

function clamp(value: number, [min, max]: [number, number]) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function ROICalculator() {
  const [values, setValues] = useState<Assumptions>({ appointments: 300, ticket: 1500, noShow: 10, recovery: 20, hours: 16, hourValue: 300 });
  const currency = useMemo(() => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }), []);
  
  const result = useMemo(() => {
    const missedAppointmentValue = values.appointments * values.ticket * (values.noShow / 100);
    const recoveredRevenue = missedAppointmentValue * (values.recovery / 100);
    const timeValue = values.hours * values.hourValue;
    return { recoveredRevenue, timeValue, monthly: recoveredRevenue + timeValue };
  }, [values]);

  const update = (key: keyof Assumptions, input: string) => setValues((current) => ({ ...current, [key]: clamp(Number(input), limits[key]) }));

  const fields: Array<{ key: keyof Assumptions; label: string; step?: number }> = [
    { key: "appointments", label: "Monthly Client Visits" },
    { key: "ticket", label: "Average Ticket Value (₹)" },
    { key: "noShow", label: "Estimated No-Show Rate (%)", step: 0.5 },
    { key: "recovery", label: "WhatsApp Recovery Target (%)", step: 0.5 },
    { key: "hours", label: "Admin Hours Saved / Mo", step: 0.5 },
    { key: "hourValue", label: "Hourly Time Value (₹)" },
  ];

  return (
    <section className="bg-white py-20 md:py-28 border-t border-[var(--aura-border)]">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-16 items-center">
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              Value Calculator
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              Calculate your salon's monthly upside
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[var(--aura-body)]">
              See how automated WhatsApp reminders and streamlined front desk operations translate into recovered revenue and saved admin hours.
            </p>

            <div className="mt-8 rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4 flex items-start gap-3 shadow-xs">
              <Calculator className="h-5 w-5 text-[var(--aura-purple)] shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed text-[var(--aura-body)]">
                Based on averages from Indian salons using automated reminder workflows and integrated GST express checkout.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-lg)]">
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7 bg-[var(--aura-off-white)]">
              {fields.map((field) => (
                <label key={field.key} className="grid gap-1.5 text-xs font-semibold text-[var(--aura-heading)]">
                  <span>{field.label}</span>
                  <input
                    type="number"
                    min={limits[field.key][0]}
                    max={limits[field.key][1]}
                    step={field.step ?? 1}
                    inputMode="decimal"
                    value={values[field.key]}
                    onChange={(event) => update(field.key, event.target.value)}
                    className="w-full rounded-xl border border-[var(--aura-border)] bg-white px-3.5 py-2.5 text-sm font-semibold text-[var(--aura-heading)] outline-none focus:border-[var(--aura-purple)] focus:ring-2 focus:ring-[var(--aura-purple-soft)] shadow-xs transition-all"
                  />
                </label>
              ))}
            </div>

            <div className="bg-[var(--aura-heading)] p-6 text-white sm:p-8" aria-live="polite" aria-atomic="true">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-white/60 font-medium">Estimated Monthly Upside</p>
                  <strong className="mt-1 block text-3xl font-bold sm:text-4xl text-emerald-400 tabular-nums">
                    {currency.format(result.monthly)}
                  </strong>
                </div>
                <div>
                  <p className="text-xs text-white/60 font-medium">Annualized Benefit</p>
                  <strong className="mt-1 block text-xl sm:text-2xl font-bold text-white tabular-nums">
                    {currency.format(result.monthly * 12)}
                  </strong>
                </div>
              </div>

              <dl className="mt-6 grid gap-3 border-t border-white/10 pt-5 text-xs sm:grid-cols-2">
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-white/60">Recovered No-Show Revenue</dt>
                  <dd className="mt-1 font-bold text-white">{currency.format(result.recoveredRevenue)}</dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-white/60">Admin Time Savings Value</dt>
                  <dd className="mt-1 font-bold text-white">{currency.format(result.timeValue)}</dd>
                </div>
              </dl>

              <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
                <a
                  href={CTA_LINKS.demo}
                  className="inline-flex items-center gap-2 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] px-6 py-2.5 text-xs font-bold text-white hover:bg-[var(--aura-purple-hover)] shadow-xs transition-all"
                >
                  Book a Demo to Unlock This
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
