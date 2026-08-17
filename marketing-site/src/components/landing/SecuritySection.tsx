"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Lock, Users, Database, FileText, Cloud, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

const SECURITY_CONTROLS = [
  {
    icon: Lock,
    title: "Secure Multi-Tenant Isolation",
    description: "Every salon's data is strictly partitioned with dedicated tenant and branch identifiers, ensuring complete database segregation.",
  },
  {
    icon: Users,
    title: "Granular Role-Based Permissions",
    description: "Control exactly who sees what. Stylists view only their shifts and commissions; front desk manages bookings; only owners see margins.",
  },
  {
    icon: Database,
    title: "Automated Continuous Backups",
    description: "Your appointment schedules, client histories, and billing records are backed up continuously to safeguard against hardware failure.",
  },
  {
    icon: FileText,
    title: "Tamper-Proof Activity Tracking",
    description: "Comprehensive audit logs record every applied discount, edited bill, price override, or refund with staff attribution and timestamps.",
  },
  {
    icon: Cloud,
    title: "Anywhere Cloud Accessibility",
    description: "Access your dashboard securely from any iPad, desktop, or mobile device with session-locked JWT authentication.",
  },
  {
    icon: ShieldCheck,
    title: "Complete Data Ownership",
    description: "Your client contact list, service revenue, and staff records remain 100% yours. Export your complete data anytime in standard formats.",
  },
];

export function SecuritySection() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      className="py-20 md:py-28 bg-white border-t border-[var(--aura-border)]"
    >
      <Container>
        {/* Section Heading */}
        <div
          className="mx-auto max-w-3xl text-center mb-16"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
          }}
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            Trust &amp; Privacy
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Your business data belongs to you.
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
            Built with strict data partition architecture, role enforcement, and audit logs so your client records and profit numbers stay confidential.
          </p>
        </div>

        {/* 6 Security Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SECURITY_CONTROLS.map((control, i) => {
            const Icon = control.icon;
            return (
              <div
                key={control.title}
                className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-7 shadow-[var(--aura-shadow-xs)] transition-all duration-300 hover:shadow-[var(--aura-shadow-md)] hover:border-[var(--aura-purple)]/30"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 0.5s ease-out ${0.08 + i * 0.05}s, transform 0.5s ease-out ${0.08 + i * 0.05}s`,
                }}
              >
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-white border border-[var(--aura-border)] text-[var(--aura-purple)] shadow-xs">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-[var(--aura-heading)]">{control.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--aura-body)]">
                  {control.description}
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
