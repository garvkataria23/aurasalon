import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-offline-device-health',
  standalone: true,
  imports: [CommonModule, DatePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Offline Resilience</span>
          <h2>Device Sync Health</h2>
          <p>Track branch tablets, POS terminals and mobile devices from offline queue and cache activity.</p>
        </div>
        <button class="ghost-button" type="button" (click)="load()">Refresh</button>
      </div>
      <app-state [loading]="loading()" [error]="error()"></app-state>
      <section class="panel">
        <div class="section-title"><h2>Devices</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Status</th><th>Device ID</th><th>Pending</th><th>Failed</th><th>Last seen</th><th>App version</th></tr></thead>
            <tbody>
              <tr *ngFor="let device of devices()">
                <td><span class="badge">{{ device.status }}</span></td>
                <td>{{ device.deviceId }}</td>
                <td>{{ device.pending }}</td>
                <td>{{ device.failed }}</td>
                <td>{{ device.lastSeen | date: 'short' }}</td>
                <td>{{ device.appVersion || 'Not reported' }}</td>
              </tr>
              <tr *ngIf="!devices().length"><td colspan="6">No device sync activity yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `
})
export class OfflineDeviceHealthComponent implements OnInit {
  readonly summary = signal<ApiRecord | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(private readonly api: ApiService) {}
  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.list<ApiRecord>('offline/summary').subscribe({
      next: (summary) => { this.summary.set(summary); this.loading.set(false); },
      error: (error) => { this.error.set(this.api.errorText(error)); this.loading.set(false); }
    });
  }

  devices(): ApiRecord[] {
    const map = new Map<string, ApiRecord>();
    for (const item of this.summary()?.syncItems || []) {
      const id = item.deviceId || 'unknown-device';
      const row = map.get(id) || { deviceId: id, pending: 0, failed: 0, lastSeen: item.createdAt, status: 'online', appVersion: item.appVersion || '' };
      if (item.status === 'queued') row.pending += 1;
      if (item.status === 'failed' || item.status === 'conflict') row.failed += 1;
      if (!row.lastSeen || item.createdAt > row.lastSeen) row.lastSeen = item.createdAt;
      row.status = row.failed ? 'risk' : row.pending ? 'partial' : 'online';
      map.set(id, row);
    }
    for (const snapshot of this.summary()?.snapshots || []) {
      const id = snapshot.deviceId || 'unknown-device';
      if (!map.has(id)) map.set(id, { deviceId: id, pending: 0, failed: 0, lastSeen: snapshot.createdAt, status: 'ready', appVersion: snapshot.appVersion || '' });
    }
    return [...map.values()];
  }
}
