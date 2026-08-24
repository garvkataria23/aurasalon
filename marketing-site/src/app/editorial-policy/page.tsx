import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Editorial Policy — Aura Salon CRM/POS",
  description: "How Aura creates, reviews and updates salon business content for SEO, AEO and GEO accuracy.",
  alternates: { canonical: `${SITE_URL}/editorial-policy` },
};

export default function EditorialPolicyPage() {
  return (
    <section className="bg-[var(--aura-off-white)] py-28 md:py-36">
      <Container size="narrow">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">Editorial policy</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-[var(--aura-heading)]">How Aura publishes salon operations content</h1>
        <div className="mt-8 space-y-5 text-base leading-8 text-[var(--aura-body)]">
          <p>Our content is written for Indian salon owners and focuses on practical workflow decisions: booking, POS, GST billing, CRM, staff, inventory, marketing and owner reporting.</p>
          <p>Articles are reviewed for clarity, product fit, operational usefulness and source quality. Where regulatory or tax topics are discussed, content is educational and should be reviewed with a qualified professional.</p>
          <p>We avoid copying third-party content. External sources are used for citation, context and further reading, while recommendations are written in Aura's own operating perspective.</p>
        </div>
      </Container>
    </section>
  );
}
