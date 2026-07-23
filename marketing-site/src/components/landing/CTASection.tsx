"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "motion/react";
import { ArrowRight } from "lucide-react";
import { CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { MagneticElement } from "@/components/ui/MagneticElement";
import { FloatingGeometry } from "@/components/three/FloatingGeometry";

export function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const textY = useTransform(scrollYProgress, [0, 1], [40, -20]);

  return (
    <section ref={ref} className="relative py-24 md:py-32 bg-white overflow-hidden">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl"
        >
          {/* Background with parallax */}
          <motion.div style={{ y: bgY }} className="absolute inset-0 bg-gradient-to-br from-neon-violet via-aura-burgundy-strong to-deep-navy" />

          {/* Three.js floating orbs */}
          <div className="absolute inset-0 opacity-40">
            <FloatingGeometry variant="cta" />
          </div>

          {/* Additional CSS orbs */}
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-aura-rose/15 blur-[100px] animate-float" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-neon-violet/20 blur-[100px] animate-float" style={{ animationDelay: "3s" }} />

          {/* Content with parallax */}
          <motion.div style={{ y: textY }} className="relative z-10 p-10 md:p-16 lg:p-20 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
                Ready to Transform
                <br />
                Your Salon?
              </h2>
              <p className="text-lg text-white/60 max-w-xl mx-auto mb-8">
                Join 500+ salons already growing with Aura. Start your free trial today — no credit card required.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <MagneticElement as="a" href={CTA_LINKS.trial} className="group inline-flex items-center gap-2.5 px-8 py-4 text-base font-bold text-aura-burgundy rounded-2xl bg-white shadow-lg hover:shadow-xl transition-shadow">
                Start Free Trial
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </MagneticElement>
              <MagneticElement as="a" href={CTA_LINKS.demo} className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold text-white rounded-2xl border border-white/20 hover:bg-white/10 transition-colors">
                See Live Demo
              </MagneticElement>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.6 }}
              className="mt-6 flex items-center justify-center gap-6 text-sm text-white/40"
            >
              <span>14-day free trial</span>
              <span>·</span>
              <span>No credit card</span>
              <span>·</span>
              <span>Setup in 2 minutes</span>
            </motion.div>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
