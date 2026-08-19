"use client";

import { ShieldCheck, Lock, Users, Database } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { LandingDecor } from "./LandingDecor";

const SECURITY_FEATURES = [
  {
    icon: Lock,
    title: "Data Encryption",
    description: "AES-256 encryption for all salon and client data",
  },
  {
    icon: Users,
    title: "Access Control",
    description: "Role-based permissions for owner, manager, and staff",
  },
  {
    icon: Database,
    title: "Daily Backups",
    description: "Automatic daily backups with instant recovery",
  },
  {
    icon: ShieldCheck,
    title: "GDPR Compliant",
    description: "Your data stays yours. Full compliance guaranteed.",
  },
];

export function SecuritySection() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF]">
      <LandingDecor variant="quiet" />
      <Container className="relative z-10">
        {/* Section Heading */}
        <div className="reveal mx-auto max-w-3xl text-center mb-16">
          <span className="inline-flex items-center rounded-full border border-[var(--aura-purple)]/15 bg-white/55 px-3 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 backdrop-blur-sm">
            TRUST & SECURITY
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Enterprise-grade security, built in
          </h2>
        </div>

        {/* 4 Security Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 max-w-4xl mx-auto">
          {SECURITY_FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`reveal stagger-${i + 1} rounded-[var(--aura-radius-xl)] border border-white/50 bg-white/30 p-8 shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35 transition-all duration-300 hover:bg-white/45 hover:shadow-[0_28px_90px_rgba(109,63,209,0.2)] hover:-translate-y-1`}
              >
                <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-[var(--aura-lavender)] text-[var(--aura-purple)]">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-[var(--aura-heading)]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--aura-muted)]">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
