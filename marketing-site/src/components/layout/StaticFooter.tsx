import Link from "next/link";

export function StaticFooter() {
  return (
    <footer className="static-footer-fallback aura-footer bg-[linear-gradient(180deg,#1A0E38_0%,#120727_100%)] px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[82rem] flex-col gap-5 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="group inline-flex items-center gap-2.5 rounded-xl">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-sm font-semibold text-[#2D176F] transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none" aria-hidden="true">A</span>
          <span className="text-lg font-semibold tracking-tight">Aura</span>
        </Link>
        <p className="max-w-xl text-sm leading-6 text-white/64">
          All-in-one salon CRM, POS, booking, staff, inventory and growth operating system.
        </p>
        <div className="flex flex-wrap gap-4 text-sm font-semibold text-white/72">
          <Link href="/pricing" className="transition-colors hover:text-white">Pricing</Link>
          <Link href="/demo" className="transition-colors hover:text-white">Demo</Link>
          <Link href="/contact" className="transition-colors hover:text-white">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
