"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const Footer = dynamic(() => import("@/components/layout/Footer").then((mod) => mod.Footer), { ssr: false });

export function FooterDeferredLoader() {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;

    const load = () => setReady(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load();
      },
      { rootMargin: "600px 0px" }
    );

    const trigger = triggerRef.current;
    if (trigger) observer.observe(trigger);
    window.addEventListener("scroll", load, { once: true, passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", load);
    };
  }, [ready]);

  return (
    <div ref={triggerRef}>
      {ready ? (
        <>
          <style>{`.static-footer-fallback{display:none}`}</style>
          <Footer />
        </>
      ) : null}
    </div>
  );
}
