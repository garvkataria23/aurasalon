"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const DeferredSections = dynamic(
  () => import("@/components/landing/HomePageDeferredSections").then((mod) => mod.HomePageDeferredSections),
  { ssr: false }
);

export function HomePageDeferredSectionsLoader() {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;

    const load = () => setReady(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load();
      },
      { rootMargin: "200px 0px" }
    );

    const trigger = triggerRef.current;
    if (trigger) observer.observe(trigger);
    window.addEventListener("scroll", load, { once: true, passive: true });
    window.addEventListener("wheel", load, { once: true, passive: true });
    window.addEventListener("touchstart", load, { once: true, passive: true });
    window.addEventListener("keydown", load, { once: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", load);
      window.removeEventListener("wheel", load);
      window.removeEventListener("touchstart", load);
      window.removeEventListener("keydown", load);
    };
  }, [ready]);

  return (
    <div ref={triggerRef}>
      {ready ? <DeferredSections /> : <div className="min-h-[28vh] bg-[linear-gradient(180deg,#F4EDFF_0%,#FFFFFF_100%)]" aria-hidden="true" />}
    </div>
  );
}
