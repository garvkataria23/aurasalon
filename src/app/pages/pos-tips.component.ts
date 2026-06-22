import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiRecord, ApiService } from '../core/api.service';
import { PosPaymentMode, PosSettingsService } from '../core/pos-settings.service';
import { StateComponent } from '../shared/ui/state/state.component';

type TipLedgerRow = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  saleId: string;
  clientName: string;
  staffName: string;
  paymentMode: string;
  paymentModeLabel: string;
  branchName: string;
  amount: number;
  createdAt: string;
  invoiceStatus: string;
};

@Component({
  selector: 'app-pos-tips',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, DatePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">POS / tip ledger</span>
          <h2>Client tips register</h2>
          <p>Every tip saved from POS appears here with client, invoice, staff, payment mode and branch context.</p>
        </div>
        <div class="hero-actions">
          <a class="ghost-button" routerLink="/pos">Back to POS</a>
          <a class="ghost-button" routerLink="/pos/payment-modes">Payment modes</a>
          <button class="primary-button" type="button" (click)="load()">Refresh</button>
        </div>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <ng-container *ngIf="!loading()">
        <div class="metrics-grid">
          <article class="metric-card"><span>Total tips</span><strong>{{ totalTips() | currency: 'INR':'symbol':'1.0-0' }}</strong><small>{{ filteredRows().length }} records</small></article>
          <article class="metric-card"><span>Cash tips</span><strong>{{ totalByMode('cash') | currency: 'INR':'symbol':'1.0-0' }}</strong><small>Cash drawer impact</small></article>
          <article class="metric-card"><span>Digital tips</span><strong>{{ digitalTips() | currency: 'INR':'symbol':'1.0-0' }}</strong><small>UPI, card and custom modes</small></article>
          <article class="metric-card"><span>Top staff</span><strong>{{ topStaffName() }}</strong><small>{{ topStaffAmount() | currency: 'INR':'symbol':'1.0-0' }}</small></article>
        </div>

        <section class="panel">
          <div class="table-toolbar">
            <label class="search-field">
              <span>Search client, staff or invoice</span>
              <input [(ngModel)]="query" placeholder="Riya, AURA-2026, staff name" />
            </label>
            <label class="field fit-field">
              <span>Payment mode</span>
              <select [(ngModel)]="modeFilter">
                <option value="">All modes</option>
                <option *ngFor="let mode of paymentModes()" [value]="mode.id">{{ mode.label }}</option>
              </select>
            </label>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Invoice</th>
                  <th>Staff</th>
                  <th>Payment mode</th>
                  <th>Branch</th>
                  <th class="right">Tip amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of filteredRows()" (click)="selected.set(row)" class="click-row">
                  <td>{{ row.createdAt | date: 'short' }}</td>
                  <td><strong>{{ row.clientName }}</strong></td>
                  <td><a [routerLink]="['/pos/invoices']" [queryParams]="{ invoice: row.invoiceId }">{{ row.invoiceNumber }}</a></td>
                  <td>{{ row.staffName }}</td>
                  <td><span class="badge">{{ row.paymentModeLabel }}</span></td>
                  <td>{{ row.branchName }}</td>
                  <td class="right"><strong>{{ row.amount | currency: 'INR':'symbol':'1.0-0' }}</strong></td>
                  <td>{{ row.invoiceStatus }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="inline-hint" *ngIf="!filteredRows().length">No tip records yet. Add tip inside POS checkout and save invoice.</p>
        </section>

        <section class="panel" *ngIf="selected() as row">
          <div class="section-title">
            <div>
              <span class="eyebrow">Selected tip</span>
              <h2>{{ row.clientName }} paid {{ row.amount | currency: 'INR':'symbol':'1.0-0' }}</h2>
            </div>
            <a class="ghost-button mini" [routerLink]="['/pos/invoices']" [queryParams]="{ invoice: row.invoiceId }">Open invoice</a>
          </div>
          <div class="info-grid">
            <div><span>Invoice</span><strong>{{ row.invoiceNumber }}</strong></div>
            <div><span>Staff</span><strong>{{ row.staffName }}</strong></div>
            <div><span>Payment mode</span><strong>{{ row.paymentModeLabel }}</strong></div>
            <div><span>Branch</span><strong>{{ row.branchName }}</strong></div>
          </div>
        </section>
      </ng-container>
    </section>
  `
})
export class PosTipsComponent implements OnInit {
  readonly rows = signal<TipLedgerRow[]>([]);
  readonly paymentModes = signal<PosPaymentMode[]>([]);
  readonly selected = signal<TipLedgerRow | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  query = '';
  modeFilter = '';

  constructor(private readonly api: ApiService, private readonly settings: PosSettingsService) {}

  ngOnInit(): void {
    this.paymentModes.set(this.settings.loadPaymentModes());
    this.settings.loadPaymentModesRemote().subscribe((modes) => this.paymentModes.set(modes));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      sales: this.api.list<ApiRecord[]>('sales', { limit: 1000 }),
      invoices: this.api.list<ApiRecord[]>('invoices', { limit: 1000 }),
      clients: this.api.list<ApiRecord[]>('clients', { limit: 1000 }),
      staff: this.api.list<ApiRecord[]>('staff', { limit: 1000 }),
      branches: this.api.list<ApiRecord[]>('branches', { limit: 1000 })
    }).subscribe({
      next: ({ sales, invoices, clients, staff, branches }) => {
        this.rows.set(this.buildRows(sales || [], invoices || [], clients || [], staff || [], branches || []));
        this.selected.set(this.rows()[0] || null);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || error?.message || 'Unable to load tip register');
        this.loading.set(false);
      }
    });
  }

  filteredRows(): TipLedgerRow[] {
    const query = this.query.trim().toLowerCase();
    return this.rows().filter((row) => {
      const modeMatch = !this.modeFilter || row.paymentMode === this.modeFilter;
      const queryMatch = !query || `${row.clientName} ${row.staffName} ${row.invoiceNumber} ${row.branchName}`.toLowerCase().includes(query);
      return modeMatch && queryMatch;
    });
  }

  totalTips(): number {
    return this.money(this.filteredRows().reduce((sum, row) => sum + row.amount, 0));
  }

  totalByMode(modeId: string): number {
    return this.money(this.filteredRows().filter((row) => row.paymentMode === modeId).reduce((sum, row) => sum + row.amount, 0));
  }

  digitalTips(): number {
    return this.money(this.filteredRows().filter((row) => row.paymentMode !== 'cash').reduce((sum, row) => sum + row.amount, 0));
  }

  topStaffName(): string {
    const top = this.staffTotals()[0];
    return top?.staffName || 'No tips';
  }

  topStaffAmount(): number {
    return this.staffTotals()[0]?.amount || 0;
  }

  private buildRows(sales: ApiRecord[], invoices: ApiRecord[], clients: ApiRecord[], staff: ApiRecord[], branches: ApiRecord[]): TipLedgerRow[] {
    const clientMap = new Map(clients.map((client) => [client.id, client]));
    const staffMap = new Map(staff.map((person) => [person.id, person]));
    const branchMap = new Map(branches.map((branch) => [branch.id, branch]));
    const invoiceBySale = new Map(invoices.map((invoice) => [invoice.saleId, invoice]));
    return sales.flatMap((sale) => {
      const invoice = invoiceBySale.get(sale.id) || {};
      const tips = this.tipLines(sale);
      return tips.map((tip, index) => {
        const client = clientMap.get(invoice.clientId || sale.clientId) || {};
        const person = staffMap.get(tip.staffId) || {};
        const branch = branchMap.get(sale.branchId || invoice.branchId) || {};
        return {
          id: `${sale.id}_${tip.id || index}`,
          invoiceId: invoice.id || '',
          invoiceNumber: invoice.invoiceNumber || invoice.invoice_no || 'No invoice',
          saleId: sale.id,
          clientName: client.name || invoice.clientName || 'Walk-in client',
          staffName: tip.staffName || person.name || tip.staffId || 'Staff',
          paymentMode: tip.paymentMode || 'cash',
          paymentModeLabel: this.modeLabel(tip.paymentMode || 'cash'),
          branchName: branch.name || sale.branchId || 'Branch',
          amount: this.money(tip.amount || 0),
          createdAt: invoice.createdAt || sale.createdAt || '',
          invoiceStatus: invoice.status || invoice.payment_status || 'saved'
        };
      });
    }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  private tipLines(sale: ApiRecord): ApiRecord[] {
    const membershipRedeem = this.readJson(sale.membershipRedeem, {});
    return Array.isArray(membershipRedeem.tips) ? membershipRedeem.tips : [];
  }

  private staffTotals(): { staffName: string; amount: number }[] {
    const totals = new Map<string, number>();
    for (const row of this.filteredRows()) totals.set(row.staffName, (totals.get(row.staffName) || 0) + row.amount);
    return [...totals.entries()].map(([staffName, amount]) => ({ staffName, amount: this.money(amount) })).sort((a, b) => b.amount - a.amount);
  }

  private modeLabel(modeId: string): string {
    return this.paymentModes().find((mode) => mode.id === modeId)?.label || modeId;
  }

  private readJson(value: unknown, fallback: ApiRecord): ApiRecord {
    if (!value) return fallback;
    if (typeof value === 'object') return value as ApiRecord;
    try {
      return JSON.parse(String(value));
    } catch {
      return fallback;
    }
  }

  private money(value: number | string): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }
}
