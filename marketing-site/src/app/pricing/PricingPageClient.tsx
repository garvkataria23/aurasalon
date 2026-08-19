"use client";

import { useState } from "react";
import { Check, X, ArrowRight } from "lucide-react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { PRICING_PLANS, PRICING_FAQ, CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { GridBackground } from "@/components/ui/GridBackground";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PRICING_COMPARISON_HI, PRICING_FAQ_HI, PRICING_FEATURES_HI } from "@/lib/translations";
import { PlanAdvisor } from "@/components/pricing/PlanAdvisor";

const COMPARISON_FEATURES = [
  { name: "Branches", starter: "1", growth: "Up to 5", enterprise: "Unlimited" },
  { name: "Appointments", starter: true, growth: true, enterprise: true },
  { name: "POS & Billing (GST)", starter: true, growth: true, enterprise: true },
  { name: "Client CRM", starter: true, growth: true, enterprise: true },
  { name: "Online Booking Portal", starter: true, growth: true, enterprise: true },
  { name: "WhatsApp Notifications", starter: true, growth: true, enterprise: true },
  { name: "Basic Reports", starter: true, growth: true, enterprise: true },
  { name: "Staff OS (Attendance, Payroll)", starter: false, growth: true, enterprise: true },
  { name: "Inventory Management", starter: false, growth: true, enterprise: true },
  { name: "Marketing Campaign Workflows", starter: false, growth: true, enterprise: true },
  { name: "Finance Engine", starter: false, growth: true, enterprise: true },
  { name: "Customer 360 Intelligence", starter: false, growth: true, enterprise: true },
  { name: "Discount Rules (Happy Hours)", starter: false, growth: true, enterprise: true },
  { name: "API Access", starter: false, growth: true, enterprise: true },
  { name: "White Label Branding", starter: false, growth: false, enterprise: true },
  { name: "Custom Domain & Logo", starter: false, growth: false, enterprise: true },
  { name: "Compliance (PF/ESI/TDS)", starter: false, growth: false, enterprise: true },
  { name: "Franchise Management", starter: false, growth: false, enterprise: true },
  { name: "Dedicated Account Manager", starter: false, growth: false, enterprise: true },
  { name: "Custom Integrations", starter: false, growth: false, enterprise: true },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
    ) : (
      <X className="w-5 h-5 text-aura-text-muted/40 mx-auto" />
    );
  }
  return <span className="text-sm font-medium text-aura-text">{value}</span>;
}

