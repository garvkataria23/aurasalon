"use client";

import { useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import { STATS } from "@/lib/constants";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { Container } from "@/components/ui/Container";
import { staggerContainer, staggerChild } from "@/lib/animations";

export function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

  return (
    <section ref={ref} className="relative py-24 md:py-32 overflow-hidden">
      {/* Animated dark background */}
      <div className="absolute inset-0 bg-gradient-to-b from-deep-navy via-[#1a1040] to-deep-navy" />

      {/* Particle dots */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle, rgba(124,58,237,0.3) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
      </div>

      {/* Floating gradient orbs */}
      <motion.div style={{ y: bgY }} className="absolute inset-0">
        <div className="absolute top-10 left-[15%] w-80 h-80 rounded-full bg-neon-violet/12 blur-[120px] animate-float" />
        <div className="absolute bottom-10 right-[10%] w-96 h-96 rounded-full bg-aura-rose/10 blur-[140px] animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-aura-amber/6 blur-[160px]" />
      </motion.div>

      <Container className="relative z-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12"
        >
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              variants={staggerChild}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3">
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  prefix={stat.prefix}
                />
              </div>
              <div className="text-sm md:text-base text-white/50 font-medium">{stat.label}</div>

              {/* Decorative line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={inView ? { scaleX: 1 } : {}}
                transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="mt-4 h-px w-12 mx-auto bg-gradient-to-r from-transparent via-neon-violet/50 to-transparent"
              />
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
