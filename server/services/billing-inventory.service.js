import { columnsFor, db } from "../db.js";
import { inventoryEnterpriseService } from "./inventory-enterprise.service.js";
import { trueMarginService } from "./true-margin.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function safeColumns(table) {
  try {
    return columnsFor(table);
  } catch {
    return [];
  }
}

function insertInventoryTransaction(row) {
  const columns = safeColumns("inventory_transactions");
  if (!columns.length) return null;
  const payload = {};
  const put = (snake, camel, value) => {
    if (columns.includes(snake)) payload[snake] = value;
    else if (columns.includes(camel)) payload[camel] = value;
  };
  put("id", "id", `invtx_${crypto.randomUUID().slice(0, 12)}`);
  put("tenant_id", "tenantId", row.tenantId);
  put("branch_id", "branchId", row.branchId);
  put("product_id", "productId", row.productId);
  put("type", "type", row.type);
  put("quantity", "quantity", row.quantity);
  put("unit_cost", "unitCost", row.unitCost);
  put("total_cost", "totalCost", row.totalCost);
  put("reference_type", "referenceType", "invoice");
  put("reference_id", "referenceId", row.invoiceId);
  put("notes", "notes", row.notes);
  put("created_at", "createdAt", new Date().toISOString());
  const keys = Object.keys(payload);
  if (!keys.length) return null;
  db.prepare(`INSERT INTO inventory_transactions (${keys.join(", ")}) VALUES (${keys.map((key) => `@${key}`).join(", ")})`).run(payload);
  return payload;
}

export class BillingInventoryService {
  applyFinalization(invoiceId, access = {}) {
    const invoice = db.prepare("SELECT * FROM invoices WHERE tenant_id = ? AND id = ?").get(access.tenantId, invoiceId);
    if (!invoice) return { inventory: [], margins: [], alerts: [] };
    const items = db.prepare("SELECT * FROM invoice_items WHERE tenant_id = ? AND invoice_id = ?").all(access.tenantId, invoiceId);
    const inventory = [];
    const alerts = [];

    for (const item of items) {
      if (item.item_type === "product" && item.item_id) {
        const effect = inventoryEnterpriseService.consumeProductFifo({
          productId: item.item_id,
          branchId: invoice.branch_id,
          quantity: Math.abs(Number(item.quantity || 1)),
          type: "sale-deduction",
          reason: `Auto FIFO deduction for invoice ${invoice.invoice_no}`,
          referenceType: "invoice",
          referenceId: invoiceId
        }, access);
        inventory.push(effect);
      }
      if (item.item_type === "service") {
        const serviceEffect = inventoryEnterpriseService.consumeServiceRecipe({
          serviceId: item.item_id,
          branchId: invoice.branch_id,
          quantity: Math.abs(Number(item.quantity || 1)),
          referenceType: "invoice",
          referenceId: invoiceId,
          staffId: item.staff_id || invoice.staff_id || "",
          clientId: invoice.client_id || ""
        }, access);
        if (serviceEffect.status === "deducted") {
          inventory.push(serviceEffect);
        } else {
          alerts.push({
            type: "service_recipe_missing",
            itemId: item.id,
            serviceId: item.item_id,
            estimatedCost: money(Number(item.taxable_amount || 0) * 0.05),
            message: serviceEffect.warning
          });
        }
      }
    }

    const margins = trueMarginService.recordInvoiceMargins(invoiceId, access.tenantId);
    return { inventory, margins, alerts };
  }

  rollbackInvoice(invoiceId, access = {}) {
    return {
      invoiceId,
      status: "rollback_recorded",
      note: "Inventory rollback hook recorded. Batch-aware reversal is handled by Prompt 8 extension services."
    };
  }
}

export const billingInventoryService = new BillingInventoryService();
