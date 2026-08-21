"use client";

import { useState } from "react";
import { Star, ChevronLeft, ChevronRight, Quote, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";

const REVIEWS = [
  {
    brand: "LEMON SALON",
    author: "Lemon",
    role: "Admin & Operations Head",
    city: "Mumbai",
    rating: 5,
    text: "This software has completely streamlined our salon workflow. Smart scheduling, smooth POS, and easy client history tracking make daily operations effortless. The support team is quick and helpful every time. Truly a game changer for our business.",
  },
  {
    brand: "PURPLE SALON & SPA",
    author: "Shruti",
    role: "Managing Director",
    city: "Delhi NCR",
    rating: 5,
    text: "Our favorite feature is appointment reminder, birthday texts, confirmation emails, thank you for visiting, come back text, client profiles and daily sales report. The after-sales customer support is excellent. We highly recommend the software.",
  },
  {
    brand: "LOOKS SALON",
    author: "Kavita S.",
    role: "Franchise Partner",
    city: "Bangalore",
    rating: 5,
    text: "Managing 4 branches with 35 stylists was a constant spreadsheet mess. Aura's centralized multi-outlet dashboard, instant GST bills, and automated WhatsApp appointment confirmations reduced our front-desk chaos by 80%.",
  },
  {
    brand: "GEETANJALI SALON",
    author: "Vikram Mehta",
    role: "Salon Director",
    city: "Hyderabad",
    rating: 5,
    text: "The inventory and recipe consumption tracking saved us over ₹75,000 in hair color pilferage in our first quarter alone. Staff love the real-time commission calculator on their phones!",
  },
];

export function Testimonials() {
  const [currentIdx, setCurrentIdx] = useState(0);

  const prev = () => {
    setCurrentIdx((curr) => (curr === 0 ? REVIEWS.length - 1 : curr - 1));
  };

  const next = () => {
    setCurrentIdx((curr) => (curr === REVIEWS.length - 1 ? 0 : curr + 1));
  };

  const review = REVIEWS[currentIdx];

  return (
    <section className="relative bg-white py-20 md:py-28 overflow-hidden border-t border-[var(--aura-border)]">
      <Container className="relative z-10">
        
        {/* Header with Navigation Controls */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <p className="font-serif italic text-base md:text-lg text-[var(--aura-purple)] font-medium mb-2">
              Reviews
            </p>
            <h2 className="text-[clamp(2.2rem,4.5vw,3.4rem)] font-extrabold tracking-[-0.04em] text-[var(--aura-heading)] leading-tight">
              Client Testimonials
            </h2>
          </div>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={prev}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--aura-border)] bg-white text-[var(--aura-heading)] shadow-xs transition-all hover:bg-[var(--aura-lavender)] hover:text-[var(--aura-purple)] hover:border-[var(--aura-purple)]/30"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--aura-border)] bg-white text-[var(--aura-heading)] shadow-xs transition-all hover:bg-[var(--aura-lavender)] hover:text-[var(--aura-purple)] hover:border-[var(--aura-purple)]/30"
              aria-label="Next testimonial"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Testimonial Active Slide Card */}
        <div className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--aura-border)] bg-[#FCFBF8] p-8 sm:p-12 md:p-14 shadow-[0_12px_40px_rgba(0,0,0,0.04)] transition-all">
            
            {/* Top Bar with Brand and Stars */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--aura-border)] pb-6">
              <div className="flex items-center gap-3">
                <span className="font-extrabold text-xl sm:text-2xl tracking-wider text-[var(--aura-heading)] uppercase">
                  {review.brand}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Verified Client
                </span>
              </div>

              {/* Star Rating */}
              <div className="flex gap-1" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
            </div>

            {/* Testimonial Quote */}
            <div className="mt-8 relative">
              <Quote className="h-10 w-10 text-[var(--aura-purple)]/15 absolute -left-2 -top-4 pointer-events-none" />
              <p className="relative z-10 text-base sm:text-xl md:text-2xl font-medium leading-relaxed text-[var(--aura-heading)] italic">
                &ldquo;{review.text}&rdquo;
              </p>
            </div>

            {/* Author Footer */}
            <div className="mt-8 flex items-center justify-between border-t border-[var(--aura-border)] pt-6">
              <div>
                <p className="text-base font-bold text-[var(--aura-heading)]">{review.author}</p>
                <p className="text-xs text-[var(--aura-body)]">{review.role} · {review.city}</p>
              </div>

              {/* Dots Pagination */}
              <div className="flex gap-1.5">
                {REVIEWS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentIdx(i)}
                    className={`h-2 rounded-full transition-all ${
                      currentIdx === i ? "w-6 bg-[var(--aura-purple)]" : "w-2 bg-zinc-300"
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </div>

          </div>
        </div>

      </Container>
    </section>
  );
}
