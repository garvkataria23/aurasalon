import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiRecord, ApiService } from '../../core/api.service';

@Component({
  selector: 'app-no-show-risk-offers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './no-show-risk-offers.component.html',
  styleUrls: ['./no-show-risk-offers.component.css']
})
export class NoShowRiskOffersComponent implements OnInit {
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly evaluation = signal<ApiRecord | null>(null);
  readonly suggestions = signal<ApiRecord[]>([]);

  filters = {
    clientId: '',
    serviceCategory: 'default',
    signalDate: '',
    hourSlot: '',
    requestedStartAt: '',
    cartTotalPaise: 250000,
    baseDiscountPercent: 5,
    clientNoShowCount: 0,
    clientCancelCount: 0,
    clientCompletedCount: 0,
    branchNoShowRatePercent: '',
    depositStatus: 'not_required',
    lookbackDays: 180
  };

  readonly depositStatuses = ['not_required', 'pending', 'paid', 'failed', 'not_paid', 'captured'];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      evaluation: this.api.list<ApiRecord>('happy-hours-no-show-risk/evaluate', this.params()),
      suggestions: this.api.list<{ rows: ApiRecord[] }>('happy-hours-no-show-risk/suggestions', { limit: 25 })
    }).subscribe({
      next: (result) => {
        this.evaluation.set(result.evaluation || {});
        this.suggestions.set(result.suggestions.rows || []);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(this.api.errorText(error, 'Unable to load no-show risk offers'));
        this.loading.set(false);
      }
    });
  }

  saveSuggestion(): void {
    this.saving.set(true);
    this.error.set('');
    this.api.post<{ suggestion: ApiRecord }>('happy-hours-no-show-risk/suggestions', this.params()).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(this.api.errorText(error, 'Unable to save no-show risk suggestion'));
        this.saving.set(false);
      }
    });
  }

  updateStatus(row: ApiRecord, status: string): void {
    this.api.patch<{ suggestion: ApiRecord }>(`happy-hours-no-show-risk/suggestions/${row.id}/status`, { status }).subscribe({
      next: () => this.load(),
      error: (error) => this.error.set(this.api.errorText(error, 'Unable to update suggestion'))
    });
  }

  rows(): ApiRecord[] {
    return this.evaluation()?.rows || [];
  }

  best(): ApiRecord {
    return this.evaluation()?.best || {};
  }

  formatMoney(value: unknown): string {
    return `Rs ${(Math.round(Number(value || 0)) / 100).toLocaleString('en-IN')}`;
  }

  label(value: unknown): string {
    return String(value || '').replace(/_/g, ' ');
  }

  pct(value: unknown): string {
    return `${Number(value || 0).toFixed(1)}%`;
  }

  private params(): ApiRecord {
    const params: ApiRecord = {
      clientId: this.filters.clientId,
      serviceCategory: this.filters.serviceCategory || 'default',
      cartTotalPaise: this.filters.cartTotalPaise,
      baseDiscountPercent: this.filters.baseDiscountPercent,
      clientNoShowCount: this.filters.clientNoShowCount,
      clientCancelCount: this.filters.clientCancelCount,
      clientCompletedCount: this.filters.clientCompletedCount,
      depositStatus: this.filters.depositStatus,
      lookbackDays: this.filters.lookbackDays
    };
    if (this.filters.signalDate) params.signalDate = this.filters.signalDate;
    if (this.filters.hourSlot !== '') params.hourSlot = this.filters.hourSlot;
    if (this.filters.requestedStartAt) params.requestedStartAt = this.filters.requestedStartAt;
    if (this.filters.branchNoShowRatePercent !== '') params.branchNoShowRatePercent = this.filters.branchNoShowRatePercent;
    return params;
  }
}
