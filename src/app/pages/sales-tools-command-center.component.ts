import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiRecord, ApiService } from '../core/api.service';

type SalesToolMetric = {
  label: string;
  value: string | number;
  type?: string;
};

type SalesToolAction = {
  label: string;
  route?: string;
  disabled?: boolean;
};

type SalesToolCard = {
  title: string;
  description: string;
  status: string;
  primaryRoute: string;
  metrics: SalesToolMetric[];
  actions: SalesToolAction[];
};

type SalesToolsResponse = {
  summary: ApiRecord;
  cards: Record<string, SalesToolCard>;
};

@Component({
  selector: 'app-sales-tools-command-center',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="sales-tools-page">
      <header class="sales-tools-hero">
        <div>
          <span class="eyebrow">Sales tools</span>
          <h1>Sales Tools Command Center</h1>
          <p>Gift cards, campaigns, coupons, loyalty, marketplace, deals aur automation ko ek jagah se operate karo.</p>
        </div>
        <div class="hero-actions">
          <a class="ghost-button" routerLink="/message-templates">Message templates</a>
          <a class="ghost-button" routerLink="/discount-rules/coupon-engine">Coupons</a>
          <button class="primary-button" type="button" (click)="load()" [disabled]="loading()">{{ loading() ? 'Refreshing...' : 'Refresh' }}</button>
        </div>
      </header>

      <div class="state error" *ngIf="error()">{{ error() }}</div>

      <section class="summary-grid">
        <article class="summary-card" *ngFor="let item of summaryCards()">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.detail }}</small>
        </article>
      </section>

      <section class="tool-grid">
        <article class="tool-card" *ngFor="let card of cards()">
          <div class="tool-card-head">
            <div>
              <span class="tool-icon">{{ initials(card.title) }}</span>
              <h2>{{ card.title }}</h2>
            </div>
            <span class="status-badge" [ngClass]="statusClass(card.status)">{{ card.status }}</span>
          </div>
          <p>{{ card.description }}</p>

          <div class="metric-grid">
            <div class="metric" *ngFor="let metric of card.metrics">
              <small>{{ metric.label }}</small>
              <strong>{{ metricValue(metric) }}</strong>
            </div>
          </div>

          <div class="card-actions">
            <a class="primary-link" [routerLink]="card.primaryRoute">Open</a>
            <ng-container *ngFor="let action of card.actions">
              <a *ngIf="!action.disabled && action.route; else disabledAction" class="ghost-link" [routerLink]="action.route">{{ action.label }}</a>
              <ng-template #disabledAction>
                <span class="ghost-link disabled">{{ action.label }}</span>
              </ng-template>
            </ng-container>
          </div>
        </article>
      </section>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .sales-tools-page {
      display: grid;
      gap: 16px;
      padding: 20px;
      color: #102033;
    }
    .sales-tools-hero {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      padding: 24px;
      border: 1px solid #d8e7e2;
      border-radius: 8px;
      background: linear-gradient(120deg, #f8fffc 0%, #eef8f3 100%);
      box-shadow: 0 16px 38px rgba(30, 57, 47, 0.08);
    }
    .eyebrow {
      display: block;
      margin-bottom: 6px;
      color: #53635d;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    h1, h2, p { margin: 0; }
    h1 {
      font-size: clamp(1.7rem, 2vw, 2.35rem);
      line-height: 1.05;
    }
    .sales-tools-hero p {
      max-width: 760px;
      margin-top: 10px;
      color: #586a65;
      font-size: 1rem;
      line-height: 1.45;
    }
    .hero-actions, .card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .primary-button, .ghost-button, .primary-link, .ghost-link {
      border: 1px solid #cfe2dc;
      border-radius: 8px;
      padding: 10px 14px;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
      white-space: nowrap;
    }
    .primary-button, .primary-link {
      background: #0b9f71;
      border-color: #0b9f71;
      color: #fff;
    }
    .ghost-button, .ghost-link {
      background: #fff;
      color: #142335;
    }
    .ghost-link.disabled {
      color: #7a8782;
      cursor: default;
      opacity: 0.68;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }
    .summary-card, .tool-card {
      border: 1px solid #dce9e4;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 12px 28px rgba(31, 47, 42, 0.06);
    }
    .summary-card {
      display: grid;
      gap: 8px;
      min-height: 112px;
      padding: 16px;
    }
    .summary-card span, .metric small {
      color: #5a6b65;
      font-size: 0.78rem;
      font-weight: 800;
    }
    .summary-card strong {
      font-size: 1.7rem;
      line-height: 1;
    }
    .summary-card small { color: #62736d; }
    .tool-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .tool-card {
      display: grid;
      gap: 14px;
      padding: 18px;
      min-height: 330px;
      align-content: start;
    }
    .tool-card-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }
    .tool-card-head > div {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .tool-icon {
      display: inline-grid;
      width: 42px;
      height: 42px;
      place-items: center;
      border-radius: 8px;
      background: #e8f8f2;
      color: #007a5a;
      font-weight: 900;
    }
    h2 {
      font-size: 1.08rem;
      line-height: 1.2;
    }
    .tool-card p {
      color: #556862;
      line-height: 1.45;
      min-height: 42px;
    }
    .status-badge {
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 0.75rem;
      font-weight: 900;
      white-space: nowrap;
      background: #eef2f0;
      color: #46534f;
    }
    .status-badge.active {
      background: #dff8ed;
      color: #087153;
    }
    .status-badge.setup {
      background: #fff1dd;
      color: #915900;
    }
    .status-badge.empty {
      background: #f2f5f4;
      color: #66736f;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .metric {
      display: grid;
      gap: 6px;
      padding: 12px;
      border-radius: 8px;
      background: #f8fbfa;
      border: 1px solid #e3efea;
      min-height: 74px;
    }
    .metric strong {
      font-size: 1.04rem;
      overflow-wrap: anywhere;
    }
    .card-actions {
      align-self: end;
      padding-top: 4px;
    }
    .state.error {
      border: 1px solid #ffc9c9;
      border-radius: 8px;
      padding: 12px 14px;
      color: #a31212;
      background: #fff2f2;
    }
    @media (max-width: 1200px) {
      .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .tool-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 760px) {
      .sales-tools-page { padding: 12px; }
      .sales-tools-hero { align-items: stretch; flex-direction: column; }
      .summary-grid, .tool-grid, .metric-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class SalesToolsCommandCenterComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly response = signal<SalesToolsResponse | null>(null);

  readonly order = ['referrals', 'giftCards', 'campaigns', 'automations', 'coupons', 'rewards', 'marketplace', 'deals', 'boost'];

  readonly summaryCards = computed(() => {
    const summary = this.response()?.summary || {};
    return [
      { label: 'Total tools', value: summary['totalTools'] || 9, detail: 'Sales modules in this hub' },
      { label: 'Active', value: summary['activeTools'] || 0, detail: 'Live data / enabled setup' },
      { label: 'Setup required', value: summary['setupRequired'] || 0, detail: 'Needs configuration' },
      { label: 'No data', value: summary['noData'] || 0, detail: 'Ready but empty' },
      { label: 'Last refresh', value: this.shortDate(summary['lastUpdatedAt']), detail: 'Current branch scope' }
    ];
  });

  readonly cards = computed(() => {
    const cards = this.response()?.cards || {};
    return this.order.map((key) => cards[key]).filter(Boolean);
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list<SalesToolsResponse>('sales-tools/summary').subscribe({
      next: (data) => {
        this.response.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || err?.message || 'Sales tools summary load nahi hua.');
        this.loading.set(false);
      }
    });
  }

  initials(title: string): string {
    return title
      .split(/\s+|\/|&/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  statusClass(status: string): string {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('active')) return 'active';
    if (normalized.includes('setup')) return 'setup';
    return 'empty';
  }

  metricValue(metric: SalesToolMetric): string {
    if (metric.type === 'money') return this.money(metric.value);
    return String(metric.value ?? '-');
  }

  money(value: string | number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  shortDate(value: unknown): string {
    const date = value ? new Date(String(value)) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
