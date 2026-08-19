"use client";

import { Printer, ScanBarcode, Wallet } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { LandingDecor } from "./LandingDecor";

const HARDWARE = [
  {
    icon: Printer,
    title: "Thermal Printer",
    description: "Auto-print GST invoices at checkout",
  },
  {
    icon: ScanBarcode,
    title: "Barcode Scanner",
    description: "Scan products for instant billing",
  },
  {
    icon: Wallet,
    title: "Cash Drawer",
    description: "Integrated with POS for cash management",
  },
];

export function HardwareShowcase() {
  return (
    <section className="relative bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF] py-20 md:py-28 overflow-hidden">
      <LandingDecor variant="quiet" />
      <Container className="relative z-10">
        <div className="mx-auto max-w-3xl text-center mb-16 reveal">
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Works with hardware you already have
          </h2>
        </div>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-3">
          {HARDWARE.map((device, idx) => {
            const Icon = device.icon;
            return (
              <div
                key={idx}
                className={`reveal stagger-${idx + 1} rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-6 shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:shadow-[var(--aura-shadow-md)] flex flex-col items-center text-center`}
              >
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--aura-lavender)] text-[var(--aura-purple)] mb-4">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--aura-heading)]">{device.title}</h3>
                <p className="text-sm text-[var(--aura-body)] mt-2 leading-relaxed">{device.description}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
