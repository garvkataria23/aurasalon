import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-void-invoice-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="billing-panel">
      <h3>Void invoice</h3>
      <input [(ngModel)]="reason" placeholder="Manager approval reason" />
      <button type="button" (click)="voidInvoice.emit(reason)">Void</button>
    </section>
  `
})
export class VoidInvoiceModalComponent {
  @Output() voidInvoice = new EventEmitter<string>();
  reason = '';
}
