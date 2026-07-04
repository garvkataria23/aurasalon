import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';

/**
 * @typedef {Object} BalanceSheet
 * @property {string} asOfDate
 * @property {boolean} productionReady
 * @property {string} productionReadinessReason
 * @property {boolean} balanced
 * @property {Object} totals
 * @property {number} totals.assets
 * @property {number} totals.liabilities
 * @property {number} totals.equity
 * @property {number} totals.accountingEquationDifference
 * @property {Object} sections
 * @property {Array} sections.assets
 * @property {Array} sections.liabilities
 * @property {Array} sections.equity
 * @property {Object} workingCapital
 * @property {number} workingCapital.currentAssets
 * @property {number} workingCapital.currentLiabilities
 * @property {number} workingCapital.workingCapital
 * @property {number|null} workingCapital.currentRatio
 * @property {number|null} workingCapital.quickRatio
 * @property {number|null} workingCapital.cashRatio
 * @property {number|null} workingCapital.cashRunwayDays
 * @property {Array} alerts
 */

/**
 * @typedef {Object} TrialBalance
 * @property {boolean} balanced
 * @property {number} debitTotal
 * @property {number} creditTotal
 * @property {number} difference
 * @property {Array} rows
 */

/**
 * @typedef {Object} HardeningStatus
 * @property {boolean} productionReady
 * @property {string} productionReadinessReason
 * @property {Array} stages
 * @property {Object|null} latestReconciliation
 */

