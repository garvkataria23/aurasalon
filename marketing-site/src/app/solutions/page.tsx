import type { Metadata } from "next";
import { Breadcrumbs, breadcrumbJsonLdFromCrumbs } from "@/components/seo/Breadcrumbs";
import { SITE_URL } from "@/lib/site";
import { SolutionsHubClient } from "./SolutionsHubClient";

export const metadata: Metadata = {
  title: "Salon Solutions & Industry Operating Systems — 35+ Beauty Verticals | Aura",
  description:
    "Purpose-built salon management workflows for hair salons, barber shops, nail bars, spas, medspa clinics, tattoo studios, and pet groomers. Explore all 35+ solutions.",
  alternates: { canonical: `${SITE_URL}/solutions` },
};

export default function SolutionsHubPage() {
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Solutions", href: "/solutions" },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLdFromCrumbs(crumbs)) }} />
      <SolutionsHubClient />
    </>
  );
}
