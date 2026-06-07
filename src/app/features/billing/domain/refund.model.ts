export interface RefundRequest {
  amount: number;
  reason: string;
  refund_type?: 'original_payment' | 'wallet' | 'credit_note' | string;
}

export interface RefundResult {
  refundId: string;
  refundNo: string;
  amount: number;
  status: string;
}
