export interface TaxBreakdownRow {
  hsn_sac_code: string;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  tax_amount: number;
}
