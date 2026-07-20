import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiRecord, ApiService } from '../../../core/api.service';
import { Invoice } from '../domain/invoice.model';

@Injectable({ providedIn: 'root' })
export class BillingApi {
  constructor(private readonly api: ApiService) {}

  invoice(id: string): Observable<Invoice> {
    return this.api.get<Invoice>('billing/invoices', id);
  }

  refund(id: string, payload: ApiRecord): Observable<ApiRecord> {
    return this.api.postWithHeaders<ApiRecord>(`billing/invoices/${id}/refund`, payload, {
      'Idempotency-Key': `billing-refund-${id}-${Date.now()}`
    });
  }
}
