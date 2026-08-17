"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import {
  Boxes,
  AlertTriangle,
  ShoppingCart,
  FileCheck,
  TrendingDown,
  Truck,
  History,
  Crown,
  Sparkles,
  Wallet,
  Coins,
  Gift,
  CreditCard,
  Clock,
  Send,
  MessageSquare,
  Cake,
  UserCheck,
  Star,
  Tag,
  Users,
  BarChart2,
  ArrowRight,
  CheckCircle2,
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
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

/* ── Feature Pill ── */
function FeaturePill({
  icon: Icon,
  label,
  comingSoon = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  comingSoon?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl border border-[var(--aura-border)] bg-white px-3.5 py-2.5 shadow-[var(--aura-shadow-xs)]">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--aura-lavender)]">
          <Icon className="h-3.5 w-3.5 text-[var(--aura-purple)]" aria-hidden="true" />
        </span>
        <span className="truncate text-xs font-medium text-[var(--aura-heading)]">{label}</span>
      </div>
      {comingSoon && (
        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 uppercase tracking-wider shrink-0">
          Coming Soon
        </span>
      )}
    </li>
  );
}

/* ── Inventory UI Showcase ── */
function InventoryMockup() {
  const stockItems = [
    {
      name: "L'Oréal Serie Expert Shampoo 500ml",
      sku: "LOR-SH-500",
      category: "Retail",
      inStock: 18,
      minStock: 5,
      status: "In Stock",
      cost: "₹1,450",
    },
    {
      name: "Olaplex No. 1 Bond Multiplier 525ml",
      sku: "OLA-B1-525",
      category: "In-Salon",
      inStock: 2,
      minStock: 4,
      status: "Low Stock",
      cost: "₹6,200",
    },
    {
      name: "Wella Koleston Perfect 60g #5/0",
      sku: "WEL-KP-50",
      category: "In-Salon",
      inStock: 24,
      minStock: 10,
      status: "In Stock",
      cost: "₹580",
    },
    {
      name: "Moroccanoil Treatment Original 100ml",
      sku: "MOR-TR-100",
      category: "Retail",
      inStock: 0,
      minStock: 6,
      status: "Out of Stock",
      cost: "₹3,150",
    },
  ];

  return (
    <div className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-lg)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--aura-border)] bg-[var(--aura-off-white)] px-5 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-[var(--aura-purple)]" />
            <span className="text-xs font-semibold text-[var(--aura-heading)]">Real-Time Stock Ledger</span>
          </div>
          <span className="text-[10px] text-[var(--aura-muted)]">Automatic consumption deducted upon checkout</span>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--aura-purple)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"
        >
          <ShoppingCart className="h-3 w-3" />
          Create PO
        </button>
      </div>

      {/* Stock Table */}
      <div className="overflow-x-auto p-4">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--aura-border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--aura-muted)]">
              <th className="pb-2">Product &amp; SKU</th>
              <th className="pb-2">Type</th>
              <th className="pb-2 text-center">Stock</th>
              <th className="pb-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--aura-border)]">
            {stockItems.map((item) => (
              <tr key={item.sku} className="group hover:bg-[var(--aura-off-white)] transition-colors">
                <td className="py-2.5 pr-2">
                  <p className="font-semibold text-[var(--aura-heading)] leading-tight">{item.name}</p>
                  <p className="text-[10px] text-[var(--aura-muted)]">{item.sku}</p>
                </td>
                <td className="py-2.5">
                  <span className="rounded-md bg-[var(--aura-lavender)] px-2 py-0.5 text-[10px] font-medium text-[var(--aura-purple)]">
                    {item.category}
                  </span>
                </td>
                <td className="py-2.5 text-center">
                  <span className="font-bold text-[var(--aura-heading)] tabular-nums">{item.inStock}</span>
                  <span className="text-[10px] text-[var(--aura-muted)]"> / {item.minStock} min</span>
                </td>
                <td className="py-2.5 text-right">
                  {item.status === "In Stock" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      In Stock
                    </span>
                  )}
                  {item.status === "Low Stock" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Low Stock
                    </span>
                  )}
                  {item.status === "Out of Stock" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      <TrendingDown className="h-2.5 w-2.5" />
                      Reorder
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Alert */}
      <div className="flex items-center justify-between border-t border-[var(--aura-border)] bg-[var(--aura-off-white)] px-4 py-2.5 text-[11px] text-[var(--aura-body)]">
        <span className="flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-[var(--aura-purple)]" />
          PO #1084 en route from Wella Professional
        </span>
        <span className="font-semibold text-emerald-600">Expected Tomorrow</span>
      </div>
    </div>
  );
}

