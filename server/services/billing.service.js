import { createHash, randomUUID } from "node:crypto";
import { columnsFor, db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";
import { invoiceCalculationService } from "./invoice-calculation.service.js";
import { invoiceNumberService } from "./invoice-number.service.js";
import { billingInventoryService } from "./billing-inventory.service.js";
import { billingHappyHours } from "../utils/billing-happy-hours.middleware.js";
import {
  assertDiscountLimit,
  assertInvoiceEditable,
  assertNonNegativeTotal,
  assertTenantIsolation,
  validateBillDiscount,
  validateDraftInvoicePayload,
  validateManualPosInvoicePayload,
  validatePaymentPayload
} from "../validators/billing.validator.js";

const now = () => new Date().toISOString();
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const paise = (value) => Math.round((Number(value) || 0) * 100);
const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;

function safeColumns(table) {
  try {
    return columnsFor(table);
  } catch {
    return [];
  }
}

function requireEnterpriseBillingSchema() {
  const required = {
    invoices: ["tenant_id", "branch_id", "invoice_no", "financial_year", "grand_total"],
    invoice_items: ["tenant_id", "invoice_id", "item_type", "total_amount"],
    invoice_taxes: ["tenant_id", "invoice_id", "tax_type"],
    invoice_payments: ["tenant_id", "invoice_id", "payment_mode"],
    invoice_events: ["tenant_id", "invoice_id", "event_type"],
    invoice_locks: ["tenant_id", "invoice_id", "active"]
  };

  for (const [table, columns] of Object.entries(required)) {
    const existing = safeColumns(table);
    const missing = columns.filter((column) => !existing.includes(column));
    if (missing.length) {
      throw badRequest("Enterprise billing migration is not applied", { table, missing });
    }
  }
}

function parseJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return value;
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mergeHappyHoursBillDiscount(payload = {}, hhResult = {}) {
  const extraPaise = Math.max(0, Number(hhResult.groupDiscountPaise || 0) + Number(hhResult.bundleSavingsPaise || 0));
  const existing = payload.billDiscount || payload.bill_discount || {};
  if (!extraPaise) return existing;
  const type = existing.type || existing.discount_type || "amount";
  const existingValue = Number(existing.value ?? existing.discount_value ?? 0) || 0;
  if ((type === "percent" || type === "percentage") && existingValue > 0) return existing;
  const existingPaise = type === "amount"
    ? Math.max(0, Math.round(existingValue * 100))
    : 0;
  return {
    type: "amount",
    value: money(existingPaise / 100 + extraPaise / 100),
    reason: [existing.reason || existing.discount_reason, "happy_hours_group_bundle"].filter(Boolean).join("+")
  };
}

function scopedColumn(table) {
  const columns = safeColumns(table);
  if (columns.includes("tenant_id")) return "tenant_id";
  if (columns.includes("tenantId")) return "tenantId";
  return "";
}

function getTenantRow(table, id, tenantId) {
  const columns = safeColumns(table);
  if (!columns.includes("id")) return null;
  const tenantColumn = scopedColumn(table);
  const where = tenantColumn ? `id = @id AND ${tenantColumn} = @tenantId` : "id = @id";
  return db.prepare(`SELECT * FROM ${table} WHERE ${where}`).get({ id, tenantId }) || null;
}

function normalizeReferenceItem(row, type, fallback = {}) {
  if (!row) return null;
  return {
    item_type: type,
    item_id: row.id,
    item_name: row.name || row.title || fallback.name || `${type} item`,
    category_id: row.category_id || row.categoryId || "",
    staff_id: fallback.staff_id || fallback.staffId || "",
    quantity: fallback.quantity || 1,
    unit_price: Number(fallback.unit_price ?? fallback.unitPrice ?? fallback.price ?? row.price ?? row.salePrice ?? 0),
    tax_rate: Number(row.tax_rate ?? row.taxRate ?? row.gstRate ?? 18),
    hsn_sac_code: row.hsn_sac_code || row.hsnSacCode || row.hsn_code || row.hsnCode || "",
    batch_id: fallback.batch_id || fallback.batchId || "",
    appointment_service_id: fallback.appointment_service_id || fallback.appointmentServiceId || ""
  };
}

function fallbackClientId(tenantId, branchId) {
  return `client_walkin_${tenantId}_${branchId || "tenant"}`.replace(/[^a-zA-Z0-9_]/g, "_");
}

function insertDynamic(table, data = {}) {
  const columns = Object.keys(data);
  if (!columns.length) return;
  db.prepare(`
    INSERT INTO ${table} (${columns.join(", ")})
    VALUES (${columns.map((column) => `@${column}`).join(", ")})
  `).run(data);
}

function ensureLegacyClient({ tenantId, branchId, clientId, stamp }) {
  const columns = safeColumns("clients");
  if (!clientId || !columns.includes("id")) return clientId;
  const existing = db.prepare("SELECT id FROM clients WHERE id = ?").get(clientId);
  if (existing) return clientId;
  const row = { id: clientId };
  if (columns.includes("tenantId")) row.tenantId = tenantId;
  if (columns.includes("tenant_id")) row.tenant_id = tenantId;
  if (columns.includes("branchId")) row.branchId = branchId;
  if (columns.includes("branch_id")) row.branch_id = branchId;
  if (columns.includes("name")) row.name = "Walk-in Client";
  if (columns.includes("phone")) row.phone = `walkin${String(Date.now()).slice(-8)}`;
  if (columns.includes("createdAt")) row.createdAt = stamp;
  if (columns.includes("created_at")) row.created_at = stamp;
  if (columns.includes("updatedAt")) row.updatedAt = stamp;
  if (columns.includes("updated_at")) row.updated_at = stamp;
  insertDynamic("clients", row);
  return clientId;
}

function ensureLegacySale({ tenantId, branchId, saleId, clientId, items, calculation, stamp }) {
  const columns = safeColumns("sales");
  if (!saleId || !columns.includes("id")) return saleId;
  const existing = db.prepare("SELECT id FROM sales WHERE id = ?").get(saleId);
  if (existing) return saleId;
  const row = { id: saleId };
  if (columns.includes("tenantId")) row.tenantId = tenantId;
  if (columns.includes("tenant_id")) row.tenant_id = tenantId;
  if (columns.includes("branchId")) row.branchId = branchId;
  if (columns.includes("branch_id")) row.branch_id = branchId;
  if (columns.includes("clientId")) row.clientId = clientId;
  if (columns.includes("client_id")) row.client_id = clientId;
  if (columns.includes("items")) row.items = JSON.stringify(items || []);
  if (columns.includes("subtotal")) row.subtotal = calculation.subtotal;
  if (columns.includes("discount")) row.discount = calculation.discount_total;
  if (columns.includes("gstAmount")) row.gstAmount = calculation.tax_total;
  if (columns.includes("total")) row.total = calculation.grand_total;
  if (columns.includes("status")) row.status = "completed";
  if (columns.includes("createdAt")) row.createdAt = stamp;
  if (columns.includes("created_at")) row.created_at = stamp;
  if (columns.includes("updatedAt")) row.updatedAt = stamp;
  if (columns.includes("updated_at")) row.updated_at = stamp;
  insertDynamic("sales", row);
  return saleId;
}

function hashEvent(payload, previousHash = "") {
  return createHash("sha256").update(`${previousHash}:${JSON.stringify(payload)}`).digest("hex");
}

function mapInvoiceItemToInput(row) {
  return {
    item_type: row.item_type,
    item_id: row.item_id,
    item_name: row.item_name,
    category_id: row.category_id,
    staff_id: row.staff_id,
    quantity: row.quantity,
    unit_price: row.unit_price,
    discount_type: row.discount_type,
    discount_value: row.discount_value,
    tax_rate: row.tax_rate,
    hsn_sac_code: row.hsn_sac_code,
    batch_id: row.batch_id,
    appointment_service_id: row.appointment_service_id,
    metadata_json: row.metadata_json
  };
}

export class BillingService {
  constructor({ calculator = invoiceCalculationService, numberService = invoiceNumberService } = {}) {
    this.calculator = calculator;
    this.numberService = numberService;
  }

  writeEvent({ tenantId, invoiceId, eventType, actorUserId = "", source = "billing.service", payload = {} }) {
    const previous = db
      .prepare(
        `SELECT hash
           FROM invoice_events
          WHERE tenant_id = ? AND invoice_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT 1`
      )
      .get(tenantId, invoiceId);
    const createdAt = now();
    const eventPayload = { eventType, actorUserId, source, payload, createdAt };
    const previousHash = previous?.hash || "";
    const hash = hashEvent(eventPayload, previousHash);
    const id = makeId("ieve");

    db.prepare(
      `INSERT INTO invoice_events
        (id, tenant_id, invoice_id, event_type, actor_user_id, source, payload_json, hash, previous_hash, created_at)
       VALUES
        (@id, @tenantId, @invoiceId, @eventType, @actorUserId, @source, @payloadJson, @hash, @previousHash, @createdAt)`
    ).run({
      id,
      tenantId,
      invoiceId,
      eventType,
      actorUserId,
      source,
      payloadJson: JSON.stringify(payload || {}),
      hash,
      previousHash,
      createdAt
    });

    if (safeColumns("invoice_audit_log").includes("tenant_id")) {
      db.prepare(
        `INSERT INTO invoice_audit_log
          (id, tenant_id, invoice_id, user_id, action, old_value, new_value, ip_address, user_agent, created_at)
         VALUES
          (@id, @tenantId, @invoiceId, @userId, @action, @oldValue, @newValue, '', '', @createdAt)`
      ).run({
        id: makeId("iaud"),
        tenantId,
        invoiceId,
        userId: actorUserId,
        action: eventType,
        oldValue: payload?.oldValue ? JSON.stringify(payload.oldValue) : "",
        newValue: payload ? JSON.stringify(payload) : "",
        createdAt
      });
    }

    return { id, hash, previousHash };
  }

  calculate(payload = {}, access = {}) {
    const calculation = this.calculator.calculateInvoice({
      items: payload.items || [],
      billDiscount: validateBillDiscount(payload.billDiscount || payload.bill_discount || {}),
      tipTotal: payload.tip_total ?? payload.tipTotal ?? 0,
      roundToNearestRupee: Boolean(payload.roundToNearestRupee || payload.round_to_nearest_rupee),
      placeOfSupply: payload.place_of_supply || payload.placeOfSupply || "",
      branchState: payload.branch_state || payload.branchState || ""
    });
    assertNonNegativeTotal(calculation.grand_total);
    assertDiscountLimit({ access, subtotal: calculation.subtotal, discountAmount: calculation.discount_total });
    return calculation;
  }

  createDraft(payload = {}, access = {}) {
    requireEnterpriseBillingSchema();
    const draft = validateDraftInvoicePayload(payload, access);
    const tenantId = access.tenantId;
    const actorUserId = access.userId || "";
    const hhResult = billingHappyHours.processHappyHoursForInvoice({
      tenantId,
      branchId: draft.branch_id,
      items: draft.items,
      bypass: payload.bypassHappyHours === true,
      groupSize: payload.groupSize,
      date: payload.happyHoursDate ? new Date(payload.happyHoursDate) : undefined
    });
    const billDiscount = mergeHappyHoursBillDiscount({ ...payload, ...draft }, hhResult);
    const calculation = this.calculate({ ...draft, items: hhResult.items, billDiscount }, access);

    const txn = db.transaction(() => {
      const invoiceId = makeId("inv");
      const stamp = now();
      const number = this.numberService.nextInvoiceNumberInTransaction({
        tenantId,
        branchId: draft.branch_id,
        branchCode: draft.branch_code || draft.branchCode,
        prefix: draft.prefix || "INV",
        date: draft.invoice_date || draft.invoiceDate || new Date()
      });

      const invoiceColumns = safeColumns("invoices");
      const hasHappyHoursColumn = invoiceColumns.includes("happyHourDiscountPaise");
      const legacyClientId = draft.customer_id || draft.clientId || fallbackClientId(tenantId, draft.branch_id);
      const legacySaleId = draft.saleId || draft.sale_id || `sale_${invoiceId.slice(4)}`;
      if (invoiceColumns.includes("clientId")) {
        ensureLegacyClient({ tenantId, branchId: draft.branch_id, clientId: legacyClientId, stamp });
      }
      if (invoiceColumns.includes("saleId")) {
        ensureLegacySale({
          tenantId,
          branchId: draft.branch_id,
          saleId: legacySaleId,
          clientId: legacyClientId,
          items: draft.items,
          calculation,
          stamp
        });
      }
      const compatibilityColumns = [];
      const compatibilityValues = [];
      const compatibilityParams = {};
      const addCompatibility = (column, value) => {
        if (!invoiceColumns.includes(column)) return;
        compatibilityColumns.push(column);
        compatibilityValues.push(`@${column}`);
        compatibilityParams[column] = value;
      };
      addCompatibility("saleId", legacySaleId);
      addCompatibility("clientId", legacyClientId);
      addCompatibility("invoiceNumber", number.invoiceNo);
      addCompatibility("lineItems", JSON.stringify(draft.items || []));
      addCompatibility("discount", calculation.discount_total);
      addCompatibility("gstAmount", calculation.tax_total);
      addCompatibility("total", calculation.grand_total);
      addCompatibility("paid", 0);
      addCompatibility("balance", calculation.due_amount);
      addCompatibility("tenantId", tenantId);
      addCompatibility("branchId", draft.branch_id);
      addCompatibility("createdAt", stamp);
      addCompatibility("updatedAt", stamp);
      db.prepare(
        `INSERT INTO invoices
          (id, tenant_id, branch_id, financial_year, invoice_no, invoice_type, appointment_id, customer_id,
           corporate_account_id, credit_account_id, status, payment_status, source, subtotal, subtotal_paise,
           discount_total, discount_total_paise, tax_total, tax_total_paise, tip_total, tip_total_paise,
           round_off, grand_total, grand_total_paise, paid_amount, paid_amount_paise, due_amount, due_amount_paise,
           refund_amount, refund_amount_paise, currency, notes, terms, gstin, place_of_supply, created_by, created_at, updated_at${hasHappyHoursColumn ? ", happyHourDiscountPaise" : ""}${compatibilityColumns.map((column) => `, ${column}`).join("")})
         VALUES
          (@id, @tenantId, @branchId, @financialYear, @invoiceNo, @invoiceType, @appointmentId, @customerId,
           @corporateAccountId, @creditAccountId, 'draft', 'unpaid', @source, @subtotal, @subtotalPaise,
           @discountTotal, @discountTotalPaise, @taxTotal, @taxTotalPaise, @tipTotal, @tipTotalPaise,
           @roundOff, @grandTotal, @grandTotalPaise, 0, 0, @dueAmount, @dueAmountPaise,
           0, 0, @currency,
           @notes, @terms, @gstin, @placeOfSupply, @createdBy, @createdAt, @updatedAt${hasHappyHoursColumn ? ", @happyHourDiscountPaise" : ""}${compatibilityValues.map((value) => `, ${value}`).join("")})`
      ).run({
        id: invoiceId,
        tenantId,
        branchId: draft.branch_id,
        financialYear: number.financialYear,
        invoiceNo: number.invoiceNo,
        invoiceType: draft.invoice_type,
        appointmentId: draft.appointment_id,
        customerId: draft.customer_id,
        corporateAccountId: draft.corporate_account_id,
        creditAccountId: draft.credit_account_id,
        source: draft.source,
        subtotal: calculation.subtotal,
        subtotalPaise: paise(calculation.subtotal),
        discountTotal: calculation.discount_total,
        discountTotalPaise: paise(calculation.discount_total),
        taxTotal: calculation.tax_total,
        taxTotalPaise: paise(calculation.tax_total),
        tipTotal: calculation.tip_total,
        tipTotalPaise: paise(calculation.tip_total),
        roundOff: calculation.round_off,
        grandTotal: calculation.grand_total,
        grandTotalPaise: paise(calculation.grand_total),
        dueAmount: calculation.due_amount,
        dueAmountPaise: paise(calculation.due_amount),
        currency: draft.currency || "INR",
        notes: draft.notes || "",
        terms: draft.terms || "",
        gstin: draft.gstin || "",
        placeOfSupply: draft.place_of_supply || draft.placeOfSupply || "",
        createdBy: actorUserId,
        createdAt: stamp,
        updatedAt: stamp,
        happyHourDiscountPaise: hhResult.totalDiscountPaise,
        ...compatibilityParams
      });

      this.replaceCalculatedRows(invoiceId, tenantId, calculation);
      billingHappyHours.saveHappyHoursAudit({
        tenantId,
        branchId: draft.branch_id,
        invoiceId,
        appliedHappyHours: hhResult.appliedHappyHours,
        totalDiscountPaise: hhResult.happyHourDiscountPaise
      });
      this.writeEvent({
        tenantId,
        invoiceId,
        eventType: "invoice.created",
        actorUserId,
        payload: {
          invoiceNo: number.invoiceNo,
          status: "draft",
          totals: this.totalsFromCalculation(calculation),
          happyHourDiscountPaise: hhResult.totalDiscountPaise,
          happyHourDirectDiscountPaise: hhResult.happyHourDiscountPaise,
          groupDiscountPaise: hhResult.groupDiscountPaise,
          bundleSavingsPaise: hhResult.bundleSavingsPaise,
          appliedHappyHourIds: hhResult.appliedHappyHourIds
        }
      });

      return this.getInvoice(invoiceId, access);
    });

    return txn();
  }

  createDraftInvoice(payload = {}, access = {}) {
    return this.createDraft(payload, access);
  }

  listInvoices(query = {}, access = {}) {
    requireEnterpriseBillingSchema();
    const limit = Math.min(500, Math.max(1, Number(query.limit || 100)));
    const offset = Math.max(0, Number(query.offset || 0));
    const where = ["tenant_id = @tenantId"];
    const params = { tenantId: access.tenantId, limit, offset };

    if (query.branchId || query.branch_id || access.branchId) {
      const branchId = query.branchId || query.branch_id || access.branchId;
      tenantService.assertBranchAccess(access, branchId);
      where.push("branch_id = @branchId");
      params.branchId = branchId;
    }
    if (query.status) {
      where.push("status = @status");
      params.status = query.status;
    }
    if (query.paymentStatus || query.payment_status) {
      where.push("payment_status = @paymentStatus");
      params.paymentStatus = query.paymentStatus || query.payment_status;
    }
    if (query.customerId || query.customer_id) {
      where.push("customer_id = @customerId");
      params.customerId = query.customerId || query.customer_id;
    }
    if (query.from) {
      where.push("substr(created_at, 1, 10) >= @from");
      params.from = query.from;
    }
    if (query.to) {
      where.push("substr(created_at, 1, 10) <= @to");
      params.to = query.to;
    }

    const rows = db
      .prepare(
        `SELECT *
           FROM invoices
          WHERE ${where.join(" AND ")}
          ORDER BY created_at DESC
          LIMIT @limit OFFSET @offset`
      )
      .all(params);
    const total = db.prepare(`SELECT COUNT(*) AS count FROM invoices WHERE ${where.join(" AND ")}`).get(params).count;
    return { rows, total, limit, offset };
  }

  createManualPosInvoice(payload = {}, access = {}) {
    return this.createDraft(validateManualPosInvoicePayload(payload, access), access);
  }

  createFromAppointment(appointmentId, payload = {}, access = {}) {
    requireEnterpriseBillingSchema();
    if (!appointmentId) throw badRequest("appointmentId is required");
    const appointment = getTenantRow("appointments", appointmentId, access.tenantId);
    if (!appointment) throw notFound("Appointment not found");
    assertTenantIsolation(access, appointment, "Appointment");

    const branchId = payload.branch_id || payload.branchId || appointment.branch_id || appointment.branchId || access.branchId;
    tenantService.assertBranchAccess(access, branchId);
    const customerId = payload.customer_id || payload.customerId || appointment.customer_id || appointment.customerId || appointment.clientId || "";
    const staffId = payload.staff_id || payload.staffId || appointment.staff_id || appointment.staffId || "";
    const serviceIds = payload.serviceIds || payload.service_ids || parseJson(appointment.serviceIds || appointment.service_ids, []);
    const serviceItems = serviceIds
      .map((serviceId) => normalizeReferenceItem(getTenantRow("services", serviceId, access.tenantId), "service", { staff_id: staffId, appointment_service_id: appointmentId }))
      .filter(Boolean);

    const items = payload.items?.length ? payload.items : serviceItems;
    if (!items.length) throw badRequest("Appointment has no billable service items");

    return this.createDraft(
      {
        ...payload,
        branch_id: branchId,
        customer_id: customerId,
        appointment_id: appointmentId,
        source: payload.source || "appointment",
        items
      },
      access
    );
  }

  previewFromAppointment(appointmentId, payload = {}, access = {}) {
    requireEnterpriseBillingSchema();
    if (!appointmentId) throw badRequest("appointmentId is required");
    const appointment = getTenantRow("appointments", appointmentId, access.tenantId);
    if (!appointment) throw notFound("Appointment not found");
    assertTenantIsolation(access, appointment, "Appointment");
    const branchId = payload.branch_id || payload.branchId || appointment.branch_id || appointment.branchId || access.branchId;
    tenantService.assertBranchAccess(access, branchId);
    const staffId = payload.staff_id || payload.staffId || appointment.staff_id || appointment.staffId || "";
    const serviceIds = payload.serviceIds || payload.service_ids || parseJson(appointment.serviceIds || appointment.service_ids, []);
    const serviceItems = serviceIds
      .map((serviceId) => normalizeReferenceItem(getTenantRow("services", serviceId, access.tenantId), "service", { staff_id: staffId, appointment_service_id: appointmentId }))
      .filter(Boolean);
    const items = payload.items?.length ? payload.items : serviceItems;
    const calculation = this.calculate({ ...payload, items }, access);
    return {
      appointmentId,
      branchId,
      customerId: payload.customer_id || payload.customerId || appointment.customer_id || appointment.customerId || appointment.clientId || "",
      source: "appointment",
      items: calculation.items,
      taxes: calculation.taxes,
      totals: this.totalsFromCalculation(calculation)
    };
  }

  createFromPosCart(payload = {}, access = {}) {
    const serviceItems = (payload.services || []).map((item) =>
      normalizeReferenceItem(getTenantRow("services", item.id || item.serviceId, access.tenantId), "service", item)
    );
    const productItems = (payload.products || []).map((item) =>
      normalizeReferenceItem(getTenantRow("products", item.id || item.productId, access.tenantId), "product", item)
    );
    return this.createManualPosInvoice({ ...payload, items: [...serviceItems, ...productItems].filter(Boolean) }, access);
  }

  updateDraft(invoiceId, payload = {}, access = {}) {
    requireEnterpriseBillingSchema();
    const invoice = this.requireInvoice(invoiceId, access);
    assertInvoiceEditable(invoice);
    const actorUserId = access.userId || "";
    const oldValue = this.getInvoice(invoiceId, access);

    const txn = db.transaction(() => {
      let calculation = null;
      if (payload.items) {
        calculation = this.calculate(
          {
            ...payload,
            billDiscount: payload.billDiscount || payload.bill_discount || this.currentBillDiscount(invoiceId, access.tenantId)
          },
          access
        );
        this.replaceCalculatedRows(invoiceId, access.tenantId, calculation);
      }

      const update = {
        notes: payload.notes ?? invoice.notes ?? "",
        terms: payload.terms ?? invoice.terms ?? "",
        gstin: payload.gstin ?? invoice.gstin ?? "",
        placeOfSupply: payload.place_of_supply ?? payload.placeOfSupply ?? invoice.place_of_supply ?? "",
        updatedAt: now(),
        invoiceId,
        tenantId: access.tenantId
      };

      const totals = calculation
        ? `subtotal = @subtotal, subtotal_paise = @subtotalPaise, discount_total = @discountTotal, discount_total_paise = @discountTotalPaise,
           tax_total = @taxTotal, tax_total_paise = @taxTotalPaise, tip_total = @tipTotal, tip_total_paise = @tipTotalPaise,
           round_off = @roundOff, grand_total = @grandTotal, grand_total_paise = @grandTotalPaise,
           due_amount = @dueAmount, due_amount_paise = @dueAmountPaise,`
        : "";
      db.prepare(
        `UPDATE invoices
            SET ${totals}
                notes = @notes,
                terms = @terms,
                gstin = @gstin,
                place_of_supply = @placeOfSupply,
                updated_at = @updatedAt
          WHERE tenant_id = @tenantId AND id = @invoiceId`
      ).run({
        ...update,
        subtotal: calculation?.subtotal || invoice.subtotal,
        subtotalPaise: calculation ? paise(calculation.subtotal) : paise(invoice.subtotal),
        discountTotal: calculation?.discount_total || invoice.discount_total,
        discountTotalPaise: calculation ? paise(calculation.discount_total) : paise(invoice.discount_total),
        taxTotal: calculation?.tax_total || invoice.tax_total,
        taxTotalPaise: calculation ? paise(calculation.tax_total) : paise(invoice.tax_total),
        tipTotal: calculation?.tip_total || invoice.tip_total,
        tipTotalPaise: calculation ? paise(calculation.tip_total) : paise(invoice.tip_total),
        roundOff: calculation?.round_off || invoice.round_off,
        grandTotal: calculation?.grand_total || invoice.grand_total,
        grandTotalPaise: calculation ? paise(calculation.grand_total) : paise(invoice.grand_total),
        dueAmount: calculation ? money(calculation.grand_total - Number(invoice.paid_amount || 0)) : invoice.due_amount,
        dueAmountPaise: calculation ? paise(calculation.grand_total - Number(invoice.paid_amount || 0)) : paise(invoice.due_amount)
      });

      const next = this.getInvoice(invoiceId, access);
      this.writeEvent({
        tenantId: access.tenantId,
        invoiceId,
        eventType: "invoice.updated",
        actorUserId,
        payload: { oldValue, newValue: next }
      });
      return next;
    });

    return txn();
  }

  addItem(invoiceId, item = {}, access = {}) {
    const invoice = this.requireInvoice(invoiceId, access);
    assertInvoiceEditable(invoice);
    const items = this.readInvoiceItems(invoiceId, access.tenantId).map(mapInvoiceItemToInput);
    return this.updateDraft(invoiceId, { items: [...items, item] }, access);
  }

  updateItem(invoiceId, itemId, payload = {}, access = {}) {
    const invoice = this.requireInvoice(invoiceId, access);
    assertInvoiceEditable(invoice);
    const rows = this.readInvoiceItems(invoiceId, access.tenantId);
    if (!rows.some((item) => item.id === itemId)) throw notFound("Invoice item not found");
    const items = rows.map((item) => (item.id === itemId ? { ...mapInvoiceItemToInput(item), ...payload } : mapInvoiceItemToInput(item)));
    return this.updateDraft(invoiceId, { items }, access);
  }

  deleteItem(invoiceId, itemId, access = {}) {
    const invoice = this.requireInvoice(invoiceId, access);
    assertInvoiceEditable(invoice);
    const rows = this.readInvoiceItems(invoiceId, access.tenantId);
    if (!rows.some((item) => item.id === itemId)) throw notFound("Invoice item not found");
    const items = rows.filter((item) => item.id !== itemId).map(mapInvoiceItemToInput);
    if (!items.length) throw conflict("Invoice must have at least one item");
    return this.updateDraft(invoiceId, { items }, access);
  }

  applyBillDiscount(invoiceId, discount = {}, access = {}) {
    const invoice = this.requireInvoice(invoiceId, access);
    assertInvoiceEditable(invoice);
    const billDiscount = validateBillDiscount(discount);
    const items = this.readInvoiceItems(invoiceId, access.tenantId).map(mapInvoiceItemToInput);
    const calculation = this.calculate({ items, billDiscount, tipTotal: invoice.tip_total }, access);

    const txn = db.transaction(() => {
      this.replaceCalculatedRows(invoiceId, access.tenantId, calculation);
      db.prepare(
        `UPDATE invoices
            SET subtotal = @subtotal, subtotal_paise = @subtotalPaise,
                discount_total = @discountTotal, discount_total_paise = @discountTotalPaise,
                tax_total = @taxTotal, tax_total_paise = @taxTotalPaise,
                tip_total = @tipTotal, tip_total_paise = @tipTotalPaise,
                round_off = @roundOff,
                grand_total = @grandTotal, grand_total_paise = @grandTotalPaise,
                due_amount = @dueAmount, due_amount_paise = @dueAmountPaise,
                updated_at = @updatedAt
          WHERE tenant_id = @tenantId AND id = @invoiceId`
      ).run({
        tenantId: access.tenantId,
        invoiceId,
        subtotal: calculation.subtotal,
        subtotalPaise: paise(calculation.subtotal),
        discountTotal: calculation.discount_total,
        discountTotalPaise: paise(calculation.discount_total),
        taxTotal: calculation.tax_total,
        taxTotalPaise: paise(calculation.tax_total),
        tipTotal: calculation.tip_total,
        tipTotalPaise: paise(calculation.tip_total),
        roundOff: calculation.round_off,
        grandTotal: calculation.grand_total,
        grandTotalPaise: paise(calculation.grand_total),
        dueAmount: money(calculation.grand_total - Number(invoice.paid_amount || 0)),
        dueAmountPaise: paise(calculation.grand_total - Number(invoice.paid_amount || 0)),
        updatedAt: now()
      });
      this.writeEvent({
        tenantId: access.tenantId,
        invoiceId,
        eventType: "invoice.discount_applied",
        actorUserId: access.userId || "",
        payload: { discount: billDiscount, totals: this.totalsFromCalculation(calculation) }
      });
      return this.getInvoice(invoiceId, access);
    });

    return txn();
  }

  recordPayment(invoiceId, payload = {}, access = {}) {
    requireEnterpriseBillingSchema();
    const invoice = this.requireInvoice(invoiceId, access);
    const payment = validatePaymentPayload(payload);
    if (invoice.status === "voided" || invoice.status === "cancelled") throw conflict("Cannot take payment for voided or cancelled invoice");

    const txn = db.transaction(() => {
      db.prepare(
        `INSERT INTO invoice_payments
          (id, tenant_id, invoice_id, payment_mode, provider, provider_payment_id, provider_order_id,
           provider_link_id, terminal_id, amount, amount_paise, status, paid_at, reference_no, notes, created_by, created_at)
         VALUES
          (@id, @tenantId, @invoiceId, @paymentMode, @provider, @providerPaymentId, @providerOrderId,
           @providerLinkId, @terminalId, @amount, @amountPaise, 'paid', @paidAt, @referenceNo, @notes, @createdBy, @createdAt)`
      ).run({
        id: makeId("ipay"),
        tenantId: access.tenantId,
        invoiceId,
        paymentMode: payment.payment_mode,
        provider: payment.provider,
        providerPaymentId: payment.provider_payment_id,
        providerOrderId: payment.provider_order_id,
        providerLinkId: payment.provider_link_id,
        terminalId: payment.terminal_id,
        amount: money(payment.amount),
        amountPaise: paise(payment.amount),
        paidAt: payload.paid_at || payload.paidAt || now(),
        referenceNo: payment.reference_no,
        notes: payment.notes,
        createdBy: access.userId || "",
        createdAt: now()
      });

      const paidAmount = money(Number(invoice.paid_amount || 0) + Number(payment.amount || 0));
      if (paidAmount > Number(invoice.grand_total || 0) + 0.01) throw conflict("Payment total cannot exceed invoice grand total");
      const dueAmount = money(Math.max(0, Number(invoice.grand_total || 0) - paidAmount));
      const paymentStatus = dueAmount <= 0.01 ? "paid" : "partially_paid";
      const status = paymentStatus === "paid" ? "paid" : "pending_payment";
      db.prepare(
        `UPDATE invoices
            SET paid_amount = @paidAmount,
                paid_amount_paise = @paidAmountPaise,
                due_amount = @dueAmount,
                due_amount_paise = @dueAmountPaise,
                payment_status = @paymentStatus,
                status = @status,
                updated_at = @updatedAt
          WHERE tenant_id = @tenantId AND id = @invoiceId`
      ).run({
        paidAmount,
        paidAmountPaise: paise(paidAmount),
        dueAmount,
        dueAmountPaise: paise(dueAmount),
        paymentStatus,
        status,
        updatedAt: now(),
        tenantId: access.tenantId,
        invoiceId
      });

      this.writeEvent({
        tenantId: access.tenantId,
        invoiceId,
        eventType: "payment.recorded",
        actorUserId: access.userId || "",
        payload: { paymentMode: payment.payment_mode, amount: money(payment.amount), paymentStatus }
      });

      if (paymentStatus === "paid") this.lockInvoiceInTransaction(invoiceId, access, "paid_invoice_lock");
      return this.getInvoice(invoiceId, access);
    });

    return txn();
  }

  finalizeInvoice(invoiceId, access = {}) {
    requireEnterpriseBillingSchema();
    const invoice = this.requireInvoice(invoiceId, access);
    if (invoice.grand_total < 0) throw badRequest("Invoice total cannot be negative");
    const paymentStatus = Number(invoice.due_amount || 0) <= 0.01 ? "paid" : "partially_paid";
    const status = paymentStatus === "paid" ? "paid" : "pending_payment";

    const txn = db.transaction(() => {
      const invoiceColumns = safeColumns("invoices");
      const finalizeAssignments = ["status = @status", "payment_status = @paymentStatus"];
      if (invoiceColumns.includes("finalized_at")) finalizeAssignments.push("finalized_at = @finalizedAt");
      if (invoiceColumns.includes("finalizedAt")) finalizeAssignments.push("finalizedAt = @finalizedAt");
      if (invoiceColumns.includes("updated_at")) finalizeAssignments.push("updated_at = @updatedAt");
      if (invoiceColumns.includes("updatedAt")) finalizeAssignments.push("updatedAt = @updatedAt");
      db.prepare(
        `UPDATE invoices
            SET ${finalizeAssignments.join(", ")}
          WHERE tenant_id = @tenantId AND id = @invoiceId`
      ).run({
        status,
        paymentStatus,
        finalizedAt: now(),
        updatedAt: now(),
        tenantId: access.tenantId,
        invoiceId
      });
      this.writeEvent({
        tenantId: access.tenantId,
        invoiceId,
        eventType: "invoice.finalized",
        actorUserId: access.userId || "",
        payload: { status, paymentStatus }
      });
      const effects = billingInventoryService.applyFinalization(invoiceId, access);
      this.writeEvent({
        tenantId: access.tenantId,
        invoiceId,
        eventType: "invoice.finalization_effects",
        actorUserId: access.userId || "",
        payload: effects
      });
      if (paymentStatus === "paid") this.lockInvoiceInTransaction(invoiceId, access, "paid_invoice_lock");
      return this.getInvoice(invoiceId, access);
    });

    return txn();
  }

  lockInvoiceInTransaction(invoiceId, access = {}, reason = "paid_invoice_lock") {
    const existing = db
      .prepare("SELECT id FROM invoice_locks WHERE tenant_id = ? AND invoice_id = ? AND lock_type = 'paid' AND active = 1")
      .get(access.tenantId, invoiceId);
    if (!existing) {
      db.prepare(
        `INSERT INTO invoice_locks
          (id, tenant_id, invoice_id, lock_type, reason, locked_by, locked_at, active)
         VALUES
          (@id, @tenantId, @invoiceId, 'paid', @reason, @lockedBy, @lockedAt, 1)`
      ).run({
        id: makeId("ilock"),
        tenantId: access.tenantId,
        invoiceId,
        reason,
        lockedBy: access.userId || "",
        lockedAt: now()
      });
    }
    const invoiceColumns = safeColumns("invoices");
    const lockAssignments = [];
    if (invoiceColumns.includes("locked_at")) lockAssignments.push("locked_at = COALESCE(locked_at, @lockedAt)");
    if (invoiceColumns.includes("lockedAt")) lockAssignments.push("lockedAt = COALESCE(lockedAt, @lockedAt)");
    if (invoiceColumns.includes("updated_at")) lockAssignments.push("updated_at = @lockedAt");
    if (invoiceColumns.includes("updatedAt")) lockAssignments.push("updatedAt = @lockedAt");
    if (lockAssignments.length) {
      db.prepare(
        `UPDATE invoices
            SET ${lockAssignments.join(", ")}
          WHERE tenant_id = @tenantId AND id = @invoiceId`
      ).run({ lockedAt: now(), tenantId: access.tenantId, invoiceId });
    }
    this.writeEvent({
      tenantId: access.tenantId,
      invoiceId,
      eventType: "invoice.locked",
      actorUserId: access.userId || "",
      payload: { reason }
    });
  }

  requireInvoice(invoiceId, access = {}) {
    if (!invoiceId) throw badRequest("invoiceId is required");
    const invoice = db.prepare("SELECT * FROM invoices WHERE tenant_id = ? AND id = ?").get(access.tenantId, invoiceId);
    if (!invoice) throw notFound("Invoice not found");
    assertTenantIsolation(access, invoice, "Invoice");
    return invoice;
  }

  getInvoice(invoiceId, access = {}) {
    const invoice = this.requireInvoice(invoiceId, access);
    return {
      ...invoice,
      items: this.readInvoiceItems(invoiceId, access.tenantId),
      taxes: db.prepare("SELECT * FROM invoice_taxes WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at, id").all(access.tenantId, invoiceId),
      payments: db.prepare("SELECT * FROM invoice_payments WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at, id").all(access.tenantId, invoiceId),
      events: db.prepare("SELECT * FROM invoice_events WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at, id").all(access.tenantId, invoiceId)
    };
  }

  readInvoiceItems(invoiceId, tenantId) {
    return db.prepare("SELECT * FROM invoice_items WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at, id").all(tenantId, invoiceId);
  }

  currentBillDiscount(invoiceId, tenantId) {
    const row = db
      .prepare(
        `SELECT discount_type, discount_value, reason
           FROM invoice_discounts
          WHERE tenant_id = ? AND invoice_id = ? AND invoice_item_id IS NULL
          ORDER BY created_at DESC
          LIMIT 1`
      )
      .get(tenantId, invoiceId);
    return row || {};
  }

  replaceCalculatedRows(invoiceId, tenantId, calculation) {
    db.prepare("DELETE FROM invoice_taxes WHERE tenant_id = ? AND invoice_id = ?").run(tenantId, invoiceId);
    db.prepare("DELETE FROM invoice_discounts WHERE tenant_id = ? AND invoice_id = ?").run(tenantId, invoiceId);
    db.prepare("DELETE FROM invoice_items WHERE tenant_id = ? AND invoice_id = ?").run(tenantId, invoiceId);

    const taxInsert = db.prepare(
      `INSERT INTO invoice_taxes
        (id, tenant_id, invoice_id, invoice_item_id, tax_type, tax_rate, taxable_amount, taxable_amount_paise, tax_amount, tax_amount_paise, hsn_sac_code, created_at)
       VALUES
        (@id, @tenantId, @invoiceId, @invoiceItemId, @taxType, @taxRate, @taxableAmount, @taxableAmountPaise, @taxAmount, @taxAmountPaise, @hsnSacCode, @createdAt)`
    );

    calculation.items.forEach((item) => {
      const invoiceItemId = makeId("iitem");
      db.prepare(
        `INSERT INTO invoice_items
          (id, tenant_id, invoice_id, item_type, item_id, item_name, category_id, staff_id, quantity,
           unit_price, unit_price_paise, gross_amount, gross_amount_paise, discount_type, discount_value,
           discount_amount, discount_amount_paise, taxable_amount, taxable_amount_paise,
           tax_rate, tax_amount, tax_amount_paise, total_amount, total_amount_paise,
           hsn_sac_code, batch_id, appointment_service_id,
           metadata_json, created_at)
         VALUES
          (@id, @tenantId, @invoiceId, @itemType, @itemId, @itemName, @categoryId, @staffId, @quantity,
           @unitPrice, @unitPricePaise, @grossAmount, @grossAmountPaise, @discountType, @discountValue,
           @discountAmount, @discountAmountPaise, @taxableAmount, @taxableAmountPaise,
           @taxRate, @taxAmount, @taxAmountPaise, @totalAmount, @totalAmountPaise,
           @hsnSacCode, @batchId, @appointmentServiceId,
           @metadataJson, @createdAt)`
      ).run({
        id: invoiceItemId,
        tenantId,
        invoiceId,
        itemType: item.item_type,
        itemId: item.item_id,
        itemName: item.item_name,
        categoryId: item.category_id,
        staffId: item.staff_id,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        unitPricePaise: paise(item.unit_price),
        grossAmount: item.gross_amount,
        grossAmountPaise: paise(item.gross_amount),
        discountType: item.discount_type,
        discountValue: item.discount_value,
        discountAmount: item.discount_amount,
        discountAmountPaise: paise(item.discount_amount),
        taxableAmount: item.taxable_amount,
        taxableAmountPaise: paise(item.taxable_amount),
        taxRate: item.tax_rate,
        taxAmount: item.tax_amount,
        taxAmountPaise: paise(item.tax_amount),
        totalAmount: item.total_amount,
        totalAmountPaise: paise(item.total_amount),
        hsnSacCode: item.hsn_sac_code,
        batchId: item.batch_id,
        appointmentServiceId: item.appointment_service_id,
        metadataJson: typeof item.metadata_json === "string" ? item.metadata_json : JSON.stringify(item.metadata_json || {}),
        createdAt: now()
      });

      if (item.discount_amount > 0) {
        db.prepare(
          `INSERT INTO invoice_discounts
            (id, tenant_id, invoice_id, invoice_item_id, discount_type, discount_value, discount_amount,
             reason, coupon_code, approved_by, created_by, created_at)
           VALUES
            (@id, @tenantId, @invoiceId, @invoiceItemId, @discountType, @discountValue, @discountAmount,
             @reason, '', '', '', @createdAt)`
        ).run({
          id: makeId("idis"),
          tenantId,
          invoiceId,
          invoiceItemId,
          discountType: item.discount_type,
          discountValue: item.discount_value,
          discountAmount: item.discount_amount,
          reason: "item_or_prorated_bill_discount",
          createdAt: now()
        });
      }

      item.taxes.forEach((tax) => {
        taxInsert.run({
          id: makeId("itax"),
          tenantId,
          invoiceId,
          invoiceItemId,
          taxType: tax.tax_type,
          taxRate: tax.tax_rate,
          taxableAmount: tax.taxable_amount,
          taxableAmountPaise: paise(tax.taxable_amount),
          taxAmount: tax.tax_amount,
          taxAmountPaise: paise(tax.tax_amount),
          hsnSacCode: tax.hsn_sac_code,
          createdAt: now()
        });
      });
    });

    if (calculation.bill_discount.discount_amount > 0) {
      db.prepare(
        `INSERT INTO invoice_discounts
          (id, tenant_id, invoice_id, invoice_item_id, discount_type, discount_value, discount_amount,
           reason, coupon_code, approved_by, created_by, created_at)
         VALUES
          (@id, @tenantId, @invoiceId, NULL, @discountType, @discountValue, @discountAmount,
           @reason, '', '', '', @createdAt)`
      ).run({
        id: makeId("idis"),
        tenantId,
        invoiceId,
        discountType: calculation.bill_discount.discount_type,
        discountValue: calculation.bill_discount.discount_value,
        discountAmount: calculation.bill_discount.discount_amount,
        reason: calculation.bill_discount.reason || "bill_discount",
        createdAt: now()
      });
    }
  }

  totalsFromCalculation(calculation) {
    return {
      subtotal: calculation.subtotal,
      discount_total: calculation.discount_total,
      tax_total: calculation.tax_total,
      tip_total: calculation.tip_total,
      round_off: calculation.round_off,
      grand_total: calculation.grand_total,
      due_amount: calculation.due_amount
    };
  }
}

export const billingService = new BillingService();
