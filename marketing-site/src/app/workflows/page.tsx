import type { Metadata } from "next";
import { EcosystemRoutePage } from "@/components/ecosystem/EcosystemRoutePage";

export const metadata: Metadata = {
  title: "Connected Workflows",
  description: "How booking, billing, staff, inventory and finance connect around the same salon day — no double entry, no gaps.",
  openGraph: {
    title: "Connected Workflows — Aura Salon CRM/POS",
    description: "How booking, billing, staff, inventory and finance connect around the same salon day.",
    images: [{ url: "/og?path=workflows", width: 1200, height: 630 }],
  },
};

export default function WorkflowsPage() {
  return <EcosystemRoutePage route="workflows" />;
}
