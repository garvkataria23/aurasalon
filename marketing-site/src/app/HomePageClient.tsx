"use client";

import { Hero } from "@/components/landing/Hero";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { ProductFeatures } from "@/components/landing/ProductFeatures";
import { AdvancedFeatures } from "@/components/landing/AdvancedFeatures";
import { AnalyticsAndPlatform } from "@/components/landing/AnalyticsAndPlatform";
import { POSSandbox } from "@/components/landing/POSSandbox";
import { WhatsAppSimulator } from "@/components/landing/WhatsAppSimulator";
import { ROICalculator } from "@/components/landing/ROICalculator";
import { MultiBranchShowcase } from "@/components/landing/MultiBranchShowcase";
import { HardwareShowcase } from "@/components/landing/HardwareShowcase";
import { Stats } from "@/components/landing/Stats";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { IndustriesAndIntegrations } from "@/components/landing/IndustriesAndIntegrations";
import { Testimonials } from "@/components/landing/Testimonials";
import { PricingPreview } from "@/components/landing/PricingPreview";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { InteractiveFAQ } from "@/components/landing/InteractiveFAQ";
import { CTASection } from "@/components/landing/CTASection";

export default function HomePageClient() {
  return (
    <main className="aura-home min-h-screen">
      <Hero />
      <TrustStrip />
      <ProblemSection />
      <ProductFeatures />
      <AdvancedFeatures />
      <AnalyticsAndPlatform />
      <POSSandbox />
      <WhatsAppSimulator />
      <ROICalculator />
      <MultiBranchShowcase />
      <HardwareShowcase />
      <Stats />
      <HowItWorks />
      <IndustriesAndIntegrations />
      <Testimonials />
      <PricingPreview />
      <ComparisonSection />
      <SecuritySection />
      <InteractiveFAQ />
      <CTASection />
    </main>
  );
}
