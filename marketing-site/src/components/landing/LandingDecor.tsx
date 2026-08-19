import { cn } from "@/lib/utils";

type LandingDecorProps = {
  variant?: "hero" | "soft" | "warm" | "quiet" | "cta";
  className?: string;
};

const variantClasses = {
  hero: "opacity-90",
  soft: "opacity-75",
  warm: "opacity-70",
  quiet: "opacity-55",
  cta: "opacity-80",
};

export function LandingDecor({ variant = "soft", className }: LandingDecorProps) {
  const isWarm = variant === "warm" || variant === "hero" || variant === "cta";

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", variantClasses[variant], className)}
    >
      <div className="absolute inset-x-0 -top-px h-12 bg-white/20 [clip-path:polygon(0_0,100%_0,100%_42%,72%_68%,44%_44%,18%_72%,0_48%)] sm:h-16" />
      <div className="absolute inset-x-0 -bottom-px h-14 bg-white/18 [clip-path:polygon(0_58%,22%_34%,48%_62%,74%_30%,100%_55%,100%_100%,0_100%)] sm:h-20" />

      <div
        className={cn(
          "absolute -left-24 top-12 hidden h-72 w-72 rounded-full blur-3xl sm:block",
          isWarm ? "bg-white/35" : "bg-[#F7D9FF]/28"
        )}
      />
      <div className="absolute -right-28 top-1/4 hidden h-80 w-80 rounded-full bg-[var(--aura-purple)]/8 blur-3xl md:block" />

      <div className="absolute left-[4%] top-[18%] hidden h-36 w-20 rounded-t-full border border-white/45 border-b-0 sm:block" />
      <div className="absolute right-[7%] bottom-[16%] hidden h-28 w-16 rounded-t-full border border-[var(--aura-purple)]/12 border-b-0 md:block" />
      <div className="absolute left-[9%] bottom-[18%] hidden h-3 w-28 -rotate-12 rounded-full bg-white/35 ring-1 ring-white/45 md:block" />
      <div className="absolute right-[14%] top-[18%] hidden h-2.5 w-24 rotate-12 rounded-full bg-[#F5B8E8]/22 ring-1 ring-white/35 lg:block" />

      <div className="absolute left-[12%] top-[42%] hidden h-20 w-20 rounded-full border border-[var(--aura-purple)]/10 md:block" />
      <div className="absolute right-[18%] top-[46%] hidden h-24 w-24 rounded-full border border-white/35 lg:block" />
      <div className="absolute right-[5%] top-[8%] h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(111,79,216,0.14)_1px,transparent_1.5px)] [background-size:12px_12px] opacity-35 max-sm:hidden" />
      <div className="absolute left-[3%] bottom-[8%] h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.75)_1px,transparent_1.5px)] [background-size:11px_11px] opacity-45 max-sm:hidden" />
    </div>
  );
}
