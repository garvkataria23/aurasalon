export interface InvoiceItem {
  id?: string;
  item_type: 'service' | 'product' | 'mixed' | 'membership' | 'package' | 'custom' | string;
  item_id?: string;
  item_name: string;
  staff_id?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  originalPricePaise?: number;
  finalPricePaise?: number;
  happyHourDiscountPaise?: number;
  happyHourLineDiscountPaise?: number;
  happyHourId?: number | null;
  happyHourName?: string;
  tax_rate?: number;
  tax_amount?: number;
  total_amount?: number;
}

export interface Invoice {
  id: string;
  invoice_no: string;
  branch_id: string;
  customer_id?: string;
  status: string;
  payment_status: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  tip_total: number;
  grand_total: number;
  paid_amount: number;
  due_amount: number;
  created_at?: string;
  items?: InvoiceItem[];
  payments?: PaymentRecord[];
}

export interface InvoiceDraft {
  branch_id: string;
  customer_id?: string;
  invoice_type?: string;
  source?: string;
  items: InvoiceItem[];
  bypassHappyHours?: boolean;
  groupSize?: number;
  billDiscount?: { type: 'amount' | 'percent'; value: number; reason?: string };
}

export interface PaymentRecord {
  id?: string;
  payment_mode: string;
  amount: number;
  status?: string;
  reference_no?: string;
}
