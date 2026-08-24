import { redirect } from "next/navigation";

export const metadata = {
  title: "Salon Tools — Aura Calculators",
  description: "Free salon calculators and operational planning tools from Aura.",
};

export default function ToolsPage() {
  redirect("/calculators");
}
