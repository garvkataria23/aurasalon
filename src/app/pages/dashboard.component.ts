import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink, StateComponent],
  template: `
    <section class="page-stack">
      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="metrics-grid" *ngIf="report() as data">
        <article class="metric-card teal">
          <span>Revenue today</span>
          <strong>{{ data.revenueToday | currency: 'INR':'symbol':'1.0-0' }}</strong>
          <small>From saved sales</small>
        </article>
        <article class="metric-card blue">
          <span>Revenue this month</span>
          <strong>{{ data.revenueMonth | currency: 'INR':'symbol':'1.0-0' }}</strong>
          <small>Branch aware</small>
        </article>
        <article class="metric-card amber">
          <span>Total bookings</span>
          <strong>{{ data.totalBookings }}</strong>
          <small>Online, walk-in, front desk</small>
        </article>
        <article class="metric-card red">
          <span>Pending payments</span>
          <strong>{{ data.pendingPayments | currency: 'INR':'symbol':'1.0-0' }}</strong>
          <small>Open invoice balance</small>
        </article>
        <article class="metric-card green">
          <span>New clients</span>
          <strong>{{ data.newClients }}</strong>
          <small>This month</small>
        </article>
        <article class="metric-card violet">
          <span>Membership revenue</span>
          <strong>{{ data.membershipRevenue | currency: 'INR':'symbol':'1.0-0' }}</strong>
          <small>Active plan value</small>
        </article>
        <article class="metric-card slate">
          <span>Retention</span>
          <strong>{{ data.clientRetention }}%</strong>
          <small>Completed booking ratio</small>
        </article>
        <article class="metric-card rose">
          <span>Repeat customers</span>
          <strong>{{ data.repeatCustomerRate }}%</strong>
          <small>Clients with 2+ visits</small>
        </article>
      </div>

      <div class="dashboard-grid" *ngIf="report() as data">
        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Quick actions</span>
              <h2>Front desk command cards</h2>
            </div>
          </div>
          <div class="quick-grid">
            <a class="action-card" routerLink="/appointments">
              <strong>Walk-in booking</strong>
              <span>Create arrival, assign chair and confirm by WhatsApp.</span>
            </a>
            <a class="action-card" routerLink="/pos">
              <strong>Fast POS checkout</strong>
              <span>Services, products, GST, UPI and split payments.</span>
            </a>
            <a class="action-card" routerLink="/inventory">
              <strong>Purchase entry</strong>
              <span>Retail and professional stock with low stock alerts.</span>
            </a>
            <a class="action-card" routerLink="/marketing">
              <strong>Client win-back</strong>
              <span>Segment inactive, VIP or high-spend clients.</span>
            </a>
          </div>
        </section>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Staff performance</span>
              <h2>Today and month indicators</h2>
            </div>
          </div>
          <div class="rank-list">
            <article *ngFor="let staff of data.staffPerformance">
              <div>
                <strong>{{ staff.name }}</strong>
                <span>{{ staff.role }}</span>
              </div>
              <div class="right">
                <strong>{{ staff.revenue | currency: 'INR':'symbol':'1.0-0' }}</strong>
                <small>{{ staff.bookings }} bookings</small>
              </div>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Inventory alerts</span>
              <h2>Low stock and expiry</h2>
            </div>
            <a class="ghost-button" routerLink="/inventory">Open stock</a>
          </div>
          <div class="alert-list">
            <article *ngFor="let product of data.lowStockAlerts">
              <strong>{{ product.name }}</strong>
              <span>{{ product.stock }} left in {{ product.branchId }}</span>
            </article>
            <article *ngIf="!data.lowStockAlerts.length">
              <strong>No low stock alerts</strong>
              <span>All products are above threshold.</span>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Online booking</span>
              <h2>Operational workflow</h2>
            </div>
          </div>
          <div class="timeline">
            <span>Requested</span>
            <span>Confirmed</span>
            <span>Arrived</span>
            <span>Completed</span>
            <span>Billed</span>
          </div>
          <p class="muted">Appointment completion unlocks billing. Sale checkout updates invoice status, client history, loyalty, stock and commission.</p>
        </section>
      </div>
    </section>
  `
})
export class DashboardComponent implements OnInit {
  readonly report = signal<ApiRecord | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.report<ApiRecord>('dashboard', { branchId: this.api.selectedBranchId() }).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load dashboard');
        this.loading.set(false);
      }
    });
  }
}
