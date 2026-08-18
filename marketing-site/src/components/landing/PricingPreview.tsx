"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PRICING_TIERS, CTA_LINKS } from "@/lib/constants";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function PricingPreview() {
  const { t, formatNumber } = useLanguage();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  const plans = [
    {
      name: t("pricing.tier.0.name"),
      subtitle: t("home.pricing.starterSubtitle"),
      monthlyPrice: PRICING_TIERS[0].monthlyPrice,
      yearlyPrice: PRICING_TIERS[0].yearlyPrice,
      popular: false,
      features: [
        t("pricing.feature.1branch"),
        t("pricing.feature.unlimitedAppointments"),
        t("pricing.feature.gstBilling"),
        t("pricing.feature.client360"),
        t("pricing.feature.basicReports"),
        t("pricing.feature.onlineBooking"),
        t("pricing.feature.whatsappNotifications"),
        t("pricing.feature.standardSupport"),
      ],
      cta: t("navigation.demo"),
      href: CTA_LINKS.demo,
    },
    {
      name: t("pricing.tier.1.name"),
      subtitle: t("home.pricing.growthSubtitle"),
      monthlyPrice: PRICING_TIERS[1].monthlyPrice,
      yearlyPrice: PRICING_TIERS[1].yearlyPrice,
      popular: true,
      features: [
        t("pricing.feature.upTo5Branches"),
        t("pricing.feature.everythingStarter"),
        t("pricing.feature.staffTargets"),
        t("pricing.feature.liveInventory"),
        t("pricing.feature.membershipsWallets"),
        t("pricing.feature.retentionFlows"),
        t("pricing.feature.dynamicUpi"),
        t("pricing.feature.prioritySupport"),
      ],
      cta: t("navigation.demo"),
      href: CTA_LINKS.demo,
    },
    {
      name: t("home.pricing.multiLocation"),
      subtitle: t("home.pricing.multiSubtitle"),
      monthlyPrice: PRICING_TIERS[2].monthlyPrice,
      yearlyPrice: PRICING_TIERS[2].yearlyPrice,
      popular: false,
      features: [
        t("pricing.feature.unlimitedBranches"),
        t("pricing.feature.everythingGrowth"),
        t("pricing.feature.inventoryTransfers"),
        t("pricing.feature.crossBranchLoyalty"),
        t("pricing.feature.executiveAnalytics"),
        t("pricing.feature.customRoles"),
        t("pricing.feature.tallyExport"),
        t("pricing.feature.dedicatedSla"),
      ],
      cta: t("advisor.contact"),
      href: "/contact",
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-white border-t border-[var(--aura-border)]" id="pricing">
      <Container>
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            {t("home.pricing.badge")}
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            {t("home.pricing.title")}
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
            {t("home.pricing.body")}
          </p>

          {/* Monthly / Yearly Billing Switch */}
          <div className="mt-8 inline-flex items-center rounded-full border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-1">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-5 py-2 text-xs font-semibold transition-all ${
                billingCycle === "monthly"
                  ? "bg-white text-[var(--aura-heading)] shadow-xs"
                  : "text-[var(--aura-muted)] hover:text-[var(--aura-heading)]"
              }`}
            >
              {t("home.pricing.monthly")}
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold transition-all ${
                billingCycle === "yearly"
                  ? "bg-[var(--aura-purple)] text-white shadow-xs"
                  : "text-[var(--aura-muted)] hover:text-[var(--aura-heading)]"
              }`}
            >
              <span>{t("home.pricing.yearly")}</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                {t("pricing.save")}
              </span>
            </button>
          </div>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="grid gap-8 lg:grid-cols-3 items-stretch">
          {plans.map((plan) => {
            const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.name}
                className={`relative flex flex-col justify-between rounded-[var(--aura-radius-xl)] border p-8 transition-all duration-300 ${
                  plan.popular
                    ? "border-[var(--aura-purple)] bg-[var(--aura-off-white)] shadow-[var(--aura-shadow-lg)] lg:-translate-y-2"
                    : "border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-xs)] hover:shadow-[var(--aura-shadow-md)]"
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
                  {/* Plan Name & Subtitle */}
                  <h3 className="text-xl font-bold text-[var(--aura-heading)]">{plan.name}</h3>
                  <p className="text-xs text-[var(--aura-body)] mt-1 min-h-[32px]">{plan.subtitle}</p>

                  {/* Price */}
                  <div className="mt-6 mb-8 border-y border-[var(--aura-border)] py-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-bold text-[var(--aura-heading)] tabular-nums">
                        ₹{formatNumber(price)}
                      </span>
                      <span className="text-xs text-[var(--aura-muted)]">{t("common.month")}</span>
                    </div>
                    {billingCycle === "yearly" && (
                      <p className="mt-1 text-[11px] text-emerald-700 font-medium">{t("home.pricing.billedAnnually")}</p>
                    )}
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-3 text-xs text-[var(--aura-body)]">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-[var(--aura-purple)] shrink-0 mt-0.5" />
                        <span className="leading-tight">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action CTA */}
                <div className="mt-10 pt-4">
                  <Link
                    href={plan.href}
                    className={`flex h-11 w-full items-center justify-center gap-2 rounded-[var(--aura-radius-btn)] text-sm font-semibold transition-all ${
                      plan.popular
                        ? "bg-[var(--aura-purple)] text-white shadow-[var(--aura-shadow-sm)] hover:bg-[var(--aura-purple-hover)]"
                        : "border border-[var(--aura-border)] bg-white text-[var(--aura-heading)] hover:border-[var(--aura-purple)] hover:text-[var(--aura-purple)] hover:bg-[var(--aura-purple-soft)]"
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
