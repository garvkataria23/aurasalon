import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-security-alerts',
  standalone: true,
  imports: [CommonModule, DatePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Enterprise Security Shield</span>
          <h2>Security Alerts</h2>
          <p>Monitor suspicious login, probing, sensitive-access and active-defense events across the tenant.</p>
        </div>
        <button class="ghost-button" type="button" (click)="load()">Refresh</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="metrics-grid">
        <article class="metric-card"><span>Open</span><strong>{{ summary().open || 0 }}</strong><small>Needs review</small></article>
        <article class="metric-card danger"><span>Critical</span><strong>{{ summary().critical || 0 }}</strong><small>Immediate attention</small></article>
        <article class="metric-card warning"><span>Warning</span><strong>{{ summary().warning || 0 }}</strong><small>Suspicious activity</small></article>
        <article class="metric-card"><span>Resolved</span><strong>{{ summary().resolved || 0 }}</strong><small>Closed items</small></article>
      </div>

      <section class="panel">
        <div class="section-title"><h2>Alert queue</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Severity</th><th>Type</th><th>Summary</th><th>IP</th><th>User</th><th>Created</th><th>Status</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let alert of alerts()">
                <td><span class="badge">{{ alert.severity }}</span></td>
                <td>{{ alert.alertType }}</td>
                <td>{{ alert.summary }}</td>
                <td>{{ alert.ipAddress || '-' }}</td>
                <td>{{ alert.userId || '-' }}</td>
                <td>{{ alert.createdAt | date: 'short' }}</td>
                <td>{{ alert.status }}</td>
                <td><button class="ghost-button mini" type="button" [disabled]="alert.status === 'resolved'" (click)="resolve(alert)">Resolve</button></td>
              </tr>
              <tr *ngIf="!alerts().length"><td colspan="8">No security alerts found.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `
})
export class SecurityAlertsComponent implements OnInit {
  readonly alerts = signal<ApiRecord[]>([]);
  readonly summary = signal<ApiRecord>({});
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list<{ alerts: ApiRecord[] }>('security/alerts').subscribe({
      next: (result) => {
        this.alerts.set(result.alerts || []);
        this.loadSummary();
      },
      error: (error) => { this.error.set(this.api.errorText(error)); this.loading.set(false); }
    });
  }

  loadSummary(): void {
    this.api.list<ApiRecord>('security/alerts/summary').subscribe({
      next: (summary) => { this.summary.set(summary || {}); this.loading.set(false); },
      error: (error) => { this.error.set(this.api.errorText(error)); this.loading.set(false); }
    });
  }

  resolve(alert: ApiRecord): void {
    this.api.post(`security/alerts/${alert.id}/resolve`, {}).subscribe({
      next: () => this.load(),
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }
}
