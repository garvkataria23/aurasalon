import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { USE_CASES } from "@/lib/authority-assets";

export const metadata = { title: "Salon Use Cases — Aura CRM/POS", description: "Practical salon software use cases for booking, billing, CRM, staff, inventory, marketing and owner reporting." };
export default function UseCasesPage() { return <section className="bg-white py-28"><Container><h1 className="text-4xl font-bold tracking-[-0.04em]">Salon software use cases</h1><p className="mt-4 max-w-2xl text-[var(--aura-body)]">Problem-aware pages for salon owners who want specific operational outcomes.</p><div className="mt-10 grid gap-5 md:grid-cols-3">{USE_CASES.map((item) => <Link key={item.slug} href={`/use-cases/${item.slug}`} className="rounded-3xl border border-[var(--aura-border)] p-6"><h2 className="font-bold">{item.title}</h2><p className="mt-2 text-sm text-[var(--aura-body)]">{item.focus}</p></Link>)}</div></Container></section>; }
