import { DatePipe } from "@angular/common";
import { Component, OnInit, computed, signal } from "@angular/core";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffAttendance, StaffToday } from "../../core/staff-app.service";

@Component({
  standalone: true,
  imports: [DatePipe, IonSpinner],
  template: `
    <section class="page">
      <header class="page-head"><div><p class="eyebrow">Attendance</p><h1>Attendance</h1><p>Clock-in, break, and clock-out controls.</p></div></header>
      @if (!canUseAttendance()) { <section class="notice">You do not have permission to use attendance controls.</section> }
      @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading attendance...</section> }
      @if (message()) { <section class="notice success">{{ message() }}</section> }
      @if (staff.error()) { <section class="notice">{{ staff.error() }}</section> }
      @if (today(); as data) {
        <section class="grid four"><article class="kpi"><span>Status</span><strong>{{ attendanceStatus() }}</strong></article><article class="kpi"><span>Clock in</span><strong>{{ activeOrLatestAttendance()?.clockInAt ? (activeOrLatestAttendance()?.clockInAt | date:'shortTime') : '-' }}</strong></article><article class="kpi"><span>Clock out</span><strong>{{ activeOrLatestAttendance()?.clockOutAt ? (activeOrLatestAttendance()?.clockOutAt | date:'shortTime') : '-' }}</strong></article><article class="kpi"><span>Worked</span><strong>{{ workedLabel() }}</strong></article></section>
        <section class="panel"><div class="panel-title"><h2>Actions</h2><span>{{ data.date }}</span></div><div class="row-actions">@if (canUseAttendance()) { @if (!activeAttendance()) { <button class="link-button" type="button" (click)="clockIn()">Clock in</button> } @else { <button class="link-button" type="button" (click)="startBreak()">Start break</button><button class="link-button" type="button" (click)="endBreak()">End break</button><button class="link-button" type="button" (click)="clockOut()">Clock out</button> } }</div></section>
        <section class="panel"><div class="panel-title"><h2>Attendance log</h2><span>{{ data.attendance.length }}</span></div><div class="list">@for (row of data.attendance; track row.id) { <div class="row"><div class="row-main"><strong>{{ row.businessDate }}</strong><small>{{ row.clockInAt || '-' }} - {{ row.clockOutAt || '-' }} · {{ row.source || 'staff-app' }}</small></div><span class="badge">{{ row.status }}</span></div> } @empty { <p class="empty">No attendance record for today.</p> }</div></section>
      }
    </section>
  `,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffAttendancePage implements OnInit {
  readonly today = signal<StaffToday | null>(null);
  readonly loading = signal(false);
  readonly message = signal("");
  readonly activeAttendance = computed(() => this.today()?.attendance.find((item) => item.status === "clocked_in") || null);
  readonly activeOrLatestAttendance = computed<StaffAttendance | null>(() => this.activeAttendance() || this.today()?.attendance[0] || null);
  constructor(readonly staff: StaffAppService) {}
  ngOnInit() { void this.load(); }
  async load() { this.loading.set(true); try { this.today.set(await this.staff.today()); } finally { this.loading.set(false); } }
  canUseAttendance(): boolean { return this.staff.hasAnyPermission(["allow:staff-checkin-checkout", "write:staff"]); }
  attendanceStatus(): string { return this.activeOrLatestAttendance()?.status?.replace(/_/g, " ") || "not clocked in"; }
  workedLabel(): string { const row = this.activeOrLatestAttendance(); if (!row?.clockInAt) return "-"; const end = row.clockOutAt ? new Date(row.clockOutAt) : new Date(); const start = new Date(row.clockInAt); const minutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000)); return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }
  async clockIn() { await this.staff.clockIn().then(() => this.afterAction("Clock-in saved.")); }
  async clockOut() { await this.staff.clockOut(this.activeAttendance()?.id).then(() => this.afterAction("Clock-out saved.")); }
  async startBreak() { await this.staff.startBreak().then(() => this.afterAction("Break started.")); }
  async endBreak() { await this.staff.endBreak().then(() => this.afterAction("Break ended.")); }
  private async afterAction(message: string) { this.message.set(message); await this.load(); }
}
