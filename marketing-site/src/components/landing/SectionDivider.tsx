import { cn } from "@/lib/utils";

/**
 * SectionDivider — Organic wave & soft luminous transition between sections.
 *
 * Keeps all original colors and tokens exactly intact.
 * Replaces repetitive vertical bars with flowing, multi-layered organic waves
 * and subtle ambient aura glows tailored for a premium salon SaaS feel.
 */
type SectionDividerProps = {
  /** "dark-to-light" = darker section above, lighter below (default)
   *  "light-to-dark" = lighter section above, darker below */
  variant?: "dark-to-light" | "light-to-dark";
  /** Mirror horizontally for variety */
  flip?: boolean;
  className?: string;
};

export function SectionDivider({
  variant = "dark-to-light",
  flip = false,
  className,
}: SectionDividerProps) {
  const isDtL = variant === "dark-to-light";
  const topColor = isDtL ? "#E5D8FF" : "#F6F1FF";
  const bottomColor = isDtL ? "#F6F1FF" : "#E5D8FF";
  const accentColor = isDtL ? "#D7C3FF" : "#EFE7FF";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative w-full select-none overflow-hidden",
        className
      )}
      style={{ height: "clamp(64px, 8vw, 110px)" }}
    >
      {/* Base fill matching incoming bottom section */}
      <div className="absolute inset-0" style={{ backgroundColor: bottomColor }} />

      {/* Ambient soft glow center */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-24 rounded-full blur-2xl opacity-40"
        style={{ backgroundColor: topColor }}
      />

      {/* Layered fluid SVG waves */}
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        style={{ transform: flip ? "scaleX(-1)" : undefined }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`waveGrad1-${variant}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={topColor} stopOpacity="1" />
            <stop offset="100%" stopColor={topColor} stopOpacity="0.4" />
          </linearGradient>

          <linearGradient id={`waveGrad2-${variant}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.3" />
            <stop offset="50%" stopColor={topColor} stopOpacity="0.6" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Back softer wave */}
        <path
          d="M0,0 L0,45 C320,105 520,10 860,65 C1140,110 1340,30 1440,50 L1440,0 Z"
          fill={`url(#waveGrad2-${variant})`}
        />

        {/* Mid flowing wave */}
        <path
          d="M0,0 L0,70 C240,25 480,95 760,40 C1040,-15 1260,85 1440,35 L1440,0 Z"
          fill={topColor}
          opacity="0.55"
        />

        {/* Front primary smooth transition wave */}
        <path
          d="M0,0 L0,30 C300,85 580,20 900,75 C1180,120 1360,45 1440,55 L1440,0 Z"
          fill={`url(#waveGrad1-${variant})`}
        />

        {/* Delicate floating pearl dots (minimal & refined) */}
        <circle cx="280" cy="52" r="3.5" fill="#FFFFFF" opacity="0.75" />
        <circle cx="720" cy="38" r="4.5" fill="#FFFFFF" opacity="0.65" />
        <circle cx="1180" cy="62" r="3" fill="#FFFFFF" opacity="0.7" />
        <circle cx="460" cy="74" r="2.5" fill="var(--aura-purple, #6F4FD8)" opacity="0.25" />
        <circle cx="980" cy="48" r="3" fill="var(--aura-purple, #6F4FD8)" opacity="0.2" />
      </svg>
    </div>
  );
}
