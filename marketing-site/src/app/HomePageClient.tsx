"use client";

import dynamic from "next/dynamic";
import { Hero } from "@/components/landing/Hero";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { ValuePillarsSection } from "@/components/landing/ValuePillarsSection";
import { IndustriesGridSection } from "@/components/landing/IndustriesGridSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { FeatureDirectoryPills } from "@/components/landing/FeatureDirectoryPills";
import { Testimonials } from "@/components/landing/Testimonials";
import { AppDownloadSection } from "@/components/landing/AppDownloadSection";
import { InteractiveFAQ } from "@/components/landing/InteractiveFAQ";
import { LeadCallbackSection } from "@/components/landing/LeadCallbackSection";
import { CityDirectorySection } from "@/components/landing/CityDirectorySection";
import { CTASection } from "@/components/landing/CTASection";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const ProductFeatures = dynamic(() => import("@/components/landing/ProductFeatures").then((m) => m.ProductFeatures));
const AdvancedFeatures = dynamic(() => import("@/components/landing/AdvancedFeatures").then((m) => m.AdvancedFeatures));
const AnalyticsAndPlatform = dynamic(() => import("@/components/landing/AnalyticsAndPlatform").then((m) => m.AnalyticsAndPlatform));
const POSSandbox = dynamic(() => import("@/components/landing/POSSandbox").then((m) => m.POSSandbox));
const ROICalculator = dynamic(() => import("@/components/landing/ROICalculator").then((m) => m.ROICalculator));

export default function HomePageClient() {
  const containerRef = useScrollReveal();

  return (
    <main ref={containerRef as React.RefObject<HTMLElement>} className="aura-home min-h-screen bg-white">
      {/* 1. Hero with rating badges and live interactive dashboard */}
      <Hero />
      
      {/* 2. Top Brands Social Proof Marquee */}
      <TrustStrip />
      
      {/* 3. The Best Software in Industry — 3 Value Pillars & Tour Preview */}
      <ValuePillarsSection />
      
      {/* 4. Industries We Serve (8 Photo Cards) */}
      <IndustriesGridSection />
      
      {/* 5. The Salon Reality & Problem/Solution */}
      <ProblemSection />
      
      {/* 6. All-in-One Solution Feature Showcases (10 alternating modules) */}
      <ProductFeatures />
      <AdvancedFeatures />
      <AnalyticsAndPlatform />
      
      {/* 7. Complete List of Features Explorer Pills */}
      <FeatureDirectoryPills />
      
      {/* 8. Interactive POS Sandbox & Live Billing Simulator */}
      <POSSandbox />
      
      {/* 9. Salon ROI & Profit Calculator */}
      <ROICalculator />
      
      {/* 10. Client Testimonials Slider with Brand Logos */}
      <Testimonials />
      
      {/* 11. Download Mobile Companion App */}
      <AppDownloadSection />
      
      {/* 12. Searchable Frequently Asked Questions */}
      <InteractiveFAQ />
      
      {/* 13. Instant Lead Callback Form */}
      <LeadCallbackSection />
      
      {/* 14. Aura Across India City Directory */}
      <CityDirectorySection />
      
      {/* 15. Final Transformation CTA */}
      <CTASection />
    </main>
  );
}


