import { applyInventoryDelta, db } from "../db.js";
import { repositories } from "../repositories/repository-registry.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { assertBranch, auditDecision, camel, emitEvent, makeId, now, number, parseJson, requireManager, toJson } from "./enterprise-command-utils.js";
import { intelligentInventoryService } from "./intelligent-inventory.service.js";
import { tenantService } from "./tenant.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const RECIPE_UNITS = new Set(["ml", "gm", "g", "pcs", "tube", "pack", "box", "nos"]);
const CONSUMABLE_TYPES = new Set(["consumable", "both"]);
const OVERUSE_TOLERANCE_PCT = 15;
const DEFAULT_USAGE_MODIFIERS = [
  { key: "short", label: "Short hair", multiplier: 1 },
  { key: "medium", label: "Medium hair", multiplier: 1.5 },
  { key: "long", label: "Long hair", multiplier: 2 }
];
const DEFAULT_RECIPE_TEMPLATES = [
  { key: "hair-color", name: "Hair color recipe", category: "Hair Color", items: ["color tube", "developer", "gloves"] },
  { key: "keratin", name: "Keratin recipe", category: "Keratin", items: ["keratin cream", "clarifying shampoo", "mask"] },
  { key: "facial", name: "Facial recipe", category: "Facial", items: ["cleanser", "scrub", "mask", "serum"] },
  { key: "waxing", name: "Waxing recipe", category: "Waxing", items: ["wax", "strips", "pre/post wax"] }
];

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {}, "");
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function insertSnake(table, payload) {
  const row = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  const keys = Object.keys(row);
  db.prepare(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map((key) => `@${key}`).join(", ")})`).run(row);
  return db.prepare(`SELECT * FROM ${table} WHERE id = ? AND tenant_id = ?`).get(row.id, row.tenant_id);
}

function updateSnake(table, id, access, payload) {
  const row = {
    ...payload,
    updated_at: now()
  };
  const keys = Object.keys(row).filter((key) => row[key] !== undefined && key !== "id" && key !== "created_at");
  if (!keys.length) return getSnake(table, id, access);
  db.prepare(`UPDATE ${table} SET ${keys.map((key) => `${key} = @${key}`).join(", ")} WHERE id = @id AND tenant_id = @tenant_id`)
    .run({ ...row, id, tenant_id: access.tenantId });
  return getSnake(table, id, access);
}

function getSnake(table, id, access) {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND tenant_id = ?`).get(id, access.tenantId);
  if (!row) throw notFound("Record not found");
  return row;
}

function listSnake(table, access, query = {}, { orderBy = "created_at DESC", limit = 250 } = {}) {
  const params = { tenant_id: access.tenantId, limit: number(query.limit, limit) };
  const where = ["tenant_id = @tenant_id"];
  const branchId = query.branchId || query.branch_id || "";
  if (branchId) {
    assertBranch(access, branchId);
    where.push("branch_id = @branch_id");
    params.branch_id = branchId;
  }
  if (query.status) {
    where.push("status = @status");
    params.status = query.status;
  }
  if (query.q) {
    where.push("(id LIKE @q OR notes LIKE @q)");
    params.q = `%${query.q}%`;
  }
  return db.prepare(`SELECT * FROM ${table} WHERE ${where.join(" AND ")} ORDER BY ${orderBy} LIMIT @limit`).all(params).map(camel);
}

function requireProduct(productId, access, branchId = "") {
  const product = repositories.products.getById(productId, scope(access));
  if (!product) throw notFound("Product not found");
  if (branchId && product.branchId && product.branchId !== branchId) {
    throw conflict("Product does not belong to selected branch");
  }
  if (product.branchId) tenantService.assertBranchAccess(access, product.branchId);
  return product;
}

function requireService(serviceId, access) {
  const service = repositories.services.getById(serviceId, scope(access));
  if (!service) throw notFound("Service not found");
  return service;
}

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") return parseJson(value, []);
  return [];
}

function safeRecipeUnit(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return RECIPE_UNITS.has(normalized) ? normalized : "pcs";
}

function safeProductType(product = {}) {
  const usage = String(product.usageType || product.usage_type || "").trim().toLowerCase();
  return usage || "retail";
}

function usageModifierFromPayload(payload = {}, recipe = {}) {
  const modifiers = safeArray(payload.usageModifiers || payload.usage_modifiers || recipe.usage_modifiers_json);
  const selectedKey = String(payload.usageModifierKey || payload.usage_modifier_key || payload.clientHairLength || payload.client_hair_length || "standard").toLowerCase();
  const selected = [...modifiers, ...DEFAULT_USAGE_MODIFIERS].find((item) => String(item.key || item.id || "").toLowerCase() === selectedKey);
  const multiplier = Math.max(0.1, number(payload.usageModifierMultiplier ?? payload.usage_modifier_multiplier ?? selected?.multiplier ?? 1, 1));
  return { key: selectedKey, multiplier };
}

function pct(part, whole) {
  return whole ? money((Number(part || 0) / Number(whole || 1)) * 100) : 0;
}

function activeRecipeForService(serviceId, branchId, access) {
  return db.prepare(`
    SELECT * FROM service_recipes
    WHERE tenant_id = ? AND service_id = ? AND active = 1 AND approval_status = 'approved' AND (branch_id = ? OR branch_id = '')
    ORDER BY CASE WHEN branch_id = ? THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 1
  `).get(access.tenantId, serviceId, branchId, branchId);
}

function activeBranchId(payload = {}, access = {}) {
  return payload.branchId || payload.branch_id || access.requestedBranchId || access.branchId || "";
}

function poNumber(access) {
  const year = new Date().getFullYear();
  const count = db.prepare("SELECT COUNT(*) count FROM purchase_orders WHERE tenant_id = ?").get(access.tenantId).count;
  return `PO-${year}-${String(count + 1).padStart(5, "0")}`;
}

function safePoUnit(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return RECIPE_UNITS.has(normalized) ? normalized : "pcs";
}

function safeText(value = "") {
  return String(value || "").trim();
}

function poTaxSplit(gstAmount, interstate = false) {
  if (interstate) {
    return { cgstAmount: 0, sgstAmount: 0, igstAmount: money(gstAmount) };
  }
  const half = money(gstAmount / 2);
  return { cgstAmount: half, sgstAmount: money(gstAmount - half), igstAmount: 0 };
}

function poLineCalculations({ requestedQty, unitCost, discountPercent = 0, discountAmount, gstPercent = 18, interstate = false }) {
  const grossAmount = money(number(requestedQty) * number(unitCost));
  const percentageDiscount = money(grossAmount * number(discountPercent) / 100);
  const finalDiscount = money(discountAmount === undefined || discountAmount === null || discountAmount === "" ? percentageDiscount : number(discountAmount));
  const taxableAmount = money(Math.max(0, grossAmount - finalDiscount));
  const gstAmount = money(taxableAmount * number(gstPercent, 18) / 100);
  const split = poTaxSplit(gstAmount, interstate);
  return {
    grossAmount,
    discountAmount: finalDiscount,
    taxableAmount,
    gstAmount,
    ...split,
    lineTotal: money(taxableAmount + gstAmount)
  };
}

function poTotals(items = [], roundOff = 0) {
  const subtotalAmount = money(items.reduce((sum, item) => sum + number(item.grossAmount ?? item.unitCost * item.requestedQty), 0));
  const discountAmount = money(items.reduce((sum, item) => sum + number(item.discountAmount), 0));
  const taxableAmount = money(items.reduce((sum, item) => sum + number(item.taxableAmount), 0));
  const gstAmount = money(items.reduce((sum, item) => sum + number(item.gstAmount), 0));
  const cgstAmount = money(items.reduce((sum, item) => sum + number(item.cgstAmount), 0));
  const sgstAmount = money(items.reduce((sum, item) => sum + number(item.sgstAmount), 0));
  const igstAmount = money(items.reduce((sum, item) => sum + number(item.igstAmount), 0));
  const rounded = money(roundOff);
  const grandTotal = money(taxableAmount + gstAmount + rounded);
  return { subtotalAmount, discountAmount, taxableAmount, gstAmount, cgstAmount, sgstAmount, igstAmount, roundOff: rounded, grandTotal };
}

function statusEvent(status, access, note = "") {
  return {
    status,
    at: now(),
    by: access.userId || access.role || "system",
    note: safeText(note)
  };
}

function appendStatusHistory(row, access, status, note = "") {
  const history = safeArray(row.status_history_json || row.statusHistoryJson || row.statusHistory);
  return [...history, statusEvent(status, access, note)];
}

function supplierDetails(supplierId, access) {
  if (!supplierId) return null;
  const supplier = repositories.suppliers.getById(supplierId, scope(access));
  if (!supplier) return null;
  return {
    id: supplier.id,
    name: supplier.name || "",
    gstin: supplier.gstin || "",
    phone: supplier.phone || "",
    email: supplier.email || "",
    address: supplier.address || "",
    contactName: supplier.contactName || "",
    preferredPaymentTerms: supplier.preferredPaymentTerms || "",
    leadTimeDays: number(supplier.leadTimeDays, 0)
  };
}

function poWarnings(po = {}, items = [], supplier = null) {
  const warnings = [];
  const status = po.status || "draft";
  if (status === "draft") warnings.push({ type: "approval_pending", severity: "medium", message: "Owner approval is required before supplier ordering." });
  if (!po.expected_delivery_date && !po.expectedDeliveryDate) warnings.push({ type: "delivery_date_missing", severity: "low", message: "Expected delivery date is missing." });
  const expectedDelivery = po.expected_delivery_date || po.expectedDeliveryDate || "";
  if (expectedDelivery && expectedDelivery < now().slice(0, 10) && !["closed", "cancelled", "rejected"].includes(status)) {
    warnings.push({ type: "late_delivery", severity: "high", message: `Expected delivery ${expectedDelivery} is overdue.` });
  }
  if (!supplier) warnings.push({ type: "supplier_missing", severity: "medium", message: "Supplier is not linked." });
  const total = number(po.grand_total ?? po.grandTotal ?? po.total_estimated_cost ?? po.totalEstimatedCost, 0);
  if (total >= 10000 && po.approval_status !== "approved" && po.approvalStatus !== "approved") {
    warnings.push({ type: "owner_threshold", severity: "high", message: "PO value is above ₹10,000; owner approval should be mandatory." });
  }
  for (const item of items) {
    const requested = number(item.requested_qty ?? item.requestedQty, 0);
    const received = number(item.received_qty ?? item.receivedQty, 0);
    if (received > requested) warnings.push({ type: "excess_receive", severity: "high", message: `${item.product_name || item.productName || "Item"} received more than ordered.` });
    if (number(item.damaged_qty ?? item.damagedQty, 0) > 0) warnings.push({ type: "damage", severity: "high", message: `${item.product_name || item.productName || "Item"} has damaged quantity.` });
    if (!item.hsn_sac && !item.hsnSac) warnings.push({ type: "hsn_missing", severity: "low", message: `${item.product_name || item.productName || "Item"} HSN/SAC is missing.` });
  }
  return warnings;
}

