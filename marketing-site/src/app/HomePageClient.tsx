"use client";

import dynamic from "next/dynamic";
import { Hero } from "@/components/landing/Hero";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { Stats } from "@/components/landing/Stats";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { IndustriesAndIntegrations } from "@/components/landing/IndustriesAndIntegrations";
import { Testimonials } from "@/components/landing/Testimonials";
import { PricingPreview } from "@/components/landing/PricingPreview";
import { InteractiveFAQ } from "@/components/landing/InteractiveFAQ";
import { CTASection } from "@/components/landing/CTASection";
import { SectionDivider } from "@/components/landing/SectionDivider";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const ProductFeatures = dynamic(() => import("@/components/landing/ProductFeatures").then((m) => m.ProductFeatures));
const AdvancedFeatures = dynamic(() => import("@/components/landing/AdvancedFeatures").then((m) => m.AdvancedFeatures));
const AnalyticsAndPlatform = dynamic(() => import("@/components/landing/AnalyticsAndPlatform").then((m) => m.AnalyticsAndPlatform));
const POSSandbox = dynamic(() => import("@/components/landing/POSSandbox").then((m) => m.POSSandbox));
const ROICalculator = dynamic(() => import("@/components/landing/ROICalculator").then((m) => m.ROICalculator));

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
      <ROICalculator />
      <Stats />
      <HowItWorks />
      <IndustriesAndIntegrations />
      <Testimonials />
      <PricingPreview />
      <InteractiveFAQ />
      <CTASection />
    </main>
  );
}

