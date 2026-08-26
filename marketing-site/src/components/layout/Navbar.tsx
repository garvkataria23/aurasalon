"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, ArrowRight } from "lucide-react";
import { CTA_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { MobileMenu } from "./MobileMenu";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { GoogleTranslate } from "@/components/ui/GoogleTranslate";

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
    label: "Solutions",
    labelKey: "navigation.solutions",
    children: [
      { label: "Hair Salons & Barbershops", labelKey: "nav.hair-salons", href: "/solutions/hair-salon-software", description: "Smart chair booking, walk-in queues & fast POS billing" },
      { label: "Spas & Ayurvedic Wellness", labelKey: "nav.spas-wellness", href: "/solutions/spa-software", description: "Therapy suites, Panchakarma plans & dispensary control" },
      { label: "Nails, Lash & PMU Studios", labelKey: "nav.beauty-clinics", href: "/solutions/nail-salon-software", description: "Infill recall, digital consent waivers & photo dossiers" },
      { label: "Skin, Laser & Medspa Clinics", labelKey: "nav.medspa-clinics", href: "/solutions/skin-clinic-software", description: "Fitzpatrick charts, treatment series & clinical notes" },
      { label: "Tattoo, Pet & Mobile Studios", labelKey: "nav.specialized-studios", href: "/solutions/tattoo-studio-software", description: "Consent forms, breed size engine & travel buffers" },
      { label: "Browse All 35+ Industry Solutions →", labelKey: "nav.all-solutions", href: "/solutions", description: "Explore the complete industry vertical suite" },
    ],
  },
  {
    label: "Features",
    labelKey: "nav.features",
    children: [
      { label: "Online Booking & Scheduling", labelKey: "nav.appointments", href: "/features/appointments", description: "24/7 self-service booking & WhatsApp reminders" },
      { label: "POS & GST Invoicing", labelKey: "nav.billing", href: "/features/billing", description: "3-click checkout, split payments & GST bills" },
      { label: "Client CRM & Loyalty", labelKey: "nav.crm", href: "/features/client-crm", description: "Visit history, preferences & wallet points" },
      { label: "Staff Roster & Payroll", labelKey: "nav.staff", href: "/features/staff-management", description: "Shifts, biometric attendance & auto-commissions" },
      { label: "Inventory & Recipe Control", labelKey: "nav.inventory", href: "/features/inventory", description: "Stock deductions, auto-PO & low stock alerts" },
      { label: "Marketing AI & Automation", labelKey: "nav.marketing", href: "/features/marketing-ai", description: "2-way WhatsApp campaigns & winback journeys" },
      { label: "All Features Overview", labelKey: "nav.allFeatures", href: "/features", description: "Explore the complete operating suite" },
    ],
  },
  {
    label: "Products",
    labelKey: "navigation.products",
    children: [
      { label: "Platform Overview", labelKey: "nav.platform-overview", href: "/platform", description: "All-in-one connected salon operating system" },
      { label: "Owner CRM & POS", labelKey: "nav.owner-crm", href: "/owner-crm", description: "Front desk command center, billing & daily closing" },
      { label: "Customer Booking App", labelKey: "nav.customer-app", href: "/customer-app", description: "Pay-at-salon client booking & loyalty wallet" },
      { label: "Staff & Stylist App", labelKey: "nav.staff-app", href: "/staff-app", description: "Attendance, live schedule & commission tracking" },
      { label: "Operational Workflows", labelKey: "nav.workflows-page", href: "/workflows", description: "8-step automated salon lifecycle pipeline" },
    ],
  },
  {
    label: "Free Tools",
    labelKey: "navigation.tools",
    children: [
      { label: "18 Interactive ROI Calculators", labelKey: "nav.calculators", href: "/calculators", description: "CLV, break-even, color waste & commission calculators" },
      { label: "Software Comparison Hub", labelKey: "nav.comparisons", href: "/compare", description: "Aura vs Fresha, Phorest, Zenoti, Invoay & 26 tools" },
      { label: "Salon SOPs & Policy Templates", labelKey: "nav.templates", href: "/templates", description: "Staff attendance policies, GST checklists & logs" },
      { label: "Global City Hubs (84+ Cities)", labelKey: "nav.city-hubs", href: "/salon-software", description: "London, New York, Dubai, Singapore, Delhi & more" },
    ],
  },
  { label: "Pricing", labelKey: "nav.pricing", href: "/pricing" },
  {
    label: "Resources",
    labelKey: "navigation.resources",
    children: [
      { label: "Blog & Guides", labelKey: "nav.blog", href: "/blog", description: "Salon growth strategies & industry insights" },
      { label: "Help Center & Documentation", labelKey: "navigation.help", href: "/help", description: "38+ step-by-step guides & onboarding support" },
      { label: "Salon Glossary & Terms", labelKey: "navigation.glossary", href: "/glossary", description: "74+ salon management terms and metrics explained" },
      { label: "Customer Stories", labelKey: "nav.customers", href: "/customers", description: "See how top salons scale with Aura" },
      { label: "Contact Sales", labelKey: "navigation.contact", href: "/contact", description: "Get in touch with our salon consultants" },
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
          active ? "bg-white/12 text-white" : "text-white/74 hover:bg-white/10 hover:text-white"
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
            ? "bg-[#2D176F]/95 backdrop-blur-xl border-b border-white/10 shadow-[0_14px_40px_rgba(45,23,111,0.18)]"
            : "bg-[#2D176F] border-b border-white/10"
        )}
      >
        <nav className="mx-auto flex h-16 max-w-[82rem] items-center justify-between px-4 sm:px-6 lg:px-10" aria-label={t("a11y.primaryNavigation")}>
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5 group">
            <span
              className="grid h-8 w-8 place-items-center rounded-xl bg-white font-semibold text-[#2D176F] text-sm shadow-[0_10px_26px_rgba(0,0,0,0.14)] transition-transform duration-200 group-hover:scale-105"
              aria-hidden="true"
            >
              A
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">Aura</span>
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
                      ? "bg-white/12 text-white"
                      : "text-white/74 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {t(item.labelKey, item.label)}
                </Link>
              )
            )}
          </div>

          {/* Desktop Right */}
          <div className="hidden shrink-0 items-center gap-3 lg:flex">
            <GoogleTranslate id="google_translate_desktop" />

            <Link
              href={CTA_LINKS.demo}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2D176F] shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--aura-lavender)] hover:shadow-[0_18px_44px_rgba(0,0,0,0.22)]"
            >
              {t("navigation.demo")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              href={CTA_LINKS.demo}
              className="hidden min-h-11 items-center rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-[#2D176F] shadow-sm sm:inline-flex"
            >
              {t("navigation.demo")}
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-lg border transition-colors",
                mobileOpen
                  ? "border-[var(--aura-border)] bg-[var(--aura-lavender)] text-[var(--aura-purple)]"
                  : "border-white/18 text-white hover:bg-white/10"
              )}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </nav>
        <div className="nav-zigzag-edge" aria-hidden="true" />
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
