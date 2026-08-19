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
import { SectionDivider } from "@/components/landing/SectionDivider";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function HomePageClient() {
  const containerRef = useScrollReveal();

  return (
    <main ref={containerRef as React.RefObject<HTMLElement>} className="aura-home min-h-screen">
      <Hero />
      <SectionDivider variant="dark-to-light" />
      <TrustStrip />
      <SectionDivider variant="light-to-dark" flip />
      <ProblemSection />
      <ProductFeatures />
      <AdvancedFeatures />
      <AnalyticsAndPlatform />
      <POSSandbox />
      <SectionDivider variant="light-to-dark" />
      <WhatsAppSimulator />
      <SectionDivider variant="dark-to-light" flip />
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
