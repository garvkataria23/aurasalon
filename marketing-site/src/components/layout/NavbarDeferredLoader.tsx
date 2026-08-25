"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LanguageProvider } from "@/components/providers/LanguageProvider";

const Navbar = dynamic(() => import("@/components/layout/Navbar").then((mod) => mod.Navbar), { ssr: false });

export function NavbarDeferredLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => setReady(true);
    window.addEventListener("pointerdown", load, { once: true, passive: true });
    window.addEventListener("keydown", load, { once: true });

    return () => {
      window.removeEventListener("pointerdown", load);
      window.removeEventListener("keydown", load);
    };
  }, []);

  return ready ? (
    <>
      <style>{`.static-nav-fallback{display:none}`}</style>
      <LanguageProvider>
        <Navbar />
      </LanguageProvider>
    </>
  ) : null;
}
