"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Search,
  Sparkles,
  Scissors,
  Flower2,
  Stethoscope,
  GraduationCap,
  Dog,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { SEGMENT_PAGES } from "@/lib/seo-enhancements";
import { SEGMENT_CONTENT } from "@/lib/segment-content";

const CATEGORIES = [
  { id: "all", label: "All Solutions (35)", icon: Sparkles },
  { id: "hair", label: "Hair & Grooming", icon: Scissors, slugs: ["hair-salon-software", "barber-shop-software", "unisex-salon-software", "blow-dry-bar-software", "luxury-salon-software", "booth-renter-software"] },
  { id: "beauty", label: "Beauty & Brows", icon: Sparkles, slugs: ["beauty-salon-software", "bridal-salon-software", "bridal-makeup-studio-software", "nail-salon-software", "lash-brow-studio-software", "tanning-salon-software"] },
  { id: "spa", label: "Spa & Holistic", icon: Flower2, slugs: ["spa-software", "ayurvedic-spa-software", "wellness-center-software", "massage-therapy-software", "float-spa-software", "hotel-resort-spa-software"] },
  { id: "clinical", label: "Clinics & Aesthetics", icon: Stethoscope, slugs: ["skin-clinic-software", "medspa-software", "hair-clinic-software", "laser-clinic-software", "cosmetic-dentistry-software", "permanent-makeup-software", "scalp-micropigmentation-software", "weight-loss-clinic-software"] },
  { id: "specialized", label: "Specialized & Mobile", icon: Dog, slugs: ["tattoo-studio-software", "pet-grooming-software", "mobile-beauty-software", "kids-salon-software"] },
  { id: "enterprise", label: "Chains & Academies", icon: Building2, slugs: ["salon-chain-software", "franchise-salon-software", "home-salon-business-software", "salon-academy-software", "nail-art-academy-software"] },
];

