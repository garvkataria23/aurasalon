import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { GLOSSARY_TERMS } from "@/lib/authority-assets";
import { TrustSignals } from "@/components/seo/TrustSignals";
import { SITE_URL } from "@/lib/site";

export const metadata = { title: "Salon Software Glossary — Aura", description: "Definitions for salon CRM, Client 360, average ticket, reorder point, service recipes and no-show rate." };
export default function GlossaryPage() { const jsonLd = { "@context": "https://schema.org", "@type": "DefinedTermSet", name: "Salon Software Glossary", hasDefinedTerm: GLOSSARY_TERMS.map((item) => ({ "@type": "DefinedTerm", name: item.term, description: item.definition, url: `${SITE_URL}/glossary/${item.slug}` })) }; return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><section className="bg-white py-28"><Container><h1 className="text-4xl font-bold tracking-[-0.04em]">Salon software glossary</h1><TrustSignals /><div className="mt-10 grid gap-4 md:grid-cols-3">{GLOSSARY_TERMS.map((item) => <Link key={item.slug} href={`/glossary/${item.slug}`} className="rounded-3xl border border-[var(--aura-border)] p-6"><h2 className="font-bold">{item.term}</h2><p className="mt-2 text-sm text-[var(--aura-body)]">{item.definition}</p></Link>)}</div></Container></section></>; }
