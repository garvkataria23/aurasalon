import type { Metadata } from "next";
import { PAGE_SEO, breadcrumbJsonLd } from "@/lib/seo";
import { PlatformClient } from "@/app/platform/PlatformClient";

export const metadata: Metadata = PAGE_SEO["/platform"];

export default function PlatformPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Platform", url: "/platform" },
  ]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <PlatformClient />
    </>
  );
}
