"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import {
  Calendar, Clock, Users, UserPlus, ListChecks, Globe, Bell, RefreshCw,
  Receipt, CreditCard, Percent, Gift, Wallet, ArrowLeftRight, BadgeDollarSign, History,
  User, Heart, Star, StickyNote, Cake, Award, TrendingUp, ShoppingBag,
  Fingerprint, CalendarDays, Target, Coins, FileText, BarChart3, Repeat, Shield,
} from "lucide-react";

/* ── Scroll Reveal Hook ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

/* ── Feature Pill ── */
function FeaturePill({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-[var(--aura-body)]">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--aura-lavender)]">
        <Icon className="h-3.5 w-3.5 text-[var(--aura-purple)]" aria-hidden="true" />
      </span>
      {label}
    </li>
  );
}

/* ── Inline UI Mockups ── */

function CalendarMockup() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const slots = [
    { time: "10:00", client: "Priya S.", service: "Haircut & Blowdry", stylist: "Ananya", color: "bg-[var(--aura-purple)]/10 border-[var(--aura-purple)]/20 text-[var(--aura-purple)]" },
    { time: "11:30", client: "Rahul M.", service: "Beard Trim", stylist: "Vikram", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { time: "14:00", client: "Meera K.", service: "Keratin Treatment", stylist: "Ananya", color: "bg-amber-50 border-amber-200 text-amber-700" },
  ];
  return (
    <div className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-md)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--aura-border)] bg-[var(--aura-off-white)] px-5 py-3">
        <span className="text-xs font-semibold text-[var(--aura-heading)]">Today&apos;s Schedule</span>
        <span className="text-xs text-[var(--aura-muted)]">Aug 17, 2026</span>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-6 border-b border-[var(--aura-border)] bg-[var(--aura-off-white)]">
        {days.map((d, i) => (
          <div key={d} className={`px-2 py-2 text-center text-[10px] font-semibold ${i === 0 ? "text-[var(--aura-purple)] bg-[var(--aura-lavender)]" : "text-[var(--aura-muted)]"}`}>
            {d}
          </div>
        ))}
      </div>
      {/* Appointments */}
      <div className="space-y-2 p-4">
        {slots.map((s) => (
          <div key={s.time} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${s.color}`}>
            <span className="text-xs font-bold tabular-nums">{s.time}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{s.client}</p>
              <p className="truncate text-[10px] opacity-70">{s.service} · {s.stylist}</p>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--aura-border)] px-3 py-2.5">
          <UserPlus className="h-3.5 w-3.5 text-[var(--aura-muted)]" />
          <span className="text-[11px] text-[var(--aura-muted)]">Walk-in slot available</span>
        </div>
      </div>
    </div>
  );
}

function POSMockup() {
  const items = [
    { name: "Haircut & Styling", qty: 1, price: 1200 },
    { name: "Hair Spa Treatment", qty: 1, price: 2800 },
    { name: "Beard Trim", qty: 1, price: 600 },
  ];
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const gst = Math.round(subtotal * 0.18);
  return (
    <div className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-md)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--aura-border)] bg-[var(--aura-off-white)] px-5 py-3">
        <span className="text-xs font-semibold text-[var(--aura-heading)]">Express Checkout</span>
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">GST Ready</span>
      </div>
      <div className="p-4 space-y-2">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between rounded-lg bg-[var(--aura-off-white)] px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-[var(--aura-heading)]">{item.name}</p>
              <p className="text-[10px] text-[var(--aura-muted)]">Qty: {item.qty}</p>
            </div>
            <span className="text-xs font-bold text-[var(--aura-heading)] tabular-nums">₹{item.price.toLocaleString("en-IN")}</span>
          </div>
        ))}
        <div className="mt-3 space-y-1.5 border-t border-[var(--aura-border)] pt-3 text-xs">
          <div className="flex justify-between text-[var(--aura-body)]"><span>Subtotal</span><span className="tabular-nums">₹{subtotal.toLocaleString("en-IN")}</span></div>
          <div className="flex justify-between text-[var(--aura-body)]"><span>GST (18%)</span><span className="tabular-nums">₹{gst.toLocaleString("en-IN")}</span></div>
          <div className="flex justify-between font-bold text-[var(--aura-heading)] text-sm pt-1"><span>Total</span><span className="tabular-nums">₹{(subtotal + gst).toLocaleString("en-IN")}</span></div>
        </div>
        <div className="flex gap-2 pt-2">
          <span className="flex-1 rounded-lg bg-[var(--aura-purple)] py-2 text-center text-[11px] font-semibold text-white">UPI</span>
          <span className="flex-1 rounded-lg border border-[var(--aura-border)] py-2 text-center text-[11px] font-semibold text-[var(--aura-heading)]">Cash</span>
          <span className="flex-1 rounded-lg border border-[var(--aura-border)] py-2 text-center text-[11px] font-semibold text-[var(--aura-heading)]">Card</span>
        </div>
      </div>
    </div>
  );
}

function ClientMockup() {
  return (
    <div className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-md)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--aura-border)] bg-[var(--aura-off-white)] px-5 py-3">
        <span className="text-xs font-semibold text-[var(--aura-heading)]">Client Profile</span>
        <span className="text-[10px] text-[var(--aura-muted)]">ID #1042</span>
      </div>
      <div className="p-4">
        {/* Client header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--aura-lavender)] text-sm font-bold text-[var(--aura-purple)]">PS</div>
          <div>
            <p className="text-sm font-semibold text-[var(--aura-heading)]">Priya Sharma</p>
            <p className="text-[11px] text-[var(--aura-muted)]">Member since Jan 2024 · Mumbai</p>
          </div>
        </div>
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[["32", "Total Visits"], ["₹1,450", "Avg. Spend"], ["12 days", "Since Last"]].map(([val, lbl]) => (
            <div key={lbl} className="rounded-xl bg-[var(--aura-off-white)] p-2.5 text-center">
              <p className="text-sm font-bold text-[var(--aura-heading)] tabular-nums">{val}</p>
              <p className="text-[9px] text-[var(--aura-muted)]">{lbl}</p>
            </div>
          ))}
        </div>
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {["Keratin Regular", "Prefers Ananya", "Birthday: Mar 15", "Gold Member"].map((tag) => (
            <span key={tag} className="rounded-md bg-[var(--aura-lavender)] px-2 py-1 text-[10px] font-medium text-[var(--aura-purple)]">{tag}</span>
          ))}
        </div>
        {/* Recent visits */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-[var(--aura-muted)] uppercase tracking-wider">Recent Visits</p>
          {[["Aug 5", "Haircut & Blowdry", "₹1,200"], ["Jul 18", "Keratin Treatment", "₹4,500"], ["Jun 30", "Hair Spa + Cut", "₹2,800"]].map(([date, svc, amt]) => (
            <div key={date} className="flex items-center justify-between rounded-lg bg-[var(--aura-off-white)] px-3 py-2">
              <div><p className="text-[11px] font-medium text-[var(--aura-heading)]">{svc}</p><p className="text-[10px] text-[var(--aura-muted)]">{date}</p></div>
              <span className="text-[11px] font-bold text-[var(--aura-heading)] tabular-nums">{amt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StaffMockup() {
  const members = [
    { name: "Ananya K.", role: "Senior Stylist", status: "On Floor", services: 8, target: 12, commission: "₹3,200" },
    { name: "Vikram S.", role: "Stylist", status: "On Break", services: 5, target: 10, commission: "₹1,800" },
    { name: "Riya P.", role: "Therapist", status: "On Floor", services: 6, target: 8, commission: "₹2,400" },
  ];
  return (
    <div className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-md)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--aura-border)] bg-[var(--aura-off-white)] px-5 py-3">
        <span className="text-xs font-semibold text-[var(--aura-heading)]">Team Dashboard</span>
        <span className="text-[10px] text-[var(--aura-muted)]">Today</span>
      </div>
      <div className="p-4 space-y-2">
        {members.map((m) => (
          <div key={m.name} className="rounded-xl border border-[var(--aura-border)] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--aura-lavender)] text-[10px] font-bold text-[var(--aura-purple)]">
                  {m.name.split(" ").map(w => w[0]).join("")}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--aura-heading)]">{m.name}</p>
                  <p className="text-[10px] text-[var(--aura-muted)]">{m.role}</p>
                </div>
              </div>
              <span className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${m.status === "On Floor" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {m.status}
              </span>
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-[var(--aura-lavender)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--aura-purple)]"
                  style={{ width: `${(m.services / m.target) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-[var(--aura-body)] tabular-nums">{m.services}/{m.target}</span>
              <span className="text-[10px] font-bold text-emerald-600 tabular-nums">{m.commission}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Section Data ── */
const SECTIONS = [
  {
    id: "appointments",
    badge: "Appointments",
    headline: "Keep every chair productive.",
    body: "Manage your schedule, team availability and customer bookings without chaos. One calendar that your whole team trusts.",
    features: [
      { icon: Calendar, label: "Real-time calendar" },
      { icon: Users, label: "Staff availability" },
      { icon: UserPlus, label: "Walk-in management" },
      { icon: RefreshCw, label: "Easy rescheduling" },
      { icon: ListChecks, label: "Waitlist" },
      { icon: Globe, label: "Online booking" },
      { icon: Bell, label: "Appointment reminders" },
    ],
    Mockup: CalendarMockup,
  },
  {
    id: "billing",
    badge: "POS & Billing",
    headline: "Checkout in seconds. Know every rupee.",
    body: "Fast, accurate billing with GST compliance built in. Every payment method, every discount rule, every receipt — handled.",
    features: [
      { icon: Receipt, label: "GST invoices" },
      { icon: Percent, label: "Discounts & packages" },
      { icon: Gift, label: "Memberships" },
      { icon: CreditCard, label: "Multiple payment methods" },
      { icon: ArrowLeftRight, label: "Split payments" },
      { icon: BadgeDollarSign, label: "Tips" },
      { icon: History, label: "Refunds & payment history" },
    ],
    Mockup: POSMockup,
  },
  {
    id: "crm",
    badge: "Client CRM",
    headline: "Know your clients better than they expect.",
    body: "Every visit, every preference, every detail — always at your fingertips. Build relationships that bring clients back.",
    features: [
      { icon: User, label: "Visit history" },
      { icon: Heart, label: "Favourite services" },
      { icon: Star, label: "Preferred stylist" },
      { icon: StickyNote, label: "Notes & preferences" },
      { icon: Cake, label: "Birthdays" },
      { icon: Wallet, label: "Wallet & points" },
      { icon: ShoppingBag, label: "Average spend" },
    ],
    Mockup: ClientMockup,
  },
  {
    id: "staff",
    badge: "Staff Management",
    headline: "A happier team starts with a clearer system.",
    body: "Track attendance, manage commissions, set targets and run payroll — all transparent, all automatic.",
    features: [
      { icon: Fingerprint, label: "Attendance tracking" },
      { icon: CalendarDays, label: "Shift scheduling" },
      { icon: Target, label: "Targets & goals" },
      { icon: Coins, label: "Commissions" },
      { icon: FileText, label: "Payroll" },
      { icon: BarChart3, label: "Performance metrics" },
      { icon: Repeat, label: "Service turns" },
      { icon: Shield, label: "Role permissions" },
    ],
    Mockup: StaffMockup,
  },
];

/* ── Main Export ── */
export function ProductFeatures() {
  return (
    <>
      {SECTIONS.map((section, idx) => {
        const reversed = idx % 2 !== 0;
        return (
          <ProductSection key={section.id} section={section} reversed={reversed} index={idx} />
        );
      })}
    </>
  );
}

function ProductSection({
  section,
  reversed,
  index,
}: {
  section: (typeof SECTIONS)[number];
  reversed: boolean;
  index: number;
}) {
  const { ref, visible } = useReveal();
  const { Mockup } = section;

  return (
    <section
      ref={ref}
      className={`py-16 md:py-24 ${index % 2 === 0 ? "bg-white" : "bg-[var(--aura-off-white)]"}`}
    >
      <Container>
        <div className={`grid items-center gap-10 lg:gap-16 lg:grid-cols-2 ${reversed ? "lg:[direction:rtl]" : ""}`}>
          {/* Text */}
          <div
            className={reversed ? "lg:[direction:ltr]" : ""}
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
            }}
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              {section.badge}
            </span>
            <h2 className="text-[clamp(1.75rem,4vw,2.65rem)] font-semibold leading-[1.12] tracking-[-0.035em] text-[var(--aura-heading)]">
              {section.headline}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[var(--aura-body)] max-w-lg">
              {section.body}
            </p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {section.features.map(({ icon, label }) => (
                <FeaturePill key={label} icon={icon} label={label} />
              ))}
            </ul>
          </div>

          {/* Mockup */}
          <div
            className={reversed ? "lg:[direction:ltr]" : ""}
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(24px)",
              transition: "opacity 0.6s ease-out 0.12s, transform 0.6s ease-out 0.12s",
            }}
          >
            <Mockup />
          </div>
        </div>
      </Container>
    </section>
  );
}
