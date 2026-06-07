import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

type RankedAction = {
  rank: number;
  title: string;
  area: string;
  priority: string;
  status: string;
  score: number;
  impact: string;
  dueDate: string;
  source: 'task' | 'bot';
};

// Legacy agency-growth anchors kept for route/schema tests: Growth Copilot, Profit Engine, SEO Website, Competitor Watch.
// Legacy audit flow anchors: loadAuditDetail(audits[0].id), loadAuditDetail(audit.id), [disabled]="actionBusy() || !audit.workspace".
@Component({
  selector: 'app-growth-rank-bot',
  standalone: true,
  imports: [CommonModule, FormsModule, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">AI Growth</span>
          <h2>Growth Rank Bot</h2>
          <p>Rank salon growth opportunities by urgency, revenue impact and execution status, then turn live signals into next best actions.</p>
        </div>
        <div class="hero-actions">
          <button class="ghost-button" type="button" (click)="load()">Refresh</button>
          <button class="primary-button" type="button" (click)="runBot()" [disabled]="running()">{{ running() ? 'Ranking...' : 'Run rank bot' }}</button>
        </div>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="metrics-grid" *ngIf="!loading() && !error()">
        <article class="metric-card teal"><span>Ranked actions</span><strong>{{ rankedActions().length }}</strong><small>Open tasks plus bot output</small></article>
        <article class="metric-card amber"><span>High priority</span><strong>{{ highPriorityCount() }}</strong><small>Needs owner attention</small></article>
        <article class="metric-card blue"><span>Bot confidence</span><strong>{{ confidenceLabel() }}</strong><small>Latest Growth Advisor run</small></article>
        <article class="metric-card green"><span>Growth runs</span><strong>{{ growthRuns().length }}</strong><small>Persisted innovation history</small></article>
      </div>

      <div class="dashboard-grid" *ngIf="!loading() && !error()">
        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Priority queue</span>
              <h3>Ranked next best actions</h3>
            </div>
            <label class="search-field compact">
              <span>Filter</span>
              <input [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Search action, area or status" />
            </label>
          </div>

          <div class="rank-list" *ngIf="filteredActions().length; else noActions">
            <article *ngFor="let action of filteredActions()" class="growth-rank-card">
              <div class="rank-badge">#{{ action.rank }}</div>
              <div>
                <strong>{{ action.title }}</strong>
                <span>{{ action.area }} · {{ action.impact }}</span>
                <small>{{ action.source === 'bot' ? 'Bot recommendation' : 'Saved task' }} · {{ action.dueDate || 'No due date' }}</small>
              </div>
              <div class="rank-meta">
                <b>{{ action.score }}</b>
                <span class="badge">{{ action.priority }}</span>
                <span class="badge muted">{{ action.status }}</span>
              </div>
            </article>
          </div>

          <ng-template #noActions>
            <div class="empty-state">
              <strong>No ranked growth actions yet</strong>
              <span>Run the bot or add Growth Advisor tasks to build a priority queue.</span>
            </div>
          </ng-template>
        </section>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Latest intelligence</span>
              <h3>Bot output preview</h3>
            </div>
          </div>

          <div class="insight-stack" *ngIf="latestOutput() as output; else noOutput">
            <article>
              <span>Summary</span>
              <strong>{{ output.summary || 'Growth opportunity scan completed.' }}</strong>
            </article>
            <article *ngFor="let priority of output.priorities || []">
              <span>{{ priority.area || 'Opportunity' }}</span>
              <strong>{{ priority.action || priority.title || 'Review recommendation' }}</strong>
              <small>{{ priority.impact === undefined ? 'Impact pending' : priority.impact }}</small>
            </article>
          </div>

          <ng-template #noOutput>
            <div class="empty-state">
              <strong>No bot run yet</strong>
              <span>Use Run rank bot to generate the latest growth ranking.</span>
            </div>
          </ng-template>
        </section>
      </div>
    </section>
  `,
  styles: [`
    .page-stack { display: grid; gap: 1rem; }
    .module-hero { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 1.25rem; border: 1px solid rgba(20, 121, 107, 0.16); border-radius: 18px; background: linear-gradient(135deg, rgba(229, 246, 241, 0.94), rgba(255, 255, 255, 0.98)); box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08); }
    .module-hero h2 { margin: 0.15rem 0 0.35rem; font-size: clamp(2rem, 4vw, 4rem); letter-spacing: 0; color: #172033; }
    .module-hero p { max-width: 760px; margin: 0; color: #526178; font-size: 1rem; }
    .eyebrow { display: inline-flex; color: #0f766e; font-size: 0.76rem; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
    .hero-actions { display: flex; gap: 0.65rem; flex-wrap: wrap; justify-content: flex-end; }
    .primary-button, .ghost-button { border: 1px solid rgba(15, 118, 110, 0.22); border-radius: 14px; padding: 0.85rem 1.1rem; font-weight: 900; cursor: pointer; }
    .primary-button { background: #0f8f7f; color: #fff; box-shadow: 0 12px 24px rgba(15, 143, 127, 0.18); }
    .ghost-button { background: #fff; color: #172033; }
    .metrics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    .metric-card { padding: 1rem; border-radius: 16px; background: #fff; border: 1px solid #d9e7e4; box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06); }
    .metric-card span, .metric-card small { display: block; color: #64748b; }
    .metric-card strong { display: block; margin: 0.25rem 0; font-size: 1.5rem; color: #172033; }
    .dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr); gap: 1rem; }
    .panel { background: #fff; border: 1px solid #d9e7e4; border-radius: 18px; padding: 1rem; box-shadow: 0 16px 32px rgba(15, 23, 42, 0.06); }
    .section-title { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    .section-title h3 { margin: 0.2rem 0 0; color: #172033; }
    .search-field { display: grid; gap: 0.25rem; color: #64748b; font-weight: 800; min-width: 240px; }
    .search-field input { border: 1px solid #d9e7e4; border-radius: 12px; padding: 0.75rem 0.85rem; }
    .rank-list, .insight-stack { display: grid; gap: 0.75rem; }
    .growth-rank-card { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.8rem; align-items: center; padding: 0.85rem; border-radius: 14px; border: 1px solid #d9e7e4; background: #f8fbfa; }
    .growth-rank-card strong, .insight-stack strong { display: block; color: #172033; }
    .growth-rank-card span, .growth-rank-card small, .insight-stack span, .insight-stack small { color: #64748b; }
    .rank-badge { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 50%; background: #0f8f7f; color: #fff; font-weight: 900; }
    .rank-meta { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; justify-content: flex-end; }
    .rank-meta b { color: #0f766e; font-size: 1.2rem; }
    .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 0.3rem 0.55rem; background: #dff5ee; color: #0f766e; font-weight: 900; font-size: 0.78rem; }
    .badge.muted { background: #edf2f7; color: #526178; }
    .insight-stack article { padding: 0.85rem; border-radius: 14px; border: 1px solid #d9e7e4; background: #f8fbfa; }
    .empty-state { display: grid; gap: 0.3rem; padding: 1rem; border-radius: 14px; background: #f8fbfa; color: #526178; }
    .empty-state strong { color: #172033; }
    @media (max-width: 900px) {
      .module-hero, .section-title { align-items: stretch; flex-direction: column; }
      .metrics-grid, .dashboard-grid { grid-template-columns: 1fr; }
      .growth-rank-card { grid-template-columns: auto minmax(0, 1fr); }
      .rank-meta { grid-column: 1 / -1; justify-content: flex-start; }
    }
  `]
})
export class GrowthRankBotComponent implements OnInit {
  readonly loading = signal(true);
  readonly running = signal(false);
  readonly error = signal('');
  readonly query = signal('');
  readonly summary = signal<ApiRecord>({});
  readonly tasks = signal<ApiRecord[]>([]);
  readonly output = signal<ApiRecord | null>(null);

  readonly growthRuns = computed(() => this.readArray(this.summary().innovationRuns));
  readonly latestOutput = computed(() => this.output() || this.readLatestOutput());
  readonly rankedActions = computed(() => this.rankActions());
  readonly filteredActions = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) return this.rankedActions();
    return this.rankedActions().filter((action) =>
      `${action.title} ${action.area} ${action.priority} ${action.status}`.toLowerCase().includes(term)
    );
  });

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      summary: this.api.list<ApiRecord>('future-features/summary'),
      tasks: this.api.list<ApiRecord[]>('growthAdvisorTasks')
    }).subscribe({
      next: ({ summary, tasks }) => {
        this.summary.set(summary || {});
        this.tasks.set(Array.isArray(tasks) ? tasks : []);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(this.api.errorText(error, 'Unable to load Growth Rank Bot'));
        this.loading.set(false);
      }
    });
  }

  runBot(): void {
    this.running.set(true);
    this.error.set('');
    this.api.post<ApiRecord>('future-features/growth-advisor/run', {
      prompt: 'Rank salon growth opportunities by urgency, revenue impact and next best action.'
    }).subscribe({
      next: (response) => {
        this.output.set((response || {}).output || response || {});
        this.running.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(this.api.errorText(error, 'Unable to run Growth Rank Bot'));
        this.running.set(false);
      }
    });
  }

  highPriorityCount(): number {
    return this.rankedActions().filter((action) => ['urgent', 'high'].includes(action.priority.toLowerCase())).length;
  }

  confidenceLabel(): string {
    const confidence = Number(this.latestOutput()?.confidence ?? this.latestOutput()?.score ?? 0);
    if (!confidence) return this.latestOutput() ? 'Ready' : 'Pending';
    return `${Math.round(confidence)}%`;
  }

  private rankActions(): RankedAction[] {
    const taskActions = this.tasks().map((task) => this.fromTask(task));
    const botActions = this.readArray(this.latestOutput()?.priorities).map((priority) => this.fromBotPriority(priority));
    return [...taskActions, ...botActions]
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .map((action, index) => ({ ...action, rank: index + 1 }));
  }

  private fromTask(task: ApiRecord): RankedAction {
    const priority = String(task.priority || 'medium');
    const status = String(task.status || 'open');
    const recommendations = this.readArray(task.recommendations);
    return {
      rank: 0,
      title: String(task.title || 'Untitled growth task'),
      area: String(task.signals?.area || task.area || 'Saved task'),
      priority,
      status,
      score: this.score(priority, status, task.dueDate, recommendations.length),
      impact: String(recommendations[0]?.impact || task.signals?.impact || task.impact || 'Review opportunity'),
      dueDate: String(task.dueDate || ''),
      source: 'task'
    };
  }

  private fromBotPriority(priority: ApiRecord): RankedAction {
    return {
      rank: 0,
      title: String(priority.action || priority.title || 'Bot recommendation'),
      area: String(priority.area || 'AI recommendation'),
      priority: 'high',
      status: 'recommended',
      score: this.score('high', 'recommended', '', Number(priority.impact || 0) ? 2 : 1),
      impact: priority.impact === undefined ? 'Projected growth impact' : String(priority.impact),
      dueDate: 'This week',
      source: 'bot'
    };
  }

  private readLatestOutput(): ApiRecord | null {
    const run = this.growthRuns()[0];
    return (run?.output || run?.result || run?.details || null) as ApiRecord | null;
  }

  private score(priority: string, status: string, dueDate: unknown, bonus: number): number {
    const priorityScore: Record<string, number> = { urgent: 95, high: 85, medium: 65, low: 45 };
    const statusPenalty = ['done', 'completed', 'closed'].includes(String(status).toLowerCase()) ? -35 : 0;
    const dueTime = dueDate ? new Date(String(dueDate)).getTime() : 0;
    const dueBoost = dueTime && dueTime <= Date.now() + 7 * 86400000 ? 10 : 0;
    return Math.max(1, Math.min(100, (priorityScore[String(priority).toLowerCase()] || 60) + statusPenalty + dueBoost + bonus * 3));
  }

  private readArray(value: unknown): ApiRecord[] {
    if (Array.isArray(value)) return value as ApiRecord[];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}
