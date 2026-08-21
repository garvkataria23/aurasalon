"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe2, Search } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { cn } from "@/lib/utils";

export function LanguageSelector({ compact = false, align = "right", tone = "light" }: { compact?: boolean; align?: "left" | "right"; tone?: "light" | "dark" }) {
  const { language, setLanguage, allLanguages, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = allLanguages.find((item) => item.code === language) ?? allLanguages[0];
  const filteredLanguages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return allLanguages;
    return allLanguages.filter((item) =>
      item.name.toLowerCase().includes(normalized) ||
      item.nativeName.toLowerCase().includes(normalized) ||
      item.code.toLowerCase().includes(normalized)
    );
  }, [allLanguages, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language.selector", "Select language")}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium shadow-[var(--aura-shadow-xs)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          tone === "dark"
            ? "border-white/16 bg-white/10 text-white hover:bg-white/16 focus-visible:ring-white/70 focus-visible:ring-offset-[#2D176F]"
            : "border-[var(--aura-border)] bg-white text-[var(--aura-heading)] hover:bg-[var(--aura-off-white)] focus-visible:ring-[var(--aura-purple)]",
          compact && "h-10 min-w-0 justify-between"
        )}
      >
        <span className="inline-flex items-center gap-2 truncate">
          <Globe2 className={cn("h-4 w-4 shrink-0", tone === "dark" ? "text-white/90" : "text-[var(--aura-purple)]")} aria-hidden="true" />
          <span className="truncate">{compact ? selected.nativeName : selected.name}</span>
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", tone === "dark" ? "text-white/70" : "text-[var(--aura-muted)]", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full z-[9999] mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-[var(--aura-border)] bg-white p-2 shadow-[var(--aura-shadow-lg)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--aura-muted)]" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("language.search", "Search language")}
              className="h-10 w-full rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--aura-purple)] focus:bg-white"
            />
          </div>

          <div className="max-h-72 overflow-y-auto pr-1" role="listbox" aria-label={t("language.selector", "Select language")}>
            {filteredLanguages.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-[var(--aura-muted)]">{t("language.noResults", "No language found")}</div>
            ) : filteredLanguages.map((item) => {
              const active = item.code === language;
              return (
                <button
                  key={item.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setLanguage(item.code);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-purple)]",
                    active ? "bg-[var(--aura-lavender)] text-[var(--aura-purple)]" : "text-[var(--aura-heading)] hover:bg-[var(--aura-off-white)]"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.nativeName}</span>
                    <span className="block truncate text-xs text-[var(--aura-muted)]">{item.name}</span>
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
