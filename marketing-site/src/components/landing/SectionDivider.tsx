import { cn } from "@/lib/utils";

/**
 * SectionDivider — organic decorative transition between landing page sections.
 *
 * Design: Soft rising arches + floating circles in pastel purple,
 * creating a subtle cityscape-like silhouette transition.
 *
 * Variants control the top/bottom color pairing so the divider
 * blends naturally between adjacent section gradients.
 */
type SectionDividerProps = {
  /** "dark-to-light" = darker section above, lighter below (default)
   *  "light-to-dark" = lighter section above, darker below */
  variant?: "dark-to-light" | "light-to-dark";
  /** Mirror the shapes horizontally for visual variety */
  flip?: boolean;
  className?: string;
};

export function SectionDivider({
  variant = "dark-to-light",
  flip = false,
  className,
}: SectionDividerProps) {
  /* Color pairs matching the site's two alternating gradients */
  const isDtL = variant === "dark-to-light";
  const topColor = isDtL ? "#E5D8FF" : "#F6F1FF";
  const bottomColor = isDtL ? "#F6F1FF" : "#E5D8FF";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative w-full select-none overflow-hidden",
        className
      )}
      style={{ height: "clamp(80px, 10vw, 140px)" }}
    >
      {/* Background fill = bottom section color */}
      <div className="absolute inset-0" style={{ backgroundColor: bottomColor }} />

      {/* ── SVG Silhouette: organic arches + circles ── */}
      <svg
        viewBox="0 0 1440 140"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        style={{ transform: flip ? "scaleX(-1)" : undefined }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Subtle vertical gradient for the silhouette fill */}
          <linearGradient id="dividerGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={topColor} stopOpacity="1" />
            <stop offset="100%" stopColor={topColor} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* ── Main silhouette: flowing arches that rise from a baseline ── */}
        <path
          d={`
            M0,0 L0,90
            Q60,88 80,75
            Q100,62 110,68
            Q130,80 150,85
            L150,50
            Q160,20 180,20
            Q200,20 210,50
            L210,88
            Q240,92 280,85
            Q300,78 310,80
            L310,60
            Q320,35 340,35
            Q360,35 370,60
            L370,82
            Q400,90 440,88
            Q460,86 480,82
            L480,40
            Q490,10 510,10
            Q530,10 540,40
            L540,85
            Q580,92 620,90
            Q640,88 660,84
            L660,55
            Q670,28 690,28
            Q710,28 720,55
            L720,88
            Q760,95 800,92
            Q840,88 860,84
            L860,45
            Q870,18 890,18
            Q910,18 920,45
            L920,86
            Q960,92 1000,90
            Q1020,88 1040,82
            L1040,60
            Q1050,32 1070,32
            Q1090,32 1100,60
            L1100,88
            Q1140,94 1180,90
            Q1200,87 1220,82
            L1220,48
            Q1230,22 1250,22
            Q1270,22 1280,48
            L1280,86
            Q1320,92 1360,90
            Q1400,87 1440,84
            L1440,0 Z
          `}
          fill="url(#dividerGrad)"
        />

        {/* ── Floating circles (organic touch) ── */}
        <circle cx="120" cy="72" r="12" fill={topColor} opacity="0.7" />
        <circle cx="500" cy="18" r="8" fill={topColor} opacity="0.5" />
        <circle cx="750" cy="65" r="14" fill={topColor} opacity="0.55" />
        <circle cx="1050" cy="40" r="10" fill={topColor} opacity="0.6" />
        <circle cx="1350" cy="70" r="11" fill={topColor} opacity="0.5" />

        {/* Smaller accent circles */}
        <circle cx="300" cy="55" r="6" fill={topColor} opacity="0.4" />
        <circle cx="630" cy="78" r="7" fill={topColor} opacity="0.35" />
        <circle cx="950" cy="30" r="5" fill={topColor} opacity="0.45" />
        <circle cx="1200" cy="60" r="8" fill={topColor} opacity="0.3" />
      </svg>
    </div>
  );
}
