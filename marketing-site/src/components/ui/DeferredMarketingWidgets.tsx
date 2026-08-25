"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const ScrollProgress = dynamic(() => import("@/components/ui/ScrollProgress").then((mod) => mod.ScrollProgress), { ssr: false });
const CommandPalette = dynamic(() => import("@/components/ui/CommandPalette").then((mod) => mod.CommandPalette), { ssr: false });
const CookieConsent = dynamic(() => import("@/components/ui/CookieConsent").then((mod) => mod.CookieConsent), { ssr: false });
const FloatingConversionDock = dynamic(() => import("@/components/ui/FloatingConversionDock").then((mod) => mod.FloatingConversionDock), { ssr: false });
const FloatingWhatsApp = dynamic(() => import("@/components/ui/FloatingWhatsApp").then((mod) => mod.FloatingWhatsApp), { ssr: false });

export function DeferredMarketingWidgets() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => setReady(true);
    const timeoutId = window.setTimeout(load, 8000);
    window.addEventListener("scroll", load, { once: true, passive: true });
    window.addEventListener("pointerdown", load, { once: true, passive: true });
    window.addEventListener("keydown", load, { once: true });

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("scroll", load);
      window.removeEventListener("pointerdown", load);
      window.removeEventListener("keydown", load);
    };
  }, []);

  useEffect(() => {
    if (!ready || document.querySelector('script[data-domain="aurasalon.in"]')) return;
    const script = document.createElement("script");
    script.defer = true;
    script.dataset.domain = "aurasalon.in";
    script.src = "https://plausible.io/js/script.js";
    document.head.appendChild(script);
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <FloatingConversionDock />
      <FloatingWhatsApp />
      <ScrollProgress />
      <CommandPalette />
      <CookieConsent />
    </>
  );
}
