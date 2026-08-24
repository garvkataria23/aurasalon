import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Package,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs, breadcrumbJsonLdFromCrumbs } from "@/components/seo/Breadcrumbs";
import { SEGMENT_PAGES } from "@/lib/seo-enhancements";
import { SEGMENT_CONTENT } from "@/lib/segment-content";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return SEGMENT_PAGES.map((item) => ({ segment: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ segment: string }> }): Promise<Metadata> {
  const { segment } = await params;
  const data = SEGMENT_PAGES.find((item) => item.slug === segment);
  if (!data) return { title: "Salon Solutions" };
  return {
    title: `${data.name} — Booking, POS, CRM & Staff Workflows`,
    description: `Aura helps ${data.audience} run booking, POS, CRM, staff, inventory and marketing from one connected platform.`,
    alternates: { canonical: `${SITE_URL}/solutions/${data.slug}` },
  };
}

const CAPABILITIES = [
  { icon: Calendar, title: "Online booking & smart calendar", text: "Fill chairs round-the-clock with a shareable booking link, buffers and stylist-wise slots." },
  { icon: Users, title: "Client CRM & preferences", text: "Service history, formulas, notes and spend patterns on one profile that every branch can see." },
  { icon: Wallet, title: "GST-ready POS billing", text: "Fast checkout with packages, splits, discounts under control and clean GST invoices." },
  { icon: UserCheck, title: "Staff rosters & commissions", text: "Roster-linked capacity plus transparent commission rules computed per visit." },
  { icon: Package, title: "Inventory & purchase control", text: "Recipe-based consumption, reorder alerts and expiry tracking stop silent stock loss." },
  { icon: BarChart3, title: "Owner reports & insights", text: "Daily revenue, retention, staff and stock numbers without waiting for month-end." },
];

const STEPS = [
  { icon: Calendar, title: "Booked", text: "Client books online or the desk adds them in seconds — slot, stylist and duration locked." },
  { icon: Sparkles, title: "Served", text: "Preferences and history open at check-in so the team delivers a personal experience." },
  { icon: Wallet, title: "Billed", text: "One-screen POS handles services, retail, packages and payments with GST built in." },
  { icon: TrendingUp, title: "Grown", text: "Rebooking nudges, win-back lists and owner dashboards turn visits into repeat revenue." },
];

