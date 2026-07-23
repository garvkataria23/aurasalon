"use client";

import { cn } from "@/lib/utils";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}

export function GradientText({ children, className, animate = false }: GradientTextProps) {
  return (
    <span
      className={cn(
        animate ? "gradient-text-animated" : "gradient-text",
        className
      )}
    >
      {children}
    </span>
  );
}
