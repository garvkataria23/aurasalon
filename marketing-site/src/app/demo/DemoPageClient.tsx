"use client";

import { useState } from "react";
import { Calendar, Clock, User, Building2, CheckCircle, ArrowRight, Phone } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GridBackground } from "@/components/ui/GridBackground";
import { useLanguage } from "@/components/providers/LanguageProvider";

const TIME_SLOTS = [
  "10:00 AM", "11:00 AM", "12:00 PM",
  "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
];

const BENEFITS = ["demo.benefit1", "demo.benefit2", "demo.benefit3", "demo.benefit4"];

export default function DemoPage() {
  const { businessType, t } = useLanguage();
  const [status, setStatus] = useState<"idle" | "sending" | "submitted" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", phone: "", salon: "", size: "1-2", date: "", time: "",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setErrorMessage("");
    const message = [
      t("demo.messageIntro"),
      `${t("demo.messageSize")}: ${form.size}`,
      `${t("demo.messageDate")}: ${form.date}`,
      `${t("demo.messageTime")}: ${form.time} IST`,
      `${t("demo.messageBusiness")}: ${t(`business.${businessType}`)}`,
    ].join("\n");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, salonName: form.salon, message }),
      });
      const payload = await response.json().catch(() => null) as { code?: string; error?: string } | null;
      if (!response.ok) {
        setErrorMessage(payload?.code === "DELIVERY_NOT_CONFIGURED"
          ? t("demo.deliveryPending")
          : t("demo.error"));
        setStatus("error");
        return;
      }
      setStatus("submitted");
    } catch {
      setErrorMessage(t("demo.error"));
      setStatus("error");
    }
  };

  if (status === "submitted") {
    return (
      <section className="min-h-[80vh] flex items-center justify-center bg-aura-bg">
        <Container>
          <div className="text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
             <h1 className="text-2xl font-bold text-aura-text mb-3">{t("demo.done")}</h1>
            <p className="text-aura-text-secondary mb-6">
               {t("demo.doneBody").replace("{email}", form.email).replace("{time}", form.time).replace("{date}", form.date)}
            </p>
            <a href="/" className="text-sm font-semibold text-aura-primary hover:underline">
               ← {t("common.backHome")}
            </a>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <>
      <section className="pt-28 pb-16 md:pt-36 md:pb-20 bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF] relative overflow-hidden">
        <GridBackground className="opacity-25" />
        <Container className="relative z-10">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center rounded-full border border-[var(--aura-purple)]/15 bg-white/65 px-3.5 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 backdrop-blur-sm shadow-xs">
              {t("demo.badge")}
            </span>
            <h1 className="text-[clamp(2.25rem,5vw,3.75rem)] font-bold tracking-[-0.03em] text-[var(--aura-heading)] leading-[1.1] text-balance">
              {t("demo.title")}
            </h1>
            <p className="mt-4 text-base md:text-lg text-[var(--aura-body)] leading-relaxed max-w-xl mx-auto text-pretty">
               {t("demo.body")}
            </p>
          </div>
        </Container>
      </section>

      <section className="py-16 md:py-24 bg-[var(--aura-off-white)]">
        <Container>
          <div className="grid md:grid-cols-5 gap-8 lg:gap-12 max-w-5xl mx-auto items-start">
            <div className="md:col-span-3 rounded-2xl border border-[var(--aura-border)] bg-white p-6 sm:p-8 shadow-[var(--aura-shadow-sm)]">
              <form onSubmit={handleSubmit} className="space-y-5" aria-busy={status === "sending"} aria-describedby={errorMessage ? "demo-submit-error" : undefined}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                     <label htmlFor="demo-name" className="block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] mb-1.5">{t("demo.name")} *</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 w-4 h-4 text-[var(--aura-muted)]" />
                       <input id="demo-name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)]/50 text-sm text-[var(--aura-heading)] placeholder:text-[var(--aura-muted)] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[var(--aura-purple)]/20 focus:border-[var(--aura-purple)] transition-all" placeholder={t("contact.placeholder.name")} />
                    </div>
                  </div>
                  <div>
                     <label htmlFor="demo-email" className="block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] mb-1.5">{t("demo.email")} *</label>
                     <input id="demo-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)]/50 text-sm text-[var(--aura-heading)] placeholder:text-[var(--aura-muted)] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[var(--aura-purple)]/20 focus:border-[var(--aura-purple)] transition-all" placeholder={t("contact.placeholder.email")} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                     <label htmlFor="demo-phone" className="block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] mb-1.5">{t("demo.phone")} *</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-[var(--aura-muted)]" />
                       <input id="demo-phone" type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)]/50 text-sm text-[var(--aura-heading)] placeholder:text-[var(--aura-muted)] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[var(--aura-purple)]/20 focus:border-[var(--aura-purple)] transition-all" placeholder={t("contact.placeholder.phone")} />
                    </div>
                  </div>
                  <div>
                     <label htmlFor="demo-salon" className="block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] mb-1.5">{t("demo.salon")} *</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-3.5 w-4 h-4 text-[var(--aura-muted)]" />
                       <input id="demo-salon" type="text" required value={form.salon} onChange={(e) => setForm({ ...form, salon: e.target.value })} className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)]/50 text-sm text-[var(--aura-heading)] placeholder:text-[var(--aura-muted)] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[var(--aura-purple)]/20 focus:border-[var(--aura-purple)] transition-all" placeholder={t("contact.placeholder.salon")} />
                    </div>
                  </div>
                </div>
                <div>
                   <label htmlFor="demo-size" className="block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] mb-1.5">{t("demo.size")}</label>
                   <select id="demo-size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)]/50 text-sm text-[var(--aura-heading)] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[var(--aura-purple)]/20 focus:border-[var(--aura-purple)] transition-all">
                     <option value="1-2">1-2 {t("demo.teamMembers")}</option>
                     <option value="3-5">3-5 {t("demo.teamMembers")}</option>
                     <option value="6-10">6-10 {t("demo.teamMembers")}</option>
                     <option value="10+">10+ {t("demo.teamMembers")}</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                     <label htmlFor="demo-date" className="block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] mb-1.5">{t("demo.date")} *</label>
                     <input id="demo-date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)]/50 text-sm text-[var(--aura-heading)] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[var(--aura-purple)]/20 focus:border-[var(--aura-purple)] transition-all" />
                  </div>
                  <div>
                     <label htmlFor="demo-time" className="block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] mb-1.5">{t("demo.time")} *</label>
                     <select id="demo-time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required className="w-full px-4 py-3 rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)]/50 text-sm text-[var(--aura-heading)] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[var(--aura-purple)]/20 focus:border-[var(--aura-purple)] transition-all">
                        <option value="">{t("demo.selectTime")}</option>
                       {TIME_SLOTS.map((t) => <option key={t} value={t}>{t} IST</option>)}
                     </select>
                     <p className="mt-2 text-xs leading-5 text-[var(--aura-muted)]">{t("demo.timePreference")}</p>
                   </div>
                </div>
                <button type="submit" disabled={status === "sending"} className="w-full sm:w-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] px-8 py-3.5 text-sm font-semibold text-white shadow-[var(--aura-shadow-sm)] transition-all duration-200 hover:bg-[var(--aura-purple-hover)] hover:shadow-[var(--aura-shadow-md)] hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
                   {status === "sending" ? t("demo.sending") : t("demo.book")}
                  <ArrowRight className="w-4 h-4" />
                </button>
                {errorMessage && <p id="demo-submit-error" role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">{errorMessage}</p>}
              </form>
            </div>

            <div className="md:col-span-2 space-y-6">
              <div className="rounded-2xl border border-[var(--aura-border)] bg-white p-7 shadow-[var(--aura-shadow-sm)]">
                 <h3 className="text-base font-bold text-[var(--aura-heading)] mb-4">{t("demo.expect")}</h3>
                <ul className="space-y-3.5">
                   {BENEFITS.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-500 mt-1 flex-shrink-0" />
                      <span className="text-sm text-[var(--aura-body)] leading-relaxed">{t(b)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 p-4 rounded-xl bg-[var(--aura-lavender)] border border-[var(--aura-border)]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Clock className="w-4 h-4 text-[var(--aura-purple)]" />
                     <span className="text-xs font-bold uppercase tracking-wider text-[var(--aura-purple)]">{t("demo.quick")}</span>
                  </div>
                  <p className="text-xs text-[var(--aura-body)] leading-relaxed">
                     {t("demo.quickBody")}
                  </p>
                </div>
              </div>

              {/* Trust Badges Sidebar */}
              <div className="rounded-2xl border border-[var(--aura-border)] bg-white p-6 shadow-xs flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--aura-lavender)] px-3 py-1 text-xs font-semibold text-[var(--aura-purple)]">
                  ⚡ 15-Min Walkthrough
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--aura-lavender)] px-3 py-1 text-xs font-semibold text-[var(--aura-purple)]">
                  🛡️ No Credit Card Needed
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--aura-lavender)] px-3 py-1 text-xs font-semibold text-[var(--aura-purple)]">
                  🇮🇳 Free Data Migration
                </span>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
