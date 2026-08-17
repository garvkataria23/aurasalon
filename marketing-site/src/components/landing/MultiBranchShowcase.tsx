"use client";

import { useState } from "react";
import { Building2, TrendingUp, Users, Package, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";

type BranchData = {
  id: string;
  name: string;
  city: string;
  todayRevenue: string;
  appointments: number;
  activeStaff: number;
  stockStatus: string;
};

const BRANCHES: BranchData[] = [
  { id: "b1", name: "Bandra West Flagship", city: "Mumbai", todayRevenue: "₹1,48,200", appointments: 42, activeStaff: 12, stockStatus: "Optimal (98%)" },
  { id: "b2", name: "Indiranagar Salon & Spa", city: "Bengaluru", todayRevenue: "₹1,12,500", appointments: 36, activeStaff: 9, stockStatus: "Optimal (95%)" },
  { id: "b3", name: "Jubilee Hills Luxury", city: "Hyderabad", todayRevenue: "₹1,85,400", appointments: 51, activeStaff: 15, stockStatus: "Low Stock Alert (3 items)" },
  { id: "b4", name: "Connaught Place Central", city: "New Delhi", todayRevenue: "₹1,24,000", appointments: 38, activeStaff: 10, stockStatus: "Optimal (97%)" },
];

export function MultiBranchShowcase() {
  const [selectedBranch, setSelectedBranch] = useState<BranchData>(BRANCHES[0]);

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
          {BRANCHES.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => setSelectedBranch(branch)}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold transition-all ${
                selectedBranch.id === branch.id
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--aura-purple)]">Active Branch View</span>
              <h3 className="text-xl font-bold text-[var(--aura-heading)]">{selectedBranch.name}</h3>
              <p className="text-xs text-[var(--aura-muted)]">{selectedBranch.city} &bull; Live Telemetry</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Connected
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
              <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
                <span className="text-xs font-medium">Today's Sales</span>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-[var(--aura-heading)]">{selectedBranch.todayRevenue}</p>
            </div>

            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
              <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
                <span className="text-xs font-medium">Appointments</span>
                <Users className="h-4 w-4 text-[var(--aura-purple)]" />
              </div>
              <p className="text-lg font-bold text-[var(--aura-heading)]">{selectedBranch.appointments} bookings</p>
            </div>

            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
              <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
                <span className="text-xs font-medium">Staff on Floor</span>
                <Users className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-lg font-bold text-[var(--aura-heading)]">{selectedBranch.activeStaff} stylists</p>
            </div>

            <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
              <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
                <span className="text-xs font-medium">Stock Status</span>
                <Package className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-xs font-bold text-[var(--aura-heading)] truncate">{selectedBranch.stockStatus}</p>
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
