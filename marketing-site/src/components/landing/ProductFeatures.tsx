"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import { LandingDecor } from "./LandingDecor";
import {
  Calendar, CheckCircle2, Clock, Users, UserPlus, ListChecks, Globe, Bell, RefreshCw,
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
function FeaturePill({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors ${active ? "bg-[var(--aura-purple)] text-white" : "bg-white/70 text-[var(--aura-purple)] ring-1 ring-[var(--aura-purple)]/10"}`}>
        {active ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </>
  );

  return (
    <li>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={`flex w-full items-center gap-2.5 rounded-full border px-2.5 py-2 text-left text-sm transition-all duration-300 ${active ? "border-[var(--aura-purple)]/20 bg-white/75 text-[var(--aura-purple)] shadow-[0_10px_30px_rgba(109,63,209,0.08)]" : "border-white/55 bg-white/35 text-[var(--aura-body)] hover:border-[var(--aura-purple)]/18 hover:bg-white/60 hover:text-[var(--aura-heading)]"}`}
        >
          {content}
        </button>
      ) : (
        <span className="flex items-center gap-2.5 text-sm text-[var(--aura-body)]">{content}</span>
      )}
    </li>
  );
}

/* ── Inline UI Mockups ── */

function CalendarMockup({ activeFeature = "Real-time calendar" }: { activeFeature?: string }) {
  const [activeDay, setActiveDay] = useState(0);
  const panels = {
    "Staff availability": {
      title: "Staff Availability",
      meta: "Live now",
      rows: [
        { time: "10:00", client: "Ananya", service: "4 bookings", stylist: "2 slots free", color: "bg-[var(--aura-purple)]/10 border-[var(--aura-purple)]/20 text-[var(--aura-purple)]" },
        { time: "11:30", client: "Vikram", service: "On floor", stylist: "1 slot free", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        { time: "14:00", client: "Riya", service: "Lunch break", stylist: "Back at 15:00", color: "bg-amber-50 border-amber-200 text-amber-700" },
      ],
      footer: "Auto-suggests available stylists before booking.",
    },
    "Walk-in management": {
      title: "Walk-in Queue",
      meta: "3 waiting",
      rows: [
        { time: "Now", client: "Amit P.", service: "Haircut", stylist: "Assign Vikram", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        { time: "+15m", client: "Nisha R.", service: "Threading", stylist: "Assign Riya", color: "bg-sky-50 border-sky-200 text-sky-700" },
        { time: "+30m", client: "Kabir S.", service: "Beard trim", stylist: "Open chair", color: "bg-amber-50 border-amber-200 text-amber-700" },
      ],
      footer: "Drop-ins get a clear wait time and chair assignment.",
    },
    "Easy rescheduling": {
      title: "Reschedule Assistant",
      meta: "Best matches",
      rows: [
        { time: "12:30", client: "Priya S.", service: "Move from 10:00", stylist: "Same stylist", color: "bg-[var(--aura-purple)]/10 border-[var(--aura-purple)]/20 text-[var(--aura-purple)]" },
        { time: "15:00", client: "Priya S.", service: "Open slot", stylist: "Ananya", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        { time: "18:30", client: "Priya S.", service: "After work", stylist: "Ananya", color: "bg-sky-50 border-sky-200 text-sky-700" },
      ],
      footer: "Move appointments without breaking stylist capacity.",
    },
    Waitlist: {
      title: "Smart Waitlist",
      meta: "Auto-fill gaps",
      rows: [
        { time: "13:00", client: "Sara M.", service: "Hair colour", stylist: "High value", color: "bg-rose-50 border-rose-200 text-rose-700" },
        { time: "16:00", client: "Dev K.", service: "Beard trim", stylist: "Flexible", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        { time: "18:00", client: "Maya D.", service: "Root touch-up", stylist: "Confirming", color: "bg-amber-50 border-amber-200 text-amber-700" },
      ],
      footer: "Cancelled slots can be filled before revenue is lost.",
    },
    "Online booking": {
      title: "Online Bookings",
      meta: "Synced instantly",
      rows: [
        { time: "09:45", client: "Website", service: "Hair spa booked", stylist: "Riya", color: "bg-sky-50 border-sky-200 text-sky-700" },
        { time: "12:15", client: "Instagram", service: "Blowdry booked", stylist: "Ananya", color: "bg-[var(--aura-purple)]/10 border-[var(--aura-purple)]/20 text-[var(--aura-purple)]" },
        { time: "17:30", client: "Google", service: "Beard styling", stylist: "Vikram", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
      ],
      footer: "Public booking slots stay aligned with salon capacity.",
    },
    "Appointment reminders": {
      title: "Reminder Queue",
      meta: "WhatsApp ready",
      rows: [
        { time: "T-24h", client: "Priya S.", service: "Reminder sent", stylist: "Confirmed", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        { time: "T-3h", client: "Rahul M.", service: "Follow-up", stylist: "Pending reply", color: "bg-amber-50 border-amber-200 text-amber-700" },
        { time: "T-30m", client: "Meera K.", service: "Arrival ping", stylist: "Scheduled", color: "bg-[var(--aura-purple)]/10 border-[var(--aura-purple)]/20 text-[var(--aura-purple)]" },
      ],
      footer: "Reduce no-shows with automated client nudges.",
    },
  };
  const days = [
    {
      label: "Mon",
      date: "Aug 17, 2026",
      slots: [
        { time: "10:00", client: "Priya S.", service: "Haircut & Blowdry", stylist: "Ananya", color: "bg-[var(--aura-purple)]/10 border-[var(--aura-purple)]/20 text-[var(--aura-purple)]" },
        { time: "11:30", client: "Rahul M.", service: "Beard Trim", stylist: "Vikram", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        { time: "14:00", client: "Meera K.", service: "Keratin Treatment", stylist: "Ananya", color: "bg-amber-50 border-amber-200 text-amber-700" },
      ],
    },
    {
      label: "Tue",
      date: "Aug 18, 2026",
      slots: [
        { time: "09:30", client: "Neha R.", service: "Hair Spa", stylist: "Riya", color: "bg-sky-50 border-sky-200 text-sky-700" },
        { time: "12:00", client: "Aarav P.", service: "Kids Cut", stylist: "Vikram", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        { time: "16:15", client: "Isha B.", service: "Global Colour", stylist: "Ananya", color: "bg-rose-50 border-rose-200 text-rose-700" },
      ],
    },
    {
      label: "Wed",
      date: "Aug 19, 2026",
      slots: [
        { time: "10:30", client: "Kabir S.", service: "Beard Styling", stylist: "Vikram", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        { time: "13:00", client: "Tanvi L.", service: "Facial Cleanup", stylist: "Riya", color: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700" },
        { time: "17:00", client: "Sara M.", service: "Smoothening", stylist: "Ananya", color: "bg-amber-50 border-amber-200 text-amber-700" },
      ],
    },
    {
      label: "Thu",
      date: "Aug 20, 2026",
      slots: [
        { time: "11:00", client: "Rohan G.", service: "Haircut", stylist: "Vikram", color: "bg-slate-50 border-slate-200 text-slate-700" },
        { time: "15:30", client: "Kavya N.", service: "Manicure", stylist: "Riya", color: "bg-pink-50 border-pink-200 text-pink-700" },
        { time: "18:00", client: "Diya A.", service: "Party Makeup", stylist: "Ananya", color: "bg-[var(--aura-purple)]/10 border-[var(--aura-purple)]/20 text-[var(--aura-purple)]" },
      ],
    },
    {
      label: "Fri",
      date: "Aug 21, 2026",
      slots: [
        { time: "09:45", client: "Maya D.", service: "Root Touch-up", stylist: "Ananya", color: "bg-rose-50 border-rose-200 text-rose-700" },
        { time: "12:45", client: "Dev K.", service: "Beard Trim", stylist: "Vikram", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        { time: "19:00", client: "Zara F.", service: "Blowdry", stylist: "Riya", color: "bg-sky-50 border-sky-200 text-sky-700" },
      ],
    },
    {
      label: "Sat",
      date: "Aug 22, 2026",
      slots: [
        { time: "10:15", client: "Anika J.", service: "Bridal Trial", stylist: "Ananya", color: "bg-[var(--aura-purple)]/10 border-[var(--aura-purple)]/20 text-[var(--aura-purple)]" },
        { time: "13:30", client: "Vir M.", service: "Haircut & Beard", stylist: "Vikram", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        { time: "17:45", client: "Pooja C.", service: "Nail Art", stylist: "Riya", color: "bg-pink-50 border-pink-200 text-pink-700" },
      ],
    },
    {
      label: "Sun",
      date: "Aug 23, 2026",
      slots: [
        { time: "11:30", client: "Naina V.", service: "Brunch Blowout", stylist: "Riya", color: "bg-sky-50 border-sky-200 text-sky-700" },
        { time: "14:30", client: "Samar Q.", service: "Cleanup & Trim", stylist: "Vikram", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        { time: "18:15", client: "Tara H.", service: "Hair Colour", stylist: "Ananya", color: "bg-amber-50 border-amber-200 text-amber-700" },
      ],
    },
  ];
  const selectedDay = days[activeDay];
  const panel = panels[activeFeature as keyof typeof panels];

  if (panel) {
    return (
      <div className="min-h-[332px] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/45 shadow-[0_22px_70px_rgba(82,58,138,0.10)] backdrop-blur-xl ring-1 ring-white/50">
        <div className="flex items-center justify-between border-b border-white/45 bg-white/25 px-5 py-3">
          <span className="text-xs font-semibold text-[var(--aura-heading)]">{panel.title}</span>
          <span className="text-xs text-[var(--aura-muted)]">{panel.meta}</span>
        </div>
        <div className="space-y-2 p-4">
          {panel.rows.map((s) => (
            <div key={`${panel.title}-${s.time}-${s.client}`} className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${s.color}`}>
              <span className="w-10 shrink-0 text-xs font-bold tabular-nums">{s.time}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{s.client}</p>
                <p className="truncate text-[10px] opacity-70">{s.service} · {s.stylist}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--aura-border)] px-3 py-3">
            <Calendar className="h-3.5 w-3.5 text-[var(--aura-muted)]" />
            <span className="text-[11px] text-[var(--aura-muted)]">{panel.footer}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[332px] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/45 shadow-[0_22px_70px_rgba(82,58,138,0.10)] backdrop-blur-xl ring-1 ring-white/50">
      <div className="flex items-center justify-between border-b border-white/45 bg-white/25 px-5 py-3">
        <span className="text-xs font-semibold text-[var(--aura-heading)]">Today&apos;s Schedule</span>
        <span className="text-xs text-[var(--aura-muted)]">{selectedDay.date}</span>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-white/45 bg-white/20">
        {days.map((day, i) => (
          <button
            key={day.label}
            type="button"
            onClick={() => setActiveDay(i)}
            className={`px-1 py-2 text-center text-[10px] font-semibold transition-colors ${i === activeDay ? "bg-[var(--aura-lavender)] text-[var(--aura-purple)]" : "text-[var(--aura-muted)] hover:bg-[var(--aura-lavender)]/50 hover:text-[var(--aura-purple)]"}`}
          >
            {day.label}
          </button>
        ))}
      </div>
      {/* Appointments */}
      <div className="space-y-2 p-4">
        {selectedDay.slots.map((s) => (
          <div key={`${selectedDay.label}-${s.time}`} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${s.color}`}>
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

function POSMockup({ activeFeature = "GST invoices" }: { activeFeature?: string }) {
  const [paymentMode, setPaymentMode] = useState("UPI");
  const items = [
    { name: "Haircut & Styling", qty: 1, price: 1200 },
    { name: "Hair Spa Treatment", qty: 1, price: 2800 },
    { name: "Beard Trim", qty: 1, price: 600 },
  ];
  const paymentModes = [
    { label: "UPI", detail: "QR ready", accent: "from-[var(--aura-purple)] to-violet-500", icon: "QR" },
    { label: "Cash", detail: "Change due", accent: "from-emerald-500 to-teal-500", icon: "₹" },
    { label: "Card", detail: "Tap to pay", accent: "from-slate-800 to-slate-600", icon: "NFC" },
  ];
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;
  const activePayment = paymentModes.find((mode) => mode.label === paymentMode) ?? paymentModes[0];
  const panels = {
    "GST invoices": {
      title: "GST Invoice Preview",
      meta: "Auto compliant",
      summary: "Invoice #AUR-2084",
      rows: [
        ["Taxable value", `₹${subtotal.toLocaleString("en-IN")}`, "Services grouped by GST rate"],
        ["CGST + SGST", `₹${gst.toLocaleString("en-IN")}`, "18% calculated automatically"],
        ["Receipt status", "Ready", "Customer copy + salon copy"],
      ],
      accent: "from-emerald-500 to-teal-500",
      footer: "GST breakup, invoice number and receipt format stay ready at checkout.",
    },
    "Discounts & packages": {
      title: "Smart Discount Rules",
      meta: "Protected margins",
      summary: "Package: Hair Spa Saver",
      rows: [
        ["Eligible offer", "15% off", "Only on selected services"],
        ["Manager approval", "Required", "Above configured limit"],
        ["Margin after discount", "62%", "Shown before billing"],
      ],
      accent: "from-violet-500 to-fuchsia-500",
      footer: "Offers apply cleanly without staff giving random discounts.",
    },
    Memberships: {
      title: "Membership Wallet",
      meta: "Gold active",
      summary: "Priya Sharma",
      rows: [
        ["Wallet balance", "₹2,450", "Can be used today"],
        ["Member benefit", "10% off", "Auto-applied on services"],
        ["Renewal prompt", "Due in 18 days", "Shown before payment"],
      ],
      accent: "from-amber-500 to-orange-500",
      footer: "Membership usage, balance and renewal prompts appear inside billing.",
    },
    "Multiple payment methods": {
      title: "Payment Router",
      meta: `${activePayment.label} live`,
      summary: `${activePayment.label} selected`,
      rows: [
        ["Bill amount", `₹${total.toLocaleString("en-IN")}`, activePayment.detail],
        ["Payment link", "Ready", "UPI, card and cash tracked"],
        ["Receipt sync", "Instant", "Marked paid after confirmation"],
      ],
      accent: activePayment.accent,
      footer: "Switch UPI, cash or card without changing the final bill.",
    },
    "Split payments": {
      title: "Split Payment Plan",
      meta: "Balanced",
      summary: `Total ₹${total.toLocaleString("en-IN")}`,
      rows: [
        ["UPI", "₹3,000", "Customer paid online"],
        ["Cash", "₹1,500", "Collected at counter"],
        ["Card", `₹${(total - 4500).toLocaleString("en-IN")}`, "Pending tap"],
      ],
      accent: "from-sky-500 to-blue-600",
      footer: "Multiple tenders reconcile into one clean receipt.",
    },
    Tips: {
      title: "Tip Allocation",
      meta: "Staff linked",
      summary: "Tip added: ₹350",
      rows: [
        ["Ananya", "₹250", "Haircut & styling"],
        ["Riya", "₹100", "Spa support"],
        ["Payroll sync", "Ready", "Included in staff payout"],
      ],
      accent: "from-pink-500 to-rose-500",
      footer: "Tips are captured with the bill and mapped to the right team member.",
    },
    "Refunds & payment history": {
      title: "Payment History",
      meta: "Audit safe",
      summary: "Last 3 actions",
      rows: [
        ["Aug 19", "₹5,428 paid", "Card · receipt sent"],
        ["Aug 12", "₹600 refunded", "Manager approved"],
        ["Aug 05", "₹2,800 paid", "UPI · settled"],
      ],
      accent: "from-slate-700 to-slate-500",
      footer: "Refunds and payment changes stay attached to the original bill.",
    },
  };
  const panel = panels[activeFeature as keyof typeof panels] ?? panels["GST invoices"];

  if (activeFeature !== "Multiple payment methods") {
    return (
      <div className="min-h-[462px] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/45 shadow-[0_22px_70px_rgba(82,58,138,0.10)] backdrop-blur-xl ring-1 ring-white/50">
        <div className="flex items-center justify-between border-b border-white/45 bg-white/25 px-5 py-3">
          <span className="text-xs font-semibold text-[var(--aura-heading)]">{panel.title}</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{panel.meta}</span>
        </div>
        <div className="space-y-3 p-4">
          <div className={`rounded-2xl bg-gradient-to-r ${panel.accent} p-4 text-white shadow-lg shadow-[var(--aura-purple)]/10`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Smart billing card</p>
            <p className="mt-1 text-lg font-bold">{panel.summary}</p>
          </div>
          {panel.rows.map(([label, value, detail]) => (
            <div key={label} className="flex items-center justify-between rounded-xl border border-white/45 bg-white/25 px-3 py-3 backdrop-blur-sm">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--aura-heading)]">{label}</p>
                <p className="truncate text-[10px] text-[var(--aura-muted)]">{detail}</p>
              </div>
              <span className="shrink-0 text-xs font-bold text-[var(--aura-heading)] tabular-nums">{value}</span>
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-[var(--aura-border)] px-3 py-3 text-[11px] text-[var(--aura-muted)]">
            {panel.footer}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[462px] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/45 shadow-[0_22px_70px_rgba(82,58,138,0.10)] backdrop-blur-xl ring-1 ring-white/50">
      <div className="flex items-center justify-between border-b border-white/45 bg-white/25 px-5 py-3">
        <span className="text-xs font-semibold text-[var(--aura-heading)]">Express Checkout</span>
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">GST Ready</span>
      </div>
      <div className="p-4 space-y-2">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between rounded-lg bg-white/25 px-3 py-2.5 backdrop-blur-sm">
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
          <div className="flex justify-between font-bold text-[var(--aura-heading)] text-sm pt-1"><span>Total</span><span className="tabular-nums">₹{total.toLocaleString("en-IN")}</span></div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2">
          {paymentModes.map((mode) => {
            const selected = mode.label === activePayment.label;
            return (
              <button
                key={mode.label}
                type="button"
                onClick={() => setPaymentMode(mode.label)}
                className={`rounded-lg border px-2 py-2 text-center text-[11px] font-semibold transition-all ${selected ? `border-transparent bg-gradient-to-r ${mode.accent} text-white shadow-md shadow-[var(--aura-purple)]/15` : "border-[var(--aura-border)] text-[var(--aura-heading)] hover:border-[var(--aura-purple)]/30 hover:bg-[var(--aura-lavender)]/50"}`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
        <div className={`mt-2 flex items-center justify-between rounded-2xl bg-gradient-to-r ${activePayment.accent} p-3 text-white shadow-lg shadow-[var(--aura-purple)]/10`}>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 text-[10px] font-black ring-1 ring-white/25">{activePayment.icon}</span>
            <div>
              <p className="text-xs font-bold">{activePayment.label} selected</p>
              <p className="text-[10px] text-white/75">{activePayment.detail} · ₹{total.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <span className="rounded-full bg-white/20 px-2 py-1 text-[9px] font-bold ring-1 ring-white/25">Live</span>
        </div>
      </div>
    </div>
  );
}

function ClientMockup({ activeFeature = "Visit history" }: { activeFeature?: string }) {
  const clients = [
    {
      id: "#1042",
      initials: "PS",
      name: "Priya Sharma",
      meta: "Member since Jan 2024 · Mumbai",
      stats: [["32", "Total Visits"], ["₹1,450", "Avg. Spend"], ["12 days", "Since Last"]],
      tags: ["Keratin Regular", "Prefers Ananya", "Birthday: Mar 15", "Gold Member"],
      visits: [["Aug 5", "Haircut & Blowdry", "₹1,200"], ["Jul 18", "Keratin Treatment", "₹4,500"], ["Jun 30", "Hair Spa + Cut", "₹2,800"]],
    },
    {
      id: "#1188",
      initials: "AM",
      name: "Aisha Mehta",
      meta: "Member since May 2023 · Bandra",
      stats: [["46", "Total Visits"], ["₹2,100", "Avg. Spend"], ["4 days", "Since Last"]],
      tags: ["Colour Client", "Prefers Riya", "Wallet: ₹850", "VIP"],
      visits: [["Aug 9", "Global Colour", "₹5,800"], ["Jul 28", "Hair Spa", "₹2,200"], ["Jul 6", "Root Touch-up", "₹2,900"]],
    },
    {
      id: "#1205",
      initials: "RG",
      name: "Rahul Gupta",
      meta: "Member since Sep 2024 · Powai",
      stats: [["18", "Total Visits"], ["₹780", "Avg. Spend"], ["7 days", "Since Last"]],
      tags: ["Beard Plan", "Prefers Vikram", "Evening Slots", "Prepaid"],
      visits: [["Aug 10", "Haircut & Beard", "₹1,100"], ["Jul 31", "Beard Styling", "₹650"], ["Jul 16", "Haircut", "₹850"]],
    },
    {
      id: "#1261",
      initials: "NK",
      name: "Naina Kapoor",
      meta: "Member since Nov 2022 · Juhu",
      stats: [["61", "Total Visits"], ["₹3,250", "Avg. Spend"], ["2 days", "Since Last"]],
      tags: ["Bridal Lead", "Prefers Ananya", "Birthday: Nov 2", "Platinum"],
      visits: [["Aug 12", "Bridal Trial", "₹8,500"], ["Aug 1", "Party Makeup", "₹4,200"], ["Jul 20", "Nail Art", "₹1,600"]],
    },
    {
      id: "#1309",
      initials: "DM",
      name: "Dev Malhotra",
      meta: "Member since Feb 2025 · Andheri",
      stats: [["11", "Total Visits"], ["₹920", "Avg. Spend"], ["15 days", "Since Last"]],
      tags: ["Walk-in Converted", "Prefers Vikram", "WhatsApp Reminders", "Silver"],
      visits: [["Aug 3", "Cleanup & Trim", "₹950"], ["Jul 21", "Haircut", "₹850"], ["Jul 4", "Beard Trim", "₹600"]],
    },
  ];
  const panels = {
    "Favourite services": {
      title: "Favourite Services",
      meta: "Auto detected",
      summary: "Priya books hair care most",
      rows: [
        ["Keratin Treatment", "5 visits", "Usually every 45 days"],
        ["Hair Spa", "8 visits", "Prefers weekend slots"],
        ["Blowdry", "12 visits", "High repeat service"],
      ],
      accent: "from-pink-500 to-rose-500",
      footer: "Reception can recommend the right service before the client asks.",
    },
    "Preferred stylist": {
      title: "Preferred Stylist",
      meta: "Best match",
      summary: "Ananya K. preferred",
      rows: [
        ["Ananya K.", "82% bookings", "Hair colour and keratin"],
        ["Riya P.", "12% bookings", "Spa support services"],
        ["Vikram S.", "6% bookings", "Family bookings"],
      ],
      accent: "from-violet-500 to-indigo-500",
      footer: "Booking screen can prioritize the stylist the client trusts most.",
    },
    "Notes & preferences": {
      title: "Notes & Preferences",
      meta: "Staff ready",
      summary: "Client comfort profile",
      rows: [
        ["Hair note", "No ammonia", "Sensitive scalp"],
        ["Beverage", "Green tea", "No sugar"],
        ["Visit style", "Quiet service", "Avoid product upsell"],
      ],
      accent: "from-sky-500 to-cyan-500",
      footer: "Every staff member sees the same preferences before service starts.",
    },
    Birthdays: {
      title: "Birthday Campaign",
      meta: "Mar 15",
      summary: "Gift voucher scheduled",
      rows: [
        ["Offer", "₹500 voucher", "Valid birthday week"],
        ["Channel", "WhatsApp", "Send 3 days before"],
        ["Expected booking", "Hair spa", "Based on history"],
      ],
      accent: "from-amber-500 to-orange-500",
      footer: "Birthday reminders become repeat bookings without manual follow-up.",
    },
    "Wallet & points": {
      title: "Wallet & Points",
      meta: "Gold member",
      summary: "₹2,450 wallet balance",
      rows: [
        ["Reward points", "1,280", "Worth ₹640"],
        ["Prepaid pack", "2 services", "Hair spa remaining"],
        ["Expiry alert", "18 days", "Prompt during checkout"],
      ],
      accent: "from-emerald-500 to-teal-500",
      footer: "Wallet, points and prepaid services stay visible during booking and billing.",
    },
    "Average spend": {
      title: "Average Spend",
      meta: "Client value",
      summary: "₹1,450 avg ticket",
      rows: [
        ["Last visit", "₹1,200", "Haircut & blowdry"],
        ["Highest bill", "₹4,500", "Keratin treatment"],
        ["Upgrade cue", "+₹900", "Add hair spa recommendation"],
      ],
      accent: "from-slate-700 to-slate-500",
      footer: "Staff can personalize recommendations without guessing spend capacity.",
    },
  };
  const panel = panels[activeFeature as keyof typeof panels];

  if (panel) {
    return (
      <div className="min-h-[442px] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/45 shadow-[0_22px_70px_rgba(82,58,138,0.10)] backdrop-blur-xl ring-1 ring-white/50">
        <div className="flex items-center justify-between border-b border-white/45 bg-white/25 px-5 py-3">
          <span className="text-xs font-semibold text-[var(--aura-heading)]">{panel.title}</span>
          <span className="text-[10px] text-[var(--aura-muted)]">{panel.meta}</span>
        </div>
        <div className="space-y-3 p-4">
          <div className={`rounded-2xl bg-gradient-to-r ${panel.accent} p-4 text-white shadow-lg shadow-[var(--aura-purple)]/10`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Smart client insight</p>
            <p className="mt-1 text-lg font-bold">{panel.summary}</p>
          </div>
          {panel.rows.map(([label, value, detail]) => (
            <div key={label} className="flex items-center justify-between rounded-xl border border-white/45 bg-white/25 px-3 py-3 backdrop-blur-sm">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--aura-heading)]">{label}</p>
                <p className="truncate text-[10px] text-[var(--aura-muted)]">{detail}</p>
              </div>
              <span className="shrink-0 text-xs font-bold text-[var(--aura-heading)] tabular-nums">{value}</span>
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-[var(--aura-border)] px-3 py-3 text-[11px] text-[var(--aura-muted)]">
            {panel.footer}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[442px] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/45 shadow-[0_22px_70px_rgba(82,58,138,0.10)] backdrop-blur-xl ring-1 ring-white/50">
      <div className="flex items-center justify-between border-b border-white/45 bg-white/25 px-5 py-3">
        <span className="text-xs font-semibold text-[var(--aura-heading)]">Client Profile</span>
        <span className="text-[10px] text-[var(--aura-muted)]">Swipe clients</span>
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {clients.map((client) => (
          <div key={client.id} className="w-full shrink-0 snap-center rounded-2xl border border-white/45 bg-white/25 p-3 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--aura-lavender)] text-sm font-bold text-[var(--aura-purple)]">{client.initials}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--aura-heading)]">{client.name}</p>
                  <p className="truncate text-[11px] text-[var(--aura-muted)]">{client.meta}</p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] text-[var(--aura-muted)]">ID {client.id}</span>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2">
              {client.stats.map(([val, lbl]) => (
                <div key={lbl} className="rounded-xl bg-white/25 p-2.5 text-center backdrop-blur-sm">
                  <p className="text-sm font-bold text-[var(--aura-heading)] tabular-nums">{val}</p>
                  <p className="text-[9px] text-[var(--aura-muted)]">{lbl}</p>
                </div>
              ))}
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {client.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-[var(--aura-lavender)] px-2 py-1 text-[10px] font-medium text-[var(--aura-purple)]">{tag}</span>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--aura-muted)]">Recent Visits</p>
              {client.visits.map(([date, svc, amt]) => (
                <div key={`${client.id}-${date}`} className="flex items-center justify-between rounded-lg bg-white/25 px-3 py-2 backdrop-blur-sm">
                  <div><p className="text-[11px] font-medium text-[var(--aura-heading)]">{svc}</p><p className="text-[10px] text-[var(--aura-muted)]">{date}</p></div>
                  <span className="text-[11px] font-bold text-[var(--aura-heading)] tabular-nums">{amt}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 border-t border-white/45 bg-white/25 px-5 py-2">
        {clients.map((client, index) => (
          <span key={client.id} className={`h-1.5 rounded-full ${index === 0 ? "w-5 bg-[var(--aura-purple)]" : "w-1.5 bg-[var(--aura-border)]"}`} />
        ))}
      </div>
    </div>
  );
}

function StaffMockup({ activeFeature = "Attendance tracking" }: { activeFeature?: string }) {
  const dashboards = {
    "Attendance tracking": {
      label: "Attendance",
      summary: "20 hrs logged today",
      accent: "from-violet-500 to-indigo-500",
      footer: "Late arrivals, breaks and floor time stay visible before payroll.",
      rows: [
        { name: "Ananya K.", role: "Senior Stylist", status: "On Floor", detail: "Check-in 09:54", value: 8, target: 9, suffix: "hrs" },
        { name: "Vikram S.", role: "Stylist", status: "On Break", detail: "Break ends 15:10", value: 5, target: 9, suffix: "hrs" },
        { name: "Riya P.", role: "Therapist", status: "On Floor", detail: "No gaps today", value: 7, target: 8, suffix: "hrs" },
      ],
    },
    "Shift scheduling": {
      label: "Shift Coverage",
      summary: "92% chairs covered",
      accent: "from-sky-500 to-blue-600",
      footer: "Coverage gaps are highlighted before they affect bookings.",
      rows: [
        { name: "Ananya K.", role: "Morning Shift", status: "Covered", detail: "10:00 to 16:00", value: 6, target: 6, suffix: "slots" },
        { name: "Vikram S.", role: "Split Shift", status: "Gap 1h", detail: "Needs 14:00 cover", value: 4, target: 6, suffix: "slots" },
        { name: "Riya P.", role: "Evening Shift", status: "Covered", detail: "15:00 to close", value: 5, target: 6, suffix: "slots" },
      ],
    },
    "Targets & goals": {
      label: "Revenue Goals",
      summary: "₹74k achieved today",
      accent: "from-emerald-500 to-teal-500",
      footer: "Targets convert into clear daily action for every staff member.",
      rows: [
        { name: "Ananya K.", role: "Senior Stylist", status: "On Track", detail: "2 premium services left", value: 32000, target: 50000, money: true },
        { name: "Vikram S.", role: "Stylist", status: "Needs Push", detail: "Retail attach suggested", value: 18000, target: 40000, money: true },
        { name: "Riya P.", role: "Therapist", status: "Ahead", detail: "Spa package converting", value: 24000, target: 30000, money: true },
      ],
    },
    Commissions: {
      label: "Commissions",
      summary: "₹7,400 payable",
      accent: "from-amber-500 to-orange-500",
      footer: "Commission slabs are calculated live from completed bills.",
      rows: [
        { name: "Ananya K.", role: "12% slab", status: "Payable", detail: "Keratin bonus included", value: 3200, target: 5000, money: true },
        { name: "Vikram S.", role: "10% slab", status: "Pending", detail: "1 refund under review", value: 1800, target: 4000, money: true },
        { name: "Riya P.", role: "Therapy slab", status: "Payable", detail: "Package sale counted", value: 2400, target: 3000, money: true },
      ],
    },
    Payroll: {
      label: "Payroll Ready",
      summary: "2 ready, 1 review",
      accent: "from-slate-700 to-slate-500",
      footer: "Attendance, overtime, tips and incentives roll into one payroll view.",
      rows: [
        { name: "Ananya K.", role: "Salary + Incentive", status: "Ready", detail: "No exceptions", value: 38200, target: 45000, money: true },
        { name: "Vikram S.", role: "Salary + OT", status: "Review", detail: "OT approval pending", value: 29600, target: 35000, money: true },
        { name: "Riya P.", role: "Salary + Bonus", status: "Ready", detail: "Tips reconciled", value: 33400, target: 38000, money: true },
      ],
    },
    "Performance metrics": {
      label: "Performance",
      summary: "Top metric: 94 rating",
      accent: "from-fuchsia-500 to-pink-500",
      footer: "Rebook rate, retail attach and ratings expose coaching opportunities.",
      rows: [
        { name: "Ananya K.", role: "Rebook rate", status: "Excellent", detail: "18 clients rebooked", value: 82, target: 100, suffix: "%" },
        { name: "Vikram S.", role: "Retail attach", status: "Good", detail: "Push beard kits", value: 58, target: 100, suffix: "%" },
        { name: "Riya P.", role: "Client rating", status: "Top Rated", detail: "4.9 avg rating", value: 94, target: 100, suffix: "%" },
      ],
    },
    "Service turns": {
      label: "Service Turns",
      summary: "34 turns completed",
      accent: "from-cyan-500 to-sky-500",
      footer: "Service turns reveal who needs more bookings and who is overloaded.",
      rows: [
        { name: "Ananya K.", role: "Hair services", status: "Fast", detail: "Avg 42 min", value: 14, target: 18, suffix: "turns" },
        { name: "Vikram S.", role: "Grooming", status: "Steady", detail: "2 walk-ins added", value: 11, target: 16, suffix: "turns" },
        { name: "Riya P.", role: "Therapy", status: "Booked", detail: "1 slot left", value: 9, target: 10, suffix: "turns" },
      ],
    },
    "Role permissions": {
      label: "Access Control",
      summary: "6 sensitive actions locked",
      accent: "from-indigo-500 to-violet-500",
      footer: "Role controls keep discounts, refunds and reports protected.",
      rows: [
        { name: "Ananya K.", role: "Manager access", status: "Allowed", detail: "Refund approval enabled", value: 5, target: 6, suffix: "roles" },
        { name: "Vikram S.", role: "Staff access", status: "Limited", detail: "No report export", value: 3, target: 6, suffix: "roles" },
        { name: "Riya P.", role: "Therapist access", status: "Allowed", detail: "Client notes only", value: 4, target: 6, suffix: "roles" },
      ],
    },
  };
  const dashboard = dashboards[activeFeature as keyof typeof dashboards] ?? dashboards["Attendance tracking"];
  return (
    <div className="min-h-[336px] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/45 shadow-[0_22px_70px_rgba(82,58,138,0.10)] backdrop-blur-xl ring-1 ring-white/50">
      <div className="flex items-center justify-between border-b border-white/45 bg-white/25 px-5 py-3">
        <span className="text-xs font-semibold text-[var(--aura-heading)]">Team Dashboard</span>
        <span className="text-[10px] text-[var(--aura-muted)]">{dashboard.label}</span>
      </div>
      <div className="space-y-2 p-4">
        <div className={`flex items-center justify-between rounded-2xl bg-gradient-to-r ${dashboard.accent} p-3.5 text-white shadow-lg shadow-[var(--aura-purple)]/10`}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Smart team control</p>
            <p className="mt-1 text-base font-bold">{dashboard.summary}</p>
          </div>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[9px] font-bold ring-1 ring-white/25">Live</span>
        </div>
        {dashboard.rows.map((m) => {
          const percent = Math.round((m.value / m.target) * 100);
          const isMoney = "money" in m && m.money;
          const suffix = "suffix" in m ? m.suffix : "";
          const current = isMoney ? `₹${m.value.toLocaleString("en-IN")}` : `${m.value}${suffix ? ` ${suffix}` : ""}`;
          const target = isMoney ? `₹${m.target.toLocaleString("en-IN")}` : `${m.target}${suffix ? ` ${suffix}` : ""}`;
          const statusTone = ["On Floor", "Covered", "On Track", "Ahead", "Payable", "Ready", "Excellent", "Good", "Top Rated", "Fast", "Booked", "Allowed"].includes(m.status)
            ? "bg-emerald-50 text-emerald-700"
            : m.status === "Review" || m.status === "Pending" || m.status === "Needs Push" || m.status === "Gap 1h" || m.status === "On Break"
              ? "bg-amber-50 text-amber-700"
              : "bg-[var(--aura-lavender)] text-[var(--aura-purple)]";

          return (
          <div key={m.name} className="rounded-xl border border-white/45 bg-white/25 p-3 shadow-sm shadow-[var(--aura-purple)]/5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--aura-lavender)] text-[10px] font-bold text-[var(--aura-purple)] ring-1 ring-[var(--aura-purple)]/10">
                  {m.name.split(" ").map(w => w[0]).join("")}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--aura-heading)]">{m.name}</p>
                  <p className="truncate text-[10px] text-[var(--aura-muted)]">{m.role} · {m.detail}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold ${statusTone}`}>
                {m.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-[var(--aura-lavender)] overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${dashboard.accent}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-[var(--aura-body)] tabular-nums">{current}/{target}</span>
              <span className="text-[10px] font-bold text-emerald-600 tabular-nums">{percent}%</span>
            </div>
          </div>
          );
        })}
        <div className="rounded-xl border border-dashed border-[var(--aura-border)] px-3 py-2.5 text-[11px] text-[var(--aura-muted)]">
          {dashboard.footer}
        </div>
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
  const [activeFeature, setActiveFeature] = useState(section.features[0]?.label ?? "");
  const isAppointmentSection = section.id === "appointments";
  const isBillingSection = section.id === "billing";
  const isCrmSection = section.id === "crm";
  const isStaffSection = section.id === "staff";
  const hasInteractiveFeatures = isAppointmentSection || isBillingSection || isCrmSection || isStaffSection;

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden border-t border-white/70 py-16 md:py-24 ${index % 2 === 0 ? "bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF]" : "bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF]"}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(243,240,255,0.95),transparent_34%),radial-gradient(circle_at_82%_52%,rgba(111,79,216,0.10),transparent_30%)]" aria-hidden="true" />
      <LandingDecor variant={index % 2 === 0 ? "soft" : "warm"} />
      <Container className="relative z-10">
        <div className={`grid items-center gap-10 rounded-[2rem] border border-white/65 bg-white/20 p-5 shadow-[0_18px_80px_rgba(82,58,138,0.07)] backdrop-blur-sm md:p-8 lg:gap-16 lg:grid-cols-2 lg:p-10 ${reversed ? "lg:[direction:rtl]" : ""}`}>
          {/* Text */}
          <div
            className={reversed ? "lg:[direction:ltr]" : ""}
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
            }}
          >
            <span className="inline-flex rounded-full border border-[var(--aura-purple)]/15 bg-white/55 px-3 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 shadow-sm shadow-[var(--aura-purple)]/5">
              {section.badge}
            </span>
            <h2 className="max-w-xl text-[clamp(2rem,4.8vw,3.4rem)] font-bold leading-[1.03] tracking-[-0.055em] text-[var(--aura-heading)]">
              {section.headline}
            </h2>
            <p className="mt-5 max-w-lg text-[1.02rem] leading-[1.8] text-[var(--aura-body)]">
              {section.body}
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--aura-purple)]">
              <span className="rounded-full bg-white/60 px-3 py-1 ring-1 ring-white/70">Live preview</span>
              <span className="rounded-full bg-[var(--aura-lavender)]/75 px-3 py-1 ring-1 ring-[var(--aura-purple)]/10">Front desk ready</span>
            </div>
            <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
              {section.features.map(({ icon, label }) => (
                <FeaturePill
                  key={label}
                  icon={icon}
                  label={label}
                  active={hasInteractiveFeatures && activeFeature === label}
                  onClick={hasInteractiveFeatures ? () => setActiveFeature(label) : undefined}
                />
              ))}
            </ul>
          </div>

          {/* Mockup */}
          <div
            className={`relative ${reversed ? "lg:[direction:ltr]" : ""}`}
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(24px)",
              transition: "opacity 0.6s ease-out 0.12s, transform 0.6s ease-out 0.12s",
            }}
          >
            <div className="pointer-events-none absolute -top-4 left-4 z-10 hidden rounded-full border border-white/70 bg-white/75 px-3 py-1.5 text-[11px] font-semibold text-[var(--aura-heading)] shadow-[0_12px_40px_rgba(82,58,138,0.10)] backdrop-blur-md sm:block">
              {activeFeature}
            </div>
            {isAppointmentSection ? <CalendarMockup activeFeature={activeFeature} /> : isBillingSection ? <POSMockup activeFeature={activeFeature} /> : isCrmSection ? <ClientMockup activeFeature={activeFeature} /> : isStaffSection ? <StaffMockup activeFeature={activeFeature} /> : <Mockup />}
          </div>
        </div>
      </Container>
    </section>
  );
}
