"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export function CustomCursor() {
  const [isMobile, setIsMobile] = useState(true);
  const dotRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobile(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const onMove = useCallback((e: MouseEvent) => {
    if (dotRef.current) {
      dotRef.current.style.transform = `translate(${e.clientX - 6}px, ${e.clientY - 6}px)`;
    }
    if (glowRef.current) {
      glowRef.current.style.transform = `translate(${e.clientX - 24}px, ${e.clientY - 24}px)`;
    }
  }, []);

  useEffect(() => {
    if (isMobile) return;
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [isMobile, onMove]);

  if (isMobile) return null;

  return (
    <>
      <div ref={dotRef} className="fixed top-0 left-0 z-[9999] pointer-events-none w-3 h-3 rounded-full bg-aura-primary opacity-60" style={{ willChange: "transform" }} />
      <div ref={glowRef} className="fixed top-0 left-0 z-[9998] pointer-events-none w-12 h-12 rounded-full bg-aura-primary opacity-[0.06]" style={{ willChange: "transform" }} />
    </>
  );
}
