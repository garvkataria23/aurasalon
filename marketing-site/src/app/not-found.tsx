"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center bg-aura-bg overflow-hidden">
      <Container className="relative z-10">
        <div className="text-center">
          <span className="text-[8rem] md:text-[12rem] font-black leading-none text-aura-primary select-none">
            404
          </span>

          <h1 className="text-2xl md:text-3xl font-bold text-aura-text mb-3">
            {t("notFound.title")}
          </h1>

          <p className="text-aura-text-muted mb-10 max-w-md mx-auto">
            {t("notFound.body")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-aura-text-secondary border border-aura-border rounded-xl hover:bg-aura-surface hover:border-aura-primary/30 hover:text-aura-primary transition-all duration-200"
            >
              {t("notFound.home")}
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-aura-text-secondary border border-aura-border rounded-xl hover:bg-aura-surface hover:border-aura-primary/30 hover:text-aura-primary transition-all duration-200"
            >
              {t("notFound.features")}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-aura-text-secondary border border-aura-border rounded-xl hover:bg-aura-surface hover:border-aura-primary/30 hover:text-aura-primary transition-all duration-200"
            >
              {t("notFound.pricing")}
            </Link>
          </div>

          <div>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 text-sm text-aura-text-muted hover:text-aura-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("notFound.back")}
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}
