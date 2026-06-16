import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-appointment-deposit-report',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Appointment Deposits</span>
          <h2>Advance Payment Report</h2>
          <p>Track 20% advance links for high-value services like Botox, Keratin and Highlights before staff time is confirmed.</p>
        </div>
        <button class="primary-button" type="button" (click)="load()">Refresh</button>
      </div>

      <section class="panel">
        <div class="toolbar compact">
          <label><span>From</span><input type="date" [(ngModel)]="from" /></label>
          <label><span>To</span><input type="date" [(ngModel)]="to" /></label>
          <button class="ghost-button" type="button" (click)="load()">Apply</button>
        </div>
      </section>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <section class="metrics-grid">
        <article class="metric-card"><span>Links</span><strong>{{ stats().count || 0 }}</strong><small>created</small></article>
        <article class="metric-card"><span>Total advance</span><strong>{{ (stats().totalAmount || 0) | currency:'INR':'symbol':'1.0-0' }}</strong><small>all links</small></article>
        <article class="metric-card"><span>Paid</span><strong>{{ (stats().paidAmount || 0) | currency:'INR':'symbol':'1.0-0' }}</strong><small>confirmed bookings</small></article>
        <article class="metric-card"><span>Pending</span><strong>{{ (stats().pendingAmount || 0) | currency:'INR':'symbol':'1.0-0' }}</strong><small>awaiting client</small></article>
      </section>

      <section class="panel">
        <div class="section-title"><h2>Deposit links</h2></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Service</th>
                <th>Appointment</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment link</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of rows()">
                <td><strong>{{ row.clientName || row.clientId }}</strong><small>{{ row.clientPhone }}</small></td>
                <td>{{ row.serviceNames || row.serviceIds?.join(', ') || '-' }}</td>
                <td><span>{{ row.appointmentStartAt | date:'medium' }}</span><small>{{ row.appointmentStatus }}</small></td>
                <td>{{ row.amount | currency:'INR':'symbol':'1.0-0' }}</td>
                <td><span class="badge">{{ row.depositStatus }}</span></td>
                <td><a *ngIf="row.paymentLink" [href]="row.paymentLink" target="_blank" rel="noreferrer">Open</a><span *ngIf="!row.paymentLink">-</span></td>
              </tr>
              <tr *ngIf="!rows().length"><td colspan="6">No advance payment records found.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `
})
export class AppointmentDepositReportComponent implements OnInit {
  readonly rows = signal<ApiRecord[]>([]);
  readonly stats = signal<ApiRecord>({});
  readonly loading = signal(false);
  readonly error = signal('');
  from = '';
  to = '';

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    this.from = first.toISOString().slice(0, 10);
    this.to = today.toISOString().slice(0, 10);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list<{ stats: ApiRecord; rows: ApiRecord[] }>('appointment-deposits/report', { from: this.from, to: this.to }).subscribe({
      next: (result) => {
        this.stats.set(result.stats || {});
        this.rows.set(result.rows || []);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(this.api.errorText(error, 'Unable to load appointment deposit report'));
        this.loading.set(false);
      }
    });
  }
}
