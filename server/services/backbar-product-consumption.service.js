import { db } from "../db.js";
import { conflict, notFound } from "../utils/app-error.js";
import { assertBranch, camel, makeId, now, number, toJson } from "./enterprise-command-utils.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const UNIT_ALIASES = new Map([
  ["gm", "g"],
  ["gram", "g"],
  ["grams", "g"],
  ["ltr", "l"],
  ["liter", "l"],
  ["litre", "l"],
  ["liters", "l"],
  ["litres", "l"],
  ["piece", "pcs"],
  ["pieces", "pcs"],
  ["nos", "pcs"],
  ["no", "pcs"]
]);
const LOW_BALANCE_PCT = 20;
const MEASURE_UNITS = new Set(["ml", "g", "kg", "l"]);

let schemaReady = false;

function ensureBackbarSchema() {
  if (schemaReady) return;
  ensureProductUnitColumns();
  db.exec(`
    CREATE TABLE IF NOT EXISTS backbar_product_containers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      productId TEXT NOT NULL,
      productName TEXT NOT NULL DEFAULT '',
      containerNo INTEGER NOT NULL DEFAULT 1,
      stockUnit TEXT NOT NULL DEFAULT 'pcs',
      measureUnit TEXT NOT NULL DEFAULT 'ml',
      capacityQty REAL NOT NULL DEFAULT 0,
      usedQty REAL NOT NULL DEFAULT 0,
      balanceQty REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      openedFromDraftId TEXT NOT NULL DEFAULT '',
      openedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finishedAt TEXT NOT NULL DEFAULT '',
      stockTransactionId TEXT NOT NULL DEFAULT '',
      createdBy TEXT NOT NULL DEFAULT '',
      updatedBy TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, branch_id, productId, containerNo)
    );
    CREATE INDEX IF NOT EXISTS idx_backbar_containers_product ON backbar_product_containers(tenant_id, branch_id, productId, status, containerNo);

    CREATE TABLE IF NOT EXISTS backbar_product_usage_entries (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      containerId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL DEFAULT '',
      draftId TEXT NOT NULL DEFAULT '',
      invoiceId TEXT NOT NULL DEFAULT '',
      invoiceNumber TEXT NOT NULL DEFAULT '',
      serviceId TEXT NOT NULL DEFAULT '',
      serviceName TEXT NOT NULL DEFAULT '',
      clientId TEXT NOT NULL DEFAULT '',
      clientName TEXT NOT NULL DEFAULT '',
      staffId TEXT NOT NULL DEFAULT '',
      staffName TEXT NOT NULL DEFAULT '',
      usedQty REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'ml',
      productCost REAL NOT NULL DEFAULT 0,
      usageType TEXT NOT NULL DEFAULT 'client',
      reason TEXT NOT NULL DEFAULT '',
      balanceAfter REAL NOT NULL DEFAULT 0,
      createdBy TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_backbar_usage_draft ON backbar_product_usage_entries(tenant_id, branch_id, draftId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_backbar_usage_product ON backbar_product_usage_entries(tenant_id, branch_id, productId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_backbar_usage_container ON backbar_product_usage_entries(tenant_id, containerId, createdAt);

    CREATE TABLE IF NOT EXISTS backbar_product_alerts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      productId TEXT NOT NULL DEFAULT '',
      containerId TEXT NOT NULL DEFAULT '',
      draftId TEXT NOT NULL DEFAULT '',
      invoiceId TEXT NOT NULL DEFAULT '',
      alertType TEXT NOT NULL DEFAULT '',
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      evidenceJson TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'open',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_backbar_alerts_scope ON backbar_product_alerts(tenant_id, branch_id, status, createdAt);
    CREATE INDEX IF NOT EXISTS idx_backbar_alerts_product ON backbar_product_alerts(tenant_id, branch_id, productId, createdAt);
  `);
  schemaReady = true;
}

function ensureProductUnitColumns() {
  const columns = db.prepare("PRAGMA table_info(products)").all().map((column) => column.name);
  if (!columns.includes("unit")) db.prepare("ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'pcs'").run();
  if (!columns.includes("packSize")) db.prepare("ALTER TABLE products ADD COLUMN packSize REAL DEFAULT 1").run();
  if (!columns.includes("packUnit")) db.prepare("ALTER TABLE products ADD COLUMN packUnit TEXT DEFAULT 'pcs'").run();
}

