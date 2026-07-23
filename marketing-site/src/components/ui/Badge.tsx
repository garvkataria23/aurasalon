"use client";

import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "gradient" | "outline";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full",
        variant === "default" && "bg-neon-violet/10 text-neon-violet",
        variant === "gradient" && "bg-gradient-to-r from-neon-violet to-aura-rose text-white",
        variant === "outline" && "border border-aura-border text-aura-text-secondary",
        className
      )}
    >
      {children}
    </span>
  );
}
