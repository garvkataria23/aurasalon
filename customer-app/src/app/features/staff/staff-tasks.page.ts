import { DatePipe } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffEnterpriseOs, StaffToday } from "../../core/staff-app.service";

@Component({
  standalone: true,
  imports: [DatePipe, IonSpinner],
  template: `
    <section class="page">
      <header class="page-head"><div><p class="eyebrow">Tasks</p><h1>Task management</h1><p>Assigned checklist and completion workspace.</p></div></header>
      @if (!canReadTasks()) { <section class="notice">You do not have permission to read staff tasks.</section> }
      @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading tasks...</section> }
      @if (message()) { <section class="notice success">{{ message() }}</section> }
      @if (staff.error()) { <section class="notice">{{ staff.error() }}</section> }
      @if (canReadTasks() && today(); as data) {
        <section class="grid four"><article class="kpi"><span>Today</span><strong>{{ data.tasks.length }}</strong></article><article class="kpi"><span>Open</span><strong>{{ taskCount('open') }}</strong></article><article class="kpi"><span>In progress</span><strong>{{ taskCount('in_progress') }}</strong></article><article class="kpi"><span>Done</span><strong>{{ taskCount('completed') }}</strong></article></section>
        <section class="kanban-board">
          @for (column of columns; track column.status) {
            <article class="panel kanban-column" (dragover)="$event.preventDefault()" (drop)="dropTask(column.status)">
              <div class="panel-title"><h2>{{ column.label }}</h2><span>{{ taskCount(column.status) }}</span></div>
              <div class="list">
                @for (task of tasksByStatus(column.status); track task.id) {
                  <div class="kanban-card" draggable="true" (dragstart)="dragTask(task.id, task.version)"><strong>{{ task.title }}</strong><small>{{ task.priority || 'medium' }} · {{ task.dueAt ? (task.dueAt | date:'short') : 'no due date' }}</small><div class="row-actions"><span class="badge">{{ task.status }}</span>@if (canUpdateTasks() && task.status !== 'completed') { <button type="button" class="link-button" (click)="completeTask(task.id, task.version)">Done</button> }</div></div>
                } @empty { <p class="empty">No {{ column.label.toLowerCase() }} tasks.</p> }
              </div>
            </article>
          }
        </section>
      }
    </section>
  `,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffTasksPage implements OnInit {
  readonly today = signal<StaffToday | null>(null);
  readonly os = signal<StaffEnterpriseOs | null>(null);
  readonly loading = signal(false);
  readonly message = signal("");
  readonly draggedTask = signal<{ id: string; version: number } | null>(null);
  readonly columns = [{ label: "Open", status: "open" }, { label: "In Progress", status: "in_progress" }, { label: "Done", status: "completed" }];
  constructor(readonly staff: StaffAppService) {}
  ngOnInit() { if (this.canReadTasks()) void this.load(); }
  async load() { this.loading.set(true); try { const [today, os] = await Promise.all([this.staff.today(), this.staff.enterpriseOs()]); this.today.set(today); this.os.set(os); } finally { this.loading.set(false); } }
  canReadTasks(): boolean { return this.staff.hasPermission("read:staff"); }
  canUpdateTasks(): boolean { return this.staff.hasAnyPermission(["write:staff", "update:staff"]); }
  openTasks(): number { return (this.today()?.tasks || []).filter((task) => task.status !== "completed").length; }
  taskCount(status: string): number { return this.tasksByStatus(status).length; }
  tasksByStatus(status: string) { return (this.today()?.tasks || []).filter((task) => status === "open" ? !task.status || task.status === "open" : task.status === status); }
  dragTask(id: string, version: number) { this.draggedTask.set({ id, version }); }
  async dropTask(status: string) { const task = this.draggedTask(); if (!task || !this.canUpdateTasks()) return; await this.staff.moveTask(task.id, task.version, status); this.draggedTask.set(null); this.message.set(`Task moved to ${status.replace(/_/g, " ")}.`); await this.load(); }
  async completeTask(taskId: string, version: number) { await this.staff.completeTask(taskId, version).then(() => { this.message.set("Task completed."); return this.load(); }); }
}