export default function PricingPage() {
  const { language, t } = useLanguage();
  const localizeValue = (value: boolean | string) => {
    if (language !== "hi" || typeof value !== "string") return value;
    if (value === "Up to 5") return t("pricing.upTo5");
    if (value === "Unlimited") return t("pricing.unlimited");
    return value;
  };
  const [annual, setAnnual] = useState(false);

  return (
    <>
      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF] overflow-hidden">
        <GridBackground className="opacity-25" />
        <Container className="relative z-10 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center rounded-full border border-[var(--aura-purple)]/15 bg-white/65 px-3.5 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 backdrop-blur-sm shadow-xs">
            {t("pricing.badge")}
          </span>
          <h1 className="text-[clamp(2.25rem,5vw,3.75rem)] font-bold tracking-[-0.03em] text-[var(--aura-heading)] leading-[1.1] text-balance">
            {t("pricing.pageTitle")}
          </h1>
          <p className="mt-4 text-base md:text-lg text-[var(--aura-body)] leading-relaxed max-w-2xl mx-auto text-pretty">
            {t("pricing.pageBody")}
          </p>
        </Container>
      </section>

      {/* Pricing Toggle + Cards */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)]">
        <Container>
          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={`text-sm font-semibold ${!annual ? "text-[var(--aura-heading)]" : "text-[var(--aura-muted)]"}`}>{t("pricing.monthly")}</span>
             <button
               onClick={() => setAnnual(!annual)}
               role="switch"
               aria-checked={annual}
              className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${annual ? "bg-[var(--aura-purple)]" : "bg-[var(--aura-border-strong)]"}`}
               aria-label={t("pricing.toggle")}
            >
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${annual ? "translate-x-7" : "translate-x-0.5"}`} />
            </button>
            <span className={`text-sm font-semibold ${annual ? "text-[var(--aura-heading)]" : "text-[var(--aura-muted)]"}`}>
              {t("pricing.annual")} <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">{t("pricing.save")}</span>
            </span>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto items-stretch">
            {PRICING_PLANS.map((tier, tierIndex) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl border p-6 lg:p-8 transition-all duration-300 flex flex-col justify-between ${
                  tier.highlighted
                    ? "border-[var(--aura-purple)] bg-white shadow-[0_24px_80px_rgba(111,79,216,0.16)] ring-2 ring-[var(--aura-purple)]/20 md:scale-[1.03]"
                    : "border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-sm)] hover:shadow-[var(--aura-shadow-md)] hover:-translate-y-1"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[var(--aura-purple)] text-white text-xs font-bold shadow-md">
                     {language === "hi" ? "Growth प्लान" : "Growth plan"}
                  </div>
                )}
                <div>
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-[var(--aura-heading)]">{t(`pricing.tier.${tierIndex}.name`, tier.name)}</h3>
                    <div className="mt-3">
                      {tier.monthlyPrice > 0 ? (
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold text-[var(--aura-heading)] tabular-nums tracking-tight">
                            ₹{(annual ? tier.yearlyPrice : tier.monthlyPrice).toLocaleString("en-IN")}
                          </span>
                          <span className="text-sm text-[var(--aura-muted)]">{t("common.month")}</span>
                        </div>
                      ) : (
                        <div className="text-4xl font-bold text-[var(--aura-heading)]">{t("common.custom")}</div>
                      )}
                      {annual && tier.monthlyPrice > 0 && (
                        <div className="text-xs text-[var(--aura-muted)] mt-1">
                          {t("pricing.billed").replace("{amount}", `₹${(tier.yearlyPrice * 12).toLocaleString("en-IN")}`)}
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-sm text-[var(--aura-body)]">{t(`pricing.tier.${tierIndex}.desc`, tier.description)}</p>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {(language === "hi" ? PRICING_FEATURES_HI[tierIndex] : tier.features).map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-[var(--aura-body)]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a href={CTA_LINKS.trial} className="block mt-auto">
                  <Button variant={tier.highlighted ? "primary" : "outline"} className="w-full">
                    {tierIndex === 2 ? t("pricing.sales") : t("pricing.start")}
                    {tier.highlighted && <ArrowRight className="w-4 h-4 ml-1" />}
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <PlanAdvisor />

      {/* Comparison Table */}
      <section className="py-20 md:py-28 bg-[var(--aura-off-white)]">
        <Container>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center rounded-full border border-[var(--aura-purple)]/15 bg-white/65 px-3.5 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 backdrop-blur-sm shadow-xs">
              {t("pricing.compare")}
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold tracking-[-0.025em] text-[var(--aura-heading)] leading-[1.12] text-balance">
              {t("pricing.compareTitle")}
            </h2>
            <p className="mt-4 text-base md:text-lg text-[var(--aura-body)] leading-relaxed max-w-2xl mx-auto text-pretty">
              {t("pricing.compareBody")}
            </p>
          </div>
          <div className="overflow-x-auto max-w-5xl mx-auto rounded-2xl border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-sm)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--aura-border)] bg-[var(--aura-lavender)]/40">
                  <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] w-1/3">{t("pricing.feature")}</th>
                  <th className="text-center py-4 px-4 text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">Starter</th>
                  <th className="text-center py-4 px-4 text-xs font-bold uppercase tracking-wider text-[var(--aura-purple)] bg-[var(--aura-lavender)]">Growth</th>
                  <th className="text-center py-4 px-4 text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((feat, i) => (
                  <tr key={feat.name} className={`border-b border-[var(--aura-border)] last:border-b-0 ${i % 2 === 0 ? "bg-white" : "bg-[var(--aura-off-white)]/40"}`}>
                    <td className="py-3.5 px-6 text-sm font-medium text-[var(--aura-heading)]">{language === "hi" ? PRICING_COMPARISON_HI[i] : feat.name}</td>
                     <td className="py-3.5 px-4 text-center"><FeatureValue value={localizeValue(feat.starter)} /></td>
                     <td className="py-3.5 px-4 text-center bg-[var(--aura-lavender)]/30 font-semibold"><FeatureValue value={localizeValue(feat.growth)} /></td>
                     <td className="py-3.5 px-4 text-center"><FeatureValue value={localizeValue(feat.enterprise)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28 bg-white">
        <Container>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center rounded-full border border-[var(--aura-purple)]/15 bg-white/65 px-3.5 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 backdrop-blur-sm shadow-xs">
              {t("pricing.faq")}
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold tracking-[-0.025em] text-[var(--aura-heading)] leading-[1.12] text-balance">
              {t("pricing.faqTitle")}
            </h2>
            <p className="mt-4 text-base md:text-lg text-[var(--aura-body)] leading-relaxed max-w-2xl mx-auto text-pretty">
              {t("pricing.faqBody")}
            </p>
          </div>
          <div className="mt-12 max-w-3xl mx-auto">
            <Accordion.Root type="single" collapsible className="space-y-3">
              {(language === "hi" ? PRICING_FAQ_HI : PRICING_FAQ).map((item, i) => (
                <Accordion.Item key={i} value={`faq-${i}`} className="rounded-2xl border border-[var(--aura-border)] bg-white overflow-hidden shadow-xs transition-all hover:border-[var(--aura-purple)]/40 hover:shadow-sm">
                  <Accordion.Trigger className="flex items-center justify-between w-full px-6 py-4 text-left text-sm font-bold text-[var(--aura-heading)] hover:bg-[var(--aura-off-white)] transition-colors">
                    {item.question}
                    <ChevronDown className="w-4 h-4 text-[var(--aura-purple)] transition-transform duration-300 data-[state=open]:rotate-180 shrink-0 ml-4" />
                  </Accordion.Trigger>
                  <Accordion.Content className="px-6 pb-5 text-sm text-[var(--aura-body)] leading-relaxed border-t border-[var(--aura-border)] pt-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                    {item.answer}
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </div>
        </Container>
      </section>
    </>
  );
}
