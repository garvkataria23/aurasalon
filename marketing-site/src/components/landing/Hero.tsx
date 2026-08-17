"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { BusinessTypeSelector } from "./BusinessTypeSelector";
import { EcosystemStage } from "./EcosystemStage";
import { ECOSYSTEM_CONTENT, type EcosystemRole } from "@/lib/ecosystem-content";

export function Hero() {
  const { language } = useLanguage();
  const copy = ECOSYSTEM_CONTENT[language];
  const [selected, setSelected] = useState<EcosystemRole>("flow");
  const role = copy.ecosystem.roles[selected];

  return (
    <section className="relative overflow-hidden bg-[var(--aura-bg,#f8f5ff)]">
      <div
        className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(124,92,191,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(124,92,191,.12)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]"
        aria-hidden="true"
      />
      <Container size="wide" className="relative z-10">
        <div className="grid items-center gap-10 pb-16 lg:grid-cols-[.86fr_1.14fr] lg:gap-12 lg:pb-24 xl:gap-16">
          <div className="max-w-2xl">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[var(--aura-primary)]">
                {copy.hero.eyebrow}
              </p>
              <BusinessTypeSelector />
            </div>
            <h1 className="font-display text-[clamp(3.45rem,6.8vw,7.4rem)] font-medium leading-[.94] tracking-[-.05em] text-[var(--aura-primary-dark,#5b3d9e)]">
              {copy.hero.title}
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[var(--aura-primary,#7c5cbf)]/75 md:text-lg md:leading-8">
              {copy.hero.body}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="primary" size="lg" className="bg-[var(--aura-primary,#7c5cbf)] text-white shadow-xl hover:bg-[var(--aura-primary-dark,#5b3d9e)]">
                <Link href={CTA_LINKS.demo} className="group">
                  {copy.hero.primary}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-[var(--aura-primary-light,#a78bda)] text-[var(--aura-primary-dark,#5b3d9e)] hover:border-[var(--aura-primary,#7c5cbf)] hover:bg-[var(--aura-primary,#7c5cbf)]/10">
                <Link href="/platform">{copy.hero.secondary}</Link>
              </Button>
            </div>
            <div className="mt-8 border-l border-[var(--aura-primary,#7c5cbf)] pl-4" aria-live="polite">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--aura-primary)]">
                {role.eyebrow}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--aura-primary-dark,#5b3d9e)]">
                {role.title}
              </p>
              <ul className="mt-3 grid gap-2 text-xs text-[var(--aura-primary,#7c5cbf)]/70 sm:grid-cols-2">
                {role.points.slice(0, 4).map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--aura-primary,#7c5cbf)]" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="min-w-0">
            <EcosystemStage selected={selected} onSelect={setSelected} />
          </div>
        </div>
      </Container>
    </section>
  );
}
