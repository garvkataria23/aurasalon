import { Component } from '@angular/core';

@Component({
  selector: 'app-reconciliation-page',
  standalone: true,
  template: `<section class="billing-panel"><h1>Razorpay reconciliation</h1><p>Settlement fetch, fees, GST on fees, refunds, adjustments and mismatch alerts.</p></section>`
})
export class ReconciliationPageComponent {}
