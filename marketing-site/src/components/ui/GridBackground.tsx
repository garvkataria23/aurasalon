"use client";

import { cn } from "@/lib/utils";

interface GridBackgroundProps {
  className?: string;
  variant?: "grid" | "dots";
}

export function GridBackground({ className, variant = "dots" }: GridBackgroundProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none",
        variant === "grid" && "grid-bg",
        variant === "dots" && "dot-bg",
        className
      )}
      aria-hidden="true"
    />
  );
}
