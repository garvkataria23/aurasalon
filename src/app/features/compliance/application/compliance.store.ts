import { Injectable, computed, signal } from '@angular/core';
import { ComplianceApi } from '../data/compliance.api';
import { ComplianceDashboard } from '../domain/compliance.models';

@Injectable({ providedIn: 'root' })
export class ComplianceStore {
  readonly dashboard = signal<ComplianceDashboard | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly scoreLabel = computed(() => {
    const score = this.dashboard()?.complianceScore ?? 0;
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Healthy';
    if (score >= 50) return 'Needs attention';
    return 'Critical';
  });

  constructor(private readonly api: ComplianceApi) {}

  loadDashboard(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.dashboard().subscribe({
      next: (value) => {
        this.dashboard.set(value);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(error instanceof Error ? error.message : 'Unable to load compliance dashboard');
        this.loading.set(false);
      }
    });
  }
}
