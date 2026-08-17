"use client";

import { Hero } from "@/components/landing/Hero";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { ProductFeatures } from "@/components/landing/ProductFeatures";
import { AdvancedFeatures } from "@/components/landing/AdvancedFeatures";
import { POSSandbox } from "@/components/landing/POSSandbox";
import { WhatsAppSimulator } from "@/components/landing/WhatsAppSimulator";
import { CompetitorMatrix } from "@/components/landing/CompetitorMatrix";
import { ROICalculator } from "@/components/landing/ROICalculator";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { MultiBranchShowcase } from "@/components/landing/MultiBranchShowcase";
import { HardwareShowcase } from "@/components/landing/HardwareShowcase";
import { Stats } from "@/components/landing/Stats";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Testimonials } from "@/components/landing/Testimonials";
import { PricingPreview } from "@/components/landing/PricingPreview";
import { InteractiveFAQ } from "@/components/landing/InteractiveFAQ";
import { CTASection } from "@/components/landing/CTASection";

export default function HomePageClient() {
  return (
    <main className="min-h-screen">
      <Hero />
      <TrustStrip />
      <ProblemSection />
      <ProductFeatures />
      <AdvancedFeatures />
      <POSSandbox />
      <WhatsAppSimulator />
      <CompetitorMatrix />
      <ROICalculator />
      <FeatureGrid />
      <MultiBranchShowcase />
      <HardwareShowcase />
      <Stats />
      <HowItWorks />
      <Testimonials />
      <PricingPreview />
      <InteractiveFAQ />
      <CTASection />
    </main>
  );
}
