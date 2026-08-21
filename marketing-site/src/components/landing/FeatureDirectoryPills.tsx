"use client";

import Link from "next/link";
import { Container } from "@/components/ui/Container";

const FEATURE_PILLS = [
  { label: "24/7 Online Booking", href: "/features/appointments" },
  { label: "Salon Client Profile Software", href: "/features/client-crm" },
  { label: "Loyalty Rewards", href: "/features" },
  { label: "Smart Scheduling", href: "/features/appointments" },
  { label: "Staff Management", href: "/features/staff-management" },
  { label: "Gift Cards & Vouchers", href: "/features/billing" },
  { label: "Reporting", href: "/features/finance" },
  { label: "Inventory Control", href: "/features/inventory" },
  { label: "Multi-location Support", href: "/features/multi-location" },
  { label: "Forms & Surveys", href: "/features/client-crm" },
  { label: "Targeted Marketing", href: "/features/marketing-ai" },
  { label: "Customer Segmentation", href: "/features/marketing-ai" },
  { label: "Memberships & Packages", href: "/features" },
  { label: "Easy Invoices", href: "/features/billing" },
  { label: "Client Feedback", href: "/features/client-crm" },
  { label: "Aura AI Genius", href: "/features/marketing-ai" },
];

export function FeatureDirectoryPills() {
  return (
    <section className="relative bg-[#FCFBF8] py-16 md:py-24 overflow-hidden border-t border-[var(--aura-border)]">
      <Container className="relative z-10">
        
        {/* Intro */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-serif italic text-base md:text-lg text-[var(--aura-purple)] font-medium mb-3">
            A Complete Suite of Salon Scheduling &amp; Business Tools
          </p>
          <h2 className="text-[clamp(2rem,4.2vw,3.2rem)] font-extrabold tracking-[-0.03em] text-[var(--aura-heading)] leading-tight">
            Explore Our Complete List of Features
          </h2>
        </div>

        {/* Feature Pills Flex Grid */}
        <div className="mt-12 flex flex-wrap justify-center gap-3.5 max-w-5xl mx-auto">
          {FEATURE_PILLS.map((pill) => (
            <Link
              key={pill.label}
              href={pill.href}
              className="inline-flex items-center rounded-full border border-[var(--aura-border)] bg-white px-5 py-3 text-xs sm:text-sm font-bold text-[var(--aura-heading)] shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--aura-purple)] hover:bg-[var(--aura-lavender)] hover:text-[var(--aura-purple)] hover:shadow-md"
            >
              {pill.label}
            </Link>
          ))}
        </div>

      </Container>
    </section>
  );
}
