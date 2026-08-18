"use client";

import { useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { NavLink } from "@/lib/types";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { cn } from "@/lib/utils";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  links: NavLink[];
  ctaLinks: { login: string; trial: string; demo: string };
  pathname: string;
}

function isRouteActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export function MobileMenu({ open, onClose, links, ctaLinks, pathname }: MobileMenuProps) {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFocusable = useRef<HTMLAnchorElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  /* Focus trap */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;

    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [onClose]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      timer = setTimeout(() => firstFocusable.current?.focus(), 0);
      document.addEventListener("keydown", handleKeyDown);
    } else {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus.current?.focus();
    }
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      id="mobile-navigation"
      className="fixed inset-0 z-[9996] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t("a11y.navigationMenu")}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute bottom-0 right-0 top-0 w-full max-w-[24rem] bg-white shadow-[var(--aura-shadow-xl)] border-l border-[var(--aura-border)]"
      >
        <div
          className="flex h-full flex-col overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          style={{ paddingTop: "calc(5rem + env(safe-area-inset-top))" }}
        >
          {/* Brand + Language */}
          <div className="mb-6 flex items-center justify-between border-b border-[var(--aura-border)] pb-5">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--aura-purple)] text-white text-xs font-semibold">A</span>
              <span className="text-base font-semibold text-[var(--aura-heading)]">Aura</span>
            </div>
            <LanguageSelector compact align="right" />
          </div>

          {/* Nav Links */}
          <nav className="flex flex-col gap-0.5" aria-label={t("a11y.navigation")}>
            {links.map((link, i) => {
              const active = isRouteActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  ref={i === 0 ? firstFocusable : undefined}
                  href={link.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium transition-colors",
                    active
                      ? "bg-[var(--aura-lavender)] text-[var(--aura-purple)]"
                      : "text-[var(--aura-heading)] hover:bg-[var(--aura-off-white)]"
                  )}
                >
                  <span>{t(link.labelKey ?? link.label, link.label)}</span>
                  <ChevronRight
                    className={cn("h-4 w-4 shrink-0", active ? "text-[var(--aura-purple)]" : "text-[var(--aura-muted)]")}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </nav>

          {/* CTA Buttons */}
          <div className="mt-auto flex flex-col gap-2.5 pt-6 border-t border-[var(--aura-border)] mt-6">
            <Link
              href={ctaLinks.login}
              onClick={onClose}
              className="flex h-11 w-full items-center justify-center rounded-[var(--aura-radius-btn)] border border-[var(--aura-border)] text-sm font-medium text-[var(--aura-heading)] transition-colors hover:bg-[var(--aura-off-white)]"
            >
              {t("navigation.login")}
            </Link>
            <Link
              href={ctaLinks.demo}
              onClick={onClose}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] text-sm font-semibold text-white transition-colors hover:bg-[var(--aura-purple-hover)]"
            >
              {t("navigation.demo")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
