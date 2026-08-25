"use client";

import { useState } from "react";
import { PhoneCall, CheckCircle2, Send } from "lucide-react";
import { Container } from "@/components/ui/Container";

export function LeadCallbackSection() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    city: "",
    mobileNo: "",
    businessName: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  };

  return (
    <section className="relative bg-[#FCFBF8] py-20 md:py-28 overflow-hidden border-t border-[var(--aura-border)]">
      <Container className="relative z-10">
        
        <div className="mx-auto max-w-4xl rounded-3xl border border-[var(--aura-border)] bg-white p-8 sm:p-12 md:p-14 shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
          
          <div className="mx-auto max-w-2xl text-center mb-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--aura-lavender)] px-3.5 py-1 text-xs font-bold text-[var(--aura-purple)] mb-3">
              <PhoneCall className="h-3.5 w-3.5" /> Instant Salon Consultation
            </span>
            <h2 className="text-[clamp(2rem,4.2vw,3.2rem)] font-extrabold tracking-[-0.03em] text-[var(--aura-heading)] leading-tight">
              Arrange A Quick Call Back
            </h2>
            <p className="mt-2 text-base font-semibold text-[var(--aura-purple)]">
              No spam, No pressure, Only Solutions Made for YOU!!
            </p>
            <p className="mt-2 text-xs sm:text-sm text-[var(--aura-body)]">
              Talk directly with an experienced salon operations specialist who understands your city and business scale.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-emerald-900">Request Received!</h3>
              <p className="mt-2 text-sm text-emerald-700 max-w-md mx-auto">
                Thank you, {formData.fullName}. Our salon specialist will call you at {formData.mobileNo} within 15 minutes.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="lead-full-name" className="block text-xs font-bold text-[var(--aura-heading)] mb-1.5">
                    Full Name *
                  </label>
                  <input
                    id="lead-full-name"
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Ramesh Sharma"
                    className="w-full rounded-xl border border-[var(--aura-border)] bg-[#FCFBF8] px-4 py-3 text-sm font-medium text-[var(--aura-heading)] outline-none focus:border-[var(--aura-purple)] focus:bg-white focus:ring-4 focus:ring-[var(--aura-purple)]/10"
                  />
                </div>

                <div>
                  <label htmlFor="lead-email" className="block text-xs font-bold text-[var(--aura-heading)] mb-1.5">
                    Email Address *
                  </label>
                  <input
                    id="lead-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. ramesh@glowsalon.com"
                    className="w-full rounded-xl border border-[var(--aura-border)] bg-[#FCFBF8] px-4 py-3 text-sm font-medium text-[var(--aura-heading)] outline-none focus:border-[var(--aura-purple)] focus:bg-white focus:ring-4 focus:ring-[var(--aura-purple)]/10"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="lead-city" className="block text-xs font-bold text-[var(--aura-heading)] mb-1.5">
                    City *
                  </label>
                  <input
                    id="lead-city"
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Mumbai, Bengaluru"
                    className="w-full rounded-xl border border-[var(--aura-border)] bg-[#FCFBF8] px-4 py-3 text-sm font-medium text-[var(--aura-heading)] outline-none focus:border-[var(--aura-purple)] focus:bg-white focus:ring-4 focus:ring-[var(--aura-purple)]/10"
                  />
                </div>

                <div>
                  <label htmlFor="lead-mobile" className="block text-xs font-bold text-[var(--aura-heading)] mb-1.5">
                    Mobile Number *
                  </label>
                  <input
                    id="lead-mobile"
                    type="tel"
                    required
                    value={formData.mobileNo}
                    onChange={(e) => setFormData({ ...formData, mobileNo: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full rounded-xl border border-[var(--aura-border)] bg-[#FCFBF8] px-4 py-3 text-sm font-medium text-[var(--aura-heading)] outline-none focus:border-[var(--aura-purple)] focus:bg-white focus:ring-4 focus:ring-[var(--aura-purple)]/10"
                  />
                </div>

                <div>
                  <label htmlFor="lead-business-name" className="block text-xs font-bold text-[var(--aura-heading)] mb-1.5">
                    Business / Salon Name *
                  </label>
                  <input
                    id="lead-business-name"
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="e.g. Glow Studio &amp; Spa"
                    className="w-full rounded-xl border border-[var(--aura-border)] bg-[#FCFBF8] px-4 py-3 text-sm font-medium text-[var(--aura-heading)] outline-none focus:border-[var(--aura-purple)] focus:bg-white focus:ring-4 focus:ring-[var(--aura-purple)]/10"
                  />
                </div>
              </div>

              <div className="pt-4 text-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[var(--aura-purple)] px-10 py-4 text-base font-bold text-white shadow-md transition-all duration-300 hover:bg-[var(--aura-purple-hover)] hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Processing..." : "Arrange a call back"}
                  <Send className="h-4 w-4" />
                </button>
              </div>

              <p className="text-center text-xs text-[var(--aura-body)] pt-2">
                🔒 Your contact details are 100% confidential. No spam, guaranteed.
              </p>
            </form>
          )}

        </div>

      </Container>
    </section>
  );
}
