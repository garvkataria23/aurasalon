import Link from "next/link";
import { CTA_LINKS } from "@/lib/constants";

export function StaticNavbar() {
  return (
    <header className="static-nav-fallback fixed inset-x-0 top-0 z-[9996] border-b border-white/10 bg-[linear-gradient(90deg,#25105D,#351B80_48%,#2D176F)] shadow-[0_16px_44px_rgba(45,23,111,0.18)]">
      <nav className="mx-auto flex h-16 max-w-[82rem] items-center justify-between px-4 sm:px-6 lg:px-10" aria-label="Primary navigation">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5 rounded-xl">
          <span
            className="grid h-8 w-8 place-items-center rounded-xl bg-white text-sm font-semibold text-[#2D176F] shadow-[0_10px_26px_rgba(0,0,0,0.14)] transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none"
            aria-hidden="true"
          >
            A
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">Aura</span>
        </Link>

        <div className="hidden items-center gap-4 lg:flex">
          <Link href="/solutions" className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-white/74 transition-colors hover:bg-white/10 hover:text-white">Solutions</Link>
          <Link href="/features" className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-white/74 transition-colors hover:bg-white/10 hover:text-white">Features</Link>
          <Link href="/pricing" className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-white/74 transition-colors hover:bg-white/10 hover:text-white">Pricing</Link>
          <Link href={CTA_LINKS.demo} className="inline-flex min-h-11 items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2D176F] shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(0,0,0,0.24)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
            Book demo
          </Link>
        </div>

        <Link
          href={CTA_LINKS.demo}
          className="inline-flex min-h-11 items-center rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-[#2D176F] shadow-sm transition-colors hover:bg-[#F5F0FF] lg:hidden"
        >
          Demo
        </Link>
      </nav>
      <div className="nav-zigzag-edge" aria-hidden="true" />
    </header>
  );
}
