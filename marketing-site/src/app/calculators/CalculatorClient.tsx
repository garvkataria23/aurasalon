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
  "salon-profit-margin": {
    labels: ["Service price (₹)", "Product cost (₹)", "Staff commission (₹)"],
    result: ([price, cost, staff]) => {
      const margin = price - cost - staff;
      const pct = price > 0 ? Math.round((margin / price) * 100) : 0;
      return `₹${Math.round(margin).toLocaleString("en-IN")} (${pct}%)`;
    },
    suffix: "net service gross margin",
  },
  "chair-utilisation": {
    labels: ["Booked hours/week", "Total available hours/week", "Total chairs"],
    result: ([booked, avail, chairs]) => {
      const totalAvail = (avail || 1) * (chairs || 1);
      const pct = Math.min(100, Math.round((booked / totalAvail) * 100));
      return `${pct}%`;
    },
    suffix: "chair utilization rate",
  },
  "average-ticket": {
    labels: ["Total monthly revenue (₹)", "Total client bills", "Retail sales share (%)"],
    result: ([rev, bills]) => `₹${bills > 0 ? Math.round(rev / bills).toLocaleString("en-IN") : 0}`,
    suffix: "average ticket size per client",
  },
  "package-liability": {
    labels: ["Unredeemed sessions", "Average session value (₹)", "Expiring soon (%)"],
    result: ([sessions, val]) => `₹${Math.round(sessions * val).toLocaleString("en-IN")}`,
    suffix: "total outstanding prepaid liability",
  },
  "retail-attachment": {
    labels: ["Bills with retail products", "Total service invoices", "Average retail spend (₹)"],
    result: ([retail, total]) => `${total > 0 ? Math.round((retail / total) * 100) : 0}%`,
    suffix: "retail attachment rate",
  },
  "customer-retention": {
    labels: ["Returning repeat clients", "Total unique clients", "Target repeat rate (%)"],
    result: ([repeat, total]) => `${total > 0 ? Math.round((repeat / total) * 100) : 0}%`,
    suffix: "30-day client retention rate",
  },
  "salon-break-even": {
    labels: ["Total monthly fixed costs (₹)", "Average service price (₹)", "Direct cost per service (₹)"],
    result: ([fixed, price, cost]) => {
      const margin = price - cost;
      return `${margin > 0 ? Math.ceil(fixed / margin) : 0} visits/month`;
    },
    suffix: "break-even client visits needed",
  },
  "marketing-roi": {
    labels: ["Campaign generated revenue (₹)", "Ad/campaign cost (₹)", "Repeat visits expected"],
    result: ([rev, cost]) => `${cost > 0 ? Math.round(((rev - cost) / cost) * 100) : 0}%`,
    suffix: "return on marketing spend (ROI)",
  },
  "hair-color-waste": {
    labels: ["Bowls mixed/day", "Leftover waste per bowl (grams)", "Color cost per gram (₹)"],
    result: ([bowls, grams, cost]) => `₹${Math.round(bowls * grams * cost * 30).toLocaleString("en-IN")}/month`,
    suffix: "estimated profit lost down the drain",
  },
  "client-lifetime-value": {
    labels: ["Average spend/visit (₹)", "Visits per year", "Average client lifespan (years)"],
    result: ([spend, visits, years]) => `₹${Math.round(spend * visits * years).toLocaleString("en-IN")}`,
    suffix: "lifetime client revenue value (CLV)",
  },
  "booth-rent-roi": {
    labels: ["Weekly booth rent (₹)", "Weekly client revenue (₹)", "Product expenses (₹)"],
    result: ([rent, rev, prod]) => `₹${Math.round(rev - rent - prod).toLocaleString("en-IN")}/week`,
    suffix: "net weekly stylist take-home earnings",
  },
  "staff-utilization": {
    labels: ["Service hours delivered/week", "Total shift hours/week", "Working stylists"],
    result: ([svc, shift]) => `${shift > 0 ? Math.round((svc / shift) * 100) : 0}%`,
    suffix: "productive floor utilization",
  },
  "discount-impact": {
    labels: ["Service list price (₹)", "Discount percentage (%)", "Direct cost (supply + stylist ₹)"],
    result: ([price, disc, cost]) => {
      const discountedPrice = price * (1 - disc / 100);
      const profit = Math.max(0, discountedPrice - cost);
      return `₹${Math.round(profit).toLocaleString("en-IN")} per visit`;
    },
    suffix: "net profit after discount erosion",
  },
  "retail-profit-margin": {
    labels: ["Retail selling price (₹)", "Wholesale purchase cost (₹)", "Units sold per month"],
    result: ([sell, cost, units]) => `₹${Math.round((sell - cost) * units).toLocaleString("en-IN")}/month`,
    suffix: "monthly retail product profit",
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
