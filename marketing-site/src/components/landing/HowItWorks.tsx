"use client";

import { HOW_IT_WORKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

function StepCard({ step, index, total }: { step: typeof HOW_IT_WORKS[number]; index: number; total: number }) {
  return (
    <div className="relative text-center group">
      {/* Step Number — glowing orb */}
      <div className="relative inline-flex items-center justify-center mb-8">
        <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-violet to-aura-rose text-white text-2xl font-bold flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
          {step.step}
        </div>

        {/* Glow ring behind number */}
        <div className="absolute inset-0 -m-2 rounded-2xl bg-gradient-to-br from-neon-violet/20 to-aura-rose/20 opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-500" />
      </div>

      <h3 className="text-lg font-bold text-aura-text mb-3">{step.title}</h3>
      <p className="text-sm text-aura-text-secondary leading-relaxed max-w-xs mx-auto">
        {step.description}
      </p>

      {/* Connector line */}
      {index < total - 1 && (
        <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px">
          <div className="h-full bg-gradient-to-r from-neon-violet/40 via-aura-rose/30 to-transparent" />
        </div>
      )}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28 bg-aura-bg">
      <Container>
        <SectionHeading
          badge="How It Works"
          title="Up and Running in Minutes"
          subtitle="No complex setup, no training required. Just sign up and start managing your salon."
        />

        <div className="mt-16 grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {HOW_IT_WORKS.map((step, i) => (
            <StepCard key={step.step} step={step} index={i} total={HOW_IT_WORKS.length} />
          ))}
        </div>
      </Container>
    </section>
  );
}
