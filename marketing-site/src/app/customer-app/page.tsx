import type { Metadata } from "next";
import { EcosystemRoutePage } from "@/components/ecosystem/EcosystemRoutePage";

export const metadata: Metadata = {
  title: "Customer App",
  description: "Online booking, appointment history, loyalty wallet, referrals and WhatsApp notifications — your client's salon companion.",
  openGraph: {
    title: "Customer App — Aura Salon CRM/POS",
    description: "Online booking, loyalty wallet, referrals and WhatsApp notifications for salon clients.",
    images: [{ url: "/og?path=customer-app", width: 1200, height: 630 }],
  },
};

export default function CustomerAppPage() {
  return <EcosystemRoutePage route="customer" />;
}
