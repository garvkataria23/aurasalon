"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LandingDecor } from "./LandingDecor";
import {
  Boxes,
  AlertTriangle,
  ShoppingCart,
  TrendingDown,
  Truck,
  History,
  Crown,
  Sparkles,
  Wallet,
  Coins,
  Gift,
  CreditCard,
  Clock,
  Send,
  MessageSquare,
  Cake,
  UserCheck,
  Star,
  Tag,
  Users,
  BarChart2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

/* ── Scroll Reveal Hook ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

/* ── Feature Pill ── */
function FeaturePill({
  icon: Icon,
  label,
  comingSoon = false,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  comingSoon?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors ${active ? "bg-[var(--aura-purple)] text-white" : "bg-white/70 text-[var(--aura-purple)] ring-1 ring-[var(--aura-purple)]/10"}`}>
          {active ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        </span>
        <span className={`truncate text-xs font-medium ${active ? "text-[var(--aura-purple)]" : "text-[var(--aura-heading)]"}`}>{label}</span>
      </div>
      {comingSoon && (
        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 uppercase tracking-wider shrink-0">
          Coming Soon
        </span>
      )}
    </>
  );

  return (
    <li className={`flex items-center justify-between gap-2 rounded-full border px-3 py-2 shadow-[var(--aura-shadow-xs)] backdrop-blur-md transition-all duration-300 ${active ? "border-[var(--aura-purple)]/20 bg-white/75 shadow-[0_10px_30px_rgba(109,63,209,0.08)] ring-1 ring-white/50" : "border-white/55 bg-white/35 hover:border-[var(--aura-purple)]/18 hover:bg-white/60"}`}>
      {onClick ? (
        <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-2 text-left">
          {content}
        </button>
      ) : content}
    </li>
  );
}

/* ── Inventory UI Showcase ── */
function InventoryMockup({ activeFeature = "Live stock tracking" }: { activeFeature?: string }) {
  const [stockItems, setStockItems] = useState([
    {
      name: "L'Oréal Serie Expert Shampoo 500ml",
      sku: "LOR-SH-500",
      category: "Retail",
      inStock: 18,
      minStock: 5,
      status: "In Stock",
      cost: "₹1,450",
      unit: "bottle",
    },
    {
      name: "Olaplex No. 1 Bond Multiplier 525ml",
      sku: "OLA-B1-525",
      category: "In-Salon",
      inStock: 2,
      minStock: 4,
      status: "Low Stock",
      cost: "₹6,200",
      unit: "bottle",
    },
    {
      name: "Wella Koleston Perfect 60g #5/0",
      sku: "WEL-KP-50",
      category: "In-Salon",
      inStock: 24,
      minStock: 10,
      status: "In Stock",
      cost: "₹580",
      unit: "tube",
    },
    {
      name: "Moroccanoil Treatment Original 100ml",
      sku: "MOR-TR-100",
      category: "Retail",
      inStock: 0,
      minStock: 6,
      status: "Out of Stock",
      cost: "₹3,150",
      unit: "bottle",
    },
  ]);
  const [selectedSku, setSelectedSku] = useState("OLA-B1-525");
  const emptyDraft = {
    name: "",
    sku: "",
    category: "Retail",
    inStock: "",
    minStock: "",
    cost: "",
    unit: "unit",
  };
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [customRows, setCustomRows] = useState<Record<string, string[][]>>({});
  const [selectedPanelRow, setSelectedPanelRow] = useState(0);
  const [recordDraft, setRecordDraft] = useState({ label: "", value: "", detail: "" });
  const selectedItem = stockItems.find((item) => item.sku === selectedSku) ?? stockItems[0];
  const lowStockCount = stockItems.filter((item) => item.inStock <= item.minStock).length;
  const isStockLedger = activeFeature === "Live stock tracking";
  const getStatus = (inStock: number, minStock: number) => {
    if (inStock <= 0) return "Out of Stock";
    if (inStock <= minStock) return "Low Stock";
    return "In Stock";
  };

  const startCreate = () => {
    if (!isStockLedger) {
      setRecordDraft({ label: `New ${activeFeature}`, value: "Draft", detail: `Created under ${activeFeature}` });
      setFormMode("create");
      return;
    }

    const nextSku = `NEW-${stockItems.length + 101}`;
    setDraft({ ...emptyDraft, name: "New Retail Serum 100ml", sku: nextSku, inStock: "8", minStock: "4", cost: "₹1,250", unit: "bottle" });
    setFormMode("create");
  };

  const startEdit = () => {
    if (!isStockLedger) {
      const row = panelRows[selectedPanelRow] ?? panelRows[0];
      if (!row) return;
      setRecordDraft({ label: row[0], value: row[1], detail: row[2] });
      setFormMode("edit");
      return;
    }

    if (!selectedItem) return;
    setDraft({
      name: selectedItem.name,
      sku: selectedItem.sku,
      category: selectedItem.category,
      inStock: String(selectedItem.inStock),
      minStock: String(selectedItem.minStock),
      cost: selectedItem.cost,
      unit: selectedItem.unit,
    });
    setFormMode("edit");
  };

  const saveDraft = () => {
    if (!isStockLedger) {
      const row = [
        recordDraft.label.trim() || `New ${activeFeature}`,
        recordDraft.value.trim() || "Draft",
        recordDraft.detail.trim() || `Updated under ${activeFeature}`,
      ];

      setCustomRows((rowsByFeature) => {
        const rows = rowsByFeature[activeFeature] ?? panelRows;
        const nextRows = formMode === "edit"
          ? rows.map((existing, index) => (index === selectedPanelRow ? row : existing))
          : [...rows, row];
        setSelectedPanelRow(formMode === "edit" ? selectedPanelRow : nextRows.length - 1);
        return { ...rowsByFeature, [activeFeature]: nextRows };
      });
      setFormMode(null);
      return;
    }

    const inStock = Number(draft.inStock) || 0;
    const minStock = Number(draft.minStock) || 0;
    const sku = draft.sku.trim() || `SKU-${stockItems.length + 101}`;
    const item = {
      name: draft.name.trim() || "Unnamed Inventory Item",
      sku,
      category: draft.category,
      inStock,
      minStock,
      status: getStatus(inStock, minStock),
      cost: draft.cost.trim() || "₹0",
      unit: draft.unit.trim() || "unit",
    };

    setStockItems((items) => (
      formMode === "edit"
        ? items.map((existing) => (existing.sku === selectedSku ? item : existing))
        : [...items, item]
    ));
    setSelectedSku(sku);
    setFormMode(null);
  };

  const deleteItem = () => {
    if (!isStockLedger) {
      setCustomRows((rowsByFeature) => {
        const rows = rowsByFeature[activeFeature] ?? panelRows;
        const nextRows = rows.filter((_, index) => index !== selectedPanelRow);
        setSelectedPanelRow(Math.max(0, selectedPanelRow - 1));
        return { ...rowsByFeature, [activeFeature]: nextRows };
      });
      setFormMode(null);
      return;
    }

    setStockItems((items) => {
      const remaining = items.filter((item) => item.sku !== selectedSku);
      setSelectedSku(remaining[0]?.sku ?? "");
      return remaining;
    });
    setFormMode(null);
  };

  const panels = {
    "Service consumption": {
      title: "Service Consumption",
      meta: "Auto deducted",
      summary: "Keratin service used 3 items",
      rows: [["Shampoo", "-20ml", "Deducted after checkout"], ["Bond multiplier", "-12ml", "Mapped to keratin recipe"], ["Treatment mask", "-35g", "Cost added to service margin"]],
      accent: "from-sky-500 to-blue-600",
      footer: "Consumption recipes convert every service into accurate stock movement.",
    },
    "Purchase orders (PO)": {
      title: "Purchase Order Desk",
      meta: "Draft ready",
      summary: "PO #1085 to Wella",
      rows: [["Low items", `${lowStockCount} SKUs`, "Added automatically"], ["Supplier", "Wella Professional", "Best last price"], ["Expected", "Tomorrow", "Based on lead time"]],
      accent: "from-violet-500 to-indigo-500",
      footer: "POs can be created before stock-outs block appointments.",
    },
    "Low-stock alerts": {
      title: "Low-Stock Alert Center",
      meta: `${lowStockCount} alerts`,
      summary: "Moroccanoil needs reorder",
      rows: [["Critical", "0 / 6 min", "Retail sale blocked"], ["Warning", "2 / 4 min", "Olaplex reorder suggested"], ["Safe", "2 days", "Before weekend rush"]],
      accent: "from-amber-500 to-orange-500",
      footer: "Alerts are prioritized by service impact and supplier lead time.",
    },
    "Retail product sales": {
      title: "Retail Sales Shelf",
      meta: "Attach rate",
      summary: "₹18,400 retail this week",
      rows: [["Top seller", "Shampoo 500ml", "12 units sold"], ["Recommended", "Hair serum", "After color service"], ["Margin", "48%", "Visible before discount"]],
      accent: "from-emerald-500 to-teal-500",
      footer: "Front desk can sell retail products from the same stock ledger.",
    },
    "Supplier records": {
      title: "Supplier Records",
      meta: "3 vendors",
      summary: "Best price matched",
      rows: [["Wella", "1 day lead", "Color inventory"], ["Olaplex", "3 day lead", "Bond treatments"], ["L'Oréal", "2 day lead", "Retail shampoo"]],
      accent: "from-cyan-500 to-sky-500",
      footer: "Supplier price, lead time and SKU mapping stay connected to PO creation.",
    },
    "Stock audit history": {
      title: "Stock Audit History",
      meta: "Traceable",
      summary: "Last audit variance: -₹820",
      rows: [["Aug 19", "Stock +3", "Manual correction"], ["Aug 18", "Service -12ml", "Keratin recipe"], ["Aug 17", "PO received", "Invoice matched"]],
      accent: "from-slate-700 to-slate-500",
      footer: "Every create, update, delete and stock movement is visible in the audit trail.",
    },
  };
  const panel = panels[activeFeature as keyof typeof panels];
  const panelRows = panel ? (customRows[activeFeature] ?? panel.rows) : [];

  return (
    <div className="min-h-[362px] overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/45 shadow-[0_22px_70px_rgba(82,58,138,0.10)] backdrop-blur-xl ring-1 ring-white/50">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/45 bg-white/25 px-5 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-[var(--aura-purple)]" />
            <span className="text-xs font-semibold text-[var(--aura-heading)]">Real-Time Stock Ledger</span>
          </div>
          <span className="text-[10px] text-[var(--aura-muted)]">Automatic consumption deducted upon checkout</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={startCreate} className="rounded-lg bg-[var(--aura-purple)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">{isStockLedger ? "Add Item" : "Create"}</button>
          <button type="button" onClick={startEdit} disabled={isStockLedger ? !selectedItem : panelRows.length === 0} className="rounded-lg border border-[var(--aura-border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--aura-heading)] disabled:opacity-40">{isStockLedger ? "Edit Stock" : "Edit"}</button>
          <button type="button" onClick={deleteItem} disabled={isStockLedger ? !selectedItem : panelRows.length === 0} className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 disabled:opacity-40">Delete</button>
        </div>
      </div>

      {formMode && (
        <div className="border-b border-white/45 bg-white/25 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-[var(--aura-heading)]">{isStockLedger ? (formMode === "create" ? "Create inventory item" : "Edit selected stock") : `${formMode === "create" ? "Create" : "Edit"} ${activeFeature}`}</p>
              <p className="text-[10px] text-[var(--aura-muted)]">{isStockLedger ? "Change name, stock, price, SKU, type and unit from the frontend preview." : "This create/edit form belongs to the selected feature card."}</p>
            </div>
            <button type="button" onClick={() => setFormMode(null)} className="rounded-lg border border-[var(--aura-border)] px-2 py-1 text-[10px] font-semibold text-[var(--aura-muted)]">Cancel</button>
          </div>
          {isStockLedger ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Product name" className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)]" />
              <input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} placeholder="SKU" className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)]" />
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)]">
                <option>Retail</option>
                <option>In-Salon</option>
              </select>
              <input value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} placeholder="Price / cost" className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)]" />
              <input type="number" value={draft.inStock} onChange={(e) => setDraft({ ...draft, inStock: e.target.value })} placeholder="Current stock" className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)]" />
              <input type="number" value={draft.minStock} onChange={(e) => setDraft({ ...draft, minStock: e.target.value })} placeholder="Minimum stock" className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)]" />
              <input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="Unit: bottle / tube / ml" className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)]" />
              <button type="button" onClick={saveDraft} className="rounded-lg bg-[var(--aura-purple)] px-3 py-2 text-xs font-bold text-white shadow-sm">{formMode === "create" ? "Create item" : "Save changes"}</button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={recordDraft.label} onChange={(e) => setRecordDraft({ ...recordDraft, label: e.target.value })} placeholder="Record name" className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)]" />
              <input value={recordDraft.value} onChange={(e) => setRecordDraft({ ...recordDraft, value: e.target.value })} placeholder="Value" className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)]" />
              <input value={recordDraft.detail} onChange={(e) => setRecordDraft({ ...recordDraft, detail: e.target.value })} placeholder="Detail" className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)] sm:col-span-2" />
              <button type="button" onClick={saveDraft} className="rounded-lg bg-[var(--aura-purple)] px-3 py-2 text-xs font-bold text-white shadow-sm sm:col-span-2">{formMode === "create" ? `Create ${activeFeature}` : "Save changes"}</button>
            </div>
          )}
        </div>
      )}

      {panel ? (
        <>
          <div className="border-b border-white/45 bg-white/20 px-4 py-3">
            <div className="rounded-xl bg-[var(--aura-lavender)]/60 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--aura-purple)]">Smart inventory control</p>
              <p className="mt-0.5 text-sm font-bold text-[var(--aura-heading)]">{panel.summary}</p>
            </div>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--aura-border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--aura-muted)]">
                  <th className="pb-2">Record</th>
                  <th className="pb-2">Detail</th>
                  <th className="pb-2 text-center">Value</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--aura-border)]">
                {panelRows.map(([label, value, detail], index) => (
                  <tr key={`${label}-${index}`} onClick={() => setSelectedPanelRow(index)} className={`cursor-pointer transition-colors duration-200 ${selectedPanelRow === index ? "bg-[#D8C6FF]/75 hover:bg-[#CDB8FF]/85" : "hover:bg-[#E5D8FF]/70"}`}>
                    <td className="py-2.5 pr-2">
                      <p className="font-semibold leading-tight text-[var(--aura-heading)]">{label}</p>
                      <p className="text-[10px] text-[var(--aura-muted)]">{detail}</p>
                    </td>
                    <td className="py-2.5">
                      <span className="rounded-md bg-[var(--aura-lavender)] px-2 py-0.5 text-[10px] font-medium text-[var(--aura-purple)]">
                        {panel.meta}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="font-bold text-[var(--aura-heading)] tabular-nums">{value}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-white/45 bg-white/25 px-4 py-2.5 text-[11px] text-[var(--aura-body)]">
            <span className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-[var(--aura-purple)]" />
              {panel.footer}
            </span>
            <button type="button" onClick={startCreate} className="font-semibold text-emerald-600">Create</button>
          </div>
        </>
      ) : (
        <>

      {/* Stock Table */}
      <div className="overflow-x-auto p-4">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--aura-border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--aura-muted)]">
              <th className="pb-2">Product &amp; SKU</th>
              <th className="hidden pb-2 sm:table-cell">Type</th>
              <th className="pb-2 text-center">Stock</th>
              <th className="pb-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--aura-border)]">
            {stockItems.map((item) => (
              <tr key={item.sku} onClick={() => setSelectedSku(item.sku)} className={`group cursor-pointer transition-colors duration-200 ${selectedSku === item.sku ? "bg-[#D8C6FF]/75 hover:bg-[#CDB8FF]/85" : "hover:bg-[#E5D8FF]/70"}`}>
                <td className="py-2.5 pr-2">
                  <p className="font-semibold text-[var(--aura-heading)] leading-tight">{item.name}</p>
                  <p className="text-[10px] text-[var(--aura-muted)]">{item.sku} · {item.cost} / {item.unit}</p>
                </td>
                <td className="hidden py-2.5 sm:table-cell">
                  <span className="rounded-md bg-[var(--aura-lavender)] px-2 py-0.5 text-[10px] font-medium text-[var(--aura-purple)]">
                    {item.category}
                  </span>
                </td>
                <td className="py-2.5 text-center">
                  <span className="font-bold text-[var(--aura-heading)] tabular-nums">{item.inStock}</span>
                  <span className="text-[10px] text-[var(--aura-muted)]"> / {item.minStock} min {item.unit}</span>
                </td>
                <td className="py-2.5 text-right">
                  {item.status === "In Stock" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      In Stock
                    </span>
                  )}
                  {item.status === "Low Stock" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Low Stock
                    </span>
                  )}
                  {item.status === "Out of Stock" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      <TrendingDown className="h-2.5 w-2.5" />
                      Reorder
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Alert */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/45 bg-white/25 px-4 py-2.5 text-[11px] text-[var(--aura-body)]">
        <span className="flex min-w-0 items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-[var(--aura-purple)]" />
          Selected: {selectedItem?.sku ?? "No item"} · CRUD changes are frontend preview
        </span>
        <span className="font-semibold text-emerald-600">Expected Tomorrow</span>
      </div>
        </>
      )}
    </div>
  );
}

/* ── Memberships & Loyalty Dashboard ── */
function MembershipDashboard({ activeFeature = "Tiered memberships" }: { activeFeature?: string }) {
  const seedRows: Record<string, string[][]> = {
    "Tiered memberships": [["Gold Privilege", "₹9,999/yr", "15% off + monthly scalp spa"], ["Platinum Elite", "₹18,999/yr", "20% off + priority booking"], ["Family Club", "₹24,999/yr", "Shared benefits for 4 members"]],
    "Custom prepaid packages": [["Bridal Glow Series", "₹18,500", "6 sessions tracked automatically"], ["Hair Revival Pack", "₹8,999", "4 spas + 2 trims"], ["Grooming Pass", "₹4,500", "6 beard/hair services"]],
    "Wallet recharge bonus": [["Recharge ₹10,000", "+15%", "Customer gets ₹11,500 credit"], ["Recharge ₹5,000", "+8%", "Customer gets ₹5,400 credit"], ["Family Wallet", "Shared", "Can be used by linked members"]],
    "Points-per-rupee reward": [["Service spend", "1 pt / ₹10", "Standard earning rule"], ["Retail spend", "2 pt / ₹10", "Pushes product sales"], ["Redemption", "100 pts = ₹50", "Applied at POS"]],
    "Digital gift cards": [["Birthday Card", "₹2,000", "WhatsApp delivery"], ["Festive Voucher", "₹5,000", "Limited validity"], ["Corporate Pack", "₹25,000", "Bulk issue ready"]],
    "Prepaid service balance": [["Hair Spa", "3 left", "Expires in 42 days"], ["Facial Cleanup", "2 left", "OTP redemption enabled"], ["Blowdry", "5 left", "Transferable to family"]],
    "Flexible OTP redemption": [["Priya Sharma", "Verified", "OTP used at POS"], ["Naina Kapoor", "Pending", "OTP expires in 8 min"], ["Family member", "Allowed", "Shared wallet redemption"]],
    "WhatsApp expiry alerts": [["Wallet expiry", "18 days", "Reminder scheduled"], ["Package expiry", "7 days", "Offer follow-up ready"], ["Points expiry", "30 days", "Win-back message queued"]],
  };
  const [rowsByFeature, setRowsByFeature] = useState(seedRows);
  const [selectedRow, setSelectedRow] = useState(0);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState({ name: "", value: "", detail: "" });
  const rows = rowsByFeature[activeFeature] ?? seedRows["Tiered memberships"];

  const startCreate = () => {
    setDraft({ name: `New ${activeFeature}`, value: "Draft", detail: "Frontend preview record" });
    setFormMode("create");
  };
  const startEdit = () => {
    const row = rows[selectedRow] ?? rows[0];
    if (!row) return;
    setDraft({ name: row[0], value: row[1], detail: row[2] });
    setFormMode("edit");
  };
  const saveDraft = () => {
    const row = [draft.name.trim() || `New ${activeFeature}`, draft.value.trim() || "Draft", draft.detail.trim() || "Frontend preview record"];
    setRowsByFeature((current) => {
      const currentRows = current[activeFeature] ?? rows;
      const nextRows = formMode === "edit" ? currentRows.map((item, index) => (index === selectedRow ? row : item)) : [...currentRows, row];
      setSelectedRow(formMode === "edit" ? selectedRow : nextRows.length - 1);
      return { ...current, [activeFeature]: nextRows };
    });
    setFormMode(null);
  };
  const deleteRow = () => {
    setRowsByFeature((current) => {
      const currentRows = current[activeFeature] ?? rows;
      const nextRows = currentRows.filter((_, index) => index !== selectedRow);
      setSelectedRow(Math.max(0, selectedRow - 1));
      return { ...current, [activeFeature]: nextRows };
    });
    setFormMode(null);
  };

  return (
      <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/45 shadow-[0_22px_70px_rgba(82,58,138,0.10)] backdrop-blur-xl ring-1 ring-white/50">
      {/* Top Banner */}
      <div className="border-b border-[var(--aura-border)] bg-gradient-to-r from-[#18181B] via-[#2A1E4A] to-[var(--aura-purple)] p-5 text-white lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              <Crown className="h-3.5 w-3.5 text-amber-300" />
              Aura Loyalty &amp; Membership Hub
            </span>
             <h3 className="mt-2 text-xl font-bold tracking-tight lg:text-2xl">{activeFeature}</h3>
            <p className="text-xs text-white/70">Create, edit and manage loyalty records from the selected module.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-1.5">
              <button type="button" onClick={startCreate} className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-[var(--aura-purple)]">Create</button>
              <button type="button" onClick={startEdit} disabled={rows.length === 0} className="rounded-lg bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/20 disabled:opacity-40">Edit</button>
              <button type="button" onClick={deleteRow} disabled={rows.length === 0} className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[11px] font-bold text-white ring-1 ring-red-200/20 disabled:opacity-40">Delete</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/10 p-3 text-center backdrop-blur-sm border border-white/10">
                <p className="text-xl font-bold tabular-nums">482</p>
                <p className="text-[10px] text-white/70 uppercase tracking-wider">Active Members</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 text-center backdrop-blur-sm border border-white/10">
                <p className="text-xl font-bold text-amber-300 tabular-nums">₹14.2L</p>
                <p className="text-[10px] text-white/70 uppercase tracking-wider">Wallet Reserves</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {formMode && (
        <div className="border-b border-white/45 bg-white/25 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-[var(--aura-heading)]">{formMode === "create" ? "Create" : "Edit"} {activeFeature}</p>
              <p className="text-[10px] text-[var(--aura-muted)]">This CRUD form belongs to the selected loyalty card.</p>
            </div>
            <button type="button" onClick={() => setFormMode(null)} className="rounded-lg border border-[var(--aura-border)] px-2 py-1 text-[10px] font-semibold text-[var(--aura-muted)]">Cancel</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)]" />
            <input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder="Price / value" className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)]" />
            <input value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} placeholder="Benefit / detail" className="rounded-lg border border-white/55 bg-white/35 px-3 py-2 text-xs outline-none backdrop-blur-sm focus:border-[var(--aura-purple)]" />
            <button type="button" onClick={saveDraft} className="rounded-lg bg-[var(--aura-purple)] px-3 py-2 text-xs font-bold text-white shadow-sm sm:col-span-3">{formMode === "create" ? "Create record" : "Save changes"}</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto p-5 lg:p-6">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--aura-border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--aura-muted)]">
              <th className="pb-2">Name</th>
              <th className="hidden pb-2 sm:table-cell">Module</th>
              <th className="pb-2 text-center">Value</th>
              <th className="pb-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--aura-border)]">
            {rows.map(([name, value, detail], index) => (
              <tr key={`${name}-${index}`} onClick={() => setSelectedRow(index)} className={`cursor-pointer transition-colors duration-200 ${selectedRow === index ? "bg-[#D8C6FF]/75 hover:bg-[#CDB8FF]/85" : "hover:bg-[#E5D8FF]/70"}`}>
                <td className="py-3 pr-2">
                  <p className="font-semibold leading-tight text-[var(--aura-heading)]">{name}</p>
                  <p className="text-[10px] text-[var(--aura-muted)]">{detail}</p>
                </td>
                <td className="hidden py-3 sm:table-cell">
                  <span className="rounded-md bg-[var(--aura-lavender)] px-2 py-0.5 text-[10px] font-medium text-[var(--aura-purple)]">{activeFeature}</span>
                </td>
                <td className="py-3 text-center">
                  <span className="font-bold text-[var(--aura-heading)] tabular-nums">{value}</span>
                </td>
                <td className="py-3 text-right">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Active
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/45 bg-white/25 px-5 py-3 text-[11px] text-[var(--aura-body)]">
        <span className="flex min-w-0 items-center gap-1.5">
          <Gift className="h-3.5 w-3.5 text-[var(--aura-purple)]" />
          Selected: {rows[selectedRow]?.[0] ?? "No record"} · Loyalty CRUD frontend preview
        </span>
        <button type="button" onClick={startCreate} className="font-semibold text-emerald-600">Create</button>
      </div>
    </div>
  );
}

/* ── Marketing Automation Flow Showcase ── */
function MarketingAutomationMockup({ activeFeature = "WhatsApp campaigns" }: { activeFeature?: string }) {
  const dashboards = {
    "WhatsApp campaigns": {
      title: "WhatsApp Campaign Cockpit",
      summary: "8 flows running today",
      metric: "42% reply rate",
      footer: "Broadcasts, follow-ups and offer reminders stay automated without staff chasing manually.",
      campaigns: [
        { title: "Weekend Slots Push", trigger: "Friday 11 AM", audience: "318 clients", channel: "WhatsApp", roi: "41 bookings (₹72,800 rev)", badge: "Live" },
        { title: "Hair Spa Upsell", trigger: "After haircut bill", audience: "126 clients", channel: "WhatsApp", roi: "19 add-ons booked", badge: "Upsell" },
        { title: "Festival Glow Offer", trigger: "Manual segment launch", audience: "540 clients", channel: "WhatsApp", roi: "₹1.2L pipeline", badge: "Promo" },
      ],
    },
    "Birthday greeting offers": {
      title: "Birthday Offer Engine",
      summary: "18 birthdays this week",
      metric: "72% claim rate",
      footer: "Birthday greetings are converted into timed offers, not generic messages.",
      campaigns: [
        { title: "Birthday Celebration Treat", trigger: "Birthday in next 7 days", audience: "18 clients", channel: "WhatsApp + SMS", roi: "13 vouchers claimed", badge: "Automated" },
        { title: "VIP Birthday Upgrade", trigger: "Gold member birthday", audience: "5 clients", channel: "WhatsApp", roi: "₹28,400 booked", badge: "VIP" },
        { title: "Family Birthday Nudge", trigger: "Linked member birthday", audience: "11 families", channel: "WhatsApp", roi: "8 group visits", badge: "Family" },
      ],
    },
    "Inactive client win-back": {
      title: "Win-Back Automation",
      summary: "142 clients targeted",
      metric: "34 bookings recovered",
      footer: "Inactive clients get the right offer based on last service and spend history.",
      campaigns: [
        { title: "45-Day No Visit", trigger: "No visit in 45 days", audience: "142 clients", channel: "WhatsApp", roi: "34 bookings (₹58,400 rev)", badge: "High ROI" },
        { title: "Lost Keratin Client", trigger: "No keratin in 90 days", audience: "38 clients", channel: "WhatsApp", roi: "9 premium bookings", badge: "Premium" },
        { title: "Dormant VIP Recovery", trigger: "VIP inactive 60 days", audience: "24 clients", channel: "Call + WhatsApp", roi: "₹44,000 recovered", badge: "VIP" },
      ],
    },
    "Appointment reminders": {
      title: "Reminder Timeline",
      summary: "96 reminders queued",
      metric: "28% fewer no-shows",
      footer: "Clients receive reminders at the right time with confirm/reschedule actions.",
      campaigns: [
        { title: "T-24 Hour Reminder", trigger: "One day before visit", audience: "56 appointments", channel: "WhatsApp", roi: "48 confirmed", badge: "Confirm" },
        { title: "T-3 Hour Reminder", trigger: "Same-day visit", audience: "31 appointments", channel: "WhatsApp", roi: "6 rescheduled early", badge: "Smart" },
        { title: "Late Arrival Alert", trigger: "10 min overdue", audience: "9 clients", channel: "WhatsApp", roi: "5 arrivals recovered", badge: "Live" },
      ],
    },
    "Google review requests": {
      title: "Review Growth Engine",
      summary: "4.9 rating protected",
      metric: "180+ reviews",
      footer: "Happy clients are asked for reviews while poor experiences route to service recovery.",
      campaigns: [
        { title: "Post-Service Review Collector", trigger: "2 hours after bill", audience: "All completed visits", channel: "WhatsApp", roi: "4.9 ★ (180+ reviews)", badge: "Reputation" },
        { title: "5-Star Fast Link", trigger: "Positive feedback", audience: "64 clients", channel: "WhatsApp", roi: "37 new reviews", badge: "Growth" },
        { title: "Recovery Follow-Up", trigger: "Low rating", audience: "7 clients", channel: "Manager call", roi: "5 issues closed", badge: "Care" },
      ],
    },
    "Targeted discount coupons": {
      title: "Coupon Targeting Desk",
      summary: "₹86k coupon pipeline",
      metric: "31% conversion",
      footer: "Discounts go only to the right segment so revenue grows without margin leakage.",
      campaigns: [
        { title: "Color Client Upgrade", trigger: "Root touch-up due", audience: "88 clients", channel: "WhatsApp", roi: "₹42,000 pipeline", badge: "Targeted" },
        { title: "Retail Bundle Coupon", trigger: "Product stock high", audience: "120 clients", channel: "WhatsApp", roi: "28 bundles sold", badge: "Retail" },
        { title: "First-Time Second Visit", trigger: "New client + 21 days", audience: "54 clients", channel: "SMS + WhatsApp", roi: "22 repeat visits", badge: "Repeat" },
      ],
    },
    "Smart customer segments": {
      title: "AI Segment Builder",
      summary: "9 live segments",
      metric: "642 clients classified",
      footer: "Segments are built from visits, spend, service preference and inactivity windows.",
      campaigns: [
        { title: "High Value Hair Clients", trigger: "Avg spend above ₹2,500", audience: "96 clients", channel: "WhatsApp", roi: "₹1.8L segment value", badge: "Premium" },
        { title: "Retail Buyers", trigger: "Bought product twice", audience: "118 clients", channel: "WhatsApp", roi: "44% attach rate", badge: "Retail" },
        { title: "At-Risk Regulars", trigger: "Visit gap increasing", audience: "73 clients", channel: "WhatsApp", roi: "21 saved clients", badge: "Risk" },
      ],
    },
    "Campaign ROI analytics": {
      title: "Campaign ROI Analytics",
      summary: "₹3.4L attributed revenue",
      metric: "6.8x ROI",
      footer: "Every flow shows bookings, revenue, claims and conversion so owners know what works.",
      campaigns: [
        { title: "Win-Back Revenue", trigger: "45-day inactive", audience: "142 clients", channel: "WhatsApp", roi: "6.8x ROI", badge: "Winner" },
        { title: "Birthday Claims", trigger: "Birthday offer", audience: "18 clients", channel: "WhatsApp + SMS", roi: "72% claim rate", badge: "Claims" },
        { title: "Review Conversion", trigger: "Post-service", audience: "240 visits", channel: "WhatsApp", roi: "37 reviews added", badge: "Brand" },
      ],
    },
  };
  const dashboard = dashboards[activeFeature as keyof typeof dashboards] ?? dashboards["WhatsApp campaigns"];

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/45 shadow-[0_22px_70px_rgba(82,58,138,0.10)] backdrop-blur-xl ring-1 ring-white/50">
      {/* Top Bar */}
      <div className="border-b border-white/45 bg-white/25 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-[var(--aura-purple)]" />
            <div>
              <span className="text-xs font-semibold text-[var(--aura-heading)]">{dashboard.title}</span>
              <p className="text-[10px] text-[var(--aura-muted)]">{dashboard.summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-white px-3 py-2 text-center text-xs font-bold text-[var(--aura-purple)] shadow-sm ring-1 ring-[var(--aura-border)]">{dashboard.metric}</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI Scheduler Running
            </span>
          </div>
        </div>
      </div>

      {/* Campaigns list */}
      <div className="p-4 space-y-3">
        {dashboard.campaigns.map((camp) => (
          <div
            key={camp.title}
            className="rounded-xl border border-white/45 bg-white/25 p-3.5 backdrop-blur-sm transition-all hover:border-[var(--aura-purple)]/40 hover:bg-white/35 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-[var(--aura-heading)]">{camp.title}</p>
                  <span className="rounded-md bg-[var(--aura-lavender)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--aura-purple)]">
                    {camp.badge}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--aura-body)] mt-0.5">
                  Trigger: <span className="font-medium text-[var(--aura-heading)]">{camp.trigger}</span> &bull; Target: {camp.audience}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100/70 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                {camp.channel}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--aura-border)] text-[11px]">
              <span className="text-[var(--aura-muted)]">Performance:</span>
              <span className="font-semibold text-emerald-700">{camp.roi}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-white/45 bg-white/25 px-5 py-3 text-[11px] text-[var(--aura-body)]">
        <span>{dashboard.footer}</span>
        <span className="font-semibold text-[var(--aura-purple)]">Auto optimized</span>
      </div>
    </div>
  );
}

export function AdvancedFeatures() {
  const { ref: inventoryRef, visible: inventoryVisible } = useReveal();
  const { ref: membershipRef, visible: membershipVisible } = useReveal();
  const { ref: marketingRef, visible: marketingVisible } = useReveal();
  const [activeInventoryFeature, setActiveInventoryFeature] = useState("Live stock tracking");
  const [activeMembershipFeature, setActiveMembershipFeature] = useState("Tiered memberships");
  const [activeMarketingFeature, setActiveMarketingFeature] = useState("WhatsApp campaigns");
  const inventoryFeatures = [
    { icon: Boxes, label: "Live stock tracking" },
    { icon: TrendingDown, label: "Service consumption" },
    { icon: ShoppingCart, label: "Purchase orders (PO)" },
    { icon: AlertTriangle, label: "Low-stock alerts" },
    { icon: Tag, label: "Retail product sales" },
    { icon: Truck, label: "Supplier records" },
    { icon: History, label: "Stock audit history" },
  ];
  const membershipFeatures = [
    { icon: Crown, label: "Tiered memberships" },
    { icon: Sparkles, label: "Custom prepaid packages" },
    { icon: Wallet, label: "Wallet recharge bonus" },
    { icon: Coins, label: "Points-per-rupee reward" },
    { icon: Gift, label: "Digital gift cards" },
    { icon: CreditCard, label: "Prepaid service balance" },
    { icon: CheckCircle2, label: "Flexible OTP redemption" },
    { icon: Clock, label: "WhatsApp expiry alerts" },
  ];
  const marketingFeatures = [
    { icon: MessageSquare, label: "WhatsApp campaigns" },
    { icon: Cake, label: "Birthday greeting offers" },
    { icon: UserCheck, label: "Inactive client win-back" },
    { icon: Clock, label: "Appointment reminders" },
    { icon: Star, label: "Google review requests" },
    { icon: Tag, label: "Targeted discount coupons" },
    { icon: Users, label: "Smart customer segments" },
    { icon: BarChart2, label: "Campaign ROI analytics" },
  ];

  return (
    <>
      {/* ── SECTION 1: INVENTORY ── */}
      <section ref={inventoryRef} className="relative overflow-hidden border-t border-white/70 bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF] py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(243,240,255,0.95),transparent_34%),radial-gradient(circle_at_84%_42%,rgba(111,79,216,0.11),transparent_31%)]" aria-hidden="true" />
        <LandingDecor variant="soft" />
        <Container className="relative z-10">
          <div className="grid min-w-0 items-center gap-8 rounded-[2rem] border border-white/65 bg-white/20 p-4 shadow-[0_18px_80px_rgba(82,58,138,0.07)] backdrop-blur-sm sm:p-5 md:p-8 lg:gap-20 lg:grid-cols-2 lg:p-10">
            {/* Text column */}
            <div
              style={{
                opacity: inventoryVisible ? 1 : 0,
                transform: inventoryVisible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
              }}
            >
              <span className="inline-flex rounded-full border border-[var(--aura-purple)]/15 bg-white/55 px-3 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 shadow-sm shadow-[var(--aura-purple)]/5">
                Inventory &amp; Consumption
              </span>
              <h2 className="max-w-full text-[clamp(2rem,4.8vw,3.4rem)] font-bold leading-[1.03] tracking-[-0.055em] text-[var(--aura-heading)] md:max-w-xl">
                Never discover you&apos;re out of stock during a service.
              </h2>
              <p className="mt-5 max-w-lg text-[1.02rem] leading-[1.8] text-[var(--aura-body)]">
                Eliminate pilferage, track real consumption for every hair wash, color tube or facial kit, and reorder automatically before you run out.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--aura-purple)]">
                <span className="rounded-full bg-white/60 px-3 py-1 ring-1 ring-white/70">Barcode-to-reorder flow</span>
                <span className="rounded-full bg-[var(--aura-lavender)]/75 px-3 py-1 ring-1 ring-[var(--aura-purple)]/10">Low-stock clarity</span>
              </div>

              <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
                {inventoryFeatures.map(({ icon, label }) => (
                  <FeaturePill
                    key={label}
                    icon={icon}
                    label={label}
                    active={activeInventoryFeature === label}
                    onClick={() => setActiveInventoryFeature(label)}
                  />
                ))}
              </ul>

              <div className="mt-8 pt-2">
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--aura-purple)] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md transition-all duration-300 hover:bg-[var(--aura-purple-hover)] hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Book a Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Mockup column */}
            <div
              className="relative min-w-0"
              style={{
                opacity: inventoryVisible ? 1 : 0,
                transform: inventoryVisible ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 0.6s ease-out 0.12s, transform 0.6s ease-out 0.12s",
              }}
            >
              <div className="pointer-events-none absolute -top-4 left-4 z-10 hidden rounded-full border border-white/70 bg-white/75 px-3 py-1.5 text-[11px] font-semibold text-[var(--aura-heading)] shadow-[0_12px_40px_rgba(82,58,138,0.10)] backdrop-blur-md sm:block">
                {activeInventoryFeature}
              </div>
              <InventoryMockup key={activeInventoryFeature} activeFeature={activeInventoryFeature} />
            </div>
          </div>
        </Container>
      </section>

      {/* ── SECTION 2: MEMBERSHIPS & LOYALTY (HIGH IMPACT SHOWCASE) ── */}
      <section
        ref={membershipRef}
        className="relative scroll-mt-24 overflow-hidden border-t border-white/70 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF] py-12 md:py-16"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(243,240,255,0.95),transparent_38%),radial-gradient(circle_at_12%_78%,rgba(111,79,216,0.08),transparent_30%)]" aria-hidden="true" />
        <LandingDecor variant="warm" />
        <Container className="relative z-10">
          <div className="grid items-center gap-8 lg:grid-cols-[0.74fr_1.26fr] lg:gap-10 xl:gap-12">
            <div
              style={{
                opacity: membershipVisible ? 1 : 0,
                transform: membershipVisible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
              }}
            >
              <span className="inline-flex rounded-full border border-[var(--aura-purple)]/15 bg-white/55 px-3 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3 shadow-sm shadow-[var(--aura-purple)]/5">
                Memberships &amp; Loyalty
              </span>
               <h2 className="max-w-full text-[clamp(2.15rem,4.2vw,3.2rem)] font-bold leading-[1.02] tracking-[-0.055em] text-[var(--aura-heading)] text-balance md:max-w-xl">
                Turn occasional visits into lasting relationships.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-[var(--aura-body)] md:text-base text-pretty">
                Lock in predictable recurring revenue with memberships, prepaid packages, wallet bonuses, and loyalty rewards that keep chairs booked year-round.
              </p>

              <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {membershipFeatures.map(({ icon, label }) => (
                  <FeaturePill
                    key={label}
                    icon={icon}
                    label={label}
                    active={activeMembershipFeature === label}
                    onClick={() => setActiveMembershipFeature(label)}
                  />
                ))}
              </ul>

              <div className="mt-8 pt-2">
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--aura-purple)] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md transition-all duration-300 hover:bg-[var(--aura-purple-hover)] hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Book a Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div
              className="min-w-0"
              style={{
                opacity: membershipVisible ? 1 : 0,
                transform: membershipVisible ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 0.6s ease-out 0.15s, transform 0.6s ease-out 0.15s",
              }}
            >
              <MembershipDashboard key={activeMembershipFeature} activeFeature={activeMembershipFeature} />
            </div>
          </div>
        </Container>
      </section>

      {/* ── SECTION 3: MARKETING AUTOMATION (SOFT LAVENDER BACKGROUND) ── */}
      <section
        ref={marketingRef}
        className="relative overflow-hidden border-t border-white/70 bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF] py-12 md:py-20"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_30%,rgba(243,240,255,0.95),transparent_34%),radial-gradient(circle_at_86%_70%,rgba(111,79,216,0.10),transparent_32%)]" aria-hidden="true" />
        <LandingDecor variant="soft" />
        <Container className="relative z-10">
          <div className="grid min-w-0 items-center gap-8 rounded-[2rem] border border-white/65 bg-white/20 p-4 shadow-[0_18px_80px_rgba(82,58,138,0.07)] backdrop-blur-sm sm:p-5 md:p-8 lg:gap-20 lg:grid-cols-2 lg:p-10">
            {/* Text column */}
            <div
              style={{
                opacity: marketingVisible ? 1 : 0,
                transform: marketingVisible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
              }}
            >
              <span className="inline-flex rounded-full border border-[var(--aura-purple)]/15 bg-white/55 px-3 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 shadow-sm shadow-[var(--aura-purple)]/5">
                Marketing &amp; Retention
              </span>
              <h2 className="max-w-full text-[clamp(2rem,4.8vw,3.4rem)] font-bold leading-[1.03] tracking-[-0.055em] text-[var(--aura-heading)] md:max-w-xl">
                Bring clients back automatically.
              </h2>
              <p className="mt-5 max-w-lg text-[1.02rem] leading-[1.8] text-[var(--aura-body)]">
                Set up automated triggers that send personalised WhatsApp &amp; SMS messages based on customer visit history, birthdays, and inactivity windows.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--aura-purple)]">
                <span className="rounded-full bg-white/60 px-3 py-1 ring-1 ring-white/70">Trigger-based journeys</span>
                <span className="rounded-full bg-[var(--aura-lavender)]/75 px-3 py-1 ring-1 ring-[var(--aura-purple)]/10">WhatsApp follow-ups</span>
              </div>

              <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
                {marketingFeatures.map(({ icon, label }) => (
                  <FeaturePill
                    key={label}
                    icon={icon}
                    label={label}
                    active={activeMarketingFeature === label}
                    onClick={() => setActiveMarketingFeature(label)}
                  />
                ))}
              </ul>

              <div className="mt-8 pt-2">
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--aura-purple)] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md transition-all duration-300 hover:bg-[var(--aura-purple-hover)] hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Book a Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Automation flow mockup */}
            <div
              className="relative min-w-0"
              style={{
                opacity: marketingVisible ? 1 : 0,
                transform: marketingVisible ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 0.6s ease-out 0.12s, transform 0.6s ease-out 0.12s",
              }}
            >
              <div className="pointer-events-none absolute -top-4 left-4 z-10 hidden rounded-full border border-white/70 bg-white/75 px-3 py-1.5 text-[11px] font-semibold text-[var(--aura-heading)] shadow-[0_12px_40px_rgba(82,58,138,0.10)] backdrop-blur-md sm:block">
                {activeMarketingFeature}
              </div>
              <MarketingAutomationMockup key={activeMarketingFeature} activeFeature={activeMarketingFeature} />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
