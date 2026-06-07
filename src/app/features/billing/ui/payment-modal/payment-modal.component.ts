import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <section class="billing-panel">
      <h3>Payment summary</h3>
      <p>Total: {{ total | currency:'INR' }}</p>
      <button type="button" (click)="checkout.emit()">Checkout</button>
      <button type="button" (click)="split.emit()">Split payment</button>
    </section>
  `
})
export class PaymentModalComponent {
  @Input() total = 0;
  @Output() checkout = new EventEmitter<void>();
  @Output() split = new EventEmitter<void>();
}
