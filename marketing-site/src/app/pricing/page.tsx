"use client";

import { motion, useInView } from "motion/react";
import { useRef, useState } from "react";
import { Check, X, ArrowRight } from "lucide-react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { PRICING_TIERS, PRICING_FAQ, CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { GridBackground } from "@/components/ui/GridBackground";
import { staggerContainer, staggerChild } from "@/lib/animations";

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
  { name: "AI Marketing Automation", starter: false, growth: true, enterprise: true },
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
  const [annual, setAnnual] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <>
      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 bg-gradient-to-b from-aura-bg to-white overflow-hidden">
        <GridBackground className="opacity-30" />
        <Container className="relative z-10">
          <SectionHeading
            badge="Pricing"
            title="Simple, Transparent Pricing"
            subtitle="Start free, scale as you grow. No hidden fees, no surprises."
          />
        </Container>
      </section>

      {/* Pricing Toggle + Cards */}
      <section ref={ref} className="pb-20 md:pb-28 bg-white">
        <Container>
          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={`text-sm font-medium ${!annual ? "text-aura-text" : "text-aura-text-muted"}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${annual ? "bg-neon-violet" : "bg-aura-border-strong"}`}
              aria-label="Toggle annual billing"
            >
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${annual ? "translate-x-7" : "translate-x-0.5"}`} />
            </button>
            <span className={`text-sm font-medium ${annual ? "text-aura-text" : "text-aura-text-muted"}`}>
              Annual <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full ml-1">Save 20%</span>
            </span>
          </div>

          {/* Cards */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto"
          >
            {PRICING_TIERS.map((tier) => (
              <motion.div
                key={tier.name}
                variants={staggerChild}
                className={`relative rounded-2xl border p-6 lg:p-8 transition-all duration-300 ${
                  tier.highlighted
                    ? "border-neon-violet/30 bg-white shadow-xl shadow-neon-violet/10 md:scale-[1.03]"
                    : "border-aura-border bg-white hover:shadow-lg hover:border-aura-border-strong"
                }`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-neon-violet to-aura-rose text-white text-xs font-bold">
                    Most Popular
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-aura-text">{tier.name}</h3>
                  <div className="mt-3">
                    {tier.monthlyPrice > 0 ? (
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold text-aura-text">
                          ₹{(annual ? tier.yearlyPrice : tier.monthlyPrice).toLocaleString("en-IN")}
                        </span>
                        <span className="text-sm text-aura-text-muted">/mo</span>
                      </div>
                    ) : (
                      <div className="text-4xl font-bold text-aura-text">Custom</div>
                    )}
                    {annual && tier.monthlyPrice > 0 && (
                      <div className="text-xs text-aura-text-muted mt-1">
                        Billed ₹{(tier.yearlyPrice * 12).toLocaleString("en-IN")}/year
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-aura-text-secondary">{tier.description}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="text-aura-text-secondary">{feature}</span>
                    </li>
                  ))}
                </ul>

                <a href={CTA_LINKS.trial} className="block">
                  <Button variant={tier.highlighted ? "primary" : "outline"} className="w-full">
                    {tier.cta}
                    {tier.highlighted && <ArrowRight className="w-4 h-4 ml-1" />}
                  </Button>
                </a>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* Comparison Table */}
      <section className="py-20 md:py-28 bg-aura-bg">
        <Container>
          <SectionHeading
            badge="Compare"
            title="Feature Comparison"
            subtitle="See exactly what's included in every plan."
          />
          <div className="mt-16 overflow-x-auto max-w-5xl mx-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-aura-border">
                  <th className="text-left py-4 px-4 text-sm font-semibold text-aura-text w-1/3">Feature</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-aura-text">Starter</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-neon-violet bg-neon-violet/5 rounded-t-xl">Growth</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-aura-text">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((feat, i) => (
                  <tr key={feat.name} className={`border-b border-aura-border/50 ${i % 2 === 0 ? "bg-white/50" : ""}`}>
                    <td className="py-3 px-4 text-sm text-aura-text-secondary">{feat.name}</td>
                    <td className="py-3 px-4 text-center"><FeatureValue value={feat.starter} /></td>
                    <td className="py-3 px-4 text-center bg-neon-violet/[0.02]"><FeatureValue value={feat.growth} /></td>
                    <td className="py-3 px-4 text-center"><FeatureValue value={feat.enterprise} /></td>
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
          <SectionHeading
            badge="FAQ"
            title="Frequently Asked Questions"
            subtitle="Everything you need to know about Aura pricing."
          />
          <div className="mt-12 max-w-2xl mx-auto">
            <Accordion.Root type="single" collapsible className="space-y-3">
              {PRICING_FAQ.map((item, i) => (
                <Accordion.Item key={i} value={`faq-${i}`} className="rounded-xl border border-aura-border overflow-hidden">
                  <Accordion.Trigger className="flex items-center justify-between w-full px-6 py-4 text-left text-sm font-semibold text-aura-text hover:bg-aura-bg-warm transition-colors">
                    {item.question}
                    <ChevronDown className="w-4 h-4 text-aura-text-muted transition-transform duration-300 data-[state=open]:rotate-180" />
                  </Accordion.Trigger>
                  <Accordion.Content className="px-6 pb-4 text-sm text-aura-text-secondary leading-relaxed data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
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
