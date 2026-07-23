"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Star, Quote, ArrowRight } from "lucide-react";
import { TESTIMONIALS, CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { GridBackground } from "@/components/ui/GridBackground";
import { staggerContainer, staggerChild } from "@/lib/animations";

const CASE_STUDIES = [
  {
    salon: "Glow Studio",
    city: "Mumbai",
    before: { revenue: "₹8L/month", clients: 200, staff: 8, noShows: "25%" },
    after: { revenue: "₹12L/month", clients: 340, staff: 12, noShows: "8%" },
    quote: "Aura helped us increase revenue by 50% in just 3 months. The AI marketing and Customer 360 features are incredible.",
    owner: "Priya Sharma",
  },
  {
    salon: "The Style Lounge",
    city: "Delhi",
    before: { revenue: "₹15L/month", clients: 400, staff: 20, noShows: "20%" },
    after: { revenue: "₹22L/month", clients: 650, staff: 25, noShows: "5%" },
    quote: "We save 15 hours every week on admin tasks. The staff management module alone pays for the subscription.",
    owner: "Rahul Mehta",
  },
];

export default function CustomersPage() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <>
      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 bg-gradient-to-b from-aura-bg to-white overflow-hidden">
        <GridBackground className="opacity-30" />
        <Container className="relative z-10">
          <SectionHeading
            badge="Customers"
            title="Loved by Salon Owners Across India"
            subtitle="See how salons are transforming their businesses with Aura."
          />
        </Container>
      </section>

      {/* Testimonials Grid */}
      <section ref={ref} className="pb-20 md:pb-28 bg-white">
        <Container>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
          >
            {TESTIMONIALS.map((testimonial) => (
              <motion.div
                key={testimonial.name}
                variants={staggerChild}
                className="glow-card rounded-2xl border border-aura-border bg-white p-6 transition-all duration-300 hover:shadow-lg hover:border-transparent"
              >
                <Quote className="w-8 h-8 text-neon-violet/15 mb-4" />
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-aura-amber text-aura-amber" />
                  ))}
                </div>
                <p className="text-sm text-aura-text leading-relaxed mb-6">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-aura-border/50">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-violet to-aura-rose flex items-center justify-center text-white font-bold text-xs">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-aura-text">{testimonial.name}</div>
                    <div className="text-xs text-aura-text-muted">
                      {testimonial.role}, {testimonial.salon} · {testimonial.city}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* Case Studies */}
      <section className="py-20 md:py-28 bg-aura-bg">
        <Container>
          <SectionHeading
            badge="Case Studies"
            title="Real Results, Real Salons"
            subtitle="Before and after switching to Aura."
          />
          <div className="mt-16 space-y-8 max-w-5xl mx-auto">
            {CASE_STUDIES.map((study) => (
              <motion.div
                key={study.salon}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="glow-card rounded-2xl border border-aura-border bg-white p-8 md:p-10"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-aura-text">{study.salon}</h3>
                    <p className="text-sm text-aura-text-muted">{study.city}</p>
                  </div>
                  <div className="text-sm text-aura-text-secondary italic max-w-md">
                    &ldquo;{study.quote}&rdquo;
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.keys(study.before).map((key) => (
                    <div key={key} className="text-center">
                      <div className="text-xs text-aura-text-muted uppercase tracking-wider mb-2">
                        {key === "revenue" ? "Monthly Revenue" : key === "clients" ? "Active Clients" : key === "staff" ? "Team Size" : "No-Shows"}
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <div>
                          <div className="text-xs text-aura-text-muted">Before</div>
                          <div className="text-sm font-semibold text-aura-text">{study.before[key as keyof typeof study.before]}</div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-emerald-500" />
                        <div>
                          <div className="text-xs text-emerald-600">After</div>
                          <div className="text-sm font-bold text-emerald-600">{study.after[key as keyof typeof study.after]}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <Container>
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-aura-text mb-4">
              Join 500+ Salons Growing with Aura
            </h2>
            <p className="text-aura-text-secondary mb-8 max-w-xl mx-auto">
              Start your free trial today and see why salon owners love Aura.
            </p>
            <a href={CTA_LINKS.trial}>
              <Button variant="primary" size="lg">
                Start Free Trial
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
        </Container>
      </section>
    </>
  );
}
