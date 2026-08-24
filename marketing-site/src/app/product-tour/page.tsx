import { Container } from "@/components/ui/Container";
import { PRODUCT_TOUR_ITEMS } from "@/lib/authority-assets";

export const metadata = { title: "Aura Product Tour — Salon CRM/POS Screens", description: "Explore Aura modules for booking, POS, client CRM, staff app, inventory and owner dashboards." };

export default function ProductTourPage() {
  return <section className="bg-[linear-gradient(135deg,#FFFDFB,#F8F4FF,#ECE4FF)] py-28"><Container><h1 className="text-4xl font-bold tracking-[-0.04em]">Aura product tour</h1><p className="mt-4 max-w-2xl text-[var(--aura-body)]">Screenshot-ready module library. Add real product images later; structure is ready for SEO and conversion.</p><div className="mt-10 grid gap-5 md:grid-cols-3">{PRODUCT_TOUR_ITEMS.map((item) => <article key={item.slug} className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-[var(--aura-shadow-sm)]"><div className="mb-5 aspect-video rounded-2xl bg-[linear-gradient(135deg,#2A173D,#6F4FD8,#B89CFF)]" /><h2 className="text-xl font-bold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--aura-body)]">{item.body}</p></article>)}</div></Container></section>;
}
