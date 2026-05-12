import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-security-layer',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Level 13 · Enterprise security</span>
          <h2>Rate limiting, API protection, audit logs, permissions, sessions, encryption, backups and activity tracking</h2>
          <p>Security events are persisted and the API now applies security headers, request tracking and per-user rate limits.</p>
        </div>
        <button class="ghost-button" type="button" (click)="load()">Refresh</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="metrics-grid" *ngIf="summary()?.metrics as metrics">
        <article class="metric-card teal"><span>Audit logs</span><strong>{{ metrics.auditLogs }}</strong><small>Persisted events</small></article>
        <article class="metric-card blue"><span>Active sessions</span><strong>{{ metrics.activeSessions }}</strong><small>Session management</small></article>
        <article class="metric-card amber"><span>Backups</span><strong>{{ metrics.backups }}</strong><small>SQLite snapshots</small></article>
        <article class="metric-card green"><span>Permissions</span><strong>{{ metrics.permissions }}</strong><small>Role grants</small></article>
        <article class="metric-card violet"><span>Encrypted secrets</span><strong>{{ metrics.encryptedSecrets }}</strong><small>AES vault entries</small></article>
        <article class="metric-card red"><span>Risk score</span><strong>{{ metrics.riskScore }}</strong><small>Denied + activity signals</small></article>
      </div>

      <div class="three-grid">
        <section class="form-panel">
          <h3>Permission system</h3>
          <form [formGroup]="permissionForm" (ngSubmit)="savePermission()">
            <label class="field"><span>Role</span><input formControlName="role" /></label>
            <label class="field"><span>Resource</span><input formControlName="resource" /></label>
            <label class="field full"><span>Actions CSV</span><input formControlName="actions" /></label>
            <div class="form-actions"><button class="primary-button" type="submit">Save permission</button></div>
          </form>
        </section>

        <section class="form-panel">
          <h3>Session management</h3>
          <form [formGroup]="sessionForm" (ngSubmit)="createSession()">
            <label class="field"><span>User ID</span><input formControlName="userId" /></label>
            <label class="field"><span>Device ID</span><input formControlName="deviceId" /></label>
            <div class="form-actions"><button class="primary-button" type="submit">Create session</button></div>
          </form>
        </section>

        <section class="form-panel">
          <h3>Encryption and backup</h3>
          <form [formGroup]="secretForm" (ngSubmit)="encryptSecret()">
            <label class="field"><span>Name</span><input formControlName="name" /></label>
            <label class="field"><span>Value</span><input formControlName="value" type="password" /></label>
            <div class="form-actions">
              <button class="ghost-button" type="button" (click)="createBackup()">Create backup</button>
              <button class="primary-button" type="submit">Encrypt</button>
            </div>
          </form>
        </section>
      </div>

      <section class="panel">
        <div class="section-title"><h2>Protection controls</h2></div>
        <div class="quick-grid">
          <article class="action-card" *ngFor="let control of controlEntries()">
            <strong>{{ control[0] }}</strong>
            <span>{{ control[1] }}</span>
          </article>
        </div>
      </section>

      <div class="dashboard-grid">
        <section class="panel">
          <div class="section-title"><h2>Audit logs</h2></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Severity</th><th>Created</th></tr></thead>
              <tbody>
                <tr *ngFor="let log of summary()?.auditLogs || []">
                  <td>{{ log.action }}</td>
                  <td>{{ log.actorRole }} · {{ log.actorUserId }}</td>
                  <td>{{ log.targetType }} {{ log.targetId }}</td>
                  <td><span class="badge">{{ log.severity }}</span></td>
                  <td>{{ log.createdAt | date: 'short' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <div class="section-title"><h2>Sessions and backups</h2></div>
          <div class="rank-list">
            <article *ngFor="let session of summary()?.sessions || []">
              <div><strong>{{ session.userId }}</strong><span>{{ session.status }} · {{ session.deviceId || 'no device' }}</span></div>
              <button class="ghost-button mini" type="button" (click)="revoke(session)" [disabled]="session.status !== 'active'">Revoke</button>
            </article>
            <article *ngFor="let backup of summary()?.backups || []">
              <div><strong>{{ backup.type }}</strong><span>{{ backup.fileSizeBytes }} bytes · {{ backup.status }}</span></div>
              <small>{{ backup.createdAt | date: 'short' }}</small>
            </article>
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="section-title"><h2>Activity tracking</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Method</th><th>Path</th><th>Status</th><th>Duration</th><th>Created</th></tr></thead>
            <tbody>
              <tr *ngFor="let event of summary()?.activities || []">
                <td>{{ event.method }}</td>
                <td>{{ event.path }}</td>
                <td>{{ event.statusCode }}</td>
                <td>{{ event.durationMs }}ms</td>
                <td>{{ event.createdAt | date: 'short' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <pre class="result-json" *ngIf="result()">{{ result() | json }}</pre>
    </section>
  `
})
export class SecurityLayerComponent implements OnInit {
  readonly summary = signal<ApiRecord | null>(null);
  readonly result = signal<ApiRecord | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly permissionForm = this.fb.group({
    role: ['frontDesk', Validators.required],
    resource: ['smart-booking', Validators.required],
    actions: ['read,write', Validators.required]
  });
  readonly sessionForm = this.fb.group({ userId: ['system-user', Validators.required], deviceId: ['front-desk-terminal'] });
  readonly secretForm = this.fb.group({ name: ['whatsapp-provider-token', Validators.required], value: ['demo-secret', Validators.required] });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.list<ApiRecord>('security/summary').subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load security layer');
        this.loading.set(false);
      }
    });
  }

  controlEntries(): [string, string][] {
    return Object.entries(this.summary()?.controls || {});
  }

  savePermission(): void {
    this.api.post<ApiRecord>('security/permissions', {
      role: this.permissionForm.value.role,
      resource: this.permissionForm.value.resource,
      actions: String(this.permissionForm.value.actions || '').split(',').map((item) => item.trim()).filter(Boolean)
    }).subscribe((response) => {
      this.result.set(response);
      this.load();
    });
  }

  createSession(): void {
    this.api.post<ApiRecord>('security/sessions', this.sessionForm.value).subscribe((response) => {
      this.result.set(response);
      this.load();
    });
  }

  revoke(session: ApiRecord): void {
    this.api.patch<ApiRecord>(`security/sessions/${session.id}/revoke`, {}).subscribe((response) => {
      this.result.set(response);
      this.load();
    });
  }

  encryptSecret(): void {
    this.api.post<ApiRecord>('security/encrypt', this.secretForm.value).subscribe((response) => {
      this.result.set(response);
      this.load();
    });
  }

  createBackup(): void {
    this.api.post<ApiRecord>('security/backups', { type: 'manual-snapshot', reason: 'admin-console' }).subscribe((response) => {
      this.result.set(response);
      this.load();
    });
  }
}
