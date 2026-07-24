"use client";

import { Camera, FileCheck2, Quote } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function Testimonials() {
  const { t } = useLanguage();
  const proofItems = ["workflow", "voice", "permission"];
  return (
    <section className="bg-white py-20 md:py-28">
      <Container>
        <SectionHeading badge={t("proof.badge")} title={t("proof.title")} subtitle={t("proof.body")} />
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">{proofItems.map((item, index) => <article key={item} data-customer-proof-slot={item} className="rounded-2xl border border-aura-border bg-aura-surface-muted p-6"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-aura-burgundy">{index === 1 ? <Quote className="h-4 w-4" /> : index === 2 ? <FileCheck2 className="h-4 w-4" /> : <Camera className="h-4 w-4" />}</div><h3 className="mt-6 font-display text-2xl text-aura-text">{t(`proof.${item}`)}</h3><p className="mt-3 text-sm leading-6 text-aura-text-secondary">{t(`proof.${item}.body`)}</p><p className="mt-6 border-t border-aura-border pt-4 text-[10px] font-bold uppercase tracking-[.12em] text-aura-text-muted">{t("proof.pending")}</p></article>)}</div>
      </Container>
    </section>
  );
}
