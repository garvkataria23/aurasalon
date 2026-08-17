"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function CTASection() {
  const { t } = useLanguage();

  return (
    <section className="relative py-20 md:py-28 bg-aura-surface overflow-hidden">
      <Container>
        <div className="relative overflow-hidden rounded-[1.75rem] border border-aura-border bg-aura-primary/5">
          <div className="absolute inset-y-0 right-0 w-2/5 border-l border-aura-border/50 opacity-50 [background-image:linear-gradient(rgba(124,92,191,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(124,92,191,.08)_1px,transparent_1px)] [background-size:48px_48px]" aria-hidden="true" />

          <div className="relative z-10 grid gap-10 p-6 sm:p-10 md:p-14 lg:grid-cols-[1.4fr_.6fr] lg:items-end lg:p-16">
            <div>
              <h2 className="max-w-3xl font-display text-[clamp(2.6rem,6vw,5.5rem)] font-normal leading-[1.04] tracking-[-.035em] text-aura-text text-balance">
                {t("cta.title")}
              </h2>
              <p className="mt-6 text-base leading-7 text-aura-text-secondary max-w-2xl">
                {t("cta.body")}
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row lg:flex-col">
              <Button
                asChild
                variant="primary"
                size="lg"
                className="bg-aura-primary text-white hover:bg-aura-primary/90 shadow-lg sm:inline-flex"
              >
                <Link href={CTA_LINKS.trial} className="group">
                  {t("cta.primary")}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-aura-border text-aura-text-secondary hover:bg-aura-primary/10 sm:inline-flex"
              >
                <Link href="/features">{t("cta.secondary")}</Link>
              </Button>
            </div>

            <div className="col-span-full flex flex-wrap gap-x-6 gap-y-2 border-t border-aura-border pt-6 text-xs text-aura-text-secondary/60">
              <span>{t("cta.meta1")}</span><span aria-hidden="true">·</span><span>{t("cta.meta2")}</span><span aria-hidden="true">·</span><span>{t("cta.meta3")}</span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
