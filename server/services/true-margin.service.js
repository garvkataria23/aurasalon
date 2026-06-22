import { columnsFor, db } from "../db.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function safeColumns(table) {
  try {
    return columnsFor(table);
  } catch {
    return [];
  }
}

function productCost(item, tenantId) {
  if (item.item_type !== "product" || !item.item_id) return 0;
  const columns = safeColumns("products");
  if (!columns.length) return 0;
  const tenantColumn = columns.includes("tenant_id") ? "tenant_id" : columns.includes("tenantId") ? "tenantId" : "";
  const costColumn = ["cost_price", "costPrice", "unitCost", "purchasePrice"].find((column) => columns.includes(column));
  if (!costColumn) return 0;
  const where = tenantColumn ? `id = @id AND ${tenantColumn} = @tenantId` : "id = @id";
  const row = db.prepare(`SELECT ${costColumn} AS cost FROM products WHERE ${where}`).get({ id: item.item_id, tenantId });
  return money(Number(row?.cost || 0) * Number(item.quantity || 1));
}

function staffCommissionEstimate(item) {
  if (!item.staff_id) return 0;
  return money(Number(item.taxable_amount || item.total_amount || 0) * 0.1);
}

export class TrueMarginService {
  calculateItemMargin(item, tenantId) {
    const revenue = money(item.total_amount || 0);
    const discount = money(item.discount_amount || 0);
    const tax = money(item.tax_amount || 0);
    const product_cost = productCost(item, tenantId);
    const service_consumable_cost = item.item_type === "service" ? money(Number(item.taxable_amount || 0) * 0.05) : 0;
    const staff_commission = staffCommissionEstimate(item);
    const gross_margin = money(revenue - tax - product_cost - service_consumable_cost - staff_commission);
    const margin_pct = revenue > 0 ? money((gross_margin / revenue) * 100) : 0;
    return { revenue, discount, tax, product_cost, service_consumable_cost, staff_commission, gross_margin, margin_pct };
  }

  recordInvoiceMargins(invoiceId, tenantId) {
    if (!safeColumns("invoice_item_margins").includes("tenant_id")) return [];
    db.prepare("DELETE FROM invoice_item_margins WHERE tenant_id = ? AND invoice_id = ?").run(tenantId, invoiceId);
    const items = db.prepare("SELECT * FROM invoice_items WHERE tenant_id = ? AND invoice_id = ?").all(tenantId, invoiceId);
    const insert = db.prepare(
      `INSERT INTO invoice_item_margins
        (id, tenant_id, invoice_id, invoice_item_id, revenue, discount, tax, product_cost,
         service_consumable_cost, staff_commission, gross_margin, margin_pct, created_at)
       VALUES
        (@id, @tenantId, @invoiceId, @invoiceItemId, @revenue, @discount, @tax, @productCost,
         @serviceConsumableCost, @staffCommission, @grossMargin, @marginPct, CURRENT_TIMESTAMP)`
    );
    return items.map((item) => {
      const margin = this.calculateItemMargin(item, tenantId);
      insert.run({
        id: `margin_${crypto.randomUUID().slice(0, 12)}`,
        tenantId,
        invoiceId,
        invoiceItemId: item.id,
        revenue: margin.revenue,
        discount: margin.discount,
        tax: margin.tax,
        productCost: margin.product_cost,
        serviceConsumableCost: margin.service_consumable_cost,
        staffCommission: margin.staff_commission,
        grossMargin: margin.gross_margin,
        marginPct: margin.margin_pct
      });
      return { invoiceItemId: item.id, ...margin };
    });
  }
}

export const trueMarginService = new TrueMarginService();
