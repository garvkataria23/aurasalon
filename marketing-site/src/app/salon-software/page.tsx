import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CITY_PAGES } from "@/lib/seo-enhancements";
import { Breadcrumbs, breadcrumbJsonLdFromCrumbs } from "@/components/seo/Breadcrumbs";
import { SITE_URL } from "@/lib/site";

export const metadata = {
  title: "Salon Software by City — Aura CRM/POS India",
  description: "Find Aura salon software resources for Indian cities: booking, POS, GST billing, CRM, staff, inventory and marketing workflows.",
  alternates: { canonical: `${SITE_URL}/salon-software` },
};

export default function SalonSoftwareIndexPage() {
  const crumbs = [{ name: "Home", href: "/" }, { name: "Salon Software", href: "/salon-software" }];
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Salon Software by City",
    url: `${SITE_URL}/salon-software`,
    hasPart: CITY_PAGES.map((city) => ({ "@type": "WebPage", name: `Salon software in ${city.name}`, url: `${SITE_URL}/salon-software/${city.slug}` })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLdFromCrumbs(crumbs)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
      <section className="bg-[var(--aura-off-white)] py-28">
        <Container>
          <Breadcrumbs crumbs={crumbs} />
          <h1 className="text-4xl font-bold tracking-[-0.04em]">Salon software by city</h1>
          <p className="mt-4 max-w-2xl text-[var(--aura-body)]">Local landing pages for Indian salons looking for booking, POS, CRM, staff, inventory and marketing workflows.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CITY_PAGES.map((city) => (
              <Link key={city.slug} href={`/salon-software/${city.slug}`} className="rounded-2xl bg-white p-4 font-semibold text-[var(--aura-heading)] shadow-[var(--aura-shadow-sm)]">
                {city.name}
              </Link>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
