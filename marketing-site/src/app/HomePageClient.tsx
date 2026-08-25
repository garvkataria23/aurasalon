import { Hero } from "@/components/landing/Hero";
import { HomePageDeferredSectionsLoader } from "@/components/landing/HomePageDeferredSectionsLoader";

export default function HomePageClient() {
  return (
    <div className="aura-home min-h-screen bg-white">
      {/* 1. Hero with rating badges and live interactive dashboard */}
      <Hero />
      
      <HomePageDeferredSectionsLoader />
    </div>
  );
}
