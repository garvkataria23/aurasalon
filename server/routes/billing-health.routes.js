import { existsSync } from "node:fs";
import { join } from "node:path";
import { Router } from "express";
import { columnsFor } from "../db.js";

export const billingHealthRouter = Router();

const moduleFiles = {
  invoice: "server/services/billing.service.js",
  gst: "server/services/gst-tax.service.js",
  payments: "server/services/payment.service.js",
  refunds: "server/services/refund.service.js",
  cashDrawer: "server/services/cash-drawer.service.js",
  dayClose: "server/services/day-close-lock.service.js",
  offlineSync: "server/services/offline-pos-sync.service.js",
  ledger: "server/services/invoice-event-ledger.service.js",
  terminals: "server/services/terminal.service.js",
  print: "server/services/print-device.service.js"
};

const criticalTables = ["invoices", "invoice_items", "invoice_payments", "invoice_events", "offline_sync_queue", "day_close_locks"];

function tableReady(table) {
  try {
    const columns = columnsFor(table);
    return columns.includes("tenant_id") || columns.includes("tenantId");
  } catch {
    return false;
  }
}

billingHealthRouter.get("/billing-health", (_req, res) => {
  const modules = {};
  const warnings = [];
  for (const [name, file] of Object.entries(moduleFiles)) {
    const ready = existsSync(join(process.cwd(), file));
    modules[name] = ready ? "ready" : "missing";
    if (!ready) warnings.push(`${name} module file is missing`);
  }
  for (const table of criticalTables) {
    if (!tableReady(table)) warnings.push(`${table} table is missing or lacks tenant_id in current database`);
  }
  res.json({ ok: !Object.values(modules).includes("missing"), modules, warnings });
});
