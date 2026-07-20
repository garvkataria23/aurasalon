import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-daily-closing-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="billing-panel">
      <h3>Daily closing</h3>
      <input [(ngModel)]="branchId" placeholder="Branch ID" />
      <input type="number" [(ngModel)]="closingCash" placeholder="Closing cash" />
      <button type="button" (click)="closeDay.emit({ branchId, closingCash })">Close day</button>
    </section>
  `
})
export class DailyClosingPanelComponent {
  @Output() closeDay = new EventEmitter<{ branchId: string; closingCash: number }>();
  branchId = '';
  closingCash = 0;
}
