"use client";

import { Container } from "@/components/ui/Container";
import { Scissors, Sparkles, HandHeart, Stethoscope, Building2 } from "lucide-react";

const CATEGORIES = [
  { label: "Salon", icon: Scissors },
  { label: "Spa", icon: Sparkles },
  { label: "Nail Studio", icon: HandHeart },
  { label: "Beauty Clinic", icon: Stethoscope },
  { label: "Multi-location Brands", icon: Building2 },
];

export function TrustStrip() {
  return (
    <section className="border-y border-[var(--aura-border)] bg-[var(--aura-off-white)] py-14 md:py-16">
      <Container>
        <p className="text-center text-sm font-semibold text-[var(--aura-heading)] mb-10 md:text-base">
          Built for modern salons, spas &amp; beauty businesses
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
          {CATEGORIES.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-[var(--aura-radius-lg)] border border-[var(--aura-border)] bg-white px-5 py-3 shadow-[var(--aura-shadow-xs)] transition-shadow duration-300 hover:shadow-[var(--aura-shadow-sm)]"
            >
              <Icon className="h-4 w-4 text-[var(--aura-purple)]" aria-hidden="true" />
              <span className="text-sm font-medium text-[var(--aura-heading)] whitespace-nowrap">{label}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
