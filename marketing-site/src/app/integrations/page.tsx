import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { INTEGRATIONS } from "@/lib/authority-assets";

export const metadata = { title: "Salon Software Integrations — Aura", description: "Integration and workflow compatibility pages for WhatsApp, UPI, payments, calendars, accounting and marketing tools." };
export default function IntegrationsPage() { return <section className="bg-white py-28"><Container><h1 className="text-4xl font-bold tracking-[-0.04em]">Salon software integrations</h1><div className="mt-10 grid gap-5 md:grid-cols-3">{INTEGRATIONS.map((item) => <Link key={item.slug} href={`/integrations/${item.slug}`} className="rounded-3xl border border-[var(--aura-border)] p-6"><p className="text-xs font-bold uppercase text-[var(--aura-purple)]">{item.status}</p><h2 className="mt-2 font-bold">{item.name}</h2></Link>)}</div></Container></section>; }
