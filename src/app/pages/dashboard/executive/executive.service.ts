import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiRecord, ApiService } from '../../../core/api.service';

export type ExecutiveDashboard = ApiRecord & {
  range: { key: string; from: string; to: string };
  kpis: Record<string, ApiRecord>;
  charts: Record<string, ApiRecord[]>;
  alerts: ApiRecord[];
  topPerformers: { staff: ApiRecord[]; services: ApiRecord[] };
  salonCritical: Record<string, ApiRecord | ApiRecord[]>;
  advanced: Record<string, ApiRecord | ApiRecord[]>;
  activity: ApiRecord[];
};

@Injectable()
export class ExecutiveDashboardService {
  constructor(private readonly api: ApiService) {}

  load(params: ApiRecord): Observable<ExecutiveDashboard> {
    return this.api.list<ExecutiveDashboard>('dashboard/executive', params);
  }

  resolveAnomaly(id: string): Observable<ApiRecord> {
    return this.api.post<ApiRecord>(`dashboard/anomalies/${id}/resolve`, {});
  }
}
