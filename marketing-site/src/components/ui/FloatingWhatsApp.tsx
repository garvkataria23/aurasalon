"use client";

import { MessageCircle } from "lucide-react";

export function FloatingWhatsApp() {
  const whatsappUrl = "https://wa.me/919876543210?text=Hi%20Aura%20Team!%20I%20would%20like%20to%20book%20a%20free%20demo%20for%20my%20salon.";

  return (
    <aside aria-label="WhatsApp live chat" className="fixed bottom-6 right-6 z-[9990] flex items-center gap-3">
      {/* Floating Action Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_25px_rgba(37,211,102,0.4)] transition-all duration-300 hover:scale-110 hover:shadow-[0_14px_35px_rgba(37,211,102,0.5)]"
        aria-label="Chat on WhatsApp with Aura support"
      >
        {/* Pulsing ring */}
        <span className="absolute inset-0 rounded-full bg-[#25D366]/40 animate-ping pointer-events-none" />
        
        <MessageCircle className="h-7 w-7 fill-white text-transparent relative z-10" />

        {/* Live Online Badge */}
        <span className="absolute top-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-300 border-2 border-white shadow-xs" />
      </a>
    </aside>
  );
}
