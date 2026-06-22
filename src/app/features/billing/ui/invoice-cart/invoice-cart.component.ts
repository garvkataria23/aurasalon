import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InvoiceItem } from '../../domain/invoice.model';

@Component({
  selector: 'app-invoice-cart',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, FormsModule],
  styles: [`
    .cart-row { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf1f4; }
    .line-price { display: inline-flex; align-items: center; gap: 6px; }
    .happy-hour-line s { color: #7a8791; }
    .hh-badge { display: inline-block; background: #e6f7f0; color: #1D9E75; font-size: 11px; padding: 2px 8px; border-radius: 12px; margin-left: 6px; }
    .hh-discount-row { display: flex; justify-content: space-between; color: #1D9E75; font-weight: 500; padding: 6px 0; border-top: 1px dashed #e0e0e0; }
    .discount-amount { font-weight: 600; }
    .bypass-toggle { display: inline-flex; gap: 8px; align-items: center; margin: 8px 0; font-size: 13px; color: #344054; }
    .hh-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 8px 0; }
    .group-control { display: inline-flex; gap: 8px; align-items: center; font-size: 13px; color: #344054; }
    .group-control input { width: 64px; }
  `],
  template: `
    <section class="billing-panel">
      <h3>Invoice cart</h3>
      <div class="hh-controls">
        <label class="bypass-toggle">
          <input type="checkbox" [ngModel]="bypassHappyHours" (ngModelChange)="bypassHappyHoursChange.emit($event)" />
          Bypass Happy Hours
        </label>
        <label class="group-control">
          Group
          <input type="number" min="1" max="20" [ngModel]="groupSize" (ngModelChange)="groupSizeChange.emit($event)" />
        </label>
      </div>
      <p *ngIf="!items.length">No items added yet.</p>
      <div class="cart-row" *ngFor="let item of items; let i = index">
        <span>{{ item.item_name }}</span>
        <strong class="line-price">
          <span *ngIf="item.happyHourDiscountPaise; else regularPrice" class="happy-hour-line">
            <s>₹{{ (item.originalPricePaise || 0) / 100 | number:'1.2-2' }}</s>
            ₹{{ (item.finalPricePaise || 0) / 100 | number:'1.2-2' }}
            <span class="hh-badge">Happy Hours</span>
          </span>
          <ng-template #regularPrice>{{ item.quantity * item.unit_price | currency:'INR' }}</ng-template>
        </strong>
        <button type="button" (click)="remove.emit(i)">Remove</button>
      </div>
      <div *ngIf="happyHourTotalDiscount > 0" class="hh-discount-row">
        <span>Happy Hours Discount</span>
        <span class="discount-amount">- ₹{{ happyHourTotalDiscount / 100 | number:'1.2-2' }}</span>
      </div>
      <div *ngIf="groupDiscountPaise > 0" class="hh-discount-row">
        <span>{{ groupDiscountLabel || 'Group booking discount' }}</span>
        <span class="discount-amount">- ₹{{ groupDiscountPaise / 100 | number:'1.2-2' }}</span>
      </div>
      <div *ngIf="bundleSavingsPaise > 0" class="hh-discount-row">
        <span>{{ bundleName || 'Combo bundle savings' }}</span>
        <span class="discount-amount">- ₹{{ bundleSavingsPaise / 100 | number:'1.2-2' }}</span>
      </div>
    </section>
  `
})
export class InvoiceCartComponent {
  @Input() items: InvoiceItem[] = [];
  @Input() happyHourTotalDiscount = 0;
  @Input() groupDiscountPaise = 0;
  @Input() groupDiscountLabel = '';
  @Input() bundleSavingsPaise = 0;
  @Input() bundleName = '';
  @Input() groupSize = 1;
  @Input() bypassHappyHours = false;
  @Output() remove = new EventEmitter<number>();
  @Output() groupSizeChange = new EventEmitter<number>();
  @Output() bypassHappyHoursChange = new EventEmitter<boolean>();
}
