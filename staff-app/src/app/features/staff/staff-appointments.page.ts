import { DatePipe } from "@angular/common";
import { Component, computed, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { IonSpinner } from "@ionic/angular/standalone";
import { isQueuedMutation, MutationResult, StaffAppService, StaffAppointment, StaffClient360, StaffDashboard } from "../../core/staff-app.service";
import { businessDate } from "../../core/business-date";
import { PaiseInrPipe } from "../../core/paise-inr.pipe";

type AppointmentView = "today" | "upcoming" | "live" | "completed" | "cancelled";

const LIVE_STATUSES = new Set(["booked", "confirmed", "checked-in", "arrived", "in-service", "started"]);
const TERMINAL_STATUSES = new Set(["completed", "checked-out", "cancelled", "no-show"]);
const COMPLETED_STATUSES = new Set(["completed", "checked-out"]);
const CANCELLED_STATUSES = new Set(["cancelled", "no-show"]);
const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

function istDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(IST_DATE_FORMATTER.formatToParts(date).map((part) => [part.type, part.value]));
  return [parts["year"], parts["month"], parts["day"]].join("-");
}

@Component({
  standalone: true,
  imports: [PaiseInrPipe, DatePipe, FormsModule, RouterLink, IonSpinner],
  template: `
    <section class="page">
      <header class="page-head"><div><p class="eyebrow">Appointments</p><h1>Appointments</h1><p>Assigned bookings with service actions and Client 360 links.</p></div></header>
      @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading appointments...</section> }
      @if (message()) { <section class="notice success">{{ message() }}</section> }
      @if (localError()) { <section class="notice">{{ localError() }}</section> }
      @if (staff.error() && !localError()) { <section class="notice">{{ staff.error() }}</section> }

      @if (dashboard()) {
        <section class="grid four">
          <button class="kpi kpi-button" [class.active-toggle]="activeView() === 'today'" type="button" [attr.aria-pressed]="activeView() === 'today'" (click)="setView('today')"><span>Today</span><strong>{{ kpiCounts().today }}</strong></button>
          <button class="kpi kpi-button" [class.active-toggle]="activeView() === 'live'" type="button" [attr.aria-pressed]="activeView() === 'live'" (click)="setView('live')"><span>Live</span><strong>{{ kpiCounts().live }}</strong></button>
          <button class="kpi kpi-button" [class.active-toggle]="activeView() === 'completed'" type="button" [attr.aria-pressed]="activeView() === 'completed'" (click)="setView('completed')"><span>Completed</span><strong>{{ kpiCounts().completed }}</strong></button>
          <button class="kpi kpi-button" [class.active-toggle]="activeView() === 'cancelled'" type="button" [attr.aria-pressed]="activeView() === 'cancelled'" (click)="setView('cancelled')"><span>Cancelled</span><strong>{{ kpiCounts().cancelled }}</strong></button>
        </section>

        <nav class="queue-tabs" aria-label="Appointment queues">
          <button class="link-button" [class.active-toggle]="activeView() === 'today'" type="button" [attr.aria-pressed]="activeView() === 'today'" (click)="setView('today')">Today's Queue</button>
          <button class="link-button" [class.active-toggle]="activeView() === 'upcoming'" type="button" [attr.aria-pressed]="activeView() === 'upcoming'" (click)="setView('upcoming')">Upcoming</button>
          <button class="link-button" [class.active-toggle]="activeView() === 'completed'" type="button" [attr.aria-pressed]="activeView() === 'completed'" (click)="setView('completed')">Completed</button>
        </nav>

        <section class="panel" aria-live="polite">
          <div class="panel-title">
            <h2>{{ viewTitle() }}</h2>
            <div class="row-actions">
              <span>{{ visibleAppointments().length }}</span>
              @if (activeView() === 'live') { <a class="button" routerLink="/staff/queue">Open live timers</a> }
            </div>
          </div>
          <div class="list">
            @for (item of visibleAppointments(); track item.id) {
              <article class="row">
                <div class="row-main">
                  <strong>{{ item.clientName || 'Walk-in client' }}</strong>
                  <p>{{ item.serviceNames.join(', ') || 'Service not mapped' }}</p>
                  @if (isValidDate(item.startAt) && isValidDate(item.endAt)) {
                  <small>{{ item.startAt | date:'mediumDate' }} · {{ item.startAt | date:'shortTime' }} - {{ item.endAt | date:'shortTime' }} · {{ item.durationMinutes || 0 }} min</small>
                  } @else {
                    <small>Date unavailable - {{ item.durationMinutes || 0 }} min</small>
                  }
                </div>
                <div class="row-actions">
                  <span class="badge">{{ item.status }}</span>
                  @if (canSeeRevenue()) { <span class="badge">{{ item.value | paiseInr }}</span> }
                  @if (staff.canStartServiceStatus(item.status)) { <button class="link-button" type="button" [disabled]="isPending(item.id)" (click)="startService(item.id)">Start</button> }
                  @if (staff.canCompleteServiceStatus(item.status)) { <button class="link-button" type="button" [disabled]="isPending(item.id)" (click)="completeService(item.id)">Complete</button> }
                  <button class="link-button" type="button" (click)="openAppointment(item)">Details</button>
                  @if (item.clientId) { <button class="link-button" type="button" (click)="openClientPreview(item.clientId)">Preview</button> }
                  @if (item.clientId) { <a class="button" [routerLink]="['/staff/client-360', item.clientId]">Client 360</a> }
                </div>
              </article>
            } @empty {
              <p class="empty">{{ emptyMessage() }}</p>
            }
          </div>
        </section>
      }

      @if (selectedAppointment(); as item) {
        <button class="detail-backdrop" type="button" (click)="closeDrawers()" aria-label="Close details"></button>
        <aside class="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title" tabindex="-1">
          <div class="panel-title"><h2 id="appointment-detail-title">Appointment detail</h2><button class="link-button" type="button" (click)="closeDrawers()">Close</button></div>
          <section class="grid two compact-grid"><article class="kpi"><span>Client</span><strong>{{ item.clientName || 'Walk-in' }}</strong></article><article class="kpi"><span>Status</span><strong>{{ item.status }}</strong></article></section>
          <div class="list"><div class="row"><strong>Time</strong><span>{{ item.startAt | date:'short' }} - {{ item.endAt | date:'shortTime' }}</span></div><div class="row"><strong>Services</strong><span>{{ item.serviceNames.join(', ') || '-' }}</span></div><div class="row"><strong>Duration</strong><span>{{ item.durationMinutes || 0 }} min</span></div><div class="row"><strong>Chair</strong><span>{{ item.chair || '-' }}</span></div><div class="row"><strong>Phone</strong><span>{{ item.clientPhone || '-' }}</span></div></div>
          <div class="form-grid drawer-form"><label>Status<input [(ngModel)]="editStatus" /></label><label>Chair<input [(ngModel)]="editChair" /></label><label>Start ISO<input [(ngModel)]="editStartAt" /></label><label>End ISO<input [(ngModel)]="editEndAt" /></label><label>Services CSV<input [(ngModel)]="editServiceIds" /></label><label>Notes<input [(ngModel)]="editNotes" /></label></div>
          <div class="row-actions drawer-actions">@if (staff.canStartServiceStatus(item.status)) { <button class="link-button" type="button" [disabled]="isPending(item.id)" (click)="startService(item.id)">Start</button> } @if (staff.canCompleteServiceStatus(item.status)) { <button class="link-button" type="button" [disabled]="isPending(item.id)" (click)="completeService(item.id)">Complete</button> } @if (item.clientId) { <button class="link-button" type="button" (click)="openClientPreview(item.clientId)">Client preview</button><a class="button primary" [routerLink]="['/staff/client-360', item.clientId]">Full Client 360</a> }</div>
          <button class="button primary" type="button" [disabled]="isPending(item.id)" (click)="saveAppointment(item.id)">{{ isPending(item.id) ? 'Saving...' : 'Save changes' }}</button>
        </aside>
      }

      @if (selectedClient(); as client) {
        <button class="detail-backdrop" type="button" (click)="closeClientPreview()" aria-label="Close client preview"></button>
        <aside class="detail-drawer client-preview" role="dialog" aria-modal="true" aria-labelledby="client-preview-title" tabindex="-1">
          <div class="panel-title"><h2 id="client-preview-title">Client preview</h2><button class="link-button" type="button" (click)="closeClientPreview()">Close</button></div>
          <section class="grid two compact-grid"><article class="kpi"><span>Retention</span><strong>{{ client.retentionScore }}%</strong></article><article class="kpi"><span>Visits</span><strong>{{ client.visitFrequency }}</strong></article></section>
          <div class="list"><div class="row"><strong>Name</strong><span>{{ client.profile.name }}</span></div><div class="row"><strong>Phone</strong><span>{{ client.profile.phone || '-' }}</span></div><div class="row"><strong>Outstanding</strong><span>{{ client.outstandingBalance | paiseInr }}</span></div></div>
          @for (tip of client.aiRecommendations; track tip) { <p class="insight">{{ tip }}</p> }
        </aside>
      }
    </section>
  `,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffAppointmentsPage implements OnInit {
  readonly dashboard = signal<StaffDashboard | null>(null);
  readonly activeView = signal<AppointmentView>("today");
  readonly kpiCounts = computed(() => {
    const rows = this.dashboard()?.appointments || [];
    const today = businessDate();
    return {
      today: rows.filter((item) => istDateKey(item.startAt) === today).length,
      live: rows.filter((item) => istDateKey(item.startAt) === today && LIVE_STATUSES.has(this.statusOf(item))).length,
      completed: rows.filter((item) => this.isCompleted(item, today)).length,
      cancelled: rows.filter((item) => CANCELLED_STATUSES.has(this.statusOf(item))).length
    };
  });
  readonly visibleAppointments = computed(() => {
    const today = businessDate();
    const view = this.activeView();
    const rows = (this.dashboard()?.appointments || []).filter((item) => {
      const date = istDateKey(item.startAt);
      const status = this.statusOf(item);
      switch (view) {
        case "today": return date === today;
        case "upcoming": return date > today && !TERMINAL_STATUSES.has(status);
        case "live": return date === today && LIVE_STATUSES.has(status);
        case "completed": return this.isCompleted(item, today);
        case "cancelled": return CANCELLED_STATUSES.has(status);
      }
    });
    const ascending = view === "today" || view === "live" || view === "upcoming";
    return rows.sort((left, right) => this.compareStartTimes(left, right, ascending));
  });
  readonly loading = signal(false);
  readonly message = signal("");
  readonly localError = signal("");
  readonly pendingAppointmentId = signal("");
  readonly selectedAppointment = signal<StaffAppointment | null>(null);
  readonly selectedClient = signal<StaffClient360 | null>(null);
  editNotes = "";
  editChair = "";
  editStatus = "";
  editStartAt = "";
  editEndAt = "";
  editServiceIds = "";
  private loadGeneration = 0;
  private clientGeneration = 0;

  constructor(readonly staff: StaffAppService) {}

  ngOnInit() { void this.load(); }

  setView(view: AppointmentView) { this.activeView.set(view); }

  viewTitle(): string {
    return ({ today: "Today's Queue", upcoming: "Upcoming appointments", live: "Live appointments", completed: "Completed appointments", cancelled: "Cancelled appointments" } as const)[this.activeView()];
  }

  emptyMessage(): string {
    return ({ today: "No appointments in today's queue.", upcoming: "No upcoming appointments assigned to you.", live: "No live appointments right now.", completed: "No completed appointments in the loaded range.", cancelled: "No cancelled appointments in the loaded range." } as const)[this.activeView()];
  }

  isValidDate(value: string): boolean { return !Number.isNaN(new Date(value).getTime()); }

  async load() {
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    try { const dashboard = await this.staff.dashboard(); if (generation === this.loadGeneration) this.dashboard.set(dashboard); } finally { if (generation === this.loadGeneration) this.loading.set(false); }
  }

  canSeeRevenue(): boolean { return this.staff.hasAnyPermission(["read:finance", "read:sales", "read:payments", "read:invoices"]); }
  canUpdateAppointments(): boolean { return this.staff.hasAnyPermission(["update:appointments", "write:appointments"]); }

  async startService(appointmentId: string) { await this.mutateAppointment(appointmentId, () => this.staff.startService(appointmentId), "Service started."); }
  async completeService(appointmentId: string) { await this.mutateAppointment(appointmentId, () => this.staff.completeService(appointmentId), "Service completed."); }

  openAppointment(item: StaffAppointment) { this.editNotes = item.notes || ""; this.editChair = item.chair || ""; this.editStatus = item.status || ""; this.editStartAt = item.startAt || ""; this.editEndAt = item.endAt || ""; this.editServiceIds = (item.serviceIds || []).join(", "); this.selectedAppointment.set(item); }
  closeDrawers() { this.selectedAppointment.set(null); this.selectedClient.set(null); }
  closeClientPreview() { this.selectedClient.set(null); }
  async openClientPreview(clientId: string) { const generation = ++this.clientGeneration; this.selectedAppointment.set(null); this.selectedClient.set(null); const client = await this.staff.client360(clientId); if (generation === this.clientGeneration) this.selectedClient.set(client); }
  async saveAppointment(appointmentId: string) { await this.mutateAppointment(appointmentId, () => this.staff.updateAppointment(appointmentId, { notes: this.editNotes, chair: this.editChair, status: this.editStatus, startAt: this.editStartAt, endAt: this.editEndAt, serviceIds: this.editServiceIds.split(",").map((item) => item.trim()).filter(Boolean) }), "Appointment updated."); }
  isPending(appointmentId: string): boolean { return this.pendingAppointmentId() === appointmentId; }

  private statusOf(item: StaffAppointment): string { return String(item.status || "").toLowerCase(); }
  private isCompleted(item: StaffAppointment, today: string): boolean {
    const status = this.statusOf(item);
    const date = istDateKey(item.startAt);
    return !CANCELLED_STATUSES.has(status) && (COMPLETED_STATUSES.has(status) || !date || date < today);
  }
  private compareStartTimes(left: StaffAppointment, right: StaffAppointment, ascending: boolean): number {
    const leftTime = new Date(left.startAt).getTime();
    const rightTime = new Date(right.startAt).getTime();
    if (Number.isNaN(leftTime)) return Number.isNaN(rightTime) ? 0 : 1;
    if (Number.isNaN(rightTime)) return -1;
    return ascending ? leftTime - rightTime : rightTime - leftTime;
  }

  private async mutateAppointment(appointmentId: string, mutate: () => Promise<MutationResult<unknown>>, completedMessage: string) {
    if (this.pendingAppointmentId()) return;
    this.pendingAppointmentId.set(appointmentId);
    this.message.set("");
    this.localError.set("");
    try {
      const result = await mutate();
      if (isQueuedMutation(result)) { this.message.set(`Offline change queued for sync (${result.queueId}).`); return; }
      this.message.set(completedMessage);
      this.selectedAppointment.set(null);
      await this.load();
    } catch { this.localError.set(this.staff.error() || "Unable to update the appointment."); }
    finally { this.pendingAppointmentId.set(""); }
  }
}
