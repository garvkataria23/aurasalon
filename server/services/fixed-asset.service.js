import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";
import { istToday, normalizeBusinessDate, periodOf } from "../utils/finance-time.js";
import { ensureAdvancedSchema, ensureAdvancedAccounts } from "./balance-sheet-advanced-schema.service.js";
import { balanceSheetService } from "./balance-sheet.service.js";
import { balanceSheetHardeningService } from "./balance-sheet-hardening.service.js";

const id = (p) => `${p}_${randomUUID().slice(0, 12)}`;
const money = (v) => Math.round(Number(v || 0));
const rupees = (paise) => Math.round(Number(paise || 0)) / 100;
const PAYMENT_ASSET = { cash: "1000", bank: "1010" };

function scope(access = {}, branchId = "") {
  ensureAdvancedSchema();
  if (!access.tenantId) throw badRequest("Tenant context is required");
  tenantService.ensureSubscriptionActive(access.tenantId);
  const requestedBranch = branchId || access.requestedBranchId || "";
  if (requestedBranch) tenantService.assertBranchAccess(access, requestedBranch);
  ensureAdvancedAccounts(access.tenantId, requestedBranch);
  return { tenantId: access.tenantId, branchId: requestedBranch };
}

function accountId(tenantId, branchId, code) {
  const row = db.prepare("SELECT id FROM chartOfAccounts WHERE tenantId=? AND branchId=? AND code=?").get(tenantId, branchId, code);
  if (!row) throw badRequest(`Account ${code} missing`);
  return row.id;
}

function assetCostPaise(a) {
  return money(a.costPaise || a.purchaseCostPaise);
}

function assetSalvagePaise(a) {
  return money(a.salvagePaise || a.salvageValuePaise);
}

function assetMethod(a) {
  return String(a.method || a.depreciationMethod || "SLM").toUpperCase();
}

function assetWdvRatePct(a) {
  return Number(a.wdvRatePct ?? a.wdvRatePercent ?? 0) || 0;
}

