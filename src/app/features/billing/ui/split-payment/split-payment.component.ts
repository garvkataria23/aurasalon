import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SplitPaymentLine } from '../../domain/payment.model';

@Component({
  selector: 'app-split-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="billing-panel">
      <h3>Split payment</h3>
      <div *ngFor="let payment of payments">
        <select [(ngModel)]="payment.mode"><option>cash</option><option>upi</option><option>card</option><option>wallet</option></select>
        <input type="number" [(ngModel)]="payment.amount" />
      </div>
    </section>
  `
})
export class SplitPaymentComponent {
  @Input() payments: SplitPaymentLine[] = [];
}
