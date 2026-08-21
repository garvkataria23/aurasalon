"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/Container";

const CITIES = [
  { name: "Mumbai", type: "Salon Software" },
  { name: "Delhi NCR", type: "Salon Software" },
  { name: "Bangalore", type: "Spa Software" },
  { name: "Hyderabad", type: "Salon Software" },
  { name: "Chennai", type: "Spa Software" },
  { name: "Kolkata", type: "Salon Software" },
  { name: "Pune", type: "Spa Software" },
  { name: "Ahmedabad", type: "Salon Software" },
  { name: "Jaipur", type: "Spa Software" },
  { name: "Surat", type: "Salon Software" },
  { name: "Lucknow", type: "Spa Software" },
  { name: "Chandigarh", type: "Salon Software" },
  { name: "Indore", type: "Spa Software" },
  { name: "Gurugram", type: "Salon Software" },
  { name: "Noida", type: "Spa Software" },
  { name: "Kochi", type: "Salon Software" },
  { name: "Coimbatore", type: "Spa Software" },
  { name: "Nagpur", type: "Salon Software" },
  { name: "Thane", type: "Spa Software" },
  { name: "Visakhapatnam", type: "Salon Software" },
  { name: "Vadodara", type: "Spa Software" },
  { name: "Bhubaneswar", type: "Salon Software" },
  { name: "Ludhiana", type: "Spa Software" },
  { name: "Vijayawada", type: "Salon Software" },
  { name: "Rajkot", type: "Spa Software" },
  { name: "Mysore", type: "Salon Software" },
  { name: "Nashik", type: "Spa Software" },
  { name: "Faridabad", type: "Salon Software" },
  { name: "Patna", type: "Spa Software" },
  { name: "Udaipur", type: "Salon Software" },
];

export function CityDirectorySection() {
  return (
    <section className="relative bg-white py-20 md:py-28 overflow-hidden border-t border-[var(--aura-border)]">
      <Container className="relative z-10">
        
        {/* Intro */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <p className="font-serif italic text-base md:text-lg text-[var(--aura-purple)] font-medium mb-2">
            Local Presence
          </p>
          <h2 className="text-[clamp(2.2rem,4.5vw,3.4rem)] font-extrabold tracking-[-0.04em] text-[var(--aura-heading)] leading-tight">
            Aura Across India
          </h2>
          <p className="mt-3 text-base text-[var(--aura-body)]">
            Find Aura salon &amp; spa software in your city, explore local customer hubs below.
          </p>
        </div>

        {/* City Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 max-w-6xl mx-auto">
          {CITIES.map((city) => (
            <Link
              key={city.name}
              href="/demo"
              className="group flex flex-col justify-between rounded-2xl border border-[var(--aura-border)] bg-[#FCFBF8] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--aura-purple)]/40 hover:bg-white hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[var(--aura-heading)] group-hover:text-[var(--aura-purple)] transition-colors">
                  {city.name}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-[var(--aura-muted)] group-hover:text-[var(--aura-purple)] transition-colors" />
              </div>
              <span className="text-[10px] text-[var(--aura-muted)] mt-1.5">
                {city.type} {city.name}
              </span>
            </Link>
          ))}
        </div>

      </Container>
    </section>
  );
}
