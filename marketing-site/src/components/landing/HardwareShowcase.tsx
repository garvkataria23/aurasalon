"use client";

import { Printer, Scan, Smartphone, Monitor, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";

type Device = {
  name: string;
  type: string;
  specs: string;
  icon: typeof Printer;
};

const HARDWARE: Device[] = [
  { name: "Thermal Receipt Printers", type: "USB / Bluetooth / LAN", specs: "Works with standard 80mm & 58mm POS thermal printers (Epson, TVS, Star).", icon: Printer },
  { name: "Barcode & QR Scanners", type: "Wireless 1D/2D", specs: "Instant retail product lookup and client QR membership scan at the counter.", icon: Scan },
  { name: "Mobile & Tablet POS", type: "Android / iPad / iOS", specs: "Full floor app access for stylists to take notes, add services, and clock in.", icon: Smartphone },
  { name: "Desktop & All-in-One POS", type: "Windows / Mac / Web", specs: "Zero driver installation needed — opens smoothly in Chrome, Safari, or Edge.", icon: Monitor },
];

export function HardwareShowcase() {
  return (
    <section className="bg-white py-20 md:py-28 overflow-hidden border-t border-[var(--aura-border)]">
      <Container>
        <div className="mx-auto max-w-3xl text-center mb-12">
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            Hardware Plug &amp; Play
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Works with your existing salon devices
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
            No expensive proprietary hardware lock-in. Aura connects seamlessly with standard thermal printers, barcode scanners, and tablets.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HARDWARE.map((device, idx) => {
            const Icon = device.icon;
            return (
              <div
                key={idx}
                className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-6 transition-all duration-300 hover:shadow-[var(--aura-shadow-md)] hover:border-[var(--aura-purple)]/30 flex flex-col justify-between"
              >
                <div>
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-white border border-[var(--aura-border)] text-[var(--aura-purple)] mb-4 shadow-xs">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--aura-purple)]">{device.type}</span>
                  <h3 className="text-base font-bold text-[var(--aura-heading)] mt-1">{device.name}</h3>
                  <p className="text-xs text-[var(--aura-body)] mt-2 leading-relaxed">{device.specs}</p>
                </div>
                <div className="mt-6 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 border-t border-[var(--aura-border)] pt-3">
                  <CheckCircle2 className="h-3.5 w-3.5" /> No proprietary lock-in
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
