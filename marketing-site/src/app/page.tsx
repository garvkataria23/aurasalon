"use client";

import { Hero } from "@/components/landing/Hero";
import { LogoCloud } from "@/components/landing/LogoCloud";
import { ProblemSolution } from "@/components/landing/ProblemSolution";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { VideoDemo } from "@/components/landing/VideoDemo";
import { Stats } from "@/components/landing/Stats";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Testimonials } from "@/components/landing/Testimonials";
import { PricingPreview } from "@/components/landing/PricingPreview";
import { IntegrationLogos } from "@/components/landing/IntegrationLogos";
import { CTASection } from "@/components/landing/CTASection";

export default function HomePage() {
  return (
    <>
      <Hero />
      <LogoCloud />
      <ProblemSolution />
      <VideoDemo />
      <FeatureGrid />
      <Stats />
      <HowItWorks />
      <Testimonials />
      <PricingPreview />
      <IntegrationLogos />
      <CTASection />
    </>
  );
}
