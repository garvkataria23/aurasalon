"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  AlertTriangle, Clock, CreditCard, FileText, Users, Package,
  Zap, Calendar, BarChart3, Shield, Bot, Smartphone,
} from "lucide-react";

const problems = [
  { icon: FileText, text: "Paper registers & manual tracking" },
  { icon: Clock, text: "Missed appointments & no-shows" },
  { icon: CreditCard, text: "Billing errors & GST confusion" },
  { icon: Users, text: "No client history or preferences" },
  { icon: Package, text: "Inventory waste & stockouts" },
  { icon: AlertTriangle, text: "Staff attendance fraud" },
];

const solutions = [
  { icon: Zap, text: "Real-time digital dashboard" },
  { icon: Calendar, text: "AI-powered smart booking" },
  { icon: BarChart3, text: "GST-ready auto invoicing" },
  { icon: Shield, text: "Complete Customer 360 view" },
  { icon: Bot, text: "AI reorder & waste tracking" },
  { icon: Smartphone, text: "Biometric & face attendance" },
];

function ProblemItem({ item, index }: { item: typeof problems[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -30, clipPath: "inset(0 100% 0 0)" }}
      animate={inView ? { opacity: 1, x: 0, clipPath: "inset(0 0% 0 0)" } : {}}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-4 p-4 rounded-xl bg-white border border-aura-border/50 group hover:border-danger/30 hover:bg-danger/5 transition-all duration-300 hover:shadow-sm"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center group-hover:bg-danger/15 group-hover:scale-110 transition-all duration-300">
        <item.icon className="w-5 h-5 text-danger" />
      </div>
      <span className="text-sm font-medium text-aura-text-secondary">{item.text}</span>
    </motion.div>
  );
}

function SolutionItem({ item, index }: { item: typeof solutions[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: 30, clipPath: "inset(0 0 0 100%)" }}
      animate={inView ? { opacity: 1, x: 0, clipPath: "inset(0 0 0 0%)" } : {}}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-4 p-4 rounded-xl bg-white border border-aura-border/50 group hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-300 hover:shadow-sm"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/15 group-hover:scale-110 transition-all duration-300">
        <item.icon className="w-5 h-5 text-emerald-600" />
      </div>
      <span className="text-sm font-medium text-aura-text-secondary">{item.text}</span>
    </motion.div>
  );
}

export function ProblemSolution() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-20 md:py-28 bg-aura-bg">
      <Container>
        <SectionHeading
          badge="Why Aura?"
          title="From Chaos to Clarity"
          subtitle="Your salon deserves better than spreadsheets, paper registers, and WhatsApp groups."
        />

        <div className="mt-16 grid md:grid-cols-2 gap-8 lg:gap-16 max-w-5xl mx-auto">
          {/* Problem Side */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-center mb-8"
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-danger/10 text-danger mb-3">
                Without Aura
              </span>
              <h3 className="text-xl font-bold text-aura-text">The Old Way</h3>
            </motion.div>
            <div className="space-y-3">
              {problems.map((item, i) => (
                <ProblemItem key={item.text} item={item} index={i} />
              ))}
            </div>
          </div>

          {/* Solution Side */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-center mb-8"
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 mb-3">
                With Aura
              </span>
              <h3 className="text-xl font-bold text-aura-text">The Aura Way</h3>
            </motion.div>
            <div className="space-y-3">
              {solutions.map((item, i) => (
                <SolutionItem key={item.text} item={item} index={i} />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
