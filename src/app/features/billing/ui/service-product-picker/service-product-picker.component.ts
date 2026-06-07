import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InvoiceItem } from '../../domain/invoice.model';

@Component({
  selector: 'app-service-product-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="billing-panel">
      <h3>Service / Product picker</h3>
      <input [(ngModel)]="barcode" placeholder="Barcode ready input" />
      <button type="button" (click)="add('service')">Add service</button>
      <button type="button" (click)="add('product')">Add product</button>
    </section>
  `
})
export class ServiceProductPickerComponent {
  @Output() itemPicked = new EventEmitter<InvoiceItem>();
  barcode = '';

  add(type: 'service' | 'product'): void {
    this.itemPicked.emit({
      item_type: type,
      item_name: this.barcode || (type === 'service' ? 'Signature service' : 'Retail product'),
      quantity: 1,
      unit_price: type === 'service' ? 1000 : 500,
      tax_rate: 18
    });
    this.barcode = '';
  }
}
