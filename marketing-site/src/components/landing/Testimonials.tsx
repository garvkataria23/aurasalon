"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { TESTIMONIALS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function Testimonials() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(0);
  const dragX = useMotionValue(0);

  const next = useCallback(() => { setDirection(1); setActive((p) => (p + 1) % TESTIMONIALS.length); }, []);
  const prev = useCallback(() => { setDirection(-1); setActive((p) => (p - 1 + TESTIMONIALS.length) % TESTIMONIALS.length); }, []);

  // Auto-advance
  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0, rotateY: dir > 0 ? 8 : -8, scale: 0.9 }),
    center: { x: 0, opacity: 1, rotateY: 0, scale: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0, rotateY: dir > 0 ? -8 : 8, scale: 0.9 }),
  };

  const handleDragEnd = (_: never, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (info.offset.x < -80 || info.velocity.x < -200) next();
    else if (info.offset.x > 80 || info.velocity.x > 200) prev();
  };

  return (
    <section ref={ref} className="py-24 md:py-32 bg-white section-divider overflow-hidden">
      <Container>
        <SectionHeading
          badge="Testimonials"
          title="Loved by Salon Owners"
          subtitle="See what salon owners across India are saying about Aura."
        />

        <div className="mt-16 max-w-3xl mx-auto relative" style={{ perspective: "1200px" }}>
          {/* 3D Card Stack — background cards */}
          <div className="absolute inset-0 flex items-center justify-center">
            {[1, 2].map((offset) => {
              const idx = (active + offset) % TESTIMONIALS.length;
              return (
                <div
                  key={idx}
                  className="absolute w-full rounded-3xl border border-aura-border bg-white shadow-sm transition-all duration-500"
                  style={{
                    transform: `scale(${1 - offset * 0.06}) translateY(${offset * 12}px) translateZ(${-offset * 60}px)`,
                    opacity: 0.3 - offset * 0.1,
                    zIndex: -offset,
                  }}
                >
                  <div className="p-8 md:p-12">
                    <blockquote className="text-lg text-aura-text leading-relaxed">
                      &ldquo;{TESTIMONIALS[idx].quote.slice(0, 100)}...&rdquo;
                    </blockquote>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main Card — draggable */}
          <div className="relative z-10">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={active}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 200, damping: 25, mass: 0.8 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={handleDragEnd}
                style={{ x: dragX }}
                className="rounded-3xl border border-aura-border bg-white shadow-xl p-8 md:p-12 cursor-grab active:cursor-grabbing"
              >
                <Quote className="w-10 h-10 text-neon-violet/10 mb-4" />

                {/* Stars */}
                <div className="flex gap-1 mb-6">
                  {Array.from({ length: TESTIMONIALS[active].rating }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 + i * 0.05, type: "spring", stiffness: 400 }}
                    >
                      <Star className="w-5 h-5 fill-aura-amber text-aura-amber" />
                    </motion.div>
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="text-lg md:text-xl text-aura-text leading-relaxed mb-8">
                  &ldquo;{TESTIMONIALS[active].quote}&rdquo;
                </blockquote>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <motion.div
                    key={active}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-violet to-aura-rose flex items-center justify-center text-white font-bold text-sm"
                  >
                    {TESTIMONIALS[active].name.charAt(0)}
                  </motion.div>
                  <div>
                    <div className="font-semibold text-aura-text">{TESTIMONIALS[active].name}</div>
                    <div className="text-sm text-aura-text-muted">
                      {TESTIMONIALS[active].role}, {TESTIMONIALS[active].salon} · {TESTIMONIALS[active].city}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={prev}
              className="w-11 h-11 rounded-full border border-aura-border flex items-center justify-center text-aura-text-secondary hover:bg-aura-bg-warm hover:border-aura-border-strong transition-all duration-300"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Dots */}
            <div className="flex items-center gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setDirection(i > active ? 1 : -1); setActive(i); }}
                  className="relative h-2 rounded-full transition-all duration-300 overflow-hidden"
                  style={{ width: i === active ? 24 : 8 }}
                  aria-label={`Go to testimonial ${i + 1}`}
                >
                  <div className="absolute inset-0 bg-aura-border" />
                  {i === active && (
                    <motion.div
                      layoutId="activeDot"
                      className="absolute inset-0 bg-neon-violet rounded-full"
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={next}
              className="w-11 h-11 rounded-full border border-aura-border flex items-center justify-center text-aura-text-secondary hover:bg-aura-bg-warm hover:border-aura-border-strong transition-all duration-300"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}
