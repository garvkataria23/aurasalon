"use client";

import Link from "next/link";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";
import { LandingDecor } from "./LandingDecor";

const PLANS = [
  {
    name: "Starter",
    price: "₹999/mo",
    subtitle: "Perfect for solo stylists",
    popular: false,
    features: [
      "1 Branch",
      "Unlimited Appointments",
      "Basic Reporting",
      "Standard Support",
    ],
  },
  {
    name: "Growth",
    price: "₹2,499/mo",
    subtitle: "For growing salons",
    popular: true,
    features: [
      "Up to 5 Branches",
      "Staff Targets & Commissions",
      "Live Inventory Management",
      "Memberships & Wallets",
      "Priority WhatsApp Support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    subtitle: "For salon chains",
    popular: false,
    features: [
      "Unlimited Branches",
      "Cross-Branch Loyalty",
      "Executive Analytics",
      "Custom Roles & Permissions",
      "Dedicated Account Manager",
    ],
  },
];

export function PricingPreview() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF]" id="pricing">
      <LandingDecor variant="warm" />
      <Container className="relative z-10">
        {/* Section Heading */}
        <div className="reveal mx-auto max-w-3xl text-center mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            PRICING
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
            No hidden fees. No commission on bookings. Plans that grow with you.
          </p>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="grid gap-8 lg:grid-cols-3 items-stretch max-w-6xl mx-auto">
          {PLANS.map((plan, i) => (
            <div
              key={plan.name}
              className={`reveal stagger-${i + 1} relative flex flex-col justify-between rounded-2xl border p-8 transition-all duration-300 ${
                plan.popular
                  ? "border-[var(--aura-purple)]/35 bg-white/40 shadow-[0_24px_80px_rgba(109,63,209,0.18)] backdrop-blur-xl ring-1 ring-white/35 lg:-translate-y-2"
                  : "border-white/50 bg-white/30 shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35 hover:bg-white/45 hover:shadow-[0_28px_90px_rgba(109,63,209,0.2)]"
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-[var(--aura-purple)] px-4 py-1 text-[11px] font-bold text-white shadow-sm">
                  <Sparkles className="h-3 w-3" />
                  Most Popular
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-[var(--aura-heading)]">{plan.name}</h3>
                <p className="text-xs text-[var(--aura-body)] mt-1">{plan.subtitle}</p>

                <div className="mt-6 mb-8 border-y border-[var(--aura-border)] py-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold text-[var(--aura-heading)] tabular-nums">
                      {plan.price}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 text-xs text-[var(--aura-body)]">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 text-[var(--aura-purple)] shrink-0 mt-0.5" />
                      <span className="leading-tight">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Footer & CTA */}
        <div className="reveal stagger-4 mt-12 text-center">
          <p className="text-sm font-medium text-[var(--aura-heading)] mb-6">
            All plans include free migration, training, and WhatsApp support
          </p>
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] px-8 text-sm font-semibold text-white shadow-[var(--aura-shadow-sm)] transition-all hover:bg-[var(--aura-purple-hover)] hover:-translate-y-0.5"
          >
            View Full Pricing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
