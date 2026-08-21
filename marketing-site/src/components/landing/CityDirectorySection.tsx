"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/Container";

const MARKETS = [
  { name: "India", detail: "Salon & Spa Software" },
  { name: "United States", detail: "Salon Management OS" },
  { name: "United Kingdom", detail: "Beauty Business Software" },
  { name: "United Arab Emirates", detail: "Salon & Clinic Software" },
  { name: "Saudi Arabia", detail: "Spa Operations Platform" },
  { name: "Qatar", detail: "Salon Booking Software" },
  { name: "Oman", detail: "Salon POS & CRM" },
  { name: "Kuwait", detail: "Beauty Clinic Software" },
  { name: "Singapore", detail: "Salon Automation Software" },
  { name: "Canada", detail: "Salon Growth Platform" },
  { name: "Australia", detail: "Spa & Wellness Software" },
  { name: "Malaysia", detail: "Salon CRM & Billing" },
  { name: "Thailand", detail: "Spa Booking Platform" },
  { name: "South Africa", detail: "Salon Business Software" },
  { name: "New Zealand", detail: "Salon Scheduling Software" },
];

export function CityDirectorySection() {
  return (
    <section className="relative bg-white py-20 md:py-28 overflow-hidden border-t border-[var(--aura-border)]">
      <Container className="relative z-10">
        
        {/* Intro */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <p className="font-serif italic text-base md:text-lg text-[var(--aura-purple)] font-medium mb-2">
            Global Presence
          </p>
          <h2 className="text-[clamp(2.2rem,4.5vw,3.4rem)] font-extrabold tracking-[-0.04em] text-[var(--aura-heading)] leading-tight">
            Aura Around the World
          </h2>
          <p className="mt-3 text-base text-[var(--aura-body)]">
            Built for salons, spas, clinics, and wellness teams serving customers across global markets.
          </p>
        </div>

        {/* City Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 max-w-6xl mx-auto">
          {MARKETS.map((market) => (
            <Link
              key={market.name}
              href="/demo"
              className="group flex flex-col justify-between rounded-2xl border border-[var(--aura-border)] bg-[#FCFBF8] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--aura-purple)]/40 hover:bg-white hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[var(--aura-heading)] group-hover:text-[var(--aura-purple)] transition-colors">
                  {market.name}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-[var(--aura-muted)] group-hover:text-[var(--aura-purple)] transition-colors" />
              </div>
              <span className="text-[10px] text-[var(--aura-muted)] mt-1.5">
                {market.detail}
              </span>
            </Link>
          ))}
        </div>

      </Container>
    </section>
  );
}
