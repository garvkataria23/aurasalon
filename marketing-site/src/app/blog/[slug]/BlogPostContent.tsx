"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Clock, ChevronRight, Share2, Link2, Check } from "lucide-react";
import { BLOG_POSTS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Newsletter } from "@/components/layout/Newsletter";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { BLOG_META_HI } from "@/lib/translations";
import { getBlogFallbackImage, getBlogImage } from "@/lib/blog-images";
import { getBlogCitations } from "@/lib/blog-authority";
import { buildOriginalBlogContent } from "@/lib/blog-original-content";
import { getBlogFaq, getHowToSteps, getTopicLinks } from "@/lib/seo-enhancements";

interface BlogPostContentProps {
  slug: string;
}

const CATEGORY_INTERNAL_LINKS: Record<string, { href: string; label: string }[]> = {
  "Business Growth": [
    { href: "/pricing", label: "Compare Aura pricing" },
    { href: "/demo", label: "Book a growth walkthrough" },
    { href: "/features/finance", label: "See finance reports" },
  ],
  Marketing: [
    { href: "/features/marketing-ai", label: "Explore marketing workflows" },
    { href: "/customer-app", label: "See the customer app" },
    { href: "/demo", label: "Plan campaigns with Aura" },
  ],
  Operations: [
    { href: "/features/appointments", label: "Improve appointment flow" },
    { href: "/features/inventory", label: "Control inventory" },
    { href: "/workflows", label: "View connected workflows" },
  ],
  "Staff Management": [
    { href: "/features/staff-management", label: "Manage staff and payroll" },
    { href: "/staff-app", label: "See the staff app" },
    { href: "/demo", label: "Book a team workflow demo" },
  ],
  "Client CRM": [
    { href: "/features/client-crm", label: "Explore Client CRM" },
    { href: "/customer-app", label: "Improve client experience" },
    { href: "/features/marketing-ai", label: "Automate follow-ups" },
  ],
  Compliance: [
    { href: "/features/billing", label: "See GST billing" },
    { href: "/features/compliance", label: "Review compliance tools" },
    { href: "/demo", label: "Discuss compliance setup" },
  ],
  "Industry Insights": [
    { href: "/platform", label: "Understand the Aura platform" },
    { href: "/features", label: "Browse all features" },
    { href: "/customers", label: "Review proof framework" },
  ],
};

function getInternalLinks(category: string) {
  return CATEGORY_INTERNAL_LINKS[category] ?? CATEGORY_INTERNAL_LINKS["Business Growth"];
}

