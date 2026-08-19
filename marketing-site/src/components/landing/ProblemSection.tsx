"use client";

import { Container } from "@/components/ui/Container";
import {
  CalendarX,
  CreditCard,
  FileSpreadsheet,
  UserX,
  BellOff,
  BarChart3,
} from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { LandingDecor } from "./LandingDecor";

const PROBLEMS = [
  { icon: CalendarX, key: "home.problem.item.appointments" },
  { icon: CreditCard, key: "home.problem.item.payments" },
  { icon: FileSpreadsheet, key: "home.problem.item.inventory" },
  { icon: UserX, key: "home.problem.item.staff" },
  { icon: BellOff, key: "home.problem.item.followups" },
  { icon: BarChart3, key: "home.problem.item.reports" },
];

export function ProblemSection() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF] py-20 md:py-28">
      {/* Background Orb */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(243,240,255,0.95),transparent_36%),radial-gradient(circle_at_12%_70%,rgba(111,79,216,0.08),transparent_28%)] pointer-events-none" aria-hidden="true" />
      <LandingDecor variant="warm" />
      
      <Container className="relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          {/* Heading */}
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--aura-heading)] text-balance">
            {t("home.problem.title")}
          </h2>
          <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed md:text-lg">
            {t("home.problem.body")}
          </p>
        </div>

        {/* Problem Cards */}
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map(({ icon: Icon, key }, i) => (
            <div
              key={key}
              className={`reveal stagger-${i + 1} card-hover flex items-start gap-4 rounded-2xl border border-white/65 bg-white/35 p-5 shadow-[0_14px_48px_rgba(82,58,138,0.08)] backdrop-blur-xl ring-1 ring-white/45 transition-all duration-300 hover:bg-white/60 hover:shadow-[0_18px_56px_rgba(82,58,138,0.10)]`}
            >
              <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50">
                <Icon className="h-5 w-5 text-amber-500" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium leading-snug text-[var(--aura-heading)] mt-0.5">{t(key)}</p>
            </div>
          ))}
        </div>

        {/* Transition statement */}
        <div className="mx-auto mt-16 max-w-2xl text-center">
          <div className="mx-auto mb-8 h-2 w-2 rounded-full bg-gradient-to-tr from-[var(--aura-purple)] to-[var(--aura-lavender-strong)] shadow-sm" aria-hidden="true" />
          <p className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold tracking-[-0.02em] text-[var(--aura-heading)]">
            {t("home.problem.solutionTitle")}
          </p>
          <p className="mt-3 text-base text-[var(--aura-body)] leading-relaxed">
            {t("home.problem.solutionBody")}
          </p>
        </div>
      </Container>
    </section>
  );
}
