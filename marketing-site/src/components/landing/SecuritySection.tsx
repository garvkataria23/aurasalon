"use client";

import { ShieldCheck, Lock, Users, Database } from "lucide-react";
import { Container } from "@/components/ui/Container";

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
    <section className="py-20 md:py-28 bg-[var(--aura-off-white)]">
      <Container>
        {/* Section Heading */}
        <div className="reveal mx-auto max-w-3xl text-center mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
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
                className={`reveal stagger-${i + 1} rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-8 shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:shadow-[var(--aura-shadow-md)] hover:-translate-y-1`}
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
