export function TrustSignals({ label = "Reviewed by Aura Editorial Team" }: { label?: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--aura-muted)]">
      <span className="rounded-full border border-[var(--aura-border)] bg-white px-3 py-1">{label}</span>
      <span className="rounded-full border border-[var(--aura-border)] bg-white px-3 py-1">Last updated 2026</span>
      <span className="rounded-full border border-[var(--aura-border)] bg-white px-3 py-1">Built for Indian salon workflows</span>
    </div>
  );
}