function ReadingProgress() {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-[2px] z-50 origin-left"
      aria-hidden="true"
    />
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function ShareBar({ title, excerpt }: { title: string; excerpt: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    void Promise.resolve().then(() => setUrl(window.location.href));
  }, []);

  const shareLinks = [
    {
      name: "X",
      icon: XIcon,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
    },
    {
      name: "LinkedIn",
      icon: LinkedInIcon,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
      name: "WhatsApp",
      icon: Share2,
      href: `https://wa.me/?text=${encodeURIComponent(`${title}\n${excerpt}\n${url}`)}`,
    },
  ];

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-12 pt-8 border-t border-aura-border">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-aura-text-muted">
          Share this article
        </p>
        <div className="flex items-center gap-2">
          {shareLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Share on ${link.name}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-aura-border bg-white text-aura-text-muted transition-all hover:border-aura-primary hover:text-aura-primary hover:shadow-sm"
              >
                <Icon className="h-4 w-4" />
              </a>
            );
          })}
          <button
            type="button"
            onClick={copyLink}
            aria-label={copied ? "Link copied" : "Copy link"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-aura-border bg-white text-aura-text-muted transition-all hover:border-aura-primary hover:text-aura-primary hover:shadow-sm"
          >
            {copied ? <Check className="h-4 w-4 text-aura-success" /> : <Link2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function RelatedPosts({ currentSlug, currentCategory }: { currentSlug: string; currentCategory: string }) {
  const { language } = useLanguage();
  const related = useMemo(() => {
    const sameCategory = BLOG_POSTS.filter((p) => p.slug !== currentSlug && p.category === currentCategory);
    const others = BLOG_POSTS.filter((p) => p.slug !== currentSlug && p.category !== currentCategory);
    return [...sameCategory, ...others].slice(0, 3);
  }, [currentSlug, currentCategory]);

  if (related.length === 0) return null;

  return (
    <div className="mt-16 pt-12 border-t border-aura-border">
      <h2 className="text-xl font-bold text-aura-text mb-6">
        {language === "hi" ? "इसे भी पढ़ें" : "Continue reading"}
      </h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block rounded-xl border border-aura-border bg-white p-5 transition-all hover:shadow-[var(--aura-shadow-md)] hover:border-aura-primary-light"
          >
            <Badge className="mb-3 text-[10px]">{post.category}</Badge>
            <h3 className="text-sm font-semibold text-aura-text leading-snug mb-2 line-clamp-2 group-hover:text-aura-primary transition-colors">
              {post.title}
            </h3>
            <p className="text-xs text-aura-text-muted line-clamp-2">
              {post.excerpt}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-aura-primary opacity-0 transition-all group-hover:opacity-100">
              {language === "hi" ? "पढ़ें" : "Read more"} <ChevronRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BlogPostContent({ slug }: BlogPostContentProps) {
  const { language, t } = useLanguage();
  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    return (
      <Container className="pt-40 pb-20 text-center">
         <h1 className="text-2xl font-bold text-aura-text">{t("blog.postMissing")}</h1>
         <Link href="/blog" className="text-aura-primary mt-4 inline-block">← {t("common.backBlog")}</Link>
      </Container>
    );
  }

  const translated = language === "hi" ? BLOG_META_HI[slug] : undefined;
  const image = getBlogImage(post);
  const internalLinks = getInternalLinks(post.category);
  const topicLinks = getTopicLinks(post.category);
  const faq = getBlogFaq(post);
  const steps = getHowToSteps(post);
  const citations = getBlogCitations(post);
  const content = buildOriginalBlogContent(post, language);

  const renderContent = (text: string) => {
    const blocks = text.split("\n\n").filter((b) => b.trim());
    return blocks.map((block, i) => {
      const trimmed = block.trim();

      if (trimmed.startsWith("## ")) {
        const headingText = trimmed.replace("## ", "");
        const headingId = headingText.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        return (
          <h2 key={i} id={headingId} className="text-xl md:text-2xl font-bold text-aura-text mt-10 mb-4 first:mt-0 scroll-mt-28">
            {headingText}
          </h2>
        );
      }

      if (trimmed.startsWith("### ")) {
        return <h3 key={i} className="mt-8 mb-3 text-lg font-bold text-aura-text">{trimmed.replace("### ", "")}</h3>;
      }

      if (trimmed.startsWith("- ")) {
        const items = trimmed.split("\n").filter((l) => l.startsWith("- "));
        return (
          <ul key={i} className="list-disc list-inside space-y-2 mb-4 text-base text-aura-text-secondary leading-relaxed pl-2">
            {items.map((item, j) => (
              <li key={j}>{renderInline(item.replace(/^-\s*/, ""))}</li>
            ))}
          </ul>
        );
      }

      return (
        <p key={i} className="text-base text-aura-text-secondary leading-relaxed mb-4">
          {renderInline(trimmed)}
        </p>
      );
    });
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-aura-text">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const toc = content.split("\n").filter((l) => l.trim().startsWith("## ")).map((l) => ({
    id: l.trim().replace(/^##\s+/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label: l.trim().replace(/^##\s+/, ""),
  }));

  return (
    <>
      <ReadingProgress />

      <section className="pt-28 pb-8 md:pt-36 bg-gradient-to-b from-aura-bg to-white">
        <Container>
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-aura-text-muted hover:text-aura-text transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" />
             {t("common.backBlog")}
          </Link>

          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
               <Badge>{translated?.category ?? post.category}</Badge>
              <span className="flex items-center gap-1 text-xs text-aura-text-muted">
                <Clock className="w-3 h-3" />
                 {translated?.readTime ?? post.readTime}
              </span>
              <span className="text-xs text-aura-text-muted">
                 {new Date(post.date).toLocaleDateString(language === "hi" ? "hi-IN" : "en-IN", { year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-muted)]">
              {language === "hi" ? "Aura Editorial Team द्वारा reviewed" : "Reviewed by Aura Editorial Team"}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-aura-text leading-tight">
               {translated?.title ?? post.title}
            </h1>
            <p className="mt-4 text-base text-aura-text-secondary leading-relaxed max-w-2xl">
              {post.excerpt}
            </p>
          </div>
          <div className="mt-10 overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 shadow-[0_28px_90px_rgba(72,45,151,0.16)]">
            <img
              src={image}
              alt={`${translated?.title ?? post.title} illustration`}
              decoding="async"
              sizes="(min-width: 1024px) 960px, 100vw"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = getBlogFallbackImage(post);
              }}
              className="aspect-[16/9] w-full object-cover"
            />
          </div>
        </Container>
      </section>

      <section className="pb-20 md:pb-28 bg-white">
        <Container size="wide">
          <div className="mx-auto flex max-w-5xl gap-12">
            {toc.length > 0 && (
              <aside className="hidden lg:block w-56 shrink-0 pt-2">
                <div className="sticky top-28">
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-aura-text-muted mb-4">
                    {language === "hi" ? "इस लेख में" : "In this article"}
                  </p>
                  <nav aria-label="Table of contents">
                    <ul className="space-y-1">
                      {toc.map((item) => (
                        <li key={item.id}>
                          <a
                            href={`#${item.id}`}
                            className="group flex items-center gap-1.5 py-1.5 text-xs text-aura-text-muted transition-colors hover:text-aura-primary"
                          >
                            <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                            <span className="line-clamp-2">{item.label}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              </aside>
            )}

            <article className="min-w-0 max-w-3xl prose-aura">
              <section className="not-prose mb-8 rounded-[1.5rem] border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-5 shadow-[var(--aura-shadow-sm)]">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">
                  {language === "hi" ? "त्वरित उत्तर" : "Quick answer"}
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--aura-body)]">
                  {translated?.excerpt ?? post.excerpt}
                </p>
              </section>
              <section className="not-prose mb-10 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-[var(--aura-border)] bg-white p-5 shadow-[var(--aura-shadow-sm)]">
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-muted)]">Do</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--aura-body)]">
                    <li>Map the workflow before changing tools.</li>
                    <li>Measure the same numbers every week.</li>
                    <li>Train the team on one rule at a time.</li>
                  </ul>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--aura-border)] bg-white p-5 shadow-[var(--aura-shadow-sm)]">
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-muted)]">Don&apos;t</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--aura-body)]">
                    <li>Depend on WhatsApp chats as the source of truth.</li>
                    <li>Review operations only at month-end.</li>
                    <li>Add discounts before checking margin.</li>
                  </ul>
                </div>
              </section>
              {renderContent(content)}
              <section className="not-prose mt-12 rounded-[1.75rem] border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-6">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-muted)]">Implementation checklist</p>
                <ol className="mt-4 space-y-3 text-sm leading-6 text-[var(--aura-body)]">
                  {steps.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--aura-purple)] text-xs font-bold text-white">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="not-prose mt-8 overflow-hidden rounded-[1.75rem] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-sm)]">
                <div className="grid grid-cols-3 bg-[var(--aura-off-white)] px-4 py-3 text-xs font-bold uppercase tracking-[.12em] text-[var(--aura-muted)]">
                  <span>Area</span><span>What to check</span><span>Aura workflow</span>
                </div>
                {topicLinks.map((item) => (
                  <div key={item.href} className="grid grid-cols-3 gap-3 border-t border-[var(--aura-border)] px-4 py-4 text-sm text-[var(--aura-body)]">
                    <span className="font-semibold text-[var(--aura-heading)]">{item.label}</span>
                    <span>Is the process visible, measurable and repeatable?</span>
                    <Link href={item.href} className="font-semibold text-[var(--aura-purple)] hover:underline">Review page</Link>
                  </div>
                ))}
              </section>
              <section className="not-prose mt-8 rounded-[1.75rem] border border-[var(--aura-border)] bg-white p-6 shadow-[var(--aura-shadow-sm)]">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-muted)]">FAQ</p>
                <div className="mt-4 space-y-4">
                  {faq.map((item) => (
                    <div key={item.question}>
                      <h2 className="text-base font-bold text-[var(--aura-heading)]">{item.question}</h2>
                      <p className="mt-1 text-sm leading-6 text-[var(--aura-body)]">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section className="not-prose mt-12 rounded-[1.75rem] border border-[var(--aura-border)] bg-white p-6 shadow-[var(--aura-shadow-sm)]">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-muted)]">
                  {language === "hi" ? "Aura में अगला कदम" : "Next steps in Aura"}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {internalLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group rounded-2xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4 text-sm font-semibold text-[var(--aura-heading)] transition-all hover:-translate-y-0.5 hover:border-[var(--aura-purple)]/30 hover:text-[var(--aura-purple)] hover:shadow-[var(--aura-shadow-sm)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      {item.label}
                      <ArrowRight className="mt-3 h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </section>
              <section className="not-prose mt-8 rounded-[1.75rem] border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-6">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-muted)]">
                  {language === "hi" ? "Sources और further reading" : "Sources and further reading"}
                </p>
                <ul className="mt-4 space-y-3">
                  {citations.map((citation) => (
                    <li key={citation.url}>
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-[var(--aura-purple)] underline-offset-4 hover:underline"
                      >
                        {citation.name}
                      </a>
                      <span className="ml-2 text-xs text-[var(--aura-muted)]">{citation.publisher}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </article>
          </div>

          <ShareBar title={post.title} excerpt={post.excerpt} />
          <div className="mt-8">
            <Newsletter />
          </div>
          <RelatedPosts currentSlug={post.slug} currentCategory={post.category} />
        </Container>
      </section>
    </>
  );
}
