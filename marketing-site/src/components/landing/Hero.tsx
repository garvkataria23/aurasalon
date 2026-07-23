"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "motion/react";
import { ArrowRight, Play } from "lucide-react";
import { CTA_LINKS } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";
import { MagneticElement } from "@/components/ui/MagneticElement";
import { FloatingGeometry } from "@/components/three/FloatingGeometry";
import { staggerContainer, staggerChild, fadeInUp } from "@/lib/animations";

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const mockupY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const mockupScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 50]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0.5]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16"
    >
      {/* Three.js Background */}
      <FloatingGeometry variant="hero" />

      {/* Gradient Background */}
      <motion.div style={{ opacity: bgOpacity }} className="absolute inset-0 z-[1]">
        <div className="absolute inset-0 bg-gradient-to-b from-warm-cream/80 via-white/60 to-white/80" />
        <div className="absolute inset-0 bg-gradient-mesh opacity-80" />
      </motion.div>

      {/* Floating Decorative Elements */}
      <div className="absolute top-20 left-[10%] w-80 h-80 rounded-full bg-neon-violet/8 blur-[120px] animate-float" />
      <div className="absolute bottom-20 right-[8%] w-96 h-96 rounded-full bg-aura-rose/8 blur-[140px] animate-float" style={{ animationDelay: "3s" }} />
      <div className="absolute top-1/3 right-[20%] w-64 h-64 rounded-full bg-aura-amber/6 blur-[100px] animate-float" style={{ animationDelay: "1.5s" }} />

      {/* Content */}
      <motion.div style={{ y: textY }} className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 py-20 md:py-32">
        <div className="text-center max-w-5xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
          >
            <Badge variant="gradient" className="mb-8 text-sm px-4 py-1.5">
              Trusted by 500+ salons across India
            </Badge>
          </motion.div>

          {/* Headline — Character-by-character reveal */}
          <div className="overflow-hidden mb-6">
            <motion.h1
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight text-aura-text leading-[1.05]"
            >
              Run Your Salon
            </motion.h1>
          </div>
          <div className="overflow-hidden mb-8">
            <motion.h1
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight leading-[1.05]"
            >
              <span className="gradient-text-animated">Like a Star</span>
            </motion.h1>
          </div>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg md:text-xl text-aura-text-secondary max-w-2xl mx-auto leading-relaxed mb-10"
          >
            The all-in-one CRM, POS & AI platform built for modern salons.
            Appointments, billing, staff, inventory, marketing & finance —
            all in one beautifully simple dashboard.
          </motion.p>

          {/* CTAs — Magnetic buttons */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <MagneticElement as="a" href={CTA_LINKS.trial} className="group inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold text-white rounded-2xl bg-gradient-to-r from-neon-violet via-aura-rose to-aura-amber shadow-lg hover:shadow-xl transition-shadow duration-300">
              Start Free Trial
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </MagneticElement>
            <MagneticElement as="a" href={CTA_LINKS.demo} className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold text-aura-text rounded-2xl border border-aura-border hover:bg-aura-bg-warm transition-colors duration-300">
              <Play className="w-4 h-4 text-neon-violet" />
              See Live Demo
            </MagneticElement>
          </motion.div>

          {/* Trust signals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-8 flex items-center justify-center gap-6 text-sm text-aura-text-muted"
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              14-day free trial
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Setup in 2 minutes
            </span>
          </motion.div>
        </div>

        {/* Dashboard Video Mockup */}
        <motion.div
          style={{ y: mockupY, scale: mockupScale }}
          initial={{ opacity: 0, y: 80, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 md:mt-20 relative"
        >
          <div className="relative mx-auto max-w-5xl">
            {/* Glow behind mockup */}
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-r from-neon-violet/25 via-aura-rose/20 to-aura-amber/15 blur-3xl opacity-60" />

            {/* Mockup frame */}
            <div className="relative rounded-2xl border border-aura-border/50 bg-white shadow-2xl overflow-hidden" style={{ transform: "perspective(1200px) rotateX(2deg)" }}>
              {/* Browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-aura-bg-warm/80 border-b border-aura-border/50 backdrop-blur-sm">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-white/80 rounded-lg px-3 py-1 text-xs text-aura-text-muted border border-aura-border/50 backdrop-blur-sm">
                    app.aurasalon.in/dashboard
                  </div>
                </div>
              </div>

              {/* Video/Dashboard content */}
              <div className="relative aspect-video bg-gradient-to-br from-white to-aura-bg-warm">
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster=""
                  className="absolute inset-0 w-full h-full object-cover"
                >
                  <source src="/demo.mp4" type="video/mp4" />
                </video>

                {/* Overlay mock dashboard if no video */}
                <div className="absolute inset-0 p-6 md:p-8 bg-gradient-to-br from-white/95 to-aura-bg-warm/90">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Today's Revenue", value: "₹24,580", color: "from-neon-violet/10 to-neon-violet/5" },
                      { label: "Appointments", value: "18", color: "from-aura-rose/10 to-aura-rose/5" },
                      { label: "New Clients", value: "5", color: "from-blue-500/10 to-blue-500/5" },
                      { label: "Pending", value: "₹3,200", color: "from-aura-amber/10 to-aura-amber/5" },
                    ].map((stat) => (
                      <div key={stat.label} className={`rounded-xl p-3 bg-gradient-to-br ${stat.color} border border-aura-border/30`}>
                        <div className="text-[10px] text-aura-text-muted mb-0.5">{stat.label}</div>
                        <div className="text-base md:text-lg font-bold text-aura-text">{stat.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 rounded-xl border border-aura-border/30 bg-white/80 p-3 backdrop-blur-sm">
                      <div className="text-xs font-semibold text-aura-text mb-2">Revenue Trend</div>
                      <div className="h-20 flex items-end gap-1">
                        {[40, 55, 45, 70, 65, 80, 75, 90, 85, 95, 88, 100].map((h, i) => (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ duration: 0.6, delay: 1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                            className="flex-1 rounded-t-sm bg-gradient-to-t from-neon-violet/60 to-neon-violet/20"
                          />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-aura-border/30 bg-white/80 p-3 backdrop-blur-sm">
                      <div className="text-xs font-semibold text-aura-text mb-2">Upcoming</div>
                      <div className="space-y-1.5">
                        {["Priya — Hair Color", "Rahul — Beard Trim", "Anjali — Facial"].map((item, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1.2 + i * 0.1 }}
                            className="flex items-center gap-2 text-[11px] text-aura-text-secondary"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-neon-violet" />
                            {item}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          className="flex justify-center mt-12"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-6 h-10 rounded-full border-2 border-aura-border-strong flex items-start justify-center pt-2"
          >
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4], scaleY: [1, 1.5, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-1 h-2 rounded-full bg-neon-violet"
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
