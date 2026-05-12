import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppStateService } from './state/app-state.service';

export type ApiRecord = Record<string, any>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly selectedBranchId = this.appState.selectedBranchId;

  constructor(
    private readonly http: HttpClient,
    private readonly appState: AppStateService
  ) {}

  list<T = ApiRecord[]>(resource: string, params: ApiRecord = {}): Observable<T> {
    return this.http.get<T>(`${environment.apiBaseUrl}/${resource}`, { headers: this.headers(), params: this.toParams(params) });
  }

  get<T = ApiRecord>(resource: string, id: string): Observable<T> {
    return this.http.get<T>(`${environment.apiBaseUrl}/${resource}/${id}`, { headers: this.headers() });
  }

  create<T = ApiRecord>(resource: string, payload: ApiRecord): Observable<T> {
    return this.http.post<T>(`${environment.apiBaseUrl}/${resource}`, payload, { headers: this.headers() });
  }

  update<T = ApiRecord>(resource: string, id: string, payload: ApiRecord): Observable<T> {
    return this.http.patch<T>(`${environment.apiBaseUrl}/${resource}/${id}`, payload, { headers: this.headers() });
  }

  delete<T = ApiRecord>(resource: string, id: string): Observable<T> {
    return this.http.delete<T>(`${environment.apiBaseUrl}/${resource}/${id}`, { headers: this.headers() });
  }

  post<T = ApiRecord>(path: string, payload: ApiRecord = {}): Observable<T> {
    return this.http.post<T>(`${environment.apiBaseUrl}/${path}`, payload, { headers: this.headers() });
  }

  patch<T = ApiRecord>(path: string, payload: ApiRecord = {}): Observable<T> {
    return this.http.patch<T>(`${environment.apiBaseUrl}/${path}`, payload, { headers: this.headers() });
  }

  report<T = ApiRecord>(path: string, params: ApiRecord = {}): Observable<T> {
    return this.http.get<T>(`${environment.apiBaseUrl}/reports/${path}`, { headers: this.headers(), params: this.toParams(params) });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'x-tenant-id': this.appState.selectedTenantId(),
      'x-user-role': this.appState.userRole(),
      'x-branch-id': this.appState.selectedBranchId()
    });
  }

  private toParams(params: ApiRecord): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      httpParams = httpParams.set(key, String(value));
    }
    return httpParams;
  }
}