export default async function SegmentPage({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params;
  const meta = SEGMENT_PAGES.find((item) => item.slug === segment) ?? SEGMENT_PAGES[0];
  const data = SEGMENT_CONTENT.find((item) => item.slug === meta.slug) ?? SEGMENT_CONTENT[0];
  const Icon = data.icon;
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Solutions", href: "/solutions" },
    { name: meta.name, href: `/solutions/${meta.slug}` },
  ];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
  const others = SEGMENT_PAGES.filter((item) => item.slug !== meta.slug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLdFromCrumbs(crumbs)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[var(--aura-lavender)] via-[var(--aura-lavender)] to-[var(--aura-off-white)]">
        <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-[var(--aura-purple)]/12 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-[var(--aura-purple-soft)] blur-3xl" aria-hidden="true" />
        <Container className="relative py-20 md:py-28">
          <Breadcrumbs crumbs={crumbs} />
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/15 bg-white/75 px-4 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)] shadow-[0_10px_30px_rgba(111,79,216,0.08)] backdrop-blur-md">
              <Icon className="h-4 w-4" aria-hidden="true" />
              Solution for {meta.audience}
            </span>
            <h1 className="mt-6 text-balance text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.06] tracking-[-0.04em] text-[var(--aura-heading)]">
              {meta.name}
            </h1>
            <p className="mt-4 text-lg font-semibold text-[var(--aura-purple)] md:text-xl">{data.tagline}</p>
            <p className="mx-auto mt-4 max-w-2xl text-pretty leading-8 text-[var(--aura-body)]">{data.intro}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/demo" className="group inline-flex items-center gap-2 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] px-7 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(111,79,216,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[var(--aura-purple-hover)] hover:shadow-[0_18px_40px_rgba(111,79,216,0.42)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                Book a free demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </Link>
              <Link href="/pricing" className="inline-flex items-center gap-2 rounded-[var(--aura-radius-btn)] border border-[var(--aura-border-strong)] bg-white/80 px-7 py-3.5 text-sm font-bold text-[var(--aura-heading)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[var(--aura-purple)]/30 hover:text-[var(--aura-purple)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                View pricing
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-[var(--aura-muted)]">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[var(--aura-success)]" aria-hidden="true" /> Free onboarding help</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-[var(--aura-success)]" aria-hidden="true" /> Live in under a week</span>
              <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" /> Rated 4.8 by salon owners</span>
            </div>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-14 max-w-5xl">
            <dl className="grid grid-cols-2 gap-4 rounded-[var(--aura-radius-xl)] border border-white/80 bg-white/85 p-6 shadow-[var(--aura-shadow-lg)] backdrop-blur-xl md:grid-cols-4 md:p-8">
              {data.stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <dd className="text-2xl font-bold tracking-tight text-[var(--aura-purple)] md:text-3xl">{stat.value}</dd>
                  <dt className="mt-1 text-xs font-semibold leading-snug text-[var(--aura-muted)] md:text-sm">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </Container>
      </section>

      {/* Challenges -> Fix */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">The daily reality</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-[-0.03em] text-[var(--aura-heading)] md:text-4xl">Problems we fix for {meta.audience}</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {data.challenges.map((challenge, index) => (
              <article key={challenge.title} className="group relative overflow-hidden rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-7 shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--aura-purple)]/25 hover:shadow-[var(--aura-shadow-lg)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <span className="absolute -right-3 -top-5 select-none text-[88px] font-black leading-none text-[var(--aura-lavender-strong)] transition-colors group-hover:text-[var(--aura-purple)]/15 motion-reduce:transition-none" aria-hidden="true">{index + 1}</span>
                <h3 className="relative text-lg font-bold text-[var(--aura-heading)]">{challenge.title}</h3>
                <p className="relative mt-3 flex gap-2 text-sm leading-6 text-[var(--aura-body)]">
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--aura-danger)]" aria-hidden="true" />
                  {challenge.problem}
                </p>
                <div className="relative mt-4 rounded-2xl bg-[var(--aura-off-white)] p-4">
                  <p className="flex gap-2 text-sm leading-6 text-[var(--aura-body)]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--aura-success)]" aria-hidden="true" />
                    <span><strong className="font-semibold text-[var(--aura-heading)]">With Aura:</strong> {challenge.fix}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* Capabilities */}
      <section className="bg-[var(--aura-off-white)] py-20 md:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">One connected platform</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-[-0.03em] text-[var(--aura-heading)] md:text-4xl">Everything your {meta.name.toLowerCase().replace(" software", "")} needs</h2>
            <p className="mt-4 text-[var(--aura-body)]">Booking, billing, clients, staff, stock and reporting finally live in one system — no more stitching six tools together.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <article key={capability.title} className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-7 shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--aura-purple)]/25 hover:shadow-[var(--aura-shadow-md)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--aura-lavender)] ring-8 ring-[var(--aura-lavender)]/50">
                  <capability.icon className="h-6 w-6 text-[var(--aura-purple)]" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-bold text-[var(--aura-heading)]">{capability.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--aura-body)]">{capability.text}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* How it works + outcomes */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">How it flows</p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-[-0.03em] text-[var(--aura-heading)] md:text-4xl">From booked to repeat client</h2>
              <ol className="mt-10 space-y-0">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="relative flex gap-5 pb-10 last:pb-0">
                    {index < STEPS.length - 1 && <span className="absolute left-[26px] top-14 h-[calc(100%-56px)] w-px bg-[var(--aura-border-strong)]" aria-hidden="true" />}
                    <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-[var(--aura-lavender)] ring-8 ring-[var(--aura-lavender)]/40">
                      <step.icon className="h-6 w-6 text-[var(--aura-purple)]" aria-hidden="true" />
                    </div>
                    <div className="pt-1.5">
                      <p className="text-sm font-bold uppercase tracking-wider text-[var(--aura-muted)]">Step {index + 1}</p>
                      <h3 className="mt-0.5 font-bold text-[var(--aura-heading)]">{step.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--aura-body)]">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-[var(--aura-radius-xl)] bg-gradient-to-br from-[var(--aura-purple)] to-[var(--aura-purple-hover)] p-8 text-white shadow-[0_24px_60px_rgba(93,63,194,0.35)] md:p-10">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[.16em]">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                What you get
              </p>
              <h3 className="mt-5 text-balance text-2xl font-bold tracking-tight md:text-3xl">{data.tagline}</h3>
              <ul className="mt-8 space-y-4">
                {data.outcomes.map((outcome) => (
                  <li key={outcome} className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 text-sm font-medium leading-6 backdrop-blur-sm">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" aria-hidden="true" />
                    {outcome}
                  </li>
                ))}
              </ul>
              <Link href="/demo" className="group mt-8 inline-flex items-center gap-2 rounded-[var(--aura-radius-btn)] bg-white px-6 py-3 text-sm font-bold text-[var(--aura-purple)] shadow-[0_10px_26px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                See it on your workflow
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Other solutions */}
      <section className="bg-[var(--aura-off-white)] py-20 md:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">Built for every salon business</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-[-0.03em] text-[var(--aura-heading)] md:text-4xl">Explore other Aura solutions</h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {others.map((other) => {
              const OtherIcon = SEGMENT_CONTENT.find((item) => item.slug === other.slug)?.icon ?? Sparkles;
              return (
                <Link key={other.slug} href={`/solutions/${other.slug}`} className="group flex flex-col items-center gap-3 rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-6 text-center shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--aura-purple)]/25 hover:shadow-[var(--aura-shadow-md)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--aura-lavender)] transition-colors group-hover:bg-[var(--aura-lavender-strong)] motion-reduce:transition-none">
                    <OtherIcon className="h-5 w-5 text-[var(--aura-purple)]" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-bold leading-snug text-[var(--aura-heading)] group-hover:text-[var(--aura-purple)] motion-reduce:transition-none">{other.name}</span>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="bg-white py-20 md:py-28">
        <Container size="narrow">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">Questions</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-[-0.03em] text-[var(--aura-heading)] md:text-4xl">{meta.name} — FAQs</h2>
          </div>
          <div className="mt-10 space-y-4">
            {data.faqs.map((faq) => (
              <details key={faq.question} className="group rounded-[var(--aura-radius-lg)] border border-[var(--aura-border)] bg-[var(--aura-off-white)] px-6 py-5 shadow-[var(--aura-shadow-xs)] transition-colors open:border-[var(--aura-purple)]/25 open:bg-white motion-reduce:transition-none">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-bold text-[var(--aura-heading)] [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--aura-lavender)] text-[var(--aura-purple)] transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-[var(--aura-body)]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[var(--aura-purple)] to-[var(--aura-purple-hover)] py-20 md:py-24">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <Container className="relative text-center">
          <h2 className="text-balance text-3xl font-bold tracking-[-0.03em] text-white md:text-4xl">Ready to run your {meta.name.toLowerCase().replace(" software", "")} on Aura?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty leading-7 text-white/85">See booking, billing, CRM and reporting working together for businesses exactly like yours. Free demo, no pressure.</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/demo" className="group inline-flex items-center gap-2 rounded-[var(--aura-radius-btn)] bg-white px-8 py-3.5 text-sm font-bold text-[var(--aura-purple)] shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition-all hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              Book a free demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </Link>
            <a href="tel:+919999999999" className="inline-flex items-center gap-2 rounded-[var(--aura-radius-btn)] border border-white/40 px-8 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-white/10 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <Phone className="h-4 w-4" aria-hidden="true" />
              Talk to sales
            </a>
          </div>
        </Container>
      </section>
    </>
  );
}