function normalizeUnit(unit = "") {
  const clean = String(unit || "").trim().toLowerCase();
  return UNIT_ALIASES.get(clean) || clean || "pcs";
}

function sameUnit(left = "", right = "") {
  return normalizeUnit(left) === normalizeUnit(right);
}

function compatibleMeasureUnit(left = "", right = "") {
  const from = normalizeUnit(left);
  const to = normalizeUnit(right);
  if (from === to) return true;
  return (from === "kg" && to === "g") || (from === "g" && to === "kg") || (from === "l" && to === "ml") || (from === "ml" && to === "l");
}

function convertMeasureQty(quantity, fromUnit, toUnit) {
  const qty = number(quantity, 0);
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return money(qty);
  if (from === "kg" && to === "g") return money(qty * 1000);
  if (from === "g" && to === "kg") return money(qty / 1000);
  if (from === "l" && to === "ml") return money(qty * 1000);
  if (from === "ml" && to === "l") return money(qty / 1000);
  return money(qty);
}

function placeholders(values) {
  return values.map(() => "?").join(", ");
}

function parseLineItems(row = {}) {
  try {
    return JSON.parse(row.line_items_json || row.lineItemsJson || "[]");
  } catch {
    return [];
  }
}

function loadDraft(id, access) {
  const draft = db.prepare("SELECT * FROM product_consume_drafts WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
  if (!draft) throw notFound("Product consume draft not found");
  if (draft.branch_id) assertBranch(access, draft.branch_id);
  return draft;
}

function loadProduct(productId, access, branchId = "") {
  const product = db.prepare("SELECT * FROM products WHERE id = ? AND tenantId = ?").get(productId, access.tenantId);
  if (!product) throw notFound("Product not found");
  if (product.branchId) assertBranch(access, product.branchId);
  if (branchId && product.branchId && product.branchId !== branchId) throw conflict("Product does not belong to selected branch");
  return product;
}

function productUnits(product = {}, line = {}) {
  const stockUnit = normalizeUnit(line.stockUnit || line.stock_unit || product.unit || product.stockUnit || product.stock_unit || "pcs");
  const measureUnit = normalizeUnit(line.packUnit || line.pack_unit || product.packUnit || product.pack_unit || product.unit || "ml");
  const capacityQty = money(number(line.packSize ?? line.pack_size ?? product.packSize ?? product.pack_size, 0));
  return { stockUnit, measureUnit, capacityQty };
}

function isBackbarLine(product = {}, line = {}) {
  const { stockUnit, measureUnit, capacityQty } = productUnits(product, line);
  const requestedUnit = normalizeUnit(line.unit || measureUnit);
  return capacityQty > 0 && MEASURE_UNITS.has(measureUnit) && !sameUnit(stockUnit, measureUnit) && compatibleMeasureUnit(requestedUnit, measureUnit);
}

function stockUnitCost(product = {}, line = {}) {
  return money(number(line.stockUnitCost ?? line.stock_unit_cost ?? product.unitCost ?? product.unit_cost, 0));
}

function measureUnitCost(product = {}, line = {}) {
  const { capacityQty } = productUnits(product, line);
  const cost = stockUnitCost(product, line);
  return capacityQty > 0 ? money(cost / capacityQty) : money(number(line.unitCost ?? line.unit_cost, 0));
}

function mapContainer(row = {}) {
  const mapped = camel(row);
  return {
    ...mapped,
    containerNo: Number(mapped.containerNo || 0),
    capacityQty: money(mapped.capacityQty),
    usedQty: money(mapped.usedQty),
    balanceQty: money(mapped.balanceQty)
  };
}

function mapUsage(row = {}) {
  const mapped = camel(row);
  return {
    ...mapped,
    usedQty: money(mapped.usedQty),
    productCost: money(mapped.productCost),
    balanceAfter: money(mapped.balanceAfter)
  };
}

function mapAlert(row = {}) {
  return camel(row);
}

function usageText(entries = []) {
  const qtyByUnit = {};
  for (const entry of entries) {
    const unit = entry.unit || "pcs";
    qtyByUnit[unit] = money(number(qtyByUnit[unit], 0) + number(entry.usedQty, 0));
  }
  const parts = Object.entries(qtyByUnit).map(([unit, qty]) => `${qty} ${unit}`);
  return parts.length ? parts.join(" + ") : "0";
}

export class BackbarProductConsumptionService {
  constructor() {
    ensureBackbarSchema();
  }

  isBackbarLine(product = {}, line = {}) {
    return isBackbarLine(product, line);
  }

  applyDraftConsumption({ draft = {}, lines = [], access = {}, consumeStockUnit } = {}) {
    ensureBackbarSchema();
    const passthroughLines = [];
    const allocations = [];
    const alerts = [];
    const stockDeductions = [];

    for (const line of lines) {
      const productId = line.productId || line.product_id;
      if (!productId) continue;
      const product = loadProduct(productId, access, draft.branch_id || draft.branchId || "");
      if (!isBackbarLine(product, line)) {
        passthroughLines.push(line);
        continue;
      }
      const applied = this.applyBackbarLine({ draft, line, product, access, consumeStockUnit });
      allocations.push(...applied.allocations);
      alerts.push(...applied.alerts);
      stockDeductions.push(...applied.stockDeductions);
    }

    return { passthroughLines, allocations, alerts, stockDeductions };
  }

  applyBackbarLine({ draft = {}, line = {}, product = {}, access = {}, consumeStockUnit } = {}) {
    const { stockUnit, measureUnit, capacityQty } = productUnits(product, line);
    const requestedQty = convertMeasureQty(line.actualQty ?? line.actual_qty ?? line.quantity, line.unit || measureUnit, measureUnit);
    const unitCost = measureUnitCost(product, line);
    const maxQty = convertMeasureQty(line.maxQty ?? line.max_qty, line.unit || measureUnit, measureUnit);
    const allocations = [];
    const alerts = [];
    const stockDeductions = [];
    let remaining = requestedQty;

    if (maxQty > 0 && requestedQty > maxQty) {
      alerts.push(this.createAlert({
        access,
        branchId: draft.branch_id,
        productId: product.id,
        draftId: draft.id,
        invoiceId: draft.invoice_id,
        alertType: "recipe_overuse",
        severity: "high",
        title: `${product.name} usage above recipe range`,
        message: `Entered ${requestedQty} ${measureUnit}; max allowed is ${maxQty} ${measureUnit}.`,
        evidence: { requestedQty, maxQty, serviceName: draft.service_name || "" }
      }));
    }

    while (remaining > 0) {
      const container = this.activeOrOpenContainer({ access, branchId: draft.branch_id, product, stockUnit, measureUnit, capacityQty, draftId: draft.id });
      const take = Math.min(remaining, number(container.balanceQty, 0));
      const balanceAfter = money(number(container.balanceQty, 0) - take);
      const usedAfter = money(number(container.usedQty, 0) + take);
      const usage = this.insertUsage({
        access,
        draft,
        line,
        product,
        container,
        usedQty: take,
        unit: measureUnit,
        productCost: money(take * unitCost),
        balanceAfter
      });

      db.prepare(`
        UPDATE backbar_product_containers
        SET usedQty = ?, balanceQty = ?, updatedBy = ?, updatedAt = ?
        WHERE id = ? AND tenant_id = ?
      `).run(usedAfter, balanceAfter, access.userId || "", now(), container.id, access.tenantId);

      allocations.push({ containerId: container.id, containerNo: container.containerNo, productId: product.id, usedQty: take, unit: measureUnit, balanceAfter, usage });

      if (balanceAfter <= 0) {
        const deduction = consumeStockUnit({
          productId: product.id,
          branchId: draft.branch_id,
          quantity: 1,
          unit: stockUnit,
          type: "backbar-container-finished",
          reason: `${product.name} ${stockUnit} #${container.containerNo} fully consumed from product consume ledger`,
          referenceType: "product_consume_container",
          referenceId: container.id,
          unitCost: stockUnitCost(product, line)
        });
        const transactionId = deduction?.deductions?.[0]?.transaction?.id || "";
        db.prepare(`
          UPDATE backbar_product_containers
          SET status = 'finished', balanceQty = 0, finishedAt = ?, stockTransactionId = ?, updatedBy = ?, updatedAt = ?
          WHERE id = ? AND tenant_id = ?
        `).run(now(), transactionId, access.userId || "", now(), container.id, access.tenantId);
        stockDeductions.push(deduction);
        alerts.push(this.createAlert({
          access,
          branchId: draft.branch_id,
          productId: product.id,
          containerId: container.id,
          draftId: draft.id,
          invoiceId: draft.invoice_id,
          alertType: "container_finished",
          severity: "info",
          title: `${product.name} ${stockUnit} #${container.containerNo} finished`,
          message: `Full ${capacityQty} ${measureUnit} consumed; 1 ${stockUnit} deducted from stock.`,
          evidence: { containerNo: container.containerNo, capacityQty, measureUnit, stockUnit }
        }));
      } else if (capacityQty > 0 && (balanceAfter / capacityQty) * 100 <= LOW_BALANCE_PCT) {
        alerts.push(this.createAlert({
          access,
          branchId: draft.branch_id,
          productId: product.id,
          containerId: container.id,
          draftId: draft.id,
          invoiceId: draft.invoice_id,
          alertType: "low_balance",
          severity: "medium",
          title: `${product.name} ${stockUnit} #${container.containerNo} low balance`,
          message: `${balanceAfter} ${measureUnit} left before the next ${stockUnit} can open.`,
          evidence: { containerNo: container.containerNo, balanceAfter, capacityQty, measureUnit }
        }));
      }

      remaining = money(remaining - take);
    }

    return { allocations, alerts, stockDeductions };
  }

  activeOrOpenContainer({ access, branchId = "", product = {}, stockUnit = "pcs", measureUnit = "ml", capacityQty = 0, draftId = "" } = {}) {
    const active = db.prepare(`
      SELECT * FROM backbar_product_containers
      WHERE tenant_id = ? AND branch_id = ? AND productId = ? AND status = 'open' AND balanceQty > 0
      ORDER BY containerNo ASC
      LIMIT 1
    `).get(access.tenantId, branchId, product.id);
    if (active) return mapContainer(active);

    const openCount = db.prepare(`
      SELECT COUNT(*) AS count FROM backbar_product_containers
      WHERE tenant_id = ? AND branch_id = ? AND productId = ? AND status = 'open'
    `).get(access.tenantId, branchId, product.id).count;
    const sealedStock = number(product.stock, 0) - number(openCount, 0);
    if (sealedStock <= 0) throw conflict(`${product.name} has no sealed ${stockUnit} available to open`);

    const nextNo = number(db.prepare(`
      SELECT MAX(containerNo) AS maxNo FROM backbar_product_containers
      WHERE tenant_id = ? AND branch_id = ? AND productId = ?
    `).get(access.tenantId, branchId, product.id).maxNo, 0) + 1;
    const id = makeId("bbpc");
    const createdAt = now();
    db.prepare(`
      INSERT INTO backbar_product_containers (
        id, tenant_id, branch_id, productId, productName, containerNo, stockUnit, measureUnit,
        capacityQty, usedQty, balanceQty, status, openedFromDraftId, openedAt, createdBy, updatedBy, createdAt, updatedAt
      ) VALUES (
        @id, @tenant_id, @branch_id, @productId, @productName, @containerNo, @stockUnit, @measureUnit,
        @capacityQty, 0, @capacityQty, 'open', @openedFromDraftId, @openedAt, @createdBy, @updatedBy, @createdAt, @updatedAt
      )
    `).run({
      id,
      tenant_id: access.tenantId,
      branch_id: branchId,
      productId: product.id,
      productName: product.name || product.id,
      containerNo: nextNo,
      stockUnit,
      measureUnit,
      capacityQty,
      openedFromDraftId: draftId,
      openedAt: createdAt,
      createdBy: access.userId || "",
      updatedBy: access.userId || "",
      createdAt,
      updatedAt: createdAt
    });
    const container = mapContainer(db.prepare("SELECT * FROM backbar_product_containers WHERE id = ? AND tenant_id = ?").get(id, access.tenantId));
    this.createAlert({
      access,
      branchId,
      productId: product.id,
      containerId: id,
      draftId,
      alertType: "container_opened",
      severity: "info",
      title: `${product.name} ${stockUnit} #${nextNo} opened`,
      message: `Opened for service consumption. ${capacityQty} ${measureUnit} available.`,
      evidence: { containerNo: nextNo, capacityQty, measureUnit, stockUnit }
    });
    return container;
  }

  insertUsage({ access = {}, draft = {}, line = {}, product = {}, container = {}, usedQty = 0, unit = "ml", productCost = 0, balanceAfter = 0 } = {}) {
    const id = makeId("bbuse");
    db.prepare(`
      INSERT INTO backbar_product_usage_entries (
        id, tenant_id, branch_id, containerId, productId, productName, draftId, invoiceId, invoiceNumber,
        serviceId, serviceName, clientId, clientName, staffId, staffName, usedQty, unit, productCost,
        usageType, reason, balanceAfter, createdBy, createdAt
      ) VALUES (
        @id, @tenant_id, @branch_id, @containerId, @productId, @productName, @draftId, @invoiceId, @invoiceNumber,
        @serviceId, @serviceName, @clientId, @clientName, @staffId, @staffName, @usedQty, @unit, @productCost,
        @usageType, @reason, @balanceAfter, @createdBy, @createdAt
      )
    `).run({
      id,
      tenant_id: access.tenantId,
      branch_id: draft.branch_id || "",
      containerId: container.id,
      productId: product.id,
      productName: product.name || line.productName || line.product_name || product.id,
      draftId: draft.id || "",
      invoiceId: draft.invoice_id || "",
      invoiceNumber: draft.invoice_number || "",
      serviceId: draft.service_id || "",
      serviceName: draft.service_name || "",
      clientId: draft.client_id || "",
      clientName: draft.client_name || "",
      staffId: draft.staff_id || "",
      staffName: draft.staff_name || "",
      usedQty,
      unit,
      productCost,
      usageType: line.usageType || line.usage_type || "client",
      reason: line.reason || "",
      balanceAfter,
      createdBy: access.userId || "",
      createdAt: now()
    });
    return mapUsage(db.prepare("SELECT * FROM backbar_product_usage_entries WHERE id = ? AND tenant_id = ?").get(id, access.tenantId));
  }

  createAlert({ access = {}, branchId = "", productId = "", containerId = "", draftId = "", invoiceId = "", alertType = "", severity = "info", title = "", message = "", evidence = {} } = {}) {
    const id = makeId("bbal");
    db.prepare(`
      INSERT INTO backbar_product_alerts (
        id, tenant_id, branch_id, productId, containerId, draftId, invoiceId, alertType,
        severity, title, message, evidenceJson, status, createdAt
      ) VALUES (
        @id, @tenant_id, @branch_id, @productId, @containerId, @draftId, @invoiceId, @alertType,
        @severity, @title, @message, @evidenceJson, 'open', @createdAt
      )
    `).run({
      id,
      tenant_id: access.tenantId,
      branch_id: branchId,
      productId,
      containerId,
      draftId,
      invoiceId,
      alertType,
      severity,
      title,
      message,
      evidenceJson: toJson(evidence),
      createdAt: now()
    });
    return mapAlert(db.prepare("SELECT * FROM backbar_product_alerts WHERE id = ? AND tenant_id = ?").get(id, access.tenantId));
  }

  ownerReport(query = {}, access = {}) {
    ensureBackbarSchema();
    const branchId = query.branchId || query.branch_id || access.requestedBranchId || access.branchId || "";
    if (branchId) assertBranch(access, branchId);
    const params = { tenant_id: access.tenantId, limit: Math.min(500, Math.max(1, number(query.limit, 100))) };
    const filters = ["tenant_id = @tenant_id"];
    if (branchId) {
      filters.push("branch_id = @branch_id");
      params.branch_id = branchId;
    }
    const where = filters.join(" AND ");
    const containers = db.prepare(`SELECT * FROM backbar_product_containers WHERE ${where} ORDER BY updatedAt DESC LIMIT @limit`).all(params).map(mapContainer);
    const entries = db.prepare(`SELECT * FROM backbar_product_usage_entries WHERE ${where} ORDER BY createdAt DESC LIMIT @limit`).all(params).map(mapUsage);
    const alerts = db.prepare(`SELECT * FROM backbar_product_alerts WHERE ${where} ORDER BY createdAt DESC LIMIT @limit`).all(params).map(mapAlert);
    const productIds = [...new Set(containers.map((container) => container.productId).filter(Boolean))];
    const products = productIds.length
      ? db.prepare(`SELECT * FROM products WHERE tenantId = ? AND id IN (${placeholders(productIds)})`).all(access.tenantId, ...productIds)
      : [];
    const productById = new Map(products.map((product) => [product.id, product]));
    const rows = productIds.map((productId) => {
      const product = productById.get(productId) || { id: productId, name: productId, stock: 0 };
      const productContainers = containers.filter((container) => container.productId === productId);
      const nonFinished = productContainers.filter((container) => container.status !== "finished");
      const productEntries = entries.filter((entry) => entry.productId === productId);
      const productAlerts = alerts.filter((alert) => alert.productId === productId);
      return {
        productId,
        productName: product.name || productId,
        stockUnit: productContainers[0]?.stockUnit || product.unit || "pcs",
        measureUnit: productContainers[0]?.measureUnit || product.packUnit || product.unit || "pcs",
        sealedStock: Math.max(0, money(number(product.stock, 0) - nonFinished.length)),
        openCount: productContainers.filter((container) => container.status === "open").length,
        pausedCount: productContainers.filter((container) => container.status === "paused_override").length,
        finishedCount: productContainers.filter((container) => container.status === "finished").length,
        totalUsedText: usageText(productEntries),
        usageCost: money(productEntries.reduce((sum, entry) => sum + number(entry.productCost, 0), 0)),
        alertCount: productAlerts.filter((alert) => alert.status === "open").length,
        lastUsedAt: productEntries[0]?.createdAt || ""
      };
    }).sort((a, b) => Number(b.alertCount || 0) - Number(a.alertCount || 0) || String(b.lastUsedAt || "").localeCompare(String(a.lastUsedAt || "")));
    return {
      branchId,
      summary: {
        trackedProducts: rows.length,
        openContainers: containers.filter((container) => container.status === "open").length,
        pausedContainers: containers.filter((container) => container.status === "paused_override").length,
        finishedContainers: containers.filter((container) => container.status === "finished").length,
        clientUsageEntries: entries.filter((entry) => entry.usageType === "client").length,
        adjustmentEntries: entries.filter((entry) => entry.usageType !== "client").length,
        openAlerts: alerts.filter((alert) => alert.status === "open").length,
        usageCost: money(entries.reduce((sum, entry) => sum + number(entry.productCost, 0), 0))
      },
      products: rows,
      containers,
      recentEntries: entries,
      alerts
    };
  }

  productReport(productId, query = {}, access = {}) {
    ensureBackbarSchema();
    const branchId = query.branchId || query.branch_id || access.requestedBranchId || "";
    const product = loadProduct(productId, access, branchId);
    const params = { tenant_id: access.tenantId, productId, limit: Math.min(500, Math.max(1, number(query.limit, 200))) };
    const filters = ["tenant_id = @tenant_id", "productId = @productId"];
    if (branchId || product.branchId) {
      params.branch_id = branchId || product.branchId;
      filters.push("branch_id = @branch_id");
    }
    const where = filters.join(" AND ");
    const containers = db.prepare(`SELECT * FROM backbar_product_containers WHERE ${where} ORDER BY containerNo ASC`).all(params).map(mapContainer);
    const entries = db.prepare(`SELECT * FROM backbar_product_usage_entries WHERE ${where} ORDER BY createdAt DESC LIMIT @limit`).all(params).map(mapUsage);
    const alerts = db.prepare(`SELECT * FROM backbar_product_alerts WHERE ${where} ORDER BY createdAt DESC LIMIT @limit`).all(params).map(mapAlert);
    const nonFinished = containers.filter((container) => container.status !== "finished");
    return {
      productId,
      productName: product.name || productId,
      stockUnit: containers[0]?.stockUnit || product.unit || "pcs",
      measureUnit: containers[0]?.measureUnit || product.packUnit || product.unit || "pcs",
      capacityQty: containers[0]?.capacityQty || number(product.packSize, 0),
      summary: {
        productStock: number(product.stock, 0),
        sealedStock: Math.max(0, money(number(product.stock, 0) - nonFinished.length)),
        openContainers: containers.filter((container) => container.status === "open").length,
        pausedContainers: containers.filter((container) => container.status === "paused_override").length,
        finishedContainers: containers.filter((container) => container.status === "finished").length,
        totalUsedText: usageText(entries),
        usageCost: money(entries.reduce((sum, entry) => sum + number(entry.productCost, 0), 0)),
        openAlerts: alerts.filter((alert) => alert.status === "open").length
      },
      containers: containers.map((container) => ({
        ...container,
        entries: entries.filter((entry) => entry.containerId === container.id)
      })),
      entries,
      alerts
    };
  }

  adjustContainer(containerId, payload = {}, access = {}, consumeStockUnit) {
    ensureBackbarSchema();
    const container = db.prepare("SELECT * FROM backbar_product_containers WHERE id = ? AND tenant_id = ?").get(containerId, access.tenantId);
    if (!container) throw notFound("Backbar container not found");
    if (container.branch_id) assertBranch(access, container.branch_id);
    if (container.status === "finished") throw conflict("Finished container cannot be adjusted");
    const product = loadProduct(container.productId, access, container.branch_id || "");
    const usedQty = convertMeasureQty(payload.quantity ?? payload.usedQty, payload.unit || container.measureUnit, container.measureUnit);
    if (usedQty <= 0) throw conflict("Adjustment quantity must be above 0");
    if (usedQty > number(container.balanceQty, 0)) throw conflict("Adjustment quantity is higher than container balance");
    const usageType = String(payload.usageType || payload.reasonType || "manual_adjustment").trim() || "manual_adjustment";
    const balanceAfter = money(number(container.balanceQty, 0) - usedQty);
    const unitCost = number(product.unitCost, 0) && number(container.capacityQty, 0) ? money(number(product.unitCost, 0) / number(container.capacityQty, 0)) : 0;
    const entry = this.insertUsage({
      access,
      draft: {
        id: payload.draftId || "",
        branch_id: container.branch_id || "",
        invoice_id: payload.invoiceId || "",
        invoice_number: payload.invoiceNumber || "",
        service_id: "",
        service_name: usageType,
        client_id: "",
        client_name: "",
        staff_id: payload.staffId || "",
        staff_name: payload.staffName || ""
      },
      line: { usageType, reason: payload.reason || payload.notes || usageType },
      product,
      container,
      usedQty,
      unit: container.measureUnit,
      productCost: money(usedQty * unitCost),
      balanceAfter
    });
    db.prepare(`
      UPDATE backbar_product_containers
      SET usedQty = ?, balanceQty = ?, updatedBy = ?, updatedAt = ?
      WHERE id = ? AND tenant_id = ?
    `).run(money(number(container.usedQty, 0) + usedQty), balanceAfter, access.userId || "", now(), container.id, access.tenantId);
    const alerts = [this.createAlert({
      access,
      branchId: container.branch_id || "",
      productId: product.id,
      containerId: container.id,
      alertType: usageType,
      severity: ["expired", "damaged", "spillage"].includes(usageType) ? "high" : "medium",
      title: `${product.name} ${usageType.replace(/_/g, " ")}`,
      message: `${usedQty} ${container.measureUnit} adjusted. ${balanceAfter} ${container.measureUnit} left.`,
      evidence: { usedQty, balanceAfter, reason: payload.reason || payload.notes || "" }
    })];
    let deduction = null;
    if (balanceAfter <= 0) {
      deduction = consumeStockUnit({
        productId: product.id,
        branchId: container.branch_id,
        quantity: 1,
        unit: container.stockUnit,
        type: "backbar-container-adjusted-finished",
        reason: `${product.name} ${container.stockUnit} #${container.containerNo} finished by ${usageType}`,
        referenceType: "backbar_adjustment",
        referenceId: container.id,
        unitCost: number(product.unitCost, 0)
      });
      const transactionId = deduction?.deductions?.[0]?.transaction?.id || "";
      db.prepare(`
        UPDATE backbar_product_containers
        SET status = 'finished', balanceQty = 0, finishedAt = ?, stockTransactionId = ?, updatedBy = ?, updatedAt = ?
        WHERE id = ? AND tenant_id = ?
      `).run(now(), transactionId, access.userId || "", now(), container.id, access.tenantId);
    }
    return { container: mapContainer(db.prepare("SELECT * FROM backbar_product_containers WHERE id = ? AND tenant_id = ?").get(container.id, access.tenantId)), entry, alerts, deduction };
  }

  overrideOpenContainer(productId, payload = {}, access = {}) {
    ensureBackbarSchema();
    const branchId = payload.branchId || payload.branch_id || access.requestedBranchId || access.branchId || "";
    if (!branchId) throw conflict("branchId is required for override open");
    assertBranch(access, branchId);
    const reason = String(payload.reason || "").trim();
    if (!reason) throw conflict("Manager override reason is required");
    const product = loadProduct(productId, access, branchId);
    const units = productUnits(product, payload);
    const active = db.prepare(`
      SELECT * FROM backbar_product_containers
      WHERE tenant_id = ? AND branch_id = ? AND productId = ? AND status = 'open' AND balanceQty > 0
      ORDER BY containerNo ASC
      LIMIT 1
    `).get(access.tenantId, branchId, productId);
    if (active) {
      db.prepare(`
        UPDATE backbar_product_containers
        SET status = 'paused_override', updatedBy = ?, updatedAt = ?
        WHERE id = ? AND tenant_id = ?
      `).run(access.userId || "", now(), active.id, access.tenantId);
      this.createAlert({
        access,
        branchId,
        productId,
        containerId: active.id,
        alertType: "manager_override_pause",
        severity: "high",
        title: `${product.name} container #${active.containerNo} paused by override`,
        message: `${money(active.balanceQty)} ${active.measureUnit} still left. Reason required before next container opened.`,
        evidence: { reason, balanceQty: active.balanceQty, measureUnit: active.measureUnit }
      });
    }
    const container = this.activeOrOpenContainer({
      access,
      branchId,
      product,
      stockUnit: units.stockUnit,
      measureUnit: units.measureUnit,
      capacityQty: units.capacityQty,
      draftId: payload.draftId || ""
    });
    const alert = this.createAlert({
      access,
      branchId,
      productId,
      containerId: container.id,
      alertType: "manager_override_open",
      severity: "high",
      title: `${product.name} ${container.stockUnit} #${container.containerNo} opened by manager override`,
      message: reason,
      evidence: { reason, previousContainerId: active?.id || "" }
    });
    return { container, alert };
  }

  draftLedger(draftId, access) {
    ensureBackbarSchema();
    const draft = loadDraft(draftId, access);
    const lines = parseLineItems(draft);
    const productIds = [...new Set(lines.map((line) => line.productId || line.product_id).filter(Boolean))];
    if (!productIds.length) {
      return { draftId, products: [], alerts: [], entries: [] };
    }
    const productSql = placeholders(productIds);
    const products = db.prepare(`SELECT * FROM products WHERE tenantId = ? AND id IN (${productSql})`).all(access.tenantId, ...productIds);
    const containers = db.prepare(`
      SELECT * FROM backbar_product_containers
      WHERE tenant_id = ? AND branch_id = ? AND productId IN (${productSql})
      ORDER BY productId ASC, containerNo ASC
    `).all(access.tenantId, draft.branch_id || "", ...productIds).map(mapContainer);
    const entries = db.prepare(`
      SELECT * FROM backbar_product_usage_entries
      WHERE tenant_id = ? AND branch_id = ? AND productId IN (${productSql})
      ORDER BY createdAt DESC
      LIMIT 150
    `).all(access.tenantId, draft.branch_id || "", ...productIds).map(mapUsage);
    const alerts = db.prepare(`
      SELECT * FROM backbar_product_alerts
      WHERE tenant_id = ? AND branch_id = ? AND productId IN (${productSql})
      ORDER BY createdAt DESC
      LIMIT 50
    `).all(access.tenantId, draft.branch_id || "", ...productIds).map(mapAlert);
    const byProduct = new Map(products.map((product) => [product.id, product]));
    const lineByProduct = new Map(lines.map((line) => [line.productId || line.product_id, line]));

    const summaries = productIds.map((productId) => {
      const product = byProduct.get(productId) || { id: productId, name: productId };
      const line = lineByProduct.get(productId) || {};
      const { stockUnit, measureUnit, capacityQty } = productUnits(product, line);
      const productContainers = containers.filter((container) => container.productId === productId);
      const openContainers = productContainers.filter((container) => container.status === "open");
      const nonFinishedContainers = productContainers.filter((container) => container.status !== "finished");
      const productEntries = entries.filter((entry) => entry.productId === productId);
      const productAlerts = alerts.filter((alert) => alert.productId === productId);
      const sealedStock = Math.max(0, money(number(product.stock, 0) - nonFinishedContainers.length));
      const activeContainer = openContainers[0] || null;
      const computedAlerts = [];
      if (activeContainer && sealedStock > 0) {
        computedAlerts.push({
          alertType: "next_container_blocked",
          severity: "info",
          title: "Next container locked",
          message: `${product.name || productId} ${stockUnit} #${activeContainer.containerNo} must reach 0 before another ${stockUnit} opens.`
        });
      }
      return {
        productId,
        productName: product.name || productId,
        branchId: draft.branch_id || "",
        stockUnit,
        measureUnit,
        capacityQty,
        productStock: number(product.stock, 0),
        sealedStock,
        openCount: openContainers.length,
        pausedCount: productContainers.filter((container) => container.status === "paused_override").length,
        finishedCount: productContainers.filter((container) => container.status === "finished").length,
        activeContainer,
        containers: productContainers.map((container) => ({
          ...container,
          entries: productEntries.filter((entry) => entry.containerId === container.id).slice(0, 12)
        })),
        entries: productEntries,
        alerts: [...computedAlerts, ...productAlerts]
      };
    });

    return { draftId, invoiceId: draft.invoice_id || "", invoiceNumber: draft.invoice_number || "", products: summaries, alerts, entries };
  }
}

export const backbarProductConsumptionService = new BackbarProductConsumptionService();
