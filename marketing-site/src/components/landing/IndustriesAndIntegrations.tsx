"use client";

import { Container } from "@/components/ui/Container";
import { Scissors, Sparkles, HandHeart, Stethoscope, Zap, Building2 } from "lucide-react";

const INDUSTRIES = [
  {
    icon: Scissors,
    title: "Hair Salon",
    description: "Chair scheduling, chemical service timing, and stylist turns.",
  },
  {
    icon: Sparkles,
    title: "Spa & Wellness",
    description: "Treatment room availability and therapist turn management.",
  },
  {
    icon: HandHeart,
    title: "Nail Studio",
    description: "Fast station turnaround and nail art add-on pricing.",
  },
  {
    icon: Stethoscope,
    title: "Beauty Clinic",
    description: "Detailed client consultation histories and treatment plans.",
  },
  {
    icon: Zap,
    title: "Barbershop",
    description: "High-speed walk-in queue management and quick billing.",
  },
  {
    icon: Building2,
    title: "Multi-chain Brands",
    description: "Centralized owner dashboard and cross-branch loyalty.",
  },
];

const INTEGRATIONS = [
  "WhatsApp Business",
  "UPI/Razorpay",
  "Google Calendar",
  "Plausible",
  "Tally",
  "Custom API"
];

export function IndustriesAndIntegrations() {
  return (
    <section className="py-20 md:py-28 bg-[var(--aura-off-white)] border-t border-[var(--aura-border)]">
      <Container>
        {/* Industries */}
        <div className="mb-20">
          <div className="mx-auto max-w-3xl text-center mb-16 reveal">
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              Built for every beauty business
            </h2>
          </div>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((ind, i) => {
              const Icon = ind.icon;
              return (
                <div
                  key={ind.title}
                  className={`reveal stagger-${i + 1} rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-6 shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:shadow-[var(--aura-shadow-md)] hover:-translate-y-1 flex flex-col`}
                >
                  <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[var(--aura-lavender)] text-[var(--aura-purple)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-bold text-[var(--aura-heading)]">{ind.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--aura-body)] flex-1">
                    {ind.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Integrations */}
        <div className="reveal">
          <div className="mx-auto max-w-3xl text-center mb-10">
            <h2 className="text-2xl font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)]">
              Connects with your tools
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {INTEGRATIONS.map((name, i) => (
              <span
                key={name}
                className={`reveal stagger-${i + 1} inline-flex items-center rounded-full bg-white border border-[var(--aura-border)] px-4 py-2 text-sm font-medium text-[var(--aura-body)] shadow-[var(--aura-shadow-sm)]`}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
