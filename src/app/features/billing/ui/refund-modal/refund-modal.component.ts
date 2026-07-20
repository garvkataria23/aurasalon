import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-refund-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="billing-panel">
      <h3>Refund</h3>
      <input type="number" [(ngModel)]="amount" placeholder="Amount" />
      <input [(ngModel)]="reason" placeholder="Reason" />
      <button type="button" (click)="refund.emit({ amount, reason })">Create refund</button>
    </section>
  `
})
export class RefundModalComponent {
  @Output() refund = new EventEmitter<{ amount: number; reason: string }>();
  amount = 0;
  reason = '';
}
