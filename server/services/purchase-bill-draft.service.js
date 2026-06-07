import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { db } from "../db.js";
import { repositories } from "../repositories/repository-registry.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { auditDecision, camel, emitEvent, makeId, number, parseJson, requireManager, toJson } from "./enterprise-command-utils.js";
import { inventoryEnterpriseService } from "./inventory-enterprise.service.js";
import { intelligentInventoryService } from "./intelligent-inventory.service.js";
import { gstBreakupFromText, purchaseBillAiService } from "./purchase-bill-ai.service.js";
import { tenantService } from "./tenant.service.js";

const DEFAULT_CATEGORIES = [
  ["Hair Color", "hair-color", ["majirel", "inoa", "color", "shade", "developer"]],
  ["Developer/Oxidant", "developer", ["oxidant", "peroxide", "developer", "vol"]],
  ["Haircare Retail", "haircare-retail", ["shampoo", "conditioner", "serum", "mask"]],
  ["Skincare Professional", "skincare-professional", ["facial", "mask", "cleanser", "serum", "peel"]],
  ["Waxing", "waxing", ["wax", "strip", "pre wax", "post wax"]],
  ["Nails", "nails", ["gel", "polish", "nail", "acrylic"]],
  ["Disposables", "disposables", ["cotton", "gloves", "tissue", "cape", "foil", "spatula"]],
  ["Tools/Equipment", "tools-equipment", ["dryer", "machine", "brush", "comb", "chair", "steamer"]],
  ["Cleaning/Sanitization", "cleaning-sanitization", ["sanitizer", "disinfect", "cleaner", "sterilizer"]],
  ["Salon Consumables", "salon-consumables", ["cream", "lotion", "bleach", "powder", "thread"]]
];

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function pickMoney(value, fallback = 0) {
  return value === undefined || value === null || value === "" ? money(fallback) : money(value);
}

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {}, "");
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function now() {
  return new Date().toISOString();
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\b(pvt|ltd|private|limited|india|professional|salon|cosmetic|cosmetics)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function supplierKey({ supplierId = "", supplierName = "", supplierGstin = "" } = {}) {
  if (supplierId) return `id:${supplierId}`;
  if (supplierGstin) return `gst:${String(supplierGstin).trim().toUpperCase()}`;
  if (supplierName) return `name:${normalizeText(supplierName)}`;
  return "";
}

function supplierDetailsFromDraft(draft = {}, extraction = {}, payload = {}) {
  return {
    name: String(payload.name || payload.supplierName || draft.supplier_name || extraction.supplierName || "").trim(),
    gstin: String(payload.gstin || payload.supplierGstin || draft.supplier_gstin || extraction.supplierGstin || "").trim().toUpperCase(),
    phone: String(payload.phone || payload.supplierPhone || draft.supplier_phone || extraction.supplierPhone || "").trim(),
    email: String(payload.email || payload.supplierEmail || draft.supplier_email || extraction.supplierEmail || "").trim(),
    address: String(payload.address || payload.supplierAddress || draft.supplier_address || extraction.supplierAddress || "").trim()
  };
}

function fillMissingSupplierDetails(supplier, details = {}, access, statusReason = "") {
  if (!supplier?.id) return supplier;
  const patch = {};
  for (const field of ["phone", "email", "address", "gstin"]) {
    const value = String(details[field] || "").trim();
    if (value && !String(supplier[field] || "").trim()) patch[field] = value;
  }
  if (statusReason && !String(supplier.statusReason || "").trim()) patch.statusReason = statusReason;
  return Object.keys(patch).length ? repositories.suppliers.update(supplier.id, patch, scope(access)) : supplier;
}

function safeUsage(value = "") {
  const normalized = String(value || "").toLowerCase();
  return ["retail", "consumable", "both", "asset"].includes(normalized) ? normalized : "retail";
}

function safeUnit(value = "") {
  const normalized = String(value || "").toLowerCase().trim();
  return normalized || "pcs";
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
  if (row.branch_id) tenantService.assertBranchAccess(access, row.branch_id);
  return row;
}

function listDraftItems(draftId, access) {
  return db.prepare("SELECT * FROM purchase_bill_draft_items WHERE tenant_id = ? AND draft_id = ? ORDER BY line_no ASC, created_at ASC")
    .all(access.tenantId, draftId)
    .map((row) => ({
      ...camel(row),
      warnings: parseJson(row.warnings_json, []),
      matchSuggestions: shouldExposeMatchSuggestions(row) ? parseJson(row.match_suggestions_json, []) : []
    }));
}

function draftTaxBreakup(row = {}, items = []) {
  const extraction = parseJson(row.extraction_json, {});
  const rawTax = gstBreakupFromText(row.raw_text || extraction.rawText || "");
  const itemCgst = money(items.reduce((sum, item) => sum + number(item.cgstAmount ?? item.cgst_amount), 0));
  const itemSgst = money(items.reduce((sum, item) => sum + number(item.sgstAmount ?? item.sgst_amount), 0));
  const itemIgst = money(items.reduce((sum, item) => sum + number(item.igstAmount ?? item.igst_amount), 0));
  const cgstAmount = money(row.cgst_amount || extraction.cgstAmount || extraction.cgst_amount || rawTax.cgstAmount || itemCgst);
  const sgstAmount = money(row.sgst_amount || extraction.sgstAmount || extraction.sgst_amount || rawTax.sgstAmount || itemSgst);
  const igstAmount = money(row.igst_amount || extraction.igstAmount || extraction.igst_amount || rawTax.igstAmount || itemIgst);
  const gstAmount = money(row.gst_amount || extraction.gstAmount || extraction.gst_amount || cgstAmount + sgstAmount + igstAmount);
  return { gstAmount, cgstAmount, sgstAmount, igstAmount };
}

function shouldExposeMatchSuggestions(row = {}) {
  if (row.product_id && number(row.match_confidence, 0) >= 0.88) return false;
  return !["created_product", "manual_match", "exact_match", "confirmed", "confirmed_po_match"].includes(row.match_status);
}

function assertDraftEditable(draft) {
  if (draft.status !== "draft") throw conflict("Confirmed or cancelled drafts cannot be edited");
}

function lineCalculations(input = {}) {
  const qty = Math.max(0, number(input.qty ?? input.quantity, 0));
  const conversionFactor = Math.max(0.0001, number(input.conversionFactor ?? input.conversion_factor ?? input.packSize ?? input.pack_size, 1));
  const gstPercent = number(input.gstPercent ?? input.gst_percent, 18);
  const mrp = number(input.mrp ?? input.price, 0);
  const discountPercent = number(input.discountPercent ?? input.discount_percent, 0);
  const inferredDiscountUnitCost = mrp && discountPercent
    ? money((mrp * (1 - discountPercent / 100)) / (1 + gstPercent / 100))
    : 0;
  const unitCost = money(input.unitCost ?? input.unit_cost ?? input.rate ?? inferredDiscountUnitCost);
  const taxableAmount = money(input.taxableAmount ?? input.taxable_amount ?? qty * unitCost);
  const cgstAmount = money(input.cgstAmount ?? input.cgst_amount ?? 0);
  const sgstAmount = money(input.sgstAmount ?? input.sgst_amount ?? 0);
  const igstAmount = money(input.igstAmount ?? input.igst_amount ?? 0);
  const splitGstAmount = money(cgstAmount + sgstAmount + igstAmount);
  const explicitGstAmount = input.gstAmount ?? input.gst_amount;
  const gstAmount = money(explicitGstAmount ?? (splitGstAmount || taxableAmount * (gstPercent / 100)));
  const lineTotal = money(input.lineTotal ?? input.line_total ?? taxableAmount + gstAmount);
  const grossMrpAmount = money(qty * mrp);
  const discountAmount = money(input.discountAmount ?? input.discount_amount ?? (grossMrpAmount > lineTotal ? grossMrpAmount - lineTotal : 0));
  return {
    qty,
    conversionFactor,
    stockQty: money(number(input.stockQty ?? input.stock_qty, qty * conversionFactor)),
    unitCost,
    discountPercent,
    discountAmount,
    gstPercent,
    taxableAmount,
    gstAmount,
    cgstAmount: cgstAmount || (!igstAmount && gstAmount ? money(gstAmount / 2) : 0),
    sgstAmount: sgstAmount || (!igstAmount && gstAmount ? money(gstAmount / 2) : 0),
    igstAmount,
    lineTotal
  };
}

function tokenScore(a = "", b = "") {
  const left = new Set(normalizeText(a).split(/\s+/).filter(Boolean));
  const right = new Set(normalizeText(b).split(/\s+/).filter(Boolean));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / Math.max(left.size, right.size);
}

function productSku(name = "", supplierSku = "") {
  if (supplierSku) return supplierSku;
  const base = normalizeText(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "product";
  return `${base}-${crypto.randomUUID().slice(0, 5)}`.toUpperCase();
}

function categoryGuess(name = "", categories = []) {
  const normalized = normalizeText(name);
  let best = null;
  for (const category of categories) {
    const keywords = parseJson(category.ai_keywords_json, []);
    const score = keywords.reduce((sum, keyword) => sum + (normalized.includes(normalizeText(keyword)) ? 1 : 0), 0);
    if (score && (!best || score > best.score)) best = { category, score };
  }
  return best?.category || categories[0] || null;
}

function usageGuess(name = "", categoryName = "") {
  const text = `${name} ${categoryName}`.toLowerCase();
  if (/(dryer|machine|chair|steamer|tool|equipment|brush|comb)/.test(text)) return "asset";
  if (/(cotton|glove|foil|tissue|developer|oxidant|color|wax|bleach|sanit|disposable|consumable)/.test(text)) return "consumable";
  if (/(retail|shampoo|conditioner|serum|aftercare|home care)/.test(text)) return "retail";
  return "both";
}

function confirmValidationError(messages = []) {
  if (!messages.length) return;
  throw badRequest("Purchase bill draft needs review before confirmation", messages);
}

function attachmentExtension(fileName = "", mimeType = "") {
  const ext = extname(fileName).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".pdf"].includes(ext)) return ext;
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("pdf")) return ".pdf";
  return ".jpg";
}

