"use client";

import { Container } from "@/components/ui/Container";
import { Scissors, Sparkles, HandHeart, Stethoscope, Zap, Building2 } from "lucide-react";
import { LandingDecor } from "./LandingDecor";

const INDUSTRIES = [
  { icon: Scissors, title: "Hair Salon" },
  { icon: Sparkles, title: "Spa & Wellness" },
  { icon: HandHeart, title: "Nail Studio" },
  { icon: Stethoscope, title: "Beauty Clinic" },
  { icon: Zap, title: "Barbershop" },
  { icon: Building2, title: "Multi-chain" },
];

const INTEGRATIONS = [
  "WhatsApp Business",
  "UPI/Razorpay",
  "Google Calendar",
  "Plausible",
  "Tally",
  "Custom API",
];

export function IndustriesAndIntegrations() {
  return (
    <section className="relative overflow-hidden py-16 md:py-20 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF]">
      <LandingDecor variant="warm" />
      <Container className="relative z-10">
        {/* Industries — compact icon strip */}
        <div className="reveal mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center rounded-full border border-[var(--aura-purple)]/15 bg-white/55 px-3 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 backdrop-blur-sm">
            BUILT FOR EVERY BEAUTY BUSINESS
          </span>
          <div className="mt-10 flex flex-wrap justify-center gap-8 md:gap-14">
            {INDUSTRIES.map((ind) => {
              const Icon = ind.icon;
              return (
                <div key={ind.title} className="flex flex-col items-center gap-3.5 group">
                  <div className="grid h-20 w-20 place-items-center rounded-[1.5rem] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-sm)] transition-all duration-300 group-hover:shadow-[var(--aura-shadow-md)] group-hover:-translate-y-0.5 md:h-24 md:w-24">
                    <Icon className="h-9 w-9 text-[var(--aura-purple)] md:h-11 md:w-11" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--aura-heading)] md:text-base">{ind.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Integrations — inline text */}
        <div className="reveal mt-12 text-center">
          <p className="text-sm text-[var(--aura-body)]">
            Integrates with{" "}
            {INTEGRATIONS.map((name, i) => (
              <span key={name}>
                <span className="font-semibold text-[var(--aura-heading)]">{name}</span>
                {i < INTEGRATIONS.length - 1 && (
                  <span className="mx-1 text-[var(--aura-border)]">·</span>
                )}
              </span>
            ))}
          </p>
        </div>
      </Container>
    </section>
  );
}