/* ── Memberships & Loyalty Dashboard ── */
function MembershipDashboard() {
  return (
    <div className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-xl)] overflow-hidden">
      {/* Top Banner */}
      <div className="border-b border-[var(--aura-border)] bg-gradient-to-r from-[#18181B] via-[#2A1E4A] to-[var(--aura-purple)] p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              <Crown className="h-3.5 w-3.5 text-amber-300" />
              Aura Loyalty &amp; Membership Hub
            </span>
            <h3 className="mt-2 text-xl font-bold tracking-tight">Privilege Club &amp; Prepaid Wallet</h3>
            <p className="text-xs text-white/70">Boost retention, lock in repeat visits, and increase upfront cash flow.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-3 text-center backdrop-blur-sm border border-white/10">
              <p className="text-lg font-bold tabular-nums">482</p>
              <p className="text-[10px] text-white/70 uppercase tracking-wider">Active Members</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 text-center backdrop-blur-sm border border-white/10">
              <p className="text-lg font-bold text-amber-300 tabular-nums">₹14.2L</p>
              <p className="text-[10px] text-white/70 uppercase tracking-wider">Wallet Reserves</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of 3 Core Loyalty Modules */}
      <div className="grid gap-4 p-5 sm:grid-cols-3">
        {/* Card 1: VIP Tier */}
        <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--aura-lavender)] text-amber-600">
                <Crown className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--aura-heading)]">Gold Privilege</p>
                <p className="text-[10px] text-[var(--aura-muted)]">Annual Plan</p>
              </div>
            </div>
            <span className="text-xs font-bold text-[var(--aura-purple)]">₹9,999/yr</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-[var(--aura-body)]">
            <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> 15% flat off all salon services</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> Free monthly scalp spa (worth ₹1,500)</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> Priority booking window</li>
          </ul>
        </div>

        {/* Card 2: Prepaid Wallet */}
        <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--aura-lavender)] text-[var(--aura-purple)]">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--aura-heading)]">Prepaid Wallet</p>
                <p className="text-[10px] text-[var(--aura-muted)]">Recharge Bonus</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600">+15% Bonus</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-[var(--aura-body)]">
            <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> Pay ₹10,000 &rarr; Get ₹11,500 credit</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> Shareable across family members</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> One-tap OTP redemption at POS</li>
          </ul>
        </div>

        {/* Card 3: Service Package */}
        <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--aura-lavender)] text-indigo-600">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--aura-heading)]">Bridal Glow Series</p>
                <p className="text-[10px] text-[var(--aura-muted)]">6 Sessions</p>
              </div>
            </div>
            <span className="text-xs font-bold text-[var(--aura-heading)]">₹18,500</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-[var(--aura-body)]">
            <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> 4 Hydra-Facials + 2 Hair Spas</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> Session counter tracked automatically</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" /> Automatic WhatsApp expiry alerts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ── Marketing Automation Flow Showcase ── */