@Component({
  selector: 'app-balance-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="bs-shell">
      <header class="hero">
        <div>
          <span class="eyebrow">Finance Intelligence</span>
          <h1>Balance Sheet Command Center</h1>
          <p>Live balance sheet, trial balance, ledger drill-down, working capital and enterprise accounting controls in one owner view.</p>
        </div>
        <div class="status-card" [class.good]="sheet()?.balanced && sheet()?.productionReady" [class.warn]="!sheet()?.productionReady">
          <span>Accounting equation</span>
          <strong>{{ sheet()?.balanced ? 'Balanced' : 'Review' }}</strong>
          <small>{{ sheet()?.productionReady ? 'Production ready' : 'Hardening pending' }}</small>
        </div>
      </header>

      <section class="toolbar">
        <label><span>As of</span><input type="date" [ngModel]="asOfDate()" (ngModelChange)="asOfDate.set($event)" /></label>
        <button class="primary-button" type="button" (click)="load()">Refresh</button>
        <button class="secondary-button" type="button" [disabled]="loading()" (click)="createSnapshot()">Save snapshot</button>
      </section>

      <p class="error-text" *ngIf="error()">{{ error() }}</p>
      <p class="success-text" *ngIf="message()">{{ message() }}</p>

      <section class="kpis" *ngIf="sheet() as s">
        <article><span>Total assets</span><strong>{{ s.totals.assets | currency:'INR':'symbol':'1.0-0' }}</strong></article>
        <article><span>Liabilities</span><strong>{{ s.totals.liabilities | currency:'INR':'symbol':'1.0-0' }}</strong></article>
        <article><span>Equity</span><strong>{{ s.totals.equity | currency:'INR':'symbol':'1.0-0' }}</strong></article>
        <article [class.danger]="s.totals.accountingEquationDifference"><span>Difference</span><strong>{{ s.totals.accountingEquationDifference | currency:'INR':'symbol':'1.0-0' }}</strong></article>
      </section>

      <section class="tabs">
        <button *ngFor="let tab of tabs" type="button" [class.active]="activeTab() === tab.key" (click)="activeTab.set(tab.key)">{{ tab.label }}</button>
      </section>

      <ng-container [ngSwitch]="activeTab()">
        <ng-container *ngSwitchCase="'live'">
          <section class="grid three" *ngIf="sheet() as s">
            <article class="panel">
              <h2>Assets</h2>
              <div class="line" *ngFor="let row of s.sections.assets"><span>{{ row.code }} · {{ row.name }}</span><strong>{{ row.balance | currency:'INR':'symbol':'1.0-0' }}</strong></div>
            </article>
            <article class="panel">
              <h2>Liabilities</h2>
              <div class="line" *ngFor="let row of s.sections.liabilities"><span>{{ row.code }} · {{ row.name }}</span><strong>{{ row.balance | currency:'INR':'symbol':'1.0-0' }}</strong></div>
            </article>
            <article class="panel">
              <h2>Equity</h2>
              <div class="line" *ngFor="let row of s.sections.equity"><span>{{ row.code }} · {{ row.name }}</span><strong>{{ row.balance | currency:'INR':'symbol':'1.0-0' }}</strong></div>
            </article>
          </section>
        </ng-container>

        <section class="panel" *ngSwitchCase="'trial'">
          <h2>Trial Balance</h2>
          <div class="summary-row" *ngIf="trial() as t">
            <span>Debit {{ t.debitTotal | currency:'INR':'symbol':'1.0-0' }}</span>
            <span>Credit {{ t.creditTotal | currency:'INR':'symbol':'1.0-0' }}</span>
            <strong [class.danger-text]="!t.balanced">{{ t.balanced ? 'Balanced' : 'Diff' }} <ng-container *ngIf="!t.balanced">{{ t.difference | currency:'INR':'symbol':'1.0-0' }}</ng-container></strong>
          </div>
          <div class="table-wrap"><table><thead><tr><th>Account</th><th>Type</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>
            <tr *ngFor="let row of trial()?.rows || []"><td>{{ row.code }} · {{ row.name }}</td><td>{{ row.accountType }}</td><td>{{ row.debit | currency:'INR':'symbol':'1.0-0' }}</td><td>{{ row.credit | currency:'INR':'symbol':'1.0-0' }}</td><td>{{ row.balance | currency:'INR':'symbol':'1.0-0' }}</td></tr>
          </tbody></table></div>
        </section>

        <ng-container *ngSwitchCase="'working'">
          <section class="grid two" *ngIf="sheet()?.workingCapital as wc">
            <article class="panel"><h2>Working Capital</h2><div class="metric-list">
              <div><span>Current assets</span><strong>{{ wc.currentAssets | currency:'INR':'symbol':'1.0-0' }}</strong></div>
              <div><span>Current liabilities</span><strong>{{ wc.currentLiabilities | currency:'INR':'symbol':'1.0-0' }}</strong></div>
              <div><span>Working capital</span><strong>{{ wc.workingCapital | currency:'INR':'symbol':'1.0-0' }}</strong></div>
            </div></article>
            <article class="panel"><h2>Ratios</h2><div class="metric-list">
              <div><span>Current ratio</span><strong>{{ wc.currentRatio ?? 'n/a' }}</strong></div>
              <div><span>Quick ratio</span><strong>{{ wc.quickRatio ?? 'n/a' }}</strong></div>
              <div><span>Cash ratio</span><strong>{{ wc.cashRatio ?? 'n/a' }}</strong></div>
              <div><span>Cash runway</span><strong>{{ wc.cashRunwayDays ?? 'n/a' }} days</strong></div>
            </div></article>
          </section>
        </ng-container>

        <section class="panel" *ngSwitchCase="'ledger'">
          <h2>Ledger Drill-down</h2>
          <div class="toolbar compact">
            <select [ngModel]="selectedAccountId()" (ngModelChange)="selectedAccountId.set($event)">
              <option value="">Select account</option>
              <option *ngFor="let row of trial()?.rows || []" [value]="row.accountId">{{ row.code }} · {{ row.name }}</option>
            </select>
            <button class="secondary-button" type="button" [disabled]="!selectedAccountId()" (click)="loadLedger()">Load ledger</button>
          </div>
          <div class="table-wrap"><table><thead><tr><th>Date</th><th>Source</th><th>Memo</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>
            <tr *ngFor="let row of ledgerRows()"><td>{{ row.businessDate }}</td><td>{{ row.sourceType }}</td><td>{{ row.memo }}</td><td>{{ row.debit | currency:'INR':'symbol':'1.0-0' }}</td><td>{{ row.credit | currency:'INR':'symbol':'1.0-0' }}</td><td>{{ row.balance | currency:'INR':'symbol':'1.0-0' }}</td></tr>
          </tbody></table></div>
        </section>

        <ng-container *ngSwitchCase="'hardening'">
          <section class="grid two">
            <article class="panel">
              <h2>Production Readiness</h2>
              <div class="readiness-banner" [class.good]="hardening()?.productionReady" [class.warn]="!hardening()?.productionReady">
                <strong>{{ hardening()?.productionReady ? 'Certified — production ready' : 'Not yet certified' }}</strong>
                <span>{{ hardening()?.productionReadinessReason }}</span>
              </div>
              <div class="check" *ngFor="let item of hardeningChecks()">
                <strong [class.danger-text]="!item.healthy">{{ item.done ? (item.healthy ? 'Active' : 'Attention') : 'Pending' }}</strong>
                <span>Stage {{ item.stage }} · {{ item.label }}<small class="muted"> — {{ item.note }}</small></span>
              </div>
            </article>

            <article class="panel">
              <h2>Controls</h2>
              <div class="control-row">
                <button class="primary-button" type="button" [disabled]="busy()" (click)="runReconcile()">Run reconciliation</button>
                <button class="secondary-button" type="button" [disabled]="busy()" (click)="processOutbox()">Process GL outbox</button>
              </div>
              <div class="control-row">
                <label class="inline"><span>Close period</span><input type="month" [ngModel]="closePeriod()" (ngModelChange)="closePeriod.set($event)" /></label>
                <button class="secondary-button" type="button" [disabled]="busy() || !closePeriod()" (click)="closePeriodAction()">Lock period</button>
              </div>

              <div class="recon-result" *ngIf="hardening()?.latestReconciliation as r">
                <div class="summary-row"><span>Last reconciliation · {{ r.asOfDate }}</span><strong [class.danger-text]="r.status !== 'ok'">{{ r.status | uppercase }}</strong></div>
                <div class="check" *ngFor="let c of r.checks"><strong [class.danger-text]="!c.ok">{{ c.ok ? 'OK' : 'FAIL' }}</strong><span>{{ c.label }}<small class="muted" *ngIf="c.detail"> — {{ c.detail }}</small></span></div>
              </div>

              <h3 class="sub">Alerts</h3>
              <div class="alert" *ngFor="let alert of sheet()?.alerts || []"><strong>{{ alert.title }}</strong><span>{{ alert.message }}</span></div>
              <p class="muted" *ngIf="!(sheet()?.alerts || []).length">No accounting alerts.</p>
            </article>
          </section>
        </ng-container>
      </ng-container>
    </section>
  `,
  styles: [`
    .bs-shell { padding: 20px; display: grid; gap: 16px; color: #172033; }
    .hero { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 16px; padding: 22px; border: 1px solid #dbe6f3; border-radius: 8px; background: linear-gradient(120deg, #f8fbff, #fff); }
    .eyebrow { text-transform: uppercase; font-weight: 800; font-size: 12px; color: #52627a; letter-spacing: 0; }
    h1, h2 { margin: 4px 0 8px; }
    h3.sub { margin: 14px 0 6px; font-size: 14px; color: #52627a; }
    .status-card, .kpis article, .panel { border: 1px solid #dbe6f3; border-radius: 8px; background: #fff; padding: 16px; box-shadow: 0 14px 30px rgba(15,23,42,.06); }
    .status-card strong, .kpis strong { display: block; font-size: 28px; margin-top: 6px; }
    .status-card.good { border-left: 5px solid #C87D4B; }
    .status-card.warn { border-right: 5px solid #f59e0b; }
    .toolbar { display: flex; gap: 10px; align-items: end; flex-wrap: wrap; }
    label { display: grid; gap: 5px; font-weight: 800; color: #52627a; }
    label.inline { display: flex; align-items: center; gap: 8px; }
    input, select { min-height: 42px; border: 1px solid #cbd7e6; border-radius: 8px; padding: 0 12px; }
    button { min-height: 42px; border-radius: 8px; border: 1px solid #cbd7e6; padding: 0 16px; font-weight: 900; cursor: pointer; }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .primary-button { background: #152033; color: #fff; }
    .secondary-button { background: #F8EEF4; color: #4B1238; border-color: #E7DDD6; }
    .kpis, .grid.three { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; }
    .tabs button.active { background: #F8EEF4; border-color: #6B1E4B; color: #4B1238; }
    .line, .metric-list div, .summary-row, .check, .alert { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid #eef2f7; padding: 10px 0; }
    .control-row { display: flex; gap: 10px; align-items: end; flex-wrap: wrap; margin-bottom: 12px; }
    .readiness-banner { display: grid; gap: 4px; padding: 12px; border-radius: 8px; margin-bottom: 8px; background: #f1f5f9; }
    .readiness-banner.good { background: #FBF0E8; border-left: 4px solid #C87D4B; }
    .readiness-banner.warn { background: #fffbeb; border-left: 4px solid #f59e0b; }
    .readiness-banner strong { font-size: 15px; }
    .recon-result { margin-top: 12px; border-top: 1px dashed #cbd7e6; padding-top: 8px; }
    .check strong, .summary-row strong { min-width: 64px; text-align: right; }
    .table-wrap { overflow: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 720px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #eef2f7; }
    th { color: #52627a; }
    .danger, .danger-text, .error-text { color: #b91c1c; }
    .success-text { color: #7A4A28; font-weight: 800; }
    .muted { color: #64748b; font-weight: 600; }
    @media (max-width: 900px) { .hero, .kpis, .grid.three, .grid.two { grid-template-columns: 1fr; } }
  `]
})
export class BalanceSheetComponent {
  tabs = [
    { key: 'live', label: 'Live Balance Sheet' },
    { key: 'trial', label: 'Trial Balance' },
    { key: 'working', label: 'Working Capital' },
    { key: 'ledger', label: 'Ledger' },
    { key: 'hardening', label: 'Hardening' }
  ];
  activeTab = signal('live');
  asOfDate = signal(new Date().toISOString().slice(0, 10));
  closePeriod = signal(new Date().toISOString().slice(0, 7));
  selectedAccountId = signal('');
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  message = signal('');
  sheet = signal(null);
  trial = signal(null);
  hardening = signal(null);
  ledgerRows = signal([]);

  // Now driven by the live stage 16-21 status endpoint (fallback to static list).
  hardeningChecks = computed(() => this.hardening()?.stages ?? [
    { stage: 16, label: 'GL outbox exactly-once sync', done: false, healthy: false, note: 'Loading…' },
    { stage: 17, label: 'IST date boundary protection', done: false, healthy: false, note: 'Loading…' },
    { stage: 18, label: 'Idempotent scheduler protection', done: false, healthy: false, note: 'Loading…' },
    { stage: 19, label: 'WMA inventory valuation', done: false, healthy: false, note: 'Loading…' },
    { stage: 20, label: 'Period lock + immutable journals', done: false, healthy: false, note: 'Loading…' },
    { stage: 21, label: 'Reconciliation watchdog', done: false, healthy: false, note: 'Loading…' }
  ]);

  constructor(api) {
    this.api = api;
  }

  ngOnInit() {
    this.load();
  }

  async load() {
    try {
      this.loading.set(true);
      this.error.set('');
      const params = { asOfDate: this.asOfDate() };
      const [sheet, trial, hardening] = await Promise.all([
        firstValueFrom(this.api.list('balance-sheet/live', params)),
        firstValueFrom(this.api.list('balance-sheet/trial-balance', params)),
        firstValueFrom(this.api.list('balance-sheet/hardening', {}))
      ]);
      this.sheet.set(sheet);
      this.trial.set(trial);
      this.hardening.set(hardening);
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Unable to load balance sheet.'));
    } finally {
      this.loading.set(false);
    }
  }

  async loadLedger() {
    try {
      this.loading.set(true);
      const result = await firstValueFrom(this.api.list('balance-sheet/ledger', {
        accountId: this.selectedAccountId(),
        toDate: this.asOfDate()
      }));
      this.ledgerRows.set(result?.rows || []);
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Unable to load ledger.'));
    } finally {
      this.loading.set(false);
    }
  }

  async createSnapshot() {
    try {
      this.loading.set(true);
      const snapshot = await firstValueFrom(this.api.post('balance-sheet/snapshots', { asOfDate: this.asOfDate() }));
      this.message.set(`Snapshot saved for ${snapshot.asOfDate}.`);
      this.sheet.set(snapshot);
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Unable to save snapshot.'));
    } finally {
      this.loading.set(false);
    }
  }

  async runReconcile() {
    try {
      this.busy.set(true);
      this.error.set('');
      const result = await firstValueFrom(this.api.post('balance-sheet/reconcile', { asOfDate: this.asOfDate() }));
      this.message.set(`Reconciliation complete: ${String(result.status).toUpperCase()}.`);
      await this.load();
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Reconciliation failed.'));
    } finally {
      this.busy.set(false);
    }
  }

  async processOutbox() {
    try {
      this.busy.set(true);
      const result = await firstValueFrom(this.api.post('balance-sheet/outbox/process', {}));
      this.message.set(`Outbox processed: ${result.posted} posted, ${result.failed} failed.`);
      await this.load();
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Outbox processing failed.'));
    } finally {
      this.busy.set(false);
    }
  }

  async closePeriodAction() {
    try {
      this.busy.set(true);
      const result = await firstValueFrom(this.api.post('balance-sheet/periods/close', { period: this.closePeriod() }));
      this.message.set(`Period ${result.period} locked (reconciliation ${result.reconciliation?.status}).`);
      await this.load();
    } catch (error) {
      this.error.set(this.api.errorText(error, 'Unable to close period.'));
    } finally {
      this.busy.set(false);
    }
  }
}
