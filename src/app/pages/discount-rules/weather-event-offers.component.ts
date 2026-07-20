import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiRecord, ApiService } from '../../core/api.service';

@Component({
  selector: 'app-weather-event-offers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './weather-event-offers.component.html',
  styleUrls: ['./weather-event-offers.component.css']
})
export class WeatherEventOffersComponent implements OnInit {
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly evaluation = signal<ApiRecord | null>(null);
  readonly suggestions = signal<ApiRecord[]>([]);

  filters = {
    city: 'Mumbai',
    serviceCategory: 'default',
    signalDate: '',
    dayOfWeek: '',
    hourSlot: '',
    weatherCondition: 'normal',
    temperatureCelsius: 0,
    rainProbabilityPercent: 0,
    eventType: 'none',
    eventName: '',
    expectedFootfall: 0,
    baseDiscountPercent: 5,
    servicePricePaise: 250000
  };

  readonly weatherOptions = ['normal', 'rain', 'storm', 'heatwave', 'cold', 'pollution'];
  readonly eventOptions = ['none', 'festival', 'wedding', 'payday', 'month_end', 'local_event', 'school_holiday', 'traffic', 'strike'];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      evaluation: this.api.list<ApiRecord>('happy-hours-weather-event/evaluate', this.params()),
      suggestions: this.api.list<{ rows: ApiRecord[] }>('happy-hours-weather-event/suggestions', { limit: 25 })
    }).subscribe({
      next: (result) => {
        this.evaluation.set(result.evaluation || {});
        this.suggestions.set(result.suggestions.rows || []);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(this.api.errorText(error, 'Unable to load weather/event offers'));
        this.loading.set(false);
      }
    });
  }

  saveSuggestion(): void {
    this.saving.set(true);
    this.error.set('');
    this.api.post<{ suggestion: ApiRecord }>('happy-hours-weather-event/suggestions', this.params()).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(this.api.errorText(error, 'Unable to save weather/event suggestion'));
        this.saving.set(false);
      }
    });
  }

  updateStatus(row: ApiRecord, status: string): void {
    this.api.patch<{ suggestion: ApiRecord }>(`happy-hours-weather-event/suggestions/${row.id}/status`, { status }).subscribe({
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
    return `${(Number(value || 0) * 100).toFixed(0)}%`;
  }

  private params(): ApiRecord {
    const params: ApiRecord = {
      city: this.filters.city,
      serviceCategory: this.filters.serviceCategory || 'default',
      weatherCondition: this.filters.weatherCondition,
      temperatureCelsius: this.filters.temperatureCelsius,
      rainProbabilityPercent: this.filters.rainProbabilityPercent,
      eventType: this.filters.eventType,
      eventName: this.filters.eventName,
      expectedFootfall: this.filters.expectedFootfall,
      baseDiscountPercent: this.filters.baseDiscountPercent,
      servicePricePaise: this.filters.servicePricePaise
    };
    if (this.filters.signalDate) params.signalDate = this.filters.signalDate;
    if (this.filters.dayOfWeek) params.dayOfWeek = this.filters.dayOfWeek;
    if (this.filters.hourSlot !== '') params.hourSlot = this.filters.hourSlot;
    return params;
  }
}
