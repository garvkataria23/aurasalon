import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiRecord, ApiService } from '../../../core/api.service';
import { ClientMasterKind, ClientMasterRecord, ClientMasterSummary } from '../domain/client-masters.models';

@Injectable({ providedIn: 'root' })
export class ClientMastersApi {
  constructor(private readonly api: ApiService) {}

  summary(): Observable<ClientMasterSummary> {
    return this.api.list<ClientMasterSummary>('client-masters/summary');
  }

  list(kind: ClientMasterKind, params: ApiRecord = {}): Observable<ClientMasterRecord[]> {
    return this.api.list<ClientMasterRecord[]>(`client-masters/${kind}`, params);
  }

  create(kind: ClientMasterKind, payload: ApiRecord): Observable<ClientMasterRecord> {
    return this.api.post<ClientMasterRecord>(`client-masters/${kind}`, payload);
  }

  update(kind: ClientMasterKind, id: string, payload: ApiRecord): Observable<ClientMasterRecord> {
    return this.api.patch<ClientMasterRecord>(`client-masters/${kind}/${id}`, payload);
  }

  updateStatus(kind: ClientMasterKind, id: string, payload: ApiRecord): Observable<ClientMasterRecord> {
    return this.api.patch<ClientMasterRecord>(`client-masters/${kind}/${id}/status`, payload);
  }
}
