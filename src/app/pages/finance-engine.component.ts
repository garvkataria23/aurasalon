import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-finance-engine',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe, DatePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Level 20 · Finance engine</span>
          <h2>Daily closing, cash drawer, expenses, profit/loss, payouts, refunds, partial payments and outstanding balance</h2>
          <p>Finance calculations come from saved payments, invoices, sales, expenses, refunds and staff payout records.</p>
        </div>
        <button class="ghost-button" type="button" (click)="load()">Refresh</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="metrics-grid" *ngIf="summary()?.metrics as metrics">
        <article class="metric-card teal"><span>Revenue</span><strong>{{ metrics.revenue | currency: 'INR':'symbol':'1.0-0' }}</strong><small>Payments today</small></article>
        <article class="metric-card green"><span>Cash</span><strong>{{ metrics.cash | currency: 'INR':'symbol':'1.0-0' }}</strong><small>Drawer impact</small></article>
        <article class="metric-card blue"><span>UPI</span><strong>{{ metrics.upi | currency: 'INR':'symbol':'1.0-0' }}</strong><small>Digital payments</small></article>
        <article class="metric-card amber"><span>Expenses</span><strong>{{ metrics.expenses | currency: 'INR':'symbol':'1.0-0' }}</strong><small>Paid today</small></article>
        <article class="metric-card red"><span>Outstanding</span><strong>{{ metrics.outstanding | currency: 'INR':'symbol':'1.0-0' }}</strong><small>Open invoice balance</small></article>
        <article class="metric-card violet"><span>P/L</span><strong>{{ metrics.profitLoss | currency: 'INR':'symbol':'1.0-0' }}</strong><small>Revenue less costs</small></article>
      </div>

      <div class="three-grid">
        <section class="form-panel">
          <h3>Cash drawer</h3>
          <form [formGroup]="drawerForm">
            <label class="field"><span>Branch</span><select formControlName="branchId"><option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option></select></label>
            <label class="field"><span>Opening float</span><input type="number" formControlName="openingFloat" /></label>
            <label class="field"><span>Counted cash</span><input type="number" formControlName="countedCash" /></label>
            <div class="form-actions">
              <button class="ghost-button" type="button" (click)="openDrawer()" [disabled]="Boolean(summary()?.drawer)">Open drawer</button>
              <button class="primary-button" type="button" (click)="closeDrawer()" [disabled]="!summary()?.drawer">Close drawer</button>
            </div>
          </form>
        </section>

        <section class="form-panel">
          <h3>Expense tracking</h3>
          <form [formGroup]="expenseForm" (ngSubmit)="addExpense()">
            <label class="field"><span>Category</span><input formControlName="category" /></label>
            <label class="field"><span>Amount</span><input type="number" formControlName="amount" /></label>
            <label class="field"><span>Vendor</span><input formControlName="vendor" /></label>
            <label class="field"><span>Mode</span><select formControlName="paymentMode"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select></label>
            <div class="form-actions"><button class="primary-button" type="submit" [disabled]="expenseForm.invalid">Add expense</button></div>
          </form>
        </section>

        <section class="form-panel">
          <h3>Daily closing</h3>
          <form [formGroup]="closingForm" (ngSubmit)="dailyClosing()">
            <label class="field"><span>Business date</span><input type="date" formControlName="businessDate" /></label>
            <label class="field"><span>Notes</span><input formControlName="notes" /></label>
            <div class="form-actions"><button class="primary-button" type="submit">Close day</button></div>
          </form>
        </section>
      </div>

      <div class="dashboard-grid">
        <section class="form-panel">
          <h3>Partial payment and refund</h3>
          <form [formGroup]="invoiceForm">
            <label class="field full"><span>Invoice</span><select formControlName="invoiceId"><option *ngFor="let invoice of invoices()" [value]="invoice.id">{{ invoice.invoiceNumber }} · {{ invoice.status }} · {{ invoice.balance | currency: 'INR':'symbol':'1.0-0' }}</option></select></label>
            <label class="field"><span>Amount</span><input type="number" formControlName="amount" /></label>
            <label class="field"><span>Mode</span><select formControlName="mode"><option value="upi">UPI</option><option value="cash">Cash</option><option value="card">Card</option></select></label>
            <label class="field full"><span>Reason/reference</span><input formControlName="reason" /></label>
            <div class="form-actions">
              <button class="ghost-button" type="button" (click)="partialPayment()" [disabled]="!invoiceForm.value.invoiceId">Add partial payment</button>
              <button class="primary-button" type="button" (click)="refund()" [disabled]="!invoiceForm.value.invoiceId">Refund</button>
            </div>
          </form>
        </section>

        <section class="form-panel">
          <h3>Staff payout</h3>
          <form [formGroup]="payoutForm" (ngSubmit)="staffPayout()">
            <label class="field full"><span>Staff</span><select formControlName="staffId"><option *ngFor="let person of staff()" [value]="person.id">{{ person.name }}</option></select></label>
            <label class="field"><span>Period start</span><input type="date" formControlName="periodStart" /></label>
            <label class="field"><span>Period end</span><input type="date" formControlName="periodEnd" /></label>
            <label class="field"><span>Incentive</span><input type="number" formControlName="incentiveAmount" /></label>
            <label class="field"><span>Deductions</span><input type="number" formControlName="deductions" /></label>
            <div class="form-actions"><button class="primary-button" type="submit" [disabled]="!payoutForm.value.staffId">Calculate payout</button></div>
          </form>
        </section>
      </div>

      <section class="panel">
        <div class="section-title"><h2>Outstanding balances</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Status</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead>
            <tbody>
              <tr *ngFor="let invoice of summary()?.outstanding || []">
                <td>{{ invoice.invoiceNumber }}</td>
                <td><span class="badge">{{ invoice.status }}</span></td>
                <td>{{ invoice.total | currency: 'INR':'symbol':'1.0-0' }}</td>
                <td>{{ invoice.paid | currency: 'INR':'symbol':'1.0-0' }}</td>
                <td>{{ invoice.balance | currency: 'INR':'symbol':'1.0-0' }}</td>
              </tr>
              <tr *ngIf="!(summary()?.outstanding || []).length"><td colspan="5"><div class="empty-state"><strong>No outstanding invoices</strong><span>All visible invoices are settled.</span></div></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="dashboard-grid">
        <section class="panel">
          <div class="section-title"><h2>Expenses and refunds</h2></div>
          <div class="rank-list">
            <article *ngFor="let item of summary()?.expenses || []"><div><strong>{{ item.category }}</strong><span>{{ item.vendor || item.paymentMode }}</span></div><strong>{{ item.amount | currency: 'INR':'symbol':'1.0-0' }}</strong></article>
            <article *ngFor="let item of summary()?.refunds || []"><div><strong>Refund</strong><span>{{ item.reason || item.invoiceId }}</span></div><strong>{{ item.amount | currency: 'INR':'symbol':'1.0-0' }}</strong></article>
          </div>
        </section>
        <section class="panel">
          <div class="section-title"><h2>Closing history</h2></div>
          <div class="rank-list">
            <article *ngFor="let closing of summary()?.closings || []"><div><strong>{{ closing.businessDate }}</strong><span>{{ closing.status }} · variance {{ closing.variance | currency: 'INR':'symbol':'1.0-0' }}</span></div><small>{{ closing.createdAt | date: 'short' }}</small></article>
          </div>
        </section>
      </div>

      <pre class="result-json" *ngIf="result()">{{ result() | json }}</pre>
    </section>
  `
})
export class FinanceEngineComponent implements OnInit {
  readonly summary = signal<ApiRecord | null>(null);
  readonly branches = signal<ApiRecord[]>([]);
  readonly invoices = signal<ApiRecord[]>([]);
  readonly staff = signal<ApiRecord[]>([]);
  readonly result = signal<ApiRecord | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly drawerForm = this.fb.group({ branchId: ['', Validators.required], openingFloat: [5000], countedCash: [5000] });
  readonly expenseForm = this.fb.group({ category: ['Supplies', Validators.required], amount: [500, Validators.required], vendor: ['Local supplier'], paymentMode: ['cash'] });
  readonly closingForm = this.fb.group({ businessDate: [new Date().toISOString().slice(0, 10)], notes: [''] });
  readonly invoiceForm = this.fb.group({ invoiceId: [''], amount: [100], mode: ['upi'], reason: ['Finance console action'] });
  readonly payoutForm = this.fb.group({ staffId: [''], periodStart: [new Date().toISOString().slice(0, 8) + '01'], periodEnd: [new Date().toISOString().slice(0, 10)], incentiveAmount: [0], deductions: [0] });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.loadLists();
    this.load();
  }

  loadLists(): void {
    this.api.list<ApiRecord[]>('branches').subscribe((rows) => {
      this.branches.set(rows);
      if (rows[0]) this.drawerForm.patchValue({ branchId: rows[0].id });
    });
    this.api.list<ApiRecord[]>('invoices').subscribe((rows) => {
      this.invoices.set(rows);
      if (rows[0]) this.invoiceForm.patchValue({ invoiceId: rows[0].id, amount: Math.max(1, Number(rows[0].balance || rows[0].paid || 100)) });
    });
    this.api.list<ApiRecord[]>('staff').subscribe((rows) => {
      this.staff.set(rows);
      if (rows[0]) this.payoutForm.patchValue({ staffId: rows[0].id });
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.list<ApiRecord>('finance/summary').subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load finance engine');
        this.loading.set(false);
      }
    });
  }

  openDrawer(): void {
    this.api.post<ApiRecord>('finance/cash-drawers/open', this.drawerForm.value).subscribe((response) => this.afterAction(response));
  }

  closeDrawer(): void {
    this.api.patch<ApiRecord>('finance/cash-drawers/close', this.drawerForm.value).subscribe((response) => this.afterAction(response));
  }

  addExpense(): void {
    this.api.post<ApiRecord>('finance/expenses', { ...this.expenseForm.value, branchId: this.drawerForm.value.branchId }).subscribe((response) => this.afterAction(response));
  }

  dailyClosing(): void {
    this.api.post<ApiRecord>('finance/daily-closing', { ...this.closingForm.value, branchId: this.drawerForm.value.branchId }).subscribe((response) => this.afterAction(response));
  }

  partialPayment(): void {
    this.api.post<ApiRecord>(`finance/invoices/${this.invoiceForm.value.invoiceId}/partial-payment`, this.invoiceForm.value).subscribe((response) => this.afterAction(response));
  }

  refund(): void {
    this.api.post<ApiRecord>('finance/refunds', { ...this.invoiceForm.value, invoiceId: this.invoiceForm.value.invoiceId }).subscribe((response) => this.afterAction(response));
  }

  staffPayout(): void {
    this.api.post<ApiRecord>('finance/staff-payouts', this.payoutForm.value).subscribe((response) => this.afterAction(response));
  }

  afterAction(response: ApiRecord): void {
    this.result.set(response);
    this.loadLists();
    this.load();
  }

  protected readonly Boolean = Boolean;
}
