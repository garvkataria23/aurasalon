import { Container } from "@/components/ui/Container";
import { CASE_STUDIES } from "@/lib/authority-assets";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() { return CASE_STUDIES.map((item) => ({ slug: item.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const item = CASE_STUDIES.find((entry) => entry.slug === slug); return { title: item ? `${item.title} — Aura Case Study` : "Case Study", description: item?.outcome, alternates: { canonical: `${SITE_URL}/case-studies/${slug}` } }; }

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const item = CASE_STUDIES.find((entry) => entry.slug === slug) ?? CASE_STUDIES[0];
  const jsonLd = { "@context": "https://schema.org", "@type": "CaseStudy", name: item.title, about: item.outcome, publisher: { "@type": "Organization", name: "Aura Salon CRM/POS" } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><section className="bg-[var(--aura-off-white)] py-28"><Container size="narrow"><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">Case study framework</p><h1 className="mt-4 text-4xl font-bold tracking-[-0.04em]">{item.title}</h1><p className="mt-5 text-lg leading-8 text-[var(--aura-body)]">{item.outcome}. Replace this framework with real client numbers after approval.</p><div className="mt-10 grid gap-4"><article className="rounded-3xl bg-white p-6"><h2 className="font-bold">Problem</h2><p className="mt-2 text-[var(--aura-body)]">The salon workflow depended on memory, manual follow-up and disconnected records.</p></article><article className="rounded-3xl bg-white p-6"><h2 className="font-bold">Aura workflow</h2><p className="mt-2 text-[var(--aura-body)]">Booking, CRM, reminders, POS, staff and owner reporting were connected into a measurable operating rhythm.</p></article><article className="rounded-3xl bg-white p-6"><h2 className="font-bold">Metric to publish</h2><p className="mt-2 text-[var(--aura-body)]">{item.metric}: add verified before/after values when the customer approves publication.</p></article></div></Container></section></>;
}
