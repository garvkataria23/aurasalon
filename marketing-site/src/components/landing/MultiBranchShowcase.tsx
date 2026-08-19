"use client";

import { useState } from "react";
import { Building2, TrendingUp, Users, Package, ArrowUpRight, CheckCircle2, Repeat, BarChart3, AlertTriangle } from "lucide-react";
import { Container } from "@/components/ui/Container";

type BranchData = {
  id: string;
  name: string;
  city: string;
  todayRevenue: string;
  appointments: number;
  activeStaff: number;
  stockStatus: string;
  utilization: number;
};

const BRANCHES: BranchData[] = [
  { id: "b1", name: "Bandra West Flagship", city: "Mumbai", todayRevenue: "₹1,48,200", appointments: 42, activeStaff: 12, stockStatus: "Optimal (98%)", utilization: 94 },
  { id: "b2", name: "Indiranagar Salon & Spa", city: "Bengaluru", todayRevenue: "₹1,12,500", appointments: 36, activeStaff: 9, stockStatus: "Optimal (95%)", utilization: 88 },
  { id: "b3", name: "Jubilee Hills Luxury", city: "Hyderabad", todayRevenue: "₹1,85,400", appointments: 51, activeStaff: 15, stockStatus: "Low Stock Alert (3 items)", utilization: 97 },
  { id: "b4", name: "Connaught Place Central", city: "New Delhi", todayRevenue: "₹1,24,000", appointments: 38, activeStaff: 10, stockStatus: "Optimal (97%)", utilization: 90 },
];

