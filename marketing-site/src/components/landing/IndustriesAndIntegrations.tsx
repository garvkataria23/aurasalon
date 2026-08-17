"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import {
  Scissors,
  Users,
  Sparkles,
  HandHeart,
  Stethoscope,
  Activity,
  Zap,
  Building2,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  CreditCard,
  QrCode,
  Globe,
  FileSpreadsheet,
  Cpu,
  RefreshCw,
} from "lucide-react";

/* ── Scroll Reveal Hook ── */
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

/* ===================================================================
   SECTION 1: INDUSTRIES (8 CARDS)
   =================================================================== */
const INDUSTRIES = [
  {
    icon: Scissors,
    title: "Hair Salons",
    description: "Chair scheduling, chemical service timing, stylist turns, and product consumption tracking.",
    feature: "Formula & recipe notes per client",
  },
  {
    icon: Users,
    title: "Unisex Salons",
    description: "Dual service menus, flexible gender-based stylist assignments, and combined family billing.",
    feature: "Multi-stylist single-invoice billing",
  },
  {
    icon: Sparkles,
    title: "Luxury Spas",
    description: "Treatment room availability, therapist turn management, and multi-session package tracking.",
    feature: "Room allocation & package redemptions",
  },
  {
    icon: HandHeart,
    title: "Nail Studios",
    description: "Fast station turnaround, nail art add-on pricing, and quick technician commission splits.",
    feature: "Add-on service express checkout",
  },
  {
    icon: Stethoscope,
    title: "Beauty Clinics",
    description: "Detailed client consultation histories, treatment plan series, and automated follow-ups.",
    feature: "Visit history & consultation notes",
  },
  {
    icon: Activity,
    title: "Medspas",
    description: "Practitioner scheduling, recurring session reminders, and strict client data confidentiality.",
    feature: "Practitioner logs & scheduled visits",
  },
  {
    icon: Zap,
    title: "Barbershops",
    description: "High-speed walk-in queue management, quick beard + haircut combos, and rapid UPI QR billing.",
    feature: "Walk-in queue & 15-second checkout",
  },
  {
    icon: Building2,
    title: "Multi-location Chains",
    description: "Centralized owner dashboard, cross-branch loyalty points, and unified inventory transfers.",
    feature: "Enterprise multi-branch analytics",
  },
];

/* ===================================================================
   SECTION 2: VERIFIED INTEGRATIONS
   =================================================================== */
const INTEGRATIONS = [
  {
    name: "WhatsApp Cloud API",
    category: "Messaging & Reminders",
    description: "Instant booking confirmations, digital GST invoices, and automated reminder notifications directly on WhatsApp.",
    status: "Active",
    icon: MessageSquare,
    badge: "Official API",
  },
  {
    name: "Dynamic UPI & Razorpay",
    category: "Payments & POS",
    description: "Auto-generated dynamic UPI QR on customer-facing screens, card gateway integration, and split payment settlement.",
    status: "Active",
    icon: QrCode,
    badge: "0% UPI MDR",
  },
  {
    name: "Transactional SMS Gateway",
    category: "Alerts & OTP",
    description: "High-priority DLT-compliant SMS notifications for customer authentication, OTP billing verification, and reminders.",
    status: "Active",
    icon: Zap,
    badge: "DLT Ready",
  },
  {
    name: "Google Business & Calendar",
    category: "Reputation & Booking",
    description: "Automated post-checkout 5-star review collection prompts and calendar scheduling synchronization.",
    status: "Active",
    icon: Globe,
    badge: "Review Boost",
  },
  {
    name: "Tally & GST Portal Exports",
    category: "Accounting & Compliance",
    description: "One-click CSV/JSON exports with HSN codes, SGST/CGST splits, and ledger mapping ready for your CA.",
    status: "Active",
    icon: FileSpreadsheet,
    badge: "CA Approved",
  },
  {
    name: "Biometric Staff Punch Clocks",
    category: "Hardware Attendance",
    description: "Direct thumbprint and facial recognition hardware integration for tamper-proof staff clock-in/out.",
    status: "Coming Soon",
    icon: Cpu,
    badge: "In Dev",
  },
];

