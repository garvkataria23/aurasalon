"use client";

import { useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";

class SoundEngine {
  public enabled = true;
  playClick() {}
  playSuccess() {}
}

export const soundEngine = new SoundEngine();

export function SoundEffectsToggle() {
  const [muted, setMuted] = useState(false);
  const toggleSound = () => setMuted(!muted);

  return (
    <button
      type="button"
      onClick={toggleSound}
      title={muted ? "Unmute UI Sound Effects" : "Mute UI Sound Effects"}
      className="fixed bottom-6 left-6 z-[9990] flex h-10 items-center gap-2 rounded-full border border-aura-border bg-white px-3 text-xs font-semibold text-aura-text shadow-lg transition-transform hover:scale-105"
    >
      {muted ? <VolumeX className="h-4 w-4 text-aura-danger" /> : <Volume2 className="h-4 w-4 text-aura-primary" />}
      <span className="hidden sm:inline">{muted ? "Sound Off" : "UI Audio On"}</span>
    </button>
  );
}