function normalizeMatchText(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function lastPurchaseForProduct(productId, supplierId, access) {
  if (!productId) return null;
  const params = { tenant_id: access.tenantId, product_id: productId, supplier_id: supplierId || "" };
  const supplierFilter = supplierId ? "AND supplierId = @supplier_id" : "";
  const row = db.prepare(`SELECT * FROM inventory_batches
    WHERE tenantId = @tenant_id AND productId = @product_id ${supplierFilter}
    ORDER BY createdAt DESC LIMIT 1`).get(params);
  if (!row) return null;
  return {
    batchId: row.id,
    batchNumber: row.batchNumber || "",
    rate: money(row.unitCost),
    quantityReceived: number(row.quantityReceived),
    purchasedAt: row.createdAt || "",
    supplierId: row.supplierId || ""
  };
}

function inventoryImpactForItems(items = [], access) {
  const lines = items.map((item) => {
    const product = repositories.products.getById(item.product_id || item.productId, scope(access));
    const pendingQty = Math.max(0, number(item.requested_qty ?? item.requestedQty) - number(item.received_qty ?? item.receivedQty));
    const currentStock = number(product?.stock, 0);
    const afterReceiveStock = money(currentStock + pendingQty);
    const lowStockThreshold = number(product?.lowStockThreshold, 0);
    const expiryDate = item.expiry_date || item.expiryDate || "";
    const expiryRisk = expiryDate && expiryDate <= new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString().slice(0, 10);
    return {
      productId: item.product_id || item.productId,
      productName: item.product_name || item.productName || product?.name || "",
      pendingQty,
      currentStock,
      afterReceiveStock,
      lowStockThreshold,
      lowStockCleared: currentStock <= lowStockThreshold && afterReceiveStock > lowStockThreshold,
      expiryRisk: Boolean(expiryRisk),
      expiryDate
    };
  });
  return {
    totalReceiveQty: money(lines.reduce((sum, item) => sum + item.pendingQty, 0)),
    lowStockClearedCount: lines.filter((item) => item.lowStockCleared).length,
    expiryRiskCount: lines.filter((item) => item.expiryRisk).length,
    lines
  };
}

function normalizePoItems(payload, access, branchId) {
  const items = Array.isArray(payload.items) && payload.items.length
    ? payload.items
    : [{
        productId: payload.productId,
        product_id: payload.product_id,
        quantity: payload.quantity,
        requestedQty: payload.requestedQty,
        unitCost: payload.unitCost,
        estimatedCost: payload.estimatedCost,
        mrp: payload.mrp,
        hsnSac: payload.hsnSac,
        unit: payload.unit,
        discountPercent: payload.discountPercent,
        discountAmount: payload.discountAmount,
        gstPercent: payload.gstPercent,
        batchNumber: payload.batchNumber,
        expiryDate: payload.expiryDate
      }];

  return items.map((item) => {
    const productId = item.productId || item.product_id;
    if (!productId) throw badRequest("productId is required for purchase order item");
    const product = requireProduct(productId, access, branchId);
    const requestedQty = Math.max(0, number(item.requestedQty ?? item.quantity, 0));
    if (!requestedQty) throw badRequest("Purchase order item quantity must be greater than zero");
    const unitCost = money(item.rate ?? item.unitCost ?? item.unit_cost ?? product.unitCost ?? (number(item.estimatedCost, 0) / requestedQty));
    const gstPercent = number(item.gstPercent ?? item.gst_percent ?? product.gstRate, 18);
    const calc = poLineCalculations({
      requestedQty,
      unitCost,
      discountPercent: item.discountPercent ?? item.discount_percent,
      discountAmount: item.discountAmount ?? item.discount_amount,
      gstPercent,
      interstate: Boolean(item.interstate)
    });
    return {
      product,
      productId,
      productName: product.name || item.productName || productId,
      hsnSac: safeText(item.hsnSac || item.hsn_sac || product.hsnSac || product.hsn || ""),
      unit: safePoUnit(item.unit || item.purchaseUnit || item.purchase_unit || product.unit || "pcs"),
      mrp: money(item.mrp ?? product.price ?? 0),
      gstPercent,
      requestedQty,
      unitCost,
      discountPercent: number(item.discountPercent ?? item.discount_percent, 0),
      discountAmount: calc.discountAmount,
      taxableAmount: calc.taxableAmount,
      gstAmount: calc.gstAmount,
      cgstAmount: calc.cgstAmount,
      sgstAmount: calc.sgstAmount,
      igstAmount: calc.igstAmount,
      lineTotal: calc.lineTotal,
      grossAmount: calc.grossAmount,
      estimatedTotal: calc.lineTotal,
      batchNumber: item.batchNumber || "",
      expiryDate: item.expiryDate || ""
    };
  });
}

function supplierPhone(supplierId, access) {
  if (!supplierId) return "";
  return repositories.suppliers.getById(supplierId, scope(access))?.phone || "";
}

function productSortByRisk(a, b) {
  const aGap = number(a.lowStockThreshold) - number(a.stock);
  const bGap = number(b.lowStockThreshold) - number(b.stock);
  return bGap - aGap;
}

export class InventoryEnterpriseService {
  listPurchaseOrders(query = {}, access) {
    const params = { tenant_id: access.tenantId, limit: number(query.limit, 250) };
    const where = ["tenant_id = @tenant_id"];
    const branchId = query.branchId || query.branch_id || "";
    if (branchId) {
      assertBranch(access, branchId);
      where.push("branch_id = @branch_id");
      params.branch_id = branchId;
    }
    if (query.status) {
      where.push("status = @status");
      params.status = query.status;
    }
    if (query.q) {
      where.push("(po_number LIKE @q OR notes LIKE @q)");
      params.q = `%${query.q}%`;
    }
    return db.prepare(`SELECT * FROM purchase_orders WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT @limit`)
      .all(params)
      .map((row) => this.withPurchaseItems(row, access));
  }

  getPurchaseOrder(id, access) {
    return this.withPurchaseItems(getSnake("purchase_orders", id, access), access);
  }

  withPurchaseItems(row, access) {
    const items = db.prepare("SELECT * FROM purchase_order_items WHERE tenant_id = ? AND purchase_order_id = ? ORDER BY created_at ASC").all(access.tenantId, row.id);
    const supplier = supplierDetails(row.supplier_id, access);
    const enrichedItems = items.map((item) => ({
      ...camel(item),
      variances: safeArray(item.variance_json),
      lastPurchase: lastPurchaseForProduct(item.product_id, row.supplier_id, access)
    }));
    const warnings = [
      ...safeArray(row.variance_json),
      ...poWarnings(row, items, supplier)
    ];
    const whatsappHistory = db.prepare("SELECT * FROM supplier_whatsapp_queue WHERE tenant_id = ? AND purchase_order_id = ? ORDER BY created_at DESC LIMIT 20")
      .all(access.tenantId, row.id)
      .map(camel);
    const receiveHistory = safeArray(row.status_history_json)
      .filter((event) => ["partial_receive", "closed"].includes(event.status))
      .map((event) => ({
        ...event,
        grnNumber: row.grn_number || "",
        grnDate: row.grn_date || "",
        supplierInvoiceNo: row.supplier_invoice_no || "",
        challanNo: row.challan_no || "",
        receivedBy: row.received_by || ""
      }));
    return {
      ...camel(row),
      supplier,
      statusHistory: safeArray(row.status_history_json),
      receiveHistory,
      whatsappHistory,
      approval: {
        status: row.approval_status || "not_requested",
        approvedBy: row.approved_by || "",
        approvedAt: row.approved_at || "",
        note: row.approval_note || "",
        ownerThresholdRequired: number(row.grand_total || row.total_estimated_cost) >= 10000
      },
      inventoryImpact: inventoryImpactForItems(items, access),
      billMatches: this.purchaseOrderBillMatches(row.id, access).slice(0, 5),
      variances: warnings,
      warnings,
      items: enrichedItems
    };
  }

  purchaseOrderBillMatches(id, access) {
    const po = getSnake("purchase_orders", id, access);
    assertBranch(access, po.branch_id);
    const poItems = db.prepare("SELECT * FROM purchase_order_items WHERE tenant_id = ? AND purchase_order_id = ?").all(access.tenantId, id);
    const rows = db.prepare(`SELECT * FROM purchase_bill_drafts
      WHERE tenant_id = ? AND branch_id = ? AND status IN ('draft', 'ready', 'confirmed')
      ORDER BY updated_at DESC LIMIT 100`).all(access.tenantId, po.branch_id);
    return rows
      .map((draft) => this.scoreBillDraftAgainstPo(draft, po, poItems, access))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  scoreBillDraftAgainstPo(draft, po, poItems, access) {
    const draftItems = db.prepare("SELECT * FROM purchase_bill_draft_items WHERE tenant_id = ? AND draft_id = ? ORDER BY line_no ASC").all(access.tenantId, draft.id);
    let score = 0;
    const headerWarnings = [];
    if (draft.purchase_order_id === po.id) score += 50;
    if (draft.supplier_id && draft.supplier_id === po.supplier_id) score += 25;
    if (draft.supplier_gstin && po.supplier_id) {
      const supplier = supplierDetails(po.supplier_id, access);
      if (supplier?.gstin && normalizeMatchText(supplier.gstin) === normalizeMatchText(draft.supplier_gstin)) score += 20;
    }
    const itemMatches = draftItems.map((billItem) => {
      const billProductId = billItem.product_id || billItem.matched_product_id;
      const billName = normalizeMatchText(billItem.product_name || billItem.raw_name);
      const poItem = poItems.find((item) => billProductId && item.product_id === billProductId)
        || poItems.find((item) => billName && normalizeMatchText(item.product_name).includes(billName))
        || poItems.find((item) => billName && billName.includes(normalizeMatchText(item.product_name)));
      if (!poItem) {
        return {
          billItemId: billItem.id,
          productName: billItem.product_name || billItem.raw_name || "Bill item",
          status: "not_ordered",
          orderedQty: 0,
          billedQty: number(billItem.stock_qty || billItem.qty),
          receivedQty: 0,
          warnings: [{ type: "not_ordered", severity: "high", message: "Bill item is not present in this PO." }]
        };
      }
      score += 10;
      const orderedQty = number(poItem.requested_qty);
      const billedQty = number(billItem.stock_qty || billItem.qty);
      const receivedQty = number(poItem.received_qty);
      const warnings = [];
      if (Math.abs(orderedQty - billedQty) > 0.01) warnings.push({ type: "qty_variance", severity: "medium", message: `Ordered ${orderedQty}, billed ${billedQty}.` });
      if (Math.abs(number(poItem.unit_cost) - number(billItem.unit_cost)) > 0.01) warnings.push({ type: "rate_variance", severity: "high", message: `PO rate ₹${money(poItem.unit_cost)}, bill rate ₹${money(billItem.unit_cost)}.` });
      if (Math.abs(number(poItem.gst_percent, 18) - number(billItem.gst_percent, 18)) > 0.01) warnings.push({ type: "gst_variance", severity: "high", message: `PO GST ${number(poItem.gst_percent, 18)}%, bill GST ${number(billItem.gst_percent, 18)}%.` });
      if (Math.abs(number(poItem.discount_percent) - number(billItem.discount_percent)) > 0.01) warnings.push({ type: "discount_variance", severity: "medium", message: `PO discount ${number(poItem.discount_percent)}%, bill discount ${number(billItem.discount_percent)}%.` });
      return {
        billItemId: billItem.id,
        poItemId: poItem.id,
        productId: poItem.product_id,
        productName: poItem.product_name || billItem.product_name || billItem.raw_name,
        status: warnings.length ? "variance" : "matched",
        orderedQty,
        billedQty,
        receivedQty,
        poRate: number(poItem.unit_cost),
        billRate: number(billItem.unit_cost),
        poGstPercent: number(poItem.gst_percent, 18),
        billGstPercent: number(billItem.gst_percent, 18),
        warnings
      };
    });
    if (draftItems.length && itemMatches.some((item) => item.poItemId)) score += 20;
    const poTotal = number(po.grand_total || po.total_estimated_cost);
    const billTotal = number(draft.total_amount);
    if (poTotal && billTotal && Math.abs(poTotal - billTotal) > 1) {
      headerWarnings.push({ type: "total_variance", severity: "medium", message: `PO total ₹${money(poTotal)}, bill total ₹${money(billTotal)}.` });
    } else if (poTotal && billTotal) {
      score += 10;
    }
    return {
      purchaseOrderId: po.id,
      purchaseOrderNumber: po.po_number || "",
      draftId: draft.id,
      billNo: draft.bill_no || "",
      billDate: draft.bill_date || "",
      supplierName: draft.supplier_name || "",
      status: draft.status || "draft",
      linked: draft.purchase_order_id === po.id,
      score,
      poTotal,
      billTotal,
      warnings: [...headerWarnings, ...itemMatches.flatMap((item) => item.warnings || [])],
      itemMatches
    };
  }

  createPurchaseOrder(payload = {}, access) {
    requireManager(access);
    const branchId = activeBranchId(payload, access);
    if (!branchId) throw badRequest("branchId is required");
    assertBranch(access, branchId);
    const normalizedItems = normalizePoItems(payload, access, branchId);
    const supplierId = payload.supplierId || payload.supplier_id || "";
    const totals = poTotals(normalizedItems, payload.roundOff ?? payload.round_off);
    const totalEstimatedCost = totals.grandTotal;
    const supplier = supplierDetails(supplierId, access);
    const result = db.transaction(() => {
      const po = insertSnake("purchase_orders", {
        id: makeId("po"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        supplier_id: supplierId,
        po_number: payload.poNumber || payload.po_number || poNumber(access),
        status: "draft",
        source_type: payload.sourceType || payload.source_type || "manual",
        recommendation_id: payload.recommendationId || payload.recommendation_id || "",
        total_estimated_cost: totalEstimatedCost,
        subtotal_amount: totals.subtotalAmount,
        discount_amount: totals.discountAmount,
        taxable_amount: totals.taxableAmount,
        gst_amount: totals.gstAmount,
        cgst_amount: totals.cgstAmount,
        sgst_amount: totals.sgstAmount,
        igst_amount: totals.igstAmount,
        round_off: totals.roundOff,
        grand_total: totals.grandTotal,
        notes: payload.notes || payload.recommendationText || payload.recommendation_text || "",
        expected_delivery_date: payload.expectedDeliveryDate || payload.expected_delivery_date || "",
        approval_note: payload.approvalNote || payload.approval_note || "",
        payment_terms: payload.paymentTerms || payload.payment_terms || supplier?.preferredPaymentTerms || "",
        delivery_terms: payload.deliveryTerms || payload.delivery_terms || "",
        variance_json: toJson([]),
        status_history_json: toJson([statusEvent("draft", access, "PO draft created")]),
        approval_status: "not_requested",
        version: 1
      });
      for (const item of normalizedItems) {
        insertSnake("purchase_order_items", {
          id: makeId("poi"),
          tenant_id: access.tenantId,
          branch_id: branchId,
          purchase_order_id: po.id,
          product_id: item.productId,
          product_name: item.productName,
          hsn_sac: item.hsnSac,
          unit: item.unit,
          mrp: item.mrp,
          discount_percent: item.discountPercent,
          discount_amount: item.discountAmount,
          gst_percent: item.gstPercent,
          taxable_amount: item.taxableAmount,
          gst_amount: item.gstAmount,
          cgst_amount: item.cgstAmount,
          sgst_amount: item.sgstAmount,
          igst_amount: item.igstAmount,
          line_total: item.lineTotal,
          requested_qty: item.requestedQty,
          received_qty: 0,
          unit_cost: item.unitCost,
          estimated_total: item.estimatedTotal,
          received_total: 0,
          variance_json: toJson([]),
          batch_number: item.batchNumber,
          expiry_date: item.expiryDate,
          status: "open",
          version: 1
        });
      }
      return this.withPurchaseItems(po, access);
    })();
    auditDecision("inventory.purchase_order_created", "purchase_order", result.id, access, { branchId, details: { itemCount: result.items.length, totalEstimatedCost } });
    emitEvent("inventory:purchase_order_created", access, branchId, result.id, { status: result.status });
    return result;
  }

  transitionPurchaseOrder(id, nextStatus, access, payload = {}) {
    requireManager(access);
    const po = getSnake("purchase_orders", id, access);
    assertBranch(access, po.branch_id);
    const allowed = {
      approved: ["draft"],
      sent: ["approved"],
      closed: ["partial_receive", "sent", "approved"],
      cancelled: ["draft", "approved", "sent"],
      rejected: ["draft", "approved"],
      reopened: ["cancelled", "rejected"]
    };
    if (!allowed[nextStatus]?.includes(po.status)) {
      throw conflict(`Purchase order cannot move from ${po.status} to ${nextStatus}`);
    }
    const patch = {
      status: nextStatus === "reopened" ? "draft" : nextStatus,
      version: number(po.version, 1) + 1
    };
    if (nextStatus === "approved") {
      patch.approval_status = "approved";
      patch.approved_by = access.userId || access.role || "system";
      patch.approved_at = now();
      patch.approval_note = payload.note || payload.approvalNote || payload.approval_note || po.approval_note || "";
    }
    if (nextStatus === "sent") patch.sent_at = now();
    if (nextStatus === "closed") patch.closed_at = now();
    if (nextStatus === "rejected") {
      patch.approval_status = "rejected";
      patch.rejection_reason = payload.reason || payload.rejectionReason || payload.rejection_reason || payload.note || "";
    }
    if (nextStatus === "cancelled") {
      patch.rejection_reason = payload.reason || payload.cancelReason || payload.cancel_reason || payload.note || "";
    }
    if (nextStatus === "reopened") {
      patch.approval_status = "not_requested";
      patch.rejection_reason = "";
      patch.closed_at = "";
    }
    patch.status_history_json = toJson(appendStatusHistory(po, access, nextStatus, payload.note || payload.reason || payload.approvalNote || ""));
    const updated = updateSnake("purchase_orders", id, access, patch);
    auditDecision(`inventory.purchase_order_${nextStatus}`, "purchase_order", id, access, { branchId: po.branch_id, details: payload });
    emitEvent(`inventory:purchase_order_${nextStatus}`, access, po.branch_id, id, { status: nextStatus });
    return this.withPurchaseItems(updated, access);
  }

  approvePurchaseOrder(id, payload = {}, access) {
    return this.transitionPurchaseOrder(id, "approved", access, payload);
  }

  sendPurchaseOrder(id, payload = {}, access) {
    const sent = this.transitionPurchaseOrder(id, "sent", access, payload);
    const queue = this.queueSupplierWhatsapp(id, payload, access);
    updateSnake("purchase_orders", id, access, { whatsapp_queue_id: queue.id });
    return { purchaseOrder: this.getPurchaseOrder(id, access), queue };
  }

  receivePurchaseOrder(id, payload = {}, access) {
    requireManager(access);
    const po = getSnake("purchase_orders", id, access);
    assertBranch(access, po.branch_id);
    if (!["approved", "sent", "partial_receive"].includes(po.status)) {
      throw conflict("Purchase order must be approved or sent before receiving stock");
    }
    const itemRows = db.prepare("SELECT * FROM purchase_order_items WHERE tenant_id = ? AND purchase_order_id = ?").all(access.tenantId, id);
    if (!itemRows.length) throw notFound("Purchase order items not found");
    const payloadItems = Array.isArray(payload.items) && payload.items.length ? payload.items : [payload];
    const received = db.transaction(() => {
      const rows = [];
      const headerVariances = safeArray(po.variance_json);
      for (const input of payloadItems) {
        const target = db.prepare("SELECT * FROM purchase_order_items WHERE tenant_id = ? AND purchase_order_id = ? AND (id = ? OR product_id = ?) LIMIT 1")
          .get(access.tenantId, id, input.itemId || input.item_id || "", input.productId || input.product_id || "")
          || itemRows.find((item) => item.id === input.itemId || item.id === input.item_id || item.product_id === (input.productId || input.product_id))
          || itemRows[0];
        const remaining = Math.max(0, number(target.requested_qty) - number(target.received_qty));
        const receiveQty = Math.max(0, number(input.quantity ?? input.receivedQty ?? input.received_qty ?? remaining, remaining));
        const damagedQty = Math.max(0, number(input.damagedQty ?? input.damaged_qty, 0));
        const acceptedQty = Math.max(0, receiveQty - damagedQty);
        const excessQty = Math.max(0, number(input.excessQty ?? input.excess_qty, Math.max(0, acceptedQty - remaining)));
        const shortQty = Math.max(0, number(input.shortQty ?? input.short_qty, Math.max(0, remaining - acceptedQty)));
        if (!acceptedQty && !damagedQty && !shortQty) continue;
        const product = requireProduct(target.product_id, access, po.branch_id);
        const unitCost = money(input.unitCost ?? input.unit_cost ?? target.unit_cost ?? product.unitCost ?? 0);
        const gstPercent = number(input.gstPercent ?? input.gst_percent ?? target.gst_percent ?? product.gstRate, 18);
        const receiveCalc = poLineCalculations({
          requestedQty: acceptedQty,
          unitCost,
          discountPercent: input.discountPercent ?? input.discount_percent ?? target.discount_percent,
          gstPercent
        });
        const batchNumber = input.batchNumber || input.batch_number || target.batch_number || `PO-${po.po_number}-${target.id.slice(-4)}`;
        const expiryDate = input.expiryDate || input.expiry_date || target.expiry_date || "";
        let entry = null;
        if (acceptedQty > 0) {
          entry = intelligentInventoryService.purchaseEntry({
            productId: target.product_id,
            branchId: po.branch_id,
            supplierId: po.supplier_id,
            batchNumber,
            expiryDate,
            quantity: acceptedQty,
            unitCost,
            reason: `Purchase order ${po.po_number} receive`
          }, access);
        }
        const nextReceivedQty = number(target.received_qty) + acceptedQty;
        const itemStatus = nextReceivedQty >= number(target.requested_qty) ? "received" : "partial";
        const itemVariances = safeArray(target.variance_json);
        const addVariance = (type, severity, message, extra = {}) => {
          const variance = { type, severity, message, at: now(), ...extra };
          itemVariances.push(variance);
          headerVariances.push({ itemId: target.id, productId: target.product_id, ...variance });
        };
        if (damagedQty > 0) addVariance("damaged_qty", "high", `${product.name} has ${damagedQty} damaged ${target.unit || "pcs"}.`, { damagedQty });
        if (shortQty > 0) addVariance("short_qty", "medium", `${product.name} is short by ${shortQty} ${target.unit || "pcs"}.`, { shortQty });
        if (excessQty > 0) addVariance("excess_qty", "medium", `${product.name} has ${excessQty} excess ${target.unit || "pcs"}.`, { excessQty });
        if (Math.abs(unitCost - number(target.unit_cost)) > 0.01) addVariance("rate_changed", "high", `${product.name} received rate differs from PO rate.`, { orderedRate: number(target.unit_cost), receivedRate: unitCost });
        if (Math.abs(gstPercent - number(target.gst_percent, 18)) > 0.01) addVariance("gst_changed", "high", `${product.name} received GST differs from PO GST.`, { orderedGst: number(target.gst_percent, 18), receivedGst: gstPercent });
        db.prepare(`UPDATE purchase_order_items
          SET received_qty = ?, received_total = ?, received_taxable_amount = ?, received_gst_amount = ?,
              unit_cost = ?, gst_percent = ?, batch_number = ?, expiry_date = ?, damaged_qty = ?, short_qty = ?, excess_qty = ?,
              variance_json = ?, status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND tenant_id = ?`).run(
          nextReceivedQty,
          money(number(target.received_total) + receiveCalc.lineTotal),
          money(number(target.received_taxable_amount) + receiveCalc.taxableAmount),
          money(number(target.received_gst_amount) + receiveCalc.gstAmount),
          unitCost,
          gstPercent,
          batchNumber,
          expiryDate,
          money(number(target.damaged_qty) + damagedQty),
          money(number(target.short_qty) + shortQty),
          money(number(target.excess_qty) + excessQty),
          toJson(itemVariances),
          itemStatus,
          target.id,
          access.tenantId
        );
        rows.push({ itemId: target.id, productId: target.product_id, quantity: acceptedQty, damagedQty, shortQty, excessQty, entry });
      }
      const currentItems = db.prepare("SELECT * FROM purchase_order_items WHERE tenant_id = ? AND purchase_order_id = ?").all(access.tenantId, id);
      const isClosed = currentItems.every((item) => number(item.received_qty) >= number(item.requested_qty));
      const totalReceived = money(currentItems.reduce((sum, item) => sum + number(item.received_total), 0));
      const nextStatus = isClosed ? "closed" : "partial_receive";
      updateSnake("purchase_orders", id, access, {
        status: nextStatus,
        total_received_cost: totalReceived,
        supplier_invoice_no: payload.supplierInvoiceNo || payload.supplier_invoice_no || po.supplier_invoice_no || "",
        supplier_invoice_date: payload.supplierInvoiceDate || payload.supplier_invoice_date || po.supplier_invoice_date || "",
        challan_no: payload.challanNo || payload.challan_no || po.challan_no || "",
        grn_number: payload.grnNumber || payload.grn_number || po.grn_number || `GRN-${po.po_number}-${String(Date.now()).slice(-6)}`,
        grn_date: payload.grnDate || payload.grn_date || po.grn_date || now().slice(0, 10),
        received_by: payload.receivedBy || payload.received_by || access.userId || access.role || "",
        variance_json: toJson(headerVariances),
        status_history_json: toJson(appendStatusHistory(po, access, nextStatus, payload.note || payload.receiveNote || "Goods received")),
        closed_at: isClosed ? now() : po.closed_at,
        version: number(po.version, 1) + 1
      });
      return rows;
    })();
    auditDecision("inventory.purchase_order_received", "purchase_order", id, access, { branchId: po.branch_id, details: { receivedCount: received.length } });
    emitEvent("inventory:purchase_order_received", access, po.branch_id, id, { receivedCount: received.length });
    return { purchaseOrder: this.getPurchaseOrder(id, access), received };
  }

  closePurchaseOrder(id, payload = {}, access) {
    return this.transitionPurchaseOrder(id, "closed", access, payload);
  }

  cancelPurchaseOrder(id, payload = {}, access) {
    return this.transitionPurchaseOrder(id, "cancelled", access, payload);
  }

  rejectPurchaseOrder(id, payload = {}, access) {
    return this.transitionPurchaseOrder(id, "rejected", access, payload);
  }

  reopenPurchaseOrder(id, payload = {}, access) {
    return this.transitionPurchaseOrder(id, "reopened", access, payload);
  }

  listServiceRecipes(query = {}, access) {
    const params = { tenant_id: access.tenantId, limit: number(query.limit, 500) };
    const where = ["tenant_id = @tenant_id"];
    const branchId = query.branchId || query.branch_id || "";
    if (branchId) {
      assertBranch(access, branchId);
      where.push("(branch_id = @branch_id OR branch_id = '')");
      params.branch_id = branchId;
    }
    const rows = db.prepare(`SELECT * FROM service_recipes WHERE ${where.join(" AND ")} ORDER BY updated_at DESC LIMIT @limit`).all(params).map(camel);
    return rows.map((recipe) => ({
      ...recipe,
      usageModifiers: parseJson(recipe.usageModifiersJson || recipe.usage_modifiers_json, DEFAULT_USAGE_MODIFIERS),
      substitutePolicy: parseJson(recipe.substitutePolicyJson || recipe.substitute_policy_json, {}),
      aiSuggestion: parseJson(recipe.aiSuggestionJson || recipe.ai_suggestion_json, {}),
      items: db.prepare("SELECT * FROM service_recipe_items WHERE tenant_id = ? AND recipe_id = ? ORDER BY sort_order ASC, created_at ASC").all(access.tenantId, recipe.id).map((row) => ({
        ...camel(row),
        allowedSubstitutes: parseJson(row.allowed_substitutes_json, [])
      }))
    }));
  }

  saveServiceRecipe(payload = {}, access) {
    requireManager(access);
    const serviceId = payload.serviceId || payload.service_id;
    if (!serviceId) throw badRequest("serviceId is required");
    const branchId = activeBranchId(payload, access);
    if (branchId) assertBranch(access, branchId);
    const service = requireService(serviceId, access);
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) throw badRequest("At least one recipe product is required");
    const result = db.transaction(() => {
      const existing = db.prepare("SELECT * FROM service_recipes WHERE tenant_id = ? AND branch_id = ? AND service_id = ?").get(access.tenantId, branchId, serviceId);
      const expectedCost = money(items.reduce((sum, item) => {
        const product = requireProduct(item.productId || item.product_id, access, item.branchId || item.branch_id || branchId || undefined);
        const quantity = number(item.quantityPerService ?? item.quantity_per_service ?? item.quantity, 0);
        const wastageMultiplier = 1 + number(item.wastagePct ?? item.wastage_pct, 0) / 100;
        return sum + quantity * wastageMultiplier * number(item.unitCost ?? item.unit_cost ?? product.unitCost, 0);
      }, 0));
      const servicePrice = money(payload.servicePrice ?? payload.service_price ?? service.price ?? 0);
      const expectedMargin = money(servicePrice - expectedCost);
      const expectedMarginPct = pct(expectedMargin, servicePrice);
      const approvalStatus = payload.approvalStatus || payload.approval_status || existing?.approval_status || "approved";
      const approvedAt = approvalStatus === "approved" ? (payload.approvedAt || payload.approved_at || existing?.approved_at || now()) : "";
      const usageModifiers = payload.usageModifiers || payload.usage_modifiers || DEFAULT_USAGE_MODIFIERS;
      const recipeSnapshotItems = [];
      const recipe = existing
        ? updateSnake("service_recipes", existing.id, access, {
            recipe_name: payload.recipeName || payload.recipe_name || service.name,
            service_name: service.name,
            service_category: payload.serviceCategory || payload.service_category || service.category || "",
            service_price: servicePrice,
            expected_cost: expectedCost,
            expected_margin: expectedMargin,
            expected_margin_pct: expectedMarginPct,
            margin_floor_pct: number(payload.marginFloorPct ?? payload.margin_floor_pct ?? existing.margin_floor_pct, 0),
            approval_status: approvalStatus,
            approved_by: approvalStatus === "approved" ? (payload.approvedBy || payload.approved_by || access.userId || existing.approved_by || "") : "",
            approved_at: approvedAt,
            submitted_by: approvalStatus !== "approved" ? (payload.submittedBy || payload.submitted_by || access.userId || "") : existing.submitted_by,
            submitted_at: approvalStatus !== "approved" ? now() : existing.submitted_at,
            usage_modifiers_json: toJson(usageModifiers),
            substitute_policy_json: toJson(payload.substitutePolicy || payload.substitute_policy || {}),
            ai_suggestion_json: toJson(payload.aiSuggestion || payload.ai_suggestion || {}),
            version_note: payload.versionNote || payload.version_note || "",
            active: payload.active === false ? 0 : 1,
            notes: payload.notes || existing.notes || "",
            version: number(existing.version, 1) + 1
          })
        : insertSnake("service_recipes", {
            id: makeId("recipe"),
            tenant_id: access.tenantId,
            branch_id: branchId,
            service_id: serviceId,
            service_name: service.name,
            service_category: payload.serviceCategory || payload.service_category || service.category || "",
            recipe_name: payload.recipeName || payload.recipe_name || service.name,
            service_price: servicePrice,
            expected_cost: expectedCost,
            expected_margin: expectedMargin,
            expected_margin_pct: expectedMarginPct,
            margin_floor_pct: number(payload.marginFloorPct ?? payload.margin_floor_pct, 0),
            approval_status: approvalStatus,
            approved_by: approvalStatus === "approved" ? (payload.approvedBy || payload.approved_by || access.userId || "") : "",
            approved_at: approvedAt,
            submitted_by: approvalStatus !== "approved" ? (payload.submittedBy || payload.submitted_by || access.userId || "") : "",
            submitted_at: approvalStatus !== "approved" ? now() : "",
            usage_modifiers_json: toJson(usageModifiers),
            substitute_policy_json: toJson(payload.substitutePolicy || payload.substitute_policy || {}),
            ai_suggestion_json: toJson(payload.aiSuggestion || payload.ai_suggestion || {}),
            version_note: payload.versionNote || payload.version_note || "",
            active: payload.active === false ? 0 : 1,
            notes: payload.notes || "",
            version: 1
          });
      db.prepare("DELETE FROM service_recipe_items WHERE tenant_id = ? AND recipe_id = ?").run(access.tenantId, recipe.id);
      items.forEach((item, index) => {
        const product = requireProduct(item.productId || item.product_id, access);
        const productType = safeProductType(product);
        if (String(payload.enforceConsumableFilter ?? "true") !== "false" && productType === "retail") {
          throw conflict(`${product.name} is retail-only. Mark it consumable or both before using it in a service recipe.`);
        }
        const quantity = number(item.quantityPerService ?? item.quantity_per_service ?? item.quantity, 0);
        if (quantity <= 0) throw badRequest("Recipe quantity must be greater than zero");
        const unit = safeRecipeUnit(item.unit || item.stockUnit || item.stock_unit || product.unit || "pcs");
        const row = {
          id: makeId("recipeitem"),
          tenant_id: access.tenantId,
          branch_id: branchId,
          recipe_id: recipe.id,
          service_id: serviceId,
          product_id: product.id,
          product_name: product.name,
          product_type: productType,
          quantity_per_service: quantity,
          unit,
          min_quantity_per_service: number(item.minQuantityPerService ?? item.min_quantity_per_service, 0),
          max_quantity_per_service: number(item.maxQuantityPerService ?? item.max_quantity_per_service, 0),
          unit_cost: number(item.unitCost ?? item.unit_cost ?? product.unitCost, 0),
          wastage_pct: number(item.wastagePct ?? item.wastage_pct, 0),
          required: item.required === false ? 0 : 1,
          sort_order: number(item.sortOrder ?? item.sort_order, index),
          allowed_substitutes_json: toJson(item.allowedSubstitutes || item.allowed_substitutes || []),
          actual_tracking_mode: item.actualTrackingMode || item.actual_tracking_mode || "expected",
          ai_confidence: number(item.aiConfidence ?? item.ai_confidence, 0),
          notes: item.notes || ""
        };
        insertSnake("service_recipe_items", {
          ...row
        });
        recipeSnapshotItems.push(row);
      });
      repositories.services.update(serviceId, {
        requiredProducts: recipeSnapshotItems.map((item) => ({
          productId: item.product_id,
          quantity: item.quantity_per_service,
          unit: item.unit,
          wastagePct: item.wastage_pct,
          unitCost: item.unit_cost,
          productName: item.product_name
        }))
      }, scope(access));
      this.writeRecipeVersion(recipe.id, recipe.service_id, branchId, number(recipe.version, 1), approvalStatus, payload.versionNote || payload.version_note || "Recipe saved", access);
      return this.listServiceRecipes({ branchId, limit: 1 }, access).find((row) => row.id === recipe.id) || { ...camel(recipe), items: [] };
    })();
    auditDecision("inventory.service_recipe_saved", "service_recipe", result.id, access, { branchId, details: { serviceId, itemCount: result.items.length } });
    emitEvent("inventory:service_recipe_saved", access, branchId, result.id, { serviceId });
    return result;
  }

  submitServiceRecipeForApproval(id, payload = {}, access) {
    requireManager(access);
    const recipe = getSnake("service_recipes", id, access);
    if (recipe.branch_id) assertBranch(access, recipe.branch_id);
    const updated = updateSnake("service_recipes", id, access, {
      approval_status: "pending_approval",
      submitted_by: access.userId || "",
      submitted_at: now(),
      version_note: payload.note || payload.versionNote || "Submitted for owner approval",
      version: number(recipe.version, 1) + 1
    });
    this.writeRecipeVersion(id, recipe.service_id, recipe.branch_id, updated.version, "pending_approval", payload.note || "Submitted for approval", access);
    return this.listServiceRecipes({ branchId: recipe.branch_id, limit: 500 }, access).find((row) => row.id === id) || camel(updated);
  }

  approveServiceRecipe(id, payload = {}, access) {
    requireManager(access);
    const recipe = getSnake("service_recipes", id, access);
    if (recipe.branch_id) assertBranch(access, recipe.branch_id);
    const status = payload.approved === false ? "rejected" : "approved";
    const updated = updateSnake("service_recipes", id, access, {
      approval_status: status,
      approved_by: status === "approved" ? access.userId || payload.approvedBy || "" : recipe.approved_by,
      approved_at: status === "approved" ? now() : recipe.approved_at,
      version_note: payload.note || (status === "approved" ? "Recipe approved" : "Recipe rejected"),
      version: number(recipe.version, 1) + 1
    });
    this.writeRecipeVersion(id, recipe.service_id, recipe.branch_id, updated.version, status, payload.note || status, access);
    return this.listServiceRecipes({ branchId: recipe.branch_id, limit: 500 }, access).find((row) => row.id === id) || camel(updated);
  }

  writeRecipeVersion(recipeId, serviceId, branchId, version, approvalStatus, note, access) {
    const recipe = db.prepare("SELECT * FROM service_recipes WHERE tenant_id = ? AND id = ?").get(access.tenantId, recipeId);
    const items = db.prepare("SELECT * FROM service_recipe_items WHERE tenant_id = ? AND recipe_id = ? ORDER BY sort_order ASC, created_at ASC").all(access.tenantId, recipeId);
    insertSnake("service_recipe_versions", {
      id: makeId("recipever"),
      tenant_id: access.tenantId,
      branch_id: branchId || "",
      recipe_id: recipeId,
      service_id: serviceId,
      version: number(version, 1),
      action: "saved",
      approval_status: approvalStatus || "approved",
      changed_by: access.userId || access.role || "",
      change_note: note || "",
      snapshot_json: toJson({ recipe, items })
    });
  }

  listServiceRecipeUsage(query = {}, access) {
    const branchId = query.branchId || query.branch_id || access.requestedBranchId || "";
    const params = { tenant_id: access.tenantId, limit: number(query.limit, 100) };
    const where = ["tenant_id = @tenant_id"];
    if (branchId) {
      assertBranch(access, branchId);
      where.push("branch_id = @branch_id");
      params.branch_id = branchId;
    }
    if (query.serviceId || query.service_id) {
      where.push("service_id = @service_id");
      params.service_id = query.serviceId || query.service_id;
    }
    const rows = db.prepare(`SELECT * FROM service_recipe_usage_logs WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT @limit`).all(params);
    return rows.map((row) => ({
      ...camel(row),
      items: db.prepare("SELECT * FROM service_recipe_usage_items WHERE tenant_id = ? AND usage_log_id = ? ORDER BY created_at ASC").all(access.tenantId, row.id).map(camel)
    }));
  }

  listServiceRecipeAlerts(query = {}, access) {
    const branchId = query.branchId || query.branch_id || access.requestedBranchId || "";
    const params = { tenant_id: access.tenantId, limit: number(query.limit, 100) };
    const where = ["tenant_id = @tenant_id"];
    if (branchId) {
      assertBranch(access, branchId);
      where.push("branch_id = @branch_id");
      params.branch_id = branchId;
    }
    if (query.status) {
      where.push("status = @status");
      params.status = query.status;
    }
    return db.prepare(`SELECT * FROM service_recipe_alerts WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT @limit`).all(params).map(camel);
  }

  serviceRecipeTemplates(query = {}, access) {
    this.ensureServiceRecipeTemplates(access);
    const category = String(query.serviceCategory || query.service_category || "").trim().toLowerCase();
    return db.prepare(`SELECT * FROM service_recipe_templates
      WHERE tenant_id = ? AND active = 1 AND (? = '' OR LOWER(service_category) = ?)
      ORDER BY template_name ASC`).all(access.tenantId, category, category).map(camel);
  }

  serviceRecipeDashboard(query = {}, access) {
    const branchId = activeBranchId(query, access);
    if (branchId) assertBranch(access, branchId);
    this.ensureServiceRecipeTemplates(access);
    const recipes = this.listServiceRecipes({ branchId, limit: 500 }, access);
    const services = repositories.services.list({ limit: 10000 }, scope(access)).filter((service) => String(service.status || "active") === "active");
    const products = repositories.products.list(branchId ? { branchId, limit: 10000 } : { limit: 10000 }, scope(access, branchId));
    const productById = new Map(products.map((product) => [product.id, product]));
    const recipeKey = (serviceId) => recipes.find((recipe) => recipe.serviceId === serviceId && (recipe.branchId === branchId || !recipe.branchId));
    const missingRecipes = services
      .filter((service) => !recipeKey(service.id))
      .map((service) => ({
        serviceId: service.id,
        serviceName: service.name,
        category: service.category,
        estimatedCost: money(number(service.price, 0) * 0.05),
        severity: safeArray(service.requiredProducts).length ? "high" : "medium"
      }));
    for (const missing of missingRecipes.slice(0, 20)) {
      this.upsertRecipeAlert({
        branchId: branchId || access.requestedBranchId || "",
        serviceId: missing.serviceId,
        alertType: "missing_recipe",
        severity: missing.severity,
        title: "Recipe missing",
        message: `${missing.serviceName} is active but has no approved service BOM.`,
        evidence: missing
      }, access);
    }
    const upcomingDemand = this.upcomingRecipeDemand(branchId, recipes, access, productById);
    const usageRows = this.listServiceRecipeUsage({ branchId, limit: 100 }, access);
    const overuseRows = usageRows.filter((row) => Number(row.overuseFlag || 0) > 0);
    const marginRows = recipes.map((recipe) => {
      const service = services.find((item) => item.id === recipe.serviceId) || {};
      const servicePrice = money(recipe.servicePrice || service.price || 0);
      const expectedCost = money(recipe.expectedCost || 0);
      const expectedMargin = money(servicePrice - expectedCost);
      return {
        recipeId: recipe.id,
        serviceId: recipe.serviceId,
        serviceName: recipe.serviceName,
        servicePrice,
        expectedCost,
        expectedMargin,
        expectedMarginPct: pct(expectedMargin, servicePrice),
        marginFloorPct: number(recipe.marginFloorPct, 0),
        weakMargin: servicePrice > 0 && pct(expectedMargin, servicePrice) < number(recipe.marginFloorPct, 0)
      };
    });
    const aiSuggestions = [
      ...missingRecipes.slice(0, 5).map((row) => ({
        type: "recipe_missing",
        title: "Create service BOM",
        message: `${row.serviceName} needs a recipe before exact professional stock deduction can be trusted.`,
        serviceId: row.serviceId
      })),
      ...upcomingDemand.lowStockForecast.slice(0, 5).map((row) => ({
        type: "reorder_forecast",
        title: "Upcoming appointments need stock",
        message: `${row.productName} needs ${row.requiredQty} ${row.unit} in next 15 days; current stock is ${row.currentStock}.`,
        productId: row.productId
      })),
      ...marginRows.filter((row) => row.weakMargin).slice(0, 5).map((row) => ({
        type: "price_correction",
        title: "Service margin below floor",
        message: `${row.serviceName} margin is ${row.expectedMarginPct}%. Review recipe cost or service price.`,
        serviceId: row.serviceId
      }))
    ];
    return {
      branchId,
      metrics: {
        configuredRecipes: recipes.length,
        missingRecipes: missingRecipes.length,
        overuseAlerts: overuseRows.length,
        lowStockForecast: upcomingDemand.lowStockForecast.length,
        averageMarginPct: money(marginRows.reduce((sum, row) => sum + row.expectedMarginPct, 0) / Math.max(1, marginRows.length))
      },
      missingRecipes,
      lowStockForecast: upcomingDemand.lowStockForecast,
      upcomingDemand: upcomingDemand.rows,
      usageVariance: usageRows.slice(0, 20),
      marginRows,
      aiSuggestions,
      templates: this.serviceRecipeTemplates({}, access)
    };
  }

  upcomingRecipeDemand(branchId, recipes, access, productById = new Map()) {
    const today = now().slice(0, 10);
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 15);
    const end = horizon.toISOString().slice(0, 10);
    const appointments = repositories.appointments.list(branchId ? { branchId, limit: 10000 } : { limit: 10000 }, scope(access, branchId))
      .filter((appointment) => {
        const day = String(appointment.startAt || "").slice(0, 10);
        return day >= today && day <= end && !["cancelled", "no-show", "completed"].includes(String(appointment.status || "").toLowerCase());
      });
    const demand = new Map();
    for (const appointment of appointments) {
      for (const serviceId of safeArray(appointment.serviceIds)) {
        const recipe = recipes.find((item) => item.serviceId === serviceId && (item.branchId === appointment.branchId || !item.branchId));
        if (!recipe) continue;
        for (const item of recipe.items || []) {
          const key = item.productId;
          const quantity = money(number(item.quantityPerService, 0) * (1 + number(item.wastagePct, 0) / 100));
          const row = demand.get(key) || {
            productId: key,
            productName: item.productName,
            unit: item.unit || "pcs",
            requiredQty: 0,
            appointmentCount: 0,
            currentStock: number(productById.get(key)?.stock, 0),
            lowStockThreshold: number(productById.get(key)?.lowStockThreshold, 0)
          };
          row.requiredQty = money(row.requiredQty + quantity);
          row.appointmentCount += 1;
          demand.set(key, row);
        }
      }
    }
    const rows = [...demand.values()].sort((a, b) => b.requiredQty - a.requiredQty);
    const lowStockForecast = rows.filter((row) => row.currentStock - row.requiredQty <= row.lowStockThreshold);
    for (const row of lowStockForecast.slice(0, 20)) {
      this.upsertRecipeAlert({
        branchId: branchId || access.requestedBranchId || "",
        productId: row.productId,
        alertType: "low_stock_forecast",
        severity: row.currentStock < row.requiredQty ? "high" : "medium",
        title: "Low stock forecast",
        message: `${row.productName} may run low based on upcoming service recipes.`,
        evidence: row
      }, access);
    }
    return { rows, lowStockForecast };
  }

  ensureServiceRecipeTemplates(access) {
    const existing = db.prepare("SELECT COUNT(*) AS count FROM service_recipe_templates WHERE tenant_id = ?").get(access.tenantId).count;
    if (existing) return;
    for (const template of DEFAULT_RECIPE_TEMPLATES) {
      insertSnake("service_recipe_templates", {
        id: makeId("rectpl"),
        tenant_id: access.tenantId,
        template_key: template.key,
        template_name: template.name,
        service_category: template.category,
        usage_modifiers_json: toJson(DEFAULT_USAGE_MODIFIERS),
        items_json: toJson(template.items),
        ai_suggestion_json: toJson({ providerReady: true, confidence: 0.72 }),
        active: 1
      });
    }
  }

  upsertRecipeAlert({ branchId = "", serviceId = "", productId = "", alertType, severity = "medium", title = "", message = "", evidence = {} }, access) {
    if (!branchId || !alertType) return null;
    const existing = db.prepare(`SELECT id FROM service_recipe_alerts
      WHERE tenant_id = ? AND branch_id = ? AND service_id = ? AND product_id = ? AND alert_type = ? AND status = 'open'
      LIMIT 1`).get(access.tenantId, branchId, serviceId, productId, alertType);
    if (existing) {
      return updateSnake("service_recipe_alerts", existing.id, access, {
        severity,
        title,
        message,
        evidence_json: toJson(evidence)
      });
    }
    return insertSnake("service_recipe_alerts", {
      id: makeId("recalert"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      service_id: serviceId,
      product_id: productId,
      alert_type: alertType,
      severity,
      title,
      message,
      evidence_json: toJson(evidence),
      status: "open"
    });
  }

  consumeProductFifo(payload = {}, access) {
    const productId = payload.productId || payload.product_id;
    const branchId = activeBranchId(payload, access);
    const quantity = Math.abs(number(payload.quantity, 0));
    if (!productId || !branchId || !quantity) throw badRequest("productId, branchId and quantity are required");
    assertBranch(access, branchId);
    const product = requireProduct(productId, access, branchId);
    if (number(product.stock) < quantity) throw conflict(`${product.name} stock is not enough for FIFO deduction`);
    const batches = db.prepare(`
      SELECT * FROM inventory_batches
      WHERE tenantId = ? AND productId = ? AND branchId = ? AND quantityAvailable > 0
      ORDER BY CASE WHEN expiryDate IS NULL OR expiryDate = '' THEN 1 ELSE 0 END, expiryDate ASC, createdAt ASC
    `).all(access.tenantId, productId, branchId);
    let remaining = quantity;
    const deductions = [];
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, number(batch.quantityAvailable));
      const nextAvailable = money(number(batch.quantityAvailable) - take);
      db.prepare("UPDATE inventory_batches SET quantityAvailable = ?, status = ?, updatedAt = ? WHERE id = ? AND tenantId = ?").run(
        nextAvailable,
        nextAvailable <= 0 ? "depleted" : batch.status || "active",
        now(),
        batch.id,
        access.tenantId
      );
      const unitCost = number(payload.unitCost ?? payload.unit_cost ?? batch.unitCost ?? product.unitCost, 0);
      const transaction = applyInventoryDelta({
        productId,
        branchId,
        batchId: batch.id,
        supplierId: batch.supplierId || "",
        quantity: -take,
        unitCost,
        totalCost: -money(take * unitCost),
        type: payload.type || "sale-deduction",
        reason: payload.reason || "FIFO stock deduction",
        referenceType: payload.referenceType || payload.reference_type || "inventory",
        referenceId: payload.referenceId || payload.reference_id || "",
        tenantId: access.tenantId
      });
      deductions.push({ batchId: batch.id, quantity: take, transaction });
      remaining = money(remaining - take);
    }
    if (remaining > 0) {
      const unitCost = number(payload.unitCost ?? payload.unit_cost ?? product.unitCost, 0);
      const transaction = applyInventoryDelta({
        productId,
        branchId,
        quantity: -remaining,
        unitCost,
        totalCost: -money(remaining * unitCost),
        type: payload.type || "sale-deduction",
        reason: payload.reason || "FIFO stock deduction without active batch",
        referenceType: payload.referenceType || payload.reference_type || "inventory",
        referenceId: payload.referenceId || payload.reference_id || "",
        tenantId: access.tenantId
      });
      deductions.push({ batchId: "", quantity: remaining, transaction });
    }
    return { productId, branchId, requestedQuantity: quantity, deductions };
  }

  consumeServiceRecipe(payload = {}, access) {
    const serviceId = payload.serviceId || payload.service_id;
    const branchId = activeBranchId(payload, access);
    const quantity = Math.max(1, number(payload.quantity, 1));
    if (!serviceId || !branchId) throw badRequest("serviceId and branchId are required");
    assertBranch(access, branchId);
    const recipe = activeRecipeForService(serviceId, branchId, access);
    if (!recipe) {
      this.upsertRecipeAlert({
        branchId,
        serviceId,
        alertType: "missing_recipe",
        severity: "high",
        title: "Recipe missing at service completion",
        message: "Service was completed or billed without an approved BOM recipe.",
        evidence: { referenceType: payload.referenceType || payload.reference_type || "", referenceId: payload.referenceId || payload.reference_id || "" }
      }, access);
      return { serviceId, branchId, status: "no_recipe", deductions: [], warning: "No service recipe configured" };
    }
    const items = db.prepare("SELECT * FROM service_recipe_items WHERE tenant_id = ? AND recipe_id = ?").all(access.tenantId, recipe.id);
    const modifier = usageModifierFromPayload(payload, recipe);
    const actualItems = new Map(safeArray(payload.actualItems || payload.actual_items).map((item) => [String(item.productId || item.product_id || ""), item]));
    const result = db.transaction(() => {
      const usageItems = [];
      const deductions = [];
      for (const item of items) {
        const expected = money(number(item.quantity_per_service) * quantity * modifier.multiplier * (1 + number(item.wastage_pct) / 100));
        const actualOverride = actualItems.get(item.product_id);
        const actual = money(number(actualOverride?.actualQty ?? actualOverride?.actual_qty ?? actualOverride?.quantity, expected));
        const deduction = this.consumeProductFifo({
          productId: item.product_id,
          branchId,
          quantity: actual,
          unitCost: item.unit_cost,
          type: "service-deduction",
          reason: `Service recipe ${recipe.service_name || serviceId}`,
          referenceType: payload.referenceType || payload.reference_type || "service",
          referenceId: payload.referenceId || payload.reference_id || serviceId
        }, access);
        const variancePct = expected ? money(((actual - expected) / expected) * 100) : 0;
        const overuse = variancePct > OVERUSE_TOLERANCE_PCT ? 1 : 0;
        usageItems.push({
          item,
          expected,
          actual,
          expectedCost: money(expected * number(item.unit_cost, 0)),
          actualCost: money(actual * number(item.unit_cost, 0)),
          variancePct,
          overuse,
          deduction
        });
        deductions.push(deduction);
      }
      const expectedQtyTotal = money(usageItems.reduce((sum, row) => sum + row.expected, 0));
      const actualQtyTotal = money(usageItems.reduce((sum, row) => sum + row.actual, 0));
      const expectedCost = money(usageItems.reduce((sum, row) => sum + row.expectedCost, 0));
      const actualCost = money(usageItems.reduce((sum, row) => sum + row.actualCost, 0));
      const variancePct = expectedQtyTotal ? money(((actualQtyTotal - expectedQtyTotal) / expectedQtyTotal) * 100) : 0;
      const overuseFlag = usageItems.some((row) => row.overuse) ? 1 : 0;
      const aiFlags = [];
      if (overuseFlag) aiFlags.push({ type: "overuse", message: `Actual usage exceeded expected by ${variancePct}%` });
      if (actualCost > number(recipe.expected_cost, 0) * 1.15) aiFlags.push({ type: "cost_overrun", message: "Service product cost is above recipe expectation" });
      const log = insertSnake("service_recipe_usage_logs", {
        id: makeId("recuse"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        service_id: serviceId,
        service_name: recipe.service_name || "",
        recipe_id: recipe.id,
        reference_type: payload.referenceType || payload.reference_type || "service",
        reference_id: payload.referenceId || payload.reference_id || serviceId,
        staff_id: payload.staffId || payload.staff_id || "",
        client_id: payload.clientId || payload.client_id || "",
        service_quantity: quantity,
        usage_modifier_key: modifier.key,
        usage_modifier_multiplier: modifier.multiplier,
        expected_qty_total: expectedQtyTotal,
        actual_qty_total: actualQtyTotal,
        expected_cost: expectedCost,
        actual_cost: actualCost,
        variance_pct: variancePct,
        overuse_flag: overuseFlag,
        status: "deducted",
        ai_flags_json: toJson(aiFlags)
      });
      for (const row of usageItems) {
        insertSnake("service_recipe_usage_items", {
          id: makeId("recuseitem"),
          tenant_id: access.tenantId,
          usage_log_id: log.id,
          branch_id: branchId,
          service_id: serviceId,
          recipe_id: recipe.id,
          product_id: row.item.product_id,
          product_name: row.item.product_name,
          unit: row.item.unit || "pcs",
          expected_qty: row.expected,
          actual_qty: row.actual,
          wastage_pct: number(row.item.wastage_pct, 0),
          unit_cost: number(row.item.unit_cost, 0),
          expected_cost: row.expectedCost,
          actual_cost: row.actualCost,
          variance_pct: row.variancePct,
          overuse_flag: row.overuse,
          batch_json: toJson(row.deduction.deductions.map((part) => ({ batchId: part.batchId, quantity: part.quantity }))),
          transaction_json: toJson(row.deduction)
        });
      }
      updateSnake("service_recipes", recipe.id, access, { last_consumed_at: now() });
      if (overuseFlag) {
        this.upsertRecipeAlert({
          branchId,
          serviceId,
          alertType: "overuse",
          severity: variancePct > 40 ? "high" : "medium",
          title: "Service product overuse",
          message: `${recipe.service_name || serviceId} actual usage exceeded recipe expectation.`,
          evidence: { usageLogId: log.id, variancePct, referenceId: payload.referenceId || payload.reference_id || "" }
        }, access);
      }
      return { log: camel(log), deductions, usageItems };
    })();
    return { serviceId, branchId, recipeId: recipe.id, usageLogId: result.log.id, status: "deducted", deductions: result.deductions, usage: result.log };
  }

  listStockCounts(query = {}, access) {
    return listSnake("stock_counts", access, query, { orderBy: "created_at DESC", limit: 250 }).map((count) => ({
      ...count,
      items: db.prepare("SELECT * FROM stock_count_items WHERE tenant_id = ? AND stock_count_id = ?").all(access.tenantId, count.id).map(camel)
    }));
  }

  createStockCount(payload = {}, access) {
    requireManager(access);
    const branchId = activeBranchId(payload, access);
    if (!branchId) throw badRequest("branchId is required");
    assertBranch(access, branchId);
    const countNumber = payload.countNumber || `SC-${new Date().getFullYear()}-${String(db.prepare("SELECT COUNT(*) count FROM stock_counts WHERE tenant_id = ?").get(access.tenantId).count + 1).padStart(5, "0")}`;
    const itemInputs = Array.isArray(payload.items) && payload.items.length ? payload.items : [];
    const sourceProducts = itemInputs.length
      ? itemInputs.map((item) => requireProduct(item.productId || item.product_id, access, branchId))
      : repositories.products.list({ branchId, limit: 2000 }, scope(access, branchId));
    const count = db.transaction(() => {
      const row = insertSnake("stock_counts", {
        id: makeId("stockcount"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        count_number: countNumber,
        status: "draft",
        counted_by: payload.countedBy || payload.counted_by || access.userId || "",
        notes: payload.notes || "",
        total_variance_qty: 0,
        total_variance_value: 0,
        version: 1
      });
      let totalVarianceQty = 0;
      let totalVarianceValue = 0;
      for (const product of sourceProducts) {
        const input = itemInputs.find((item) => (item.productId || item.product_id) === product.id) || {};
        const countedQty = number(input.countedQty ?? input.counted_qty ?? input.quantity ?? product.stock, product.stock);
        const systemQty = number(product.stock);
        const varianceQty = money(countedQty - systemQty);
        const unitCost = number(input.unitCost ?? input.unit_cost ?? product.unitCost, 0);
        const varianceValue = money(varianceQty * unitCost);
        totalVarianceQty += varianceQty;
        totalVarianceValue += varianceValue;
        insertSnake("stock_count_items", {
          id: makeId("stockitem"),
          tenant_id: access.tenantId,
          branch_id: branchId,
          stock_count_id: row.id,
          product_id: product.id,
          product_name: product.name,
          system_qty: systemQty,
          counted_qty: countedQty,
          variance_qty: varianceQty,
          unit_cost: unitCost,
          variance_value: varianceValue,
          reason: input.reason || "",
          status: "open"
        });
      }
      return updateSnake("stock_counts", row.id, access, {
        total_variance_qty: money(totalVarianceQty),
        total_variance_value: money(totalVarianceValue)
      });
    })();
    auditDecision("inventory.stock_count_created", "stock_count", count.id, access, { branchId, details: { itemCount: sourceProducts.length } });
    emitEvent("inventory:stock_count_created", access, branchId, count.id);
    return this.listStockCounts({ branchId, limit: 1 }, access).find((row) => row.id === count.id) || camel(count);
  }

  submitStockCount(id, payload = {}, access) {
    requireManager(access);
    const count = getSnake("stock_counts", id, access);
    assertBranch(access, count.branch_id);
    const items = db.prepare("SELECT * FROM stock_count_items WHERE tenant_id = ? AND stock_count_id = ?").all(access.tenantId, id);
    const findings = db.transaction(() => {
      const rows = [];
      for (const item of items.filter((row) => number(row.variance_qty) !== 0)) {
        const severity = Math.abs(number(item.variance_value)) >= 1000 || Math.abs(number(item.variance_qty)) >= 5 ? "high" : "medium";
        const finding = insertSnake("stock_variance_findings", {
          id: makeId("var"),
          tenant_id: access.tenantId,
          branch_id: count.branch_id,
          stock_count_id: id,
          product_id: item.product_id,
          variance_qty: item.variance_qty,
          variance_value: item.variance_value,
          severity,
          reason: item.reason || payload.reason || "Stock count variance",
          evidence_json: toJson({ countNumber: count.count_number, systemQty: item.system_qty, countedQty: item.counted_qty }),
          status: "open"
        });
        rows.push(camel(finding));
      }
      updateSnake("stock_counts", id, access, {
        status: "submitted",
        submitted_by: access.userId || access.role || "system",
        submitted_at: now(),
        version: number(count.version, 1) + 1
      });
      return rows;
    })();
    auditDecision("inventory.stock_count_submitted", "stock_count", id, access, { branchId: count.branch_id, details: { findings: findings.length } });
    emitEvent("inventory:stock_count_submitted", access, count.branch_id, id, { findings: findings.length });
    return { stockCount: this.listStockCounts({ branchId: count.branch_id, limit: 50 }, access).find((row) => row.id === id), findings };
  }

  leakageFindings(query = {}, access) {
    return listSnake("inventory_theft_findings", access, query, { orderBy: "created_at DESC", limit: 250 });
  }

  runLeakageScan(payload = {}, access) {
    requireManager(access);
    const branchId = activeBranchId(payload, access);
    if (!branchId) throw badRequest("branchId is required");
    assertBranch(access, branchId);
    const variances = db.prepare("SELECT * FROM stock_variance_findings WHERE tenant_id = ? AND branch_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 100").all(access.tenantId, branchId);
    const wasteEvents = repositories.inventoryWasteEvents.list({ branchId, limit: 1000 }, scope(access, branchId));
    const products = repositories.products.list({ branchId, limit: 10000 }, scope(access, branchId));
    const result = db.transaction(() => {
      const rows = [];
      for (const variance of variances.filter((row) => Math.abs(number(row.variance_value)) >= 500 || Math.abs(number(row.variance_qty)) >= 3)) {
        const product = products.find((item) => item.id === variance.product_id);
        const riskScore = Math.min(100, Math.abs(number(variance.variance_value)) / 25 + Math.abs(number(variance.variance_qty)) * 8);
        rows.push(camel(insertSnake("inventory_theft_findings", {
          id: makeId("leak"),
          tenant_id: access.tenantId,
          branch_id: branchId,
          product_id: variance.product_id,
          finding_type: "stock_count_variance",
          severity: riskScore >= 70 ? "high" : "medium",
          risk_score: money(riskScore),
          estimated_loss: Math.abs(number(variance.variance_value)),
          evidence_json: toJson({ productName: product?.name || variance.product_id, varianceQty: variance.variance_qty, varianceValue: variance.variance_value }),
          recommended_action: "Recount shelf, review staff usage and compare POS/service deductions",
          status: "open"
        })));
      }
      const wasteByProduct = new Map();
      for (const waste of wasteEvents) {
        wasteByProduct.set(waste.productId, (wasteByProduct.get(waste.productId) || 0) + number(waste.costImpact));
      }
      for (const [productId, costImpact] of wasteByProduct.entries()) {
        if (costImpact < 1000) continue;
        const product = products.find((item) => item.id === productId);
        rows.push(camel(insertSnake("inventory_theft_findings", {
          id: makeId("leak"),
          tenant_id: access.tenantId,
          branch_id: branchId,
          product_id: productId,
          finding_type: "high_waste_cost",
          severity: costImpact >= 3000 ? "high" : "medium",
          risk_score: Math.min(100, costImpact / 60),
          estimated_loss: money(costImpact),
          evidence_json: toJson({ productName: product?.name || productId, wasteCost: costImpact }),
          recommended_action: "Audit usage recipe, expiry rotation and staff issue register",
          status: "open"
        })));
      }
      return rows;
    })();
    auditDecision("inventory.leakage_scan_completed", "inventory_theft_finding", branchId, access, { branchId, details: { findings: result.length } });
    emitEvent("inventory:leakage_scan_completed", access, branchId, branchId, { findings: result.length });
    return { branchId, findings: result };
  }

  transferRecommendations(query = {}, access) {
    const branchId = query.branchId || query.branch_id || "";
    if (branchId) assertBranch(access, branchId);
    const products = repositories.products.list({ limit: 10000 }, scope(access)).sort(productSortByRisk);
    const bySku = new Map();
    for (const product of products) {
      const key = product.sku || product.name;
      if (!bySku.has(key)) bySku.set(key, []);
      bySku.get(key).push(product);
    }
    const recommendations = [];
    for (const group of bySku.values()) {
      const shortage = group.filter((product) => (!branchId || product.branchId === branchId) && number(product.stock) <= number(product.lowStockThreshold));
      const overstock = group.filter((product) => number(product.stock) > number(product.lowStockThreshold) * 2);
      for (const target of shortage) {
        const source = overstock.find((product) => product.branchId !== target.branchId);
        if (!source) continue;
        const qty = Math.max(1, Math.min(number(source.stock) - number(source.lowStockThreshold), number(target.lowStockThreshold) * 2 - number(target.stock)));
        recommendations.push({
          sourceBranchId: source.branchId,
          targetBranchId: target.branchId,
          sourceProductId: source.id,
          targetProductId: target.id,
          productName: target.name,
          quantity: money(qty),
          reason: "Transfer available stock before creating a new purchase order",
          confidence: qty > 3 ? "high" : "medium"
        });
      }
    }
    return recommendations.slice(0, number(query.limit, 50));
  }

  createTransferRequest(payload = {}, access) {
    requireManager(access);
    const sourceProductId = payload.sourceProductId || payload.source_product_id || payload.productId || payload.product_id;
    const sourceBranchId = payload.sourceBranchId || payload.source_branch_id;
    const targetBranchId = payload.targetBranchId || payload.target_branch_id;
    const quantity = Math.abs(number(payload.quantity, 0));
    if (!sourceProductId || !sourceBranchId || !targetBranchId || !quantity) throw badRequest("sourceProductId, sourceBranchId, targetBranchId and quantity are required");
    assertBranch(access, sourceBranchId);
    assertBranch(access, targetBranchId);
    const sourceProduct = requireProduct(sourceProductId, access, sourceBranchId);
    const request = insertSnake("branch_transfer_requests", {
      id: makeId("transfer"),
      tenant_id: access.tenantId,
      source_branch_id: sourceBranchId,
      target_branch_id: targetBranchId,
      source_product_id: sourceProductId,
      target_product_id: payload.targetProductId || payload.target_product_id || "",
      product_name: sourceProduct.name,
      quantity,
      reason: payload.reason || "Branch transfer recommendation",
      recommendation_json: toJson(payload.recommendation || {}),
      status: "pending_approval",
      version: 1
    });
    auditDecision("inventory.branch_transfer_requested", "branch_transfer_request", request.id, access, { branchId: sourceBranchId, details: { targetBranchId, quantity } });
    emitEvent("inventory:branch_transfer_requested", access, sourceBranchId, request.id, { targetBranchId, quantity });
    return camel(request);
  }

  approveTransferRequest(id, payload = {}, access) {
    requireManager(access);
    const request = getSnake("branch_transfer_requests", id, access);
    if (request.status !== "pending_approval") throw conflict("Transfer request is not pending approval");
    assertBranch(access, request.source_branch_id);
    assertBranch(access, request.target_branch_id);
    const sourceProduct = requireProduct(request.source_product_id, access, request.source_branch_id);
    const result = db.transaction(() => {
      const deduction = this.consumeProductFifo({
        productId: request.source_product_id,
        branchId: request.source_branch_id,
        quantity: request.quantity,
        type: "transfer-out",
        reason: `Transfer to ${request.target_branch_id}`,
        referenceType: "branch-transfer",
        referenceId: id
      }, access);
      const targetProduct = request.target_product_id
        ? repositories.products.getById(request.target_product_id, scope(access))
        : repositories.products.list({ branchId: request.target_branch_id, limit: 10000 }, scope(access)).find((product) => product.sku === sourceProduct.sku);
      const target = targetProduct || repositories.products.create({
        ...sourceProduct,
        id: makeId("prod"),
        branchId: request.target_branch_id,
        stock: 0,
        createdAt: undefined,
        updatedAt: undefined
      }, scope(access, request.target_branch_id));
      const incoming = applyInventoryDelta({
        productId: target.id,
        branchId: request.target_branch_id,
        quantity: number(request.quantity),
        type: "transfer-in",
        reason: `Transfer from ${request.source_branch_id}`,
        referenceType: "branch-transfer",
        referenceId: id,
        unitCost: number(sourceProduct.unitCost, 0),
        totalCost: money(number(sourceProduct.unitCost, 0) * number(request.quantity)),
        tenantId: access.tenantId
      });
      updateSnake("branch_transfer_requests", id, access, {
        target_product_id: target.id,
        status: "approved",
        approved_by: access.userId || access.role || "system",
        approved_at: now(),
        completed_at: now(),
        version: number(request.version, 1) + 1
      });
      return { deduction, incoming, targetProduct: target };
    })();
    auditDecision("inventory.branch_transfer_approved", "branch_transfer_request", id, access, { branchId: request.source_branch_id, details: payload });
    emitEvent("inventory:branch_transfer_approved", access, request.source_branch_id, id, { targetBranchId: request.target_branch_id });
    return { request: camel(getSnake("branch_transfer_requests", id, access)), ...result };
  }

  scanBarcode(payload = {}, access) {
    const branchId = activeBranchId(payload, access);
    const code = String(payload.code || payload.barcode || payload.qr || "").trim();
    if (!branchId || !code) throw badRequest("branchId and code are required");
    assertBranch(access, branchId);
    const lowered = code.toLowerCase();
    const product = repositories.products.list({ branchId, limit: 10000 }, scope(access, branchId))
      .find((item) => [item.sku, item.barcode, item.name].some((value) => String(value || "").toLowerCase() === lowered || String(value || "").toLowerCase().includes(lowered)));
    const event = insertSnake("barcode_scan_events", {
      id: makeId("scan"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      terminal_id: payload.terminalId || payload.terminal_id || "",
      scanned_code: code,
      resolved_entity_type: product ? "product" : "",
      resolved_entity_id: product?.id || "",
      code,
      scan_type: payload.scanType || payload.scan_type || "lookup",
      matched_product_id: product?.id || "",
      result_json: toJson({ matched: Boolean(product), productName: product?.name || "", stock: product?.stock || 0 }),
      status: product ? "matched" : "unmatched"
    });
    emitEvent("inventory:barcode_scanned", access, branchId, event.id, { matched: Boolean(product) });
    return { event: camel(event), product: product || null };
  }

  inventoryReports(query = {}, access) {
    const branchId = query.branchId || query.branch_id || "";
    if (branchId) assertBranch(access, branchId);
    const branchQuery = branchId ? { branchId, limit: 10000 } : { limit: 10000 };
    const products = repositories.products.list(branchQuery, scope(access, branchId));
    const transactions = repositories.inventory.list(branchQuery, scope(access, branchId));
    const batches = repositories.inventoryBatches.list(branchQuery, scope(access, branchId));
    const suppliers = repositories.suppliers.list({ limit: 10000 }, scope(access));
    const poItems = db.prepare(`
      SELECT poi.*, po.supplier_id, po.status, po.po_number
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.purchase_order_id AND po.tenant_id = poi.tenant_id
      WHERE poi.tenant_id = ? ${branchId ? "AND poi.branch_id = ?" : ""}
    `).all(branchId ? [access.tenantId, branchId] : [access.tenantId]);
    const cogs = money(transactions.filter((tx) => number(tx.quantity) < 0).reduce((sum, tx) => sum + Math.abs(number(tx.totalCost)), 0));
    const purchaseSpend = money(transactions.filter((tx) => number(tx.quantity) > 0 && tx.type === "purchase-entry").reduce((sum, tx) => sum + number(tx.totalCost), 0));
    const stockValue = money(products.reduce((sum, product) => sum + number(product.stock) * number(product.unitCost), 0));
    const activeProductIds = new Set(transactions.filter((tx) => number(tx.quantity) < 0).map((tx) => tx.productId));
    const deadStock = products
      .filter((product) => number(product.stock) > 0 && !activeProductIds.has(product.id))
      .map((product) => ({ productId: product.id, name: product.name, stock: number(product.stock), value: money(number(product.stock) * number(product.unitCost)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 25);
    const expiring = batches
      .filter((batch) => batch.expiryDate && number(batch.quantityAvailable) > 0)
      .map((batch) => {
        const days = Math.round((new Date(batch.expiryDate).getTime() - Date.now()) / 86400000);
        const product = products.find((item) => item.id === batch.productId);
        return { batchId: batch.id, productId: batch.productId, productName: product?.name || batch.productId, expiryDate: batch.expiryDate, daysToExpiry: days, value: money(number(batch.quantityAvailable) * number(batch.unitCost)) };
      })
      .filter((item) => item.daysToExpiry <= 90)
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
      .slice(0, 50);
    const supplierSpend = suppliers.map((supplier) => {
      const spend = poItems.filter((item) => item.supplier_id === supplier.id).reduce((sum, item) => sum + number(item.estimated_total), 0);
      return { supplierId: supplier.id, name: supplier.name, spend: money(spend), openPoItems: poItems.filter((item) => item.supplier_id === supplier.id && item.status !== "received").length };
    }).filter((row) => row.spend || row.openPoItems).sort((a, b) => b.spend - a.spend);
    const metrics = {
      stockValue,
      cogs,
      purchaseSpend,
      estimatedGrossMargin: money((transactions.filter((tx) => ["sale-deduction", "service-deduction"].includes(tx.type)).length ? cogs * 1.8 : stockValue) - cogs),
      deadStockValue: money(deadStock.reduce((sum, item) => sum + item.value, 0)),
      expiryRiskValue: money(expiring.reduce((sum, item) => sum + Math.max(0, item.value), 0)),
      supplierSpend: money(supplierSpend.reduce((sum, item) => sum + item.spend, 0))
    };
    return { branchId, metrics, deadStock, expiring, supplierSpend };
  }

  createReportSnapshot(query = {}, access) {
    const report = this.inventoryReports(query, access);
    const snapshot = insertSnake("inventory_report_snapshots", {
      id: makeId("invreport"),
      tenant_id: access.tenantId,
      branch_id: report.branchId || "",
      report_type: query.reportType || query.report_type || "inventory_financial",
      period_start: query.periodStart || "",
      period_end: query.periodEnd || "",
      metrics_json: toJson(report.metrics),
      rows_json: toJson({ deadStock: report.deadStock, expiring: report.expiring, supplierSpend: report.supplierSpend })
    });
    return { snapshot: camel(snapshot), report };
  }

  queueSupplierWhatsapp(poId, payload = {}, access) {
    const po = getSnake("purchase_orders", poId, access);
    assertBranch(access, po.branch_id);
    const items = db.prepare("SELECT * FROM purchase_order_items WHERE tenant_id = ? AND purchase_order_id = ?").all(access.tenantId, poId);
    const supplier = po.supplier_id ? repositories.suppliers.getById(po.supplier_id, scope(access)) : null;
    const branch = repositories.branches.getById(po.branch_id, scope(access));
    const itemLines = items.map((item, index) => {
      const pendingQty = Math.max(0, number(item.requested_qty) - number(item.received_qty));
      const total = number(item.line_total || item.estimated_total);
      return `${index + 1}. ${item.product_name || item.product_id} | HSN ${item.hsn_sac || "-"} | Qty ${pendingQty} ${item.unit || "pcs"} | Rate ₹${money(item.unit_cost)} | GST ${number(item.gst_percent, 18)}% | Total ₹${money(total)}`;
    });
    const message = payload.message || [
      `Purchase Order: ${po.po_number}`,
      `Supplier: ${supplier?.name || "Preferred supplier"}`,
      `Delivery branch: ${branch?.name || po.branch_id}`,
      po.expected_delivery_date ? `Expected delivery: ${po.expected_delivery_date}` : "Expected delivery: please confirm",
      po.payment_terms ? `Payment terms: ${po.payment_terms}` : "",
      po.delivery_terms ? `Delivery terms: ${po.delivery_terms}` : "",
      `Grand total: ₹${money(po.grand_total || po.total_estimated_cost)}`,
      "Items:",
      ...itemLines,
      "Please confirm availability, final rate, GST, discount and delivery timeline.",
      "Manual send required from Aura Salon OS."
    ].filter(Boolean).join("\n");
    const queue = insertSnake("supplier_whatsapp_queue", {
      id: makeId("supwa"),
      tenant_id: access.tenantId,
      branch_id: po.branch_id,
      supplier_id: po.supplier_id,
      purchase_order_id: poId,
      phone: payload.phone || supplier?.phone || supplierPhone(po.supplier_id, access),
      message,
      status: "queued",
      requires_manual_send: 1,
      provider_response_json: toJson({})
    });
    auditDecision("inventory.supplier_whatsapp_queued", "supplier_whatsapp_queue", queue.id, access, { branchId: po.branch_id, details: { poId } });
    emitEvent("inventory:supplier_whatsapp_queued", access, po.branch_id, queue.id, { poId });
    return camel(queue);
  }

  supplierWhatsappQueue(query = {}, access) {
    return listSnake("supplier_whatsapp_queue", access, query, { orderBy: "created_at DESC", limit: 250 });
  }

  markSupplierWhatsappSent(id, payload = {}, access) {
    requireManager(access);
    const row = getSnake("supplier_whatsapp_queue", id, access);
    assertBranch(access, row.branch_id);
    const updated = updateSnake("supplier_whatsapp_queue", id, access, {
      status: "sent",
      sent_at: now(),
      provider_response_json: toJson(payload.providerResponse || payload.provider_response || {})
    });
    emitEvent("inventory:supplier_whatsapp_sent", access, row.branch_id, id);
    return camel(updated);
  }
}

export const inventoryEnterpriseService = new InventoryEnterpriseService();
