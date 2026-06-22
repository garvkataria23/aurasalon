import { Injectable, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, tap } from 'rxjs';
import { ApiRecord, ApiService } from '../../../core/api.service';
import { Invoice, InvoiceDraft, InvoiceItem } from '../domain/invoice.model';

type InvoiceListResponse = {
  rows?: Invoice[];
  total?: number;
  limit?: number;
  offset?: number;
};

export type BillingCartPreview = ApiRecord & {
  items?: InvoiceItem[];
  happyHourDiscountPaise?: number;
  totalDiscountPaise?: number;
  groupDiscountPaise?: number;
  groupDiscountLabel?: string;
  bundleSavingsPaise?: number;
  bundleName?: string;
};

@Injectable({ providedIn: 'root' })
export class BillingRepository {
  readonly invoices = signal<Invoice[]>([]);
  readonly selectedInvoice = signal<Invoice | null>(null);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(private readonly api: ApiService) {}

  loadInvoices(params: ApiRecord = {}): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list<InvoiceListResponse | Invoice[]>('billing/invoices', { limit: 100, ...params })
      .pipe(
        map((response) => Array.isArray(response) ? { rows: response, total: response.length } : response),
        finalize(() => this.loading.set(false)),
        catchError((error) => {
          this.error.set(this.api.errorText(error, 'Unable to load invoices'));
          return of({ rows: [], total: 0 });
        })
      )
      .subscribe((response) => {
        this.invoices.set(response.rows || []);
        this.total.set(Number(response.total || response.rows?.length || 0));
      });
  }

  createDraft(payload: InvoiceDraft): void {
    this.loading.set(true);
    this.error.set('');
    this.api.post<Invoice>('billing/invoices/draft', payload)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (invoice) => {
          this.selectedInvoice.set(invoice);
          this.invoices.update((rows) => [invoice, ...rows.filter((row) => row.id !== invoice.id)]);
        },
        error: (error) => this.error.set(this.api.errorText(error, 'Unable to create invoice draft'))
      });
  }

  previewCartWithHappyHours(items: InvoiceItem[], bypassHappyHours: boolean, branchId: string, groupSize = 1): Observable<BillingCartPreview> {
    return this.api.post<BillingCartPreview>('happy-hours/preview-cart', {
      branchId,
      branch_id: branchId,
      items,
      bypassHappyHours,
      bypass: bypassHappyHours,
      groupSize
    }).pipe(
      tap(() => this.error.set('')),
      catchError((error) => {
        this.error.set(this.api.errorText(error, 'Unable to preview happy-hour discounts'));
        throw error;
      })
    );
  }
}