export function SolutionsHubClient() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSolutions = useMemo(() => {
    return SEGMENT_PAGES.filter((segment) => {
      const data = SEGMENT_CONTENT.find((item) => item.slug === segment.slug);
      if (!data) return false;

      // Category filter
      if (selectedCategory !== "all") {
        const cat = CATEGORIES.find((c) => c.id === selectedCategory);
        if (cat?.slugs && !cat.slugs.includes(segment.slug)) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = segment.name.toLowerCase().includes(query);
        const matchesAudience = segment.audience.toLowerCase().includes(query);
        const matchesTagline = data.tagline.toLowerCase().includes(query);
        const matchesIntro = data.intro.toLowerCase().includes(query);
        return matchesName || matchesAudience || matchesTagline || matchesIntro;
      }

      return true;
    });
  }, [selectedCategory, searchQuery]);

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Solutions", href: "/solutions" },
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[var(--aura-lavender)] via-[var(--aura-lavender)] to-[var(--aura-off-white)]">
        <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-[var(--aura-purple)]/12 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-[var(--aura-purple-soft)] blur-3xl" aria-hidden="true" />
        <Container className="relative py-20 text-center md:py-28">
          <Breadcrumbs crumbs={crumbs} />
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/15 bg-white/80 px-4 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)] shadow-[0_10px_30px_rgba(111,79,216,0.08)] backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            35 Purpose-Built Industry Solutions
          </span>
          <h1 className="mx-auto mt-6 max-w-4xl text-balance text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[1.06] tracking-[-0.04em] text-[var(--aura-heading)]">
            One connected operating system, shaped for your exact business
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-8 text-[var(--aura-body)] md:text-lg">
            From single-chair barbers and high-volume nail bars to luxury medical aesthetic spas and multi-branch chains — find the purpose-built Aura operating system designed for your workflow.
          </p>

          {/* Search Bar */}
          <div className="mx-auto mt-10 max-w-xl">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-4 h-5 w-5 text-[var(--aura-muted)]" />
              <input
                type="text"
                placeholder="Search by business type, e.g. 'Tattoo', 'Pet Grooming', 'Ayurvedic', 'Nails'..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-[var(--aura-border-strong)] bg-white/95 py-4 pl-12 pr-4 text-sm font-medium text-[var(--aura-heading)] shadow-[var(--aura-shadow-md)] outline-none backdrop-blur-md transition-all focus:border-[var(--aura-purple)] focus:ring-4 focus:ring-[rgba(111,79,216,0.12)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 text-xs font-bold text-[var(--aura-muted)] hover:text-[var(--aura-heading)]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-[var(--aura-purple)] text-white shadow-[0_8px_20px_rgba(111,79,216,0.3)]"
                      : "border border-[var(--aura-border)] bg-white/80 text-[var(--aura-body)] hover:border-[var(--aura-purple)]/30 hover:text-[var(--aura-purple)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {category.label}
                </button>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Solutions Grid */}
      <section className="bg-[var(--aura-off-white)] pb-24 md:pb-32">
        <Container>
          <div className="flex items-center justify-between border-b border-[var(--aura-border)] pb-4 text-xs font-bold uppercase tracking-wider text-[var(--aura-muted)]">
            <span>Showing {filteredSolutions.length} Solutions</span>
            {searchQuery && <span>Filter: &ldquo;{searchQuery}&rdquo;</span>}
          </div>

          {filteredSolutions.length === 0 ? (
            <div className="my-16 rounded-3xl border border-dashed border-[var(--aura-border-strong)] bg-white p-12 text-center">
              <p className="text-lg font-bold text-[var(--aura-heading)]">No solutions found matching &ldquo;{searchQuery}&rdquo;</p>
              <p className="mt-2 text-sm text-[var(--aura-muted)]">Try searching for generic terms like &lsquo;Salon&rsquo;, &lsquo;Spa&rsquo;, &lsquo;Clinic&rsquo;, or &lsquo;Academy&rsquo;.</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}
                className="mt-6 rounded-full bg-[var(--aura-purple)] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[var(--aura-purple-hover)]"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSolutions.map((segment) => {
                const data = SEGMENT_CONTENT.find((item) => item.slug === segment.slug);
                if (!data) return null;
                const Icon = data.icon;
                return (
                  <Link
                    key={segment.slug}
                    href={`/solutions/${segment.slug}`}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-7 shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--aura-purple)]/30 hover:shadow-[0_20px_40px_rgba(111,79,216,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--aura-lavender)] ring-8 ring-[var(--aura-lavender)]/50 transition-colors group-hover:bg-[var(--aura-lavender-strong)]">
                          <Icon className="h-6 w-6 text-[var(--aura-purple)]" />
                        </span>
                        <span className="rounded-full bg-[var(--aura-off-white)] px-3 py-1 text-[11px] font-bold text-[var(--aura-muted)] group-hover:bg-[var(--aura-lavender)] group-hover:text-[var(--aura-purple)]">
                          Vertical OS
                        </span>
                      </div>

                      <h2 className="mt-5 text-xl font-bold tracking-tight text-[var(--aura-heading)] transition-colors group-hover:text-[var(--aura-purple)]">
                        {segment.name}
                      </h2>
                      <p className="mt-1 text-xs font-bold text-[var(--aura-purple)]">{data.tagline}</p>
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[var(--aura-body)]">{data.intro}</p>

                      {/* Highlight stats */}
                      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-[var(--aura-off-white)] p-3 text-xs">
                        {data.stats.slice(0, 2).map((stat) => (
                          <div key={stat.label}>
                            <p className="font-bold text-[var(--aura-heading)]">{stat.value}</p>
                            <p className="text-[10px] text-[var(--aura-muted)]">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-[var(--aura-border)] pt-4 text-xs font-bold text-[var(--aura-purple)]">
                      <span>Explore specialized workflows</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--aura-lavender)] transition-transform group-hover:translate-x-1">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Container>
      </section>

      {/* Enterprise / Custom Consultation Banner */}
      <section className="bg-gradient-to-br from-[var(--aura-purple)] to-[var(--aura-purple-hover)] py-16 text-white">
        <Container className="text-center">
          <h2 className="text-2xl font-bold md:text-3xl">Don&apos;t see your exact business model listed?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/85">
            Aura&apos;s modular architecture connects custom booking rules, POS tax policies, and staff commission ledgers for any bespoke salon or clinic concept.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/demo"
              className="rounded-full bg-white px-6 py-3 text-xs font-bold text-[var(--aura-purple)] shadow-lg hover:bg-[var(--aura-off-white)]"
            >
              Discuss Custom Architecture
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
