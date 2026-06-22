import { badRequest } from "../utils/app-error.js";

const DEFAULT_TAX_RATE = 18;

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeDiscount(discount = {}) {
  if (typeof discount === "number") {
    return { discount_type: "amount", discount_value: Math.max(0, discount), reason: "" };
  }
  return {
    discount_type: discount.discount_type || discount.discountType || discount.type || "amount",
    discount_value: Math.max(0, asNumber(discount.discount_value ?? discount.discountValue ?? discount.value, 0)),
    reason: discount.reason || ""
  };
}

function calculateDiscountAmount({ grossAmount, discountType, discountValue }) {
  if (!discountValue) return 0;
  if (discountType === "percent" || discountType === "percentage") {
    return money(Math.min(grossAmount, (grossAmount * discountValue) / 100));
  }
  return money(Math.min(grossAmount, discountValue));
}

function splitTax({ taxRate, taxableAmount, hsnSacCode, placeOfSupply, branchState }) {
  const isInterState = Boolean(placeOfSupply && branchState && String(placeOfSupply).toLowerCase() !== String(branchState).toLowerCase());
  if (isInterState) {
    return [
      {
        tax_type: "IGST",
        tax_rate: taxRate,
        taxable_amount: money(taxableAmount),
        tax_amount: money((taxableAmount * taxRate) / 100),
        hsn_sac_code: hsnSacCode
      }
    ];
  }
  return [
    {
      tax_type: "CGST",
      tax_rate: money(taxRate / 2),
      taxable_amount: money(taxableAmount),
      tax_amount: money((taxableAmount * taxRate) / 200),
      hsn_sac_code: hsnSacCode
    },
    {
      tax_type: "SGST",
      tax_rate: money(taxRate / 2),
      taxable_amount: money(taxableAmount),
      tax_amount: money((taxableAmount * taxRate) / 200),
      hsn_sac_code: hsnSacCode
    }
  ];
}

export class InvoiceCalculationService {
  constructor({ gstCalculator = null } = {}) {
    this.gstCalculator = gstCalculator;
  }

  setGstCalculator(gstCalculator) {
    this.gstCalculator = gstCalculator;
  }

  normalizeItems(items = []) {
    if (!Array.isArray(items) || !items.length) throw badRequest("At least one invoice item is required");
    return items.map((item, index) => {
      const quantity = Math.max(0, asNumber(item.quantity, 1));
      const unitPrice = Math.max(0, asNumber(item.unit_price ?? item.unitPrice ?? item.price, 0));
      const grossAmount = money(quantity * unitPrice);
      const discount = normalizeDiscount({
        discount_type: item.discount_type ?? item.discountType,
        discount_value: item.discount_value ?? item.discountValue,
        reason: item.discount_reason ?? item.discountReason
      });
      const itemDiscount = calculateDiscountAmount({
        grossAmount,
        discountType: discount.discount_type,
        discountValue: discount.discount_value
      });

      return {
        position: index + 1,
        item_type: item.item_type || item.itemType || item.type || "service",
        item_id: item.item_id || item.itemId || item.id || "",
        item_name: item.item_name || item.itemName || item.name || "Invoice item",
        category_id: item.category_id || item.categoryId || "",
        staff_id: item.staff_id || item.staffId || "",
        quantity,
        unit_price: money(unitPrice),
        gross_amount: grossAmount,
        discount_type: discount.discount_type,
        discount_value: money(discount.discount_value),
        discount_amount: itemDiscount,
        taxable_before_bill_discount: money(grossAmount - itemDiscount),
        tax_rate: Math.max(0, asNumber(item.tax_rate ?? item.taxRate ?? item.gstRate, DEFAULT_TAX_RATE)),
        hsn_sac_code: item.hsn_sac_code || item.hsnSacCode || item.hsn_code || item.sacCode || "",
        batch_id: item.batch_id || item.batchId || "",
        appointment_service_id: item.appointment_service_id || item.appointmentServiceId || "",
        metadata_json: item.metadata_json || item.metadataJson || item.metadata || null,
        tax_inclusive: Boolean(item.tax_inclusive || item.taxInclusive)
      };
    });
  }

