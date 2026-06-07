import { repositories } from "../../repositories/repository-registry.js";
import { badRequest } from "../../utils/app-error.js";
import { tenantService } from "../tenant.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function daysUntil(value) {
  if (!value) return 9999;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 9999;
  return Math.ceil((time - Date.now()) / 86400000);
}

function status(value) {
  return String(value || "").toLowerCase();
}

function extractRequiredProductIds(services) {
  const ids = new Set();
  for (const service of services) {
    for (const item of service.requiredProducts || []) {
      if (typeof item === "string") ids.add(item);
      if (item?.productId) ids.add(item.productId);
      if (item?.id) ids.add(item.id);
    }
  }
  return ids;
}

export function buildInventoryAiContext({ branchId = "", productId = "", serviceId = "", access }) {
  const effectiveBranchId = branchId || access.branchId || "";
  if (effectiveBranchId) tenantService.assertBranchAccess(access, effectiveBranchId);
  const scoped = scope(access, effectiveBranchId);
  const tenantScoped = scope(access);
  const query = effectiveBranchId ? { branchId: effectiveBranchId, limit: 10000 } : { limit: 10000 };

  const products = repositories.products.list(query, scoped);
  const transactions = repositories.inventory.list(query, scoped);
  const services = repositories.services.list({ limit: 10000 }, tenantScoped);
  const sales = repositories.sales.list(query, scoped);
  const branches = repositories.branches.list(query, scoped);
  const batches = repositories.inventoryBatches.list(query, scoped);
  const suppliers = repositories.suppliers.list({ limit: 10000 }, tenantScoped);

  const selectedProduct = productId ? products.find((product) => product.id === productId) : null;
  if (productId && !selectedProduct) throw badRequest("Selected product was not found for Inventory AI");
  const selectedService = serviceId ? services.find((service) => service.id === serviceId) : null;
  if (serviceId && !selectedService) throw badRequest("Selected service was not found for Inventory AI");

  const requiredProductIds = selectedService ? extractRequiredProductIds([selectedService]) : extractRequiredProductIds(services);
  const lowStock = products.filter((product) => Number(product.stock || 0) <= Number(product.lowStockThreshold || 0));
  const expiringSoon = products.filter((product) => daysUntil(product.expiryDate) <= 30);
  const professionalProducts = products.filter((product) => String(product.usageType || "").includes("professional"));
  const retailProducts = products.filter((product) => String(product.usageType || "retail") === "retail");

  const soldByProduct = new Map();
  for (const sale of sales) {
    for (const item of sale.items || []) {
      if (item.type !== "product") continue;
      soldByProduct.set(item.id, (soldByProduct.get(item.id) || 0) + Number(item.quantity || 1));
    }
  }

  const productRows = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    usageType: product.usageType || "retail",
    branchId: product.branchId,
    stock: Number(product.stock || 0),
    lowStockThreshold: Number(product.lowStockThreshold || 0),
    expiryDate: product.expiryDate || "",
    daysUntilExpiry: daysUntil(product.expiryDate),
    unitCost: Number(product.unitCost || 0),
    price: Number(product.price || 0),
    soldQuantity: Number(soldByProduct.get(product.id) || 0),
    requiredForService: requiredProductIds.has(product.id),
    stockValue: money(Number(product.stock || 0) * Number(product.unitCost || 0))
  }));

  return {
    tenantId: access.tenantId,
    branchId: effectiveBranchId,
    selectedProduct: selectedProduct ? productRows.find((row) => row.id === selectedProduct.id) : null,
    selectedService: selectedService ? {
      id: selectedService.id,
      name: selectedService.name,
      category: selectedService.category,
      requiredProducts: selectedService.requiredProducts || []
    } : null,
    metrics: {
      productCount: products.length,
      lowStockCount: lowStock.length,
      expiringSoonCount: expiringSoon.length,
      professionalStockCount: professionalProducts.length,
      retailStockCount: retailProducts.length,
      stockValue: money(products.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.unitCost || 0), 0)),
      transactionCount: transactions.length,
      batchCount: batches.length,
      supplierCount: suppliers.length
    },
    products: productRows.slice(0, 120),
    lowStock: productRows.filter((row) => row.stock <= row.lowStockThreshold).slice(0, 40),
    expiringSoon: productRows.filter((row) => row.daysUntilExpiry <= 30).slice(0, 40),
    transactions: transactions.slice(0, 80).map((transaction) => ({
      id: transaction.id,
      productId: transaction.productId,
      branchId: transaction.branchId,
      type: transaction.type,
      quantity: Number(transaction.quantity || 0),
      reason: transaction.reason || "",
      referenceType: transaction.referenceType || "",
      createdAt: transaction.createdAt
    })),
    services: services.filter((service) => status(service.status || "active") === "active").slice(0, 80).map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
      requiredProducts: service.requiredProducts || []
    })),
    branches: branches.map((branch) => ({ id: branch.id, name: branch.name, city: branch.city }))
  };
}
