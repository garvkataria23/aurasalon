import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security & Data Handling — Aura Salon CRM/POS",
  description: "Aura security and data handling principles for salon CRM, POS, booking, staff and inventory workflows.",
  alternates: { canonical: `${SITE_URL}/security` },
};

export default function SecurityPage() {
  return (
    <section className="bg-[linear-gradient(135deg,#FFFDFB_0%,#F8F4FF_52%,#ECE4FF_100%)] py-28 md:py-36">
      <Container size="narrow">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">Trust center</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-[var(--aura-heading)]">Security and data handling for salon operations</h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {["Role-based access", "Client data control", "Billing audit trails", "Operational continuity"].map((item) => (
            <article key={item} className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-[var(--aura-shadow-sm)]">
              <h2 className="font-bold text-[var(--aura-heading)]">{item}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--aura-body)]">Aura is designed around controlled access, traceable workflow records and owner visibility across core salon operations.</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
