import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-future-features',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe, DatePipe, DecimalPipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Level 16 · Future salon intelligence</span>
          <h2>AI growth advisor, pricing optimizer, offer engine, emotion analysis, no-show prediction, voice assistant and kiosk mode</h2>
          <p>Experimental features use saved CRM, POS, booking, WhatsApp and inventory data, then persist each AI innovation run.</p>
        </div>
        <button class="ghost-button" type="button" (click)="load()">Refresh</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="metrics-grid" *ngIf="summary()?.metrics as metrics">
        <article class="metric-card teal"><span>Innovation runs</span><strong>{{ metrics.innovationRuns }}</strong><small>Persisted outputs</small></article>
        <article class="metric-card blue"><span>Voice sessions</span><strong>{{ metrics.voiceSessions }}</strong><small>Voice booking</small></article>
        <article class="metric-card amber"><span>Kiosk sessions</span><strong>{{ metrics.kioskSessions }}</strong><small>Smart kiosk</small></article>
        <article class="metric-card red"><span>No-show risk</span><strong>{{ metrics.noShowRisk }}</strong><small>High-risk bookings</small></article>
        <article class="metric-card green"><span>Demand index</span><strong>{{ metrics.demandIndex }}</strong><small>7-day forecast</small></article>
        <article class="metric-card violet"><span>Pricing upside</span><strong>{{ metrics.pricingOpportunity | currency: 'INR':'symbol':'1.0-0' }}</strong><small>Monthly opportunity</small></article>
      </div>

      <div class="dashboard-grid">
        <section class="form-panel">
          <h3>Run future feature</h3>
          <form [formGroup]="runForm" (ngSubmit)="run()">
            <label class="field full">
              <span>Feature</span>
              <select formControlName="type">
                <option value="growth-advisor">AI salon growth advisor</option>
                <option value="pricing-optimizer">AI pricing optimizer</option>
                <option value="offer-engine">AI offer engine</option>
                <option value="emotion-analysis">AI customer emotion analysis</option>
                <option value="no-show-prediction">AI no-show prediction</option>
                <option value="demand-forecasting">AI demand forecasting</option>
                <option value="inventory-prediction">AI inventory prediction</option>
                <option value="voice-booking-assistant">Voice booking assistant</option>
                <option value="smart-kiosk-mode">Smart kiosk mode</option>
                <option value="ai-receptionist">AI receptionist</option>
              </select>
            </label>
            <label class="field full">
              <span>Prompt or transcript</span>
              <textarea formControlName="prompt"></textarea>
            </label>
            <div class="form-actions"><button class="primary-button" type="submit">Run intelligence</button></div>
          </form>
        </section>

        <section class="panel">
          <div class="section-title"><h2>Growth advisor preview</h2></div>
          <ng-container *ngIf="summary()?.advisorPreview as advisor">
            <p>{{ advisor.summary }}</p>
            <div class="rank-list">
              <article *ngFor="let item of advisor.priorities">
                <div><strong>{{ item.area }}</strong><span>{{ item.action }}</span></div>
                <strong>{{ item.impact | currency: 'INR':'symbol':'1.0-0' }}</strong>
              </article>
            </div>
          </ng-container>
        </section>
      </div>

      <section class="panel" *ngIf="output()">
        <div class="section-title">
          <div><span class="eyebrow">Latest generated output</span><h2>{{ output()?.title }}</h2></div>
        </div>
        <pre class="result-json">{{ output() | json }}</pre>
      </section>

      <div class="dashboard-grid">
        <section class="panel">
          <div class="section-title"><h2>Invented feature map</h2></div>
          <div class="quick-grid">
            <article class="action-card" *ngFor="let feature of summary()?.featureMap || []">
              <strong>{{ feature }}</strong>
              <span>Connected to persisted salon data</span>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="section-title"><h2>Voice and kiosk sessions</h2></div>
          <div class="rank-list">
            <article *ngFor="let session of summary()?.voiceSessions || []">
              <div><strong>{{ session.channel }}</strong><span>{{ session.status }} · {{ session.branchId || 'all branches' }}</span></div>
              <small>{{ session.createdAt | date: 'short' }}</small>
            </article>
            <article *ngFor="let session of summary()?.kioskSessions || []">
              <div><strong>{{ session.mode }}</strong><span>{{ session.status }} · {{ session.branchId }}</span></div>
              <small>{{ session.createdAt | date: 'short' }}</small>
            </article>
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="section-title"><h2>Innovation run history</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Type</th><th>Confidence</th><th>Status</th><th>Actions</th><th>Created</th></tr></thead>
            <tbody>
              <tr *ngFor="let run of summary()?.runs || []">
                <td>{{ run.type }}</td>
                <td>{{ run.confidence | number: '1.0-2' }}</td>
                <td><span class="badge">{{ run.status }}</span></td>
                <td>{{ run.actions?.length || 0 }}</td>
                <td>{{ run.createdAt | date: 'short' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `
})
export class FutureFeaturesComponent implements OnInit {
  readonly summary = signal<ApiRecord | null>(null);
  readonly output = signal<ApiRecord | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly runForm = this.fb.group({
    type: ['growth-advisor'],
    prompt: ['Create next best actions for salon growth this week']
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.list<ApiRecord>('future-features/summary').subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load future feature lab');
        this.loading.set(false);
      }
    });
  }

  run(): void {
    const type = this.runForm.value.type || 'growth-advisor';
    this.api.post<ApiRecord>(`future-features/${type}/run`, {
      prompt: this.runForm.value.prompt,
      transcript: this.runForm.value.prompt
    }).subscribe((response) => {
      this.output.set(response.output);
      this.load();
    });
  }
}
