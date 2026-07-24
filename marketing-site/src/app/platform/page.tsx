import type { Metadata } from "next";
import { EcosystemRoutePage } from "@/components/ecosystem/EcosystemRoutePage";

export const metadata: Metadata = {
  title: "Platform Overview",
  description: "Aura connects Owner CRM and POS, customer booking, staff work, inventory, finance and branch-aware operations for Indian salons.",
  openGraph: {
    title: "Platform Overview — Aura Salon CRM/POS",
    description: "Owner CRM and POS, customer booking and staff operations connected around the same salon day.",
    images: [{ url: "/og?path=platform", width: 1200, height: 630 }],
  },
};

export default function PlatformPage() {
  return <EcosystemRoutePage route="platform" />;
}