function saveAttachment(draftId, payload = {}, access = {}, branchId = "") {
  const raw = String(payload.fileBase64 || payload.imageBase64 || payload.fileDataUrl || "");
  const base64 = raw.replace(/^data:[^;]+;base64,/, "");
  if (!base64) return null;
  const mimeType = payload.fileMimeType || payload.mimeType || raw.match(/^data:([^;]+);base64,/)?.[1] || "image/jpeg";
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) return null;
  if (buffer.length > 7 * 1024 * 1024) throw badRequest("Bill image must be below 7 MB");
  const folder = join(process.cwd(), "data", "purchase-bills", access.tenantId, branchId || "all");
  mkdirSync(folder, { recursive: true });
  const fileName = `${draftId}${attachmentExtension(payload.fileName || payload.originalFileName || "", mimeType)}`;
  const filePath = join(folder, fileName);
  writeFileSync(filePath, buffer);
  return {
    filePath,
    originalFileName: payload.fileName || payload.originalFileName || fileName,
    mimeType,
    fileSize: buffer.length,
    checksum: createHash("sha256").update(buffer).digest("hex")
  };
}

function attachmentPreview(row = {}) {
  if (!row.image_path || !existsSync(row.image_path)) return "";
  const size = statSync(row.image_path).size;
  if (size > 4 * 1024 * 1024) return "";
  const mimeType = row.original_file_name?.toLowerCase().endsWith(".pdf") ? "application/pdf"
    : row.image_path.toLowerCase().endsWith(".png") ? "image/png"
      : row.image_path.toLowerCase().endsWith(".webp") ? "image/webp"
        : "image/jpeg";
  return `data:${mimeType};base64,${readFileSync(row.image_path).toString("base64")}`;
}

export class PurchaseBillDraftService {
  ensureDefaultCategories(access) {
    for (const [name, code, keywords] of DEFAULT_CATEGORIES) {
      db.prepare(`INSERT OR IGNORE INTO product_categories
        (id, tenant_id, branch_id, name, code, usage_scope, ai_keywords_json, status, version)
        VALUES (@id, @tenant_id, '', @name, @code, 'inventory', @ai_keywords_json, 'active', 1)`)
        .run({
          id: `cat_${code}`,
          tenant_id: access.tenantId,
          name,
          code,
          ai_keywords_json: toJson(keywords)
        });
    }
  }

  listCategories(query = {}, access) {
    this.ensureDefaultCategories(access);
    const branchId = query.branchId || query.branch_id || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const rows = db.prepare(`SELECT * FROM product_categories
      WHERE tenant_id = @tenant_id AND status = 'active' AND (branch_id = '' OR branch_id = @branch_id)
      ORDER BY branch_id ASC, name ASC`)
      .all({ tenant_id: access.tenantId, branch_id: branchId });
    return rows.map(camel);
  }

