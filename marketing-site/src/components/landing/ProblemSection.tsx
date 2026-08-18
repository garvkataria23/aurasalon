"use client";

import { Container } from "@/components/ui/Container";
import {
  CalendarX,
  CreditCard,
  FileSpreadsheet,
  UserX,
  BellOff,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

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
    <section className="bg-[var(--aura-off-white)] py-20 md:py-28">
      <Container>
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
        <div className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map(({ icon: Icon, key }, i) => (
            <div
              key={key}
              className="flex items-start gap-3.5 rounded-[var(--aura-radius-lg)] border border-[var(--aura-border)] bg-white p-5 transition-shadow duration-300 hover:shadow-[var(--aura-shadow-sm)]"
              style={{ animation: `fadeInUp 0.5s ease-out ${0.1 + i * 0.06}s both` }}
            >
              <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-red-50">
                <Icon className="h-4 w-4 text-red-400" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium leading-snug text-[var(--aura-heading)]">{t(key)}</p>
            </div>
          ))}
        </div>

        {/* Transition statement */}
        <div className="mx-auto mt-16 max-w-2xl text-center">
          <div className="mx-auto mb-6 h-12 w-px bg-gradient-to-b from-transparent via-[var(--aura-border)] to-[var(--aura-purple)]" aria-hidden="true" />
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
