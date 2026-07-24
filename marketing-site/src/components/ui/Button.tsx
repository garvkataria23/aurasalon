"use client";

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-aura-burgundy text-white shadow-md hover:bg-aura-burgundy-strong hover:shadow-lg active:scale-[0.98]",
  secondary:
    "bg-aura-text text-white hover:bg-aura-text/90 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
  ghost:
    "text-aura-text-secondary hover:text-aura-text hover:bg-black/[0.04]",
  outline:
    "border border-aura-border text-aura-text hover:bg-aura-bg-warm hover:border-aura-border-strong",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 py-2 text-sm rounded-full gap-1.5",
  md: "min-h-11 px-5 py-2.5 text-sm rounded-full gap-2",
  lg: "min-h-12 px-7 py-3.5 text-base rounded-full gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", asChild = false, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-semibold transition-all duration-300 cursor-pointer",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