  createCategory(payload = {}, access) {
    requireManager(access);
    const name = String(payload.name || "").trim();
    if (!name) throw badRequest("Category name is required");
    const branchId = payload.branchId || payload.branch_id || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const category = insertSnake("product_categories", {
      id: makeId("cat"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      name,
      code: normalizeText(payload.code || name).replace(/[^a-z0-9]+/g, "-"),
      parent_id: payload.parentId || payload.parent_id || "",
      usage_scope: payload.usageScope || payload.usage_scope || "inventory",
      ai_keywords_json: toJson(payload.aiKeywords || payload.ai_keywords || []),
      status: "active",
      version: 1
    });
    return camel(category);
  }

  listDrafts(query = {}, access) {
    const params = { tenant_id: access.tenantId, limit: number(query.limit, 100) };
    const where = ["tenant_id = @tenant_id"];
    const branchId = query.branchId || query.branch_id || "";
    if (branchId) {
      tenantService.assertBranchAccess(access, branchId);
      where.push("branch_id = @branch_id");
      params.branch_id = branchId;
    }
    if (query.status) {
      where.push("status = @status");
      params.status = query.status;
    }
    if (query.q) {
      where.push("(supplier_name LIKE @q OR bill_no LIKE @q OR supplier_gstin LIKE @q)");
      params.q = `%${query.q}%`;
    }
    return db.prepare(`SELECT d.*,
        (SELECT COUNT(*) FROM purchase_bill_draft_items i WHERE i.tenant_id = d.tenant_id AND i.draft_id = d.id) item_count,
        (SELECT COUNT(*) FROM purchase_bill_draft_items i WHERE i.tenant_id = d.tenant_id AND i.draft_id = d.id AND i.is_new_product = 1) new_product_count
      FROM purchase_bill_drafts d
      WHERE ${where.join(" AND ")}
      ORDER BY d.created_at DESC
      LIMIT @limit`)
      .all(params)
      .map((row) => ({ ...camel(row), warnings: parseJson(row.warnings_json, []) }));
  }

  getDraft(id, access) {
    const row = getSnake("purchase_bill_drafts", id, access);
    const items = listDraftItems(id, access);
    const taxBreakup = draftTaxBreakup(row, items);
    return {
      ...camel(row),
      ...taxBreakup,
      warnings: parseJson(row.warnings_json, []),
      extraction: parseJson(row.extraction_json, {}),
      poMatch: parseJson(row.po_match_json, {}),
      confirmedInventory: parseJson(row.confirmed_inventory_json, []),
      attachmentPreview: attachmentPreview(row),
      items
    };
  }

  async createFromUpload(payload = {}, access) {
    requireManager(access);
    this.ensureDefaultCategories(access);
    const branchId = payload.branchId || payload.branch_id || access.requestedBranchId || access.branchId || "";
    if (!branchId) throw badRequest("branchId is required");
    tenantService.assertBranchAccess(access, branchId);
    const extracted = await purchaseBillAiService.extract(payload);
    const supplierId = payload.supplierId || payload.supplier_id || this.matchSupplier(extracted, access)?.id || "";
    const draftId = makeId("pbd");
    const key = supplierKey({
      supplierId,
      supplierName: extracted.supplierName || payload.supplierName || "",
      supplierGstin: extracted.supplierGstin || payload.supplierGstin || ""
    });
    const attachment = saveAttachment(draftId, payload, access, branchId);
    const normalizedItems = this.normalizeExtractedItems(extracted.items || [], access, branchId, supplierId);
    const totals = this.totalsFromItems(normalizedItems, extracted);
    const warnings = [
      ...(Array.isArray(extracted.warnings) ? extracted.warnings : []),
      ...this.duplicateWarnings({ ...extracted, supplierId, supplierKey: key, branchId }, access),
      ...this.totalWarnings(totals)
    ];
    const draft = db.transaction(() => {
      const row = insertSnake("purchase_bill_drafts", {
        id: draftId,
        tenant_id: access.tenantId,
        branch_id: branchId,
        supplier_id: supplierId,
        supplier_key: key,
        supplier_name: extracted.supplierName || payload.supplierName || "",
        supplier_gstin: extracted.supplierGstin || payload.supplierGstin || "",
        supplier_phone: extracted.supplierPhone || payload.supplierPhone || payload.phone || "",
        supplier_email: extracted.supplierEmail || payload.supplierEmail || payload.email || "",
        supplier_address: extracted.supplierAddress || payload.supplierAddress || payload.address || "",
        purchase_order_id: payload.purchaseOrderId || payload.purchase_order_id || "",
        po_match_json: toJson({}),
        bill_no: extracted.billNo || payload.billNo || "",
        bill_date: extracted.billDate || payload.billDate || "",
        status: "draft",
        source_type: attachment ? "photo_upload" : "manual_upload",
        ai_provider: extracted.provider || payload.aiProvider || "local",
        ai_confidence: number(extracted.confidence, 0),
        subtotal: totals.subtotal,
        gst_amount: totals.gstAmount,
        cgst_amount: totals.cgstAmount,
        sgst_amount: totals.sgstAmount,
        igst_amount: totals.igstAmount,
        total_amount: totals.totalAmount,
        mismatch_amount: totals.mismatchAmount,
        validation_status: warnings.length ? "needs_review" : "ready",
        image_path: attachment?.filePath || "",
        original_file_name: attachment?.originalFileName || payload.fileName || "",
        raw_text: extracted.rawText || payload.extractedText || payload.rawText || "",
        extraction_json: toJson(extracted),
        warnings_json: toJson(warnings),
        version: 1
      });
      if (attachment) {
        insertSnake("purchase_bill_attachments", {
          id: makeId("pba"),
          tenant_id: access.tenantId,
          branch_id: branchId,
          draft_id: draftId,
          file_path: attachment.filePath,
          original_file_name: attachment.originalFileName,
          mime_type: attachment.mimeType,
          file_size: attachment.fileSize,
          checksum: attachment.checksum,
          status: "active"
        });
      }
      for (const item of normalizedItems.length ? normalizedItems : [this.blankItem(branchId, 1)]) {
        this.insertItem(draftId, item, access, branchId);
      }
      return row;
    })();
    auditDecision("inventory.purchase_bill_draft_created", "purchase_bill_draft", draftId, access, { branchId, details: { itemCount: normalizedItems.length, billNo: draft.bill_no } });
    emitEvent("inventory:purchase_bill_draft_created", access, branchId, draftId, { status: "draft" });
    return this.getDraft(draftId, access);
  }

  updateDraft(id, payload = {}, access) {
    requireManager(access);
    const draft = getSnake("purchase_bill_drafts", id, access);
    assertDraftEditable(draft);
    const supplierId = payload.supplierId ?? payload.supplier_id ?? draft.supplier_id;
    const supplierName = payload.supplierName ?? payload.supplier_name ?? draft.supplier_name;
    const supplierGstin = payload.supplierGstin ?? payload.supplier_gstin ?? draft.supplier_gstin;
    const supplierPhone = payload.supplierPhone ?? payload.supplier_phone ?? draft.supplier_phone;
    const supplierEmail = payload.supplierEmail ?? payload.supplier_email ?? draft.supplier_email;
    const supplierAddress = payload.supplierAddress ?? payload.supplier_address ?? draft.supplier_address;
    const updated = updateSnake("purchase_bill_drafts", id, access, {
      supplier_id: supplierId,
      supplier_key: supplierKey({ supplierId, supplierName, supplierGstin }),
      supplier_name: supplierName,
      supplier_gstin: supplierGstin,
      supplier_phone: supplierPhone,
      supplier_email: supplierEmail,
      supplier_address: supplierAddress,
      purchase_order_id: payload.purchaseOrderId ?? payload.purchase_order_id ?? draft.purchase_order_id ?? "",
      bill_no: payload.billNo ?? payload.bill_no ?? draft.bill_no,
      bill_date: payload.billDate ?? payload.bill_date ?? draft.bill_date,
      subtotal: money(payload.subtotal ?? draft.subtotal),
      gst_amount: money(payload.gstAmount ?? payload.gst_amount ?? draft.gst_amount),
      cgst_amount: money(payload.cgstAmount ?? payload.cgst_amount ?? draft.cgst_amount),
      sgst_amount: money(payload.sgstAmount ?? payload.sgst_amount ?? draft.sgst_amount),
      igst_amount: money(payload.igstAmount ?? payload.igst_amount ?? draft.igst_amount),
      total_amount: money(payload.totalAmount ?? payload.total_amount ?? draft.total_amount),
      version: number(draft.version, 1) + 1
    });
    this.refreshDraftValidation(id, access);
    return this.getDraft(updated.id, access);
  }

  addItem(id, payload = {}, access) {
    requireManager(access);
    const draft = getSnake("purchase_bill_drafts", id, access);
    assertDraftEditable(draft);
    const count = db.prepare("SELECT COUNT(*) count FROM purchase_bill_draft_items WHERE tenant_id = ? AND draft_id = ?").get(access.tenantId, id).count;
    this.insertItem(id, this.normalizeItem(payload, access, draft.branch_id, draft.supplier_id, count + 1), access, draft.branch_id);
    this.refreshDraftValidation(id, access);
    return this.getDraft(id, access);
  }

  updateItem(draftId, itemId, payload = {}, access) {
    requireManager(access);
    const draft = getSnake("purchase_bill_drafts", draftId, access);
    assertDraftEditable(draft);
    const existing = db.prepare("SELECT * FROM purchase_bill_draft_items WHERE id = ? AND draft_id = ? AND tenant_id = ?").get(itemId, draftId, access.tenantId);
    if (!existing) throw notFound("Draft item not found");
    const merged = this.normalizeItem({ ...camel(existing), ...payload }, access, draft.branch_id, draft.supplier_id, existing.line_no);
    updateSnake("purchase_bill_draft_items", itemId, access, {
      product_id: merged.product_id,
      matched_product_id: merged.matched_product_id,
      match_status: merged.match_status,
      match_confidence: merged.match_confidence,
      is_new_product: merged.is_new_product,
      raw_name: merged.raw_name,
      product_name: merged.product_name,
      category_id: merged.category_id,
      category_name: merged.category_name,
      usage_type: merged.usage_type,
      stock_unit: merged.stock_unit,
      purchase_unit: merged.purchase_unit,
      pack_size: merged.pack_size,
      conversion_factor: merged.conversion_factor,
      qty: merged.qty,
      stock_qty: merged.stock_qty,
      unit_cost: merged.unit_cost,
      mrp: merged.mrp,
      hsn_sac: merged.hsn_sac,
      discount_percent: merged.discount_percent,
      discount_amount: merged.discount_amount,
      gst_percent: merged.gst_percent,
      taxable_amount: merged.taxable_amount,
      gst_amount: merged.gst_amount,
      cgst_amount: merged.cgst_amount,
      sgst_amount: merged.sgst_amount,
      igst_amount: merged.igst_amount,
      line_total: merged.line_total,
      batch_number: merged.batch_number,
      expiry_date: merged.expiry_date,
      supplier_sku: merged.supplier_sku,
      warnings_json: merged.warnings_json,
      match_suggestions_json: merged.product_id ? toJson([]) : merged.match_suggestions_json,
      version: number(existing.version, 1) + 1
    });
    this.refreshDraftValidation(draftId, access);
    return this.getDraft(draftId, access);
  }

  saveSupplierForDraft(id, payload = {}, access) {
    requireManager(access);
    const draft = getSnake("purchase_bill_drafts", id, access);
    assertDraftEditable(draft);
    const extraction = parseJson(draft.extraction_json, {});
    const details = supplierDetailsFromDraft(draft, extraction, payload);
    const supplierName = details.name;
    const supplierGstin = details.gstin;
    if (!supplierName) throw badRequest("Supplier name is required before saving supplier");
    const matched = this.matchSupplier({ supplierName, supplierGstin }, access);
    const reason = `Created from AI Purchase Bill Draft ${draft.bill_no || draft.id}`;
    const supplier = fillMissingSupplierDetails(matched, details, access, reason) || intelligentInventoryService.createSupplier({
      name: supplierName,
      gstin: supplierGstin,
      phone: details.phone,
      email: details.email,
      address: details.address,
      status: "active",
      statusReason: reason
    }, access);
    updateSnake("purchase_bill_drafts", id, access, {
      supplier_id: supplier.id,
      supplier_key: supplierKey({ supplierId: supplier.id, supplierName: supplier.name, supplierGstin: supplier.gstin || supplierGstin }),
      supplier_name: supplier.name || supplierName,
      supplier_gstin: supplier.gstin || supplierGstin,
      supplier_phone: draft.supplier_phone || details.phone,
      supplier_email: draft.supplier_email || details.email,
      supplier_address: draft.supplier_address || details.address,
      version: number(draft.version, 1) + 1
    });
    this.refreshDraftValidation(id, access);
    auditDecision("inventory.purchase_bill_supplier_saved", "purchase_bill_draft", id, access, {
      branchId: draft.branch_id,
      details: { supplierId: supplier.id, matchedExisting: Boolean(matched) }
    });
    return this.getDraft(id, access);
  }

  createProductFromDraftItem(draftId, itemId, payload = {}, access) {
    requireManager(access);
    const draft = getSnake("purchase_bill_drafts", draftId, access);
    assertDraftEditable(draft);
    const existing = db.prepare("SELECT * FROM purchase_bill_draft_items WHERE id = ? AND draft_id = ? AND tenant_id = ?").get(itemId, draftId, access.tenantId);
    if (!existing) throw notFound("Draft item not found");
    const merged = this.normalizeItem({ ...camel(existing), ...payload, productId: "", product_id: "" }, access, draft.branch_id, draft.supplier_id, existing.line_no);
    const issues = this.itemReviewIssues({ ...camel(existing), ...camel(merged), productId: "", product_id: "" });
    if (issues.length) throw badRequest("New product details need review before product creation", issues);
    const productId = this.createProductForItem(camel(merged), draft, draft.supplier_id, access);
    if (!productId) throw badRequest("Product could not be created from this draft line");
    this.upsertAlias({ ...camel(merged), productId, supplierId: draft.supplier_id, branchId: draft.branch_id, matchConfidence: 1 }, access);
    updateSnake("purchase_bill_draft_items", itemId, access, {
      product_id: productId,
      matched_product_id: productId,
      match_status: "created_product",
      match_confidence: 1,
      is_new_product: 0,
      raw_name: merged.raw_name,
      product_name: merged.product_name,
      category_id: merged.category_id,
      category_name: merged.category_name,
      usage_type: merged.usage_type,
      stock_unit: merged.stock_unit,
      purchase_unit: merged.purchase_unit,
      pack_size: merged.pack_size,
      conversion_factor: merged.conversion_factor,
      qty: merged.qty,
      stock_qty: merged.stock_qty,
      unit_cost: merged.unit_cost,
      mrp: merged.mrp,
      hsn_sac: merged.hsn_sac,
      discount_percent: merged.discount_percent,
      discount_amount: merged.discount_amount,
      gst_percent: merged.gst_percent,
      taxable_amount: merged.taxable_amount,
      gst_amount: merged.gst_amount,
      cgst_amount: merged.cgst_amount,
      sgst_amount: merged.sgst_amount,
      igst_amount: merged.igst_amount,
      line_total: merged.line_total,
      batch_number: merged.batch_number,
      expiry_date: merged.expiry_date,
      supplier_sku: merged.supplier_sku,
      warnings_json: toJson([]),
      match_suggestions_json: toJson([]),
      version: number(existing.version, 1) + 1
    });
    this.refreshDraftValidation(draftId, access);
    auditDecision("inventory.purchase_bill_product_created", "purchase_bill_draft_item", itemId, access, {
      branchId: draft.branch_id,
      details: { draftId, productId }
    });
    return this.getDraft(draftId, access);
  }

  cancelDraft(id, payload = {}, access) {
    requireManager(access);
    const draft = getSnake("purchase_bill_drafts", id, access);
    if (draft.status === "confirmed") throw conflict("Confirmed drafts cannot be cancelled");
    updateSnake("purchase_bill_drafts", id, access, {
      status: "cancelled",
      warnings_json: toJson([...(parseJson(draft.warnings_json, [])), payload.reason || "Cancelled before stock update"]),
      version: number(draft.version, 1) + 1
    });
    auditDecision("inventory.purchase_bill_draft_cancelled", "purchase_bill_draft", id, access, { branchId: draft.branch_id, details: { reason: payload.reason || "" } });
    return this.getDraft(id, access);
  }

  matchPurchaseOrder(id, payload = {}, access) {
    requireManager(access);
    const draft = getSnake("purchase_bill_drafts", id, access);
    if (draft.status === "cancelled") throw conflict("Cancelled drafts cannot be matched to a PO");
    const explicitPoId = payload.purchaseOrderId || payload.purchase_order_id || "";
    const params = { tenant_id: access.tenantId, branch_id: draft.branch_id, limit: number(payload.limit, 100) };
    const where = ["tenant_id = @tenant_id", "branch_id = @branch_id"];
    if (explicitPoId) {
      where.push("id = @id");
      params.id = explicitPoId;
    } else {
      where.push("status IN ('draft', 'approved', 'sent', 'partial_receive', 'closed')");
    }
    const candidates = db.prepare(`SELECT * FROM purchase_orders WHERE ${where.join(" AND ")} ORDER BY updated_at DESC LIMIT @limit`).all(params);
    if (!candidates.length) throw notFound("No purchase order found for this bill draft");
    const matches = candidates.map((po) => {
      const poItems = db.prepare("SELECT * FROM purchase_order_items WHERE tenant_id = ? AND purchase_order_id = ?").all(access.tenantId, po.id);
      return inventoryEnterpriseService.scoreBillDraftAgainstPo(draft, po, poItems, access);
    }).sort((a, b) => b.score - a.score);
    const best = matches[0];
    if (!best?.draftId) throw notFound("No purchase order match found");
    const linkedPo = explicitPoId || best.score >= 30 ? candidates.find((po) => po.id === (explicitPoId || best.purchaseOrderId)) || candidates[0] : null;
    const matchPayload = { ...best, candidates: matches.slice(0, 5), linkedPurchaseOrderId: linkedPo?.id || "" };
    updateSnake("purchase_bill_drafts", id, access, {
      purchase_order_id: linkedPo?.id || "",
      po_match_json: toJson(matchPayload),
      warnings_json: toJson([
        ...parseJson(draft.warnings_json, []),
        ...(best.warnings || []).map((warning) => warning.message || warning.type).filter(Boolean)
      ]),
      version: number(draft.version, 1) + 1
    });
    auditDecision("inventory.purchase_bill_po_matched", "purchase_bill_draft", id, access, {
      branchId: draft.branch_id,
      details: { purchaseOrderId: linkedPo?.id || "", score: best.score }
    });
    return this.getDraft(id, access);
  }

  confirmDraft(id, payload = {}, access) {
    requireManager(access);
    const draft = getSnake("purchase_bill_drafts", id, access);
    assertDraftEditable(draft);
    const rows = db.prepare("SELECT * FROM purchase_bill_draft_items WHERE tenant_id = ? AND draft_id = ? AND status <> 'cancelled' ORDER BY line_no ASC").all(access.tenantId, id);
    if (!rows.length) throw badRequest("At least one bill item is required");
    this.validateDraftForConfirm(draft, rows);
    const duplicate = this.confirmedDuplicate(draft, access);
    if (duplicate) throw conflict("This supplier bill is already confirmed. Stock was not added again.", { duplicateId: duplicate.id });
    if (draft.purchase_order_id) {
      return this.confirmDraftAgainstPurchaseOrder(draft, rows, payload, access);
    }
    const confirmed = db.transaction(() => {
      const movements = [];
      const supplierId = this.resolveSupplierForConfirm(draft, access);
      const key = supplierKey({ supplierId, supplierName: draft.supplier_name, supplierGstin: draft.supplier_gstin });
      updateSnake("purchase_bill_drafts", id, access, { supplier_id: supplierId, supplier_key: key });
      if (draft.bill_no && key) {
        const duplicateAfterSupplier = db.prepare(`SELECT id FROM purchase_bill_drafts
          WHERE tenant_id = @tenant_id AND branch_id = @branch_id AND supplier_key = @supplier_key AND bill_no = @bill_no AND status = 'confirmed' AND id <> @id
          LIMIT 1`).get({
          tenant_id: access.tenantId,
          branch_id: draft.branch_id,
          supplier_key: key,
          bill_no: draft.bill_no,
          id
        });
        if (duplicateAfterSupplier) throw conflict("This supplier bill is already confirmed. Stock was not added again.", { duplicateId: duplicateAfterSupplier.id });
      }
      for (const row of rows) {
        const item = camel(row);
        this.validateItemForConfirm(item, draft);
        const productId = item.productId || this.createProductForItem(item, draft, supplierId, access);
        if (!productId) throw badRequest(`Product is required for line ${item.lineNo}`);
        const product = repositories.products.getById(productId, scope(access));
        if (!product) throw notFound(`Product not found for line ${item.lineNo}`);
        const quantity = number(item.stockQty || item.qty, 0);
        if (quantity <= 0) throw badRequest(`Quantity must be greater than zero for ${item.productName || item.rawName}`);
        const entry = intelligentInventoryService.purchaseEntry({
          productId,
          branchId: draft.branch_id,
          supplierId,
          batchNumber: item.batchNumber || `BILL-${draft.bill_no || id}-${item.lineNo}`,
          expiryDate: item.expiryDate || "",
          quantity,
          unitCost: item.unitCost || product.unitCost || 0,
          reason: `AI Purchase Bill Draft ${draft.bill_no || id}`
        }, access);
        this.upsertAlias({ ...item, productId, supplierId, branchId: draft.branch_id }, access);
        updateSnake("purchase_bill_draft_items", row.id, access, {
          product_id: productId,
          matched_product_id: productId,
          is_new_product: 0,
          match_status: item.matchStatus === "new_product" ? "created_product" : "confirmed",
          status: "confirmed",
          version: number(row.version, 1) + 1
        });
        movements.push({ itemId: row.id, productId, quantity, batchId: entry.batch.id, transactionId: entry.transaction.id });
      }
      updateSnake("purchase_bill_drafts", id, access, {
        status: "confirmed",
        validation_status: "confirmed",
        confirmed_at: now(),
        confirmed_by: access.userId || access.role || "",
        confirmed_inventory_json: toJson(movements),
        version: number(draft.version, 1) + 1
      });
      return movements;
    })();
    auditDecision("inventory.purchase_bill_draft_confirmed", "purchase_bill_draft", id, access, { branchId: draft.branch_id, details: { movementCount: confirmed.length, billNo: draft.bill_no } });
    emitEvent("inventory:purchase_bill_draft_confirmed", access, draft.branch_id, id, { movementCount: confirmed.length });
    return this.getDraft(id, access);
  }

  confirmDraftAgainstPurchaseOrder(draft, rows = [], payload = {}, access) {
    const po = db.prepare("SELECT * FROM purchase_orders WHERE id = ? AND tenant_id = ?").get(draft.purchase_order_id, access.tenantId);
    if (!po) throw notFound("Linked purchase order not found");
    if (!["approved", "sent", "partial_receive"].includes(po.status)) {
      throw conflict("Linked PO must be approved or sent before bill confirmation can receive stock");
    }
    const poItems = db.prepare("SELECT * FROM purchase_order_items WHERE tenant_id = ? AND purchase_order_id = ?").all(access.tenantId, po.id);
    const supplierId = this.resolveSupplierForConfirm(draft, access);
    const key = supplierKey({ supplierId, supplierName: draft.supplier_name, supplierGstin: draft.supplier_gstin });
    const receiveItems = rows.map((row) => {
      const item = camel(row);
      this.validateItemForConfirm(item, draft);
      const productId = item.productId || item.matchedProductId;
      const name = normalizeText(item.productName || item.rawName || "");
      const poItem = poItems.find((entry) => productId && entry.product_id === productId)
        || poItems.find((entry) => name && normalizeText(entry.product_name).includes(name))
        || poItems.find((entry) => name && name.includes(normalizeText(entry.product_name)));
      if (!poItem) throw badRequest(`Bill line ${item.lineNo} is not matched to the linked PO`);
      return {
        sourceRowId: row.id,
        itemId: poItem.id,
        productId: poItem.product_id,
        quantity: number(item.stockQty || item.qty, 0),
        unitCost: number(item.unitCost || poItem.unit_cost, 0),
        gstPercent: number(item.gstPercent || poItem.gst_percent, 18),
        discountPercent: number(item.discountPercent || poItem.discount_percent, 0),
        batchNumber: item.batchNumber || `BILL-${draft.bill_no || draft.id}-${item.lineNo}`,
        expiryDate: item.expiryDate || ""
      };
    });
    const receipt = inventoryEnterpriseService.receivePurchaseOrder(po.id, {
      supplierInvoiceNo: draft.bill_no,
      supplierInvoiceDate: draft.bill_date,
      challanNo: payload.challanNo || payload.challan_no || "",
      grnNumber: payload.grnNumber || payload.grn_number || `GRN-${draft.bill_no || draft.id}`,
      grnDate: payload.grnDate || payload.grn_date || draft.bill_date || new Date().toISOString().slice(0, 10),
      receivedBy: payload.receivedBy || payload.received_by || access.userId || access.role || "",
      note: `AI Purchase Bill Draft ${draft.bill_no || draft.id} matched to PO ${po.po_number}`,
      items: receiveItems
    }, access);
    const confirmed = db.transaction(() => {
      updateSnake("purchase_bill_drafts", draft.id, access, {
        supplier_id: supplierId,
        supplier_key: key,
        status: "confirmed",
        validation_status: "confirmed",
        confirmed_at: now(),
        confirmed_by: access.userId || access.role || "",
        confirmed_inventory_json: toJson(receipt.received || []),
        po_match_json: toJson({
          ...(parseJson(draft.po_match_json, {})),
          confirmedViaPurchaseOrder: true,
          purchaseOrderId: po.id,
          purchaseOrderNumber: po.po_number,
          grnNumber: receipt.purchaseOrder?.grnNumber || ""
        }),
        version: number(draft.version, 1) + 1
      });
      for (const received of receiveItems) {
        updateSnake("purchase_bill_draft_items", received.sourceRowId, access, {
          product_id: received.productId,
          matched_product_id: received.productId,
          is_new_product: 0,
          match_status: "confirmed_po_match",
          status: "confirmed"
        });
      }
      return receipt.received || [];
    })();
    auditDecision("inventory.purchase_bill_draft_confirmed_against_po", "purchase_bill_draft", draft.id, access, {
      branchId: draft.branch_id,
      details: { purchaseOrderId: po.id, movementCount: confirmed.length, billNo: draft.bill_no }
    });
    emitEvent("inventory:purchase_bill_draft_confirmed", access, draft.branch_id, draft.id, { movementCount: confirmed.length, purchaseOrderId: po.id });
    return this.getDraft(draft.id, access);
  }

  validateDraftForConfirm(draft, rows = []) {
    const messages = [];
    if (!draft.branch_id) messages.push("Branch is required before confirmation.");
    if (!String(draft.bill_no || "").trim()) messages.push("Bill number is required to prevent duplicate stock receiving.");
    if (!String(draft.supplier_id || draft.supplier_name || draft.supplier_gstin || "").trim()) messages.push("Supplier name, supplier ID or GSTIN is required before confirmation.");
    for (const row of rows) {
      messages.push(...this.itemReviewIssues(camel(row)));
    }
    confirmValidationError([...new Set(messages)]);
  }

  validateItemForConfirm(item = {}) {
    confirmValidationError(this.itemReviewIssues(item));
  }

  itemReviewIssues(item = {}) {
    const line = item.lineNo || item.line_no || "?";
    const productName = String(item.productName || item.product_name || item.rawName || item.raw_name || "").trim();
    const productId = item.productId || item.product_id || "";
    const usageType = safeUsage(item.usageType || item.usage_type || "");
    const issues = [];
    if (!productName) issues.push(`Line ${line}: product name is required.`);
    if (!productId && !String(item.categoryId || item.category_id || item.categoryName || item.category_name || "").trim()) {
      issues.push(`Line ${line}: category is required for new products.`);
    }
    if (!String(item.purchaseUnit || item.purchase_unit || "").trim()) issues.push(`Line ${line}: purchase unit is required.`);
    if (!String(item.stockUnit || item.stock_unit || "").trim()) issues.push(`Line ${line}: stock unit is required.`);
    if (number(item.conversionFactor ?? item.conversion_factor, 0) <= 0) issues.push(`Line ${line}: unit conversion must be greater than zero.`);
    if (number(item.qty, 0) <= 0 || number(item.stockQty ?? item.stock_qty, 0) <= 0) issues.push(`Line ${line}: quantity must be greater than zero.`);
    if (number(item.unitCost ?? item.unit_cost, 0) <= 0) issues.push(`Line ${line}: cost price is required.`);
    if (!Number.isFinite(number(item.gstPercent ?? item.gst_percent, NaN))) issues.push(`Line ${line}: GST percent is required.`);
    if (!productId && ["retail", "both"].includes(usageType) && number(item.mrp, 0) <= 0) {
      issues.push(`Line ${line}: MRP is required for retail products.`);
    }
    return issues;
  }

  normalizeExtractedItems(items = [], access, branchId, supplierId) {
    return items.map((item, index) => this.normalizeItem(item, access, branchId, supplierId, index + 1));
  }

  normalizeItem(item = {}, access, branchId, supplierId, lineNo = 1) {
    const rawName = String(item.rawName || item.raw_name || item.productName || item.product_name || "").trim();
    const productName = String(item.productName || item.product_name || rawName).trim();
    const categories = this.listCategories({ branchId }, access).map((category) => ({ ...category, ai_keywords_json: toJson(category.aiKeywordsJson || []) }));
    const explicitProductId = item.productId || item.product_id || "";
    const suggestions = explicitProductId ? [] : this.productSuggestions(rawName || productName, access, branchId, supplierId);
    const match = explicitProductId ? { productId: explicitProductId, status: "manual_match", confidence: 1, product: repositories.products.getById(explicitProductId, scope(access)) } : this.matchProduct(rawName || productName, access, branchId, supplierId, suggestions);
    const category = item.categoryId || item.category_id
      ? categories.find((row) => row.id === (item.categoryId || item.category_id))
      : categoryGuess(`${productName} ${match.product?.category || ""}`, categories);
    const categoryName = item.categoryName || item.category_name || category?.name || match.product?.category || "";
    const usageType = safeUsage(item.usageType || item.usage_type || match.product?.usageType || usageGuess(productName, categoryName));
    const calculations = lineCalculations(item);
    const warnings = [];
    if (!productName && !rawName) warnings.push("Product name is required before confirmation");
    if (!match.productId) warnings.push("New product details must be reviewed");
    if (!categoryName) warnings.push("Category is required before confirmation");
    if (["retail", "both"].includes(usageType) && !number(item.mrp ?? item.price ?? match.product?.price ?? 0)) warnings.push("MRP is required for retail products");
    if (!calculations.qty) warnings.push("Quantity is missing");
    return {
      line_no: lineNo,
      product_id: explicitProductId || (match.confidence >= 0.88 ? match.productId : ""),
      matched_product_id: match.productId || "",
      match_status: match.status,
      match_confidence: money(match.confidence),
      is_new_product: match.productId && match.confidence >= 0.88 ? 0 : 1,
      raw_name: rawName,
      product_name: productName || match.product?.name || rawName,
      category_id: item.categoryId || item.category_id || category?.id || "",
      category_name: categoryName,
      usage_type: usageType,
      stock_unit: safeUnit(item.stockUnit || item.stock_unit || item.purchaseUnit || item.purchase_unit),
      purchase_unit: safeUnit(item.purchaseUnit || item.purchase_unit || item.stockUnit || item.stock_unit),
      pack_size: number(item.packSize || item.pack_size, calculations.conversionFactor),
      conversion_factor: calculations.conversionFactor,
      qty: calculations.qty,
      stock_qty: calculations.stockQty,
      unit_cost: calculations.unitCost,
      mrp: money(item.mrp ?? item.price ?? match.product?.price ?? 0),
      hsn_sac: item.hsnSac || item.hsn_sac || item.hsn || "",
      discount_percent: calculations.discountPercent,
      discount_amount: calculations.discountAmount,
      gst_percent: calculations.gstPercent,
      taxable_amount: calculations.taxableAmount,
      gst_amount: calculations.gstAmount,
      cgst_amount: calculations.cgstAmount,
      sgst_amount: calculations.sgstAmount,
      igst_amount: calculations.igstAmount,
      line_total: calculations.lineTotal,
      batch_number: item.batchNumber || item.batch_number || "",
      expiry_date: item.expiryDate || item.expiry_date || "",
      supplier_sku: item.supplierSku || item.supplier_sku || "",
      warnings_json: toJson(warnings),
      match_suggestions_json: toJson(suggestions),
      status: item.status || "open",
      version: 1
    };
  }

  insertItem(draftId, item, access, branchId) {
    return insertSnake("purchase_bill_draft_items", {
      id: makeId("pbdi"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      draft_id: draftId,
      ...item
    });
  }

  blankItem(branchId, lineNo = 1) {
    return {
      line_no: lineNo,
      product_id: "",
      matched_product_id: "",
      match_status: "new_product",
      match_confidence: 0,
      is_new_product: 1,
      raw_name: "",
      product_name: "",
      category_id: "",
      category_name: "",
      usage_type: "retail",
      stock_unit: "pcs",
      purchase_unit: "pcs",
      pack_size: 1,
      conversion_factor: 1,
      qty: 0,
      stock_qty: 0,
      unit_cost: 0,
      mrp: 0,
      hsn_sac: "",
      discount_percent: 0,
      discount_amount: 0,
      gst_percent: 18,
      taxable_amount: 0,
      gst_amount: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      line_total: 0,
      batch_number: `BILL-${branchId}-${Date.now()}`,
      expiry_date: "",
      supplier_sku: "",
      warnings_json: toJson(["Product name is required before confirmation"]),
      match_suggestions_json: toJson([]),
      status: "open",
      version: 1
    };
  }

  matchSupplier(extracted = {}, access) {
    const gstin = String(extracted.supplierGstin || "").trim().toUpperCase();
    const name = normalizeText(extracted.supplierName || "");
    return repositories.suppliers.list({ limit: 10000 }, scope(access)).find((supplier) => {
      if (gstin && String(supplier.gstin || "").trim().toUpperCase() === gstin) return true;
      return name && normalizeText(supplier.name || "") === name;
    }) || null;
  }

  productSuggestions(rawName = "", access, branchId = "", supplierId = "") {
    const name = normalizeText(rawName);
    if (!name) return [];
    const results = [];
    const alias = db.prepare(`SELECT * FROM product_supplier_aliases
      WHERE tenant_id = @tenant_id AND status = 'active' AND normalized_name = @normalized_name
      AND (supplier_id = '' OR supplier_id = @supplier_id)
      ORDER BY supplier_id DESC, confidence DESC LIMIT 1`)
      .get({ tenant_id: access.tenantId, normalized_name: name, supplier_id: supplierId || "" });
    if (alias) {
      const product = repositories.products.getById(alias.product_id, scope(access));
      if (product) {
        results.push({
          productId: product.id,
          name: product.name,
          sku: product.sku || "",
          category: product.category || "",
          usageType: product.usageType || "",
          confidence: Math.max(0.9, number(alias.confidence, 0.9)),
          status: "alias_match"
        });
      }
    }
    const products = repositories.products.list({ limit: 10000 }, scope(access))
      .filter((product) => !branchId || !product.branchId || product.branchId === branchId);
    for (const product of products) {
      const productName = normalizeText(product.name || "");
      let confidence = 0;
      if (productName === name) confidence = 0.98;
      else if (productName.includes(name) || name.includes(productName)) confidence = 0.86;
      else confidence = tokenScore(product.name, rawName) * 0.82;
      if (confidence >= 0.4) {
        results.push({
          productId: product.id,
          name: product.name,
          sku: product.sku || "",
          category: product.category || "",
          usageType: product.usageType || "",
          confidence: money(confidence),
          status: confidence >= 0.88 ? "exact_match" : confidence >= 0.55 ? "likely_match" : "weak_match"
        });
      }
    }
    const unique = new Map();
    for (const result of results.sort((a, b) => b.confidence - a.confidence)) {
      if (!unique.has(result.productId)) unique.set(result.productId, result);
    }
    return [...unique.values()].slice(0, 5);
  }

  matchProduct(rawName = "", access, branchId = "", supplierId = "", suggestions = null) {
    const matches = suggestions || this.productSuggestions(rawName, access, branchId, supplierId);
    const best = matches[0];
    if (!best || best.confidence < 0.55) return { productId: "", status: "new_product", confidence: 0, product: null };
    return {
      productId: best.productId,
      status: best.status === "weak_match" ? "likely_match" : best.status,
      confidence: best.confidence,
      product: repositories.products.getById(best.productId, scope(access))
    };
  }

  totalsFromItems(items = [], extracted = {}) {
    const itemSubtotal = money(items.reduce((sum, item) => sum + number(item.taxable_amount), 0));
    const itemGst = money(items.reduce((sum, item) => sum + number(item.gst_amount), 0));
    const itemCgst = money(items.reduce((sum, item) => sum + number(item.cgst_amount), 0));
    const itemSgst = money(items.reduce((sum, item) => sum + number(item.sgst_amount), 0));
    const itemIgst = money(items.reduce((sum, item) => sum + number(item.igst_amount), 0));
    const itemTotal = money(items.reduce((sum, item) => sum + number(item.line_total), 0));
    const subtotal = money(extracted.subtotal || itemSubtotal);
    const cgstAmount = pickMoney(extracted.cgstAmount ?? extracted.cgst_amount, itemCgst);
    const sgstAmount = pickMoney(extracted.sgstAmount ?? extracted.sgst_amount, itemSgst);
    const igstAmount = pickMoney(extracted.igstAmount ?? extracted.igst_amount, itemIgst);
    const gstAmount = pickMoney(extracted.gstAmount ?? extracted.gst_amount, cgstAmount + sgstAmount + igstAmount || itemGst);
    const totalAmount = money(extracted.totalAmount || extracted.total || itemTotal || subtotal + gstAmount);
    const mismatchAmount = money(itemTotal ? totalAmount - itemTotal : 0);
    return { subtotal, gstAmount, cgstAmount, sgstAmount, igstAmount, totalAmount, itemTotal, mismatchAmount };
  }

  totalWarnings(totals = {}) {
    return Math.abs(number(totals.mismatchAmount)) > 1
      ? [`Bill total differs from item total by ${money(totals.mismatchAmount)}. Review discount, rounding or missing lines.`]
      : [];
  }

  duplicateWarnings(extracted = {}, access) {
    if (!extracted.billNo || !extracted.supplierKey) return [];
    const duplicate = db.prepare(`SELECT id FROM purchase_bill_drafts
      WHERE tenant_id = @tenant_id AND branch_id = @branch_id AND supplier_key = @supplier_key AND bill_no = @bill_no AND status = 'confirmed'
      LIMIT 1`).get({
      tenant_id: access.tenantId,
      branch_id: extracted.branchId,
      supplier_key: extracted.supplierKey,
      bill_no: extracted.billNo
    });
    return duplicate ? ["This supplier bill is already confirmed; confirmation will be blocked to protect stock."] : [];
  }

  confirmedDuplicate(draft, access) {
    if (!draft.bill_no || !draft.supplier_key) return null;
    return db.prepare(`SELECT id FROM purchase_bill_drafts
      WHERE tenant_id = @tenant_id AND branch_id = @branch_id AND supplier_key = @supplier_key AND bill_no = @bill_no AND status = 'confirmed' AND id <> @id
      LIMIT 1`).get({
      tenant_id: access.tenantId,
      branch_id: draft.branch_id,
      supplier_key: draft.supplier_key,
      bill_no: draft.bill_no,
      id: draft.id
    });
  }

  refreshDraftValidation(id, access) {
    const draft = getSnake("purchase_bill_drafts", id, access);
    const rows = db.prepare("SELECT * FROM purchase_bill_draft_items WHERE tenant_id = ? AND draft_id = ?").all(access.tenantId, id);
    const normalizedRows = rows.map(camel);
    const totals = this.totalsFromItems(normalizedRows.map((row) => ({
      taxable_amount: row.taxableAmount,
      gst_amount: row.gstAmount,
      cgst_amount: row.cgstAmount,
      sgst_amount: row.sgstAmount,
      igst_amount: row.igstAmount,
      line_total: row.lineTotal
    })), {
      subtotal: draft.subtotal,
      gstAmount: draft.gst_amount,
      cgstAmount: draft.cgst_amount,
      sgstAmount: draft.sgst_amount,
      igstAmount: draft.igst_amount,
      totalAmount: draft.total_amount
    });
    const itemWarnings = rows.flatMap((row) => parseJson(row.warnings_json, []));
    const warnings = [...new Set([...itemWarnings, ...this.totalWarnings(totals), ...this.duplicateWarnings({ ...camel(draft), supplierKey: draft.supplier_key, branchId: draft.branch_id, billNo: draft.bill_no }, access)])];
    updateSnake("purchase_bill_drafts", id, access, {
      subtotal: totals.subtotal,
      gst_amount: totals.gstAmount,
      cgst_amount: totals.cgstAmount,
      sgst_amount: totals.sgstAmount,
      igst_amount: totals.igstAmount,
      total_amount: totals.totalAmount,
      mismatch_amount: totals.mismatchAmount,
      validation_status: warnings.length ? "needs_review" : "ready",
      warnings_json: toJson(warnings)
    });
  }

  resolveSupplierForConfirm(draft, access) {
    const extraction = parseJson(draft.extraction_json, {});
    const details = supplierDetailsFromDraft(draft, extraction);
    const reason = `Created from AI Purchase Bill Draft ${draft.bill_no || draft.id}`;
    if (draft.supplier_id) {
      const linked = repositories.suppliers.getById(draft.supplier_id, scope(access));
      return linked ? fillMissingSupplierDetails(linked, details, access, reason).id : draft.supplier_id;
    }
    const matched = this.matchSupplier({ supplierName: draft.supplier_name, supplierGstin: draft.supplier_gstin }, access);
    if (matched) return fillMissingSupplierDetails(matched, details, access, reason).id;
    if (!draft.supplier_name) return "";
    return intelligentInventoryService.createSupplier({
      name: draft.supplier_name,
      gstin: draft.supplier_gstin || "",
      phone: details.phone,
      email: details.email,
      address: details.address,
      status: "active",
      statusReason: reason
    }, access).id;
  }

  createProductForItem(item, draft, supplierId, access) {
    const name = String(item.productName || item.rawName || "").trim();
    if (!name) return "";
    const product = repositories.products.create({
      id: makeId("prod"),
      name,
      sku: productSku(name, item.supplierSku),
      category: item.categoryName || "Uncategorized",
      usageType: safeUsage(item.usageType),
      supplier: draft.supplier_name || "",
      branchId: draft.branch_id,
      stock: 0,
      lowStockThreshold: 5,
      expiryDate: item.expiryDate || "",
      unitCost: money(item.unitCost),
      price: money(item.mrp),
      gstRate: number(item.gstPercent, 18),
      status: "active"
    }, scope(access, draft.branch_id));
    return product.id;
  }

  upsertAlias(item = {}, access) {
    const normalized = normalizeText(item.rawName || item.productName || "");
    if (!normalized || !item.productId) return;
    db.prepare(`INSERT OR IGNORE INTO product_supplier_aliases
      (id, tenant_id, branch_id, supplier_id, product_id, raw_name, normalized_name, supplier_sku, confidence, status, version)
      VALUES (@id, @tenant_id, @branch_id, @supplier_id, @product_id, @raw_name, @normalized_name, @supplier_sku, @confidence, 'active', 1)`)
      .run({
        id: makeId("alias"),
        tenant_id: access.tenantId,
        branch_id: item.branchId || "",
        supplier_id: item.supplierId || "",
        product_id: item.productId,
        raw_name: item.rawName || item.productName || "",
        normalized_name: normalized,
        supplier_sku: item.supplierSku || "",
        confidence: number(item.matchConfidence, 0.9)
      });
  }
}

export const purchaseBillDraftService = new PurchaseBillDraftService();
