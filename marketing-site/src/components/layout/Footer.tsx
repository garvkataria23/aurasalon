"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Globe } from "lucide-react";
import { Container } from "@/components/ui/Container";

const CITIES_LIST = [
  "Pune", "Mumbai", "Hyderabad", "Bangalore", "Delhi NCR", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Surat", "Chandigarh", "Lucknow", "Kochi", "Indore"
];

const SOLUTIONS_GROUPS = [
  {
    title: "Salon & Grooming",
    links: [
      { label: "Salon Booking Software", href: "/features/appointments", desc: "Online booking & calendar for hair salons" },
      { label: "Barbershop Booking Software", href: "/owner-crm", desc: "Streamline walk-ins & fast checkouts" },
      { label: "Nail Salon Booking Software", href: "/features/billing", desc: "Appointment scheduling & technician turns" },
      { label: "Pet Salon Booking Software", href: "/features/client-crm", desc: "Customer data & pet grooming profiles" },
    ],
  },
  {
    title: "Spa & Wellness",
    links: [
      { label: "Spa Booking Software", href: "/workflows", desc: "Schedule therapists & manage room inventory" },
      { label: "Wellness Center Booking", href: "/platform", desc: "Holistic health & prepaid package tracking" },
      { label: "Gym & Yoga Booking", href: "/features", desc: "Recurring memberships & attendance" },
      { label: "Massage Studio Software", href: "/features/appointments", desc: "Therapist roster & commission management" },
    ],
  },
  {
    title: "Clinics & Studios",
    links: [
      { label: "Beauty Clinic Software", href: "/customer-app", desc: "Treatment procedures & client histories" },
      { label: "Skin Clinic Booking Software", href: "/features/client-crm", desc: "Consultation forms & session packages" },
      { label: "Tattoo Studio Software", href: "/features", desc: "Book tattoo sessions & manage artist rosters" },
      { label: "Aesthetic Med Spa", href: "/platform", desc: "Multi-session courses & practitioner charts" },
    ],
  },
  {
    title: "Key Players",
    links: [
      { label: "Software for Owners", href: "/owner-crm", desc: "Profit intelligence & multi-branch dashboards" },
      { label: "Software for Managers", href: "/features/staff-management", desc: "Track staff targets, commissions & payroll" },
      { label: "Software for Receptionists", href: "/features/billing", desc: "3-click GST POS billing & walk-in queues" },
      { label: "Software for Stylists", href: "/staff-app", desc: "Personal appointment roster & earnings view" },
      { label: "Software for Marketing Team", href: "/features/marketing-ai", desc: "2-way WhatsApp automation & winback flows" },
    ],
  },
];

const COUNTRIES = [
  "India", "United States", "United Arab Emirates", "Saudi Arabia", "Qatar", "Oman", "Kuwait", "Singapore", "United Kingdom"
];

export function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail) {
      setSubscribed(true);
    }
  };

  return (
    <footer className="border-t border-[var(--aura-border)] bg-[#181224] text-white/80 pt-16 pb-12">
      <Container size="wide">
        
        {/* Top Newsletter & Brand Header */}
        <div className="grid gap-10 lg:grid-cols-12 border-b border-white/10 pb-12">
          
          {/* Brand + Newsletter */}
          <div className="lg:col-span-4 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 font-bold text-white text-base shadow-md">
                A
              </span>
              <span className="text-xl font-bold tracking-tight text-white">Aura Salon OS</span>
            </Link>
            <p className="text-xs text-white/70 leading-relaxed max-w-sm">
              The connected salon &amp; spa operating system. Automate online bookings, 3-click GST billing, staff payroll, inventory recipes, and 2-way WhatsApp marketing.
            </p>

            {/* Newsletter Box */}
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
                Stay Updated
              </p>
              <p className="text-xs text-white/60 mb-3">
                Subscribe to our newsletter for the latest salon industry updates and marketing insights.
              </p>
              {subscribed ? (
                <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/30 p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> You&apos;re subscribed! Welcome aboard.
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex items-center gap-2">
                  <input
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email..."
                    className="w-full rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-xs text-white placeholder:text-white/40 outline-none focus:border-purple-400 focus:bg-white/15"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-xl bg-[var(--aura-purple)] px-4 py-2.5 text-xs font-bold text-white hover:bg-[var(--aura-purple-hover)] transition-colors cursor-pointer"
                  >
                    Subscribe
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Quick Links Group (Cities, About, Partners) */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
                Top Hubs
              </h3>
              <ul className="space-y-1.5 text-xs text-white/70">
                {CITIES_LIST.slice(0, 7).map((city) => (
                  <li key={city}>
                    <Link href="/demo" className="hover:text-purple-300 transition-colors">
                      {city} Salons
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
                About &amp; Resources
              </h3>
              <ul className="space-y-1.5 text-xs text-white/70">
                <li><Link href="/about" className="hover:text-purple-300 transition-colors">About Us</Link></li>
                <li><Link href="/blog" className="hover:text-purple-300 transition-colors">Salon Growth Blog</Link></li>
                <li><Link href="/faq" className="hover:text-purple-300 transition-colors">Help Docs &amp; FAQ</Link></li>
                <li><Link href="/customers" className="hover:text-purple-300 transition-colors">Customer Stories</Link></li>
                <li><Link href="/pricing" className="hover:text-purple-300 transition-colors">Pricing Plans</Link></li>
                <li><Link href="/contact" className="hover:text-purple-300 transition-colors">Contact Support</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
                For Business
              </h3>
              <ul className="space-y-1.5 text-xs text-white/70">
                <li><Link href="/demo" className="hover:text-purple-300 transition-colors">Book a Demo</Link></li>
                <li><Link href="/contact" className="hover:text-purple-300 transition-colors">Franchise Partner</Link></li>
                <li><Link href="/contact" className="hover:text-purple-300 transition-colors">Affiliate Program</Link></li>
                <li><Link href="/privacy" className="hover:text-purple-300 transition-colors">Data Privacy &amp; Security</Link></li>
                <li><Link href="/terms" className="hover:text-purple-300 transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

        </div>

        {/* Detailed Solutions by Segment */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 py-12 border-b border-white/10">
          {SOLUTIONS_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-bold text-white mb-4 border-l-2 border-[var(--aura-purple)] pl-2.5">
                {group.title}
              </h4>
              <ul className="space-y-3">
                {group.links.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="group block">
                      <p className="text-xs font-semibold text-white/90 group-hover:text-purple-300 transition-colors">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-white/50 group-hover:text-white/70 transition-colors line-clamp-1">
                        {item.desc}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Global Countries Served Bar */}
        <div className="py-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-white/60">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-purple-400" />
            <span className="font-semibold text-white">Serving Salons &amp; Spas Across:</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {COUNTRIES.map((country, idx) => (
              <span key={country}>
                <span className="hover:text-white transition-colors">{country}</span>
                {idx < COUNTRIES.length - 1 && <span className="text-white/20 ml-4">|</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50">
          <p>© {new Date().getFullYear()} Aura Salon OS. All rights reserved. Made for Indian &amp; Global Salons.</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Use</Link>
            <Link href="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link>
          </div>
        </div>

      </Container>
    </footer>
  );
}
