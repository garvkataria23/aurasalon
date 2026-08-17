"use client";

import { Monitor, Smartphone, UsersRound, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ECOSYSTEM_CONTENT, type EcosystemRole } from "@/lib/ecosystem-content";

const roleIcons = { flow: Workflow, owner: Monitor, customer: Smartphone, staff: UsersRound };

export function EcosystemStage({ selected, onSelect }: { selected: EcosystemRole; onSelect: (role: EcosystemRole) => void }) {
  const { language } = useLanguage();
  const copy = ECOSYSTEM_CONTENT[language];
  const role = copy.ecosystem.roles[selected];

  return (
    <div
      className="relative aspect-[4/4.35] min-h-[25rem] overflow-hidden rounded-[1.75rem] border border-[var(--aura-primary-light,#a78bda)]/30 bg-[var(--aura-bg,#f8f5ff)] shadow-[0_35px_100px_rgba(124,92,191,.12)] sm:aspect-[4/3.3] lg:aspect-[4/4.15]"
      aria-label={copy.hero.sceneLabel}
    >
      {/* Center Aura badge */}
      <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
        <div className="relative h-[78%] w-[82%] max-w-[38rem]">
          <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[2rem] border border-[var(--aura-primary-light,#a78bda)]/40 bg-[var(--aura-primary,#7c5cbf)] text-center text-white shadow-[0_24px_70px_rgba(124,92,191,.32)] sm:h-36 sm:w-36">
            <span className="font-display text-3xl italic">Aura</span>
          </div>
          {/* Role orbit nodes */}
          {(["owner", "customer", "staff", "flow"] as EcosystemRole[]).map((r, index) => {
            const Icon = roleIcons[r];
            const position = ["left-[2%] top-[18%]", "right-[4%] top-[12%]", "right-[1%] bottom-[10%]", "left-[8%] bottom-[8%]"][index];
            return (
              <div
                key={r}
                className={cn(
                  "absolute grid h-14 w-14 place-items-center rounded-2xl border bg-white shadow-lg transition-transform sm:h-16 sm:w-16",
                  position,
                  selected === r ? "scale-110 border-[var(--aura-primary,#7c5cbf)] text-[var(--aura-primary,#7c5cbf)]" : "border-[var(--aura-primary-light,#a78bda)]/30 text-[var(--aura-primary-light,#a78bda)]"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected role content card */}
      <div className="absolute inset-x-3 bottom-16 rounded-2xl border border-[var(--aura-primary-light,#a78bda)]/30 bg-white/92 p-4 shadow-lg backdrop-blur-md sm:inset-x-5 sm:bottom-20">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--aura-primary)]">
          {role.eyebrow}
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--aura-primary-dark,#5b3d9e)]">
          {role.title}
        </p>
        <ul className="mt-2 grid gap-1 text-xs text-[var(--aura-primary,#7c5cbf)]/70 sm:grid-cols-2">
          {role.points.slice(0, 4).map((point) => (
            <li key={point} className="flex items-start gap-1.5">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--aura-primary,#7c5cbf)]" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      {/* Tab selector */}
      <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-[var(--aura-primary-light,#a78bda)]/30 bg-white/92 p-2.5 shadow-lg backdrop-blur-md sm:inset-x-5 sm:bottom-5">
        <div className="grid grid-cols-4 gap-1" role="group" aria-label={copy.ecosystem.title}>
          {(Object.keys(copy.ecosystem.roles) as EcosystemRole[]).map((r) => {
            const Icon = roleIcons[r];
            return (
              <button
                key={r}
                type="button"
                onClick={() => onSelect(r)}
                aria-pressed={selected === r}
                className={cn(
                  "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold leading-tight transition-colors sm:text-xs",
                  selected === r
                    ? "bg-[var(--aura-primary,#7c5cbf)] text-white"
                    : "text-[var(--aura-primary-light,#a78bda)] hover:bg-[var(--aura-primary,#7c5cbf)]/10 hover:text-[var(--aura-primary-dark,#5b3d9e)]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="line-clamp-2">{copy.ecosystem.roles[r].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="absolute left-4 top-4 max-w-[15rem] rounded-full border border-[var(--aura-primary-light,#a78bda)]/30 bg-white/85 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.1em] text-[var(--aura-primary)] backdrop-blur sm:left-5 sm:top-5 sm:text-[10px]">
        {copy.hero.disclosure}
      </p>
    </div>
  );
}
