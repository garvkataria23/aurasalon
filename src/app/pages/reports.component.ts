import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Reports and analytics</span>
          <h2>Sales, booking, staff, inventory, retention, GST and daily closing</h2>
          <p>Reports calculate from saved sales, appointments, invoices, payments, clients and inventory records.</p>
        </div>
        <button class="ghost-button" type="button" (click)="load()">Refresh</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <ng-container *ngIf="report() as report">
        <div class="metrics-grid">
          <article class="metric-card teal"><span>Sales revenue</span><strong>{{ report.sales.revenue | currency: 'INR':'symbol':'1.0-0' }}</strong><small>{{ report.sales.count }} sales</small></article>
          <article class="metric-card amber"><span>GST collected</span><strong>{{ report.gst.collected | currency: 'INR':'symbol':'1.0-0' }}</strong><small>{{ report.gst.invoices }} invoices</small></article>
          <article class="metric-card green"><span>Repeat customer rate</span><strong>{{ report.retention.repeatCustomerRate }}%</strong><small>Client retention</small></article>
          <article class="metric-card red"><span>Low stock count</span><strong>{{ report.inventory.lowStock }}</strong><small>{{ report.inventory.stockValue | currency: 'INR':'symbol':'1.0-0' }} stock value</small></article>
        </div>

        <div class="dashboard-grid">
          <section class="panel">
            <div class="section-title"><h2>Daily closing</h2></div>
            <div class="summary-lines">
              <div><span>Cash</span><strong>{{ report.dailyClosing.cash | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
              <div><span>UPI</span><strong>{{ report.dailyClosing.upi | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
              <div><span>Card</span><strong>{{ report.dailyClosing.card | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            </div>
          </section>

          <section class="panel">
            <div class="section-title"><h2>Profit / loss summary</h2></div>
            <div class="summary-lines">
              <div><span>Revenue</span><strong>{{ report.profitLoss.revenue | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
              <div><span>Inventory cost</span><strong>{{ report.profitLoss.estimatedInventoryCost | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
              <div class="total"><span>Gross profit</span><strong>{{ report.profitLoss.grossProfit | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            </div>
          </section>
        </div>

        <section class="panel">
          <div class="section-title"><h2>Staff report</h2></div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Role</th>
                  <th>Revenue</th>
                  <th>Bookings</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let person of report.staff">
                  <td>{{ person.name }}</td>
                  <td>{{ person.role }}</td>
                  <td>{{ person.revenue | currency: 'INR':'symbol':'1.0-0' }}</td>
                  <td>{{ person.bookings }}</td>
                  <td>{{ person.rating }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </ng-container>
    </section>
  `
})
export class ReportsComponent implements OnInit {
  readonly report = signal<ApiRecord | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.report<ApiRecord>('advanced').subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load reports');
        this.loading.set(false);
      }
    });
  }
}
