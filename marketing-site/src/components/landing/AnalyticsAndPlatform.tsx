"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import { LandingDecor } from "./LandingDecor";
import {
  TrendingUp,
  CalendarCheck,
  Receipt,
  Users2,
  Briefcase,
  Boxes,
  Crown,
  Sparkles,
  Scissors,
  Layers,
  IndianRupee,
  Smartphone,
  Building,
  BarChart3,
  Calendar,
  CreditCard,
  UserCheck,
  Megaphone,
  LineChart,
  ArrowUpRight,
  ShieldCheck,
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
   SECTION 1: ANALYTICS
   =================================================================== */
function AnalyticsMockup() {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [activeMetric, setActiveMetric] = useState("Gross Revenue");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportDetails, setShowExportDetails] = useState(false);
  const [exportStatus, setExportStatus] = useState("Ready to export");
  const [lastExportFormat, setLastExportFormat] = useState("XLSX");
  const metrics = [
    {
      label: "Gross Revenue",
      Icon: TrendingUp,
      color: "text-emerald-600",
      monthly: { value: "₹2,81,560", note: "+18.4% vs last mo", detail: "This Month (1 Aug - 17 Aug)", rows: [["Hair Treatments", "₹1,18,000", "42% revenue share"], ["Facials", "₹86,800", "31% revenue share"], ["Cut & Blowdry", "₹45,440", "142 services"]] },
      yearly: { value: "₹38.4L", note: "+24.8% vs last yr", detail: "FY 2026 performance", rows: [["Hair Treatments", "₹14.2L", "37% annual share"], ["Facials", "₹9.6L", "25% annual share"], ["Retail Add-ons", "₹5.1L", "High margin growth"]] },
    },
    {
      label: "Appointments",
      Icon: CalendarCheck,
      color: "text-[var(--aura-purple)]",
      monthly: { value: "342", note: "94% seat capacity", detail: "Bookings this month", rows: [["Completed", "301", "88% completion"], ["Upcoming", "31", "Next 7 days"], ["No-shows", "10", "2.9% no-show rate"]] },
      yearly: { value: "7,840", note: "91% annual occupancy", detail: "Bookings this year", rows: [["Completed", "6,920", "Across all services"], ["Online bookings", "2,180", "27.8% digital share"], ["No-shows saved", "418", "Reminder automation"]] },
    },
    {
      label: "Average Bill",
      Icon: Receipt,
      color: "text-indigo-600",
      monthly: { value: "₹1,640", note: "+12% ticket upsell", detail: "Average bill value", rows: [["Service avg", "₹1,420", "Core bill value"], ["Retail add-on", "+₹220", "Attach uplift"], ["Top bill", "₹18,500", "Bridal package"]] },
      yearly: { value: "₹1,780", note: "+16% YoY ticket", detail: "Annual average bill", rows: [["Service avg", "₹1,510", "Improved pricing"], ["Retail add-on", "+₹270", "Product push"], ["Package impact", "+₹4.2L", "Prepaid plans"]] },
    },
    {
      label: "Client Retention",
      Icon: Users2,
      color: "text-amber-600",
      monthly: { value: "68.2%", note: "233 returning clients", detail: "Repeat client health", rows: [["Returning clients", "233", "Visited before"], ["New clients", "109", "First-time visits"], ["Win-back", "34", "Recovered clients"]] },
      yearly: { value: "72.5%", note: "2,940 repeat clients", detail: "Annual retention", rows: [["Repeat clients", "2,940", "Strong loyalty"], ["VIP retained", "84%", "Gold members"], ["At-risk saved", "418", "Campaign recovery"]] },
    },
    {
      label: "Staff Utilisation",
      Icon: Briefcase,
      color: "text-[var(--aura-purple)]",
      monthly: { value: "86%", note: "6.8 hrs / stylist", detail: "Team productivity", rows: [["Ananya", "92%", "Top booked stylist"], ["Vikram", "78%", "Needs walk-ins"], ["Riya", "88%", "Therapy capacity"]] },
      yearly: { value: "83%", note: "6.5 hrs / stylist", detail: "Annual utilisation", rows: [["Top stylist", "89%", "Ananya average"], ["Peak month", "94%", "May rush"], ["Training lift", "+11%", "New services"]] },
    },
    {
      label: "Inventory Cost",
      Icon: Boxes,
      color: "text-rose-600",
      monthly: { value: "7.8%", note: "Controlled ratio", detail: "Cost of consumption", rows: [["Hair color", "₹18,400", "Highest usage"], ["Facial kits", "₹9,800", "Stable ratio"], ["Variance", "-₹820", "Audit adjustment"]] },
      yearly: { value: "8.4%", note: "Below 10% target", detail: "Annual inventory cost", rows: [["Total usage", "₹3.22L", "All services"], ["Waste reduced", "14%", "Recipe tracking"], ["Stock-outs", "6", "Down from 22"]] },
    },
    {
      label: "Memberships",
      Icon: Crown,
      color: "text-amber-500",
      monthly: { value: "₹54,000", note: "24 new signups", detail: "Membership performance", rows: [["Gold plans", "14", "₹1.4L pipeline"], ["Wallet reloads", "₹54,000", "Prepaid cash"], ["Renewals", "8", "Due this month"]] },
      yearly: { value: "₹8.6L", note: "312 signups", detail: "Annual membership revenue", rows: [["Active members", "482", "Paid plans"], ["Wallet reserve", "₹14.2L", "Unused balance"], ["Renewal rate", "76%", "Healthy retention"]] },
    },
    {
      label: "Net Profit Est.",
      Icon: Sparkles,
      color: "text-emerald-600",
      monthly: { value: "₹1,12,400", note: "39.9% Net Margin", detail: "Estimated profit", rows: [["Gross revenue", "₹2,81,560", "Before expenses"], ["Direct cost", "₹52,400", "Stock + payouts"], ["Net margin", "39.9%", "Healthy month"]] },
      yearly: { value: "₹13.8L", note: "35.9% Net Margin", detail: "Estimated annual profit", rows: [["Gross revenue", "₹38.4L", "Annualized"], ["Direct cost", "₹8.2L", "Cost controlled"], ["Profit trend", "+21%", "YoY improvement"]] },
    },
  ];
  const active = metrics.find((metric) => metric.label === activeMetric) ?? metrics[0];
  const activeData = active[period];
  const exportOptions = [
    { format: "PDF", label: "GST summary", detail: "Owner-ready printable report" },
    { format: "XLSX", label: "Excel workbook", detail: "Invoices, tax split, payments" },
    { format: "CSV", label: "Tally import", detail: "Line-wise taxable values" },
    { format: "JSON", label: "API export", detail: "Structured audit payload" },
  ];
  const selectExport = (format: string) => {
    setLastExportFormat(format);
    setExportStatus(`${period === "monthly" ? "Monthly" : "Yearly"} GST ${format} download prepared`);
    setShowExportMenu(false);
    setShowExportDetails(true);
  };
  const buildGstReport = () => {
    const rows = [
      ["Period", period === "monthly" ? "Monthly" : "Yearly"],
      ["Metric", activeMetric],
      ["Value", activeData.value],
      ["Note", activeData.note],
      ...activeData.rows.map(([name, value, detail]) => [name, value, detail]),
    ];

    if (lastExportFormat === "JSON") {
      return JSON.stringify({ period, metric: activeMetric, value: activeData.value, note: activeData.note, rows: activeData.rows }, null, 2);
    }

    if (lastExportFormat === "PDF") {
      return `GST Report\n${rows.map((row) => row.join(" - ")).join("\n")}`;
    }

    return rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  };
  const downloadGstReport = () => {
    const report = buildGstReport();
    const extension = lastExportFormat.toLowerCase() === "xlsx" ? "csv" : lastExportFormat.toLowerCase();
    const mime = lastExportFormat === "JSON" ? "application/json" : "text/plain";
    const blob = new Blob([report], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aura-gst-${period}-${activeMetric.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const previewGstReport = () => {
    const report = buildGstReport();
    const escapedReport = report.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char] ?? char));
    const html = `<!doctype html><html><head><title>Aura GST Report Print</title><style>body{font-family:Inter,Arial,sans-serif;margin:32px;color:#17151f}pre{white-space:pre-wrap;border:1px solid #e8e3f5;border-radius:16px;padding:20px;background:#fbf9ff;line-height:1.6}.badge{display:inline-block;background:#ede7ff;color:#6f43e8;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700}@media print{body{margin:18mm}.badge{color:#17151f;background:#f3f0ff}}</style></head><body><span class="badge">${lastExportFormat} Print Preview</span><h1>Aura GST Report</h1><p>${period === "monthly" ? "Monthly" : "Yearly"} export for ${activeMetric}</p><pre>${escapedReport}</pre><script>window.onload=function(){setTimeout(function(){window.focus();window.print()},300)}</script></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <div className="relative rounded-[var(--aura-radius-xl)] border border-white/50 bg-white/30 shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35 overflow-hidden">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/45 bg-white/25 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-bold text-[var(--aura-heading)]">Executive Salon Performance</h3>
          </div>
          <p className="text-[11px] text-[var(--aura-muted)]">{activeData.detail} &bull; Bandra West Branch</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPeriod("monthly")}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${period === "monthly" ? "border-[var(--aura-purple)] bg-[var(--aura-purple)] text-white" : "border-[var(--aura-border)] bg-white text-[var(--aura-heading)]"}`}
          >Monthly</button>
          <button
            type="button"
            onClick={() => setPeriod("yearly")}
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${period === "yearly" ? "border-[var(--aura-purple)] bg-[var(--aura-purple)] text-white" : "border-[var(--aura-border)] bg-white text-[var(--aura-heading)]"}`}
          >Yearly</button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu((open) => !open)}
              className="rounded-lg bg-[var(--aura-purple)] px-2.5 py-1 text-xs font-semibold text-white"
            >
              Export GST Report
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full z-10 mt-2 w-56 overflow-hidden rounded-xl border border-white/50 bg-white/80 text-left shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35">
                {exportOptions.map((option) => (
                  <button
                    key={option.format}
                    type="button"
                    onClick={() => selectExport(option.format)}
                    className="flex w-full items-start justify-between gap-3 border-b border-[var(--aura-border)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--aura-lavender)]/50"
                  >
                    <span>
                      <span className="block text-xs font-bold text-[var(--aura-heading)]">{option.label}</span>
                      <span className="block text-[10px] text-[var(--aura-muted)]">{option.detail}</span>
                    </span>
                    <span className="rounded-md bg-[var(--aura-lavender)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--aura-purple)]">{option.format}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 8 Genuine Supported Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
        {metrics.map(({ label, Icon, color, monthly, yearly }) => {
          const data = period === "monthly" ? monthly : yearly;
          const selected = activeMetric === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveMetric(label)}
              className={`rounded-xl border p-3.5 text-left backdrop-blur-sm transition-all ${selected ? "border-[var(--aura-purple)]/30 bg-white/40 shadow-md ring-1 ring-white/35" : "border-white/45 bg-white/25 hover:border-[var(--aura-purple)]/30 hover:bg-white/35"}`}
            >
              <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
                <Icon className={`h-3.5 w-3.5 ${color}`} />
              </div>
              <p className={`text-lg font-bold tabular-nums ${label === "Net Profit Est." ? "text-emerald-700" : "text-[var(--aura-heading)]"}`}>{data.value}</p>
              <span className={`text-[10px] ${data.note.includes("+") || data.note.includes("Margin") || data.note.includes("Controlled") ? "font-bold text-emerald-600" : "text-[var(--aura-muted)]"}`}>{data.note}</span>
            </button>
          );
        })}
      </div>

      {/* Metric Breakdown */}
      <div className="border-t border-[var(--aura-border)] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">{activeMetric} Breakdown</h4>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-[var(--aura-lavender)] px-2.5 py-1 text-[10px] font-bold text-[var(--aura-purple)]">{period === "monthly" ? "Monthly" : "Yearly"} view</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportDetails((open) => !open)}
                className="rounded-lg border border-[var(--aura-border)] bg-white px-2.5 py-1 text-[10px] font-semibold text-[var(--aura-muted)] transition-colors hover:border-[var(--aura-purple)]/30 hover:text-[var(--aura-purple)]"
              >
                {exportStatus}
              </button>
              {showExportDetails && (
                <div className="absolute right-0 top-full z-10 mt-2 w-60 rounded-xl border border-white/50 bg-white/80 p-3 text-left shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35">
                  <p className="text-xs font-bold text-[var(--aura-heading)]">Download ready</p>
                  <p className="mt-1 text-[10px] text-[var(--aura-muted)]">{period === "monthly" ? "Monthly" : "Yearly"} GST report prepared as {lastExportFormat}.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={downloadGstReport} className="rounded-lg bg-[var(--aura-purple)] px-2 py-1.5 text-[10px] font-bold text-white">Download</button>
                    <button type="button" onClick={previewGstReport} className="rounded-lg border border-[var(--aura-border)] px-2 py-1.5 text-[10px] font-bold text-[var(--aura-heading)]">Preview</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {activeData.rows.map(([name, value, detail], index) => (
            <div key={name} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs">
              <div className="min-w-0 sm:w-1/3">
                <p className="font-semibold text-[var(--aura-heading)] truncate">{name}</p>
                <p className="text-[10px] text-[var(--aura-muted)]">{detail}</p>
              </div>
              <div className="flex flex-1 items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-[var(--aura-lavender)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--aura-purple)]" style={{ width: `${85 - index * 22}%` }} />
                </div>
                <span className="font-bold text-[var(--aura-heading)] tabular-nums sm:w-24 text-right">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   SECTION 2: WHY AURA (6 CARDS)
   =================================================================== */
const WHY_AURA_CARDS = [
  {
    icon: Scissors,
    title: "Salon-first, not generic ERP",
    description: "Every flow is tuned for chair turns, stylist handoffs, service recipes, packages, memberships, and front-desk speed.",
    chips: ["Chair turns", "Recipes", "Front desk"],
  },
  {
    icon: Layers,
    title: "Appointments, billing, staff, stock. One flow.",
    description: "Online bookings, POS, attendance, commissions, inventory depletion, and reports stay connected without manual double-entry.",
    chips: ["Booking", "POS", "Inventory"],
  },
  {
    icon: IndianRupee,
    title: "Designed for Indian businesses",
    description: "GST-ready invoices, itemized tax splits, dynamic UPI QR at checkout, and WhatsApp reminders built into daily operations.",
    chips: ["GST", "UPI", "WhatsApp"],
  },
  {
    icon: Smartphone,
    title: "Simple enough for your team",
    description: "Clear, intuitive touch-friendly workflows that your receptionists and stylists can master in 15 minutes.",
    chips: ["Touch-ready", "15 min", "Staff friendly"],
  },
  {
    icon: Building,
    title: "Made to grow with you",
    description: "Effortlessly scale from an independent single-outlet boutique to multi-location chains with unified owner controls.",
    chips: ["1 to many", "Owner view", "Branches"],
  },
  {
    icon: BarChart3,
    title: "Know what is profitable, every day",
    description: "See margin, staff productivity, repeat visits, and customer lifetime value without waiting for month-end spreadsheets.",
    chips: ["Margin", "Repeat visits", "Live reports"],
  },
];

const WHY_AURA_STATS = [
  { value: "15 min", label: "team onboarding" },
  { value: "0%", label: "booking commission" },
  { value: "GST", label: "billing ready" },
  { value: "Multi", label: "branch controls" },
];

const ANALYTICS_CHIPS = ["Revenue pulse", "Staff occupancy", "Client retention", "Margin view"];

/* ===================================================================
   SECTION 3: ONE PLATFORM VISUAL (CUSTOM OPERATING SYSTEM DIAGRAM)
   =================================================================== */
const MODULES = [
  { name: "Appointments", icon: Calendar, pos: "left-[50%] top-[-1%] -translate-x-1/2 -translate-y-1/2" },
  { name: "GST Billing & UPI", icon: CreditCard, pos: "left-[89%] top-[21%] -translate-x-1/2 -translate-y-1/2" },
  { name: "Client CRM", icon: UserCheck, pos: "left-[101%] top-[50%] -translate-x-1/2 -translate-y-1/2" },
  { name: "Staff & Payroll", icon: Briefcase, pos: "left-[87%] top-[82%] -translate-x-1/2 -translate-y-1/2" },
  { name: "Inventory", icon: Boxes, pos: "left-[50%] top-[99%] -translate-x-1/2 -translate-y-1/2" },
  { name: "Memberships", icon: Crown, pos: "left-[13%] top-[82%] -translate-x-1/2 -translate-y-1/2" },
  { name: "Marketing AI", icon: Megaphone, pos: "left-[-1%] top-[50%] -translate-x-1/2 -translate-y-1/2" },
  { name: "Analytics", icon: LineChart, pos: "left-[11%] top-[21%] -translate-x-1/2 -translate-y-1/2" },
];

const PLATFORM_CHIPS = ["Auto inventory", "GST posted", "Commission ready", "Live owner view"];

function OnePlatformVisual() {
  return (
    <div className="relative mx-auto w-full max-w-3xl py-4 md:py-6 lg:translate-x-8 lg:max-w-none xl:translate-x-12">
      {/* Desktop Radial Visual */}
      <div className="relative hidden md:block aspect-[16/9] w-full overflow-visible">
        {/* Pulsing Concentric Rings */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none" aria-hidden="true">
          <div className="h-[78%] w-[72%] rounded-full border border-[var(--aura-purple)]/14 animate-[spin_60s_linear_infinite]" />
          <div className="absolute h-[54%] w-[58%] rounded-full border border-dashed border-[var(--aura-purple)]/26" />
          <div className="absolute h-[48%] w-[44%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.72),rgba(243,240,255,0.30)_52%,transparent_74%)] blur-xl" />
        </div>

        {/* Center Aura Hub */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="relative grid h-36 w-36 place-items-center rounded-[2.25rem] bg-[linear-gradient(135deg,#7B57EA,#5F3FD2)] text-white shadow-[0_22px_74px_rgba(118,81,216,0.44)] ring-1 ring-white/35 transition-transform hover:scale-105">
            <div className="absolute inset-0 rounded-[2.25rem] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.28),transparent_44%)]" aria-hidden="true" />
            <div className="text-center">
              <span className="relative font-bold text-[2.1rem] tracking-tight">AURA</span>
              <p className="relative mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/80">Salon OS</p>
            </div>
          </div>
        </div>

        {/* Satellite Module Nodes */}
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.name}
              className={`absolute z-10 ${mod.pos}`}
            >
              <div className="flex min-w-[10.5rem] items-center gap-3 rounded-[1.2rem] border border-white/60 bg-white/40 px-4 py-3 shadow-[0_18px_54px_rgba(109,63,209,0.14)] backdrop-blur-xl ring-1 ring-white/45 transition-all hover:border-[var(--aura-purple)]/40 hover:bg-white/55 hover:shadow-[0_26px_70px_rgba(109,63,209,0.20)] hover:-translate-y-0.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--aura-lavender)] text-[var(--aura-purple)]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="whitespace-nowrap text-[13px] font-bold text-[var(--aura-heading)]">{mod.name}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Grid Presentation */}
      <div className="md:hidden">
        <div className="mb-6 mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-[var(--aura-purple)] text-white shadow-lg text-center">
          <div>
            <span className="font-bold text-xl">AURA</span>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-white/80">Salon OS</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.name}
                className="flex items-center gap-2 rounded-xl border border-white/50 bg-white/30 p-3 shadow-[0_12px_32px_rgba(109,63,209,0.12)] backdrop-blur-md ring-1 ring-white/35"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--aura-lavender)] text-[var(--aura-purple)]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-semibold text-[var(--aura-heading)]">{mod.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   MAIN COMPONENT EXPORT
   =================================================================== */
export function AnalyticsAndPlatform() {
  const analyticsReveal = useReveal();
  const whyReveal = useReveal();
  const platformReveal = useReveal();

  return (
    <>
      {/* ── SECTION 1: ANALYTICS ── */}
      <section
        ref={analyticsReveal.ref}
        className="relative scroll-mt-24 overflow-hidden border-t border-white/70 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF] py-10 md:py-11"
      >
        <LandingDecor variant="warm" />
        <Container className="relative z-10">
          <div className="grid items-center gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-10">
            <div
              className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-xl lg:text-left"
              style={{
                opacity: analyticsReveal.visible ? 1 : 0,
                transform: analyticsReveal.visible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
              }}
            >
              <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-2">
                Real-Time Intelligence
              </span>
              <h2 className="text-[clamp(2.15rem,4.4vw,3.35rem)] font-bold leading-[1.02] tracking-[-0.04em] text-[var(--aura-heading)] text-balance">
                Know what's happening before you ask.
              </h2>
              <p className="mt-4 text-sm md:text-base leading-relaxed text-[var(--aura-body)] text-pretty">
                Get an instant, unified pulse on revenue, staff occupancy, client retention, and margin directly on your phone or desktop.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
                {ANALYTICS_CHIPS.map((chip) => (
                  <span key={chip} className="rounded-full border border-white/70 bg-white/45 px-3 py-1.5 text-[11px] font-bold text-[var(--aura-purple)] shadow-[0_10px_28px_rgba(109,63,209,0.10)] backdrop-blur-xl ring-1 ring-white/40">
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="min-w-0"
              style={{
                opacity: analyticsReveal.visible ? 1 : 0,
                transform: analyticsReveal.visible ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 0.6s ease-out 0.15s, transform 0.6s ease-out 0.15s",
              }}
            >
              <AnalyticsMockup />
            </div>
          </div>
        </Container>
      </section>

      {/* ── SECTION 2: WHY AURA (6 CARDS) ── */}
      <section
        ref={whyReveal.ref}
        className="relative scroll-mt-24 overflow-hidden border-t border-white/70 bg-[radial-gradient(circle_at_50%_0%,rgba(111,79,216,0.16),transparent_34%),linear-gradient(135deg,#FCFAFF_0%,#F6F1FF_48%,#ECE4FF_100%)] py-12 md:py-16"
      >
        <LandingDecor variant="soft" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-20 mx-auto h-40 max-w-5xl rounded-full bg-white/35 blur-3xl" />
        <Container className="relative z-10">
          <div
            className="mx-auto max-w-3xl text-center mb-7 md:mb-8"
            style={{
              opacity: whyReveal.visible ? 1 : 0,
              transform: whyReveal.visible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
            }}
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-2">
              The Aura Advantage
            </span>
            <h2 className="text-[clamp(2rem,4.2vw,3rem)] font-bold leading-[1.06] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              Why salons choose Aura
            </h2>
            <p className="mt-3 text-sm md:text-base leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
              Built for beauty teams that need faster counters, cleaner GST billing, commission clarity, and owner-level control without spreadsheet chaos.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {WHY_AURA_STATS.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/70 bg-white/45 px-3 py-2.5 shadow-[0_14px_40px_rgba(82,58,138,0.07)] backdrop-blur-xl ring-1 ring-white/45">
                  <p className="text-base font-black leading-none tracking-[-0.03em] text-[var(--aura-heading)]">{stat.value}</p>
                  <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--aura-muted)]">{stat.label}</p>
                </div>
              ))}
              <a href="/demo" className="inline-flex min-h-[3.625rem] items-center justify-center gap-1.5 rounded-2xl bg-[var(--aura-purple)] px-3 text-xs font-black text-white shadow-[0_14px_36px_rgba(111,79,216,0.24)] transition-all hover:-translate-y-0.5 hover:bg-[var(--aura-purple-hover)] sm:text-[13px]">
                Demo
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_AURA_CARDS.map((card, i) => {
              const Icon = card.icon;
              const featured = i === 0;
              return (
                <div
                  key={card.title}
                  className={`group relative min-h-[14.75rem] overflow-hidden rounded-[1.5rem] border p-5 shadow-[0_16px_52px_rgba(82,58,138,0.08)] backdrop-blur-xl ring-1 ring-white/50 transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--aura-purple)]/30 hover:shadow-[0_24px_72px_rgba(82,58,138,0.14)] md:p-6 ${featured ? "border-[var(--aura-purple)]/30 bg-white/68 shadow-[0_20px_72px_rgba(111,79,216,0.15)]" : "border-white/70 bg-white/42"}`}
                  style={{
                    opacity: whyReveal.visible ? 1 : 0,
                    transform: whyReveal.visible ? "translateY(0)" : "translateY(20px)",
                    transition: `opacity 0.5s ease-out ${0.1 + i * 0.05}s, transform 0.5s ease-out ${0.1 + i * 0.05}s`,
                  }}
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />
                  <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[var(--aura-purple)]/8 opacity-60 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="pointer-events-none absolute -bottom-16 left-8 h-28 w-40 rounded-full bg-white/40 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
                  {featured && (
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="inline-flex rounded-full bg-[var(--aura-purple)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-[0_12px_30px_rgba(111,79,216,0.24)]">
                        Best fit
                      </span>
                      <span className="h-px flex-1 bg-gradient-to-r from-[var(--aura-purple)]/25 to-transparent" />
                    </div>
                  )}
                  <div className="relative z-10 mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#F7F2FF,#ECE3FF)] text-[var(--aura-purple)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_28px_rgba(111,79,216,0.10)] ring-1 ring-[var(--aura-purple)]/10 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-[-2deg]">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </div>
                  <h3 className="relative z-10 text-base font-black text-[var(--aura-heading)] leading-snug tracking-[-0.02em] md:text-[1.05rem]">
                    {card.title}
                  </h3>
                  <p className="relative z-10 mt-2.5 text-sm leading-relaxed text-[var(--aura-body)]">
                    {card.description}
                  </p>
                  <div className="relative z-10 mt-4 flex flex-wrap gap-1.5">
                    {card.chips.map((chip) => (
                      <span key={chip} className="rounded-full border border-[var(--aura-purple)]/10 bg-[var(--aura-lavender)]/70 px-2.5 py-1 text-[10px] font-bold text-[var(--aura-purple)]">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

        </Container>
      </section>

      {/* ── SECTION 3: ONE CONNECTED PLATFORM VISUAL ── */}
      <section
        ref={platformReveal.ref}
        className="relative scroll-mt-24 overflow-hidden border-t border-white/70 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF] py-14 md:flex md:min-h-[calc(100svh-4.25rem)] md:items-center md:py-16"
      >
        <LandingDecor variant="warm" />
        <Container className="relative z-10">
          <div className="grid items-center gap-10 lg:grid-cols-[0.76fr_1.24fr] lg:gap-12 xl:gap-14">
            <div
              className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-xl lg:text-left"
              style={{
                opacity: platformReveal.visible ? 1 : 0,
                transform: platformReveal.visible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
              }}
            >
              <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-2">
                Unified Operating System
              </span>
              <h2 className="text-[clamp(2.35rem,4.8vw,3.75rem)] font-bold leading-[1.02] tracking-[-0.04em] text-[var(--aura-heading)] text-balance">
                One connected brain for your entire business
              </h2>
              <p className="mt-5 text-sm md:text-[1.05rem] leading-relaxed text-[var(--aura-body)] text-pretty">
                Every appointment updates inventory, calculates staff commissions, records GST, and feeds profit analytics automatically.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
                {PLATFORM_CHIPS.map((chip) => (
                  <span key={chip} className="rounded-full border border-white/70 bg-white/45 px-3 py-1.5 text-[11px] font-bold text-[var(--aura-purple)] shadow-[0_10px_28px_rgba(109,63,209,0.10)] backdrop-blur-xl ring-1 ring-white/40">
                    {chip}
                  </span>
                ))}
              </div>
              <a href="/demo" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] px-5 text-sm font-bold text-white shadow-[0_14px_36px_rgba(111,79,216,0.24)] transition-all hover:-translate-y-0.5 hover:bg-[var(--aura-purple-hover)]">
                See connected workflow
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div
              className="min-w-0"
              style={{
                opacity: platformReveal.visible ? 1 : 0,
                transform: platformReveal.visible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.6s ease-out 0.15s, transform 0.6s ease-out 0.15s",
              }}
            >
              <OnePlatformVisual />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
