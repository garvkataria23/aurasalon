export interface SplitPaymentLine {
  mode: 'cash' | 'upi' | 'card' | 'wallet' | 'razorpay' | 'bank_transfer' | string;
  amount: number;
  reference?: string;
}

export interface PaymentStatus {
  invoiceId: string;
  invoiceNo: string;
  paymentStatus: string;
  paidAmount: number;
  dueAmount: number;
}
