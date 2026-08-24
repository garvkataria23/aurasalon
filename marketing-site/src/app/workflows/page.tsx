import type { Metadata } from "next";
import { PAGE_SEO, breadcrumbJsonLd } from "@/lib/seo";
import { WorkflowsClient } from "@/app/workflows/WorkflowsClient";

export const metadata: Metadata = PAGE_SEO["/workflows"];

export default function WorkflowsPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Connected Workflows", url: "/workflows" },
  ]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <WorkflowsClient />
    </>
  );
}

