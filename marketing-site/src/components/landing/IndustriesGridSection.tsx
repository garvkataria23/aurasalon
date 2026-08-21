"use client";

import Link from "next/link";
import { Scissors, Sparkles, Flame, Stethoscope, User, Dog, HeartHandshake, ShieldCheck, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";

const INDUSTRIES = [
  {
    title: "Hair Salon",
    desc: "Smart chair scheduling, stylist commissions & instant GST billing.",
    icon: Scissors,
    tag: "Most Popular",
    gradient: "from-[#2A103D] to-[#541D82]",
    bgImg: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80",
    href: "/platform",
  },
  {
    title: "Spa & Wellness",
    desc: "Therapy room management, package memberships & Ayurvedic billing.",
    icon: Sparkles,
    tag: "Packages & Rooms",
    gradient: "from-[#1B362C] to-[#2E6F59]",
    bgImg: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=600&q=80",
    href: "/workflows",
  },
  {
    title: "Tattoo Studio",
    desc: "Artist deposit tracking, consent forms & hourly project billing.",
    icon: Flame,
    tag: "Artist Rosters",
    gradient: "from-[#2D1D16] to-[#693E2B]",
    bgImg: "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=600&q=80",
    href: "/features",
  },
  {
    title: "Beauty Clinic",
    desc: "Treatment plans, doctor sessions, client history & follow-ups.",
    icon: Stethoscope,
    tag: "Clinical CRM",
    gradient: "from-[#1B293E] to-[#2D537E]",
    bgImg: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80",
    href: "/customer-app",
  },
  {
    title: "Barbershop",
    desc: "High-speed walk-in queue, quick haircuts & mobile UPI checkout.",
    icon: User,
    tag: "Speed & Queue",
    gradient: "from-[#1F2421] to-[#3F4B43]",
    bgImg: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80",
    href: "/owner-crm",
  },
  {
    title: "Pet Salon & Grooming",
    desc: "Breed-specific time slots, vaccination notes & add-on bath services.",
    icon: Dog,
    tag: "Pet Profiles",
    gradient: "from-[#381B2B] to-[#773359]",
    bgImg: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=600&q=80",
    href: "/features/appointments",
  },
  {
    title: "Nail Salon & Studio",
    desc: "Custom nail art catalog, technician turns & product inventory.",
    icon: HeartHandshake,
    tag: "Technician Turns",
    gradient: "from-[#3A142A] to-[#802558]",
    bgImg: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=600&q=80",
    href: "/features/billing",
  },
  {
    title: "Skin & Aesthetic Clinic",
    desc: "Consultation forms, machine utilization & multi-session courses.",
    icon: ShieldCheck,
    tag: "Multi-Session",
    gradient: "from-[#192A32] to-[#345B6B]",
    bgImg: "https://images.unsplash.com/photo-1512290900672-1f41d999052b?auto=format&fit=crop&w=600&q=80",
    href: "/features/client-crm",
  },
];

export function IndustriesGridSection() {
  return (
    <section className="relative bg-white py-20 md:py-28 overflow-hidden border-t border-[var(--aura-border)]">
      <Container className="relative z-10">
        
        {/* Section Intro */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-serif italic text-base md:text-lg text-[var(--aura-purple)] font-medium mb-3">
            Industries we serve
          </p>
          <h2 className="text-[clamp(2.2rem,4.8vw,3.6rem)] font-extrabold tracking-[-0.04em] text-[var(--aura-heading)] leading-[1.12]">
            Booking Software for All Types of Businesses &amp; Sizes
          </h2>
          <p className="mt-4 text-base md:text-lg text-[var(--aura-body)] leading-relaxed max-w-2xl mx-auto">
            Select your business type to explore tailored features and get started on your free trial.
          </p>
        </div>

        {/* 8 Photo Grid Cards */}
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          {INDUSTRIES.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="group relative overflow-hidden rounded-3xl border border-[var(--aura-border)] bg-black/80 aspect-[4/3.4] flex flex-col justify-end p-6 text-white shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.18)]"
              >
                {/* Background Photo */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${item.bgImg})` }}
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20 group-hover:from-black/95 transition-colors" />

                {/* Content */}
                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md text-white border border-white/25 group-hover:bg-[var(--aura-purple)] group-hover:border-transparent transition-colors">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md text-purple-100">
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold tracking-tight text-white group-hover:text-amber-200 transition-colors flex items-center justify-between">
                    {item.title}
                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-amber-200" />
                  </h3>
                  <p className="mt-1 text-xs text-white/80 line-clamp-2 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom CTA bar */}
        <div className="mt-12 text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-[var(--aura-border)] bg-[#FCFBF8] px-6 py-3 shadow-xs">
            <span className="text-xs sm:text-sm font-semibold text-[var(--aura-heading)]">
              Not sure which plan matches your salon setup?
            </span>
            <Link
              href={CTA_LINKS.demo}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--aura-purple)] hover:text-[var(--aura-purple-hover)]"
            >
              Talk to our Salon Consultant <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

      </Container>
    </section>
  );
}
