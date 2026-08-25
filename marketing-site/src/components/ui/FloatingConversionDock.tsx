"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function FloatingConversionDock() {
  const { t } = useLanguage();
  return (
    <div className="fixed bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+1.5rem))] right-6 z-[990] hidden sm:block">
      <Link href="/demo" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-aura-primary px-5 text-xs font-bold text-white shadow-lg transition-colors hover:bg-aura-primary-dark">
        {t("nav.trial")}
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
