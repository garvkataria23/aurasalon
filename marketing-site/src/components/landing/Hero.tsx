"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import { CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { BusinessTypeSelector } from "./BusinessTypeSelector";
import { EcosystemStage } from "./EcosystemStage";
import { ECOSYSTEM_CONTENT, type EcosystemRole } from "@/lib/ecosystem-content";

export function Hero() {
  const { language } = useLanguage();
  const copy = ECOSYSTEM_CONTENT[language];
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<EcosystemRole>("flow");
  const role = copy.ecosystem.roles[selected];
  const reveal = (delay: number) => ({ initial: reducedMotion ? false : { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: .55, delay: reducedMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } });

  return (
    <section className="relative overflow-hidden bg-[#f5f0e8]">
      <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(104,31,55,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(104,31,55,.05)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" aria-hidden="true" />
      <Container size="wide" className="relative z-10">
        <div className="grid items-center gap-10 pb-16 lg:grid-cols-[.86fr_1.14fr] lg:gap-12 lg:pb-24 xl:gap-16">
          <div className="max-w-2xl">
            <motion.div {...reveal(0)} className="mb-6 flex flex-wrap items-center gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-aura-burgundy">{copy.hero.eyebrow}</p>
              <BusinessTypeSelector />
            </motion.div>
            <motion.h1 {...reveal(.06)} className="font-display text-[clamp(3.2rem,6.6vw,7.2rem)] leading-[.92] tracking-[-.055em] text-aura-text">{copy.hero.title}</motion.h1>
            <motion.p {...reveal(.12)} className="mt-7 max-w-xl text-base leading-7 text-aura-text-secondary md:text-lg md:leading-8">{copy.hero.body}</motion.p>
            <motion.div {...reveal(.18)} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={CTA_LINKS.demo} className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-aura-burgundy px-6 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-aura-burgundy-strong">{copy.hero.primary}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></Link>
              <Link href="/platform" className="inline-flex min-h-12 items-center justify-center rounded-full border border-aura-border-strong bg-white/55 px-6 text-sm font-semibold text-aura-text transition-colors hover:bg-white">{copy.hero.secondary}</Link>
            </motion.div>
            <motion.div {...reveal(.23)} className="mt-8 border-l border-aura-amber pl-4" aria-live="polite">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-aura-burgundy">{role.eyebrow}</p>
              <p className="mt-1 text-sm font-semibold text-aura-text">{role.title}</p>
              <ul className="mt-3 grid gap-2 text-xs text-aura-text-secondary sm:grid-cols-2">{role.points.slice(0, 4).map((point) => <li key={point} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-aura-success" aria-hidden="true" />{point}</li>)}</ul>
            </motion.div>
          </div>
          <motion.div initial={reducedMotion ? false : { opacity: 0, x: 24, scale: .985 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: .65, delay: reducedMotion ? 0 : .12, ease: [0.22, 1, 0.36, 1] }} className="min-w-0">
            <EcosystemStage selected={selected} onSelect={setSelected} />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
