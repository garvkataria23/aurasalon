import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, ApiRecord } from '../core/api.service';

type OversightState = {
  summary?: ApiRecord;
  cards?: Record<string, ApiRecord>;
  auditVerify?: ApiRecord;
  reconciliation?: ApiRecord;
  staffRiskRows?: ApiRecord[];
  exceptionRows?: ApiRecord[];
  siem?: ApiRecord;
};

@Component({
  selector: 'app-oversight-command-center',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="oversight-page">
      <div class="hero">
        <div>
          <p class="eyebrow">COMMAND / SCRUTINY</p>
          <h1>Oversight Command Center</h1>
          <p>Financial scrutiny, audit-chain verify, staff consolidated risk, reconciliation and SIEM export in one owner view.</p>
        </div>
        <div class="hero-actions">
          <button type="button" (click)="load()">Refresh</button>
          <button type="button" class="primary" (click)="runAuditVerify()" [disabled]="running()">Run audit verify</button>
        </div>
      </div>

      <div class="filters">
        <label>
          From
          <input type="date" [(ngModel)]="filters.from" />
        </label>
        <label>
          To
          <input type="date" [(ngModel)]="filters.to" />
        </label>
        <label>
          Branch
          <input [(ngModel)]="filters.branchId" placeholder="Branch ID" />
        </label>
        <label>
          Search
          <input [(ngModel)]="filters.q" placeholder="Staff, action, exception" />
        </label>
        <button type="button" class="primary" (click)="load()">Apply filters</button>
      </div>

      <div *ngIf="message()" class="notice">{{ message() }}</div>

      <div class="kpi-grid">
        <article *ngFor="let card of summaryCards()" class="kpi-card" [class.review]="card.status !== 'clean' && card.status !== 'ready'">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.status }}</small>
        </article>
      </div>

      <div class="grid-two">
        <article class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">DAILY AUDIT VERIFY</p>
              <h2>Hash-chain verification</h2>
            </div>
            <span class="pill" [class.danger]="auditStatus() === 'tamper_alert'">{{ auditStatus() }}</span>
          </div>
          <div class="audit-metrics">
            <div><span>Verified invoices</span><strong>{{ latestAudit()?.verifiedInvoices || 0 }}</strong></div>
            <div><span>Warnings</span><strong>{{ latestAudit()?.warningCount || 0 }}</strong></div>
            <div><span>Tamper alerts</span><strong>{{ latestAudit()?.tamperCount || 0 }}</strong></div>
            <div><span>Last run</span><strong>{{ latestAudit()?.createdAt || '-' }}</strong></div>
          </div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">RECONCILIATION + SIEM</p>
              <h2>Monitoring readiness</h2>
            </div>
            <a routerLink="/command-center/observability-center">Observability</a>
          </div>
          <div class="audit-metrics">
            <div><span>Reconciliation</span><strong>{{ data().reconciliation?.status || '-' }}</strong></div>
            <div><span>Mismatches</span><strong>{{ data().reconciliation?.mismatchCount || 0 }}</strong></div>
            <div><span>SIEM status</span><strong>{{ data().summary?.siemStatus || '-' }}</strong></div>
            <div><span>Sources</span><strong>{{ siemSources() }}</strong></div>
          </div>
        </article>
      </div>

      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">STAFF RISK ENGINE</p>
            <h2>Consolidated staff scrutiny</h2>
          </div>
          <span class="pill">{{ data().staffRiskRows?.length || 0 }} rows</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Risk</th>
                <th>Voids</th>
                <th>Refunds</th>
                <th>Discount</th>
                <th>Data access</th>
                <th>Attendance</th>
                <th>Fraud alerts</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of filteredStaffRows()">
                <td><strong>{{ row.staffName }}</strong><small>{{ row.staffId }}</small></td>
                <td><span class="risk" [class.high]="row.riskScore >= 60">{{ row.riskScore }} / {{ row.riskLevel }}</span></td>
                <td>{{ row.voids }}</td>
                <td>{{ row.refunds }}</td>
                <td>{{ row.discountAlerts }}</td>
                <td>{{ row.dataAccess }}</td>
                <td>{{ row.attendanceAlerts }}</td>
                <td>{{ row.openFraudAlerts }}</td>
                <td>{{ row.suggestedAction }}</td>
              </tr>
              <tr *ngIf="!filteredStaffRows().length"><td colspan="9" class="empty">No staff risk signals found.</td></tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">EXCEPTION QUEUE</p>
            <h2>Owner review items</h2>
          </div>
          <span class="pill">{{ data().exceptionRows?.length || 0 }} exceptions</span>
        </div>
        <div class="exception-grid">
          <div *ngFor="let item of data().exceptionRows || []" class="exception-card" [class.critical]="item.severity === 'critical'">
            <span>{{ item.type }}</span>
            <strong>{{ item.title }}</strong>
            <p>{{ item.count }} items · {{ item.severity }}</p>
            <small>{{ item.action }}</small>
          </div>
          <div *ngIf="!(data().exceptionRows || []).length" class="empty-box">No open exceptions.</div>
        </div>
      </article>
    </section>
  `,
  styles: [`
    .oversight-page { display: grid; gap: 18px; padding: 24px; color: #122033; }
    .hero, .panel, .filters, .notice { background: #fff; border: 1px solid #dce9e6; border-radius: 16px; box-shadow: 0 12px 28px rgba(15, 31, 46, 0.06); }
    .hero { display: flex; justify-content: space-between; gap: 18px; align-items: center; padding: 28px; background: linear-gradient(135deg, #f8fffc, #eef8f3); }
    .hero h1, .panel h2 { margin: 0; letter-spacing: 0; }
    .hero p { margin: 8px 0 0; color: #526271; max-width: 760px; }
    .eyebrow { margin: 0 0 8px; font-size: 12px; font-weight: 800; color: #53625c; letter-spacing: 0; text-transform: uppercase; }
    .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    button, a { border: 1px solid #dce9e6; border-radius: 12px; padding: 11px 16px; background: #fff; color: #122033; font-weight: 800; text-decoration: none; cursor: pointer; }
    button.primary { background: #079b73; border-color: #079b73; color: #fff; }
    button:disabled { opacity: .55; cursor: wait; }
    .filters { display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 12px; padding: 18px; align-items: end; }
    label { display: grid; gap: 6px; font-weight: 800; color: #4d5d69; }
    input { width: 100%; min-height: 44px; border: 1px solid #d7e7e3; border-radius: 12px; padding: 0 12px; font: inherit; box-sizing: border-box; }
    .notice { padding: 12px 16px; color: #075f4b; background: #eafaf4; }
    .kpi-grid { display: grid; grid-template-columns: repeat(5, minmax(150px, 1fr)); gap: 14px; }
    .kpi-card { background: #fff; border: 1px solid #dce9e6; border-radius: 14px; padding: 18px; display: grid; gap: 8px; }
    .kpi-card.review { border-top: 4px solid #d9822b; }
    .kpi-card span, .kpi-card small { color: #5a6a73; font-weight: 700; }
    .kpi-card strong { font-size: 28px; }
    .grid-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .panel { padding: 22px; min-width: 0; }
    .panel-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
    .pill, .risk { display: inline-flex; border-radius: 999px; padding: 6px 10px; background: #eaf8f2; color: #087a5c; font-weight: 800; }
    .pill.danger, .risk.high { background: #fff0ed; color: #b83221; }
    .audit-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .audit-metrics div { border: 1px solid #e5efed; border-radius: 12px; padding: 14px; display: grid; gap: 8px; }
    .audit-metrics span { color: #63737b; font-weight: 700; }
    .table-wrap { overflow-x: auto; border: 1px solid #e1ece9; border-radius: 14px; }
    table { width: 100%; border-collapse: collapse; min-width: 980px; }
    th, td { padding: 14px; border-bottom: 1px solid #e1ece9; text-align: left; vertical-align: top; }
    th { background: #f6faf9; color: #4d5d69; font-size: 12px; text-transform: uppercase; }
    td small { display: block; color: #60717c; margin-top: 4px; }
    .exception-grid { display: grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap: 12px; }
    .exception-card, .empty-box { border: 1px solid #e1ece9; border-radius: 14px; padding: 16px; }
    .exception-card.critical { border-top: 4px solid #b83221; }
    .exception-card span { color: #60717c; font-weight: 800; font-size: 12px; text-transform: uppercase; }
    .exception-card strong { display: block; margin-top: 8px; }
    .exception-card p { margin: 8px 0; color: #526271; }
    .empty, .empty-box { color: #60717c; text-align: center; }
    @media (max-width: 1100px) { .filters, .kpi-grid, .exception-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .grid-two { grid-template-columns: 1fr; } .hero { align-items: flex-start; flex-direction: column; } }
    @media (max-width: 680px) { .oversight-page { padding: 14px; } .filters, .kpi-grid, .exception-grid, .audit-metrics { grid-template-columns: 1fr; } }
  `]
})
export class OversightCommandCenterComponent implements OnInit {
  readonly data = signal<OversightState>({});
  readonly loading = signal(false);
  readonly running = signal(false);
  readonly message = signal('');
  readonly filters = {
    from: '',
    to: '',
    branchId: '',
    q: ''
  };

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.list<OversightState>('oversight/summary', this.cleanFilters()).subscribe({
      next: (data) => {
        this.data.set(data || {});
        this.loading.set(false);
      },
      error: (error) => {
        this.message.set(error?.error?.message || 'Oversight data unavailable.');
        this.loading.set(false);
      }
    });
  }

  runAuditVerify(): void {
    this.running.set(true);
    this.api.post<ApiRecord>('oversight/audit-verify/run', this.cleanFilters()).subscribe({
      next: (result) => {
        this.message.set(`Audit verify complete: ${result.status || 'done'} (${result.verifiedInvoices || 0} invoices).`);
        this.running.set(false);
        this.load();
      },
      error: (error) => {
        this.message.set(error?.error?.message || 'Audit verify failed.');
        this.running.set(false);
      }
    });
  }

  summaryCards(): ApiRecord[] {
    const summary = this.data().summary || {};
    return [
      { label: 'Open exceptions', value: summary.openExceptions || 0, status: summary.openExceptions ? 'review' : 'clean' },
      { label: 'High risk staff', value: summary.highRiskStaff || 0, status: summary.highRiskStaff ? 'review' : 'clean' },
      { label: 'Pending approvals', value: summary.pendingApprovals || 0, status: summary.pendingApprovals ? 'review' : 'clean' },
      { label: 'Audit verify', value: summary.auditStatus || 'not_run', status: summary.auditDueToday ? 'due_today' : summary.auditStatus || 'not_run' },
      { label: 'Reconciliation gaps', value: summary.reconciliationMismatches || 0, status: summary.reconciliationMismatches ? 'review' : 'clean' }
    ];
  }

  latestAudit(): ApiRecord | null {
    return (this.data().auditVerify?.lastRun as ApiRecord) || null;
  }

  auditStatus(): string {
    return String(this.latestAudit()?.status || this.data().summary?.auditStatus || 'not_run');
  }

  siemSources(): string {
    const sources = (this.data().siem?.sources as string[]) || [];
    return sources.length ? sources.join(', ') : '-';
  }

  filteredStaffRows(): ApiRecord[] {
    const q = this.filters.q.trim().toLowerCase();
    const rows = this.data().staffRiskRows || [];
    if (!q) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }

  private cleanFilters(): ApiRecord {
    return Object.fromEntries(Object.entries(this.filters).filter(([, value]) => String(value || '').trim()));
  }
}