// Stage 24 — fixed asset register with Companies Act style depreciation.
// SLM = (cost - salvage) / usefulLifeMonths per month. WDV = netBookValue *
// (annual % / 12). Depreciation is exactly-once per asset per month (UNIQUE
// table + idempotent scheduler) and respects period locks via the ledger.
export const fixedAssetService = {
  createAsset(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const code = String(payload.code || "").trim();
    const name = String(payload.name || "").trim();
    if (!code || !name) throw badRequest("code and name are required");
    const costPaise = money(payload.costPaise);
    if (costPaise <= 0) throw badRequest("costPaise must be > 0");
    const method = payload.method === "WDV" ? "WDV" : "SLM";
    const acquisitionDate = normalizeBusinessDate(payload.acquisitionDate || istToday());
    const paymentMode = PAYMENT_ASSET[payload.paymentMode] ? payload.paymentMode : "bank";
    const salvagePaise = money(payload.salvagePaise);
    const wdvRatePct = Number(payload.wdvRatePct) || 0;

    const assetId = id("fa");
    const existing = db.prepare("SELECT * FROM fixedAssets WHERE tenantId=? AND branchId=? AND code=?").get(tenantId, branchId, code);
    if (existing) return this.assetView(existing);

    // Acquisition: Dr Fixed Assets, Cr Cash/Bank (or Payable if unsettled).
    balanceSheetService.createJournal({
      branchId, businessDate: acquisitionDate, sourceType: "asset.acquisition", sourceId: code,
      memo: payload.memo || `Asset acquisition: ${name}`,
      idempotencyKey: `asset-buy:${tenantId}:${branchId}:${code}`,
      lines: [
        { accountId: accountId(tenantId, branchId, "1500"), debitPaise: costPaise },
        { accountId: accountId(tenantId, branchId, payload.settled === false ? "2000" : PAYMENT_ASSET[paymentMode]), creditPaise: costPaise }
      ]
    }, access);

    db.prepare(`
      INSERT INTO fixedAssets (
        id, tenantId, branchId, code, name, category, acquisitionDate, costPaise, salvagePaise,
        usefulLifeMonths, method, wdvRatePct, assetName, purchaseDate, purchaseCostPaise,
        salvageValuePaise, depreciationMethod, wdvRatePercent
      )
      VALUES (
        @id, @tenantId, @branchId, @code, @name, @category, @acquisitionDate, @costPaise, @salvagePaise,
        @usefulLifeMonths, @method, @wdvRatePct, @assetName, @purchaseDate, @purchaseCostPaise,
        @salvageValuePaise, @depreciationMethod, @wdvRatePercent
      )
    `).run({
      id: assetId, tenantId, branchId, code, name,
      category: String(payload.category || "equipment"), acquisitionDate, costPaise,
      salvagePaise, usefulLifeMonths: Math.max(1, Number(payload.usefulLifeMonths) || 60),
      method, wdvRatePct, assetName: name, purchaseDate: acquisitionDate,
      purchaseCostPaise: costPaise, salvageValuePaise: salvagePaise,
      depreciationMethod: method.toLowerCase(), wdvRatePercent: wdvRatePct
    });
    return this.assetView(db.prepare("SELECT * FROM fixedAssets WHERE id=?").get(assetId));
  },

  // Monthly depreciation run for a period (YYYY-MM). Idempotent + exactly-once.
  runDepreciation(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const period = periodOf(payload.period || istToday());
    const postDate = `${period}-28`;
    const run = balanceSheetHardeningService.runOnce(tenantId, "depreciation", `${branchId}:${period}`, () => {
      const assets = db.prepare("SELECT * FROM fixedAssets WHERE tenantId=? AND status='active'" + (branchId ? " AND branchId=?" : ""))
        .all(...(branchId ? [tenantId, branchId] : [tenantId]));
      let posted = 0, totalPaise = 0;
      for (const a of assets) {
        const exists = db.prepare("SELECT 1 FROM depreciationEntries WHERE tenantId=? AND assetId=? AND period=?").get(tenantId, a.id, period);
        if (exists) continue;
        const amount = this.monthlyDepreciation(a);
        if (amount <= 0) continue;
        const entry = balanceSheetService.createJournal({
          branchId: a.branchId, businessDate: postDate, sourceType: "asset.depreciation", sourceId: `${a.code}:${period}`,
          memo: `Depreciation ${a.name} ${period}`,
          idempotencyKey: `deprec:${tenantId}:${a.id}:${period}`,
          lines: [
            { accountId: accountId(tenantId, a.branchId, "5400"), debitPaise: amount },
            { accountId: accountId(tenantId, a.branchId, "1590"), creditPaise: amount }
          ]
        }, access);
        db.prepare("INSERT OR IGNORE INTO depreciationEntries (id, tenantId, assetId, period, amountPaise, journalEntryId) VALUES (?,?,?,?,?,?)")
          .run(id("dep"), tenantId, a.id, period, amount, entry.id);
        db.prepare("UPDATE fixedAssets SET accumulatedDepreciationPaise = accumulatedDepreciationPaise + ? WHERE id=?").run(amount, a.id);
        posted++; totalPaise += amount;
      }
      return { posted, totalPaise };
    });
    return { period, skipped: run.skipped, ...(run.result || {}), totalDepreciation: rupees((run.result || {}).totalPaise || 0) };
  },

  monthlyDepreciation(a) {
    const costPaise = assetCostPaise(a);
    const salvagePaise = assetSalvagePaise(a);
    const depreciable = costPaise - salvagePaise;
    const remaining = depreciable - a.accumulatedDepreciationPaise;
    if (remaining <= 0) return 0;
    if (assetMethod(a) === "WDV") {
      const nbv = costPaise - a.accumulatedDepreciationPaise;
      const monthly = Math.round(nbv * (assetWdvRatePct(a) / 100) / 12);
      return Math.min(Math.max(0, monthly), remaining);
    }
    const monthly = Math.round(depreciable / a.usefulLifeMonths);
    return Math.min(monthly, remaining); // final month absorbs the remainder
  },

  disposeAsset(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const a = db.prepare("SELECT * FROM fixedAssets WHERE tenantId=? AND branchId=? AND code=?").get(tenantId, branchId, String(payload.code || ""));
    if (!a) throw notFound("Asset not found");
    if (a.status === "disposed") throw badRequest("Asset already disposed");
    const disposeDate = normalizeBusinessDate(payload.disposeDate || istToday());
    const proceeds = money(payload.proceedsPaise);
    const costPaise = assetCostPaise(a);
    const nbv = costPaise - a.accumulatedDepreciationPaise;
    const gain = proceeds - nbv;

    const lines = [];
    if (proceeds > 0) lines.push({ accountId: accountId(tenantId, branchId, PAYMENT_ASSET[PAYMENT_ASSET[payload.paymentMode] ? payload.paymentMode : "bank"]), debitPaise: proceeds });
    if (a.accumulatedDepreciationPaise > 0) lines.push({ accountId: accountId(tenantId, branchId, "1590"), debitPaise: a.accumulatedDepreciationPaise });
    lines.push({ accountId: accountId(tenantId, branchId, "1500"), creditPaise: costPaise });
    if (gain > 0) lines.push({ accountId: accountId(tenantId, branchId, "4200"), creditPaise: gain });
    if (gain < 0) lines.push({ accountId: accountId(tenantId, branchId, "5500"), debitPaise: -gain });

    const entry = balanceSheetService.createJournal({
      branchId, businessDate: disposeDate, sourceType: "asset.disposal", sourceId: a.code,
      memo: payload.memo || `Disposal: ${a.name}`,
      idempotencyKey: `asset-dispose:${tenantId}:${branchId}:${a.code}`,
      lines
    }, access);
    db.prepare("UPDATE fixedAssets SET status='disposed', disposedDate=? WHERE id=?").run(disposeDate, a.id);
    return { code: a.code, netBookValue: rupees(nbv), proceeds: rupees(proceeds), gainOrLoss: rupees(gain), journalEntryId: entry.id };
  },

  assetView(a) {
    if (!a) return null;
    const costPaise = assetCostPaise(a);
    const salvagePaise = assetSalvagePaise(a);
    const nbv = costPaise - a.accumulatedDepreciationPaise;
    return {
      id: a.id, code: a.code || a.id, name: a.name || a.assetName, category: a.category || "equipment", method: assetMethod(a),
      acquisitionDate: a.acquisitionDate || a.purchaseDate, cost: rupees(costPaise), salvage: rupees(salvagePaise),
      usefulLifeMonths: a.usefulLifeMonths, wdvRatePct: assetWdvRatePct(a),
      accumulatedDepreciation: rupees(a.accumulatedDepreciationPaise), netBookValue: rupees(nbv), status: a.status
    };
  },

  register(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const rows = db.prepare("SELECT * FROM fixedAssets WHERE tenantId=? AND branchId=? ORDER BY code").all(tenantId, branchId);
    const grossPaise = rows.reduce((s, r) => s + assetCostPaise(r), 0);
    const accumPaise = rows.reduce((s, r) => s + r.accumulatedDepreciationPaise, 0);
    return {
      grossBlock: rupees(grossPaise), accumulatedDepreciation: rupees(accumPaise),
      netBlock: rupees(grossPaise - accumPaise), assets: rows.map(this.assetView)
    };
  }
};
