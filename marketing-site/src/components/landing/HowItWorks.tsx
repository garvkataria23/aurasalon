"use client";

import { Container } from "@/components/ui/Container";
import { Calendar, Settings, Rocket } from "lucide-react";

const STEPS = [
  {
    num: "01",
    title: "Book a Demo",
    description: "Get a personalized walkthrough of Aura for your salon.",
    icon: Calendar,
  },
  {
    num: "02",
    title: "We Set You Up",
    description: "Free data migration, staff onboarding, and hardware setup.",
    icon: Settings,
  },
  {
    num: "03",
    title: "Start Growing",
    description: "Go live and watch your operations transform from day one.",
    icon: Rocket,
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28 bg-white relative border-t border-[var(--aura-border)]">
      {/* Subtle off-white tint in background */}
      <div className="absolute inset-0 bg-[var(--aura-off-white)]/50 pointer-events-none" />
      
      <Container className="relative z-10">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            SIMPLE SETUP
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            How Aura Works
          </h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-12 lg:gap-16 max-w-5xl mx-auto">
          {/* Connector dotted line for desktop */}
          <div className="hidden md:block absolute top-[28px] left-[15%] right-[15%] h-[2px] border-t-2 border-dotted border-[var(--aura-border)]" aria-hidden="true" />
          
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className={`reveal stagger-${i + 1} relative text-center group`}>
                <div className="relative mx-auto w-14 h-14 mb-6">
                  {/* Icon in Lavender Circle */}
                  <div className="absolute inset-0 bg-[var(--aura-lavender)] rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                    <Icon className="w-6 h-6 text-[var(--aura-purple)]" />
                  </div>
                  {/* Number Badge */}
                  <div className="absolute -top-2 -right-2 bg-[var(--aura-purple)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-[var(--aura-shadow-sm)]">
                    {step.num}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-[var(--aura-heading)] mb-2.5">{step.title}</h3>
                <p className="text-sm text-[var(--aura-body)] leading-relaxed max-w-[240px] mx-auto">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
