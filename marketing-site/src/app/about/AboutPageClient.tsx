"use client";

import { Heart, Target, Users, Lightbulb, ArrowRight, Sparkles, Check } from "lucide-react";
import { CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { GridBackground } from "@/components/ui/GridBackground";
import { MagneticElement } from "@/components/ui/MagneticElement";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ABOUT_TIMELINE_HI, ABOUT_VALUES_HI } from "@/lib/translations";

const values = [
  { icon: Heart, title: "Salon-First", description: "Every feature is designed for real salon operations — from walk-in chaos during festival season to the end-of-day cash reconciliation. We don't build for generic businesses; we build for the salon floor." },
  { icon: Target, title: "Simplicity", description: "Powerful doesn't mean complicated. We obsess over making complex things simple — a billing desk shouldn't need a training manual. If a new hire can't figure it out in 10 minutes, we redesign." },
  { icon: Users, title: "Indian Market", description: "Built for India from day one — GST invoicing, UPI payments, WhatsApp workflows, Indian payroll compliance (PF/ESI/TDS), IST timezone, and regional language support. No 'India add-on' — it's the foundation." },
  { icon: Lightbulb, title: "AI-Powered", description: "Smart automation that learns from your salon data — slot suggestions based on staff availability, reorder guidance from usage patterns, and campaign timing from client behaviour. It gets better every day." },
];

const timeline = [
  { year: "01", title: "Connected core", description: "Appointments, client CRM, POS and stock share operational context. No more double entry or lost records between front desk and back office." },
  { year: "02", title: "Intelligent operations", description: "Staff OS, marketing workflows, inventory brain and finance engine add focused automation — handling the repetitive work so your team can focus on clients." },
  { year: "03", title: "Multi-location foundation", description: "Tenant isolation and branch-aware access support authorised operations across cities. One dashboard for owners managing multiple salons." },
  { year: "04", title: "Evidence-led rollout", description: "Real product media and customer proof will be published only with approval. We'd rather show you the actual system than make promises." },
];

