import type { Metadata } from "next";
import { EcosystemRoutePage } from "@/components/ecosystem/EcosystemRoutePage";

export const metadata: Metadata = {
  title: "Staff App",
  description: "Secure attendance, shift scheduling, commission tracking and performance dashboards — built for salon professionals.",
  openGraph: {
    title: "Staff App — Aura Salon CRM/POS",
    description: "Secure attendance, shift scheduling, commission tracking and performance dashboards.",
    images: [{ url: "/og?path=staff-app", width: 1200, height: 630 }],
  },
};

export default function StaffAppPage() {
  return <EcosystemRoutePage route="staff" />;
}
