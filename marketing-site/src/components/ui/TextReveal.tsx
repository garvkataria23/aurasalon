"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";

interface TextRevealProps {
  text: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}

export function TextReveal({
  text,
  className,
  delay = 0,
  staggerDelay = 0.06,
  as: Tag = "h1",
}: TextRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const words = text.split(" ");

  return (
    <Tag className={cn("overflow-hidden", className)}>
      <span ref={ref} className="flex flex-wrap">
        {words.map((word, i) => (
          <span key={i} className="overflow-hidden mr-[0.3em] inline-block">
            <motion.span
              className="inline-block"
              initial={{ y: "110%", rotateX: -80 }}
              animate={inView ? { y: 0, rotateX: 0 } : {}}
              transition={{
                duration: 0.7,
                delay: delay + i * staggerDelay,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {word}
            </motion.span>
          </span>
        ))}
      </span>
    </Tag>
  );
}
