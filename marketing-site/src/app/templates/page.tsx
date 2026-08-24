import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { TEMPLATES } from "@/lib/authority-assets";
import { TrustSignals } from "@/components/seo/TrustSignals";
import { SITE_URL } from "@/lib/site";

export const metadata = { title: "Salon Templates & Checklists — Aura", description: "Practical salon templates for staff attendance, GST checks, bridal packages, inventory audits and consultation forms." };
export default function TemplatesPage() { const jsonLd = { "@context": "https://schema.org", "@type": "ItemList", itemListElement: TEMPLATES.map((item, index) => ({ "@type": "ListItem", position: index + 1, url: `${SITE_URL}/templates/${item.slug}`, name: item.title })) }; return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><section className="bg-white py-28"><Container><h1 className="text-4xl font-bold tracking-[-0.04em]">Salon templates</h1><TrustSignals /><div className="mt-10 grid gap-5 md:grid-cols-3">{TEMPLATES.map((item) => <Link key={item.slug} href={`/templates/${item.slug}`} className="rounded-3xl border border-[var(--aura-border)] p-6"><p className="text-xs font-bold uppercase text-[var(--aura-purple)]">{item.category}</p><h2 className="mt-3 text-xl font-bold">{item.title}</h2></Link>)}</div></Container></section></>; }
