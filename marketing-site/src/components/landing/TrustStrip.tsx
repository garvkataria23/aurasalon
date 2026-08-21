"use client";

import { Container } from "@/components/ui/Container";
import { LandingDecor } from "./LandingDecor";

const BRANDS = [
  { name: "LOOKS SALON", tag: "150+ Outlets" },
  { name: "TONI&GUY", tag: "Global Chain" },
  { name: "GEETANJALI", tag: "Luxury Salon" },
  { name: "HABIB'S", tag: "Est. 1984" },
  { name: "NAILASHES", tag: "50+ Studios" },
  { name: "ASHTAMUDI WELLNESS", tag: "Ayurvedic Spa" },
  { name: "THE MINK", tag: "Bespoke Grooming" },
  { name: "ENRICH BEAUTY", tag: "Premium Network" },
  { name: "BLOSSOM SPA", tag: "Wellness Center" },
  { name: "URBAN CHIC", tag: "Hair & Skin" },
];

export function TrustStrip() {
  return (
    <section className="relative bg-white py-12 md:py-16 overflow-hidden border-b border-[var(--aura-border)]">
      <LandingDecor variant="quiet" />
      <Container className="relative z-10">
        <p className="text-center text-xs sm:text-sm font-bold uppercase tracking-[.15em] text-[var(--aura-purple)] mb-8">
          Trusted by thousands of brands to automate and grow their business
        </p>
      </Container>
      
      {/* Marquee Wrapper */}
      <div className="relative z-10 flex w-full overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap items-center gap-4 md:gap-6 min-w-max pl-4">
          {[...BRANDS, ...BRANDS, ...BRANDS].map((brand, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-[var(--aura-border)] bg-[#FCFBF8] px-6 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all hover:border-[var(--aura-purple)]/30 hover:shadow-md"
            >
              <span className="font-extrabold tracking-wider text-sm md:text-base text-[var(--aura-heading)] uppercase">
                {brand.name}
              </span>
              <span className="rounded-md bg-[var(--aura-lavender)] px-2 py-0.5 text-[10px] font-semibold text-[var(--aura-purple)]">
                {brand.tag}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Container className="relative z-10">
        <div className="mt-10 flex flex-wrap items-center justify-center gap-8 md:gap-16 text-center">
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-extrabold text-[var(--aura-heading)]">3,500+</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--aura-muted)] mt-0.5">Partner Salons</span>
          </div>
          <div className="h-8 w-[1px] bg-[var(--aura-border)] hidden sm:block" />
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-extrabold text-[var(--aura-heading)]">12M+</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--aura-muted)] mt-0.5">Appointments Booked</span>
          </div>
          <div className="h-8 w-[1px] bg-[var(--aura-border)] hidden sm:block" />
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-extrabold text-[var(--aura-heading)]">₹250Cr+</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--aura-muted)] mt-0.5">GST Bills Processed</span>
          </div>
          <div className="h-8 w-[1px] bg-[var(--aura-border)] hidden sm:block" />
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-extrabold text-amber-500">4.9★</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--aura-muted)] mt-0.5">Capterra &amp; Google</span>
          </div>
        </div>
      </Container>
    </section>
  );
}
