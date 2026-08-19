"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Calculator } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";
import { LandingDecor } from "./LandingDecor";

type Assumptions = { appointments: number; ticket: number; noShow: number; recovery: number; hours: number; hourValue: number };
const limits: Record<keyof Assumptions, [number, number]> = { appointments: [0, 100000], ticket: [0, 1000000], noShow: [0, 100], recovery: [0, 100], hours: [0, 744], hourValue: [0, 100000] };

function clamp(value: number, [min, max]: [number, number]) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function ROICalculator() {
  const [values, setValues] = useState<Assumptions>({ appointments: 300, ticket: 1500, noShow: 10, recovery: 20, hours: 16, hourValue: 300 });
  const [scenario, setScenario] = useState<"Conservative" | "Realistic" | "Aggressive">("Realistic");
  const currency = useMemo(() => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }), []);
  const scenarioMultiplier = scenario === "Conservative" ? 0.75 : scenario === "Aggressive" ? 1.25 : 1;
  
  const result = useMemo(() => {
    const missedAppointmentValue = values.appointments * values.ticket * (values.noShow / 100);
    const recoveredRevenue = missedAppointmentValue * (values.recovery / 100);
    const timeValue = values.hours * values.hourValue;
    const monthly = (recoveredRevenue + timeValue) * scenarioMultiplier;
    return { recoveredRevenue: recoveredRevenue * scenarioMultiplier, timeValue: timeValue * scenarioMultiplier, monthly };
  }, [scenarioMultiplier, values]);

  const update = (key: keyof Assumptions, input: string) => setValues((current) => ({ ...current, [key]: clamp(Number(input), limits[key]) }));

  const fields: Array<{ key: keyof Assumptions; label: string; step?: number }> = [
    { key: "appointments", label: "Monthly Client Visits" },
    { key: "ticket", label: "Average Ticket Value (₹)" },
    { key: "noShow", label: "Estimated No-Show Rate (%)", step: 0.5 },
    { key: "recovery", label: "WhatsApp Recovery Target (%)", step: 0.5 },
    { key: "hours", label: "Admin Hours Saved / Mo", step: 0.5 },
    { key: "hourValue", label: "Hourly Time Value (₹)" },
  ];
  const presets: Array<{ label: string; values: Assumptions }> = [
    { label: "Small salon", values: { appointments: 180, ticket: 900, noShow: 8, recovery: 18, hours: 10, hourValue: 220 } },
    { label: "Busy salon", values: { appointments: 520, ticket: 1600, noShow: 11, recovery: 24, hours: 24, hourValue: 350 } },
    { label: "Premium salon", values: { appointments: 420, ticket: 3200, noShow: 9, recovery: 26, hours: 22, hourValue: 500 } },
    { label: "Multi-branch", values: { appointments: 1400, ticket: 1800, noShow: 10, recovery: 28, hours: 64, hourValue: 420 } },
  ];
  const recoveredShare = result.monthly > 0 ? Math.round((result.recoveredRevenue / result.monthly) * 100) : 0;

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF] py-20 md:py-28 border-t border-[var(--aura-border)]">
      <LandingDecor variant="soft" />
      <Container className="relative z-10">
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

            <div className="mt-8 rounded-xl border border-white/50 bg-white/30 p-4 flex items-start gap-3 shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35">
              <Calculator className="h-5 w-5 text-[var(--aura-purple)] shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed text-[var(--aura-body)]">
                Based on averages from Indian salons using automated reminder workflows and integrated GST express checkout.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setValues(preset.values)}
                  className="rounded-full border border-[var(--aura-border)] bg-white px-3 py-1.5 text-[11px] font-bold text-[var(--aura-heading)] transition-colors hover:border-[var(--aura-purple)]/30 hover:bg-[var(--aura-lavender)] hover:text-[var(--aura-purple)]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--aura-radius-xl)] border border-white/50 bg-white/30 shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35">
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7 bg-white/25 backdrop-blur-sm">
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
                  <input
                    type="range"
                    min={field.key === "hourValue" ? 0 : limits[field.key][0]}
                    max={field.key === "appointments" ? 2000 : field.key === "ticket" ? 10000 : field.key === "hours" ? 120 : field.key === "hourValue" ? 2000 : limits[field.key][1]}
                    step={field.step ?? 1}
                    value={values[field.key]}
                    onChange={(event) => update(field.key, event.target.value)}
                    className="accent-[var(--aura-purple)]"
                  />
                </label>
              ))}
            </div>

            <div className="bg-[var(--aura-heading)] p-6 text-white sm:p-8" aria-live="polite" aria-atomic="true">
              <div className="mb-5 flex flex-wrap gap-2">
                {["Conservative", "Realistic", "Aggressive"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setScenario(mode as typeof scenario)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${scenario === mode ? "bg-[var(--aura-purple)] text-white" : "bg-white/10 text-white/70 ring-1 ring-white/10"}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
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

              <div className="mt-5 space-y-2 rounded-xl bg-white/5 p-3 text-xs ring-1 ring-white/10">
                <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="bg-emerald-400" style={{ width: `${recoveredShare}%` }} />
                  <div className="bg-[var(--aura-purple)]" style={{ width: `${100 - recoveredShare}%` }} />
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-white/70">
                  <span>Recovered revenue {recoveredShare}%</span>
                  <span>Time savings {100 - recoveredShare}%</span>
                </div>
                <p className="border-t border-white/10 pt-2 text-white/70">
                  Formula: {values.appointments} visits x {currency.format(values.ticket)} x {values.noShow}% no-show x {values.recovery}% recovery + {values.hours} hrs x {currency.format(values.hourValue)}.
                </p>
              </div>

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
