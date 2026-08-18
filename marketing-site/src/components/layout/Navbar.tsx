"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, ArrowRight } from "lucide-react";
import { CTA_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { MobileMenu } from "./MobileMenu";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

/* ── Navigation Structure ──
   Maps old destinations into the new IA:
   Products → Owner CRM, Customer App, Staff App
   Solutions → Platform, Workflows
   Features → /features
   Pricing → /pricing
   Resources → Blog, FAQ, Contact
*/

type DropdownItem = { label: string; labelKey: string; href: string; description?: string; descriptionKey?: string };

type NavItem = {
  label: string;
  labelKey: string;
  href?: string;
  children?: DropdownItem[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Products",
    labelKey: "navigation.products",
    children: [
      { label: "Owner CRM", labelKey: "nav.owner-crm", href: "/owner-crm", description: "GST billing, client CRM, inventory & finance" },
      { label: "Customer App", labelKey: "nav.customer-app", href: "/customer-app", description: "Pay-at-salon booking & visit history" },
      { label: "Staff App", labelKey: "nav.staff-app", href: "/staff-app", description: "Attendance, shifts & commission tracking" },
    ],
  },
  {
    label: "Solutions",
    labelKey: "navigation.solutions",
    children: [
      { label: "Platform Overview", labelKey: "navigation.platformOverview", href: "/platform", description: "See the connected operating system" },
      { label: "Workflows", labelKey: "nav.workflows", href: "/workflows", description: "Booking to billing to owner insight" },
    ],
  },
  { label: "Features", labelKey: "nav.features", href: "/features" },
  { label: "Pricing", labelKey: "nav.pricing", href: "/pricing" },
  {
    label: "Resources",
    labelKey: "navigation.resources",
    children: [
      { label: "Blog", labelKey: "nav.blog", href: "/blog", description: "Guides & industry insights" },
      { label: "FAQ", labelKey: "navigation.faq", href: "/faq", description: "Common questions answered" },
      { label: "Contact", labelKey: "navigation.contact", href: "/contact", description: "Get in touch with our team" },
    ],
  },
];

/* Flat list of all hrefs for mobile menu */
const ALL_NAV_LINKS = NAV_ITEMS.flatMap((item) =>
  item.children ? item.children.map((c) => ({ label: c.label, labelKey: c.labelKey, href: c.href })) : [{ label: item.label, labelKey: item.labelKey, href: item.href! }]
);

function isRouteActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function isGroupActive(pathname: string, children?: DropdownItem[]) {
  if (!children) return false;
  return children.some((c) => isRouteActive(pathname, c.href));
}

/* ── Dropdown Component ── */
function NavDropdown({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();
  const enter = () => { if (timeout.current) clearTimeout(timeout.current); setOpen(true); };
  const leave = () => { timeout.current = setTimeout(() => setOpen(false), 150); };

  /* Close on route change */
  useEffect(() => {
    const id = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = isGroupActive(pathname, item.children);

  return (
    <div ref={ref} className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-1 px-3 py-2 text-[13.5px] font-medium transition-colors rounded-lg",
          active ? "text-[var(--aura-purple)]" : "text-[var(--aura-body)] hover:text-[var(--aura-heading)]"
        )}
      >
        {t(item.labelKey, item.label)}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 pt-2"
          onMouseEnter={enter}
          onMouseLeave={leave}
        >
          <div className="w-[280px] rounded-[14px] border border-[var(--aura-border)] bg-white p-2 shadow-[var(--aura-shadow-lg)]">
            {item.children!.map((child) => {
              const childActive = isRouteActive(pathname, child.href);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setOpen(false)}
                  aria-current={childActive ? "page" : undefined}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-[10px] px-3 py-2.5 transition-colors",
                    childActive
                      ? "bg-[var(--aura-lavender)] text-[var(--aura-purple)]"
                      : "hover:bg-[var(--aura-off-white)]"
                  )}
                >
                  <span className={cn("text-sm font-medium", childActive ? "text-[var(--aura-purple)]" : "text-[var(--aura-heading)]")}>
                    {t(child.labelKey, child.label)}
                  </span>
                  {child.description && (
                    <span className="text-xs text-[var(--aura-muted)] leading-relaxed">{child.descriptionKey ? t(child.descriptionKey, child.description) : child.description}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Navbar ── */
export function Navbar() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setMobileOpen(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-[9997] transition-all duration-300",
          scrolled
            ? "bg-white/90 backdrop-blur-xl border-b border-[var(--aura-border)] shadow-[var(--aura-shadow-xs)]"
            : "bg-white border-b border-transparent"
        )}
      >
        <nav className="mx-auto flex h-16 max-w-[82rem] items-center justify-between px-4 sm:px-6 lg:px-10" aria-label={t("a11y.primaryNavigation")}>
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5 group" aria-label={t("a11y.home")}>
            <span
              className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--aura-purple)] font-semibold text-white text-sm shadow-[var(--aura-shadow-xs)] transition-transform duration-200 group-hover:scale-105"
              aria-hidden="true"
            >
              A
            </span>
            <span className="text-lg font-semibold tracking-tight text-[var(--aura-heading)]">Aura</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-0.5 lg:flex">
            {NAV_ITEMS.map((item) =>
              item.children ? (
                <NavDropdown key={item.label} item={item} pathname={pathname} />
              ) : (
                <Link
                  key={item.href}
                  href={item.href!}
                  aria-current={isRouteActive(pathname, item.href!) ? "page" : undefined}
                  className={cn(
                    "px-3 py-2 text-[13.5px] font-medium transition-colors rounded-lg",
                    isRouteActive(pathname, item.href!)
                      ? "text-[var(--aura-purple)]"
                      : "text-[var(--aura-body)] hover:text-[var(--aura-heading)]"
                  )}
                >
                  {t(item.labelKey, item.label)}
                </Link>
              )
            )}
          </div>

          {/* Desktop Right */}
          <div className="hidden shrink-0 items-center gap-3 lg:flex">
            <LanguageSelector />

            <Link
              href={CTA_LINKS.login}
              className="px-3 py-2 text-sm font-medium text-[var(--aura-body)] transition-colors hover:text-[var(--aura-heading)]"
            >
              {t("navigation.login")}
            </Link>

            <Link
              href={CTA_LINKS.demo}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--aura-purple)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--aura-purple-hover)] hover:shadow-[var(--aura-shadow-md)]"
            >
              {t("navigation.demo")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              href={CTA_LINKS.demo}
              className="hidden sm:inline-flex items-center rounded-full bg-[var(--aura-purple)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
            >
              {t("navigation.demo")}
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className={cn(
                "grid h-10 w-10 place-items-center rounded-lg border transition-colors",
                mobileOpen
                  ? "border-[var(--aura-border)] bg-[var(--aura-lavender)] text-[var(--aura-purple)]"
                  : "border-[var(--aura-border)] text-[var(--aura-heading)] hover:bg-[var(--aura-off-white)]"
              )}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </nav>
      </header>

      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        links={ALL_NAV_LINKS}
        ctaLinks={CTA_LINKS}
        pathname={pathname}
      />
    </>
  );
}
