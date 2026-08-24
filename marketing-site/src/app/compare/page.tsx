import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { COMPARISON_PAGES } from "@/lib/seo-enhancements";

export const metadata = { title: "Compare Salon Software — Aura", description: "Compare Aura with spreadsheets and other salon software using a neutral workflow checklist." };
export default function CompareHubPage() { return <section className="bg-white py-28"><Container><h1 className="text-4xl font-bold tracking-[-0.04em]">Compare salon software</h1><p className="mt-4 max-w-2xl text-[var(--aura-body)]">Use neutral workflow checklists to compare booking, POS, CRM, inventory, staff and reporting fit.</p><div className="mt-10 grid gap-5 md:grid-cols-3">{COMPARISON_PAGES.map((item) => <Link key={item.slug} href={`/compare/${item.slug}`} className="rounded-3xl border border-[var(--aura-border)] p-6"><h2 className="text-xl font-bold">Aura vs {item.name}</h2><p className="mt-2 text-sm text-[var(--aura-body)]">Compare by real salon workflows, not feature-count marketing.</p></Link>)}</div></Container></section>; }
