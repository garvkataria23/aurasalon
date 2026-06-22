import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import { ComplianceDashboard } from '../domain/compliance.models';

@Injectable({ providedIn: 'root' })
export class ComplianceApi {
  constructor(private readonly api: ApiService) {}

  dashboard(): Observable<ComplianceDashboard> {
    return this.api.list<ComplianceDashboard>('compliance/dashboard');
  }
}
