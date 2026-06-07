import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';
import { AuraKpiCardComponent } from '../shared/ui/aura-kpi-card/aura-kpi-card.component';

@Component({
  selector: 'app-ai-marketing-automation',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe, StateComponent, AuraKpiCardComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">AI marketing automation</span>
          <h2>Campaign generation, segmentation, retargeting, WhatsApp sequences and email templates</h2>
          <p>AI marketing outputs are persisted as campaigns, generations, workflows, sequences and reusable templates.</p>
        </div>
        <button class="ghost-button" type="button" (click)="festivalCampaign()">Festival campaign</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <ng-container *ngIf="summary() as summary">
        <div class="metrics-grid">
          <aura-kpi-card tone="teal" target="/kpi-details/ai-marketing/campaigns"><span>Campaigns</span><strong>{{ summary.metrics.campaigns }}</strong><small>Saved campaigns</small></aura-kpi-card>
          <aura-kpi-card tone="green" target="/kpi-details/ai-marketing/workflows"><span>Workflows</span><strong>{{ summary.metrics.activeWorkflows }}</strong><small>Active retargeting</small></aura-kpi-card>
          <aura-kpi-card tone="blue" target="/kpi-details/ai-marketing/whatsapp-sequences"><span>WhatsApp sequences</span><strong>{{ summary.metrics.whatsappSequences }}</strong><small>Automation journeys</small></aura-kpi-card>
          <aura-kpi-card tone="amber" target="/kpi-details/ai-marketing/email-templates"><span>Email templates</span><strong>{{ summary.metrics.emailTemplates }}</strong><small>Reusable templates</small></aura-kpi-card>
          <aura-kpi-card tone="violet" target="/kpi-details/ai-marketing/ai-generations"><span>AI generations</span><strong>{{ summary.metrics.generatedIdeas }}</strong><small>Persisted outputs</small></aura-kpi-card>
          <aura-kpi-card tone="rose" target="/kpi-details/ai-marketing/audience"><span>Audience</span><strong>{{ summary.metrics.estimatedAudience }}</strong><small>Segment reach</small></aura-kpi-card>
        </div>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Offer recommendations</span>
              <h2>AI offer ideas</h2>
            </div>
          </div>
          <div class="quick-grid">
            <article class="action-card" *ngFor="let offer of summary.recommendations">
              <strong>{{ offer.title }}</strong>
              <span>{{ offer.description }}</span>
              <small>{{ offer.estimatedRevenue | currency: 'INR':'symbol':'1.0-0' }} potential</small>
            </article>
          </div>
        </section>

        <div class="dashboard-grid">
          <section class="form-panel">
            <h3>Client segmentation</h3>
            <form [formGroup]="segmentForm" (ngSubmit)="segment()">
              <label class="field">
                <span>Segment</span>
                <select formControlName="tag">
                  <option value="">All clients</option>
                  <option>VIP</option>
                  <option>inactive</option>
                  <option>new</option>
                  <option>high spender</option>
                </select>
              </label>
              <label class="field"><span>Min spend</span><input type="number" formControlName="minSpend" /></label>
              <label class="field"><span>Min visits</span><input type="number" formControlName="minVisits" /></label>
              <label class="field"><span>Inactive days</span><input type="number" formControlName="inactiveDays" /></label>
              <label class="field check-line"><input type="checkbox" formControlName="membershipOnly" /><span>Members only</span></label>
              <button class="primary-button" type="submit">Preview segment</button>
            </form>
            <div class="segment-result" *ngIf="segmentResult() as result">
              <strong>{{ result.name }} · {{ result.count }} clients</strong>
              <span *ngFor="let client of result.clients">{{ client.name }}</span>
            </div>
          </section>

          <section class="form-panel">
            <h3>Auto campaign generation</h3>
            <form [formGroup]="campaignForm" (ngSubmit)="generateCampaign()">
              <label class="field"><span>Occasion</span><input formControlName="occasion" /></label>
              <label class="field">
                <span>Channel</span>
                <select formControlName="channel">
                  <option>WhatsApp</option>
                  <option>Email</option>
                  <option>SMS</option>
                  <option>Instagram</option>
                </select>
              </label>
              <label class="field"><span>Name</span><input formControlName="name" /></label>
              <label class="field full"><span>Offer hint</span><textarea formControlName="offerTitle"></textarea></label>
              <button class="primary-button" type="submit">Generate campaign</button>
            </form>
          </section>
        </div>

        <div class="dashboard-grid">
          <section class="form-panel">
            <h3>Retargeting workflow</h3>
            <form [formGroup]="workflowForm" (ngSubmit)="createWorkflow()">
              <label class="field"><span>Name</span><input formControlName="name" /></label>
              <label class="field"><span>Inactive days</span><input type="number" formControlName="inactiveDays" /></label>
              <label class="field">
                <span>Channel</span>
                <select formControlName="channel">
                  <option>WhatsApp</option>
                  <option>Email</option>
                </select>
              </label>
              <button class="primary-button" type="submit">Create workflow</button>
            </form>
          </section>

          <section class="form-panel">
            <h3>WhatsApp sequence</h3>
            <form [formGroup]="sequenceForm" (ngSubmit)="createSequence()">
              <label class="field"><span>Name</span><input formControlName="name" /></label>
              <label class="field"><span>Audience tag</span><input formControlName="tag" /></label>
              <label class="field"><span>Min visits</span><input type="number" formControlName="minVisits" /></label>
              <button class="primary-button" type="submit">Create sequence</button>
            </form>
          </section>
        </div>

        <section class="form-panel">
          <h3>Email template generator</h3>
          <form [formGroup]="emailForm" (ngSubmit)="createEmailTemplate()">
            <label class="field"><span>Name</span><input formControlName="name" /></label>
            <label class="field"><span>Occasion</span><input formControlName="occasion" /></label>
            <label class="field"><span>Subject</span><input formControlName="subject" /></label>
            <label class="field full"><span>Body</span><textarea formControlName="body"></textarea></label>
            <button class="primary-button" type="submit">Generate template</button>
          </form>
        </section>

        <section class="panel" *ngIf="latestResult() as result">
          <div class="section-title"><h2>Latest AI marketing output</h2></div>
          <div class="quick-grid">
            <article class="action-card" *ngIf="result.campaign">
              <strong>{{ result.campaign.name }}</strong>
              <span>{{ result.campaign.template }}</span>
            </article>
            <article class="action-card" *ngIf="result.output?.caption">
              <strong>Caption</strong>
              <span>{{ result.output.caption }}</span>
            </article>
            <article class="action-card" *ngIf="result.workflow">
              <strong>{{ result.workflow.name }}</strong>
              <span>{{ result.workflow.steps?.length }} workflow steps</span>
            </article>
            <article class="action-card" *ngIf="result.sequence">
              <strong>{{ result.sequence.name }}</strong>
              <span>{{ result.sequence.steps?.length }} WhatsApp steps</span>
            </article>
            <article class="action-card" *ngIf="result.emailTemplate">
              <strong>{{ result.emailTemplate.subject }}</strong>
              <span>{{ result.emailTemplate.body }}</span>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="section-title"><h2>Campaigns, workflows and sequences</h2></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Channel</th><th>Details</th></tr></thead>
              <tbody>
                <tr *ngFor="let campaign of summary.campaigns">
                  <td><strong>{{ campaign.name }}</strong><small>{{ campaign.template }}</small></td>
                  <td>Campaign</td>
                  <td><span class="badge">{{ campaign.status }}</span></td>
                  <td>{{ campaign.channel }}</td>
                  <td>{{ campaign.sentCount }} sent</td>
                </tr>
                <tr *ngFor="let workflow of summary.workflows">
                  <td><strong>{{ workflow.name }}</strong><small>{{ workflow.trigger }}</small></td>
                  <td>Workflow</td>
                  <td><span class="badge">{{ workflow.status }}</span></td>
                  <td>{{ workflow.channel }}</td>
                  <td>{{ workflow.steps?.length }} steps</td>
                </tr>
                <tr *ngFor="let sequence of summary.sequences">
                  <td><strong>{{ sequence.name }}</strong><small>{{ sequence.channel }}</small></td>
                  <td>Sequence</td>
                  <td><span class="badge">{{ sequence.status }}</span></td>
                  <td>{{ sequence.channel }}</td>
                  <td>{{ sequence.steps?.length }} steps</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </ng-container>
    </section>
  `
})
export class AiMarketingAutomationComponent implements OnInit {
  readonly summary = signal<ApiRecord | null>(null);
  readonly segmentResult = signal<ApiRecord | null>(null);
  readonly latestResult = signal<ApiRecord | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly segmentForm = this.fb.group({
    tag: [''],
    minSpend: [0],
    minVisits: [0],
    inactiveDays: [0],
    membershipOnly: [false]
  });

  readonly campaignForm = this.fb.group({
    occasion: ['summer glow'],
    channel: ['WhatsApp'],
    name: [''],
    offerTitle: ['']
  });

  readonly workflowForm = this.fb.group({
    name: ['Inactive client retargeting'],
    inactiveDays: [45],
    channel: ['WhatsApp']
  });

  readonly sequenceForm = this.fb.group({
    name: ['VIP WhatsApp booking sequence'],
    tag: ['VIP'],
    minVisits: [1]
  });

  readonly emailForm = this.fb.group({
    name: ['Festival email template', Validators.required],
    occasion: ['Diwali'],
    subject: [''],
    body: ['']
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list<ApiRecord>('ai-marketing/summary').subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load AI marketing automation');
        this.loading.set(false);
      }
    });
  }

  segment(): void {
    this.api.post<ApiRecord>('ai-marketing/segments', this.segmentForm.value).subscribe({
      next: (result) => this.segmentResult.set(result),
      error: (error) => this.error.set(error?.error?.error || 'Unable to segment clients')
    });
  }

  generateCampaign(): void {
    this.api.post<ApiRecord>('ai-marketing/campaigns/generate', { ...this.campaignForm.value, segment: this.segmentForm.value }).subscribe({
      next: (result) => {
        this.latestResult.set(result);
        this.load();
      },
      error: (error) => this.error.set(error?.error?.error || 'Unable to generate campaign')
    });
  }

  createWorkflow(): void {
    this.api.post<ApiRecord>('ai-marketing/retargeting-workflows', this.workflowForm.value).subscribe({
      next: (result) => {
        this.latestResult.set(result);
        this.load();
      },
      error: (error) => this.error.set(error?.error?.error || 'Unable to create workflow')
    });
  }

  createSequence(): void {
    this.api.post<ApiRecord>('ai-marketing/whatsapp-sequences', {
      name: this.sequenceForm.value.name,
      audienceRule: { tag: this.sequenceForm.value.tag, minVisits: this.sequenceForm.value.minVisits }
    }).subscribe({
      next: (result) => {
        this.latestResult.set(result);
        this.load();
      },
      error: (error) => this.error.set(error?.error?.error || 'Unable to create sequence')
    });
  }

  createEmailTemplate(): void {
    this.api.post<ApiRecord>('ai-marketing/email-templates', this.emailForm.value).subscribe({
      next: (result) => {
        this.latestResult.set({ emailTemplate: result.template, generation: result.generation });
        this.load();
      },
      error: (error) => this.error.set(error?.error?.error || 'Unable to create email template')
    });
  }

  festivalCampaign(): void {
    this.api.post<ApiRecord>('ai-marketing/festival-campaigns', { festival: this.emailForm.value.occasion || 'Festival Glow', segment: this.segmentForm.value }).subscribe({
      next: (result) => {
        this.latestResult.set(result);
        this.load();
      },
      error: (error) => this.error.set(error?.error?.error || 'Unable to generate festival campaign')
    });
  }
}
