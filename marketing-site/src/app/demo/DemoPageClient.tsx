"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Building2, Calendar, CheckCircle, Clock, ClipboardCheck, Phone, ShieldCheck, Sparkles, TrendingUp, User, Users } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GridBackground } from "@/components/ui/GridBackground";
import { useLanguage } from "@/components/providers/LanguageProvider";

const TIME_SLOTS = [
  "10:00 AM", "11:00 AM", "12:00 PM",
  "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
];

const BENEFITS = ["demo.benefit1", "demo.benefit2", "demo.benefit3", "demo.benefit4"];

const inputClass = "w-full rounded-2xl border border-[#E7DFF3] bg-white/80 px-4 py-3.5 text-sm text-[var(--aura-heading)] shadow-[0_1px_0_rgba(111,79,216,0.04)] transition-all duration-200 placeholder:text-[var(--aura-muted)] focus:border-[var(--aura-purple)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(111,79,216,0.12)]";

const trustCards = [
  { icon: ClipboardCheck, label: "Workflow-first", body: "Demo shaped around bookings, billing, staff and daily closing." },
  { icon: ShieldCheck, label: "No credit card", body: "A practical walkthrough before any setup commitment." },
  { icon: TrendingUp, label: "Migration clarity", body: "Understand setup, training and data preparation upfront." },
];

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
      <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#F0E9FF_0%,#FCFBF8_42%,#FFFFFF_100%)] py-24">
        <GridBackground className="opacity-30" />
        <Container className="relative z-10">
          <div className="fade-in-up mx-auto max-w-lg rounded-[2rem] border border-white/80 bg-white/85 p-8 text-center shadow-[0_28px_90px_rgba(72,45,151,0.14)] backdrop-blur-xl sm:p-10">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-8 ring-emerald-500/5">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </div>
            <h1 className="mb-3 text-3xl font-bold tracking-[-0.04em] text-aura-text">{t("demo.done")}</h1>
            <p className="mb-7 text-aura-text-secondary">
              {t("demo.doneBody").replace("{email}", form.email).replace("{time}", form.time).replace("{date}", form.date)}
            </p>
            <Link href="/" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-aura-primary transition-colors hover:bg-[var(--aura-lavender)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aura-purple)]">
              ← {t("common.backHome")}
            </Link>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#FFFDFB_0%,#F8F4FF_42%,#ECE4FF_100%)] pb-14 pt-28 md:pb-20 md:pt-36">
        <GridBackground className="opacity-25" />
        <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-[var(--aura-purple)]/12 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#B89CFF]/20 blur-3xl" aria-hidden="true" />
        <Container className="relative z-10">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div className="fade-in-up max-w-3xl text-center lg:text-left">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/15 bg-white/75 px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)] shadow-[0_10px_30px_rgba(111,79,216,0.08)] backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {t("demo.badge")}
              </span>
              <h1 className="text-balance text-[clamp(2.75rem,6vw,5.9rem)] font-bold leading-[0.95] tracking-[-0.065em] text-[var(--aura-heading)]">
                {t("demo.title", `${t("demo.titleA")} ${t("demo.titleB")}`)}
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-8 text-[var(--aura-body)] md:text-lg lg:mx-0">
                {t("demo.body")}
              </p>
              <div className="mt-8 flex flex-col gap-3 text-sm font-semibold text-[var(--aura-heading)] sm:flex-row sm:justify-center lg:justify-start">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-[var(--aura-shadow-sm)]"><Clock className="h-4 w-4 text-[var(--aura-purple)]" aria-hidden="true" /> 15-min walkthrough</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-[var(--aura-shadow-sm)]"><Users className="h-4 w-4 text-[var(--aura-purple)]" aria-hidden="true" /> Built for Indian salon teams</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="fade-in-up relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-4 shadow-[0_30px_100px_rgba(72,45,151,0.16)] backdrop-blur-xl [animation-delay:120ms]">
                <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#2A173D_0%,#6F4FD8_58%,#A98AFF_100%)] p-5 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">Aura demo</p>
                      <p className="mt-2 text-2xl font-bold tracking-[-0.04em]">Connected workday</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><Calendar className="h-6 w-6" aria-hidden="true" /></div>
                  </div>
                  <div className="mt-8 grid gap-3">
                    {["Booking flow", "POS checkout", "Staff & inventory"].map((item, index) => (
                      <div key={item} className="flex items-center justify-between rounded-2xl bg-white/[0.12] p-3 backdrop-blur">
                        <span className="text-sm font-medium text-white/90">{item}</span>
                        <span className="rounded-full bg-white/[0.18] px-2.5 py-1 text-xs text-white/80">0{index + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="relative bg-[var(--aura-off-white)] py-14 md:py-24">
        <Container>
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10 xl:gap-14">
            <div className="rounded-[2rem] border border-white bg-white p-5 shadow-[0_24px_80px_rgba(29,27,32,0.08)] sm:p-8 lg:p-9">
              <div className="mb-7 flex flex-col gap-2 border-b border-[var(--aura-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--aura-purple)]">Secure request</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[var(--aura-heading)] sm:text-3xl">{t("demo.book")}</h2>
                </div>
                <p className="max-w-xs text-sm leading-6 text-[var(--aura-body)]">{t("demo.timePreference")}</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5" aria-busy={status === "sending"} aria-describedby={errorMessage ? "demo-submit-error" : undefined}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="demo-name" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">{t("demo.name")} *</label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--aura-muted)]" />
                      <input id="demo-name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${inputClass} pl-11`} placeholder={t("contact.placeholder.name")} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="demo-email" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">{t("demo.email")} *</label>
                    <input id="demo-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder={t("contact.placeholder.email")} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="demo-phone" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">{t("demo.phone")} *</label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--aura-muted)]" />
                      <input id="demo-phone" type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`${inputClass} pl-11`} placeholder={t("contact.placeholder.phone")} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="demo-salon" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">{t("demo.salon")} *</label>
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--aura-muted)]" />
                      <input id="demo-salon" type="text" required value={form.salon} onChange={(e) => setForm({ ...form, salon: e.target.value })} className={`${inputClass} pl-11`} placeholder={t("contact.placeholder.salon")} />
                    </div>
                  </div>
                </div>
                <div>
                  <label htmlFor="demo-size" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">{t("demo.size")}</label>
                  <select id="demo-size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className={inputClass}>
                     <option value="1-2">1-2 {t("demo.teamMembers")}</option>
                     <option value="3-5">3-5 {t("demo.teamMembers")}</option>
                     <option value="6-10">6-10 {t("demo.teamMembers")}</option>
                     <option value="10+">10+ {t("demo.teamMembers")}</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="demo-date" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">{t("demo.date")} *</label>
                    <input id="demo-date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="demo-time" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">{t("demo.time")} *</label>
                    <select id="demo-time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required className={inputClass}>
                      <option value="">{t("demo.selectTime")}</option>
                      {TIME_SLOTS.map((t) => <option key={t} value={t}>{t} IST</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={status === "sending"} className="inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--aura-purple),#8D6DF2)] px-8 py-4 text-sm font-bold text-white shadow-[0_16px_36px_rgba(111,79,216,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(111,79,216,0.34)] disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto">
                  {status === "sending" ? t("demo.sending") : t("demo.book")}
                  <ArrowRight className="h-4 w-4" />
                </button>
                {errorMessage && <p id="demo-submit-error" role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">{errorMessage}</p>}
              </form>
            </div>

            <aside className="space-y-5 lg:sticky lg:top-24">
              <div className="rounded-[2rem] border border-[var(--aura-border)] bg-white p-6 shadow-[var(--aura-shadow-sm)] sm:p-7">
                <h3 className="mb-5 text-xl font-bold tracking-[-0.03em] text-[var(--aura-heading)]">{t("demo.expect")}</h3>
                <ul className="space-y-4">
                  {BENEFITS.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10"><CheckCircle className="h-4 w-4 text-emerald-500" /></span>
                      <span className="text-sm leading-7 text-[var(--aura-body)]">{t(b)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7 rounded-2xl border border-[var(--aura-purple)]/10 bg-[linear-gradient(135deg,#F5F1FF,#FFFFFF)] p-4">
                  <div className="mb-1.5 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[var(--aura-purple)]" />
                     <span className="text-xs font-bold uppercase tracking-wider text-[var(--aura-purple)]">{t("demo.quick")}</span>
                  </div>
                  <p className="text-xs leading-6 text-[var(--aura-body)]">
                     {t("demo.quickBody")}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {trustCards.map(({ icon: Icon, label, body }) => (
                  <div key={label} className="rounded-3xl border border-white bg-white/80 p-5 shadow-[var(--aura-shadow-sm)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--aura-shadow-md)]">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--aura-lavender)] text-[var(--aura-purple)]"><Icon className="h-5 w-5" aria-hidden="true" /></div>
                    <p className="text-sm font-bold text-[var(--aura-heading)]">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--aura-body)]">{body}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}
