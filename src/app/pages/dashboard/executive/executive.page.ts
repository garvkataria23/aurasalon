import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiRecord, ApiService } from '../../../core/api.service';
import { AppStateService } from '../../../core/state/app-state.service';
import { ActivityFeedComponent, ActivityItem } from '../../../shared/components/activity-feed/activity-feed.component';
import { StateComponent } from '../../../shared/ui/state/state.component';
import { ExecutiveDashboard, ExecutiveDashboardService } from './executive.service';

type KpiVm = {
  key: string;
  label: string;
  value: string;
  delta: number;
  trend: string;
  route: string;
};

@Component({
  selector: 'app-executive-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StateComponent, ActivityFeedComponent],
  providers: [ExecutiveDashboardService],
  templateUrl: './executive.page.html',
  styleUrl: './executive.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExecutiveDashboardPage implements OnInit {
  private readonly service = inject(ExecutiveDashboardService);
  private readonly api = inject(ApiService);
  private readonly appState = inject(AppStateService);

  readonly data = signal<ExecutiveDashboard | null>(null);
  readonly branches = signal<ApiRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly range = signal('today');
  readonly branchId = signal(this.appState.selectedBranchId());
  readonly liveMode = signal(false);

  private timer: ReturnType<typeof setInterval> | null = null;

  readonly kpis = computed<KpiVm[]>(() => {
    const data = this.data();
    if (!data) return [];
    return [
      this.kpi('revenue', 'Revenue', this.currency(data.kpis['revenue']?.['value'])),
      this.kpi('appointments', 'Appointments', String(data.kpis['appointments']?.['value'] || 0)),
      this.kpi('newCustomers', 'New customers', String(data.kpis['newCustomers']?.['value'] || 0)),
      this.kpi('avgTicket', 'Avg ticket', this.currency(data.kpis['avgTicket']?.['value'])),
      this.kpi('chairUtilization', 'Chair util', `${data.kpis['chairUtilization']?.['value'] || 0}%`),
      this.kpi('cancellationRate', 'Cancel rate', `${data.kpis['cancellationRate']?.['value'] || 0}%`),
      this.kpi('noshowRate', 'No-show', `${data.kpis['noshowRate']?.['value'] || 0}%`),
      this.kpi('retention', 'Retention', `${data.kpis['retention']?.['value'] || 0}%`)
    ];
  });

  readonly activityItems = computed<ActivityItem[]>(() =>
    (this.data()?.activity || []).map((item) => ({
      type: String(item['type'] || 'activity'),
      title: String(item['title'] || 'Activity'),
      subtitle: String(item['subtitle'] || ''),
      createdAt: String(item['createdAt'] || '')
    }))
  );

  ngOnInit(): void {
    this.api.list<ApiRecord[]>('branches').subscribe({ next: (branches) => this.branches.set(branches || []) });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.load({ range: this.range(), branchId: this.branchId() }).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error?.message || err?.error?.message || err?.message || 'Unable to load executive dashboard');
        this.loading.set(false);
      }
    });
  }

  setRange(value: string): void {
    this.range.set(value);
    this.load();
  }

  setBranch(value: string): void {
    this.branchId.set(value);
    this.appState.setBranch(value);
    this.load();
  }

  toggleLive(): void {
    this.liveMode.update((value) => !value);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.liveMode()) {
      this.timer = setInterval(() => this.load(), 60_000);
    }
  }

  resolveAlert(id: string): void {
    if (!id) return;
    this.service.resolveAnomaly(id).subscribe({ next: () => this.load() });
  }

  maxChartValue(rows: ApiRecord[], key = 'value'): number {
    return Math.max(1, ...rows.map((row) => Number(row[key] || 0)));
  }

  currency(value: unknown): string {
    return `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
  }

  toNumber(value: unknown): number {
    return Number(value) || 0;
  }

  rows(value: unknown): ApiRecord[] {
    return Array.isArray(value) ? value : [];
  }

  matrix(value: unknown): unknown[][] {
    return Array.isArray(value) ? value as unknown[][] : [];
  }

  record(value: unknown): ApiRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as ApiRecord : {};
  }

  private kpi(key: string, label: string, value: string): KpiVm {
    const item = this.data()?.kpis[key] || {};
    return {
      key,
      label,
      value,
      delta: Number(item['deltaPct'] || 0),
      trend: String(item['trend'] || 'flat'),
      route: `/kpi-details/dashboard/${key}`
    };
  }
}
