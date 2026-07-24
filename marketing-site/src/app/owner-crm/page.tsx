import type { Metadata } from "next";
import { EcosystemRoutePage } from "@/components/ecosystem/EcosystemRoutePage";

export const metadata: Metadata = {
  title: "Owner CRM & POS",
  description: "GST-ready billing, client CRM, inventory and finance engine — the complete salon management toolkit for owners.",
  openGraph: {
    title: "Owner CRM & POS — Aura Salon CRM/POS",
    description: "GST-ready billing, client CRM, inventory and finance engine for salon owners.",
    images: [{ url: "/og?path=owner-crm", width: 1200, height: 630 }],
  },
};

export default function OwnerCrmPage() {
  return <EcosystemRoutePage route="owner" />;
}
