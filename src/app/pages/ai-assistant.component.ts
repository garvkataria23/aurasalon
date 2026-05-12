import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

type AiTool = {
  id: string;
  title: string;
  description: string;
};

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe, DatePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">AI salon assistant</span>
          <h2>Booking, upsell, recommendations, chatbot, follow-ups and analytics intelligence</h2>
          <p>Every AI action is scoped to the current tenant and branch, uses saved salon data, and persists to interaction history.</p>
        </div>
        <button class="ghost-button" type="button" (click)="load()">Refresh context</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="tool-strip">
        <button
          type="button"
          *ngFor="let tool of tools"
          [class.active]="activeTool() === tool.id"
          (click)="selectTool(tool.id)"
        >
          <strong>{{ tool.title }}</strong>
          <span>{{ tool.description }}</span>
        </button>
      </div>

      <div class="ai-layout" *ngIf="!loading()">
        <section class="form-panel">
          <h3>{{ currentTool()?.title }}</h3>
          <form [formGroup]="form" (ngSubmit)="run()">
            <label class="field full">
              <span>Prompt</span>
              <textarea formControlName="prompt" [placeholder]="promptPlaceholder()"></textarea>
            </label>

            <label class="field" *ngIf="usesClient()">
              <span>Client</span>
              <select formControlName="clientId">
                <option value="">Auto detect / none</option>
                <option *ngFor="let client of clients()" [value]="client.id">{{ client.name }} - {{ client.phone }}</option>
              </select>
            </label>

            <label class="field" *ngIf="usesService()">
              <span>Service</span>
              <select formControlName="serviceId">
                <option value="">AI match</option>
                <option *ngFor="let service of services()" [value]="service.id">{{ service.name }} - {{ service.price | currency: 'INR':'symbol':'1.0-0' }}</option>
              </select>
            </label>

            <label class="field" *ngIf="usesBookingFields()">
              <span>Branch</span>
              <select formControlName="branchId">
                <option value="">Current scope</option>
                <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option>
              </select>
            </label>

            <label class="field" *ngIf="usesBookingFields()">
              <span>Staff</span>
              <select formControlName="staffId">
                <option value="">AI assign</option>
                <option *ngFor="let person of staff()" [value]="person.id">{{ person.name }}</option>
              </select>
            </label>

            <label class="field" *ngIf="usesBookingFields()">
              <span>Start time</span>
              <input type="datetime-local" formControlName="startAt" />
            </label>

            <label class="field" *ngIf="activeTool() === 'review-reply'">
              <span>Rating</span>
              <input type="number" min="1" max="5" formControlName="rating" />
            </label>

            <label class="field full" *ngIf="activeTool() === 'review-reply'">
              <span>Review text</span>
              <textarea formControlName="reviewText"></textarea>
            </label>

            <label class="field" *ngIf="activeTool() === 'marketing-caption' || activeTool() === 'follow-up'">
              <span>Channel</span>
              <select formControlName="channel">
                <option>WhatsApp</option>
                <option>SMS</option>
                <option>Email</option>
                <option>Instagram</option>
              </select>
            </label>

            <label class="field" *ngIf="activeTool() === 'marketing-caption'">
              <span>Offer</span>
              <input formControlName="offer" placeholder="20% off Hydra Facial this week" />
            </label>

            <label class="field check-line" *ngIf="activeTool() === 'appointment-booking'">
              <input type="checkbox" formControlName="confirmBooking" />
              <span>Create appointment now</span>
            </label>

            <label class="field check-line" *ngIf="activeTool() === 'follow-up'">
              <input type="checkbox" formControlName="saveNotification" />
              <span>Save as notification draft</span>
            </label>

            <div class="form-actions">
              <button class="primary-button" type="submit" [disabled]="running() || form.invalid">
                {{ running() ? 'Generating...' : 'Run AI workflow' }}
              </button>
            </div>
          </form>
        </section>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">AI output</span>
              <h2>{{ outputTitle() }}</h2>
            </div>
          </div>

          <div class="ai-output" *ngIf="result()?.output as output; else emptyOutput">
            <p *ngIf="output.message">{{ output.message }}</p>
            <p *ngIf="output.answer">{{ output.answer }}</p>
            <p *ngIf="output.reply">{{ output.reply }}</p>
            <p *ngIf="output.modelText">{{ output.modelText }}</p>

            <div class="chip-row" *ngIf="output.actions?.length">
              <span class="badge" *ngFor="let action of output.actions">{{ action }}</span>
              <span class="badge">confidence {{ output.confidence }}</span>
              <span class="badge">{{ output.model }}</span>
            </div>

            <div class="quick-grid" *ngIf="primaryList(output).length">
              <article class="action-card" *ngFor="let item of primaryList(output)">
                <strong>{{ item.name || item.title || item.clientName || item.risk || item.id }}</strong>
                <span>{{ item.reason || item.recommendedAction || item.message || item.category || item.type }}</span>
                <small *ngIf="item.price">{{ item.price | currency: 'INR':'symbol':'1.0-0' }}</small>
                <small *ngIf="item.score !== undefined">Risk score {{ item.score }} · {{ item.inactiveDays }} inactive days</small>
              </article>
            </div>

            <div class="summary-lines" *ngIf="output.appointmentDraft">
              <div><span>Client</span><strong>{{ output.appointmentDraft.clientName }}</strong></div>
              <div><span>Service</span><strong>{{ output.appointmentDraft.serviceName }}</strong></div>
              <div><span>Staff</span><strong>{{ output.appointmentDraft.staffName }}</strong></div>
              <div><span>Start</span><strong>{{ output.appointmentDraft.startAt | date: 'medium' }}</strong></div>
            </div>

            <pre>{{ output | json }}</pre>
          </div>

          <ng-template #emptyOutput>
            <div class="state loading">Choose a workflow and run the assistant.</div>
          </ng-template>
        </section>
      </div>

      <section class="panel">
        <div class="section-title">
          <div>
            <span class="eyebrow">Persisted AI history</span>
            <h2>Recent assistant interactions</h2>
          </div>
          <button class="ghost-button" type="button" (click)="loadHistory()">Refresh history</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Prompt</th>
                <th>Model</th>
                <th>Confidence</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of history()">
                <td><span class="badge">{{ item.type }}</span></td>
                <td><strong>{{ item.output?.title || item.prompt }}</strong><small>{{ item.prompt }}</small></td>
                <td>{{ item.model }}</td>
                <td>{{ item.confidence }}</td>
                <td>{{ item.createdAt | date: 'short' }}</td>
              </tr>
              <tr *ngIf="!history().length">
                <td colspan="5">No AI interactions saved yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `
})
export class AiAssistantComponent implements OnInit {
  readonly tools: AiTool[] = [
    { id: 'appointment-booking', title: 'AI booking', description: 'Draft or create an appointment' },
    { id: 'upsell', title: 'Upsell', description: 'POS add-ons and products' },
    { id: 'service-recommendation', title: 'Recommend', description: 'Match services to client need' },
    { id: 'chatbot', title: 'Chatbot', description: 'Ask about salon operations' },
    { id: 'follow-up', title: 'Follow-up', description: 'WhatsApp/SMS message' },
    { id: 'review-reply', title: 'Review reply', description: 'Reply to client reviews' },
    { id: 'marketing-caption', title: 'Captions', description: 'Campaign copy ideas' },
    { id: 'analytics-summary', title: 'Analytics', description: 'Executive summary' },
    { id: 'churn-prediction', title: 'Churn', description: 'Retention risk scoring' }
  ];

  readonly activeTool = signal('chatbot');
  readonly clients = signal<ApiRecord[]>([]);
  readonly services = signal<ApiRecord[]>([]);
  readonly branches = signal<ApiRecord[]>([]);
  readonly staff = signal<ApiRecord[]>([]);
  readonly history = signal<ApiRecord[]>([]);
  readonly result = signal<ApiRecord | null>(null);
  readonly loading = signal(true);
  readonly running = signal(false);
  readonly error = signal('');

  readonly form = this.fb.group({
    prompt: ['What should front desk focus on today?', Validators.required],
    clientId: [''],
    serviceId: [''],
    branchId: [''],
    staffId: [''],
    startAt: [this.localDateTime()],
    rating: [5],
    reviewText: [''],
    channel: ['WhatsApp'],
    offer: [''],
    confirmBooking: [false],
    saveNotification: [false]
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    Promise.all([
      this.api.list<ApiRecord[]>('clients', { branchId: this.api.selectedBranchId() }).toPromise(),
      this.api.list<ApiRecord[]>('services').toPromise(),
      this.api.list<ApiRecord[]>('branches').toPromise(),
      this.api.list<ApiRecord[]>('staff', { branchId: this.api.selectedBranchId() }).toPromise(),
      this.api.list<ApiRecord[]>('ai/history').toPromise()
    ])
      .then(([clients, services, branches, staff, history]) => {
        this.clients.set(clients || []);
        this.services.set(services || []);
        this.branches.set(branches || []);
        this.staff.set(staff || []);
        this.history.set(history || []);
        this.loading.set(false);
      })
      .catch((error) => {
        this.error.set(error?.error?.error || 'Unable to load AI assistant context');
        this.loading.set(false);
      });
  }

  loadHistory(): void {
    this.api.list<ApiRecord[]>('ai/history').subscribe({
      next: (history) => this.history.set(history),
      error: (error) => this.error.set(error?.error?.error || 'Unable to load AI history')
    });
  }

  selectTool(toolId: string): void {
    this.activeTool.set(toolId);
    this.result.set(null);
    const prompt = {
      'appointment-booking': 'Book a haircut for the selected client tomorrow afternoon.',
      upsell: 'Suggest relevant POS add-ons and retail products.',
      'service-recommendation': 'Recommend the best service for dull skin and low maintenance care.',
      chatbot: 'What should front desk focus on today?',
      'follow-up': 'Generate a warm post-visit WhatsApp follow-up.',
      'review-reply': 'Reply professionally to this review.',
      'marketing-caption': 'Create captions for a weekend salon offer.',
      'analytics-summary': 'Summarize the current business performance.',
      'churn-prediction': 'Find clients most likely to churn.'
    }[toolId] || 'Help with salon operations.';
    this.form.patchValue({ prompt });
  }

  run(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.running.set(true);
    this.error.set('');
    const value = this.form.value;
    this.api.post<ApiRecord>(`ai/${this.activeTool()}`, {
      ...value,
      startAt: value.startAt ? new Date(String(value.startAt)).toISOString() : '',
      rating: Number(value.rating || 5)
    }).subscribe({
      next: (result) => {
        this.result.set(result);
        this.running.set(false);
        this.loadHistory();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to run AI workflow');
        this.running.set(false);
      }
    });
  }

  currentTool(): AiTool | undefined {
    return this.tools.find((tool) => tool.id === this.activeTool());
  }

  outputTitle(): string {
    return this.result()?.output?.title || this.currentTool()?.title || 'Assistant result';
  }

  usesClient(): boolean {
    return ['appointment-booking', 'upsell', 'service-recommendation', 'follow-up'].includes(this.activeTool());
  }

  usesService(): boolean {
    return ['appointment-booking', 'upsell', 'service-recommendation', 'follow-up'].includes(this.activeTool());
  }

  usesBookingFields(): boolean {
    return this.activeTool() === 'appointment-booking';
  }

  promptPlaceholder(): string {
    return this.currentTool()?.description || 'Ask the assistant';
  }

  primaryList(output: ApiRecord): ApiRecord[] {
    return output.recommendations || output.suggestions || output.clients || output.captions?.map((caption: string) => ({ name: caption, reason: output.channel })) || [];
  }

  private localDateTime(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    now.setHours(now.getHours() + 2);
    return now.toISOString().slice(0, 16);
  }
}
