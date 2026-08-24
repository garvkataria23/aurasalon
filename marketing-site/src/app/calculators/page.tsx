import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CALCULATORS } from "@/lib/authority-assets";
import { TrustSignals } from "@/components/seo/TrustSignals";
import { SITE_URL } from "@/lib/site";

export const metadata = { title: "Salon Calculators — Revenue, No-Show, Commission & Inventory", description: "Free salon business calculators for revenue, no-show loss, staff commission and inventory reorder planning." };

export default function CalculatorsPage() { const jsonLd = { "@context": "https://schema.org", "@type": "ItemList", itemListElement: CALCULATORS.map((item, index) => ({ "@type": "ListItem", position: index + 1, url: `${SITE_URL}/calculators/${item.slug}`, name: item.title })) }; return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><section className="bg-white py-28"><Container><h1 className="text-4xl font-bold tracking-[-0.04em]">Salon calculators</h1><TrustSignals /><div className="mt-10 grid gap-5 md:grid-cols-4">{CALCULATORS.map((item) => <Link key={item.slug} href={`/calculators/${item.slug}`} className="rounded-3xl border border-[var(--aura-border)] p-6 shadow-[var(--aura-shadow-sm)]"><h2 className="font-bold">{item.title}</h2><p className="mt-3 text-sm text-[var(--aura-body)]">Formula: {item.formula}</p></Link>)}</div></Container></section></>; }
