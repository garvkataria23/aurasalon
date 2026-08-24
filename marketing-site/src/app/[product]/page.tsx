import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { CORE_PRODUCT_PAGES } from "@/lib/authority-assets";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return CORE_PRODUCT_PAGES.map((item) => ({ product: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ product: string }> }): Promise<Metadata> {
  const { product } = await params;
  const page = CORE_PRODUCT_PAGES.find((item) => item.slug === product);
  if (!page) return { title: "Aura Salon CRM/POS" };
  return {
    title: `${page.title} — Aura Salon CRM/POS`,
    description: `${page.title} for ${page.audience}. ${page.angle}`,
    alternates: { canonical: `${SITE_URL}/${page.slug}` },
  };
}

export default async function CoreProductPage({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  const page = CORE_PRODUCT_PAGES.find((item) => item.slug === product);
  if (!page) notFound();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: `Who is ${page.title} for?`, acceptedAnswer: { "@type": "Answer", text: `${page.title} is for ${page.audience}.` } },
      { "@type": "Question", name: `What does Aura connect on this page?`, acceptedAnswer: { "@type": "Answer", text: "Aura connects booking, POS, CRM, staff, inventory, marketing and owner reporting workflows." } },
    ],
  };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: page.title,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Android, iOS",
    url: `${SITE_URL}/${page.slug}`,
    description: page.angle,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <section className="bg-[radial-gradient(circle_at_top_left,#f3e8ff,transparent_32%),var(--aura-off-white)] py-28 md:py-36">
        <Container>
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">Commercial product page</p>
            <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-[var(--aura-heading)] md:text-6xl">{page.title} for modern salons</h1>
            <p className="mt-6 text-lg leading-8 text-[var(--aura-body)]">{page.angle} Built for {page.audience}, Aura keeps the work connected from appointment to invoice to follow-up.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demo" className="rounded-full bg-[var(--aura-purple)] px-6 py-3 text-sm font-bold text-white">Book a demo</Link>
              <Link href="/features" className="rounded-full border border-[var(--aura-border)] bg-white px-6 py-3 text-sm font-bold text-[var(--aura-heading)]">See features</Link>
            </div>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {["Operate", "Measure", "Grow"].map((item) => (
              <article key={item} className="rounded-[2rem] bg-white p-7 shadow-[var(--aura-shadow-sm)]">
                <h2 className="text-xl font-bold text-[var(--aura-heading)]">{item}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--aura-body)]">Use one connected workflow for booking, billing, client memory, staff accountability and branch-level owner visibility.</p>
              </article>
            ))}
          </div>
        </Container>
      </section>
      <section className="bg-white py-20">
        <Container>
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-[-0.04em] text-[var(--aura-heading)]">What this replaces</h2>
              <p className="mt-4 leading-7 text-[var(--aura-body)]">Aura reduces dependence on separate registers, Excel sheets, manual WhatsApp follow-ups and end-of-day guesswork. The goal is not only software adoption; it is repeatable salon operating discipline.</p>
            </div>
            <div className="rounded-[2rem] bg-[var(--aura-off-white)] p-7">
              <h2 className="text-xl font-bold text-[var(--aura-heading)]">Related workflows</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {["/features/appointments", "/features/billing", "/features/client-crm", "/features/staff-management", "/features/inventory", "/resources"].map((href) => (
                  <Link key={href} href={href} className="rounded-full border border-[var(--aura-border)] bg-white px-4 py-2 text-xs font-bold text-[var(--aura-heading)]">{href.split("/").pop()?.replaceAll("-", " ")}</Link>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
