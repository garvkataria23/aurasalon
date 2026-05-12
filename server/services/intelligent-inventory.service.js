import { applyInventoryDelta } from "../db.js";
import { repositories } from "../repositories/repository-registry.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const pct = (value) => Math.round((Number(value) || 0) * 100) / 100;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {}, "");
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function withinPeriod(row, start, end, field = "createdAt") {
  const key = String(row[field] || "").slice(0, 10);
  return (!start || key >= start) && (!end || key <= end);
}

function daysUntil(value) {
  if (!value) return 9999;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 9999;
  return Math.round((time - Date.now()) / 86400000);
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function sum(items, selector) {
  return items.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

function defaultPeriod(input = {}) {
  const periodEnd = input.periodEnd || now().slice(0, 10);
  const date = new Date(periodEnd);
  date.setDate(date.getDate() - 59);
  return { periodStart: input.periodStart || date.toISOString().slice(0, 10), periodEnd };
}

function groupedBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

export class IntelligentInventoryService {
  context(input = {}, access) {
    tenantService.ensureSubscriptionActive(access.tenantId);
    const branchId = input.branchId || access.requestedBranchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const { periodStart, periodEnd } = defaultPeriod(input);
    const queryScope = scope(access, branchId);
    const branchQuery = branchId ? { branchId, limit: 10000 } : { limit: 10000 };
    const products = repositories.products.list(branchQuery, queryScope);
    const transactions = repositories.inventory.list(branchQuery, queryScope).filter((row) => withinPeriod(row, periodStart, periodEnd));
    const batches = repositories.inventoryBatches.list(branchQuery, queryScope);
    const wasteEvents = repositories.inventoryWasteEvents.list(branchQuery, queryScope).filter((row) => withinPeriod(row, periodStart, periodEnd));
    const suppliers = repositories.suppliers.list({ limit: 10000 }, scope(access));
    const sales = repositories.sales.list(branchQuery, queryScope).filter((row) => withinPeriod(row, periodStart, periodEnd));
    return { access, branchId, periodStart, periodEnd, products, transactions, batches, wasteEvents, suppliers, sales };
  }

  summary(input = {}, access) {
    const context = this.context(input, access);
    const usage = this.usageTrackingFrom(context);
    const predictions = this.purchasePredictionFrom(context, usage);
    const suggestions = this.reorderSuggestionsFrom(context, predictions);
    const waste = this.wasteAnalysisFrom(context);
    const expiringBatches = this.expiryAlertsFrom(context);
    const supplierScorecards = this.supplierScorecardsFrom(context);
    const stockValue = money(sum(context.products, (product) => Number(product.stock || 0) * Number(product.unitCost || 0)));
    return {
      periodStart: context.periodStart,
      periodEnd: context.periodEnd,
      branchId: context.branchId,
      metrics: {
        products: context.products.length,
        stockValue,
        lowStock: context.products.filter((product) => Number(product.stock || 0) <= Number(product.lowStockThreshold || 0)).length,
        expiringSoon: expiringBatches.length,
        openBatches: context.batches.filter((batch) => batch.status === "active").length,
        wasteCost: waste.totalCost,
        reorderCount: suggestions.length
      },
      usage,
      predictions,
      suggestions,
      expiringBatches,
      waste,
      supplierScorecards,
      insights: this.insights(context, suggestions, expiringBatches, waste)
    };
  }

  createSupplier(payload, access) {
    if (!payload.name) throw badRequest("Supplier name is required");
    const supplier = repositories.suppliers.create({
      id: makeId("sup"),
      name: payload.name,
      contactName: payload.contactName || "",
      phone: payload.phone || "",
      email: payload.email || "",
      gstin: payload.gstin || "",
      address: payload.address || "",
      status: payload.status || "active"
    }, scope(access));
    tenantService.recordUsage({ tenantId: access.tenantId, metric: "inventory:supplier", referenceType: "supplier", referenceId: supplier.id });
    return supplier;
  }

  purchaseEntry(payload, access) {
    const { productId, branchId, quantity, unitCost } = payload;
    if (!productId || !branchId || !quantity) throw badRequest("productId, branchId and quantity are required");
    tenantService.assertBranchAccess(access, branchId);
    const product = repositories.products.getById(productId, scope(access));
    if (!product) throw notFound("Product not found");
    let supplierId = payload.supplierId || "";
    if (!supplierId && payload.supplierName) {
      supplierId = this.createSupplier({ name: payload.supplierName }, access).id;
    }
    const batch = repositories.inventoryBatches.create({
      id: makeId("batch"),
      branchId,
      productId,
      supplierId,
      batchNumber: payload.batchNumber || `BATCH-${Date.now()}`,
      expiryDate: payload.expiryDate || product.expiryDate || "",
      quantityReceived: Number(quantity),
      quantityAvailable: Number(quantity),
      unitCost: Number(unitCost ?? product.unitCost ?? 0),
      status: "active"
    }, scope(access, branchId));
    const transaction = applyInventoryDelta({
      productId,
      branchId,
      batchId: batch.id,
      supplierId,
      quantity: Number(quantity),
      unitCost: Number(unitCost ?? product.unitCost ?? 0),
      totalCost: money(Number(quantity) * Number(unitCost ?? product.unitCost ?? 0)),
      type: "purchase-entry",
      reason: payload.reason || "Purchase entry",
      referenceType: "inventory-batch",
      referenceId: batch.id,
      tenantId: access.tenantId
    });
    return { batch, transaction };
  }

  createBatch(payload, access) {
    if (!payload.productId || !payload.branchId || !payload.batchNumber) throw badRequest("productId, branchId and batchNumber are required");
    tenantService.assertBranchAccess(access, payload.branchId);
    return repositories.inventoryBatches.create({
      id: makeId("batch"),
      branchId: payload.branchId,
      productId: payload.productId,
      supplierId: payload.supplierId || "",
      batchNumber: payload.batchNumber,
      expiryDate: payload.expiryDate || "",
      quantityReceived: Number(payload.quantityReceived || 0),
      quantityAvailable: Number(payload.quantityAvailable ?? payload.quantityReceived ?? 0),
      unitCost: Number(payload.unitCost || 0),
      status: payload.status || "active"
    }, scope(access, payload.branchId));
  }

  recordWaste(payload, access) {
    const { productId, branchId, quantity } = payload;
    if (!productId || !branchId || !quantity) throw badRequest("productId, branchId and quantity are required");
    tenantService.assertBranchAccess(access, branchId);
    const product = repositories.products.getById(productId, scope(access));
    if (!product) throw notFound("Product not found");
    const quantityValue = Math.abs(Number(quantity));
    let batch = null;
    if (payload.batchId) {
      batch = repositories.inventoryBatches.getById(payload.batchId, scope(access));
      if (!batch) throw notFound("Inventory batch not found");
      if (Number(batch.quantityAvailable || 0) < quantityValue) throw conflict("Batch quantity is not enough for waste entry");
      const remaining = Math.max(0, Number(batch.quantityAvailable || 0) - quantityValue);
      repositories.inventoryBatches.update(batch.id, {
        quantityAvailable: remaining,
        status: remaining <= 0 ? "depleted" : batch.status
      }, scope(access, branchId));
    }
    const unitCost = Number(batch?.unitCost ?? product.unitCost ?? 0);
    const costImpact = money(quantityValue * unitCost);
    const transaction = applyInventoryDelta({
      productId,
      branchId,
      batchId: payload.batchId || "",
      supplierId: batch?.supplierId || "",
      quantity: -quantityValue,
      unitCost,
      totalCost: -costImpact,
      type: payload.type || "waste",
      reason: payload.reason || "Waste adjustment",
      referenceType: "waste",
      referenceId: payload.batchId || "",
      tenantId: access.tenantId
    });
    const waste = repositories.inventoryWasteEvents.create({
      id: makeId("waste"),
      branchId,
      productId,
      batchId: payload.batchId || "",
      quantity: quantityValue,
      reason: payload.reason || "Waste adjustment",
      costImpact,
      notes: payload.notes || ""
    }, scope(access, branchId));
    return { waste, transaction };
  }

  runReorderSuggestions(input = {}, access) {
    const context = this.context(input, access);
    const usage = this.usageTrackingFrom(context);
    const predictions = this.purchasePredictionFrom(context, usage);
    const suggestions = this.reorderSuggestionsFrom(context, predictions);
    const metrics = {
      products: context.products.length,
      reorderCount: suggestions.length,
      lowStock: context.products.filter((product) => Number(product.stock || 0) <= Number(product.lowStockThreshold || 0)).length,
      projectedPurchaseValue: money(sum(suggestions, (item) => item.estimatedCost))
    };
    const prediction = repositories.inventoryPredictions.create({
      id: makeId("invpred"),
      branchId: context.branchId,
      type: "reorder",
      periodStart: context.periodStart,
      periodEnd: context.periodEnd,
      metrics,
      suggestions,
      status: "generated"
    }, scope(access, context.branchId));
    tenantService.recordUsage({ tenantId: access.tenantId, metric: "inventory:prediction", referenceType: "inventory_prediction", referenceId: prediction.id });
    return { prediction, metrics, suggestions };
  }

  predictions(query = {}, access) {
    return repositories.inventoryPredictions.list(query, scope(access));
  }

  usageTracking(input = {}, access) {
    return this.usageTrackingFrom(this.context(input, access));
  }

  usageTrackingFrom({ products, transactions, periodStart, periodEnd }) {
    const days = Math.max(1, Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000) + 1 || 60);
    const byProduct = groupedBy(transactions, (row) => row.productId);
    return products.map((product) => {
      const rows = byProduct.get(product.id) || [];
      const serviceUsage = Math.abs(sum(rows.filter((row) => row.type === "service-deduction"), (row) => row.quantity));
      const retailUsage = Math.abs(sum(rows.filter((row) => row.type === "sale-deduction"), (row) => row.quantity));
      const wasteUsage = Math.abs(sum(rows.filter((row) => ["waste", "expiry-writeoff"].includes(row.type)), (row) => row.quantity));
      const totalUsage = serviceUsage + retailUsage + wasteUsage;
      return {
        productId: product.id,
        name: product.name,
        branchId: product.branchId,
        usageType: product.usageType,
        stock: Number(product.stock || 0),
        serviceUsage,
        retailUsage,
        wasteUsage,
        totalUsage,
        averageDailyUsage: pct(totalUsage / days),
        stockValue: money(Number(product.stock || 0) * Number(product.unitCost || 0))
      };
    }).sort((a, b) => b.totalUsage - a.totalUsage);
  }

  purchasePredictionFrom({ products }, usage) {
    const usageByProduct = new Map(usage.map((row) => [row.productId, row]));
    return products.map((product) => {
      const row = usageByProduct.get(product.id) || {};
      const averageDailyUsage = Number(row.averageDailyUsage || 0);
      const projectedDailyUsage = averageDailyUsage || (Number(product.stock || 0) <= Number(product.lowStockThreshold || 0) ? 0.35 : 0);
      const daysOfStock = projectedDailyUsage ? pct(Number(product.stock || 0) / projectedDailyUsage) : 999;
      const leadTimeDays = product.usageType === "internal" ? 7 : 10;
      const coverageDays = 30;
      const targetQty = Math.max(Number(product.lowStockThreshold || 0) * 2, Math.ceil(projectedDailyUsage * (leadTimeDays + coverageDays)));
      const recommendedQty = Math.max(0, Math.ceil(targetQty - Number(product.stock || 0)));
      return {
        productId: product.id,
        name: product.name,
        branchId: product.branchId,
        supplier: product.supplier,
        stock: Number(product.stock || 0),
        lowStockThreshold: Number(product.lowStockThreshold || 0),
        averageDailyUsage,
        projectedDailyUsage: pct(projectedDailyUsage),
        daysOfStock,
        predictedStockoutDate: daysOfStock === 999 ? "" : addDays(daysOfStock),
        recommendedQty,
        estimatedCost: money(recommendedQty * Number(product.unitCost || 0))
      };
    }).sort((a, b) => a.daysOfStock - b.daysOfStock);
  }

  reorderSuggestionsFrom(context, predictions) {
    const expiringProductIds = new Set(this.expiryAlertsFrom(context).map((batch) => batch.productId));
    return predictions
      .filter((item) => item.recommendedQty > 0 || item.stock <= item.lowStockThreshold || item.daysOfStock <= 14 || expiringProductIds.has(item.productId))
      .map((item) => ({
        ...item,
        priority: item.stock <= item.lowStockThreshold || item.daysOfStock <= 7 ? "high" : item.daysOfStock <= 14 ? "medium" : "watch",
        reason: item.stock <= item.lowStockThreshold
          ? "Low stock threshold reached"
          : item.daysOfStock <= 14
            ? "Predicted stockout risk"
            : "Expiry or batch watch"
      }));
  }

  expiryAlertsFrom({ batches, products }) {
    const productById = new Map(products.map((product) => [product.id, product]));
    return batches
      .filter((batch) => Number(batch.quantityAvailable || 0) > 0)
      .map((batch) => ({
        ...batch,
        productName: productById.get(batch.productId)?.name || batch.productId,
        daysToExpiry: daysUntil(batch.expiryDate)
      }))
      .filter((batch) => batch.expiryDate && batch.daysToExpiry >= 0 && batch.daysToExpiry <= 60)
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  }

  wasteAnalysisFrom({ wasteEvents, products }) {
    const productById = new Map(products.map((product) => [product.id, product]));
    const rows = wasteEvents.map((event) => ({
      ...event,
      productName: productById.get(event.productId)?.name || event.productId
    }));
    const byReason = [...groupedBy(rows, (row) => row.reason).entries()].map(([reason, items]) => ({
      reason,
      quantity: sum(items, (item) => item.quantity),
      costImpact: money(sum(items, (item) => item.costImpact))
    })).sort((a, b) => b.costImpact - a.costImpact);
    return {
      rows,
      totalQuantity: sum(rows, (row) => row.quantity),
      totalCost: money(sum(rows, (row) => row.costImpact)),
      byReason
    };
  }

  supplierScorecardsFrom({ suppliers, batches, transactions }) {
    return suppliers.map((supplier) => {
      const supplierBatches = batches.filter((batch) => batch.supplierId === supplier.id);
      const purchaseTransactions = transactions.filter((row) => row.supplierId === supplier.id && row.type === "purchase-entry");
      const expiringSoon = supplierBatches.filter((batch) => daysUntil(batch.expiryDate) <= 60 && daysUntil(batch.expiryDate) >= 0).length;
      return {
        id: supplier.id,
        name: supplier.name,
        status: supplier.status,
        batches: supplierBatches.length,
        purchasedQty: sum(purchaseTransactions, (row) => row.quantity),
        purchaseValue: money(sum(purchaseTransactions, (row) => row.totalCost)),
        expiringSoon,
        reliabilityScore: pct(Math.max(55, 96 - expiringSoon * 8))
      };
    }).sort((a, b) => b.purchaseValue - a.purchaseValue);
  }

  insights(_context, suggestions, expiringBatches, waste) {
    const insights = [];
    const urgent = suggestions.filter((item) => item.priority === "high");
    if (urgent.length) insights.push(`${urgent.length} products need high-priority reorder before stockout.`);
    const topSuggestion = suggestions[0];
    if (topSuggestion) insights.push(`${topSuggestion.name} should reorder ${topSuggestion.recommendedQty} units; reason: ${topSuggestion.reason}.`);
    if (expiringBatches.length) insights.push(`${expiringBatches.length} batches expire within 60 days; push retail bundles or controlled usage.`);
    if (waste.totalCost) insights.push(`Waste impact is INR ${waste.totalCost}; review usage protocols and batch rotation.`);
    if (!insights.length) insights.push("Inventory is stable for the selected scope.");
    return insights;
  }
}

export const intelligentInventoryService = new IntelligentInventoryService();
