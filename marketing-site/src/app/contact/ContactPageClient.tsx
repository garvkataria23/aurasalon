"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Send, CheckCircle, FileCheck2, MessageSquareText, AlertCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GridBackground } from "@/components/ui/GridBackground";
import { CTA_LINKS } from "@/lib/constants";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const MAX_MESSAGE = 500;

interface FieldErrors {
  name?: string;
  email?: string;
  message?: string;
}

function FloatingInput({
  label, type = "text", required, value, onChange, placeholder, error,
}: {
  label: string; type?: string; required?: boolean; value: string;
  onChange: (v: string) => void; placeholder: string; error?: string;
}) {
  const id = useId();
  const filled = value.length > 0;
  return (
    <div className="relative">
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`peer w-full px-4 pt-6 pb-2 rounded-xl border bg-white text-sm text-aura-text placeholder-transparent focus:outline-none focus:ring-2 focus:ring-aura-primary/30 focus:border-aura-primary/50 transition-all ${
          error ? "border-danger/50 focus:ring-danger/30" : "border-aura-border"
        }`}
      />
       <label htmlFor={id} className={`absolute left-4 transition-all duration-200 pointer-events-none ${
        filled || error
          ? "top-2 text-[11px] font-medium"
          : "top-3.5 text-sm text-aura-text-muted"
      } ${error ? "text-danger" : "text-aura-text-secondary peer-focus:text-aura-primary"}`}>
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {error && (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1 text-xs text-danger mt-1"
        >
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function FloatingTextarea({
  label, required, value, onChange, placeholder, maxLength, error,
}: {
  label: string; required?: boolean; value: string;
  onChange: (v: string) => void; placeholder: string; maxLength?: number; error?: string;
}) {
  const id = useId();
  const filled = value.length > 0;
  const remaining = maxLength ? maxLength - value.length : null;
  return (
    <div className="relative">
      <textarea
        required={required}
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="peer w-full px-4 pt-6 pb-2 rounded-xl border border-aura-border bg-white text-sm text-aura-text placeholder-transparent focus:outline-none focus:ring-2 focus:ring-aura-primary/30 focus:border-aura-primary/50 transition-all resize-none"
      />
       <label htmlFor={id} className={`absolute left-4 transition-all duration-200 pointer-events-none ${
        filled
          ? "top-2 text-[11px] font-medium text-aura-text-secondary"
          : "top-3.5 text-sm text-aura-text-muted"
      } peer-focus:text-aura-primary`}>
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {remaining !== null && (
        <span className={`absolute bottom-3 right-4 text-xs ${remaining < 50 ? "text-danger" : "text-aura-text-muted"}`}>
          {remaining}
        </span>
      )}
      {error && <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-xs text-danger"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  );
}

export default function ContactPage() {
  const { t } = useLanguage();
  const reveal = useScrollReveal();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    salonName: "",
    message: "",
  });

  const validate = (): boolean => {
    const e: FieldErrors = {};
    if (!formData.name.trim()) e.name = t("contact.requiredName");
    if (!formData.email.trim()) e.email = t("contact.requiredEmail");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = t("contact.validEmail");
    if (!formData.message.trim()) e.message = t("contact.requiredMessage");
    else if (formData.message.length < 10) e.message = t("contact.shortMessage");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    if (!validate()) return;
    setStatus("sending");
    setSubmitError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setStatus("sent");
        setFormData({ name: "", email: "", phone: "", salonName: "", message: "" });
        setErrors({});
      } else {
        const payload = await res.json().catch(() => null) as { code?: string } | null;
        setSubmitError(payload?.code === "DELIVERY_NOT_CONFIGURED"
          ? t("contact.deliveryPending")
          : t("common.error"));
        setStatus("error");
      }
    } catch {
      setSubmitError(t("common.error"));
      setStatus("error");
    }
  };

  return (
    <div ref={reveal as React.RefObject<HTMLDivElement | null>} className="overflow-x-clip">
      <section className="pt-28 pb-16 md:pt-36 md:pb-20 bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF] relative overflow-hidden">
        <GridBackground className="opacity-25" />
        <Container className="fade-in-up relative z-10 text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center rounded-full border border-[var(--aura-purple)]/15 bg-white/65 px-3.5 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 backdrop-blur-sm shadow-xs">
            {t("contact.badge")}
          </span>
          <h1 className="text-[clamp(2.25rem,5vw,3.75rem)] font-bold tracking-[-0.03em] text-[var(--aura-heading)] leading-[1.1] text-balance">
            {t("contact.title")}
          </h1>
          <p className="mt-4 text-base md:text-lg text-[var(--aura-body)] leading-relaxed max-w-xl mx-auto text-pretty">
            {t("contact.body")}
          </p>
        </Container>
      </section>

      <section className="py-16 md:py-24 bg-[var(--aura-off-white)]">
        <Container>
          <div className="grid md:grid-cols-5 gap-8 lg:gap-12 max-w-5xl mx-auto items-start">
            <div className="reveal-left md:col-span-3 rounded-2xl border border-[var(--aura-border)] bg-white p-6 sm:p-8 shadow-[var(--aura-shadow-sm)]">
              {status === "sent" ? (
                <div
                   className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-12 text-center"
                   role="status"
                >
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                   <h3 className="text-xl font-bold text-[var(--aura-heading)] mb-2">{t("contact.sent")}</h3>
                  <p className="text-sm text-[var(--aura-body)]">
                     {t("contact.sentBody")}
                  </p>
                  <button
                    onClick={() => setStatus("idle")}
                    className="mt-6 text-sm font-semibold text-[var(--aura-purple)] hover:underline"
                  >
                     {t("contact.another")}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-busy={status === "sending"} aria-describedby={status === "error" ? "contact-submit-error" : undefined}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <FloatingInput label={t("contact.name")} required value={formData.name} onChange={(v) => setFormData({ ...formData, name: v })} placeholder={t("contact.placeholder.name")} error={errors.name} />
                     <FloatingInput label={t("contact.email")} type="email" required value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} placeholder={t("contact.placeholder.email")} error={errors.email} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <FloatingInput label={t("contact.phone")} value={formData.phone} onChange={(v) => setFormData({ ...formData, phone: v })} placeholder={t("contact.placeholder.phone")} />
                     <FloatingInput label={t("contact.salon")} value={formData.salonName} onChange={(v) => setFormData({ ...formData, salonName: v })} placeholder={t("contact.placeholder.salon")} />
                  </div>
                   <FloatingTextarea label={t("contact.message")} required value={formData.message} onChange={(v) => setFormData({ ...formData, message: v })} placeholder={t("contact.placeholder.message")} maxLength={MAX_MESSAGE} error={errors.message} />

                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold text-white rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] shadow-[var(--aura-shadow-sm)] hover:bg-[var(--aura-purple-hover)] hover:shadow-[var(--aura-shadow-md)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {status === "sending" ? (
                      <>
                         {t("common.loading")}
                      </>
                    ) : (
                      <>
                         {t("contact.send")}
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  {status === "error" && (
                     <p id="contact-submit-error" className="text-sm text-[var(--aura-danger)]" role="alert">{submitError || t("common.error")}</p>
                  )}
                </form>
              )}
            </div>

            <div className="reveal-right md:col-span-2 space-y-6">
              <div className="rounded-2xl border border-[var(--aura-border)] bg-white p-6 sm:p-7 shadow-[var(--aura-shadow-sm)] space-y-6">
                 {[
                    { icon: MessageSquareText, label: t("contact.channel"), value: t("contact.channelBody") },
                    { icon: FileCheck2, label: t("contact.serviceDetails"), value: t("contact.serviceDetailsBody") },
                 ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4">
                    <div className="flex items-start gap-3">
                      <item.icon className="w-5 h-5 text-[var(--aura-purple)] mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)]">{item.label}</div>
                        <div className="text-xs text-[var(--aura-body)] mt-1 whitespace-pre-line leading-relaxed">{item.value}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Direct WhatsApp Quick Connect */}
                <div className="pt-2">
                  <a
                    href="https://wa.me/917208283341?text=Hi%20Aura%20Team!%20I%20am%20interested%20in%20Aura%20Salon%20CRM%20%26%20POS%20and%20would%20like%20to%20learn%20more."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/90 px-4 py-3 text-xs font-bold text-emerald-800 shadow-2xs transition-all hover:bg-emerald-100 hover:shadow-xs hover:border-emerald-400"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-[#25D366]" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    <span>Chat on WhatsApp (+91 7208283341)</span>
                  </a>
                </div>

                <div className="border-t border-[var(--aura-border)] pt-4">
                   <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] mb-2.5">{t("contact.quick")}</h3>
                  <ul className="space-y-2 text-xs">
                     <li><a href={CTA_LINKS.demo} className="text-[var(--aura-purple)] font-semibold hover:underline">{t("contact.schedule")}</a></li>
                     <li><Link href="/features" className="text-[var(--aura-purple)] font-semibold hover:underline">{t("contact.viewFeatures")}</Link></li>
                     <li><Link href="/pricing" className="text-[var(--aura-purple)] font-semibold hover:underline">{t("contact.viewPricing")}</Link></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
