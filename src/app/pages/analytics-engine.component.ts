import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';
import { AuraKpiCardComponent } from '../shared/ui/aura-kpi-card/aura-kpi-card.component';

@Component({
  selector: 'app-analytics-engine',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe, DatePipe, DecimalPipe, StateComponent, AuraKpiCardComponent],
  styles: [`
    :host { display: block; padding: 4px 8px 28px; }
    .page-stack { gap: 16px; }
    .metrics-grid { gap: 12px; }
    .inline-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
    .inline-form label { display: grid; gap: 3px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #536173; min-width: 130px; flex: 1; }
    .inline-form input, .inline-form select { border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; font: inherit; min-height: 36px; font-size: 13px; }
    .inline-form .form-actions { display: flex; gap: 6px; }
    .accordion { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); overflow: hidden; }
    .accordion-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; cursor: pointer; border: 0; background: none; width: 100%; font: inherit; text-align: left; color: var(--ink); }
    .accordion-header:hover { background: rgba(79,70,229,0.04); }
    .accordion-header .arrow { font-size: 14px; color: #8a9aa8; transition: transform 180ms; }
    .accordion-header.open .arrow { transform: rotate(180deg); }
    .accordion-body { padding: 0 16px 16px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .two-col > section { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fbfdfc; }
    .section-label { font-size: 13px; font-weight: 800; margin: 0 0 8px; }
    .snapshot-scroll { max-height: 200px; overflow: auto; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 16px; color: #607083; font-size: 12px; }
    .meta-row span { display: inline-flex; align-items: center; gap: 4px; }
    @media (max-width: 768px) { :host { padding: 2px 4px 20px; } .page-stack { gap: 12px; } .inline-form { flex-direction: column; } .inline-form label { min-width: 100%; } .two-col { grid-template-columns: 1fr; } }
  `],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Analytics engine</span>
          <h2>Forecast, retention, productivity &amp; heatmaps</h2>
          <p>Live metrics from appointments, sales, clients, memberships and staff data.</p>
        </div>
        <div class="form-actions">
          <button class="ghost-button" type="button" (click)="createSchedule()">Schedule digest</button>
          <button class="ghost-button" type="button" (click)="run()">Run now</button>
        </div>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="inline-form">
        <label><span>From</span><input type="date" formControlName="periodStart" /></label>
        <label><span>To</span><input type="date" formControlName="periodEnd" /></label>
        <label><span>Branch</span>
          <select formControlName="branchId">
            <option value="">All branches</option>
            <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option>
          </select>
        </label>
        <div class="form-actions">
          <button class="primary-button" type="button" (click)="run()" [disabled]="loading()">Refresh</button>
        </div>
      </div>

      <ng-container *ngIf="metrics() as metrics">
        <div class="metrics-grid">
          <aura-kpi-card tone="teal" target="/kpi-details/analytics/14-day-forecast">
            <span>14-day forecast</span>
            <strong>{{ metrics.revenueForecast.projected14DayRevenue | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>{{ metrics.revenueForecast.trendPercent | number: '1.0-1' }}% trend</small>
          </aura-kpi-card>
          <aura-kpi-card tone="amber" target="/kpi-details/analytics/peak-hour">
            <span>Peak hour</span>
            <strong>{{ metrics.peakHours.topHours?.[0]?.label || '—' }}</strong>
            <small>{{ metrics.peakHours.topHours?.[0]?.bookings || 0 }} bookings</small>
          </aura-kpi-card>
          <aura-kpi-card tone="green" target="/kpi-details/analytics/repeat-rate">
            <span>Repeat rate</span>
            <strong>{{ metrics.repeatCustomers.repeatRate | number: '1.0-1' }}%</strong>
            <small>{{ metrics.repeatCustomers.repeatClients }} repeat</small>
          </aura-kpi-card>
          <aura-kpi-card tone="red" target="/kpi-details/analytics/high-churn-risk">
            <span>Churn risk</span>
            <strong>{{ metrics.churn.highRisk }}</strong>
            <small>Score {{ metrics.churn.averageRiskScore | number: '1.0-1' }}</small>
          </aura-kpi-card>
          <aura-kpi-card tone="blue" target="/kpi-details/analytics/average-ltv">
            <span>Avg LTV</span>
            <strong>{{ metrics.lifetimeValue.avgLtv | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>{{ metrics.lifetimeValue.totalLtv | currency: 'INR':'symbol':'1.0-0' }} total</small>
          </aura-kpi-card>
          <aura-kpi-card tone="violet" target="/kpi-details/analytics/membership-revenue">
            <span>Membership rev</span>
            <strong>{{ metrics.membershipPerformance.revenue | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>{{ metrics.membershipPerformance.activeCount }} active</small>
          </aura-kpi-card>
          <aura-kpi-card tone="slate" target="/kpi-details/analytics/funnel-paid">
            <span>Funnel paid</span>
            <strong>{{ funnelStage('Paid')?.conversionFromLead || 0 }}%</strong>
            <small>Lead → invoice</small>
          </aura-kpi-card>
          <aura-kpi-card tone="rose" target="/kpi-details/analytics/branches">
            <span>Branches</span>
            <strong>{{ metrics.branchComparison.length }}</strong>
            <small>{{ metrics.branchComparison[0]?.name || '—' }}</small>
          </aura-kpi-card>
        </div>

        <section class="accordion">
          <button class="accordion-header" [class.open]="openSection() === 'forecast'" type="button" (click)="toggleSection('forecast')">
            <span><strong>Revenue forecast &amp; funnel</strong><span class="meta-row" style="margin-top:4px"><span>14-day projection</span><span>Conversion stages</span></span></span>
            <span class="arrow">▾</span>
          </button>
          <div class="accordion-body" *ngIf="openSection() === 'forecast'">
            <div class="two-col">
              <section>
                <h3 class="section-label">Revenue forecast</h3>
                <div class="chart-bars">
                  <div *ngFor="let point of metrics.revenueForecast.forecast14Days">
                    <span>{{ point.date | date: 'MMM d' }}</span>
                    <i [style.height.%]="forecastHeight(point.projectedRevenue)"></i>
                    <strong>{{ point.projectedRevenue | currency: 'INR':'symbol':'1.0-0' }}</strong>
                  </div>
                </div>
              </section>
              <section>
                <h3 class="section-label">Conversion funnel</h3>
                <div class="summary-lines">
                  <div *ngFor="let stage of metrics.conversionFunnel.stages">
                    <span>{{ stage.stage }}</span>
                    <strong>{{ stage.count }} · {{ stage.conversionFromLead | number: '1.0-1' }}%</strong>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section class="accordion">
          <button class="accordion-header" [class.open]="openSection() === 'staff'" type="button" (click)="toggleSection('staff')">
            <span><strong>Staff &amp; churn</strong><span class="meta-row" style="margin-top:4px"><span>Productivity scores</span><span>Risk analysis</span></span></span>
            <span class="arrow">▾</span>
          </button>
          <div class="accordion-body" *ngIf="openSection() === 'staff'">
            <div class="two-col">
              <section>
                <h3 class="section-label">Staff productivity</h3>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Staff</th><th>Score</th><th>Revenue</th><th>Bookings</th><th>Completion</th></tr></thead>
                    <tbody>
                      <tr *ngFor="let person of metrics.staffProductivity">
                        <td><strong>{{ person.name }}</strong><small>{{ person.role }}</small></td>
                        <td>{{ person.productivityScore | number: '1.0-1' }}</td>
                        <td>{{ person.revenue | currency: 'INR':'symbol':'1.0-0' }}</td>
                        <td>{{ person.bookings }}</td>
                        <td>{{ person.completionRate | number: '1.0-1' }}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
              <section>
                <h3 class="section-label">Churn analysis</h3>
                <div class="rank-list">
                  <article *ngFor="let client of metrics.churn.clients">
                    <div>
                      <strong>{{ client.name }}</strong>
                      <span>{{ client.risk }} risk · {{ client.inactiveDays }}d inactive</span>
                    </div>
                    <div class="right">
                      <strong>{{ client.score }}</strong>
                      <small>{{ client.recommendedAction }}</small>
                    </div>
                  </article>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section class="accordion">
          <button class="accordion-header" [class.open]="openSection() === 'ltv'" type="button" (click)="toggleSection('ltv')">
            <span><strong>LTV &amp; membership</strong><span class="meta-row" style="margin-top:4px"><span>Client lifetime value</span><span>Credit redemption</span></span></span>
            <span class="arrow">▾</span>
          </button>
          <div class="accordion-body" *ngIf="openSection() === 'ltv'">
            <div class="two-col">
              <section>
                <h3 class="section-label">Lifetime value</h3>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Client</th><th>LTV</th><th>Avg ticket</th><th>Projected annual</th><th>Loyalty</th></tr></thead>
                    <tbody>
                      <tr *ngFor="let client of metrics.lifetimeValue.topClients">
                        <td>{{ client.name }}</td>
                        <td>{{ client.lifetimeValue | currency: 'INR':'symbol':'1.0-0' }}</td>
                        <td>{{ client.avgTicket | currency: 'INR':'symbol':'1.0-0' }}</td>
                        <td>{{ client.projectedAnnualValue | currency: 'INR':'symbol':'1.0-0' }}</td>
                        <td>{{ client.loyaltyPoints }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
              <section>
                <h3 class="section-label">Membership</h3>
                <div class="summary-lines">
                  <div><span>Credits sold</span><strong>{{ metrics.membershipPerformance.creditsSold }}</strong></div>
                  <div><span>Credits redeemed</span><strong>{{ metrics.membershipPerformance.creditsRedeemed }}</strong></div>
                  <div><span>Redemption rate</span><strong>{{ metrics.membershipPerformance.redemptionRate | number: '1.0-1' }}%</strong></div>
                  <div><span>Auto renewals</span><strong>{{ metrics.membershipPerformance.autoRenewCount }}</strong></div>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section class="accordion">
          <button class="accordion-header" [class.open]="openSection() === 'heatmap'" type="button" (click)="toggleSection('heatmap')">
            <span><strong>Heatmap &amp; branches</strong><span class="meta-row" style="margin-top:4px"><span>Booking intensity</span><span>Branch comparison</span></span></span>
            <span class="arrow">▾</span>
          </button>
          <div class="accordion-body" *ngIf="openSection() === 'heatmap'">
            <div class="heatmap-grid" style="margin-bottom:12px">
              <article *ngFor="let cell of metrics.heatmaps.strongestCells" [style.background]="heatColor(cell.intensity)">
                <strong>{{ cell.dayLabel }} {{ cell.hour }}:00</strong>
                <span>{{ cell.bookings }} bks · {{ cell.revenue | currency: 'INR':'symbol':'1.0-0' }}</span>
              </article>
            </div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Branch</th><th>Revenue</th><th>Sales</th><th>Bookings</th><th>Completion</th><th>Repeat</th><th>Stock</th></tr></thead>
                <tbody>
                  <tr *ngFor="let branch of metrics.branchComparison">
                    <td><strong>{{ branch.name }}</strong><small>{{ branch.city }}</small></td>
                    <td>{{ branch.revenue | currency: 'INR':'symbol':'1.0-0' }}</td>
                    <td>{{ branch.sales }}</td>
                    <td>{{ branch.appointments }}</td>
                    <td>{{ branch.completionRate | number: '1.0-1' }}%</td>
                    <td>{{ branch.repeatRate | number: '1.0-1' }}%</td>
                    <td>{{ branch.lowStock }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="panel compact-panel" *ngIf="insights().length">
          <div>
            <span class="eyebrow">Executive insights</span>
            <div class="quick-grid" style="margin-top:8px">
              <article class="action-card" *ngFor="let insight of insights()">
                <strong>{{ insight }}</strong>
                <span>Persisted insight</span>
              </article>
            </div>
          </div>
        </section>
      </ng-container>

      <section class="panel compact-panel">
        <div class="section-title" style="margin-bottom:8px">
          <span class="eyebrow">Run history</span>
        </div>
        <div class="table-wrap snapshot-scroll">
          <table>
            <thead><tr><th>Snapshot</th><th>Period</th><th>Branch</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              <tr *ngFor="let item of snapshots()">
                <td>{{ item.id }}</td>
                <td>{{ item.periodStart }} to {{ item.periodEnd }}</td>
                <td>{{ item.branchId || 'All' }}</td>
                <td><span class="badge">{{ item.status }}</span></td>
                <td>{{ item.createdAt | date: 'short' }}</td>
              </tr>
              <tr *ngIf="!snapshots().length"><td colspan="5">No snapshots yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `
})
export class AnalyticsEngineComponent implements OnInit {
  readonly snapshot = signal<ApiRecord | null>(null);
  readonly metrics = signal<ApiRecord | null>(null);
  readonly insights = signal<string[]>([]);
  readonly snapshots = signal<ApiRecord[]>([]);
  readonly commandCenter = signal<ApiRecord | null>(null);
  readonly branches = signal<ApiRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly openSection = signal('');

  readonly filterForm = this.fb.group({
    periodStart: [this.defaultStart()],
    periodEnd: [new Date().toISOString().slice(0, 10)],
    branchId: ['']
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.filterForm.patchValue({ branchId: this.api.selectedBranchId() });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    Promise.all([
      this.api.list<ApiRecord[]>('branches').toPromise(),
      this.api.list<ApiRecord[]>('analytics/snapshots').toPromise()
    ])
      .then(([branches, snapshots]) => {
        this.branches.set(branches || []);
        this.snapshots.set(snapshots || []);
        this.loadCommandCenter();
        this.run();
      })
      .catch((error) => {
        this.error.set(error?.error?.error || 'Unable to load analytics engine');
        this.loading.set(false);
      });
  }

  run(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.post<ApiRecord>('analytics/run', this.filterForm.value).subscribe({
      next: (result) => {
        this.snapshot.set(result.snapshot);
        this.metrics.set(result.metrics);
        this.insights.set(result.insights || []);
        this.loadSnapshots();
        this.loadCommandCenter();
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to generate analytics');
        this.loading.set(false);
      }
    });
  }

  loadSnapshots(): void {
    this.api.list<ApiRecord[]>('analytics/snapshots').subscribe({
      next: (snapshots) => this.snapshots.set(snapshots),
      error: () => this.snapshots.set([])
    });
  }

  loadCommandCenter(): void {
    this.api.list<ApiRecord>('analytics/report-command-center', this.filterForm.value).subscribe({
      next: (result) => this.commandCenter.set(result),
      error: () => this.commandCenter.set(null)
    });
  }

  createSchedule(): void {
    this.api.post<ApiRecord>('analytics/report-schedules', {
      ...this.filterForm.value,
      name: 'Analytics owner digest',
      cadence: 'weekly',
      reportKeys: ['analytics:14-day-forecast', 'analytics:high-churn-risk', 'analytics:anomalies']
    }).subscribe({
      next: () => this.loadCommandCenter(),
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  runAnomalyScan(): void {
    this.api.post<ApiRecord>('analytics/anomalies/run', this.filterForm.value).subscribe({
      next: () => this.loadCommandCenter(),
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  toggleSection(section: string): void {
    this.openSection.set(this.openSection() === section ? '' : section);
  }

  funnelStage(stage: string): ApiRecord | null {
    return this.metrics()?.conversionFunnel?.stages?.find((item: ApiRecord) => item.stage === stage) || null;
  }

  forecastHeight(value: number): number {
    const points = this.metrics()?.revenueForecast?.forecast14Days || [];
    const max = Math.max(1, ...points.map((item: ApiRecord) => Number(item.projectedRevenue || 0)));
    return Math.max(8, Math.round((Number(value || 0) / max) * 100));
  }

  heatColor(intensity: number): string {
    const alpha = Math.min(0.9, Math.max(0.08, Number(intensity || 0) / 100));
    return `rgba(15, 118, 110, ${alpha})`;
  }

  private defaultStart(): string {
    const date = new Date();
    date.setDate(date.getDate() - 89);
    return date.toISOString().slice(0, 10);
  }
}
