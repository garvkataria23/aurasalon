"use client";

import { useState } from "react";

const CONFIG: Record<string, { labels: string[]; result: (values: number[]) => string; suffix: string }> = {
  "salon-revenue": {
    labels: ["Average ticket (₹)", "Bills per day", "Working days/month"],
    result: ([ticket, bills, days]) => `₹${Math.round(ticket * bills * days).toLocaleString("en-IN")}/month`,
    suffix: "estimated monthly revenue",
  },
  "no-show-loss": {
    labels: ["Average ticket (₹)", "No-shows per week", "Weeks/month"],
    result: ([ticket, noShows, weeks]) => `₹${Math.round(ticket * noShows * weeks).toLocaleString("en-IN")}/month`,
    suffix: "estimated monthly loss",
  },
  "staff-commission": {
    labels: ["Service revenue (₹)", "Commission rate (%)", "Bonus (₹)"],
    result: ([revenue, rate, bonus]) => `₹${Math.round((revenue * rate) / 100 + bonus).toLocaleString("en-IN")}`,
    suffix: "estimated payout",
  },
  "inventory-reorder": {
    labels: ["Daily usage", "Supplier lead time (days)", "Safety stock"],
    result: ([usage, lead, safety]) => `${Math.ceil(usage * lead + safety).toLocaleString("en-IN")} units`,
    suffix: "suggested reorder point",
  },
};

export function CalculatorClient({ slug }: { slug: string }) {
  const config = CONFIG[slug] ?? CONFIG["salon-revenue"];
  const [values, setValues] = useState([1000, 10, slug === "no-show-loss" ? 4 : 26]);
  return (
    <div className="mt-8 rounded-3xl bg-white p-6 shadow-[var(--aura-shadow-sm)]">
      <div className="grid gap-4 sm:grid-cols-3">
        {config.labels.map((label, index) => (
          <label key={label} className="text-sm font-semibold text-[var(--aura-heading)]">
            {label}
            <input
              type="number"
              min="0"
              value={values[index] ?? 0}
              onChange={(event) => {
                const next = [...values];
                next[index] = Number(event.target.value);
                setValues(next);
              }}
              className="mt-2 w-full rounded-2xl border border-[var(--aura-border)] px-4 py-3 text-sm outline-none focus:border-[var(--aura-purple)] focus:ring-4 focus:ring-[rgba(111,79,216,0.12)]"
            />
          </label>
        ))}
      </div>
      <div className="mt-6 rounded-2xl bg-[var(--aura-lavender)] p-5">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)]">Result</p>
        <p className="mt-2 text-3xl font-bold text-[var(--aura-heading)]">{config.result(values)}</p>
        <p className="mt-1 text-sm text-[var(--aura-body)]">{config.suffix}</p>
      </div>
    </div>
  );
}
