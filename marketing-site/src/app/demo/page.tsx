"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Calendar, Clock, User, Building2, CheckCircle, ArrowRight, Phone } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GridBackground } from "@/components/ui/GridBackground";

const TIME_SLOTS = [
  "10:00 AM", "11:00 AM", "12:00 PM",
  "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
];

const BENEFITS = [
  "15-minute personalized walkthrough",
  "See features relevant to your salon size",
  "Get your questions answered live",
  "Special launch pricing for demo attendees",
];

export default function DemoPage() {
  const [status, setStatus] = useState<"idle" | "submitted">("idle");
  const [form, setForm] = useState({
    name: "", email: "", phone: "", salon: "", size: "1-2", date: "", time: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitted");
  };

  if (status === "submitted") {
    return (
      <section className="min-h-[80vh] flex items-center justify-center bg-aura-bg">
        <Container>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md mx-auto"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-aura-text mb-3">Demo Booked!</h1>
            <p className="text-aura-text-secondary mb-6">
              We&apos;ll send you a calendar invite at <strong>{form.email}</strong> within 5 minutes. See you at <strong>{form.time}</strong> on <strong>{form.date}</strong>!
            </p>
            <a href="/" className="text-sm font-semibold text-neon-violet hover:underline">
              ← Back to home
            </a>
          </motion.div>
        </Container>
      </section>
    );
  }

  return (
    <>
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 bg-gradient-to-b from-aura-bg to-white overflow-hidden">
        <GridBackground className="opacity-30" />
        <Container className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl mx-auto text-center"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-neon-violet/10 text-neon-violet mb-6">
              <Calendar className="w-3 h-3" />
              Book a Demo
            </span>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-aura-text leading-[1.1]">
              See Aura <span className="gradient-text">in Action</span>
            </h1>
            <p className="mt-5 text-lg text-aura-text-secondary max-w-xl mx-auto">
              Get a personalized 15-minute walkthrough of Aura. See how it fits your specific salon needs.
            </p>
          </motion.div>
        </Container>
      </section>

      <section className="pb-20 md:pb-28 bg-white">
        <Container>
          <div className="grid md:grid-cols-5 gap-12 max-w-5xl mx-auto">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="md:col-span-3"
            >
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-aura-text mb-1.5">Your Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-aura-text-muted" />
                      <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all" placeholder="Priya Sharma" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-aura-text mb-1.5">Email *</label>
                    <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all" placeholder="priya@salon.com" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-aura-text mb-1.5">Phone *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-4 h-4 text-aura-text-muted" />
                      <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all" placeholder="+91 98765 43210" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-aura-text mb-1.5">Salon Name *</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 w-4 h-4 text-aura-text-muted" />
                      <input type="text" required value={form.salon} onChange={(e) => setForm({ ...form, salon: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all" placeholder="Glow Studio" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-aura-text mb-1.5">Salon Size</label>
                  <select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all">
                    <option value="1-2">1-2 staff members</option>
                    <option value="3-5">3-5 staff members</option>
                    <option value="6-10">6-10 staff members</option>
                    <option value="10+">10+ staff members</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-aura-text mb-1.5">Preferred Date *</label>
                    <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-aura-text mb-1.5">Preferred Time *</label>
                    <select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all">
                      <option value="">Select time</option>
                      {TIME_SLOTS.map((t) => <option key={t} value={t}>{t} IST</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-neon-violet via-aura-rose to-aura-amber shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
                  Book My Demo
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </motion.div>

            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="md:col-span-2"
            >
              <div className="rounded-2xl border border-aura-border bg-aura-bg p-8">
                <h3 className="text-lg font-bold text-aura-text mb-4">What to Expect</h3>
                <ul className="space-y-4">
                  {BENEFITS.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-aura-text-secondary">{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 p-4 rounded-xl bg-white border border-aura-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-neon-violet" />
                    <span className="text-sm font-semibold text-aura-text">Quick & Easy</span>
                  </div>
                  <p className="text-xs text-aura-text-secondary">
                    No preparation needed. Just bring your questions about salon management.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>
    </>
  );
}
