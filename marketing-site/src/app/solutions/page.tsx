import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs, breadcrumbJsonLdFromCrumbs } from "@/components/seo/Breadcrumbs";
import { SEGMENT_PAGES } from "@/lib/seo-enhancements";
import { SEGMENT_CONTENT } from "@/lib/segment-content";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Salon Solutions — Software for Every Beauty Business",
  description:
    "Purpose-built workflows for spas, salons, barber shops, clinics, chains and more. Find the Aura solution shaped around your business.",
  alternates: { canonical: `${SITE_URL}/solutions` },
};

export default function SolutionsHubPage() {
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Solutions", href: "/solutions" },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLdFromCrumbs(crumbs)) }} />
      <section className="relative overflow-hidden bg-gradient-to-b from-[var(--aura-lavender)] via-[var(--aura-lavender)] to-[var(--aura-off-white)]">
        <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-[var(--aura-purple)]/12 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-[var(--aura-purple-soft)] blur-3xl" aria-hidden="true" />
        <Container className="relative py-20 text-center md:py-28">
          <Breadcrumbs crumbs={crumbs} />
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/15 bg-white/75 px-4 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)] shadow-[0_10px_30px_rgba(111,79,216,0.08)] backdrop-blur-md">
            15 purpose-built solutions
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.06] tracking-[-0.04em] text-[var(--aura-heading)]">One platform, shaped around your beauty business</h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty leading-8 text-[var(--aura-body)]">Spa or salon chain, barber shop or skin clinic — pick your business type and see exactly how Aura runs booking, billing, clients, staff, stock and growth for you.</p>
        </Container>
      </section>

      <section className="bg-[var(--aura-off-white)] pb-20 md:pb-28">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SEGMENT_PAGES.map((segment) => {
              const data = SEGMENT_CONTENT.find((item) => item.slug === segment.slug);
              if (!data) return null;
              const Icon = data.icon;
              return (
                <Link key={segment.slug} href={`/solutions/${segment.slug}`} className="group flex flex-col rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-7 shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--aura-purple)]/25 hover:shadow-[var(--aura-shadow-lg)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--aura-lavender)] ring-8 ring-[var(--aura-lavender)]/50 transition-colors group-hover:bg-[var(--aura-lavender-strong)] motion-reduce:transition-none">
                    <Icon className="h-6 w-6 text-[var(--aura-purple)]" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 font-bold text-[var(--aura-heading)] transition-colors group-hover:text-[var(--aura-purple)] motion-reduce:transition-none">{segment.name}</h2>
                  <p className="mt-1.5 text-sm font-semibold text-[var(--aura-purple)]">{data.tagline}</p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--aura-body)]">{data.intro}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-[var(--aura-purple)]">
                    Explore solution
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>
    </>
  );
}
