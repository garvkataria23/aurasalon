import { DatePipe } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { isQueuedMutation, MutationResult, StaffAppService, StaffToday } from "../../core/staff-app.service";
import { StaffPageStateComponent } from "./staff-page-state.component";

@Component({
  standalone: true,
  imports: [DatePipe, StaffPageStateComponent],
  template: `
    <section class="page tasks-page">
      <header class="page-head"><div><p class="eyebrow">Tasks</p><h1>Task management</h1><p>Assigned checklist and completion workspace.</p></div></header>
      @if (!canReadTasks()) { <section staffPageState class="notice">You do not have permission to read staff tasks.</section> }
      @if (loading()) { <section staffPageState class="state" [loading]="true">Loading tasks...</section> }
      @if (message()) { <section staffPageState class="notice success">{{ message() }}</section> }
      @if (localError()) { <section staffPageState class="notice">{{ localError() }}</section> }
      @if (staff.error() && !localError()) { <section staffPageState class="notice">{{ staff.error() }}</section> }
      @if (canReadTasks() && today(); as data) {
        <section class="grid four task-overview"><article class="kpi task-kpi task-kpi-today"><span>Today</span><strong>{{ data.tasks.length }}</strong></article><article class="kpi task-kpi task-kpi-open"><span>Open</span><strong>{{ taskCount('open') }}</strong></article><article class="kpi task-kpi task-kpi-progress"><span>In progress</span><strong>{{ taskCount('in_progress') }}</strong></article><article class="kpi task-kpi task-kpi-done"><span>Done</span><strong>{{ taskCount('completed') }}</strong></article></section>
        <section class="kanban-board">
          @for (column of columns; track column.status) {
            <article class="panel kanban-column status-{{ column.status }}" (dragover)="$event.preventDefault()" (drop)="dropTask(column.status)">
              <div class="panel-title"><h2>{{ column.label }}</h2><span>{{ taskCount(column.status) }}</span></div>
              <div class="list">
                @for (task of tasksByStatus(column.status); track task.id) {
                   <div class="kanban-card" draggable="true" (dragstart)="dragTask(task.id, task.version)"><strong>{{ task.title }}</strong><small>{{ task.priority || 'medium' }} · {{ task.dueAt ? (task.dueAt | date:'short') : 'no due date' }}</small><div class="row-actions"><span class="badge task-status">{{ task.status || 'open' }}</span>@if (canUpdateTasks() && (!task.status || task.status === 'open')) { <button type="button" class="link-button" [disabled]="!!pendingTaskId()" (click)="moveTask(task.id, task.version, 'in_progress')">Start</button> } @if (canUpdateTasks() && task.status === 'in_progress') { <button type="button" class="link-button" [disabled]="!!pendingTaskId()" (click)="completeTask(task.id, task.version)">Done</button> } @if (canUpdateTasks() && task.status === 'completed') { <button type="button" class="link-button" [disabled]="!!pendingTaskId()" (click)="moveTask(task.id, task.version, 'open')">Reopen</button> }</div></div>
                } @empty { <p class="empty">No {{ column.label.toLowerCase() }} tasks.</p> }
              </div>
            </article>
          }
        </section>
      }
    </section>
  `,
  styleUrls: ["./staff-app.styles.css"],
  styles: [`
    :host { display: block; }
    .tasks-page { max-width: 1240px; gap: 18px; }
    .task-overview { gap: 9px; }
    .task-kpi { --task-accent: var(--staff-text-secondary); position: relative; min-height: 88px; overflow: hidden; padding: 14px 16px; border-radius: 17px; box-shadow: none; }
    .task-kpi::before { position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--task-accent); content: ""; }
    .task-kpi span { letter-spacing: .075em; }
    .task-kpi strong { margin-top: 6px; font-size: clamp(1.45rem, 2.5vw, 1.85rem); line-height: 1; }
    .task-kpi-today { --task-accent: var(--staff-text); }
    .task-kpi-open { --task-accent: var(--staff-warning); }
    .task-kpi-progress { --task-accent: var(--staff-primary); }
    .task-kpi-done { --task-accent: var(--staff-success); }
    .kanban-board { gap: 10px; }
    .kanban-column { --task-accent: var(--staff-text-secondary); min-height: 250px; padding: 14px; border-radius: 18px; border-top: 3px solid var(--task-accent); background: color-mix(in srgb, var(--staff-surface-secondary) 55%, var(--staff-surface)); box-shadow: none; }
    .kanban-column.status-in_progress { --task-accent: var(--staff-primary); }
    .kanban-column.status-completed { --task-accent: var(--staff-success); }
    .kanban-column .panel-title { min-height: 30px; margin-bottom: 8px; }
    .kanban-column .panel-title h2 { font-size: .92rem; }
    .kanban-column .panel-title span { display: grid; place-items: center; min-width: 26px; height: 26px; padding-inline: 7px; border-radius: 999px; background: var(--staff-surface); color: var(--task-accent); font-size: .7rem; }
    .kanban-card { gap: 7px; margin-top: 7px; padding: 13px; border-radius: 15px; background: var(--staff-surface); box-shadow: 0 4px 14px rgba(17, 27, 33, .045); cursor: grab; transition: border-color var(--staff-motion-fast) var(--staff-motion-ease), transform var(--staff-motion-fast) var(--staff-motion-ease), box-shadow var(--staff-motion-fast) var(--staff-motion-ease); }
    .kanban-card:active { cursor: grabbing; }
    .kanban-card strong { overflow-wrap: anywhere; font-size: .88rem; line-height: 1.35; }
    .kanban-card small { margin-top: 0; font-size: .7rem; font-weight: 600; line-height: 1.4; }
    .kanban-card .row-actions { justify-content: space-between; margin-top: 2px; }
    .kanban-card .link-button { min-height: 40px; border-radius: 12px; padding: 8px 12px; font-size: .72rem; }
    .task-status { padding: 5px 8px; background: color-mix(in srgb, var(--task-accent) 10%, var(--staff-surface)); color: var(--task-accent); font-size: .64rem; }
    .kanban-column .empty { display: grid; place-items: center; min-height: 148px; margin-top: 7px; border: 1px dashed var(--staff-border); border-radius: 14px; padding: 16px 10px; font-size: .74rem; line-height: 1.35; }
    @media (hover: hover) and (pointer: fine) {
      .kanban-card:hover { transform: translateY(-2px); border-color: var(--staff-border-accent); box-shadow: 0 8px 20px rgba(17, 27, 33, .07); }
    }
    @media (max-width: 700px) {
      .tasks-page { gap: 10px; padding-inline: 12px; }
      .tasks-page > .task-overview.grid.four { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
      .task-kpi { min-height: 70px; padding: 10px 12px; border-radius: 14px; }
      .task-kpi strong { margin-top: 4px; font-size: 1.35rem; }
      .tasks-page .kanban-board { grid-template-columns: 1fr; gap: 8px; }
      .tasks-page .kanban-column { min-height: 0; padding: 11px; border-radius: 15px; }
      .tasks-page .kanban-column .panel-title { min-height: 28px; margin-bottom: 4px; }
      .tasks-page .kanban-column .panel-title h2 { font-size: .82rem; }
      .tasks-page .kanban-column .empty { min-height: 62px; margin-top: 4px; padding: 10px; font-size: .68rem; }
      .tasks-page .kanban-card { gap: 6px; margin-top: 6px; padding: 11px; border-radius: 13px; }
      .tasks-page .kanban-card strong { font-size: .8rem; }
      .tasks-page .kanban-card small { font-size: .65rem; }
      .tasks-page .kanban-card .link-button { min-height: 44px; padding: 8px 13px; font-size: .7rem; }
    }
    @media (max-width: 340px) {
      .tasks-page { padding-inline: 10px; }
      .task-kpi { padding-inline: 10px; }
      .task-kpi span { font-size: .55rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      .kanban-card { transition: none; }
      .kanban-card:hover { transform: none; }
    }
  `]
})
export class StaffTasksPage implements OnInit {
  readonly today = signal<StaffToday | null>(null);
  readonly loading = signal(false);
  readonly message = signal("");
  readonly localError = signal("");
  readonly pendingTaskId = signal("");
  readonly draggedTask = signal<{ id: string; version: number } | null>(null);
  readonly columns = [{ label: "Open", status: "open" }, { label: "In Progress", status: "in_progress" }, { label: "Done", status: "completed" }];
  constructor(readonly staff: StaffAppService) {}
  ngOnInit() { if (this.canReadTasks()) void this.load(); }
  async load() { this.loading.set(true); try { this.today.set(await this.staff.today()); } finally { this.loading.set(false); } }
  canReadTasks(): boolean { return this.staff.hasPermission("read:staff"); }
  canUpdateTasks(): boolean { return this.staff.hasAnyPermission(["write:staff", "update:staff"]); }
  taskCount(status: string): number { return this.tasksByStatus(status).length; }
  tasksByStatus(status: string) { return (this.today()?.tasks || []).filter((task) => status === "open" ? !task.status || task.status === "open" : task.status === status); }
  dragTask(id: string, version: number) { this.draggedTask.set({ id, version }); }
  async dropTask(status: string) { const task = this.draggedTask(); if (!task || !this.canUpdateTasks()) return; await this.mutateTask(task.id, () => this.staff.moveTask(task.id, task.version, status), `Task moved to ${status.replace(/_/g, " ")}.`); this.draggedTask.set(null); }
  async moveTask(taskId: string, version: number, status: string) { await this.mutateTask(taskId, () => this.staff.moveTask(taskId, version, status), `Task moved to ${status.replace(/_/g, " ")}.`); }
  async completeTask(taskId: string, version: number) { await this.mutateTask(taskId, () => this.staff.completeTask(taskId, version), "Task completed."); }
  private async mutateTask(taskId: string, mutate: () => Promise<MutationResult<unknown>>, completedMessage: string) {
    if (this.pendingTaskId()) return;
    this.pendingTaskId.set(taskId);
    this.message.set("");
    this.localError.set("");
    try {
      const result = await mutate();
      if (isQueuedMutation(result)) { this.message.set(`Offline task change queued for sync (${result.queueId}).`); return; }
      this.message.set(completedMessage);
      await this.load();
    } catch { this.localError.set(this.staff.error() || "Unable to update the task."); }
    finally { this.pendingTaskId.set(""); }
  }
}
