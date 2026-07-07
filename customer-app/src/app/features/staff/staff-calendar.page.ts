import { Component, OnInit, signal } from "@angular/core";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffEnterpriseOs, StaffToday } from "../../core/staff-app.service";

@Component({
  standalone: true,
  imports: [IonSpinner],
  template: `
    <section class="page">
      <header class="page-head"><div><p class="eyebrow">Calendar</p><h1>Calendar</h1><p>Day and week staff schedule workspace.</p></div><div class="row-actions"><button class="link-button" [class.active-toggle]="view() === 'day'" type="button" (click)="view.set('day')">Day</button><button class="link-button" [class.active-toggle]="view() === 'week'" type="button" (click)="view.set('week')">Week</button></div></header>
      @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading calendar...</section> }
      @if (staff.error()) { <section class="notice">{{ staff.error() }}</section> }
      @if (message()) { <section class="notice" [class.success]="message().startsWith('Schedule')">{{ message() }}</section> }
      @if (view() === 'day') {
        <section class="grid two"><article class="panel"><div class="panel-title"><h2>Today</h2><span>{{ today()?.date || '-' }}</span></div><div class="calendar-day">@for (shift of today()?.schedules || []; track shift.id) { <div class="calendar-slot"><b>{{ shift.startTime || '-' }}</b><div><strong>{{ shift.shiftType || 'Shift' }}</strong><small>{{ shift.endTime || '-' }} · {{ shift.status }}</small></div></div> } @empty { <p class="empty">No shifts today.</p> }</div></article><article class="panel"><div class="panel-title"><h2>Queue hint</h2><span>{{ os()?.timeline?.length || 0 }}</span></div><div class="list">@for (item of os()?.timeline?.slice(0, 6) || []; track item.id) { <div class="row"><div class="row-main"><strong>{{ item.clientName }}</strong><small>{{ item.startAt }} · {{ item.state }}</small></div><span class="badge">{{ item.status }}</span></div> } @empty { <p class="empty">No appointment timeline items.</p> }</div></article></section>
      } @else {
        <section class="calendar-week">
          @for (item of weekItems(); track item.id) { <article class="panel" draggable="true" (dragstart)="dragSchedule(item)" (dragover)="$event.preventDefault()" (drop)="dropSchedule(item.date)"><div class="panel-title"><h2>{{ item.date || 'Scheduled' }}</h2><span>{{ item.status }}</span></div><strong>{{ item.startTime || '-' }} - {{ item.endTime || '-' }}</strong><p class="muted">{{ item.type || 'roster' }}</p><small>Drag this card onto another date card to reschedule.</small></article> } @empty { <section class="panel"><p class="empty">No upcoming calendar entries.</p></section> }
        </section>
      }
    </section>
  `,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffCalendarPage implements OnInit {
  readonly os = signal<StaffEnterpriseOs | null>(null);
  readonly today = signal<StaffToday | null>(null);
  readonly loading = signal(false);
  readonly view = signal<"day" | "week">("day");
  readonly message = signal("");
  readonly dragged = signal<{ id: string; version: number; startTime: string; endTime: string } | null>(null);
  constructor(readonly staff: StaffAppService) {}
  ngOnInit() { void this.load(); }
  async load() { this.loading.set(true); try { const [today, os] = await Promise.all([this.staff.today(), this.staff.enterpriseOs()]); this.today.set(today); this.os.set(os); } finally { this.loading.set(false); } }
  weekItems() { return this.os()?.calendar || []; }
  dragSchedule(item: { id: string; version?: number; startTime: string; endTime: string }) { this.dragged.set({ id: item.id, version: Number(item.version || 1), startTime: item.startTime, endTime: item.endTime }); }
  async dropSchedule(date: string) { const item = this.dragged(); if (!item || !date) return; this.message.set(""); try { await this.staff.updateSchedule(item.id, { version: item.version, scheduleDate: date, startTime: item.startTime, endTime: item.endTime }); this.message.set("Schedule updated."); await this.load(); } catch { this.message.set(this.staff.error() || "Schedule could not be moved because of a conflict."); } finally { this.dragged.set(null); } }
}
