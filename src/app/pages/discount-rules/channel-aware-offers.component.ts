import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiRecord, ApiService } from '../../core/api.service';

@Component({
  selector: 'app-channel-aware-offers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './channel-aware-offers.component.html',
  styleUrls: ['./channel-aware-offers.component.css']
})
export class ChannelAwareOffersComponent implements OnInit {
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly evaluation = signal<ApiRecord | null>(null);
  readonly suggestions = signal<ApiRecord[]>([]);

  filters = {
    sourceChannel: 'whatsapp',
    campaignChannel: 'whatsapp',
    serviceCategory: 'default',
    signalDate: '',
    dayOfWeek: '',
    hourSlot: '',
    servicePricePaise: 250000,
    baseDiscountPercent: 5,
    channelFeePercent: '',
    conversionRatePercent: 0,
    lookbackDays: 90
  };

  readonly channelOptions = ['walk_in', 'online_booking', 'whatsapp', 'google', 'instagram', 'referral', 'aggregator', 'coupon', 'loyalty', 'corporate'];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      evaluation: this.api.list<ApiRecord>('happy-hours-channel-aware/evaluate', this.params()),
      suggestions: this.api.list<{ rows: ApiRecord[] }>('happy-hours-channel-aware/suggestions', { limit: 25 })
    }).subscribe({
      next: (result) => {
        this.evaluation.set(result.evaluation || {});
        this.suggestions.set(result.suggestions.rows || []);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(this.api.errorText(error, 'Unable to load channel-aware offers'));
        this.loading.set(false);
      }
    });
  }

  saveSuggestion(): void {
    this.saving.set(true);
    this.error.set('');
    this.api.post<{ suggestion: ApiRecord }>('happy-hours-channel-aware/suggestions', this.params()).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(this.api.errorText(error, 'Unable to save channel-aware suggestion'));
        this.saving.set(false);
      }
    });
  }

  updateStatus(row: ApiRecord, status: string): void {
    this.api.patch<{ suggestion: ApiRecord }>(`happy-hours-channel-aware/suggestions/${row.id}/status`, { status }).subscribe({
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

  summary(): ApiRecord {
    return this.evaluation()?.summary || {};
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

  occupancy(value: unknown): string {
    return `${(Number(value || 0) * 100).toFixed(0)}%`;
  }

  private params(): ApiRecord {
    const params: ApiRecord = {
      sourceChannel: this.filters.sourceChannel,
      campaignChannel: this.filters.campaignChannel || this.filters.sourceChannel,
      serviceCategory: this.filters.serviceCategory || 'default',
      servicePricePaise: this.filters.servicePricePaise,
      baseDiscountPercent: this.filters.baseDiscountPercent,
      conversionRatePercent: this.filters.conversionRatePercent,
      lookbackDays: this.filters.lookbackDays
    };
    if (this.filters.channelFeePercent !== '') params.channelFeePercent = this.filters.channelFeePercent;
    if (this.filters.signalDate) params.signalDate = this.filters.signalDate;
    if (this.filters.dayOfWeek) params.dayOfWeek = this.filters.dayOfWeek;
    if (this.filters.hourSlot !== '') params.hourSlot = this.filters.hourSlot;
    return params;
  }
}
