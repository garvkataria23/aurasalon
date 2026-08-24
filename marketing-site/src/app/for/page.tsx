import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PERSONAS } from "@/lib/authority-assets";

export const metadata = { title: "Aura for Salon Teams — Owners, Managers, Stylists & Staff", description: "Persona pages for salon owners, managers, front desk, stylists, finance and marketing teams." };
export default function ForPage() { return <section className="bg-white py-28"><Container><h1 className="text-4xl font-bold tracking-[-0.04em]">Aura for every salon role</h1><div className="mt-10 grid gap-5 md:grid-cols-4">{PERSONAS.map((item) => <Link key={item.slug} href={`/for/${item.slug}`} className="rounded-3xl border border-[var(--aura-border)] p-6"><h2 className="font-bold">{item.title}</h2><p className="mt-2 text-sm text-[var(--aura-body)]">{item.focus}</p></Link>)}</div></Container></section>; }
