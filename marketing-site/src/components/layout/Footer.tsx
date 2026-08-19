"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

const FOOTER_SECTIONS = [
  {
    title: "Product",
    titleKey: "footer.product",
    links: [
      { label: "Appointments", labelKey: "footer.appointments", href: "/features/appointments" },
      { label: "POS & Billing", labelKey: "footer.posBilling", href: "/features/billing" },
      { label: "Client CRM", labelKey: "footer.clientCrm", href: "/features/client-crm" },
      { label: "Staff & Shifts", labelKey: "footer.staffShifts", href: "/features/staff-management" },
      { label: "Inventory", labelKey: "footer.inventory", href: "/features/inventory" },
      { label: "Memberships & Loyalty", labelKey: "footer.memberships", href: "/features" },
      { label: "Marketing AI", labelKey: "footer.marketingAi", href: "/features/marketing-ai" },
      { label: "Finance & Analytics", labelKey: "footer.financeAnalytics", href: "/features/finance" },
    ],
  },
  {
    title: "Solutions",
    titleKey: "footer.solutions",
    links: [
      { label: "Hair Salons", labelKey: "footer.hairSalons", href: "/platform" },
      { label: "Luxury Spas", labelKey: "footer.luxurySpas", href: "/workflows" },
      { label: "Nail Studios", labelKey: "footer.nailStudios", href: "/owner-crm" },
      { label: "Beauty Clinics", labelKey: "footer.beautyClinics", href: "/customer-app" },
      { label: "Multi-Location Chains", labelKey: "footer.multiLocation", href: "/platform" },
    ],
  },
  {
    title: "Company",
    titleKey: "footer.company",
    links: [
      { label: "About Us", labelKey: "footer.aboutUs", href: "/about" },
      { label: "Contact Sales", labelKey: "footer.contactSales", href: "/contact" },
      { label: "Customers", labelKey: "footer.customers", href: "/customers" },
      { label: "Book a Demo", labelKey: "navigation.demo", href: "/demo" },
    ],
  },
  {
    title: "Resources",
    titleKey: "footer.resources",
    links: [
      { label: "Industry Blog", labelKey: "footer.industryBlog", href: "/blog" },
      { label: "Help Centre & FAQ", labelKey: "footer.helpFaq", href: "/faq" },
      { label: "Growth Guides", labelKey: "footer.growthGuides", href: "/blog" },
      { label: "Support Desk", labelKey: "footer.supportDesk", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    titleKey: "footer.legal",
    links: [
      { label: "Privacy Policy", labelKey: "footer.privacy", href: "/privacy" },
      { label: "Terms of Service", labelKey: "footer.terms", href: "/terms" },
      { label: "Cookie Policy", labelKey: "footer.cookies", href: "/cookies" },
    ],
  },
];

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-[var(--aura-border)] bg-[var(--aura-off-white)] text-[var(--aura-body)]">
      <Container>
        {/* Main Footer Links Grid */}
        <div className="py-16 md:py-20">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-6 lg:gap-10">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 group">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--aura-purple)] font-bold text-white text-sm">
                  A
                </span>
                <span className="text-lg font-bold tracking-tight text-[var(--aura-heading)]">Aura</span>
              </Link>
              <p className="mt-4 text-xs sm:text-sm leading-relaxed text-[var(--aura-body)] max-w-sm">
                {t("footer.description")}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={CTA_LINKS.demo}
                  className="inline-flex items-center gap-1.5 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[var(--aura-purple-hover)]"
                >
                  <span>{t("navigation.demo")}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  href={CTA_LINKS.login}
                  className="rounded-[var(--aura-radius-btn)] border border-[var(--aura-border)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--aura-heading)] hover:bg-[var(--aura-lavender)]"
                >
                  {t("navigation.login")}
                </Link>
                <LanguageSelector compact align="left" />
              </div>

              {/* Trust Badges */}
              <div className="mt-6 flex flex-wrap items-center gap-2 pt-4 border-t border-[var(--aura-border)]">
                <span className="inline-flex items-center gap-1 rounded-full bg-white border border-[var(--aura-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--aura-heading)] shadow-xs">
                  🇮🇳 Made for Indian Salons
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white border border-[var(--aura-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--aura-heading)] shadow-xs">
                  🛡️ 256-Bit Encrypted
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white border border-[var(--aura-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--aura-heading)] shadow-xs">
                  ⚡ GST Ready
                </span>
              </div>
            </div>

            {/* Navigation Columns */}
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title} className="col-span-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] mb-4">
                  {t(section.titleKey, section.title)}
                </h3>
                <ul className="space-y-2.5">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-xs text-[var(--aura-body)] transition-colors hover:text-[var(--aura-purple)]"
                      >
                        {t(link.labelKey, link.label)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[var(--aura-border)] py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--aura-muted)]">
          <p>&copy; {new Date().getFullYear()} {t("footer.copyright")}</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-[var(--aura-heading)] transition-colors">
              {t("footer.privacyShort")}
            </Link>
            <Link href="/terms" className="hover:text-[var(--aura-heading)] transition-colors">
              {t("footer.termsShort")}
            </Link>
            <Link href="/cookies" className="hover:text-[var(--aura-heading)] transition-colors">
              {t("footer.cookiesShort")}
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
