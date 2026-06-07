import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { InvoiceItem } from '../../domain/invoice.model';

@Component({
  selector: 'app-invoice-cart',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <section class="billing-panel">
      <h3>Invoice cart</h3>
      <p *ngIf="!items.length">No items added yet.</p>
      <div class="cart-row" *ngFor="let item of items; let i = index">
        <span>{{ item.item_name }}</span>
        <strong>{{ item.quantity * item.unit_price | currency:'INR' }}</strong>
        <button type="button" (click)="remove.emit(i)">Remove</button>
      </div>
    </section>
  `
})
export class InvoiceCartComponent {
  @Input() items: InvoiceItem[] = [];
  @Output() remove = new EventEmitter<number>();
}
