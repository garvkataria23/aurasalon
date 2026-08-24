import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { HELP_TOPICS } from "@/lib/authority-assets";

export const metadata = { title: "Aura Help Center — Salon CRM/POS Setup Guides", description: "Help topics for setting up Aura salon CRM, POS, booking, staff, inventory, reports and security workflows." };
export default function HelpPage() { return <section className="bg-white py-28"><Container><h1 className="text-4xl font-bold tracking-[-0.04em]">Aura help center</h1><p className="mt-4 max-w-2xl text-[var(--aura-body)]">Setup and workflow guidance for salon teams using Aura.</p><div className="mt-10 grid gap-4 md:grid-cols-4">{HELP_TOPICS.map((item) => <Link key={item.slug} href={`/help/${item.slug}`} className="rounded-2xl border border-[var(--aura-border)] p-4 text-sm font-semibold">{item.title}</Link>)}</div></Container></section>; }
