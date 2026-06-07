import { Injectable, computed, signal } from '@angular/core';
import { InvoiceItem } from '../domain/invoice.model';

@Injectable()
export class PosCartStore {
  readonly items = signal<InvoiceItem[]>([]);
  readonly barcode = signal('');
  readonly subtotal = computed(() => this.items().reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0));
  readonly tax = computed(() => this.items().reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0) * (Number(item.tax_rate || 18) / 100), 0));
  readonly total = computed(() => this.subtotal() + this.tax());

  add(item: InvoiceItem): void {
    this.items.update((items) => [...items, item]);
  }

  remove(index: number): void {
    this.items.update((items) => items.filter((_, i) => i !== index));
  }

  clear(): void {
    this.items.set([]);
  }
}
