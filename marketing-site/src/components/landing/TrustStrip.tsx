"use client";

import { Container } from "@/components/ui/Container";

const SALONS = [
  "Glow Salon",
  "Enrich Beauty",
  "The Style Bar",
  "Aura Cuts",
  "Blossom Spa",
  "Urban Chic Studio",
  "Radiance Clinic",
  "Luxe Hair Co.",
];

export function TrustStrip() {
  return (
    <section className="border-y border-[var(--aura-border)] bg-[var(--aura-off-white)] py-14 md:py-16 overflow-hidden">
      <Container>
        <p className="text-center text-sm font-semibold text-[var(--aura-heading)] mb-10">
          Trusted by growing salons across India
        </p>
      </Container>
      
      {/* Marquee Wrapper */}
      <div className="relative flex w-full overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap items-center gap-4 md:gap-6 min-w-max pl-4">
          {[...SALONS, ...SALONS, ...SALONS, ...SALONS].map((salon, i) => (
            <div
              key={i}
              className="flex items-center rounded-full border border-[var(--aura-border)] bg-white px-5 py-2.5 shadow-[var(--aura-shadow-sm)]"
            >
              <span className="text-sm font-medium text-[var(--aura-heading)] whitespace-nowrap">
                {salon}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Container>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 md:gap-12 text-center">
          <div className="flex flex-col items-center">
            <span className="text-xl md:text-2xl font-bold text-[var(--aura-heading)]">500+</span>
            <span className="text-xs md:text-sm font-medium text-[var(--aura-muted)] mt-1">Salons</span>
          </div>
          <div className="h-8 w-[1px] bg-[var(--aura-border)] hidden md:block" />
          <div className="flex flex-col items-center">
            <span className="text-xl md:text-2xl font-bold text-[var(--aura-heading)]">2M+</span>
            <span className="text-xs md:text-sm font-medium text-[var(--aura-muted)] mt-1">Appointments</span>
          </div>
          <div className="h-8 w-[1px] bg-[var(--aura-border)] hidden md:block" />
          <div className="flex flex-col items-center">
            <span className="text-xl md:text-2xl font-bold text-[var(--aura-heading)]">4.9★</span>
            <span className="text-xs md:text-sm font-medium text-[var(--aura-muted)] mt-1">Rating</span>
          </div>
        </div>
      </Container>
    </section>
  );
}
