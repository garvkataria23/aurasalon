"use client";

import { useState } from "react";
import { Receipt, Plus, Trash2, CheckCircle2, ShieldCheck, Printer, ArrowRight, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { LandingDecor } from "./LandingDecor";

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
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [discount, setDiscount] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);

  const addItem = (item: ServiceItem) => {
    setCart((prev) => [...prev, item]);
    setPrinted(false);
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
    setPrinted(false);
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price, 0);
  const discountAmount = Math.round(subtotal * (discount / 100));
  const taxableTotal = Math.max(0, subtotal - discountAmount);
  const gstAmount = gstEnabled ? Math.round(taxableTotal * 0.18) : 0;
  const total = taxableTotal + gstAmount;

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF] py-24 md:py-32">
      <LandingDecor variant="soft" />
      <Container className="relative z-10">
        <div className="grid gap-12 lg:grid-cols-[.45fr_.55fr] lg:items-center">
          {/* Left Info */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/15 bg-white/65 px-3.5 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 backdrop-blur-sm shadow-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Interactive Sandbox
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              Test express billing live right now.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[var(--aura-body)]">
              Designed for fast-moving front desks. Add services, toggle GST calculation, and simulate instant digital receipt generation.
            </p>

            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={() => { setPrinted(true); setShowReceipt(true); }}
                className={`w-full rounded-xl border p-4 flex items-center gap-3 text-left shadow-xs backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-md ${showReceipt ? "border-[var(--aura-purple)]/25 bg-white/65 ring-1 ring-white/45" : "border-white/65 bg-white/35 hover:bg-white/60"}`}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--aura-lavender)] text-[var(--aura-purple)] font-bold text-xs">
                  ⚡
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--aura-heading)]">Instant WhatsApp + Print Receipt</h4>
                  <p className="text-[11px] text-[var(--aura-body)]">Auto-sends digital bills to client WhatsApp while printing thermal paper receipts.</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setPaymentMode("Split"); setPrinted(false); }}
                className={`w-full rounded-xl border p-4 flex items-center gap-3 text-left shadow-xs backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-md ${paymentMode === "Split" ? "border-emerald-200 bg-emerald-50/80" : "border-white/65 bg-white/35 hover:bg-white/60"}`}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs">
                  ₹
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--aura-heading)]">Split Payments &amp; Dual QR Code</h4>
                  <p className="text-[11px] text-[var(--aura-body)]">Accept Cash, UPI, Credit Cards, and Loyalty Points in a single bill transaction.</p>
                </div>
              </button>
            </div>
          </div>

          {/* Right Live Clickable POS Sandbox UI */}
          <div className="shadow-breathe overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/60 p-5 backdrop-blur-xl ring-1 ring-white/50 md:p-6">
            <div className="flex items-center justify-between border-b border-white/45 pb-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-[var(--aura-purple)]" />
                <div>
                  <span className="text-base font-bold text-[var(--aura-heading)]">Express Front Desk Terminal</span>
                  <p className="text-[10px] text-[var(--aura-muted)]">Walk-in customer · Gold member preview</p>
                </div>
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
                      className="w-full flex items-center justify-between rounded-xl border border-white/45 bg-white/25 p-3 text-left shadow-xs backdrop-blur-sm transition-all hover:border-[var(--aura-purple)]/40 hover:bg-white/40"
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
                <div className="mt-3 rounded-xl border border-white/45 bg-white/25 p-3 backdrop-blur-sm">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--aura-muted)]">Payment Mode</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {["UPI", "Cash", "Card", "Split"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => { setPaymentMode(mode); setPrinted(false); }}
                        className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors ${paymentMode === mode ? "border-[var(--aura-purple)] bg-[var(--aura-purple)] text-white" : "border-[var(--aura-border)] bg-white text-[var(--aura-heading)] hover:bg-[var(--aura-lavender)]"}`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cart & Billing Summary */}
              <div className="flex flex-col justify-between rounded-xl bg-white/25 border border-white/45 p-4 shadow-xs backdrop-blur-sm">
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
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {[0, 10, 15].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => { setDiscount(value); setPrinted(false); }}
                        className={`rounded-md px-2 py-1 text-[10px] font-bold ${discount === value ? "bg-[var(--aura-purple)] text-white" : "bg-white text-[var(--aura-purple)] ring-1 ring-[var(--aura-border)]"}`}
                      >
                        {value === 0 ? "No discount" : `${value}% off`}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-[var(--aura-body)]">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[var(--aura-heading)]">₹{subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount ({discount}%)</span>
                      <span className="font-semibold">-₹{discountAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
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
                    onClick={() => { setPrinted(true); setShowReceipt(true); }}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[var(--aura-purple-hover)]"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>{printed ? "Invoice Generated & WhatsApp Sent!" : "Complete Bill (Generate & Print)"}</span>
                  </button>

                  {printed && (
                    <p className="text-[10px] text-emerald-700 font-semibold text-center flex items-center justify-center gap-1 mt-1">
                      <CheckCircle2 className="h-3 w-3" /> {paymentMode} payment captured · invoice sent to WhatsApp
                    </p>
                  )}
                </div>
              </div>
            </div>

            {showReceipt && (
              <div className="mt-4 rounded-xl border border-white/45 bg-white/25 p-4 backdrop-blur-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[var(--aura-heading)]">Receipt Preview</p>
                    <p className="text-[10px] text-[var(--aura-muted)]">INV-AUR-2084 · {paymentMode} · WhatsApp queued</p>
                  </div>
                  <button type="button" onClick={() => setShowReceipt(false)} className="rounded-lg border border-[var(--aura-border)] bg-white px-2 py-1 text-[10px] font-bold text-[var(--aura-muted)]">Close</button>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-lg bg-white/35 p-2 backdrop-blur-sm">
                    <p className="text-[10px] text-[var(--aura-muted)]">Amount Paid</p>
                    <p className="font-bold text-[var(--aura-heading)]">₹{total.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="rounded-lg bg-white/35 p-2 backdrop-blur-sm">
                    <p className="text-[10px] text-[var(--aura-muted)]">GST</p>
                    <p className="font-bold text-[var(--aura-heading)]">₹{gstAmount.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="rounded-lg bg-white/35 p-2 backdrop-blur-sm">
                    <p className="text-[10px] text-[var(--aura-muted)]">Discount</p>
                    <p className="font-bold text-[var(--aura-heading)]">₹{discountAmount.toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
