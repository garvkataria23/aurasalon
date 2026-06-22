import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ApiRecord, ApiService } from '../../../core/api.service';

export type OfflineOperation = ApiRecord & {
  id: string;
  entity?: string;
  action?: string;
  payload?: ApiRecord;
  local_created_at: string;
  client_version: number;
};

@Injectable({ providedIn: 'root' })
export class OfflineSyncApi {
  constructor(private readonly api: ApiService) {}

  push(operations: OfflineOperation[]): Observable<ApiRecord> {
    if (!operations.length) return of({ synced: 0 });
    return this.api.post<ApiRecord>('offline/sync', { operations });
  }

  conflicts(): Observable<ApiRecord[] | { rows: ApiRecord[] }> {
    return this.api.list<ApiRecord[] | { rows: ApiRecord[] }>('offline/conflicts');
  }
}
