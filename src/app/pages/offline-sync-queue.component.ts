import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-offline-sync-queue',
  standalone: true,
  imports: [CommonModule, DatePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Offline Resilience</span>
          <h2>Smart Sync Queue</h2>
          <p>Prioritize offline billing first, appointments second, and inventory or background mutations after that.</p>
        </div>
        <div class="form-actions">
          <button class="ghost-button" type="button" (click)="load()">Refresh</button>
          <button class="primary-button" type="button" (click)="sync()">Force sync queued</button>
        </div>
      </div>
      <app-state [loading]="loading()" [error]="error()"></app-state>
      <section class="panel">
        <div class="section-title"><h2>Priority queue</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Priority</th><th>Entity</th><th>Operation</th><th>Device</th><th>Status</th><th>Server</th><th>Failure / conflict preview</th><th>Created</th></tr></thead>
            <tbody>
              <tr *ngFor="let item of queue()">
                <td>{{ priorityLabel(item) }}</td>
                <td>{{ item.entity }}</td>
                <td>{{ item.operation }}</td>
                <td>{{ item.deviceId }}</td>
                <td><span class="badge">{{ item.status }}</span></td>
                <td>{{ item.serverId || '-' }}</td>
                <td>{{ item.errorMessage || item.conflictReason || '-' }}</td>
                <td>{{ item.createdAt | date: 'short' }}</td>
              </tr>
              <tr *ngIf="!queue().length"><td colspan="8">No sync queue items found.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <pre class="result-json" *ngIf="result()">{{ result() | json }}</pre>
    </section>
  `
})
export class OfflineSyncQueueComponent implements OnInit {
  readonly summary = signal<ApiRecord | null>(null);
  readonly result = signal<ApiRecord | null>(null);
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

  sync(): void {
    this.api.post<ApiRecord>('offline/sync', {}).subscribe({
      next: (result) => { this.result.set(result); this.load(); },
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  queue(): ApiRecord[] {
    return [...(this.summary()?.syncItems || [])].sort((left, right) => this.priority(left) - this.priority(right));
  }

  priority(item: ApiRecord): number {
    if (item.entity === 'sales' || item.operation?.includes?.('billing')) return 1;
    if (item.entity === 'appointments') return 2;
    if (item.entity === 'inventory') return 3;
    return 4;
  }

  priorityLabel(item: ApiRecord): string {
    return `P${this.priority(item)}`;
  }
}
