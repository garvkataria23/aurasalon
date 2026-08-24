import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { COMPARISON_PAGES } from "@/lib/seo-enhancements";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return COMPARISON_PAGES.map((item) => ({ competitor: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ competitor: string }> }): Promise<Metadata> {
  const { competitor } = await params;
  const data = COMPARISON_PAGES.find((item) => item.slug === competitor);
  if (!data) return { title: "Compare Salon Software" };
  return {
    title: `Aura vs ${data.name} — Salon CRM/POS Comparison Checklist`,
    description: `A neutral checklist for comparing Aura with ${data.name}: booking, POS, GST billing, staff, inventory, CRM, data ownership and support.`,
    alternates: { canonical: `${SITE_URL}/compare/${data.slug}` },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ competitor: string }> }) {
  const { competitor } = await params;
  const data = COMPARISON_PAGES.find((item) => item.slug === competitor) ?? COMPARISON_PAGES[0];
  return (
    <section className="bg-white py-28 md:py-36">
      <Container size="narrow">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">Comparison checklist</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-[var(--aura-heading)]">Aura vs {data.name}</h1>
        <p className="mt-5 text-lg leading-8 text-[var(--aura-body)]">This page is a safe evaluation checklist, not a claim that every competitor lacks a feature. Confirm live capabilities during demos and choose the workflow fit that matches your salon.</p>
        <div className="mt-8 overflow-hidden rounded-3xl border border-[var(--aura-border)]">
          <div className="grid grid-cols-3 bg-[var(--aura-off-white)] p-4 text-xs font-bold uppercase tracking-[.14em] text-[var(--aura-muted)]"><span>Workflow</span><span>What to ask</span><span>Why it matters</span></div>
          {["Indian salon GST billing", "Client CRM depth", "Staff and payroll workflow", "Inventory batch and expiry", "Data exports and owner reporting"].map((item) => <div key={item} className="grid grid-cols-3 gap-4 border-t border-[var(--aura-border)] p-5 text-sm"><h2 className="font-bold text-[var(--aura-heading)]">{item}</h2><p className="text-[var(--aura-body)]">Ask both vendors to demonstrate this workflow with your real salon scenario.</p><p className="text-[var(--aura-body)]">Workflow fit beats feature-count marketing.</p></div>)}
        </div>
        <Link href="/demo" className="mt-8 inline-flex rounded-full bg-[var(--aura-purple)] px-6 py-3 text-sm font-bold text-white">Compare with your workflow</Link>
      </Container>
    </section>
  );
}
