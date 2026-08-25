"use client";

import { ValuePillarsSection } from "@/components/landing/ValuePillarsSection";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { IndustriesGridSection } from "@/components/landing/IndustriesGridSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { ProductFeatures } from "@/components/landing/ProductFeatures";
import { AdvancedFeatures } from "@/components/landing/AdvancedFeatures";
import { AnalyticsAndPlatform } from "@/components/landing/AnalyticsAndPlatform";
import { FeatureDirectoryPills } from "@/components/landing/FeatureDirectoryPills";
import { POSSandbox } from "@/components/landing/POSSandbox";
import { ROICalculator } from "@/components/landing/ROICalculator";
import { Testimonials } from "@/components/landing/Testimonials";
import { AppDownloadSection } from "@/components/landing/AppDownloadSection";
import { InteractiveFAQ } from "@/components/landing/InteractiveFAQ";
import { LeadCallbackSection } from "@/components/landing/LeadCallbackSection";
import { CityDirectorySection } from "@/components/landing/CityDirectorySection";
import { CTASection } from "@/components/landing/CTASection";
import { ScrollRevealInitializer } from "@/components/ui/ScrollRevealInitializer";

export function HomePageDeferredSections() {
  return (
    <>
      <ScrollRevealInitializer />
      <TrustStrip />
      <ValuePillarsSection />
      <IndustriesGridSection />
      <ProblemSection />
      <ProductFeatures />
      <AdvancedFeatures />
      <AnalyticsAndPlatform />
      <FeatureDirectoryPills />
      <POSSandbox />
      <ROICalculator />
      <Testimonials />
      <AppDownloadSection />
      <InteractiveFAQ />
      <LeadCallbackSection />
      <CityDirectorySection />
      <CTASection />
    </>
  );
}