function MarketingAutomationMockup() {
  const campaigns = [
    {
      title: "Inactive Client Win-Back",
      trigger: "No visit in 45 days",
      audience: "142 clients",
      channel: "WhatsApp",
      status: "Active",
      roi: "34 bookings (₹58,400 rev)",
      badge: "High ROI",
    },
    {
      title: "Birthday Celebration Treat",
      trigger: "Birthday in next 7 days",
      audience: "18 clients this week",
      channel: "WhatsApp + SMS",
      status: "Automated",
      roi: "72% claim rate",
      badge: "Automated",
    },
    {
      title: "Post-Service Review Collector",
      trigger: "2 hours after bill generation",
      audience: "All completed visits",
      channel: "WhatsApp",
      status: "Active",
      roi: "4.9 ★ (180+ Google Reviews)",
      badge: "Reputation",
    },
  ];

  return (
    <div className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-lg)] overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-[var(--aura-border)] bg-[var(--aura-off-white)] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-[var(--aura-purple)]" />
          <span className="text-xs font-semibold text-[var(--aura-heading)]">Automated WhatsApp Flows</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          AI Scheduler Running
        </span>
      </div>

      {/* Campaigns list */}
      <div className="p-4 space-y-3">
        {campaigns.map((camp) => (
          <div
            key={camp.title}
            className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-3.5 transition-all hover:border-[var(--aura-purple)]/40 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-[var(--aura-heading)]">{camp.title}</p>
                  <span className="rounded-md bg-[var(--aura-lavender)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--aura-purple)]">
                    {camp.badge}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--aura-body)] mt-0.5">
                  Trigger: <span className="font-medium text-[var(--aura-heading)]">{camp.trigger}</span> &bull; Target: {camp.audience}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100/70 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                {camp.channel}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--aura-border)] text-[11px]">
              <span className="text-[var(--aura-muted)]">Performance:</span>
              <span className="font-semibold text-emerald-700">{camp.roi}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdvancedFeatures() {
  const inv = useReveal();
  const mem = useReveal();
  const mkt = useReveal();

  return (
    <>
      {/* ── SECTION 1: INVENTORY ── */}
      <section ref={inv.ref} className="py-20 md:py-28 bg-white border-t border-[var(--aura-border)]">
        <Container>
          <div className="grid items-center gap-12 lg:gap-20 lg:grid-cols-2">
            {/* Text column */}
            <div
              style={{
                opacity: inv.visible ? 1 : 0,
                transform: inv.visible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
              }}
            >
              <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
                Inventory &amp; Consumption
              </span>
              <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[var(--aura-heading)]">
                Never discover you're out of stock during a service.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[var(--aura-body)] max-w-lg">
                Eliminate pilferage, track real consumption for every hair wash, color tube or facial kit, and reorder automatically before you run out.
              </p>

              <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
                <FeaturePill icon={Boxes} label="Live stock tracking" />
                <FeaturePill icon={TrendingDown} label="Service consumption" />
                <FeaturePill icon={ShoppingCart} label="Purchase orders (PO)" />
                <FeaturePill icon={AlertTriangle} label="Low-stock alerts" />
                <FeaturePill icon={Tag} label="Retail product sales" />
                <FeaturePill icon={Truck} label="Supplier records" />
                <FeaturePill icon={History} label="Stock audit history" />
              </ul>
            </div>

            {/* Mockup column */}
            <div
              style={{
                opacity: inv.visible ? 1 : 0,
                transform: inv.visible ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 0.6s ease-out 0.12s, transform 0.6s ease-out 0.12s",
              }}
            >
              <InventoryMockup />
            </div>
          </div>
        </Container>
      </section>

      {/* ── SECTION 2: MEMBERSHIPS & LOYALTY (HIGH IMPACT SHOWCASE) ── */}
      <section
        ref={mem.ref}
        className="py-20 md:py-28 bg-[var(--aura-off-white)] border-t border-[var(--aura-border)]"
      >
        <Container>
          <div
            className="mx-auto max-w-3xl text-center mb-14"
            style={{
              opacity: mem.visible ? 1 : 0,
              transform: mem.visible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
            }}
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              Memberships &amp; Loyalty
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              Turn occasional visits into lasting relationships.
            </h2>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
              Lock in predictable recurring revenue with high-yield salon memberships, prepaid packages, wallet bonuses, and loyalty rewards that keep chairs booked year-round.
            </p>
          </div>

          {/* Full-width interactive dashboard presentation */}
          <div
            style={{
              opacity: mem.visible ? 1 : 0,
              transform: mem.visible ? "translateY(0)" : "translateY(24px)",
              transition: "opacity 0.6s ease-out 0.15s, transform 0.6s ease-out 0.15s",
            }}
          >
            <MembershipDashboard />
          </div>

          {/* Feature highlights grid */}
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FeaturePill icon={Crown} label="Tiered memberships" />
            <FeaturePill icon={Sparkles} label="Custom prepaid packages" />
            <FeaturePill icon={Wallet} label="Wallet recharge bonus" />
            <FeaturePill icon={Coins} label="Points-per-rupee reward" />
            <FeaturePill icon={Gift} label="Digital gift cards" />
            <FeaturePill icon={CreditCard} label="Prepaid service balance" />
            <FeaturePill icon={CheckCircle2} label="Flexible OTP redemption" />
            <FeaturePill icon={Clock} label="WhatsApp expiry alerts" />
          </div>
        </Container>
      </section>

      {/* ── SECTION 3: MARKETING AUTOMATION (SOFT LAVENDER BACKGROUND) ── */}
      <section
        ref={mkt.ref}
        className="py-20 md:py-28 bg-[var(--aura-lavender)] border-t border-[var(--aura-border)]"
      >
        <Container>
          <div className="grid items-center gap-12 lg:gap-20 lg:grid-cols-2">
            {/* Text column */}
            <div
              style={{
                opacity: mkt.visible ? 1 : 0,
                transform: mkt.visible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
              }}
            >
              <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
                Marketing &amp; Retention
              </span>
              <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[var(--aura-heading)]">
                Bring clients back automatically.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[var(--aura-body)] max-w-lg">
                Set up automated triggers that send personalised WhatsApp &amp; SMS messages based on customer visit history, birthdays, and inactivity windows.
              </p>

              <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
                <FeaturePill icon={MessageSquare} label="WhatsApp campaigns" />
                <FeaturePill icon={Cake} label="Birthday greeting offers" />
                <FeaturePill icon={UserCheck} label="Inactive client win-back" />
                <FeaturePill icon={Clock} label="Appointment reminders" />
                <FeaturePill icon={Star} label="Google review requests" />
                <FeaturePill icon={Tag} label="Targeted discount coupons" />
                <FeaturePill icon={Users} label="Smart customer segments" />
                <FeaturePill icon={BarChart2} label="Campaign ROI analytics" />
              </ul>
            </div>

            {/* Automation flow mockup */}
            <div
              style={{
                opacity: mkt.visible ? 1 : 0,
                transform: mkt.visible ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 0.6s ease-out 0.12s, transform 0.6s ease-out 0.12s",
              }}
            >
              <MarketingAutomationMockup />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
