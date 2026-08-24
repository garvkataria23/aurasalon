import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CITY_PAGES } from "@/lib/seo-enhancements";
import { SITE_URL } from "@/lib/site";
import { Breadcrumbs, breadcrumbJsonLdFromCrumbs } from "@/components/seo/Breadcrumbs";

export function generateStaticParams() {
  return CITY_PAGES.map((city) => ({ city: city.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const data = CITY_PAGES.find((item) => item.slug === city);
  if (!data) return { title: "Salon Software" };
  return {
    title: `Salon Software in ${data.name} — CRM, POS, Booking & GST Billing`,
    description: `Aura helps ${data.name} salons manage booking, POS billing, client CRM, staff, inventory and marketing workflows from one connected system.`,
    alternates: { canonical: `${SITE_URL}/salon-software/${data.slug}` },
  };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const data = CITY_PAGES.find((item) => item.slug === city) ?? CITY_PAGES[0];
  const crumbs = [{ name: "Home", href: "/" }, { name: "Salon Software", href: "/salon-software" }, { name: data.name, href: `/salon-software/${data.slug}` }];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: `Does Aura support salons in ${data.name}?`, acceptedAnswer: { "@type": "Answer", text: `Yes. Aura supports salon booking, POS, CRM, staff, inventory and marketing workflows for ${data.name} salons.` } },
      { "@type": "Question", name: "Can Aura handle GST-ready salon billing?", acceptedAnswer: { "@type": "Answer", text: "Aura supports GST-ready POS workflows, split payments and daily reconciliation context." } },
    ],
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Salon software in ${data.name}`,
    areaServed: data.name,
    provider: { "@type": "Organization", name: "Aura Salon CRM/POS", url: SITE_URL },
    serviceType: "Salon CRM, POS and booking software",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLdFromCrumbs(crumbs)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-[linear-gradient(135deg,#FFFDFB_0%,#F8F4FF_48%,#ECE4FF_100%)] py-28 md:py-36">
        <Container size="narrow">
          <Breadcrumbs crumbs={crumbs} />
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">Local salon software</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-[var(--aura-heading)]">Salon software in {data.name}</h1>
          <p className="mt-5 text-lg leading-8 text-[var(--aura-body)]">Run booking, GST-ready billing, client CRM, staff, inventory and marketing workflows from one connected Aura system built for Indian salon operations.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="rounded-full bg-[var(--aura-purple)] px-6 py-3 text-sm font-bold text-white">Book a demo</Link>
            <Link href="/features" className="rounded-full border border-[var(--aura-border)] bg-white px-6 py-3 text-sm font-bold text-[var(--aura-heading)]">View features</Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {["High walk-in pressure", "UPI/GST billing", "Retention follow-ups"].map((item) => <article key={item} className="rounded-3xl bg-white/80 p-5 shadow-[var(--aura-shadow-sm)]"><h2 className="font-bold">{item}</h2><p className="mt-2 text-sm text-[var(--aura-body)]">Aura keeps this workflow measurable for {data.name} salons.</p></article>)}
          </div>
          <section className="mt-10 rounded-3xl bg-white/80 p-6">
            <h2 className="font-bold">FAQ for {data.name} salons</h2>
            <div className="mt-4 space-y-4 text-sm text-[var(--aura-body)]"><p><strong>Does Aura support multi-branch salons?</strong> Yes, Aura is designed for branch-level visibility and owner reporting.</p><p><strong>Can salons manage GST billing?</strong> Aura supports GST-ready POS workflows and payment reconciliation.</p></div>
          </section>
        </Container>
      </section>
    </>
  );
}
