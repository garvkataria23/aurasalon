"use client";

import { useState } from "react";
import { Check, X, ArrowRight, ChevronDown, Sparkles, Zap, ShieldCheck, Clock } from "lucide-react";
import * as Accordion from "@radix-ui/react-accordion";
import Link from "next/link";
import { PRICING_PLANS, PRICING_FAQ, CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { LandingDecor } from "@/components/landing/LandingDecor";
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

const PLAN_ICONS = [Zap, Sparkles, ShieldCheck];

const TRUST_CHIPS = [
  { icon: Clock, en: "14-day free trial", hi: "14-दिन का फ्री ट्रायल" },
  { icon: Check, en: "No credit card required", hi: "क्रेडिट कार्ड की ज़रूरत नहीं" },
  { icon: ShieldCheck, en: "Free setup & data migration", hi: "फ्री सेटअप और डेटा माइग्रेशन" },
  { icon: X, en: "Cancel anytime", hi: "कभी भी कैंसल करें" },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 mx-auto">
        <Check className="w-3.5 h-3.5 text-emerald-600" />
      </span>
    ) : (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-50 border border-[var(--aura-border)] mx-auto">
        <X className="w-3 h-3 text-[var(--aura-muted)]" />
      </span>
    );
  }
  return <span className="text-sm font-semibold text-[var(--aura-heading)]">{value}</span>;
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
      {/* ═══ HERO — Dark Premium ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#2D124D] via-[#431A72] to-[#FCFBF8] text-white pt-28 pb-20 md:pt-36 md:pb-28">
        <LandingDecor variant="hero" />

        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-24 -left-24 h-[440px] w-[440px] rounded-full bg-purple-500/20 blur-[100px] animate-pulse" />
          <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-indigo-500/15 blur-[90px]" />
          <div className="absolute left-1/3 bottom-0 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-[80px]" />
        </div>

        <Container className="relative z-10 text-center max-w-4xl mx-auto px-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-white/95 backdrop-blur-md mb-6 shadow-md transition-all hover:border-white/40 hover:bg-white/15">
            <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-bounce" />
            {t("pricing.badge")}
          </span>
          <h1 className="text-[clamp(2.5rem,6vw,4.25rem)] font-extrabold tracking-[-0.04em] leading-[1.08] text-balance drop-shadow-sm">
            {t("pricing.pageTitle")}
          </h1>
          <p className="mt-5 text-base md:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto text-pretty">
            {t("pricing.pageBody")}
          </p>

          {/* Trust Stats Strip */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { value: "14-day", label: language === "hi" ? "फ्री ट्रायल" : "Free Trial" },
              { value: "₹0", label: language === "hi" ? "सेटअप फीस" : "Setup Fee" },
              { value: "100%", label: language === "hi" ? "GST रेडी" : "GST Ready" },
              { value: "24×7", label: language === "hi" ? "सपोर्ट" : "Support" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="group rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-md text-center transition-all duration-300 hover:bg-white/[0.14] hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(111,79,216,0.28)]"
              >
                <div className="text-2xl md:text-3xl font-extrabold text-white transition-transform group-hover:scale-105">{stat.value}</div>
                <div className="text-[11px] font-semibold text-white/65 uppercase tracking-wider mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══ TOGGLE + CARDS ═══ */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)]">
        <Container>
          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className={`text-sm font-semibold transition-colors ${!annual ? "text-[var(--aura-heading)]" : "text-[var(--aura-muted)]"}`}>
              {t("pricing.monthly")}
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              role="switch"
              aria-checked={annual}
              className={`relative w-16 h-8 rounded-full transition-all duration-300 cursor-pointer shadow-inner ${
                annual
                  ? "bg-gradient-to-r from-[var(--aura-purple)] to-[#9B7FE6] shadow-[0_6px_18px_rgba(111,79,216,0.45)]"
                  : "bg-[var(--aura-border-strong)]"
              }`}
              aria-label={t("pricing.toggle")}
            >
              <div
                className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                  annual ? "translate-x-9" : "translate-x-1"
                }`}
              />
            </button>
            <span className={`text-sm font-semibold transition-colors ${annual ? "text-[var(--aura-heading)]" : "text-[var(--aura-muted)]"}`}>
              {t("pricing.annual")}
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full ml-1.5 shadow-xs">
                {t("pricing.save")}
              </span>
            </span>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-7 max-w-6xl mx-auto items-stretch mt-12">
            {PRICING_PLANS.map((tier, tierIndex) => {
              const PlanIcon = PLAN_ICONS[tierIndex % PLAN_ICONS.length];
              const isFeatured = tier.highlighted;

              const cardInner = (
                <div
                  className={`relative rounded-[calc(1.5rem-1.5px)] p-6 lg:p-8 flex flex-col justify-between h-full ${
                    isFeatured ? "bg-white" : "border border-[var(--aura-border)] bg-white"
                  }`}
                >
                  {/* Popular ribbon */}
                  {isFeatured && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[var(--aura-purple)] to-[#9B7FE6] text-white text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-purple-500/40 whitespace-nowrap">
                        <Sparkles className="w-3 h-3" />
                        {language === "hi" ? "सबसे लोकप्रिय" : "Most Popular"}
                      </span>
                    </div>
                  )}

                  <div>
                    {/* Icon + name */}
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className={`flex w-10 h-10 items-center justify-center rounded-xl shadow-xs transition-transform duration-300 group-hover:scale-110 group-hover:rotate-2 ${
                          isFeatured
                            ? "bg-gradient-to-br from-[var(--aura-purple)] to-[#9B7FE6] text-white"
                            : "bg-[var(--aura-lavender)] text-[var(--aura-purple)]"
                        }`}
                      >
                        <PlanIcon className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-bold text-[var(--aura-heading)]">{t(`pricing.tier.${tierIndex}.name`, tier.name)}</h3>
                    </div>

                    {/* Price block */}
                    <div className="mb-5 pb-5 border-b border-[var(--aura-border)]">
                      {tier.monthlyPrice > 0 ? (
                        <div>
                          <div className="flex items-end gap-2">
                            <span className="text-[2.6rem] leading-none font-extrabold text-[var(--aura-heading)] tabular-nums tracking-tight">
                              ₹{(annual ? tier.yearlyPrice : tier.monthlyPrice).toLocaleString("en-IN")}
                            </span>
                            <span className="text-sm text-[var(--aura-muted)] pb-1.5">{t("common.month")}</span>
                          </div>
                          {annual && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-sm text-[var(--aura-muted)] line-through">₹{tier.monthlyPrice.toLocaleString("en-IN")}</span>
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                {Math.round(((tier.monthlyPrice - tier.yearlyPrice) / tier.monthlyPrice) * 100)}% OFF
                              </span>
                            </div>
                          )}
                          {annual && (
                            <div className="text-xs text-[var(--aura-muted)] mt-1.5">
                              {t("pricing.billed").replace("{amount}", `₹${(tier.yearlyPrice * 12).toLocaleString("en-IN")}`)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[2.6rem] leading-none font-extrabold text-[var(--aura-heading)] tracking-tight">
                          {t("common.custom")}
                        </div>
                      )}
                      <p className="mt-3 text-sm text-[var(--aura-body)] leading-relaxed">
                        {t(`pricing.tier.${tierIndex}.desc`, tier.description)}
                      </p>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2.5">
                      {(language === "hi" ? PRICING_FEATURES_HI[tierIndex] : tier.features).map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm group-hover:translate-x-0.5 transition-transform duration-200">
                          <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" strokeWidth={3} />
                          </span>
                          <span className="text-[var(--aura-body)]">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <a href={CTA_LINKS.trial} className="block mt-8">
                    <Button variant={isFeatured ? "primary" : "outline"} className="w-full">
                      {tierIndex === 2 ? t("pricing.sales") : t("pricing.start")}
                      {isFeatured && <ArrowRight className="w-4 h-4 ml-1" />}
                    </Button>
                  </a>
                </div>
              );

              /* Featured card gets a gradient-border shell */
              return isFeatured ? (
                <div
                  key={tier.name}
                  className="group relative rounded-3xl p-[1.5px] bg-gradient-to-b from-[var(--aura-purple)] via-[#9B7FE6]/60 to-[var(--aura-purple)] shadow-[0_28px_80px_-16px_rgba(93,63,194,0.5)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_44px_100px_-16px_rgba(93,63,194,0.65)] md:scale-[1.04]"
                >
                  {cardInner}
                </div>
              ) : (
                <div
                  key={tier.name}
                  className="group relative rounded-3xl border border-transparent shadow-[0_4px_18px_-4px_rgba(45,18,77,0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--aura-purple)]/35 hover:shadow-[0_30px_70px_-18px_rgba(93,63,194,0.4),0_0_36px_-8px_rgba(111,79,216,0.25)]"
                >
                  {cardInner}
                </div>
              );
            })}
          </div>

          {/* Trust chips */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 mt-10">
            {TRUST_CHIPS.map((chip) => (
              <span key={chip.en} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--aura-body)]">
                <chip.icon className="w-3.5 h-3.5 text-[var(--aura-purple)]" />
                {language === "hi" ? chip.hi : chip.en}
              </span>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══ REPLACE YOUR TOOL STACK (Zenoti-style consolidation) ═══ */}
      <section className="py-16 md:py-20 bg-white border-y border-[var(--aura-border)]">
        <Container>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-[clamp(1.7rem,3.2vw,2.4rem)] font-extrabold text-[var(--aura-heading)] tracking-tight text-balance">
              {language === "hi"
                ? "एक Aura प्लान, पूरा टूल-स्टैक खत्म"
                : "One Aura plan replaces your entire tool stack"}
            </h2>
            <p className="mt-3 text-base text-[var(--aura-body)] leading-relaxed">
              {language === "hi"
                ? "ज़्यादातर सैलून 4–6 अलग सब्सक्रिप्शन्स हटाकर हर महीने हज़ारों बचाते हैं — और पूरे बिज़नेस की एक जुड़ी हुई तस्वीर पाते हैं।"
                : "Most salons eliminate 4–6 separate subscriptions, saving thousands every month while gaining one connected view of their entire business."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto text-left">
            {[
              {
                icon: X,
                title: language === "hi" ? "5+ टूल्स रिप्लेस" : "Replaces 5+ tools",
                body:
                  language === "hi"
                    ? "बिलिंग ऐप्स, रजिस्टर, स्प्रेडशीट और रिमाइंडर टूल्स — एक Aura प्लान में सब शामिल।"
                    : "Billing apps, registers, spreadsheets and reminder tools — one Aura plan covers them all.",
              },
              {
                icon: Zap,
                title: language === "hi" ? "पूरी टीम, एक लॉगिन" : "Whole team, one login",
                body:
                  language === "hi"
                    ? "फ्रंट डेस्क, मैनेजर और ओनर एक ही लाइव डेटा पर काम करते हैं — कोई syncing नहीं।"
                    : "Front desk, managers and owners work from the same live data — no syncing, no silos.",
              },
              {
                icon: ShieldCheck,
                title: language === "hi" ? "हर महीने बचत" : "Savings every month",
                body:
                  language === "hi"
                    ? "अलग-अलग टूल सब्सक्रिप्शन्स बंद कीजिए — एक transparent प्लान, कोई hidden fees नहीं।"
                    : "Cancel your scattered tool subscriptions — one transparent plan, zero hidden fees.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-5 transition-all duration-300 hover:border-[var(--aura-purple)]/30 hover:-translate-y-1 hover:shadow-[0_18px_44px_-14px_rgba(93,63,194,0.35)]"
              >
                <div className="flex w-9 h-9 items-center justify-center rounded-xl bg-[var(--aura-lavender)] text-[var(--aura-purple)] mb-3 shadow-xs">
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="font-bold text-sm text-[var(--aura-heading)] mb-1.5">{item.title}</div>
                <p className="text-xs text-[var(--aura-body)] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <PlanAdvisor />

      {/* ═══ COMPARISON TABLE ═══ */}
      <section className="py-20 md:py-28 bg-[var(--aura-off-white)] border-t border-[var(--aura-border)]">
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
          <div className="overflow-x-auto max-w-5xl mx-auto rounded-2xl border border-[var(--aura-border)] bg-white shadow-[0_20px_60px_-20px_rgba(45,18,77,0.18)]">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-[#2D124D] via-[#431A72] to-[#5B2D91]">
                  <th className="text-left py-4 px-6 text-xs font-bold uppercase tracking-wider text-white/85 w-1/3 rounded-tl-2xl">
                    {t("pricing.feature")}
                  </th>
                  <th className="text-center py-4 px-4 text-xs font-bold uppercase tracking-wider text-white/85">Starter</th>
                  <th className="text-center py-4 px-4 text-xs font-bold uppercase tracking-wider text-amber-300 bg-white/10">Growth</th>
                  <th className="text-center py-4 px-4 text-xs font-bold uppercase tracking-wider text-white/85 rounded-tr-2xl">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((feat, i) => (
                  <tr
                    key={feat.name}
                    className={`border-b border-[var(--aura-border)] last:border-b-0 transition-colors hover:bg-[var(--aura-lavender)]/30 ${i % 2 === 0 ? "bg-white" : "bg-[var(--aura-off-white)]/40"}`}
                  >
                    <td className="py-3.5 px-6 text-sm font-medium text-[var(--aura-heading)]">
                      {language === "hi" ? PRICING_COMPARISON_HI[i] : feat.name}
                    </td>
                    <td className="py-3.5 px-4 text-center"><FeatureValue value={localizeValue(feat.starter)} /></td>
                    <td className="py-3.5 px-4 text-center bg-[var(--aura-lavender)]/40"><FeatureValue value={localizeValue(feat.growth)} /></td>
                    <td className="py-3.5 px-4 text-center"><FeatureValue value={localizeValue(feat.enterprise)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      {/* ═══ FAQ ═══ */}
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
                <Accordion.Item
                  key={i}
                  value={`faq-${i}`}
                  className="rounded-2xl border border-[var(--aura-border)] bg-white overflow-hidden shadow-xs transition-all hover:border-[var(--aura-purple)]/40 hover:shadow-[0_14px_40px_-14px_rgba(93,63,194,0.3)] data-[state=open]:border-[var(--aura-purple)]/45"
                >
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

      {/* ═══ FINAL CTA ═══ */}
      <section className="relative py-20 md:py-28 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF] overflow-hidden">
        <LandingDecor variant="cta" />
        <Container className="relative z-10">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] mb-4 tracking-tight text-balance">
              {language === "hi" ? "शुरुआत के लिए तैयार हैं?" : "Ready to get started?"}
            </h2>
            <p className="text-[var(--aura-body)] mb-8 max-w-xl mx-auto text-base leading-relaxed">
              {language === "hi"
                ? "3,500+ सैलून Aura से ऑपरेशन ऑटोमेट कर रहे हैं। आज ही अपना फ्री ट्रायल शुरू करें या पर्सनलाइज़्ड डेमो बुक करें।"
                : "Join 3,500+ salons automating operations and growing revenue with Aura. Start your free trial or book a personalized demo today."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3.5">
              <Link
                href={CTA_LINKS.demo}
                className="btn-aura-glow inline-flex items-center gap-2 rounded-full bg-[var(--aura-purple)] px-8 py-3.5 text-sm font-bold text-white shadow-xl hover:bg-[var(--aura-purple-hover)]"
              >
                Book a Free Demo
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="btn-white-glow inline-flex items-center gap-2 rounded-full border border-[var(--aura-border-strong)] bg-white px-7 py-3.5 text-sm font-semibold text-[var(--aura-heading)] shadow-md hover:border-[var(--aura-purple)]/40"
              >
                Talk to Sales
              </Link>
            </div>
            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs font-medium text-[var(--aura-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {language === "hi" ? "क्रेडिट कार्ड ज़रूरी नहीं" : "No credit card required"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                {language === "hi" ? "कोई कमिटमेंट नहीं" : "No commitment"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                {language === "hi" ? "1 कार्यदिवस में जवाब" : "Response within 1 business day"}
              </span>
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
