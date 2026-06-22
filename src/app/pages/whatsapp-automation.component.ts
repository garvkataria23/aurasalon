import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';
import { AuraKpiCardComponent } from '../shared/ui/aura-kpi-card/aura-kpi-card.component';

@Component({
  selector: 'app-whatsapp-automation',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePipe, StateComponent, AuraKpiCardComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">WhatsApp automation engine</span>
          <h2>Auto replies, reminders, broadcasts, lead qualification and human handoff</h2>
          <p>Inbound and outbound WhatsApp activity is tenant-scoped, branch-aware and persisted as threads, messages, rules and handoffs.</p>
        </div>
        <button class="ghost-button" type="button" (click)="load()">Refresh engine</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="metrics-grid" *ngIf="summary() as summary">
        <aura-kpi-card tone="teal" target="/kpi-details/whatsapp/open-threads"><span>Open threads</span><strong>{{ summary.openThreads }}</strong><small>Active WhatsApp conversations</small></aura-kpi-card>
        <aura-kpi-card tone="red" target="/kpi-details/whatsapp/human-handoffs"><span>Human handoffs</span><strong>{{ summary.activeHandoffs }}</strong><small>Needs front-desk attention</small></aura-kpi-card>
        <aura-kpi-card tone="amber" target="/kpi-details/whatsapp/hot-leads"><span>Hot leads</span><strong>{{ summary.hotLeads }}</strong><small>Lead score 70+</small></aura-kpi-card>
        <aura-kpi-card tone="blue" target="/kpi-details/whatsapp/auto-replies"><span>Auto replies</span><strong>{{ summary.autoRepliesToday }}</strong><small>Sent today</small></aura-kpi-card>
        <aura-kpi-card tone="green" target="/kpi-details/whatsapp/broadcasts"><span>Broadcasts</span><strong>{{ summary.broadcastsToday }}</strong><small>Campaign messages today</small></aura-kpi-card>
        <aura-kpi-card tone="violet" target="/kpi-details/whatsapp/outbound-queue"><span>Outbound queue</span><strong>{{ summary.pendingOutbound }}</strong><small>Queued WhatsApp messages</small></aura-kpi-card>
        <aura-kpi-card tone="slate" target="/kpi-details/whatsapp/rules-active"><span>Rules active</span><strong>{{ summary.rulesActive }}</strong><small>Automation rules</small></aura-kpi-card>
        <aura-kpi-card tone="rose" target="/kpi-details/whatsapp/threads-stored"><span>Threads stored</span><strong>{{ threads().length }}</strong><small>Persisted conversations</small></aura-kpi-card>
      </div>

      <div class="ai-layout" *ngIf="!loading()">
        <section class="form-panel">
          <h3>Inbound auto reply and intent detection</h3>
          <form [formGroup]="inboundForm" (ngSubmit)="processInbound()">
            <label class="field"><span>Phone</span><input formControlName="phone" placeholder="+91 98765 00000" /></label>
            <label class="field"><span>Name</span><input formControlName="displayName" placeholder="Lead name" /></label>
            <label class="field">
              <span>Branch</span>
              <select formControlName="branchId">
                <option value="">Current scope</option>
                <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option>
              </select>
            </label>
            <label class="field full"><span>Incoming message</span><textarea formControlName="body"></textarea></label>
            <div class="form-actions">
              <button class="primary-button" type="submit" [disabled]="inboundForm.invalid || saving()">Process inbound</button>
              <button class="ghost-button" type="button" (click)="qualifyLead()" [disabled]="inboundForm.invalid || saving()">Qualify only</button>
            </div>
          </form>
        </section>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Automation workflows</span>
              <h2>Run operational WhatsApp jobs</h2>
            </div>
          </div>
          <form [formGroup]="actionForm" class="wa-action-form">
            <label class="field">
              <span>Appointment</span>
              <select formControlName="appointmentId">
                <option value="">Select appointment</option>
                <option *ngFor="let appointment of appointments()" [value]="appointment.id">
                  {{ clientName(appointment.clientId) }} · {{ appointment.startAt | date: 'short' }}
                </option>
              </select>
            </label>
            <label class="field">
              <span>Campaign</span>
              <select formControlName="campaignId">
                <option value="">Manual broadcast</option>
                <option *ngFor="let campaign of campaigns()" [value]="campaign.id">{{ campaign.name }}</option>
              </select>
            </label>
            <label class="field"><span>Hours ahead</span><input type="number" min="1" formControlName="hoursAhead" /></label>
            <label class="field"><span>Phone</span><input formControlName="phone" placeholder="Missed-call phone" /></label>
            <label class="field full"><span>Broadcast template</span><textarea formControlName="template"></textarea></label>
          </form>

          <div class="quick-grid">
            <button class="action-card command-card" type="button" (click)="bookingConfirmation()">
              <strong>Booking confirmation</strong><span>Send appointment confirmation.</span>
            </button>
            <button class="action-card command-card" type="button" (click)="reminders()">
              <strong>Reminder messages</strong><span>Queue reminders for upcoming bookings.</span>
            </button>
            <button class="action-card command-card" type="button" (click)="missedCall()">
              <strong>Missed-call follow-up</strong><span>Create a lead thread and callback text.</span>
            </button>
            <button class="action-card command-card" type="button" (click)="paymentReminders()">
              <strong>Payment reminders</strong><span>Queue messages for unpaid invoices.</span>
            </button>
            <button class="action-card command-card" type="button" (click)="birthdayWishes()">
              <strong>Birthday wishes</strong><span>Send birthday offer messages.</span>
            </button>
            <button class="action-card command-card" type="button" (click)="campaignBroadcast()">
              <strong>Campaign broadcasting</strong><span>Broadcast to saved segment clients.</span>
            </button>
          </div>
        </section>
      </div>

      <section class="panel" *ngIf="result() as result">
        <div class="section-title">
          <div>
            <span class="eyebrow">Last workflow result</span>
            <h2>{{ resultTitle(result) }}</h2>
          </div>
        </div>
        <div class="chip-row">
          <span class="badge" *ngIf="result.detection">intent {{ result.detection.intent }}</span>
          <span class="badge" *ngIf="result.qualification">score {{ result.qualification.score }}</span>
          <span class="badge" *ngIf="result.count !== undefined">{{ result.count }} messages</span>
          <span class="badge" *ngIf="result.handoff">handoff created</span>
        </div>
        <pre class="result-json">{{ result | json }}</pre>
      </section>

      <div class="dashboard-grid">
        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Conversation inbox</span>
              <h2>WhatsApp threads</h2>
            </div>
          </div>
          <div class="rank-list">
            <article *ngFor="let thread of threads()">
              <div>
                <strong>{{ thread.displayName || thread.phone }}</strong>
                <span>{{ thread.phone }} · {{ thread.intent }} · score {{ thread.leadScore }}</span>
                <small>{{ thread.lastMessagePreview || 'No messages yet' }}</small>
              </div>
              <div class="right">
                <strong>{{ thread.status }}</strong>
                <small>{{ thread.handoffStatus }}</small>
                <button class="ghost-button mini" type="button" (click)="openHandoff(thread.id)">Handoff</button>
              </div>
            </article>
            <article *ngIf="!threads().length"><strong>No WhatsApp threads</strong><span>Process an inbound message to start one.</span></article>
          </div>
        </section>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Human handoff</span>
              <h2>Escalation queue</h2>
            </div>
          </div>
          <div class="activity-list">
            <article *ngFor="let handoff of handoffs()">
              <div>
                <strong>{{ handoff.reason }}</strong>
                <span>{{ handoff.priority }} · {{ handoff.status }}</span>
                <small>{{ handoff.createdAt | date: 'short' }}</small>
              </div>
              <button class="ghost-button mini" type="button" (click)="resolveHandoff(handoff.id)" *ngIf="handoff.status !== 'resolved'">Resolve</button>
            </article>
            <article *ngIf="!handoffs().length"><strong>No handoffs</strong><span>Escalations will appear here.</span></article>
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="section-title">
          <div>
            <span class="eyebrow">Automation rules</span>
            <h2>WhatsApp rule library</h2>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rule</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Delay</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let rule of rules()">
                <td><strong>{{ rule.name }}</strong><small>{{ rule.template }}</small></td>
                <td>{{ rule.trigger }}</td>
                <td><span class="badge">{{ rule.status }}</span></td>
                <td>{{ rule.delayMinutes }} min</td>
                <td>{{ (rule.actions || []).join(', ') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `
})
export class WhatsAppAutomationComponent implements OnInit {
  readonly summary = signal<ApiRecord | null>(null);
  readonly threads = signal<ApiRecord[]>([]);
  readonly messages = signal<ApiRecord[]>([]);
  readonly rules = signal<ApiRecord[]>([]);
  readonly handoffs = signal<ApiRecord[]>([]);
  readonly appointments = signal<ApiRecord[]>([]);
  readonly campaigns = signal<ApiRecord[]>([]);
  readonly clients = signal<ApiRecord[]>([]);
  readonly branches = signal<ApiRecord[]>([]);
  readonly result = signal<ApiRecord | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly inboundForm = this.fb.group({
    phone: ['+91 98765 43120', Validators.required],
    displayName: ['Riya Sharma'],
    branchId: [''],
    body: ['Hi, can I book hair color tomorrow and know the price?', Validators.required]
  });

  readonly actionForm = this.fb.group({
    appointmentId: [''],
    campaignId: [''],
    hoursAhead: [48],
    phone: ['+91 90000 30303'],
    displayName: ['New missed call lead'],
    template: ['Hi {{name}}, your Aura Salon offer is waiting. Reply BOOK to reserve a slot.']
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    Promise.all([
      this.api.list<ApiRecord>('whatsapp/summary').toPromise(),
      this.api.list<ApiRecord[]>('whatsapp/threads').toPromise(),
      this.api.list<ApiRecord[]>('whatsapp/messages').toPromise(),
      this.api.list<ApiRecord[]>('whatsapp/rules').toPromise(),
      this.api.list<ApiRecord[]>('whatsapp/handoffs').toPromise(),
      this.api.list<ApiRecord[]>('appointments').toPromise(),
      this.api.list<ApiRecord[]>('marketing').toPromise(),
      this.api.list<ApiRecord[]>('clients').toPromise(),
      this.api.list<ApiRecord[]>('branches').toPromise()
    ])
      .then(([summary, threads, messages, rules, handoffs, appointments, campaigns, clients, branches]) => {
        this.summary.set(summary || null);
        this.threads.set(threads || []);
        this.messages.set(messages || []);
        this.rules.set(rules || []);
        this.handoffs.set(handoffs || []);
        this.appointments.set(appointments || []);
        this.campaigns.set(campaigns || []);
        this.clients.set(clients || []);
        this.branches.set(branches || []);
        if (!this.actionForm.value.appointmentId && appointments?.[0]?.id) this.actionForm.patchValue({ appointmentId: appointments[0].id });
        if (!this.actionForm.value.campaignId && campaigns?.[0]?.id) this.actionForm.patchValue({ campaignId: campaigns[0].id });
        this.loading.set(false);
      })
      .catch((error) => {
        this.error.set(error?.error?.error || 'Unable to load WhatsApp automation engine');
        this.loading.set(false);
      });
  }

  processInbound(): void {
    if (this.inboundForm.invalid) return;
    this.runWorkflow('whatsapp/inbound', this.inboundForm.value);
  }

  qualifyLead(): void {
    if (this.inboundForm.invalid) return;
    this.runWorkflow('whatsapp/qualify-lead', this.inboundForm.value);
  }

  bookingConfirmation(): void {
    const appointmentId = this.actionForm.value.appointmentId;
    if (!appointmentId) {
      this.error.set('Select an appointment first');
      return;
    }
    this.runWorkflow('whatsapp/booking-confirmation', { appointmentId });
  }

  reminders(): void {
    this.runWorkflow('whatsapp/reminders', { hoursAhead: Number(this.actionForm.value.hoursAhead || 24) });
  }

  missedCall(): void {
    this.runWorkflow('whatsapp/missed-call', {
      phone: this.actionForm.value.phone,
      displayName: this.actionForm.value.displayName
    });
  }

  paymentReminders(): void {
    this.runWorkflow('whatsapp/payment-reminders', {});
  }

  birthdayWishes(): void {
    this.runWorkflow('whatsapp/birthday-wishes', {});
  }

  campaignBroadcast(): void {
    this.runWorkflow('whatsapp/campaign-broadcast', {
      campaignId: this.actionForm.value.campaignId,
      template: this.actionForm.value.template
    });
  }

  openHandoff(threadId: string): void {
    this.runWorkflow('whatsapp/handoffs', {
      threadId,
      reason: 'Front desk follow-up requested from WhatsApp inbox',
      priority: 'normal'
    });
  }

  resolveHandoff(id: string): void {
    this.saving.set(true);
    this.api.patch(`whatsapp/handoffs/${id}`, { status: 'resolved', note: 'Resolved from console' }).subscribe({
      next: (result) => {
        this.result.set(result);
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to resolve handoff');
        this.saving.set(false);
      }
    });
  }

  runWorkflow(path: string, payload: ApiRecord): void {
    this.saving.set(true);
    this.error.set('');
    this.api.post<ApiRecord>(path, payload).subscribe({
      next: (result) => {
        this.result.set(result);
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to run WhatsApp workflow');
        this.saving.set(false);
      }
    });
  }

  clientName(clientId: string): string {
    return this.clients().find((client) => client.id === clientId)?.name || 'Client';
  }

  resultTitle(result: ApiRecord): string {
    if (result.detection) return 'Inbound processed';
    if (result.thread && result.message) return 'Message queued';
    if (result.count !== undefined) return 'Batch workflow complete';
    return 'Workflow complete';
  }
}
