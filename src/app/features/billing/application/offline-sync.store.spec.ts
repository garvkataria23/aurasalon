import { of, throwError } from 'rxjs';
import { OfflineSyncStore } from './offline-sync.store';
import type { OfflineSyncApi } from '../data/offline-sync.api';

function makeApi(pushResult: 'ok' | 'error' = 'ok'): OfflineSyncApi {
  return {
    push: () => pushResult === 'ok' ? of({ ok: true }) : throwError(() => new Error('network')),
    conflicts: () => of([])
  } as unknown as OfflineSyncApi;
}

function makeStore(pushResult: 'ok' | 'error' = 'ok'): OfflineSyncStore {
  return new OfflineSyncStore(makeApi(pushResult));
}

describe('OfflineSyncStore', () => {
  it('starts online with empty queue', () => {
    const store = makeStore();
    expect(store.queue().length).toBe(0);
    expect(store.syncing()).toBe(false);
  });

  it('badge is "Online" when online and queue is empty', () => {
    const store = makeStore();
    store.online.set(true);
    expect(store.badge()).toBe('Online');
  });

  it('badge shows queued count when items are queued', () => {
    const store = makeStore();
    store.online.set(false);
    store.queueOperation({ resource: 'appointments', method: 'POST', payload: { id: '1' } });
    store.queueOperation({ resource: 'appointments', method: 'POST', payload: { id: '2' } });
    expect(store.queue().length).toBe(2);
    store.online.set(true);
    expect(store.badge()).toBe('2 queued');
  });

  it('badge shows "Offline POS" when offline', () => {
    const store = makeStore();
    store.online.set(false);
    expect(store.badge()).toBe('Offline POS');
  });

  it('queueOperation adds item with id and timestamp', () => {
    const store = makeStore();
    store.online.set(false);
    store.queueOperation({ resource: 'clients', method: 'POST', payload: { name: 'Test' } });
    const item = store.queue()[0];
    expect(item.resource).toBe('clients');
    expect(item.id).toBeTruthy();
    expect(item.local_created_at).toBeTruthy();
    expect(item.client_version).toBe(1);
  });

  it('syncNow clears queue on success', () => {
    const store = makeStore('ok');
    store.online.set(false);
    store.queueOperation({ resource: 'invoices', method: 'POST', payload: {} });
    expect(store.queue().length).toBe(1);
    store.online.set(true);
    store.syncNow();
    expect(store.queue().length).toBe(0);
    expect(store.syncing()).toBe(false);
  });

  it('syncNow keeps queue and stops syncing on error', () => {
    const store = makeStore('error');
    store.online.set(false);
    store.queueOperation({ resource: 'invoices', method: 'POST', payload: {} });
    store.online.set(true);
    store.syncNow();
    expect(store.syncing()).toBe(false);
  });

  it('syncNow does nothing when offline', () => {
    const store = makeStore();
    store.online.set(false);
    store.queueOperation({ resource: 'invoices', method: 'POST', payload: {} });
    store.syncNow();
    expect(store.syncing()).toBe(false);
    expect(store.queue().length).toBe(1);
  });

  it('syncNow does nothing when queue is empty', () => {
    const store = makeStore();
    store.online.set(true);
    store.syncNow();
    expect(store.syncing()).toBe(false);
  });
});
