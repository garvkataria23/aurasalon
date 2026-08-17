"use client";

import { useState } from "react";
import { Receipt, Plus, Trash2, CheckCircle2, ShieldCheck, Printer, ArrowRight, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";

type ServiceItem = {
  id: string;
  name: string;
  category: string;
  price: number;
};

const AVAILABLE_SERVICES: ServiceItem[] = [
  { id: "s1", name: "Stylist Haircut & Blowdry", category: "Hair", price: 1200 },
  { id: "s2", name: "Keratin Gloss Spa Treatment", category: "Hair", price: 2800 },
  { id: "s3", name: "Olaplex Hair Repair Add-on", category: "Add-on", price: 1500 },
  { id: "s4", name: "Radiance Facial Spa", category: "Skin", price: 2200 },
  { id: "s5", name: "Beard Trim & Hot Towel", category: "Grooming", price: 600 },
];

export function POSSandbox() {
  const [cart, setCart] = useState<ServiceItem[]>([AVAILABLE_SERVICES[0], AVAILABLE_SERVICES[1]]);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [printed, setPrinted] = useState(false);

  const addItem = (item: ServiceItem) => {
    setCart((prev) => [...prev, item]);
    setPrinted(false);
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
    setPrinted(false);
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price, 0);
  const gstAmount = gstEnabled ? Math.round(subtotal * 0.18) : 0;
  const total = subtotal + gstAmount;

  return (
    <section className="bg-[var(--aura-off-white)] py-20 md:py-28 overflow-hidden border-t border-[var(--aura-border)]">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[.45fr_.55fr] lg:items-center">
          {/* Left Info */}
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              Interactive POS Sandbox
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              Test express billing live right now.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[var(--aura-body)]">
              Designed for fast-moving front desks. Add services, toggle GST calculation, and simulate instant digital receipt generation.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-xl border border-[var(--aura-border)] bg-white p-4 flex items-center gap-3 shadow-xs">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--aura-lavender)] text-[var(--aura-purple)] font-bold text-xs">
                  ⚡
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--aura-heading)]">Instant WhatsApp + Print Receipt</h4>
                  <p className="text-[11px] text-[var(--aura-body)]">Auto-sends digital bills to client WhatsApp while printing thermal paper receipts.</p>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--aura-border)] bg-white p-4 flex items-center gap-3 shadow-xs">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">
                  ₹
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--aura-heading)]">Split Payments &amp; Dual QR Code</h4>
                  <p className="text-[11px] text-[var(--aura-body)]">Accept Cash, UPI, Credit Cards, and Loyalty Points in a single bill transaction.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Live Clickable POS Sandbox UI */}
          <div className="overflow-hidden rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-lg)] p-5 md:p-6">
            <div className="flex items-center justify-between border-b border-[var(--aura-border)] pb-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-[var(--aura-purple)]" />
                <span className="text-base font-bold text-[var(--aura-heading)]">Express Front Desk Terminal</span>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-[var(--aura-heading)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={gstEnabled}
                  onChange={(e) => setGstEnabled(e.target.checked)}
                  className="rounded border-[var(--aura-border)] text-[var(--aura-purple)] focus:ring-[var(--aura-purple)]"
                />
                <span>GST (18%)</span>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {/* Service Catalog Picker */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--aura-muted)] mb-2">Tap to Add Service</p>
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {AVAILABLE_SERVICES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className="w-full flex items-center justify-between rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-3 text-left transition-all hover:border-[var(--aura-purple)] hover:bg-white shadow-xs"
                    >
                      <div>
                        <p className="text-xs font-bold text-[var(--aura-heading)]">{item.name}</p>
                        <p className="text-[10px] text-[var(--aura-muted)]">{item.category}</p>
                      </div>
                      <span className="text-xs font-bold text-[var(--aura-purple)] flex items-center gap-1">
                        +₹{item.price}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cart & Billing Summary */}
              <div className="flex flex-col justify-between rounded-xl bg-[var(--aura-off-white)] border border-[var(--aura-border)] p-4 shadow-xs">
                <div>
                  <div className="flex items-center justify-between border-b border-[var(--aura-border)] pb-2 mb-3">
                    <span className="text-xs font-bold text-[var(--aura-heading)]">Customer Bill</span>
                    <span className="text-[10px] text-[var(--aura-muted)]">{cart.length} items</span>
                  </div>

                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                    {cart.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} className="flex items-center justify-between text-xs">
                        <span className="truncate pr-2 text-[var(--aura-heading)] font-medium">{item.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-[var(--aura-heading)]">₹{item.price}</span>
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-red-500 hover:text-red-700"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--aura-border)] space-y-1.5 text-xs">
                  <div className="flex justify-between text-[var(--aura-body)]">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[var(--aura-heading)]">₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  {gstEnabled && (
                    <div className="flex justify-between text-[var(--aura-body)]">
                      <span>GST (18%)</span>
                      <span className="font-semibold text-[var(--aura-heading)]">₹{gstAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-[var(--aura-heading)] pt-1 border-t border-[var(--aura-border)]">
                    <span>Total</span>
                    <span className="text-[var(--aura-purple)]">₹{total.toLocaleString("en-IN")}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPrinted(true)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[var(--aura-purple-hover)]"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>{printed ? "Invoice Generated & WhatsApp Sent!" : "Complete Bill (Generate & Print)"}</span>
                  </button>

                  {printed && (
                    <p className="text-[10px] text-emerald-700 font-semibold text-center flex items-center justify-center gap-1 mt-1">
                      <CheckCircle2 className="h-3 w-3" /> Digital invoice sent to client WhatsApp
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
