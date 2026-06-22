import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-staff-sales-report',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, FormsModule, RouterLink, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Reports / Staff sales</span>
          <h2>Staff Sales Report</h2>
          <p>POS line-item attribution for services, products, memberships, packages and gift cards.</p>
        </div>
        <div class="hero-actions">
          <a class="ghost-button" routerLink="/reports">Reports</a>
          <a class="ghost-button" routerLink="/reports/commission-preview">Commission preview</a>
          <button class="ghost-button" type="button" (click)="load()">Refresh</button>
        </div>
      </div>

      <section class="panel filter-panel">
        <label class="field">
          <span>From</span>
          <input type="date" [(ngModel)]="from" />
        </label>
        <label class="field">
          <span>To</span>
          <input type="date" [(ngModel)]="to" />
        </label>
        <div class="branch-context-card">
          <span>Header branch</span>
          <strong>{{ branchLabel() }}</strong>
          <small>Change branch only from top header.</small>
        </div>
        <button class="primary-button" type="button" (click)="load()">Apply filters</button>
      </section>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <ng-container *ngIf="report() as data">
        <div class="metrics-grid">
          <article class="metric-card">
            <span>Total attributed sales</span>
            <strong>{{ data.totals?.totalRevenue || 0 | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>{{ data.totals?.itemCount || 0 }} line items</small>
          </article>
          <article class="metric-card">
            <span>Service sales</span>
            <strong>{{ data.totals?.serviceRevenue || 0 | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>Performed revenue</small>
          </article>
          <article class="metric-card">
            <span>Product sales</span>
            <strong>{{ data.totals?.productRevenue || 0 | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>Retail seller revenue</small>
          </article>
          <article class="metric-card">
            <span>Membership + package</span>
            <strong>{{ membershipPackageRevenue(data) | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>Plan and package selling</small>
          </article>
        </div>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Leaderboard</span>
              <h2>Staff summary</h2>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Total</th>
                  <th>Services</th>
                  <th>Products</th>
                  <th>Memberships</th>
                  <th>Packages</th>
                  <th>Gift cards</th>
                  <th>Items</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of data.staff || []">
                  <td>{{ row.staffName }}</td>
                  <td>{{ row.totalRevenue | currency: 'INR':'symbol':'1.0-0' }}</td>
                  <td>{{ row.serviceRevenue | currency: 'INR':'symbol':'1.0-0' }}</td>
                  <td>{{ row.productRevenue | currency: 'INR':'symbol':'1.0-0' }}</td>
                  <td>{{ row.membershipRevenue | currency: 'INR':'symbol':'1.0-0' }}</td>
                  <td>{{ row.packageRevenue | currency: 'INR':'symbol':'1.0-0' }}</td>
                  <td>{{ row.giftCardRevenue | currency: 'INR':'symbol':'1.0-0' }}</td>
                  <td>{{ row.itemCount }}</td>
                </tr>
                <tr *ngIf="!(data.staff || []).length">
                  <td colspan="8">No staff-attributed sales found.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Line item audit</span>
              <h2>Staff by item</h2>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Staff</th>
                  <th>Category</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Share</th>
                  <th>Amount</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of data.items || []">
                  <td>{{ item.date | date: 'dd MMM yyyy' }}</td>
                  <td>{{ item.staffName }}</td>
                  <td>{{ item.itemTypeLabel }}</td>
                  <td>{{ item.itemName }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ item.sharePercent || 100 }}%</td>
                  <td>{{ item.amount | currency: 'INR':'symbol':'1.0-0' }}</td>
                  <td>
                    <span class="badge" [class.warning]="item.sourceStaffId !== 'line_item'">
                      {{ sourceLabel(item.sourceStaffId) }}
                    </span>
                  </td>
                </tr>
                <tr *ngIf="!(data.items || []).length">
                  <td colspan="8">No line items found for selected filters.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </ng-container>
    </section>
  `,
  styles: [`
    .filter-panel {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
      gap: 12px;
      align-items: end;
    }
    .metric-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
      border-top: 4px solid var(--primary);
      box-shadow: var(--shadow-sm);
      padding: 18px;
    }
    .metric-card span,
    .metric-card small {
      color: var(--muted);
      display: block;
    }
    .metric-card strong {
      display: block;
      font-size: 30px;
      margin: 8px 0 4px;
    }
    .badge.warning {
      background: #fff7ed;
      color: #9a3412;
    }
    @media (max-width: 900px) {
      .filter-panel {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class StaffSalesReportComponent implements OnInit {
  readonly report = signal<ApiRecord | null>(null);
  readonly branches = signal<ApiRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  from = '';
  to = '';
  private initialized = false;

  constructor(private readonly api: ApiService) {
    effect(() => {
      this.api.selectedBranchId();
      if (this.initialized) this.load();
    });
  }

  ngOnInit(): void {
    this.initialized = true;
    this.loadBranches();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const branchId = this.api.selectedBranchId();
    this.api.report<ApiRecord>('staff-sales', {
      branchId,
      from: this.from,
      to: this.to
    }).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load staff sales report');
        this.loading.set(false);
      }
    });
  }

  membershipPackageRevenue(report: ApiRecord): number {
    const totals = report.totals || {};
    return Number(totals.membershipRevenue || 0) + Number(totals.packageRevenue || 0);
  }

  sourceLabel(source: unknown): string {
    if (source === 'split_attribution') return 'Split staff';
    if (source === 'line_item') return 'Item staff';
    return 'Invoice fallback';
  }

  branchLabel(): string {
    const branchId = this.api.selectedBranchId();
    if (!branchId) return 'Header branch not selected';
    return this.branches().find((branch) => branch.id === branchId)?.name || branchId;
  }

  private loadBranches(): void {
    this.api.list<ApiRecord[]>('branches', { limit: 1000 }).subscribe({
      next: (branches) => this.branches.set(branches || []),
      error: () => this.branches.set([])
    });
  }
}
