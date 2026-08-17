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
        <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4">
          {badge}
        </span>
      )}

      {/* Title */}
      <h2
        className={cn(
          "text-[clamp(2rem,4.5vw,3.25rem)] font-bold tracking-[-0.025em] text-[var(--aura-heading)] leading-[1.12] text-balance",
          gradient && "gradient-text"
        )}
      >
        {title}
      </h2>

      {/* Subtitle */}
      {subtitle && (
        <p className="mt-5 text-base md:text-lg text-[var(--aura-body)] leading-relaxed max-w-2xl mx-auto text-pretty">
          {subtitle}
        </p>
      )}
    </div>
  );
}
