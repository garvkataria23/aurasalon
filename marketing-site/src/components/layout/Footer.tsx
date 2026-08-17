"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";

const FOOTER_SECTIONS = [
  {
    title: "Product",
    links: [
      { label: "Appointments", href: "/features/appointments" },
      { label: "POS & Billing", href: "/features/billing" },
      { label: "Client CRM", href: "/features/client-crm" },
      { label: "Staff & Shifts", href: "/features/staff-management" },
      { label: "Inventory", href: "/features/inventory" },
      { label: "Memberships & Loyalty", href: "/features" },
      { label: "Marketing AI", href: "/features/marketing-ai" },
      { label: "Finance & Analytics", href: "/features/finance" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Hair Salons", href: "/platform" },
      { label: "Luxury Spas", href: "/workflows" },
      { label: "Nail Studios", href: "/owner-crm" },
      { label: "Beauty Clinics", href: "/customer-app" },
      { label: "Multi-Location Chains", href: "/platform" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Contact Sales", href: "/contact" },
      { label: "Customers", href: "/customers" },
      { label: "Book a Demo", href: "/demo" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Industry Blog", href: "/blog" },
      { label: "Help Centre & FAQ", href: "/faq" },
      { label: "Growth Guides", href: "/blog" },
      { label: "Support Desk", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  },
];

export function Footer() {
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
                Everything your salon needs to grow. The connected operating system for modern salons, spas, and aesthetic clinics across India.
              </p>

              <div className="mt-6 flex items-center gap-3">
                <Link
                  href={CTA_LINKS.demo}
                  className="inline-flex items-center gap-1.5 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[var(--aura-purple-hover)]"
                >
                  <span>Book a Demo</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  href={CTA_LINKS.login}
                  className="rounded-[var(--aura-radius-btn)] border border-[var(--aura-border)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--aura-heading)] hover:bg-[var(--aura-lavender)]"
                >
                  Log in
                </Link>
              </div>
            </div>

            {/* Navigation Columns */}
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title} className="col-span-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] mb-4">
                  {section.title}
                </h3>
                <ul className="space-y-2.5">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-xs text-[var(--aura-body)] transition-colors hover:text-[var(--aura-purple)]"
                      >
                        {link.label}
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
          <p>&copy; {new Date().getFullYear()} Aura Salon Software. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-[var(--aura-heading)] transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[var(--aura-heading)] transition-colors">
              Terms
            </Link>
            <Link href="/cookies" className="hover:text-[var(--aura-heading)] transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
