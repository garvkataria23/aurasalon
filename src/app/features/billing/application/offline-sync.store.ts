import { Injectable, computed, effect, signal } from '@angular/core';
import { OfflineOperation, OfflineSyncApi } from '../data/offline-sync.api';

@Injectable()
export class OfflineSyncStore {
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly queue = signal<OfflineOperation[]>([]);
  readonly conflicts = signal<any[]>([]);
  readonly syncing = signal(false);
  readonly badge = computed(() => this.online() ? (this.queue().length ? `${this.queue().length} queued` : 'Online') : 'Offline POS');

  constructor(private readonly api: OfflineSyncApi) {
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('online', () => {
        this.online.set(true);
        this.syncNow();
      });
      globalThis.addEventListener('offline', () => this.online.set(false));
    }
    effect(() => {
      if (this.online() && this.queue().length) this.syncNow();
    });
  }

  queueOperation(operation: Omit<OfflineOperation, 'id' | 'local_created_at' | 'client_version'>): void {
    const id = globalThis.crypto?.randomUUID?.() || `offline-${Date.now()}`;
    this.queue.update((rows) => [...rows, { ...operation, id, local_created_at: new Date().toISOString(), client_version: 1 }]);
  }

  syncNow(): void {
    if (!this.online() || !this.queue().length || this.syncing()) return;
    this.syncing.set(true);
    this.api.push(this.queue()).subscribe({
      next: () => {
        this.queue.set([]);
        this.syncing.set(false);
      },
      error: () => this.syncing.set(false)
    });
  }

  loadConflicts(): void {
    this.api.conflicts().subscribe((response: any) => this.conflicts.set(Array.isArray(response) ? response : response.rows || []));
  }
}
