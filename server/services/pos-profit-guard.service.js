import { db } from "../db.js";
import { profitGovernanceService } from "./profit-governance.service.js";
import { tenantService } from "./tenant.service.js";

const toPaise = (value) => Math.round((Number(value) || 0) * 100);

function tableColumns(name) {
  try {
    return db.prepare(`PRAGMA table_info(${name})`).all().map((column) => column.name);
  } catch {
    return [];
  }
}

function tableExists(name) {
  return tableColumns(name).length > 0;
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function intPaise(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function moneyPaise(value) {
  return Math.round((Number(value) || 0) * 100);
}

function lineQuantity(line = {}) {
  return Math.max(1, Number(line.quantity ?? line.qty ?? line.count ?? 1) || 1);
}

function lineAmountPaise(line = {}) {
  const explicit = line.amountPaise ?? line.totalPaise ?? line.lineTotalPaise;
  if (explicit !== undefined && explicit !== null && explicit !== "") return intPaise(explicit);
  const total = line.total ?? line.lineTotal ?? line.amount ?? line.netAmount;
  if (total !== undefined && total !== null && total !== "") return moneyPaise(total);
  const price = line.price ?? line.unitPrice ?? line.rate ?? 0;
  return moneyPaise(Number(price || 0) * lineQuantity(line));
}

function explicitCostPaise(line = {}, keys = []) {
  for (const key of keys) {
    if (line[key] !== undefined && line[key] !== null && line[key] !== "") {
      return String(key).toLowerCase().includes("paise") ? intPaise(line[key]) : moneyPaise(line[key]);
    }
  }
  return 0;
}

function serviceIdFor(line = {}) {
  return String(line.serviceId || line.service_id || line.id || line.itemId || "").trim();
}

function isMembershipRedemption(line = {}) {
  const text = [line.type, line.itemType, line.kind, line.category, line.name, line.itemName].join(" ").toLowerCase();
  return /(membership|package|redemption|redeem|prepaid)/.test(text);
}

function reason(type, message, impactPaise = 0) {
  return { type, message, impactPaise: Math.max(0, Math.round(Number(impactPaise || 0))) };
}

export class PosProfitGuardService {
  marginCheck(payload = {}, access = {}) {
    const branchId = String(payload.branchId ?? access.branchId ?? "").trim();
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const scoped = { ...payload, branchId };
    const lineItems = parseArray(payload.lineItems);
    const estimated = this.estimateInvoiceCosts(scoped, access, lineItems);
    const grossAmountPaise = intPaise(payload.grossAmountPaise) || estimated.grossAmountPaise;
    const discountPaise = intPaise(payload.discountPaise);
    const productCostPaise = intPaise(payload.productCostPaise) || estimated.productCostPaise;
    const staffCostPaise = intPaise(payload.staffCostPaise) || estimated.staffCostPaise;
    const membershipRedemptionPaise = intPaise(payload.membershipRedemptionPaise) || estimated.membershipRedemptionPaise;
    const governance = profitGovernanceService.evaluateDiscount({
      ...payload,
      branchId,
      grossAmountPaise,
      discountPaise,
      productCostPaise,
      staffCostPaise,
      membershipRedemptionPaise,
      sourceType: payload.sourceType || "pos_negative_margin_guard",
      sourceId: payload.sourceId || payload.invoiceId || `pos-${Date.now()}`
    }, access);
    const reasons = [
      ...estimated.reasons,
      ...(governance.blocked ? [reason("negative_margin", "Invoice net loss me ja raha hai; save/payment block karein.", Math.abs(governance.estimatedProfitPaise || 0))] : []),
      ...(governance.requiresApproval ? [reason("approval_required", "Margin-safe policy owner approval maang rahi hai.", governance.impactPaise || discountPaise)] : [])
    ];
    return {
      allowed: governance.allowed,
      blocked: governance.blocked,
      requiresApproval: governance.requiresApproval,
      estimatedProfitPaise: governance.estimatedProfitPaise,
      marginBps: governance.marginBps,
      discountBps: governance.discountBps,
      reasons,
      ruleTriggered: governance.ruleTriggered,
      recommendedAction: governance.recommendedAction,
      auditId: governance.auditId
    };
  }

  estimateInvoiceCosts(payload = {}, access = {}, lineItems = []) {
    const tenantId = String(access.tenantId || "default");
    const branchId = String(payload.branchId || "");
    const recipeCosts = this.recipeCostMap({ tenantId, branchId });
    let grossAmountPaise = 0;
    let productCostPaise = 0;
    let staffCostPaise = 0;
    let membershipRedemptionPaise = 0;
    const reasons = [];
    for (const line of lineItems) {
      const amountPaise = lineAmountPaise(line);
      grossAmountPaise += amountPaise;
      const explicitProductCost = explicitCostPaise(line, ["productCostPaise", "cogsPaise", "recipeCostPaise", "productCost", "cogs", "recipeCost"]);
      const serviceId = serviceIdFor(line);
      const recipeCost = explicitProductCost || (serviceId ? Number(recipeCosts.get(serviceId) || 0) * lineQuantity(line) : 0);
      const fallbackCost = recipeCost || Math.round(amountPaise * 0.12);
      productCostPaise += fallbackCost;
      if (explicitProductCost) reasons.push(reason("explicit_product_cost", "Line item product cost POS payload se use hua.", explicitProductCost));
      else if (recipeCost) reasons.push(reason("recipe_cogs", "Service recipe se product COGS estimate hua.", recipeCost));
      else if (amountPaise > 0) reasons.push(reason("fallback_cogs", "Recipe missing thi; conservative 12% product cost estimate use hua.", fallbackCost));
      const explicitStaffCost = explicitCostPaise(line, ["staffCostPaise", "commissionPaise", "staffCost", "commission"]);
      const commissionCost = explicitStaffCost || Math.round(amountPaise * 0.1);
      staffCostPaise += commissionCost;
      if (!explicitStaffCost && amountPaise > 0) reasons.push(reason("staff_commission_estimate", "Staff commission missing thi; 10% staff cost estimate use hua.", commissionCost));
      if (isMembershipRedemption(line)) {
        const redemptionPaise = explicitCostPaise(line, ["membershipRedemptionPaise", "redemptionPaise", "redeemedValuePaise", "membershipRedemption", "redemption"]) || amountPaise;
        membershipRedemptionPaise += redemptionPaise;
        reasons.push(reason("membership_redemption", "Membership/package redemption profit guard me include hua.", redemptionPaise));
      }
    }
    return {
      grossAmountPaise,
      productCostPaise,
      staffCostPaise,
      membershipRedemptionPaise,
      reasons: reasons.slice(0, 8)
    };
  }

  recipeCostMap({ tenantId, branchId = "" } = {}) {
    const costs = new Map();
    if (!tableExists("service_recipes")) return costs;
    const recipeColumns = new Set(tableColumns("service_recipes"));
    const itemColumns = new Set(tableColumns("service_recipe_items"));
    const serviceIdExpr = recipeColumns.has("service_id") ? "service_id" : recipeColumns.has("serviceId") ? "serviceId" : "id";
    const recipeIdExpr = recipeColumns.has("id") ? "id" : "service_id";
    const tenantColumn = recipeColumns.has("tenantId") ? "tenantId" : recipeColumns.has("tenant_id") ? "tenant_id" : "";
    const branchColumn = recipeColumns.has("branchId") ? "branchId" : recipeColumns.has("branch_id") ? "branch_id" : "";
    const statusColumn = recipeColumns.has("approval_status") ? "approval_status" : recipeColumns.has("status") ? "status" : "";
    const tenantWhere = tenantColumn ? `r.${tenantColumn} = @tenantId` : "1 = 1";
    const branchSql = branchColumn ? `COALESCE(r.${branchColumn}, '')` : "''";
    const statusSql = statusColumn ? `COALESCE(r.${statusColumn}, 'approved')` : "'approved'";
    if (tableExists("service_recipe_items") && itemColumns.size) {
      const recipeRef = itemColumns.has("recipe_id") ? "recipe_id" : itemColumns.has("recipeId") ? "recipeId" : "";
      const costExpr = itemColumns.has("cost_paise") ? "cost_paise" : itemColumns.has("costPaise") ? "costPaise" : itemColumns.has("unit_cost_paise") ? "unit_cost_paise" : "";
      const qtyExpr = itemColumns.has("quantity") ? "quantity" : itemColumns.has("qty") ? "qty" : itemColumns.has("quantity_per_service") ? "quantity_per_service" : "1";
      if (recipeRef && costExpr) {
        const rows = db.prepare(`
          SELECT r.${serviceIdExpr} AS serviceId, SUM(COALESCE(i.${costExpr}, 0) * COALESCE(i.${qtyExpr}, 1)) AS costPaise
          FROM service_recipes r
          JOIN service_recipe_items i ON i.${recipeRef} = r.${recipeIdExpr}
          WHERE ${tenantWhere}
            AND (@branchId = '' OR ${branchSql} = @branchId OR ${branchSql} = '')
            AND lower(${statusSql}) IN ('approved','active')
          GROUP BY r.${serviceIdExpr}
        `).all({ tenantId, branchId });
        for (const row of rows) {
          if (row.serviceId) costs.set(String(row.serviceId), Math.round(Number(row.costPaise || 0)));
        }
      }
    }
    const priceColumns = ["expected_cost_paise", "expectedCostPaise", "product_cost_paise", "productCostPaise", "expected_cost", "product_cost"];
    const costColumn = priceColumns.find((column) => recipeColumns.has(column));
    if (costColumn) {
      const valueExpr = costColumn.toLowerCase().includes("paise") ? costColumn : `(${costColumn} * 100)`;
      const rows = db.prepare(`
        SELECT ${serviceIdExpr} AS serviceId, ${valueExpr} AS costPaise
        FROM service_recipes
        WHERE ${tenantColumn ? `${tenantColumn} = @tenantId` : "1 = 1"}
          AND (@branchId = '' OR ${branchColumn ? `COALESCE(${branchColumn}, '')` : "''"} = @branchId OR ${branchColumn ? `COALESCE(${branchColumn}, '')` : "''"} = '')
          AND lower(${statusColumn ? `COALESCE(${statusColumn}, 'approved')` : "'approved'"}) IN ('approved','active')
      `).all({ tenantId, branchId });
      for (const row of rows) {
        if (row.serviceId && !costs.has(String(row.serviceId))) costs.set(String(row.serviceId), Math.round(Number(row.costPaise || 0)));
      }
    }
    return costs;
  }
}

export const posProfitGuardService = new PosProfitGuardService();