export function IndustriesAndIntegrations() {
  const indReveal = useReveal();
  const intReveal = useReveal();

  return (
    <>
      {/* ── SECTION 1: INDUSTRIES ── */}
      <section
        ref={indReveal.ref}
        className="py-20 md:py-28 bg-[var(--aura-off-white)] border-t border-[var(--aura-border)]"
      >
        <Container>
          <div
            className="mx-auto max-w-3xl text-center mb-16"
            style={{
              opacity: indReveal.visible ? 1 : 0,
              transform: indReveal.visible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
            }}
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              Specialized Solutions
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              Built for every kind of beauty business
            </h2>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
              Whether you run a single boutique hair salon or an enterprise chain of wellness spas, Aura adapts to your specific floor workflows.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRIES.map((ind, i) => {
              const Icon = ind.icon;
              return (
                <div
                  key={ind.title}
                  className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-6 shadow-[var(--aura-shadow-xs)] transition-all duration-300 hover:shadow-[var(--aura-shadow-md)] hover:-translate-y-1 flex flex-col"
                  style={{
                    opacity: indReveal.visible ? 1 : 0,
                    transform: indReveal.visible ? "translateY(0)" : "translateY(20px)",
                    transition: `opacity 0.5s ease-out ${0.08 + i * 0.04}s, transform 0.5s ease-out ${0.08 + i * 0.04}s`,
                  }}
                >
                  <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[var(--aura-lavender)] text-[var(--aura-purple)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-bold text-[var(--aura-heading)]">{ind.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--aura-body)] flex-1">
                    {ind.description}
                  </p>
                  <div className="mt-4 pt-3 border-t border-[var(--aura-border)] flex items-center gap-1.5 text-[11px] font-medium text-[var(--aura-purple)]">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{ind.feature}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ── SECTION 2: VERIFIED INTEGRATIONS ── */}
      <section
        ref={intReveal.ref}
        className="py-20 md:py-28 bg-white border-t border-[var(--aura-border)]"
      >
        <Container>
          <div
            className="mx-auto max-w-3xl text-center mb-16"
            style={{
              opacity: intReveal.visible ? 1 : 0,
              transform: intReveal.visible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
            }}
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              Seamless Ecosystem
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              Works with the tools your business already uses.
            </h2>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
              Connect your payment gateways, messaging channels, and accounting software without brittle third-party plugins.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATIONS.map((integ, i) => {
              const Icon = integ.icon;
              const isActive = integ.status === "Active";

              return (
                <div
                  key={integ.name}
                  className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-6 shadow-[var(--aura-shadow-xs)] transition-all duration-300 hover:shadow-[var(--aura-shadow-md)] hover:border-[var(--aura-purple)]/40 flex flex-col"
                  style={{
                    opacity: intReveal.visible ? 1 : 0,
                    transform: intReveal.visible ? "translateY(0)" : "translateY(20px)",
                    transition: `opacity 0.5s ease-out ${0.08 + i * 0.05}s, transform 0.5s ease-out ${0.08 + i * 0.05}s`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white border border-[var(--aura-border)] text-[var(--aura-purple)] shadow-xs">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {integ.badge}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        {integ.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-[var(--aura-heading)]">{integ.name}</h3>
                  <p className="text-[11px] font-medium text-[var(--aura-purple)] mb-2">{integ.category}</p>
                  <p className="text-xs leading-relaxed text-[var(--aura-body)] flex-1">
                    {integ.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[var(--aura-border)] flex items-center justify-between text-[11px]">
                    <span className="text-[var(--aura-muted)]">Status:</span>
                    <span className={isActive ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                      {integ.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>
    </>
  );
}
