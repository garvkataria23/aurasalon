import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { FEATURE_DETAIL_PAGES } from "@/lib/authority-assets";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return FEATURE_DETAIL_PAGES.map((item) => ({ feature: item.group, subfeature: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ feature: string; subfeature: string }> }): Promise<Metadata> {
  const { feature, subfeature } = await params;
  const page = FEATURE_DETAIL_PAGES.find((item) => item.group === feature && item.slug === subfeature);
  if (!page) return { title: "Aura Features" };
  return {
    title: `${page.title} for Salons — Aura Feature`,
    description: `Aura ${page.title.toLowerCase()} helps salons solve this workflow: ${page.problem}.`,
    alternates: { canonical: `${SITE_URL}/features/${feature}/${subfeature}` },
  };
}

export default async function FeatureDetailPage({ params }: { params: Promise<{ feature: string; subfeature: string }> }) {
  const { feature, subfeature } = await params;
  const page = FEATURE_DETAIL_PAGES.find((item) => item.group === feature && item.slug === subfeature);
  if (!page) notFound();

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to use ${page.title} in a salon`,
    step: ["Define the salon rule", "Set the workflow in Aura", "Train the team", "Review the metric weekly"].map((text, index) => ({ "@type": "HowToStep", position: index + 1, text })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <section className="bg-[var(--aura-off-white)] py-28 md:py-36">
        <Container size="narrow">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">Feature detail</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-[var(--aura-heading)] md:text-5xl">{page.title} for salons</h1>
          <p className="mt-5 text-lg leading-8 text-[var(--aura-body)]">This page covers a specific salon workflow: {page.problem}. Aura connects it to booking, billing, CRM, staff, inventory and owner reporting where relevant.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <article className="rounded-3xl bg-white p-6 shadow-[var(--aura-shadow-sm)]">
              <h2 className="font-bold text-[var(--aura-heading)]">Why it matters</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--aura-body)]">A small workflow leak repeated daily becomes revenue loss, client confusion or owner stress.</p>
            </article>
            <article className="rounded-3xl bg-white p-6 shadow-[var(--aura-shadow-sm)]">
              <h2 className="font-bold text-[var(--aura-heading)]">How Aura helps</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--aura-body)]">Put the rule inside the daily screen the team already uses and make review data visible.</p>
            </article>
          </div>
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-[var(--aura-shadow-sm)]">
            <h2 className="font-bold text-[var(--aura-heading)]">Implementation checklist</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--aura-body)]">
              <li>Write the current manual process in one sentence.</li>
              <li>Choose the owner, manager or front-desk rule.</li>
              <li>Connect it to Aura and test with one real appointment or bill.</li>
              <li>Review adoption weekly before adding more rules.</li>
            </ol>
          </div>
          <Link href="/demo" className="mt-8 inline-flex rounded-full bg-[var(--aura-purple)] px-6 py-3 text-sm font-bold text-white">Book a demo</Link>
        </Container>
      </section>
    </>
  );
}
