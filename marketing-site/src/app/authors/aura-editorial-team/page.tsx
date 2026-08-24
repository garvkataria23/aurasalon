import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { AURA_AUTHOR } from "@/lib/seo-enhancements";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Aura Editorial Team — Salon CRM, POS and Operations Expertise",
  description: AURA_AUTHOR.description,
  alternates: { canonical: `${SITE_URL}/authors/aura-editorial-team` },
};

export default function AuthorPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: AURA_AUTHOR.name,
    url: AURA_AUTHOR.url,
    description: AURA_AUTHOR.description,
    knowsAbout: ["salon CRM", "salon POS", "GST billing", "online booking", "staff management", "salon inventory", "marketing automation"],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-[linear-gradient(135deg,#FFFDFB_0%,#F8F4FF_48%,#ECE4FF_100%)] py-28 md:py-36">
        <Container size="narrow">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">Author entity</p>
          <h1 className="mt-4 text-balance text-[clamp(2.5rem,6vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.05em] text-[var(--aura-heading)]">{AURA_AUTHOR.name}</h1>
          <p className="mt-5 text-lg leading-8 text-[var(--aura-body)]">{AURA_AUTHOR.description}</p>
        </Container>
      </section>
      <section className="bg-white py-16">
        <Container size="narrow">
          <div className="grid gap-5 sm:grid-cols-2">
            {["Salon operations", "CRM and retention", "GST-ready POS", "Staff and inventory workflows"].map((item) => (
              <div key={item} className="rounded-3xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-6">
                <h2 className="font-bold text-[var(--aura-heading)]">{item}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--aura-body)]">Practical guidance based on Indian salon workflows and Aura product implementation patterns.</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
