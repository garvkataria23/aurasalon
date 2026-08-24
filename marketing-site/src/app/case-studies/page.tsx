import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CASE_STUDIES } from "@/lib/authority-assets";

export const metadata = { title: "Salon Case Studies — Aura CRM/POS", description: "Workflow-based salon case study templates for no-shows, retention and inventory control." };

export default function CaseStudiesPage() {
  return <section className="bg-white py-28"><Container><h1 className="text-4xl font-bold tracking-[-0.04em]">Salon case studies</h1><p className="mt-4 max-w-2xl text-[var(--aura-body)]">Evidence-style pages showing how salon workflows can improve when booking, CRM, billing, staff and inventory connect.</p><div className="mt-10 grid gap-5 md:grid-cols-3">{CASE_STUDIES.map((item) => <Link key={item.slug} href={`/case-studies/${item.slug}`} className="rounded-3xl border border-[var(--aura-border)] p-6 shadow-[var(--aura-shadow-sm)] transition hover:-translate-y-1"><p className="text-xs font-bold uppercase text-[var(--aura-purple)]">{item.segment}</p><h2 className="mt-3 text-xl font-bold">{item.title}</h2><p className="mt-3 text-sm text-[var(--aura-body)]">{item.outcome}</p></Link>)}</div></Container></section>;
}
