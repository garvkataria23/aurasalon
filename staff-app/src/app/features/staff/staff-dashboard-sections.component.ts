import { Component, EventEmitter, Input, Output } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DashboardAction, DashboardTool, StaffDashboardViewModel } from "./staff-dashboard.model";

@Component({
  selector: "aura-staff-dashboard-sections",
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="today-hero" aria-labelledby="today-heading">
      <div class="today-hero-copy">
        <p class="eyebrow">{{ viewModel.hero.eyebrow }}</p>
        <h1 id="today-heading">{{ viewModel.hero.title }}</h1>
        <p>{{ viewModel.hero.detail }}</p>
        <span class="shift-line"><b>Shift</b> {{ viewModel.hero.shift }}</span>
      </div>
      <div class="hero-action-stack" aria-label="Recommended next actions">
        @for (action of viewModel.hero.actions; track action.id) {
          @if (action.route) { <a class="button" [class.primary]="action.primary" [routerLink]="action.route">{{ action.label }}</a> }
          @else { <button type="button" class="link-button" [class.primary-action]="action.primary" [disabled]="!!pendingAction" (click)="actionSelected.emit(action)">{{ pendingLabel(action) }}</button> }
        }
      </div>
    </section>

    @if (viewModel.quickActions.length) {
      <section class="dashboard-section quick-section" aria-labelledby="quick-actions-heading">
        <div class="section-heading"><div><p class="eyebrow">Start here</p><h2 id="quick-actions-heading">Quick actions</h2></div></div>
        <div class="quick-action-grid">
          @for (action of viewModel.quickActions; track action.id) {
            @if (action.route) { <a [routerLink]="action.route"><span>{{ action.label }}</span><b aria-hidden="true">→</b></a> }
            @else { <button type="button" [disabled]="!!pendingAction" (click)="actionSelected.emit(action)"><span>{{ pendingLabel(action) }}</span><b aria-hidden="true">→</b></button> }
          }
        </div>
      </section>
    }

    <section class="dashboard-section" aria-labelledby="overview-heading">
      <div class="section-heading"><div><p class="eyebrow">At a glance</p><h2 id="overview-heading">Today overview</h2></div></div>
      <div class="overview-grid">
        @for (metric of viewModel.overview; track metric.label) {
          @if (metric.route) { <a class="overview-card" [routerLink]="metric.route"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small>{{ metric.hint }}</small></a> }
          @else { <article class="overview-card"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small>{{ metric.hint }}</small></article> }
        }
      </div>
    </section>

    <section class="dashboard-section" aria-labelledby="next-work-heading">
        <div class="section-heading"><div><p class="eyebrow">On the floor</p><h2 id="next-work-heading">{{ viewModel.work.mode === 'active' ? 'Current service' : 'Next work' }}</h2></div>@if (viewModel.work.queueRoute; as queueRoute) { <a [routerLink]="queueRoute">Open queue</a> }</div>
      <article class="next-work-card" [class.active-work]="viewModel.work.mode === 'active'">
        <div class="work-time"><span>{{ viewModel.work.eyebrow }}</span><b>{{ viewModel.work.meta }}</b></div>
        <div class="work-main"><h3>{{ viewModel.work.title }}</h3><p>{{ viewModel.work.detail }}</p>
          @if (viewModel.work.progress !== undefined) { <div class="timer-track" aria-label="Service progress"><span [style.width.%]="viewModel.work.progress"></span></div> }
        </div>
        <div class="work-actions">
          @if (viewModel.work.clientRoute) { <a class="button" [routerLink]="viewModel.work.clientRoute">Client details</a> }
          @if (viewModel.work.action; as action) { <button type="button" class="link-button primary-action" [disabled]="!!pendingAction" (click)="actionSelected.emit(action)">{{ pendingLabel(action) }}</button> }
          @if (viewModel.work.mode === 'empty' && viewModel.work.scheduleRoute; as scheduleRoute) { <a class="button" [routerLink]="scheduleRoute">View schedule</a> }
        </div>
      </article>
    </section>

    @if (viewModel.alerts.length) {
      <section class="dashboard-section" aria-labelledby="priority-heading">
        <div class="section-heading"><div><p class="eyebrow alert-eyebrow">Needs attention</p><h2 id="priority-heading">Priority feed</h2></div></div>
        <div class="priority-list">
          @for (alert of viewModel.alerts; track alert.id) {
            <a [routerLink]="alert.route" [class.critical]="alert.tone === 'critical'"><i aria-hidden="true"></i><div><strong>{{ alert.title }}</strong><small>{{ alert.detail }}</small></div><b aria-hidden="true">→</b></a>
          }
        </div>
      </section>
    }

    @if (viewModel.coach.length) {
      <section class="dashboard-section" aria-labelledby="coach-heading">
        <div class="section-heading"><div><p class="eyebrow">Actionable guidance</p><h2 id="coach-heading">AI coach</h2></div><a routerLink="/staff/ai-coach">View coach</a></div>
        <div class="coach-list">
          @for (card of viewModel.coach; track card.title) {
            <article><div><span>{{ $index + 1 }}</span><h3>{{ card.title }}</h3></div><p>{{ card.body }}</p><a [routerLink]="card.route">{{ card.action || 'Review suggestion' }} <b aria-hidden="true">→</b></a></article>
          }
        </div>
      </section>
    }

    @if (viewModel.performance.length) {
      <section class="dashboard-section performance-section" aria-labelledby="performance-heading">
        <div class="section-heading"><div><p class="eyebrow">Your progress</p><h2 id="performance-heading">Performance summary</h2></div><a routerLink="/staff/performance">View details</a></div>
        <div class="performance-grid">
          @for (metric of viewModel.performance; track metric.label) {
            <article><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small>{{ metric.hint }}</small></article>
          }
        </div>
      </section>
    }

    @if (viewModel.availableTools.length) {
      <section class="dashboard-section more-tools" aria-labelledby="tools-heading">
        <div class="section-heading"><div><p class="eyebrow">Workspace</p><h2 id="tools-heading">More tools</h2></div><button type="button" class="text-control" [attr.aria-expanded]="customizerOpen" (click)="customizerToggled.emit()">Customize</button></div>
        @if (viewModel.tools.length) {
          <div class="tool-grid">@for (tool of viewModel.tools; track tool.id) { <a [routerLink]="tool.route"><strong>{{ tool.label }}</strong><small>{{ tool.hint }}</small><b aria-hidden="true">→</b></a> }</div>
        } @else { <p class="compact-empty">All optional tools are hidden. Use Customize to restore them.</p> }
        @if (customizerOpen) {
          <div class="tool-customizer" aria-label="Dashboard tool visibility">
            @for (tool of viewModel.availableTools; track tool.id) { <div><button type="button" [attr.aria-pressed]="isToolVisible(tool)" (click)="toolToggled.emit(tool.id)">{{ isToolVisible(tool) ? 'Hide' : 'Show' }} {{ tool.label }}</button><button type="button" [disabled]="$first" (click)="toolMoved.emit(tool.id)" [attr.aria-label]="'Move ' + tool.label + ' earlier'">↑</button></div> }
          </div>
        }
      </section>
    }

    @if (viewModel.empty) { <section class="dashboard-empty"><strong>Your floor is clear.</strong><p>No active work, urgent items, or open tasks are assigned right now.</p>@if (viewModel.work.scheduleRoute; as scheduleRoute) { <a class="button" [routerLink]="scheduleRoute">Check appointments</a> }</section> }
  `,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffDashboardSectionsComponent {
  @Input({ required: true }) viewModel!: StaffDashboardViewModel;
  @Input() pendingAction = "";
  @Input() customizerOpen = false;
  @Input() hiddenToolIds: ReadonlySet<string> = new Set();
  @Output() readonly actionSelected = new EventEmitter<DashboardAction>();
  @Output() readonly customizerToggled = new EventEmitter<void>();
  @Output() readonly toolToggled = new EventEmitter<string>();
  @Output() readonly toolMoved = new EventEmitter<string>();

  pendingLabel(action: DashboardAction): string {
    return this.pendingAction === action.id || this.pendingAction === action.appointmentId ? "Saving…" : action.label;
  }

  isToolVisible(tool: DashboardTool): boolean {
    return !this.hiddenToolIds.has(tool.id);
  }
}
