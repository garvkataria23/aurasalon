"use client";

import { cn } from "@/lib/utils";

interface TextRevealProps {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

export function TextReveal({ text, className, as: Tag = "h1" }: TextRevealProps) {
  return <Tag className={className}>{text}</Tag>;
}
