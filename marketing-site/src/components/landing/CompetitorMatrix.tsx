"use client";

import { Check, X, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

type FeatureRow = {
  name: string;
  aura: boolean | string;
  legacy: boolean | string;
  paper: boolean | string;
};

const COMPARISON_DATA: FeatureRow[] = [
  { name: "Indian GST Billing (18% CGST/SGST)", aura: true, legacy: "Extra Paid Add-on", paper: false },
  { name: "24/7 WhatsApp AI Booking Assistant", aura: true, legacy: false, paper: false },
  { name: "3-Tier Ecosystem (Owner POS + Customer App + Staff App)", aura: true, legacy: false, paper: false },
  { name: "WMA Inventory Recipe Costing (Grams per Service)", aura: true, legacy: "Enterprise Tier Only", paper: false },
  { name: "Realtime Mobile Staff Attendance & Tip Sync", aura: true, legacy: false, paper: false },
  { name: "Zero Platform Booking Commission Fee", aura: true, legacy: "15-20% per booking", paper: true },
  { name: "Multi-Branch IST Realtime Aggregation", aura: true, legacy: true, paper: false },
];

export function CompetitorMatrix() {
  return (
    <section className="bg-aura-bg py-20 text-aura-text md:py-28 overflow-hidden">
      <Container>
        <SectionHeading
          badge="Why Salons Choose Aura"
          title="Designed Specifically for Indian Salons"
          subtitle="Stop paying heavy commissions to legacy software. Aura gives you total control with zero commission fees."
          align="center"
          className="[&_h2]:text-aura-text [&_p]:text-aura-text-muted [&>span]:text-aura-primary"
        />

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-aura-border text-aura-text-muted uppercase tracking-wider">
                <th className="py-4 px-4 font-bold">Platform Feature</th>
                <th className="py-4 px-4 font-bold text-aura-primary bg-aura-surface rounded-t-xl">
                  <div className="flex items-center gap-1.5 text-sm text-aura-text">
                    <Sparkles className="h-4 w-4 text-aura-primary" /> Aura Salon OS
                  </div>
                </th>
                <th className="py-4 px-4 font-bold">Legacy Foreign Software</th>
                <th className="py-4 px-4 font-bold">Paper / Registers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aura-border">
              {COMPARISON_DATA.map((row, idx) => (
                <tr key={idx} className="hover:bg-aura-surface transition-colors">
                  <td className="py-4 px-4 font-semibold text-aura-text">{row.name}</td>
                  <td className="py-4 px-4 bg-aura-surface font-bold text-emerald-600">
                    {typeof row.aura === "boolean" ? (
                      row.aura ? <Check className="h-5 w-5 text-emerald-600" /> : <X className="h-5 w-5 text-red-400" />
                    ) : (
                      row.aura
                    )}
                  </td>
                  <td className="py-4 px-4 text-aura-text-secondary">
                    {typeof row.legacy === "boolean" ? (
                      row.legacy ? <Check className="h-4 w-4 text-aura-text-secondary" /> : <X className="h-4 w-4 text-red-400" />
                    ) : (
                      row.legacy
                    )}
                  </td>
                  <td className="py-4 px-4 text-aura-text-muted">
                    {typeof row.paper === "boolean" ? (
                      row.paper ? <Check className="h-4 w-4 text-aura-text-muted" /> : <X className="h-4 w-4 text-red-400" />
                    ) : (
                      row.paper
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}