  calculateTax(line, context = {}) {
    if (this.gstCalculator) {
      const custom = this.gstCalculator(line, context);
      if (custom) return custom;
    }

    if (!line.tax_rate) {
      return {
        taxable_amount: money(line.taxable_amount),
        tax_amount: 0,
        tax_rate: 0,
        taxes: []
      };
    }

    if (line.tax_inclusive) {
      const taxableAmount = money(line.taxable_amount / (1 + line.tax_rate / 100));
      const taxAmount = money(line.taxable_amount - taxableAmount);
      const taxes = splitTax({
        taxRate: line.tax_rate,
        taxableAmount,
        hsnSacCode: line.hsn_sac_code,
        placeOfSupply: context.placeOfSupply,
        branchState: context.branchState
      });
      const taxTotal = taxes.reduce((sum, tax) => sum + Number(tax.tax_amount || 0), 0);
      return {
        taxable_amount: taxableAmount,
        tax_amount: money(taxTotal || taxAmount),
        tax_rate: line.tax_rate,
        taxes
      };
    }

    const taxes = splitTax({
      taxRate: line.tax_rate,
      taxableAmount: line.taxable_amount,
      hsnSacCode: line.hsn_sac_code,
      placeOfSupply: context.placeOfSupply,
      branchState: context.branchState
    });
    return {
      taxable_amount: money(line.taxable_amount),
      tax_amount: money(taxes.reduce((sum, tax) => sum + Number(tax.tax_amount || 0), 0)),
      tax_rate: line.tax_rate,
      taxes
    };
  }

  calculateInvoice({
    items = [],
    billDiscount = {},
    tipTotal = 0,
    roundToNearestRupee = false,
    placeOfSupply = "",
    branchState = ""
  } = {}) {
    const normalized = this.normalizeItems(items);
    const subtotal = money(normalized.reduce((sum, item) => sum + item.gross_amount, 0));
    const itemDiscountTotal = money(normalized.reduce((sum, item) => sum + item.discount_amount, 0));
    const netBeforeBillDiscount = money(subtotal - itemDiscountTotal);
    const billDiscountRule = normalizeDiscount(billDiscount);
    const billDiscountTotal = calculateDiscountAmount({
      grossAmount: netBeforeBillDiscount,
      discountType: billDiscountRule.discount_type,
      discountValue: billDiscountRule.discount_value
    });

    const calculatedItems = normalized.map((item) => {
      const share = netBeforeBillDiscount > 0 ? item.taxable_before_bill_discount / netBeforeBillDiscount : 0;
      const billShare = money(billDiscountTotal * share);
      const taxableAmount = money(Math.max(0, item.taxable_before_bill_discount - billShare));
      const tax = this.calculateTax(
        {
          ...item,
          taxable_amount: taxableAmount
        },
        { placeOfSupply, branchState }
      );

      return {
        ...item,
        bill_discount_amount: billShare,
        discount_amount: money(item.discount_amount + billShare),
        taxable_amount: tax.taxable_amount,
        tax_rate: tax.tax_rate,
        tax_amount: tax.tax_amount,
        total_amount: item.tax_inclusive ? money(taxableAmount) : money(tax.taxable_amount + tax.tax_amount),
        taxes: tax.taxes
      };
    });

    const taxableTotal = money(calculatedItems.reduce((sum, item) => sum + item.taxable_amount, 0));
    const taxTotal = money(calculatedItems.reduce((sum, item) => sum + item.tax_amount, 0));
    const tip = money(Math.max(0, asNumber(tipTotal, 0)));
    const beforeRound = money(taxableTotal + taxTotal + tip);
    const roundedTotal = roundToNearestRupee ? Math.round(beforeRound) : beforeRound;
    const roundOff = money(roundedTotal - beforeRound);
    const grandTotal = money(roundedTotal);

    if (grandTotal < 0) throw badRequest("Invoice total cannot be negative");

    return {
      items: calculatedItems,
      taxes: calculatedItems.flatMap((item) =>
        item.taxes.map((tax) => ({
          ...tax,
          invoice_item_position: item.position
        }))
      ),
      bill_discount: {
        ...billDiscountRule,
        discount_amount: billDiscountTotal
      },
      subtotal,
      item_discount_total: itemDiscountTotal,
      bill_discount_total: billDiscountTotal,
      discount_total: money(itemDiscountTotal + billDiscountTotal),
      taxable_total: taxableTotal,
      tax_total: taxTotal,
      tip_total: tip,
      round_off: roundOff,
      grand_total: grandTotal,
      paid_amount: 0,
      due_amount: grandTotal
    };
  }
}

export const invoiceCalculationService = new InvoiceCalculationService();