export function MultiBranchShowcase() {
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [period, setPeriod] = useState<"Today" | "Month" | "Year">("Today");
  const selectedBranch = BRANCHES.find((branch) => branch.id === selectedBranchId) ?? BRANCHES[0];
  const isAllBranches = selectedBranchId === "all";
  const totalRevenue = BRANCHES.reduce((sum, branch) => sum + Number(branch.todayRevenue.replace(/[^0-9]/g, "")), 0);
  const totalAppointments = BRANCHES.reduce((sum, branch) => sum + branch.appointments, 0);
  const totalStaff = BRANCHES.reduce((sum, branch) => sum + branch.activeStaff, 0);
  const avgUtilization = Math.round(BRANCHES.reduce((sum, branch) => sum + branch.utilization, 0) / BRANCHES.length);
  const periodMultiplier = period === "Today" ? 1 : period === "Month" ? 22 : 264;
  const formatRevenue = (amount: number) => `₹${(amount * periodMultiplier).toLocaleString("en-IN")}`;
  const alerts = [
    "Hyderabad: 3 low-stock SKUs need transfer",
    "Bengaluru: 2 stylists can support weekend overflow",
    "Mumbai: revenue +18% vs last comparable period",
  ];

  return (
    <section className="bg-[var(--aura-off-white)] py-20 md:py-28 overflow-hidden border-t border-[var(--aura-border)]">
      <Container>
        <div className="mx-auto max-w-3xl text-center mb-10">
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            Multi-Location Scale
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Manage 1 or 50+ salon branches from one screen.
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
            Real-time multi-location sales aggregation, staff transfer, cross-branch booking, and centralized inventory control.
          </p>
        </div>

        {/* Branch Pills Switcher */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            type="button"
            onClick={() => setSelectedBranchId("all")}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold transition-all ${
              isAllBranches
                ? "bg-[var(--aura-purple)] text-white shadow-xs"
                : "border border-[var(--aura-border)] bg-white text-[var(--aura-heading)] hover:bg-[var(--aura-lavender)]"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>All Branches Overview</span>
          </button>
          {BRANCHES.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => setSelectedBranchId(branch.id)}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold transition-all ${
                selectedBranchId === branch.id
                  ? "bg-[var(--aura-purple)] text-white shadow-xs"
                  : "border border-[var(--aura-border)] bg-white text-[var(--aura-heading)] hover:bg-[var(--aura-lavender)]"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>{branch.name} ({branch.city})</span>
            </button>
          ))}
        </div>

        {/* Interactive Stats Dashboard Card */}
        <div className="mx-auto max-w-4xl rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-6 md:p-8 shadow-[var(--aura-shadow-lg)]">
          <div className="flex flex-wrap items-center justify-between border-b border-[var(--aura-border)] pb-4 gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--aura-purple)]">{isAllBranches ? "Owner Control Center" : "Active Branch View"}</span>
              <h3 className="text-xl font-bold text-[var(--aura-heading)]">{isAllBranches ? "All Branches Overview" : selectedBranch.name}</h3>
              <p className="text-xs text-[var(--aura-muted)]">{isAllBranches ? `${BRANCHES.length} locations synced` : selectedBranch.city} &bull; {period} telemetry</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {["Today", "Month", "Year"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value as typeof period)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${period === value ? "bg-[var(--aura-purple)] text-white" : "border border-[var(--aura-border)] bg-white text-[var(--aura-heading)]"}`}
                >
                  {value}
                </button>
              ))}
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Connected
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
              <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
                <span className="text-xs font-medium">{period} Sales</span>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-[var(--aura-heading)]">{isAllBranches ? formatRevenue(totalRevenue) : formatRevenue(Number(selectedBranch.todayRevenue.replace(/[^0-9]/g, "")))}</p>
            </div>

            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
              <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
                <span className="text-xs font-medium">Appointments</span>
                <Users className="h-4 w-4 text-[var(--aura-purple)]" />
              </div>
              <p className="text-lg font-bold text-[var(--aura-heading)]">{(isAllBranches ? totalAppointments : selectedBranch.appointments) * periodMultiplier} bookings</p>
            </div>

            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
              <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
                <span className="text-xs font-medium">Staff on Floor</span>
                <Users className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-lg font-bold text-[var(--aura-heading)]">{isAllBranches ? totalStaff : selectedBranch.activeStaff} stylists</p>
            </div>

            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
              <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
                <span className="text-xs font-medium">Stock Status</span>
                <Package className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-[var(--aura-heading)] truncate">{isAllBranches ? "1 alert · 97% healthy" : selectedBranch.stockStatus}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">Branch Comparison</h4>
                <span className="text-[10px] font-bold text-[var(--aura-purple)]">{avgUtilization}% avg utilisation</span>
              </div>
              <div className="space-y-2">
                {BRANCHES.map((branch) => (
                  <button key={branch.id} type="button" onClick={() => setSelectedBranchId(branch.id)} className="flex w-full items-center gap-3 rounded-lg bg-white px-3 py-2 text-left hover:bg-[var(--aura-lavender)]/50">
                    <span className={`h-2.5 w-2.5 rounded-full ${branch.stockStatus.includes("Low") ? "bg-amber-500" : "bg-emerald-500"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[var(--aura-heading)]">{branch.city}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--aura-lavender)]">
                        <div className="h-full rounded-full bg-[var(--aura-purple)]" style={{ width: `${branch.utilization}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[var(--aura-heading)]">{branch.utilization}%</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--aura-border)] bg-white p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">Owner Actions</h4>
              <div className="grid gap-2">
                {[{ icon: Repeat, label: "Transfer stock" }, { icon: Users, label: "Move staff" }, { icon: BarChart3, label: "View P&L" }, { icon: ArrowUpRight, label: "Open branch" }].map(({ icon: Icon, label }) => (
                  <button key={label} type="button" className="flex items-center justify-between rounded-lg border border-[var(--aura-border)] px-3 py-2 text-xs font-bold text-[var(--aura-heading)] hover:border-[var(--aura-purple)]/30 hover:bg-[var(--aura-lavender)]/50">
                    <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-[var(--aura-purple)]" />{label}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-amber-800">
              <AlertTriangle className="h-4 w-4" /> Live owner alerts
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {alerts.map((alert) => (
                <div key={alert} className="rounded-lg bg-white px-3 py-2 text-[11px] font-medium text-[var(--aura-body)] shadow-xs">{alert}</div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-[var(--aura-border)] pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--aura-muted)]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[var(--aura-purple)]" />
              Cross-branch customer history syncs automatically in real-time
            </span>
            <span className="font-semibold text-[var(--aura-purple)]">Consolidated P&amp;L Enabled</span>
          </div>
        </div>
      </Container>
    </section>
  );
}
