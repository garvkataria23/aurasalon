"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, Clock } from "lucide-react";
import { BLOG_POSTS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";

const BLOG_CONTENT: Record<string, string> = {
  "how-to-increase-salon-revenue": `
Running a profitable salon isn't just about great haircuts — it's about smart business decisions. Here are seven proven strategies that top-performing salons use to boost revenue by 30-50%.

## 1. Implement Smart Pricing

Don't just set prices and forget. Use data to understand which services have the highest margins and adjust accordingly. Happy hours during slow periods can fill empty slots without cannibalizing peak revenue.

## 2. Upsell with Intelligence

Train your staff to suggest complementary services naturally. A haircut client could benefit from a conditioning treatment. A coloring client might appreciate a maintenance kit. Use AI recommendations to guide your team.

## 3. Reduce No-Shows Dramatically

No-shows cost Indian salons an estimated 15-20% of potential revenue. Implement automated WhatsApp reminders 24 hours and 1 hour before appointments. Consider a small deposit for high-value services.

## 4. Launch a Membership Program

Recurring revenue is the backbone of a stable salon business. Offer monthly memberships that include perks like priority booking, discounted services, and exclusive products.

## 5. Optimize Your Staff Schedule

Use appointment data to identify peak hours and staff accordingly. Overstaffing during slow periods wastes money. Understaffing during rush hours loses clients.

## 6. Leverage Customer Data

Your CRM is a goldmine. Analyze visit frequency, average spend, and service preferences. Create targeted campaigns for at-risk clients who haven't visited in 60+ days.

## 7. Automate Your Marketing

Set up automated birthday campaigns, festival promotions, and re-engagement sequences. This runs 24/7 without consuming your time.
  `,
  "salon-staff-management-guide": `
Managing salon staff effectively is the difference between a thriving business and a chaotic one. This guide covers everything from attendance to performance optimization.

## The Attendance Challenge

Manual attendance systems are prone to buddy punching and errors. Modern solutions include biometric verification, face recognition, and GPS-based mobile check-ins.

## Commission Structures That Work

The best commission structures incentivize behavior that benefits the salon — not just individual revenue. Consider tiered commissions that reward consistency, client retention, and upselling.

## Performance Tracking

What gets measured gets improved. Track metrics like revenue per stylist, client retention rate, and average service time. Share these metrics transparently with your team.

## Payroll Made Simple

Automated payroll eliminates errors and saves hours every month. Integrate attendance, commissions, deductions, and bonuses into a single automated system.
  `,
};

interface BlogPostContentProps {
  slug: string;
}

export function BlogPostContent({ slug }: BlogPostContentProps) {
  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    return (
      <Container className="pt-40 pb-20 text-center">
        <h1 className="text-2xl font-bold text-aura-text">Post not found</h1>
        <Link href="/blog" className="text-neon-violet mt-4 inline-block">← Back to blog</Link>
      </Container>
    );
  }

  const content = BLOG_CONTENT[slug] || post.excerpt;

  return (
    <>
      <section className="pt-28 pb-8 md:pt-36 bg-gradient-to-b from-aura-bg to-white">
        <Container>
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-aura-text-muted hover:text-aura-text transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to blog
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <Badge>{post.category}</Badge>
              <span className="flex items-center gap-1 text-xs text-aura-text-muted">
                <Clock className="w-3 h-3" />
                {post.readTime}
              </span>
              <span className="text-xs text-aura-text-muted">
                {new Date(post.date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-aura-text leading-tight">
              {post.title}
            </h1>
          </motion.div>
        </Container>
      </section>

      <section className="pb-20 md:pb-28 bg-white">
        <Container size="narrow">
          <motion.article
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {content.split("\n\n").map((paragraph, i) => {
              if (paragraph.startsWith("## ")) {
                return <h2 key={i} className="text-xl font-bold text-aura-text mt-8 mb-3">{paragraph.replace("## ", "")}</h2>;
              }
              return <p key={i} className="text-base text-aura-text-secondary leading-relaxed mb-4">{paragraph}</p>;
            })}
          </motion.article>
        </Container>
      </section>
    </>
  );
}
