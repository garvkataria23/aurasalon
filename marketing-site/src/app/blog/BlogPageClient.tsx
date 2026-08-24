"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Filter, SearchX, Sparkles } from "lucide-react";
import { BLOG_POSTS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { GridBackground } from "@/components/ui/GridBackground";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { BLOG_META_HI } from "@/lib/translations";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { getBlogFallbackImage, getBlogImage } from "@/lib/blog-images";

const CATEGORIES = ["All", ...Array.from(new Set(BLOG_POSTS.map((p) => p.category)))];

export default function BlogPage() {
  const { language, t } = useLanguage();
  const reveal = useScrollReveal();
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = useMemo(
    () => activeCategory === "All" ? BLOG_POSTS : BLOG_POSTS.filter((p) => p.category === activeCategory),
    [activeCategory]
  );

  const categoryLabel = (cat: string) =>
    cat === "All"
      ? t("blog.all")
      : language === "hi"
        ? BLOG_META_HI[BLOG_POSTS.find((post) => post.category === cat)?.slug ?? ""]?.category ?? cat
        : cat;

  return (
    <div ref={reveal as React.RefObject<HTMLDivElement | null>} className="overflow-x-clip">
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#FFFDFB_0%,#F8F4FF_42%,#ECE4FF_100%)] pb-16 pt-28 md:pb-24 md:pt-36">
        <GridBackground className="opacity-25" />
        <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-[var(--aura-purple)]/12 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#B89CFF]/20 blur-3xl" aria-hidden="true" />
        <Container size="narrow" className="relative z-10">
          <div className="fade-in-up mx-auto max-w-2xl text-center">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/15 bg-white/75 px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)] shadow-[0_10px_30px_rgba(111,79,216,0.08)] backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t("blog.badge")}
            </span>
            <h1 className="text-balance text-[clamp(2.5rem,6vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.05em] text-[var(--aura-heading)]">
              {t("blog.title")}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-8 text-[var(--aura-body)] md:text-lg">
              {t("blog.body")}
            </p>
          </div>
        </Container>
      </section>

      <section className="relative bg-white pb-20 md:pb-28">
        <Container>
          <div className="mb-10 flex items-center justify-center gap-2 flex-wrap md:mb-14">
            <Filter className="mr-1 h-4 w-4 text-[var(--aura-muted)]" aria-hidden="true" />
            {CATEGORIES.map((cat) => {
              const count = cat === "All" ? BLOG_POSTS.length : BLOG_POSTS.filter((p) => p.category === cat).length;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  aria-pressed={isActive}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-300 motion-reduce:transition-none ${
                    isActive
                      ? "bg-[var(--aura-purple)] text-white shadow-[0_10px_26px_rgba(111,79,216,0.32)]"
                      : "border border-[var(--aura-border)] bg-white/70 text-[var(--aura-text-secondary)] backdrop-blur hover:border-[var(--aura-border-strong)] hover:text-[var(--aura-heading)]"
                  }`}
                >
                  {categoryLabel(cat)}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${isActive ? "bg-white/20" : "bg-[var(--aura-off-white)]"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div>
            <div key={activeCategory} className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((post, i) => {
                const translated = language === "hi" ? BLOG_META_HI[post.slug] : undefined;
                const isFeatured = i === 0 && activeCategory === "All";
                const image = getBlogImage(post);
                return (
                  <article
                    key={post.slug}
                    style={{ animationDelay: `${Math.min(i * 70, 350)}ms` }}
                    className={`animate-in fade-in slide-in-from-bottom-5 fill-mode-both ${isFeatured ? "md:col-span-2 lg:col-span-3" : ""}`}
                  >
                    <Link href={`/blog/${post.slug}`} className="group block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--aura-purple)]">
                      <div className={`h-full overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/85 shadow-[0_18px_60px_rgba(72,45,151,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-[var(--aura-purple)]/25 hover:shadow-[0_28px_80px_rgba(72,45,151,0.16)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${isFeatured ? "lg:flex" : ""}`}>
                        <div className={`relative shrink-0 overflow-hidden bg-[var(--aura-lavender)] ${isFeatured ? "h-56 lg:h-auto lg:w-2/5" : "h-44"}`}>
                          <img
                            src={image}
                            alt=""
                            loading={i < 3 ? "eager" : "lazy"}
                            decoding="async"
                            sizes={isFeatured ? "(min-width: 1024px) 40vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"}
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = getBlogFallbackImage(post);
                            }}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                          />
                        </div>
                        <div className="flex flex-1 flex-col p-6 sm:p-7">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-[var(--aura-lavender)] px-2.5 py-0.5 text-xs font-semibold text-[var(--aura-purple)]">
                              {translated?.category ?? post.category}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-[var(--aura-muted)]">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {translated?.readTime ?? post.readTime}
                            </span>
                            {isFeatured && (
                              <span className="rounded-full bg-[var(--aura-purple)] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                                {t("blog.featured")}
                              </span>
                            )}
                          </div>
                          <h2 className={`mt-4 font-bold leading-snug tracking-[-0.01em] text-[var(--aura-heading)] transition-colors duration-300 group-hover:text-[var(--aura-purple)] motion-reduce:transition-none ${isFeatured ? "text-xl md:text-2xl" : "text-base"}`}>
                            {translated?.title ?? post.title}
                          </h2>
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--aura-body)]">
                            {translated?.excerpt ?? post.excerpt}
                          </p>
                          <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-[var(--aura-purple)]">
                            {t("blog.read")}
                            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--aura-border-strong)] bg-white/70 px-6 py-14 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--aura-lavender)] ring-8 ring-[var(--aura-lavender-strong)]/50">
                <SearchX className="h-7 w-7 text-[var(--aura-purple)]" aria-hidden="true" />
              </div>
              <p className="mx-auto max-w-sm text-sm leading-6 text-[var(--aura-body)]">{t("blog.empty")}</p>
            </div>
          )}
        </Container>
      </section>
    </div>
  );
}
