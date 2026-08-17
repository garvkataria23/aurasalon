"use client";

import { useRef, useState } from "react";
import { Monitor, Smartphone, UsersRound, Workflow } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProductShell } from "@/components/ecosystem/ProductShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ECOSYSTEM_CONTENT, type EcosystemRole } from "@/lib/ecosystem-content";
import { cn } from "@/lib/utils";

const icons = { flow: Workflow, owner: Monitor, customer: Smartphone, staff: UsersRound };

export function ProductTour() {
  const { language } = useLanguage();
  const copy = ECOSYSTEM_CONTENT[language];
  const roles = Object.keys(copy.tour.roles) as EcosystemRole[];
  const [active, setActive] = useState<EcosystemRole>("flow");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const select = (index: number) => { const next = (index + roles.length) % roles.length; setActive(roles[next]); tabRefs.current[next]?.focus(); };
  const panel = copy.tour.roles[active];

  return (
    <section className="bg-aura-bg py-20 text-aura-text md:py-28">
      <Container size="wide">
        <div className="grid gap-8 lg:grid-cols-[.58fr_1.42fr] lg:gap-12">
          <div><SectionHeading badge={copy.tour.eyebrow} title={copy.tour.title} subtitle={copy.tour.body} align="left" className="[&_h2]:text-aura-text [&_p]:text-aura-text-muted [&>span]:text-aura-primary" /><div role="tablist" aria-label={copy.tour.title} className="mt-8 flex gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-visible">{roles.map((role, index) => { const Icon = icons[role]; return <button key={role} ref={(node) => { tabRefs.current[index] = node; }} type="button" role="tab" id={`product-stage-tab-${role}`} aria-selected={active === role} aria-controls="product-stage-panel" tabIndex={active === role ? 0 : -1} onClick={() => setActive(role)} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); select(index + 1); } if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); select(index - 1); } if (event.key === "Home") { event.preventDefault(); select(0); } if (event.key === "End") { event.preventDefault(); select(roles.length - 1); } }} className={cn("flex min-h-12 shrink-0 items-center gap-3 rounded-full px-4 text-left text-sm font-semibold transition-colors lg:rounded-xl", active === role ? "bg-white text-aura-text shadow-sm" : "border border-aura-border text-aura-text-muted hover:bg-aura-surface hover:text-aura-text")}><Icon className="h-4 w-4" aria-hidden="true" />{panel && copy.tour.roles[role].label}</button>; })}</div></div>
          <div id="product-stage-panel" role="tabpanel" aria-labelledby={`product-stage-tab-${active}`} className="min-w-0"><div key={active}><ProductShell role={active} label={panel.label} eyebrow={panel.eyebrow} title={panel.title} body={panel.body} points={panel.points} note={panel.note} disclosure={copy.tour.disclosure} /></div></div>
        </div>
      </Container>
    </section>
  );
}
