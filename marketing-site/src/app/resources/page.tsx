import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { RESOURCE_HUBS } from "@/lib/authority-assets";
import { Breadcrumbs, breadcrumbJsonLdFromCrumbs } from "@/components/seo/Breadcrumbs";
import { SITE_URL } from "@/lib/site";

export const metadata = {
  title: "Salon Resources — Guides, Templates, Calculators & Glossary",
  description: "Explore Aura salon resources by topic: billing, staff, inventory, marketing and CRM workflows.",
  alternates: { canonical: `${SITE_URL}/resources` },
};

export default function ResourcesPage() {
  const crumbs = [{ name: "Home", href: "/" }, { name: "Resources", href: "/resources" }];
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Salon Resources",
    url: `${SITE_URL}/resources`,
    hasPart: RESOURCE_HUBS.map((hub) => ({ "@type": "WebPage", name: hub.title, url: `${SITE_URL}/resources/${hub.slug}` })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLdFromCrumbs(crumbs)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
      <section className="bg-white py-28">
        <Container>
          <Breadcrumbs crumbs={crumbs} />
          <h1 className="text-4xl font-bold tracking-[-0.04em]">Salon resources</h1>
          <p className="mt-4 max-w-2xl text-[var(--aura-body)]">Topic hubs for salon owners who want practical guides, calculators, templates and workflows in one place.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {RESOURCE_HUBS.map((hub) => (
              <Link key={hub.slug} href={`/resources/${hub.slug}`} className="rounded-3xl border border-[var(--aura-border)] p-6 shadow-[var(--aura-shadow-sm)]">
                <h2 className="text-xl font-bold">{hub.title}</h2>
                <p className="mt-2 text-sm text-[var(--aura-body)]">{hub.focus}</p>
              </Link>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
