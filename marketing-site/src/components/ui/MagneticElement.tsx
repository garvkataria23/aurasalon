"use client";

import Link from "next/link";

interface MagneticElementProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "span" | "a";
  href?: string;
}

export function MagneticElement({ children, className = "", as = "div", href }: MagneticElementProps) {
  if (as === "a" && href) {
    return (
      <Link href={href} className={`transition-transform hover:scale-105 active:scale-95 ${className}`}>
        {children}
      </Link>
    );
  }
  const Tag = as === "span" ? "span" : "div";
  return (
    <Tag className={`transition-transform hover:scale-105 active:scale-95 ${className}`}>
      {children}
    </Tag>
  );
}
