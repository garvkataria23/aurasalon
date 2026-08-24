const CHECKLISTS: Record<string, string[]> = {
  "staff-attendance-policy": ["Shift start definition", "Grace period", "Late mark rule", "Shift swap approval", "Overtime approval", "Monthly exception review"],
  "salon-gst-checklist": ["Sequential invoice number", "Correct GSTIN/SAC where applicable", "Payment mode recorded", "Refund/credit note record", "Daily reconciliation", "Monthly CA export"],
  "bridal-package-checklist": ["Consultation notes", "Trial date", "Deposit received", "Final look approval", "Travel timing", "Aftercare follow-up"],
  "inventory-audit-sheet": ["Batch number", "Expiry date", "Physical count", "System count", "Variance reason", "Reorder action"],
  "client-consultation-form": ["Allergy/sensitivity", "Service history", "Preferred stylist", "Reference photo", "Consent note", "Next visit recommendation"],
};

export function TemplateChecklist({ slug }: { slug: string }) {
  const items = CHECKLISTS[slug] ?? CHECKLISTS["staff-attendance-policy"];
  return (
    <div className="mt-8 rounded-3xl bg-white p-6 shadow-[var(--aura-shadow-sm)]">
      <h2 className="font-bold">Copyable checklist</h2>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <label key={item} className="flex items-center gap-3 rounded-2xl border border-[var(--aura-border)] p-4 text-sm text-[var(--aura-body)]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--aura-purple)]" />
            {item}
          </label>
        ))}
      </div>
    </div>
  );
}
