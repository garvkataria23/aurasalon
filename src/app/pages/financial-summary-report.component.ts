import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

type MatrixCell = { key: string; label: string; tone?: 'section' | 'primary' | 'normal' };
type MatrixColumn = { key: string; label: string; from?: string; to?: string };
type ReportTab = 'summary' | 'payments';
type PaymentDistributionRow = {
  date: string;
  invoiceDateValue: string;
  name: string;
  contact: string;
  invoiceNo: string;
  invoiceId: string;
  price: number;
  paymentMode: string;
  paymentModeKey: string;
  transactionId: string;
  paymentDate: string;
  paymentDateValue: string;
  notes: string;
};

@Component({
  selector: 'app-financial-summary-report',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, FormsModule, RouterLink, StateComponent],
  template: `
    <section class="financial-summary-page">
      <div class="module-hero financial-hero">
        <div>
          <span class="eyebrow">Reports / Financial summary</span>
          <h2>Financial Summary</h2>
          <p>Month-wise sales, collection, pending balance, discounts, taxes, expenses, tips and payment mode reconciliation.</p>
        </div>
        <div class="hero-actions">
          <a class="ghost-button" routerLink="/reports">Reports</a>
          <a class="ghost-button" routerLink="/reports/invoices">Invoice reports</a>
          <a class="ghost-button" routerLink="/finance">Finance</a>
          <button class="ghost-button" type="button" (click)="exportCsv()" [disabled]="activeTab === 'summary' ? !matrixColumns().length : !paymentDistributionRows().length">Export</button>
          <button class="ghost-button icon-action" type="button" (click)="printReport()" title="Print financial summary">Print</button>
        </div>
      </div>

      <div class="report-tabs" role="tablist" aria-label="Financial report views">
        <button type="button" [class.active]="activeTab === 'summary'" (click)="activeTab = 'summary'">Financial Summary</button>
        <button type="button" [class.active]="activeTab === 'payments'" (click)="activeTab = 'payments'">Payment Distributions</button>
      </div>

      <section class="panel filter-panel">
        <label class="field" *ngIf="activeTab === 'summary'">
          <span>View</span>
          <select [(ngModel)]="periodMode">
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
          </select>
        </label>
        <label class="field" *ngIf="activeTab === 'payments'">
          <span>Type</span>
          <select [(ngModel)]="paymentTypeFilter">
            <option value="">All Type</option>
            <option *ngFor="let type of paymentTypeOptions()" [value]="type.key">{{ type.label }}</option>
          </select>
        </label>
        <label class="field" *ngIf="activeTab === 'payments'">
          <span>Date basis</span>
          <select [(ngModel)]="paymentDateBasis">
            <option value="payment">By Payment Date</option>
            <option value="invoice">By Invoice Date</option>
          </select>
        </label>
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
          <small>Change branch from top header.</small>
        </div>
        <button class="primary-button" type="button" (click)="load()">Go</button>
      </section>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <ng-container *ngIf="!loading() && !error() && activeTab === 'summary'">
        <div class="summary-strip">
          <article>
            <span>Total Sales</span>
            <strong>{{ totalFor('totalSales') | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>{{ invoiceCount() }} bills</small>
          </article>
          <article>
            <span>Paid</span>
            <strong>{{ totalFor('paid') | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>Received amount</small>
          </article>
          <article>
            <span>Balance</span>
            <strong>{{ totalFor('balance') | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>Pending collection</small>
          </article>
          <article>
            <span>Taxes</span>
            <strong>{{ totalFor('taxes') | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>GST / tax</small>
          </article>
          <article>
            <span>Expenses</span>
            <strong>{{ totalFor('expenses') | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>Finance entries</small>
          </article>
          <article>
            <span>Net Cashflow</span>
            <strong>{{ netCashflow() | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>Paid less expenses</small>
          </article>
        </div>

        <section class="panel matrix-panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Owner accounting view</span>
              <h2>Sales and collection matrix</h2>
              <p>{{ dateLabel(from) }} to {{ dateLabel(to) }} · {{ matrixColumns().length - 1 }} {{ periodMode === 'quarter' ? 'quarter(s)' : 'month(s)' }}</p>
            </div>
            <div class="hero-actions">
              <span class="badge">{{ branchLabel() }}</span>
              <span class="badge">{{ periodModeLabel() }}</span>
            </div>
          </div>

          <div class="financial-table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="row-head">Sales</th>
                  <th *ngFor="let column of matrixColumns()" class="right">{{ column.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of matrixRows()" [class.section-row]="row.tone === 'section'" [class.primary-row]="row.tone === 'primary'">
                  <td>{{ row.label }}</td>
                  <td *ngFor="let column of matrixColumns()" class="right">{{ valueFor(row.key, column.key) | number: '1.2-2' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel insight-panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Quick checks</span>
              <h2>Financial control signals</h2>
            </div>
          </div>
          <div class="insight-grid">
            <article>
              <span>Collection rate</span>
              <strong>{{ collectionRate() }}%</strong>
              <small>Paid against total sales</small>
            </article>
            <article>
              <span>Discount leakage</span>
              <strong>{{ discountRate() }}%</strong>
              <small>Discounts against total sales</small>
            </article>
            <article>
              <span>Top mode</span>
              <strong>{{ topPaymentMode() }}</strong>
              <small>Highest collected mode</small>
            </article>
            <article>
              <span>Pending risk</span>
              <strong>{{ pendingRiskLabel() }}</strong>
              <small>{{ totalFor('balance') | currency: 'INR':'symbol':'1.0-0' }} balance</small>
            </article>
          </div>
        </section>
      </ng-container>

      <ng-container *ngIf="!loading() && !error() && activeTab === 'payments'">
        <section class="payment-distribution-stack">
          <div class="payment-card-strip">
            <article *ngFor="let card of paymentDistributionCards()">
              <strong>{{ card.value }}</strong>
              <span>{{ card.label }}</span>
            </article>
          </div>

          <section class="panel payment-table-panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">Payment register</span>
                <h2>Payment Distributions</h2>
                <p>{{ dateLabel(from) }} to {{ dateLabel(to) }} · {{ paymentDistributionRows().length }} payment row(s)</p>
              </div>
              <div class="payment-actions">
                <label class="search-field">
                  <span class="sr-only">Search payment rows</span>
                  <input [(ngModel)]="paymentSearch" placeholder="Name, phone or invoice" />
                </label>
                <button class="ghost-button" type="button" (click)="exportCsv()" [disabled]="!paymentDistributionRows().length">Download</button>
              </div>
            </div>

            <div class="payment-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Invoice No</th>
                    <th class="right">Price</th>
                    <th>Payment Modes</th>
                    <th>Transaction ID</th>
                    <th>Payment Date</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let row of visiblePaymentDistributionRows()">
                    <td>{{ row.date }}</td>
                    <td>{{ row.name }}</td>
                    <td>{{ row.contact }}</td>
                    <td>{{ row.invoiceNo }}</td>
                    <td class="right">{{ row.price | number: '1.2-2' }}</td>
                    <td><span class="mode-pill">{{ row.paymentMode }}</span></td>
                    <td>{{ row.transactionId || '-' }}</td>
                    <td>{{ row.paymentDate }}</td>
                    <td>{{ row.notes || '-' }}</td>
                    <td>
                      <a class="row-action" [routerLink]="['/pos/invoices']" [queryParams]="{ q: row.invoiceNo || row.invoiceId }">Open</a>
                    </td>
                  </tr>
                  <tr *ngIf="!visiblePaymentDistributionRows().length">
                    <td colspan="10" class="empty-cell">No payment distribution rows found.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </ng-container>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    .financial-summary-page {
      display: grid;
      gap: 14px;
      color: var(--ink);
    }

    .financial-hero {
      padding: 20px 22px;
    }

    .hero-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    .report-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      width: fit-content;
      max-width: 100%;
      padding: 4px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: #fff;
      box-shadow: var(--shadow-sm);
    }

    .report-tabs button {
      border: 0;
      border-radius: 8px;
      padding: 10px 14px;
      color: var(--muted);
      background: transparent;
      font-weight: 900;
      cursor: pointer;
    }

    .report-tabs button.active {
      color: #fff;
      background: var(--teal);
      box-shadow: 0 8px 20px rgba(15, 118, 110, .18);
    }

    .icon-action {
      min-width: 42px;
    }

    .filter-panel {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      align-items: end;
    }

    .filter-panel .primary-button {
      min-height: 48px;
    }

    .summary-strip {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
    }

    .summary-strip article,
    .insight-grid article {
      display: grid;
      gap: 6px;
      min-width: 0;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: #fff;
      box-shadow: var(--shadow-sm);
    }

    .summary-strip span,
    .insight-grid span {
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .summary-strip strong {
      font-size: 1.18rem;
      line-height: 1.05;
    }

    .summary-strip small,
    .insight-grid small,
    .section-title p {
      color: var(--muted);
    }

    .matrix-panel,
    .insight-panel {
      display: grid;
      gap: 14px;
    }

    .financial-table-wrap {
      max-height: min(690px, calc(100vh - 260px));
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: #fff;
      box-shadow: var(--shadow-sm);
    }

    table {
      width: 100%;
      min-width: 1040px;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 0.9rem;
    }

    th,
    td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      vertical-align: middle;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: #f8fafc;
      color: var(--muted);
      font-size: 0.74rem;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .row-head,
    td:first-child {
      position: sticky;
      left: 0;
      z-index: 1;
      width: 240px;
      background: #fff;
      color: #182335;
      font-weight: 900;
      text-align: left;
    }

    .row-head {
      z-index: 3;
      background: #f8fafc;
    }

    .right {
      text-align: right;
    }

    tbody tr:hover td {
      background: #f8fbff;
    }

    tbody tr:hover td:first-child {
      background: #f1f8ff;
    }

    .section-row td {
      background: #f8fafc;
      color: #4b627d;
      font-size: 1rem;
      text-transform: uppercase;
    }

    .section-row td:not(:first-child) {
      color: transparent;
    }

    .primary-row td {
      color: #0f766e;
      font-weight: 900;
    }

    .insight-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .payment-distribution-stack {
      display: grid;
      gap: 14px;
    }

    .payment-card-strip {
      display: grid;
      grid-template-columns: repeat(10, minmax(130px, 1fr));
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .payment-card-strip article {
      min-height: 72px;
      display: grid;
      gap: 8px;
      align-content: center;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: #fff;
      box-shadow: var(--shadow-sm);
    }

    .payment-card-strip strong {
      color: var(--ink);
      font-size: 1.08rem;
      line-height: 1.05;
    }

    .payment-card-strip span {
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .payment-table-panel {
      display: grid;
      gap: 12px;
    }

    .payment-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    .search-field input {
      width: min(260px, 72vw);
      min-height: 42px;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 0 14px;
      background: #fff;
      color: var(--ink);
      font: inherit;
    }

    .payment-table-wrap {
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: #fff;
    }

    .payment-table-wrap table {
      min-width: 1180px;
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
    }

    .payment-table-wrap th,
    .payment-table-wrap td {
      padding: 12px 10px;
      border-bottom: 1px solid var(--line);
      color: var(--ink);
      font-size: 0.82rem;
      text-align: left;
      vertical-align: middle;
    }

    .payment-table-wrap th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #f8fbfa;
      color: var(--muted);
      font-size: 0.7rem;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .mode-pill,
    .row-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(15, 118, 110, .22);
      color: var(--teal);
      background: rgba(15, 118, 110, .08);
      font-weight: 900;
      text-decoration: none;
      white-space: nowrap;
    }

    .empty-cell {
      height: 160px;
      text-align: center !important;
      color: var(--muted) !important;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 1180px) {
      .filter-panel,
      .summary-strip,
      .insight-grid,
      .payment-card-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 720px) {
      .filter-panel,
      .summary-strip,
      .insight-grid,
      .payment-card-strip {
        grid-template-columns: 1fr;
      }

      .financial-hero {
        align-items: flex-start;
      }

      .hero-actions {
        justify-content: flex-start;
      }
    }
  `]
})
export class FinancialSummaryReportComponent implements OnInit {
  readonly loading = signal(false);
  readonly error = signal('');
  readonly invoices = signal<ApiRecord[]>([]);
  readonly payments = signal<ApiRecord[]>([]);
  readonly sales = signal<ApiRecord[]>([]);
  readonly branches = signal<ApiRecord[]>([]);
  readonly walletTransactions = signal<ApiRecord[]>([]);
  readonly financeSummary = signal<ApiRecord>({});

