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

const PROBLEMS = [
  { icon: CalendarX, text: "Appointments scattered across notebooks" },
  { icon: CreditCard, text: "Payments tracked in a different system" },
  { icon: FileSpreadsheet, text: "Inventory managed in spreadsheets" },
  { icon: UserX, text: "Staff attendance tracked manually" },
  { icon: BellOff, text: "Customer follow-ups forgotten" },
  { icon: BarChart3, text: "Reports that arrive too late" },
];

export function ProblemSection() {
  return (
    <section className="bg-[var(--aura-off-white)] py-20 md:py-28">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          {/* Heading */}
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--aura-heading)] text-balance">
            Running a salon shouldn't mean running ten different systems.
          </h2>
          <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed md:text-lg">
            Most salon owners spend their day juggling disconnected tools.
            Sound familiar?
          </p>
        </div>

        {/* Problem Cards */}
        <div className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map(({ icon: Icon, text }, i) => (
            <div
              key={text}
              className="flex items-start gap-3.5 rounded-[var(--aura-radius-lg)] border border-[var(--aura-border)] bg-white p-5 transition-shadow duration-300 hover:shadow-[var(--aura-shadow-sm)]"
              style={{ animation: `fadeInUp 0.5s ease-out ${0.1 + i * 0.06}s both` }}
            >
              <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-red-50">
                <Icon className="h-4 w-4 text-red-400" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium leading-snug text-[var(--aura-heading)]">{text}</p>
            </div>
          ))}
        </div>

        {/* Transition statement */}
        <div className="mx-auto mt-16 max-w-2xl text-center">
          <div className="mx-auto mb-6 h-12 w-px bg-gradient-to-b from-transparent via-[var(--aura-border)] to-[var(--aura-purple)]" aria-hidden="true" />
          <p className="text-[clamp(1.5rem,3.5vw,2.25rem)] font-bold tracking-[-0.02em] text-[var(--aura-heading)]">
            Aura brings <span className="text-[var(--aura-purple)]">everything</span> together.
          </p>
          <p className="mt-3 text-base text-[var(--aura-body)] leading-relaxed">
            One platform. Every tool your salon needs. Connected from day one.
          </p>
        </div>
      </Container>
    </section>
  );
}
