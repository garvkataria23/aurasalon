"use client";

import { Hero } from "@/components/landing/Hero";
import { TrustBadges } from "@/components/landing/TrustBadges";
import { LogoCloud } from "@/components/landing/LogoCloud";
import { ProblemSolution } from "@/components/landing/ProblemSolution";
import { VideoDemo } from "@/components/landing/VideoDemo";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { Stats } from "@/components/landing/Stats";
import { CompetitorComparison } from "@/components/landing/CompetitorComparison";
import { Testimonials } from "@/components/landing/Testimonials";
import { PricingPreview } from "@/components/landing/PricingPreview";
import { CTASection } from "@/components/landing/CTASection";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBadges />
      <LogoCloud />
      <ProblemSolution />
      <VideoDemo />
      <FeatureGrid />
      <Stats />
      <CompetitorComparison />
      <Testimonials />
      <PricingPreview />
      <CTASection />
    </>
  );
}
