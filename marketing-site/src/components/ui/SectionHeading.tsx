"use client";

import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  badge?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
  gradient?: boolean;
}

function WordByWordReveal({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");

  return (
    <span className={cn("inline-block", className)} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} className="inline-block mr-[0.3em]">
          {word}
        </span>
      ))}
    </span>
  );
}

export function SectionHeading({
  badge,
  title,
  subtitle,
  align = "center",
  className,
  gradient = false,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      {/* Badge */}
      {badge && (
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-aura-burgundy mb-5 before:h-px before:w-6 before:bg-aura-amber">
          {badge}
        </span>
      )}

      {/* Title — word-by-word reveal */}
      <h2
        className={cn(
          "font-display text-[clamp(2.35rem,5vw,4.9rem)] font-medium tracking-[-.045em] text-aura-text leading-[.98] text-balance",
          gradient && "gradient-text"
        )}
      >
        <WordByWordReveal text={title} />
      </h2>

      {/* Subtitle */}
      {subtitle && (
        <p className="mt-6 text-base md:text-lg text-aura-text-secondary leading-relaxed max-w-2xl mx-auto text-pretty">
          {subtitle}
        </p>
      )}
    </div>
  );
}