  activeTab: ReportTab = 'summary';
  periodMode: 'month' | 'quarter' = 'month';
  paymentTypeFilter = '';
  paymentDateBasis: 'payment' | 'invoice' = 'payment';
  paymentSearch = '';
  from = this.defaultFrom();
  to = this.today();

  readonly baseRows: MatrixCell[] = [
    { key: 'sales', label: 'SALES', tone: 'section' },
    { key: 'totalSales', label: 'Total Sales', tone: 'primary' },
    { key: 'paid', label: 'Paid' },
    { key: 'balance', label: 'Balance' },
    { key: 'discounts', label: 'Discounts' },
    { key: 'couponDiscounts', label: 'Coupon Discounts' },
    { key: 'taxes', label: 'Taxes' },
    { key: 'exCharges', label: 'Ex Charges' },
    { key: 'giftCardsSale', label: 'Gift Cards Sale' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'appointmentsAdvance', label: 'Appointments Advance' },
    { key: 'tips', label: 'Tips' }
  ];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      invoices: this.safeList('invoices', { limit: 10000 }),
      payments: this.safeList('payments', { limit: 10000 }),
      sales: this.safeList('sales', { limit: 10000 }),
      branches: this.safeList('branches', { limit: 1000 }),
      walletTransactions: this.safeList('walletTransactions', { limit: 10000 }),
      financeSummary: this.api.list<ApiRecord>('finance/summary').pipe(catchError(() => of({} as ApiRecord)))
    }).subscribe({
      next: (data) => {
        this.invoices.set(data.invoices || []);
        this.payments.set(data.payments || []);
        this.sales.set(data.sales || []);
        this.branches.set(data.branches || []);
        this.walletTransactions.set(data.walletTransactions || []);
        this.financeSummary.set(data.financeSummary || {});
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(this.api.errorText(error, 'Unable to load financial summary'));
        this.loading.set(false);
      }
    });
  }

  matrixColumns(): MatrixColumn[] {
    return [
      { key: 'total', label: 'TOTAL' },
      ...this.periodColumns()
    ];
  }

  matrixRows(): MatrixCell[] {
    const modes = this.paymentModeRows();
    return [
      ...this.baseRows,
      ...modes
    ];
  }

  valueFor(rowKey: string, columnKey: string): number {
    if (rowKey === 'sales') return 0;
    const columns = columnKey === 'total' ? this.periodColumns() : this.periodColumns().filter((column) => column.key === columnKey);
    return this.money(columns.reduce((sum, column) => sum + this.valueForPeriod(rowKey, column), 0));
  }

  totalFor(rowKey: string): number {
    return this.valueFor(rowKey, 'total');
  }

  invoiceCount(): number {
    return this.filteredInvoices().length;
  }

  paymentDistributionCards(): Array<{ label: string; value: string }> {
    const rows = this.paymentRowsInDateRange();
    const amountFor = (modeKey: string) => rows
      .filter((row) => modeKey === 'all' || row.paymentModeKey === modeKey)
      .reduce((sum, row) => sum + row.price, 0);
    return [
      { label: 'Payment Count', value: String(rows.length) },
      { label: 'Total Amount', value: this.money(amountFor('all')).toFixed(2) },
      { label: 'CARD', value: this.money(amountFor('card')).toFixed(2) },
      { label: 'CASH', value: this.money(amountFor('cash')).toFixed(2) },
      { label: 'Check', value: this.money(amountFor('check')).toFixed(2) },
      { label: 'DINGG PAYMENT', value: this.money(amountFor('dingg_payment')).toFixed(2) },
      { label: 'UPI', value: this.money(amountFor('upi')).toFixed(2) },
      { label: 'Prepaid', value: this.money(amountFor('prepaid')).toFixed(2) },
      { label: 'Reward', value: this.money(amountFor('reward')).toFixed(2) },
      { label: 'Giftcard', value: this.money(amountFor('giftcard')).toFixed(2) }
    ];
  }

  paymentTypeOptions(): Array<{ key: string; label: string }> {
    const baseline = new Map<string, string>([
      ['card', 'CARD'],
      ['cash', 'CASH'],
      ['check', 'Check'],
      ['dingg_payment', 'DINGG PAYMENT'],
      ['upi', 'UPI'],
      ['prepaid', 'Prepaid'],
      ['reward', 'Reward'],
      ['giftcard', 'Giftcard']
    ]);
    for (const row of this.paymentRowsInDateRange()) {
      baseline.set(row.paymentModeKey, row.paymentMode);
    }
    return [...baseline.entries()].map(([key, label]) => ({ key, label }));
  }

  paymentDistributionRows(): PaymentDistributionRow[] {
    return this.paymentRowsInDateRange()
      .filter((row) => !this.paymentTypeFilter || row.paymentModeKey === this.paymentTypeFilter)
      .sort((a, b) => this.dateMs(b.paymentDateValue) - this.dateMs(a.paymentDateValue));
  }

  visiblePaymentDistributionRows(): PaymentDistributionRow[] {
    const query = this.paymentSearch.trim().toLowerCase();
    return this.paymentDistributionRows().filter((row) => {
      if (!query) return true;
      return [
        row.name,
        row.contact,
        row.invoiceNo,
        row.paymentMode,
        row.transactionId,
        row.notes
      ].join(' ').toLowerCase().includes(query);
    });
  }

  netCashflow(): number {
    return this.money(this.totalFor('paid') - this.totalFor('expenses'));
  }

  collectionRate(): number {
    const total = this.totalFor('totalSales');
    return total ? this.money((this.totalFor('paid') / total) * 100) : 0;
  }

  discountRate(): number {
    const total = this.totalFor('totalSales');
    return total ? this.money((this.totalFor('discounts') / total) * 100) : 0;
  }

  topPaymentMode(): string {
    const modes = this.paymentModeRows()
      .map((row) => ({ label: row.label, amount: this.totalFor(row.key) }))
      .sort((a, b) => b.amount - a.amount);
    return modes[0]?.amount ? modes[0].label : 'No payment';
  }

  pendingRiskLabel(): string {
    const balance = this.totalFor('balance');
    const sales = this.totalFor('totalSales');
    if (!balance) return 'Clear';
    const rate = sales ? balance / sales : 0;
    if (rate >= 0.15) return 'High';
    if (rate >= 0.05) return 'Watch';
    return 'Low';
  }

  periodModeLabel(): string {
    return this.periodMode === 'quarter' ? 'Quarter view' : 'Month view';
  }

  branchLabel(): string {
    const branchId = this.api.selectedBranchId();
    if (!branchId) return 'All branches';
    return this.branches().find((branch) => String(branch.id) === String(branchId))?.['name'] || branchId;
  }

  dateLabel(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  compactDateLabel(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || '-';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  }

  exportCsv(): void {
    if (this.activeTab === 'payments') {
      this.exportPaymentDistributionCsv();
      return;
    }
    const columns = this.matrixColumns();
    const rows = this.matrixRows();
    const csv = [
      ['Sales', ...columns.map((column) => column.label)].map((cell) => this.csvCell(cell)).join(','),
      ...rows.map((row) => [
        row.label,
        ...columns.map((column) => row.tone === 'section' ? '' : this.valueFor(row.key, column.key).toFixed(2))
      ].map((cell) => this.csvCell(cell)).join(','))
    ].join('\n');
    this.downloadFile(`financial-summary-${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
  }

  printReport(): void {
    window.print();
  }

  private exportPaymentDistributionCsv(): void {
    const headers = ['Date', 'Name', 'Contact', 'Invoice No', 'Price', 'Payment Modes', 'Transaction ID', 'Payment Date', 'Notes'];
    const csv = [
      headers.map((cell) => this.csvCell(cell)).join(','),
      ...this.visiblePaymentDistributionRows().map((row) => [
        row.date,
        row.name,
        row.contact,
        row.invoiceNo,
        row.price.toFixed(2),
        row.paymentMode,
        row.transactionId,
        row.paymentDate,
        row.notes
      ].map((cell) => this.csvCell(cell)).join(','))
    ].join('\n');
    this.downloadFile(`payment-distributions-${Date.now()}.csv`, csv, 'text/csv;charset=utf-8');
  }

  private safeList(resource: string, params: ApiRecord = {}) {
    return this.api.list<ApiRecord[]>(resource, params).pipe(catchError(() => of([] as ApiRecord[])));
  }

  private periodColumns(): MatrixColumn[] {
    const start = this.periodStart(new Date(this.from || this.defaultFrom()));
    const end = this.periodStart(new Date(this.to || this.today()));
    const columns: MatrixColumn[] = [];
    const cursor = new Date(end);
    while (cursor.getTime() >= start.getTime()) {
      const from = new Date(cursor);
      const to = this.periodEnd(from);
      columns.push({
        key: this.periodKey(from),
        label: this.periodLabel(from),
        from: from.toISOString(),
        to: to.toISOString()
      });
      if (this.periodMode === 'quarter') {
        cursor.setMonth(cursor.getMonth() - 3);
      } else {
        cursor.setMonth(cursor.getMonth() - 1);
      }
    }
    return columns;
  }

  private valueForPeriod(rowKey: string, column: MatrixColumn): number {
    if (rowKey.startsWith('mode:')) {
      const mode = rowKey.slice(5);
      return this.paymentTotalForMode(column, mode);
    }
    const invoices = this.invoicesForPeriod(column);
    switch (rowKey) {
      case 'totalSales':
        return this.money(invoices.reduce((sum, invoice) => sum + this.invoiceTotal(invoice), 0));
      case 'paid':
        return this.money(invoices.reduce((sum, invoice) => sum + this.invoicePaid(invoice), 0));
      case 'balance':
        return this.money(invoices.reduce((sum, invoice) => sum + this.invoiceBalance(invoice), 0));
      case 'discounts':
        return this.money(invoices.reduce((sum, invoice) => sum + this.invoiceDiscount(invoice), 0));
      case 'couponDiscounts':
        return this.money(invoices.reduce((sum, invoice) => sum + this.couponDiscount(invoice), 0));
      case 'taxes':
        return this.money(invoices.reduce((sum, invoice) => sum + this.invoiceTax(invoice), 0));
      case 'exCharges':
        return this.money(invoices.reduce((sum, invoice) => sum + this.extraCharges(invoice), 0));
      case 'giftCardsSale':
        return this.money(this.linesForInvoices(invoices).filter((line) => this.itemType(line).includes('gift')).reduce((sum, line) => sum + this.lineAmount(line), 0));
      case 'expenses':
        return this.expensesForPeriod(column);
      case 'appointmentsAdvance':
        return this.paymentsForPeriod(column).filter((payment) => this.isAdvancePayment(payment)).reduce((sum, payment) => sum + this.paymentAmount(payment), 0);
      case 'tips':
        return this.money(invoices.reduce((sum, invoice) => sum + this.invoiceTips(invoice), 0));
      default:
        return 0;
    }
  }

  private filteredInvoices(): ApiRecord[] {
    return this.invoices().filter((invoice) => this.inDateRange(this.invoiceDate(invoice)));
  }

  private paymentRowsInDateRange(): PaymentDistributionRow[] {
    return this.paymentDistributionBaseRows().filter((row) => {
      const basisDate = this.paymentDateBasis === 'invoice' ? row.invoiceDateValue : row.paymentDateValue;
      return this.inDateRange(basisDate);
    });
  }

  private paymentDistributionBaseRows(): PaymentDistributionRow[] {
    const invoiceById = new Map<string, ApiRecord>();
    for (const invoice of this.invoices()) {
      const ids = [
        invoice['id'],
        invoice['invoiceId'],
        invoice['invoice_id'],
        invoice['invoiceNumber'],
        invoice['invoice_number'],
        invoice['number']
      ].filter((value) => value !== undefined && value !== null && value !== '');
      for (const id of ids) invoiceById.set(String(id), invoice);
    }

    return this.payments().map((payment) => {
      const invoiceId = String(payment['invoiceId'] || payment['invoice_id'] || payment['invoiceNumber'] || payment['invoice_number'] || '');
      const invoice = invoiceById.get(invoiceId) || {};
      const invoiceDateValue = this.invoiceDate(invoice) || this.paymentDate(payment);
      const paymentDateValue = this.paymentDate(payment) || invoiceDateValue;
      const paymentMode = this.modeLabel(this.paymentMode(payment));
      return {
        date: this.compactDateLabel(invoiceDateValue),
        invoiceDateValue,
        name: String(invoice['clientName'] || invoice['client_name'] || invoice['name'] || payment['clientName'] || payment['client_name'] || 'Walk In'),
        contact: String(invoice['clientPhone'] || invoice['client_phone'] || invoice['phone'] || payment['clientPhone'] || payment['client_phone'] || '-'),
        invoiceNo: String(invoice['invoiceNumber'] || invoice['invoice_number'] || invoice['number'] || payment['invoiceNumber'] || payment['invoice_number'] || invoiceId || '-'),
        invoiceId: String(invoice['id'] || invoiceId || ''),
        price: this.paymentAmount(payment),
        paymentMode,
        paymentModeKey: this.modeKey(paymentMode),
        transactionId: String(payment['transactionId'] || payment['transaction_id'] || payment['paymentId'] || payment['payment_id'] || payment['referenceNo'] || payment['reference_no'] || payment['id'] || ''),
        paymentDate: this.compactDateLabel(paymentDateValue),
        paymentDateValue,
        notes: String(payment['notes'] || payment['note'] || payment['remarks'] || payment['reference'] || payment['paymentReference'] || payment['payment_reference'] || '')
      };
    }).filter((row) => row.price > 0);
  }

  private invoicesForPeriod(column: MatrixColumn): ApiRecord[] {
    return this.filteredInvoices().filter((invoice) => this.inPeriod(this.invoiceDate(invoice), column));
  }

  private paymentsForPeriod(column: MatrixColumn): ApiRecord[] {
    return this.payments().filter((payment) => this.inPeriod(this.paymentDate(payment), column));
  }

  private paymentModeRows(): MatrixCell[] {
    const modes = new Map<string, string>();
    for (const payment of this.payments()) {
      const mode = this.paymentMode(payment);
      if (mode) modes.set(this.modeKey(mode), this.modeLabel(mode));
    }
    for (const mode of ['card', 'cash', 'check', 'upi', 'bank', 'wallet', 'reward']) {
      modes.set(this.modeKey(mode), this.modeLabel(mode));
    }
    return [...modes.entries()]
      .map(([key, label]) => ({ key: `mode:${key}`, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private paymentTotalForMode(column: MatrixColumn, modeKey: string): number {
    return this.money(this.paymentsForPeriod(column)
      .filter((payment) => this.modeKey(this.paymentMode(payment)) === modeKey)
      .reduce((sum, payment) => sum + this.paymentAmount(payment), 0));
  }

  private expensesForPeriod(column: MatrixColumn): number {
    const summaryRows = [
      ...this.arrayValue(this.financeSummary()['expenses']),
      ...this.arrayValue(this.financeSummary()['refunds'])
    ];
    return this.money(summaryRows
      .filter((row) => this.inPeriod(String(row['createdAt'] || row['created_at'] || row['date'] || row['businessDate'] || this.to), column))
      .reduce((sum, row) => sum + Number(row['amount'] || row['total'] || 0), 0));
  }

  private linesForInvoices(invoices: ApiRecord[]): ApiRecord[] {
    const saleById = new Map(this.sales().map((sale) => [String(sale['id']), sale]));
    return invoices.flatMap((invoice) => {
      const sale = saleById.get(String(invoice['saleId'] || invoice['sale_id'] || '')) || {};
      const lines = this.arrayValue(invoice['lineItems'] || invoice['line_items'] || sale['items']);
      return lines.length ? lines : [];
    });
  }

  private invoiceDate(invoice: ApiRecord): string {
    return String(invoice['createdAt'] || invoice['created_at'] || invoice['invoiceDate'] || invoice['invoice_date'] || invoice['date'] || '');
  }

  private invoiceTotal(invoice: ApiRecord): number {
    return this.money(Number(invoice['total'] ?? invoice['grandTotal'] ?? invoice['grand_total'] ?? 0));
  }

  private invoicePaid(invoice: ApiRecord): number {
    const explicit = invoice['paid'] ?? invoice['paidAmount'] ?? invoice['paid_amount'];
    if (explicit !== undefined && explicit !== null && explicit !== '') return this.money(Number(explicit));
    return this.money(this.payments()
      .filter((payment) => String(payment['invoiceId'] || payment['invoice_id'] || '') === String(invoice['id']))
      .reduce((sum, payment) => sum + this.paymentAmount(payment), 0));
  }

  private invoiceBalance(invoice: ApiRecord): number {
    const explicit = invoice['balance'] ?? invoice['dueAmount'] ?? invoice['due_amount'];
    if (explicit !== undefined && explicit !== null && explicit !== '') return this.money(Number(explicit));
    return this.money(Math.max(0, this.invoiceTotal(invoice) - this.invoicePaid(invoice)));
  }

  private invoiceDiscount(invoice: ApiRecord): number {
    return this.money(Number(invoice['discount'] || invoice['discountTotal'] || invoice['discount_total'] || invoice['manualDiscount'] || invoice['manual_discount'] || 0));
  }

  private couponDiscount(invoice: ApiRecord): number {
    return this.money(Number(invoice['couponDiscount'] || invoice['coupon_discount'] || 0));
  }

  private invoiceTax(invoice: ApiRecord): number {
    return this.money(Number(invoice['gst'] || invoice['gstAmount'] || invoice['gst_amount'] || invoice['tax'] || invoice['taxAmount'] || invoice['tax_amount'] || 0));
  }

  private extraCharges(invoice: ApiRecord): number {
    return this.money(Number(invoice['extraCharges'] || invoice['extra_charges'] || invoice['serviceCharge'] || invoice['service_charge'] || 0));
  }

  private invoiceTips(invoice: ApiRecord): number {
    return this.money(Number(invoice['tipAmount'] || invoice['tip_amount'] || invoice['tips'] || 0));
  }

  private paymentDate(payment: ApiRecord): string {
    return String(payment['paidAt'] || payment['paid_at'] || payment['paymentDate'] || payment['payment_date'] || payment['createdAt'] || payment['created_at'] || payment['date'] || '');
  }

  private paymentAmount(payment: ApiRecord): number {
    return this.money(Number(payment['amount'] || payment['paidAmount'] || payment['paid_amount'] || 0));
  }

  private paymentMode(payment: ApiRecord): string {
    return String(payment['mode'] || payment['paymentMode'] || payment['payment_mode'] || 'unknown');
  }

  private isAdvancePayment(payment: ApiRecord): boolean {
    const text = `${this.paymentMode(payment)} ${payment['reference'] || ''} ${payment['referenceNo'] || ''} ${payment['note'] || ''} ${payment['notes'] || ''}`.toLowerCase();
    return text.includes('advance') || text.includes('booking') || text.includes('prepaid');
  }

  private itemType(line: ApiRecord): string {
    return String(line['type'] || line['itemType'] || line['kind'] || line['category'] || line['name'] || '').toLowerCase();
  }

  private lineAmount(line: ApiRecord): number {
    return this.money(Number(line['total'] || line['lineTotal'] || line['line_total'] || line['price'] || 0));
  }

  private modeKey(mode: string): string {
    const normalized = String(mode || 'unknown').toLowerCase();
    if (normalized.includes('cash')) return 'cash';
    if (normalized.includes('card')) return 'card';
    if (normalized.includes('upi') || normalized.includes('gpay') || normalized.includes('paytm') || normalized.includes('phonepe')) return 'upi';
    if (normalized.includes('cheque') || normalized.includes('check')) return 'check';
    if (normalized.includes('dingg')) return 'dingg_payment';
    if (normalized.includes('prepaid') || normalized.includes('advance')) return 'prepaid';
    if (normalized.includes('giftcard') || normalized.includes('gift card')) return 'giftcard';
    if (normalized.includes('wallet')) return 'wallet';
    if (normalized.includes('reward')) return 'reward';
    if (normalized.includes('bank') || normalized.includes('neft') || normalized.includes('imps') || normalized.includes('rtgs')) return 'bank';
    return normalized.replace(/[^a-z0-9]+/g, '_') || 'unknown';
  }

  private modeLabel(mode: string): string {
    const key = this.modeKey(mode);
    const labels: Record<string, string> = {
      cash: 'CASH',
      card: 'CARD',
      upi: 'UPI',
      check: 'Check',
      dingg_payment: 'DINGG PAYMENT',
      prepaid: 'Prepaid',
      giftcard: 'Giftcard',
      bank: 'Bank',
      wallet: 'Wallet',
      reward: 'Reward',
      unknown: 'Unknown'
    };
    return labels[key] || key.replace(/_/g, ' ').toUpperCase();
  }

  private periodStart(date: Date): Date {
    const safe = Number.isNaN(date.getTime()) ? new Date() : new Date(date);
    if (this.periodMode === 'quarter') {
      const startMonth = Math.floor(safe.getMonth() / 3) * 3;
      return new Date(safe.getFullYear(), startMonth, 1);
    }
    return new Date(safe.getFullYear(), safe.getMonth(), 1);
  }

  private periodEnd(date: Date): Date {
    const start = this.periodStart(date);
    const end = new Date(start);
    end.setMonth(end.getMonth() + (this.periodMode === 'quarter' ? 3 : 1));
    end.setMilliseconds(end.getMilliseconds() - 1);
    return end;
  }

  private periodKey(date: Date): string {
    const start = this.periodStart(date);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  }

  private periodLabel(date: Date): string {
    const start = this.periodStart(date);
    if (this.periodMode === 'quarter') {
      return `Q${Math.floor(start.getMonth() / 3) + 1} ${String(start.getFullYear()).slice(2)}`;
    }
    return start.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }).toUpperCase();
  }

  private inDateRange(value: string): boolean {
    const time = this.dateMs(value);
    if (!time) return true;
    const from = this.dateMs(this.from);
    const to = this.dateMs(this.to) + 24 * 60 * 60 * 1000 - 1;
    return (!from || time >= from) && (!to || time <= to);
  }

  private inPeriod(value: string, column: MatrixColumn): boolean {
    const time = this.dateMs(value);
    const from = this.dateMs(column.from);
    const to = this.dateMs(column.to);
    return !!time && (!from || time >= from) && (!to || time <= to);
  }

  private arrayValue(value: unknown): ApiRecord[] {
    if (Array.isArray(value)) return value as ApiRecord[];
    if (!value) return [];
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private dateMs(value: unknown): number {
    if (!value) return 0;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private money(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  private csvCell(value: unknown): string {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  private downloadFile(filename: string, content: BlobPart, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private defaultFrom(): string {
    const date = new Date();
    date.setMonth(date.getMonth() - 5);
    date.setDate(1);
    return date.toISOString().slice(0, 10);
  }
}
