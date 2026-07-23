"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import { BLOG_POSTS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GridBackground } from "@/components/ui/GridBackground";
import { staggerContainer, staggerChild } from "@/lib/animations";

export default function BlogPage() {
  return (
    <>
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 bg-gradient-to-b from-aura-bg to-white overflow-hidden">
        <GridBackground className="opacity-30" />
        <Container className="relative z-10">
          <SectionHeading
            badge="Blog"
            title="Insights for Salon Owners"
            subtitle="Tips, guides, and industry insights to help you grow your salon business."
          />
        </Container>
      </section>

      <section className="pb-20 md:pb-28 bg-white">
        <Container>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
          >
            {BLOG_POSTS.map((post) => (
              <motion.article key={post.slug} variants={staggerChild}>
                <Link href={`/blog/${post.slug}`} className="block group">
                  <div className="glow-card h-full rounded-2xl border border-aura-border bg-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-transparent hover:-translate-y-1">
                    {/* Gradient header */}
                    <div className="h-40 bg-gradient-to-br from-neon-violet/10 via-aura-rose/10 to-aura-amber/10 flex items-center justify-center">
                      <span className="text-4xl font-bold gradient-text opacity-30">{post.category.charAt(0)}</span>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-semibold text-neon-violet bg-neon-violet/10 px-2.5 py-0.5 rounded-full">
                          {post.category}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-aura-text-muted">
                          <Clock className="w-3 h-3" />
                          {post.readTime}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-aura-text mb-2 group-hover:text-neon-violet transition-colors leading-snug">
                        {post.title}
                      </h3>
                      <p className="text-sm text-aura-text-secondary leading-relaxed line-clamp-2">
                        {post.excerpt}
                      </p>
                      <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-neon-violet opacity-0 group-hover:opacity-100 transition-opacity">
                        Read more <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </motion.div>
        </Container>
      </section>
    </>
  );
}
