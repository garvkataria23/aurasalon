import type { Metadata } from "next";
import { PAGE_SEO, breadcrumbJsonLd } from "@/lib/seo";
import { CustomerAppClient } from "@/app/customer-app/CustomerAppClient";

export const metadata: Metadata = PAGE_SEO["/customer-app"];

export default function CustomerAppPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Customer App", url: "/customer-app" },
  ]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <CustomerAppClient />
    </>
  );
}