export default function AboutPage() {
  const { language, t } = useLanguage();
  return (
    <>
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 bg-gradient-to-b from-[#faf9fc] to-white overflow-hidden">
        <GridBackground className="opacity-30" />
        <div className="absolute top-20 right-1/4 w-72 h-72 rounded-full bg-[#7c5cbf]/8 blur-[100px]" />
        <Container className="relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-aura-primary/10 text-aura-primary mb-6">
              <Sparkles className="w-3 h-3" />
               {t("about.story")}
            </span>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-aura-text leading-[1.1]">
               {t("about.titleA")} {" "}
              <span className="gradient-text">{t("about.titleB")}</span>
            </h1>
            <p className="mt-6 text-lg text-aura-text-secondary max-w-2xl mx-auto leading-relaxed">
               {t("about.body")}{" "}
               Aura was built because Indian salons deserve better than spreadsheets, fragmented apps, and end-of-month surprises. We obsess over the details that matter to salon owners — from the way a front desk handles a walk-in during peak hours, to the way a branch manager reviews daily collections at 9 PM.
            </p>
          </div>
        </Container>
      </section>

      <section className="py-20 md:py-28 bg-white">
        <Container>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
               <h2 className="text-2xl md:text-3xl font-bold text-aura-text mb-4">{t("about.mission")}</h2>
              <p className="text-lg text-aura-text-secondary leading-relaxed max-w-2xl mx-auto">
                 {t("about.missionBody")}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
               {values.map((value, valueIndex) => (
                <div
                  key={value.title}
                  className="rounded-2xl border border-aura-border bg-white p-8 transition-all duration-300 hover:shadow-lg hover:border-transparent"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-aura-primary/15 to-aura-primary-light/15 flex items-center justify-center mb-4">
                    <value.icon className="w-6 h-6 text-aura-primary" />
                  </div>
                   <h3 className="text-lg font-bold text-aura-text mb-2">{language === "hi" ? ABOUT_VALUES_HI[valueIndex].title : value.title}</h3>
                   <p className="text-sm text-aura-text-secondary leading-relaxed">{language === "hi" ? ABOUT_VALUES_HI[valueIndex].description : value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="py-20 md:py-28 bg-[#faf9fc]">
        <Container>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-2xl md:text-3xl font-bold text-aura-text mb-4">What makes Aura different</h2>
              <p className="text-lg text-aura-text-secondary leading-relaxed max-w-2xl mx-auto">
                We didn&apos;t start with a generic SaaS template and add salon features. We started on the salon floor — watching how front desk teams juggle walk-ins and bookings, how owners chase daily closing numbers on WhatsApp, and how staff commissions get argued over every month.
              </p>
            </div>

            <div className="space-y-8">
              {[
                {
                  title: "One system, not five stitched together",
                  body: "Most salons use separate tools for booking, billing, staff and WhatsApp. Data lives in silos, nothing talks to each other, and the owner spends Sunday reconciling spreadsheets. Aura connects all of it — when a client books, the inventory updates, the staff schedule adjusts, and the invoice is ready at checkout.",
                },
                {
                  title: "Built for how Indian salons actually work",
                  body: "GST billing with HSN/SAC codes, UPI + card + cash split payments, WhatsApp confirmations, Indian payroll with PF/ESI/TDS, and multi-branch operations across Indian cities. This isn't a Western product with an India skin — it was designed ground-up for the Indian salon market.",
                },
                {
                  title: "Owner-first, not customer-first",
                  body: "We focus on the salon owner's daily reality: cash drawer reconciliation, staff attendance disputes, inventory shrinkage, and client retention. The customer booking portal is important, but the real value is in the back-office clarity that helps owners make better decisions.",
                },
                {
                  title: "Evidence over promises",
                  body: "We don't publish fake metrics or unverified claims. Every customer story on this site is published only with explicit approval. We'd rather show you the actual product in a demo than make grand promises that don't match the experience.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-6 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-aura-primary to-aura-primary-light flex items-center justify-center text-white text-xs font-bold mt-1">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-aura-text mb-2">{item.title}</h3>
                    <p className="text-sm text-aura-text-secondary leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="py-20 bg-aura-surface-muted overflow-hidden">
        <Container>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            {[
              { value: "CRM · POS", label: t("about.foundation0") },
              { value: "GST · UPI", label: t("about.foundation1") },
              { value: "Tenant · Branch", label: t("about.foundation2") },
              { value: "IST · Realtime", label: t("about.foundation3") },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-lg md:text-xl font-bold text-aura-text">{stat.value}</div>
                <div className="text-sm text-aura-text-muted mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20 md:py-28 bg-[#faf9fc]">
        <Container>
           <SectionHeading badge={t("about.timeline")} title={t("about.journey")} subtitle={t("about.journeyBody")} />
          <div className="mt-16 max-w-3xl mx-auto relative">
            {/* Line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-aura-primary/40 via-aura-primary-light/30 to-transparent" />

            <div className="space-y-12">
               {timeline.map((item, i) => (
                <div
                   key={`${item.year}-${item.title}`}
                   className="flex gap-6"
                >
                  <div className="relative z-10 flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-aura-primary to-aura-primary-light flex items-center justify-center text-white text-xs font-bold shadow-lg">
                    {item.year}
                  </div>
                  <div className="pt-2">
                     <h3 className="text-lg font-bold text-aura-text mb-1">{language === "hi" ? ABOUT_TIMELINE_HI[i].title : item.title}</h3>
                     <p className="text-sm text-aura-text-secondary leading-relaxed">{language === "hi" ? ABOUT_TIMELINE_HI[i].description : item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="py-20 bg-white">
        <Container>
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-aura-text mb-4">
               {t("about.join")}
            </h2>
            <p className="text-aura-text-secondary mb-8 max-w-xl mx-auto">
               {t("about.joinBody")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <MagneticElement as="a" href={CTA_LINKS.trial}>
                <Button variant="primary" size="lg">
                   {t("nav.trial")}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </MagneticElement>
              <a href="/contact">
                 <Button variant="outline" size="lg">{t("about.contact")}</Button>
              </a>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
