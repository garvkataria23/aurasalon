import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiRecord, ApiService } from '../../../core/api.service';

@Injectable({ providedIn: 'root' })
export class CommandCenterApi {
  constructor(private readonly api: ApiService) {}

  list<T = ApiRecord>(endpoint: string, params: ApiRecord = {}): Observable<T> {
    return this.api.list<T>(endpoint, params);
  }

  post<T = ApiRecord>(endpoint: string, payload: ApiRecord = {}): Observable<T> {
    return this.api.post<T>(endpoint, payload);
  }

  patch<T = ApiRecord>(endpoint: string, payload: ApiRecord = {}): Observable<T> {
    return this.api.patch<T>(endpoint, payload);
  }
}
