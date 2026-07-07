import { CurrencyPipe, DatePipe } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffAppointment, StaffClient360, StaffDashboard } from "../../core/staff-app.service";

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, IonSpinner],
  template: `
    <section class="page">
      <header class="page-head"><div><p class="eyebrow">Appointments</p><h1>Appointments</h1><p>Assigned bookings with service actions and Client 360 links.</p></div></header>
      @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading appointments...</section> }
      @if (message()) { <section class="notice success">{{ message() }}</section> }
      @if (staff.error()) { <section class="notice">{{ staff.error() }}</section> }

      @if (dashboard(); as data) {
        <section class="grid four">
          <article class="kpi"><span>Today</span><strong>{{ data.summary.todayAppointments }}</strong></article>
          <article class="kpi"><span>Live</span><strong>{{ data.summary.liveAppointments }}</strong></article>
          <article class="kpi"><span>Completed</span><strong>{{ data.summary.completedAppointments }}</strong></article>
          <article class="kpi"><span>Cancelled</span><strong>{{ data.summary.cancelledAppointments }}</strong></article>
        </section>

        <section class="panel">
          <div class="panel-title"><h2>Today appointments</h2><span>{{ data.todayAppointments.length }}</span></div>
          <div class="list">
            @for (item of data.todayAppointments; track item.id) {
              <article class="row">
                <div class="row-main">
                  <strong>{{ item.clientName || 'Walk-in client' }}</strong>
                  <p>{{ item.serviceNames.join(', ') || 'Service not mapped' }}</p>
                  <small>{{ item.startAt | date:'mediumDate' }} · {{ item.startAt | date:'shortTime' }} - {{ item.endAt | date:'shortTime' }} · {{ item.durationMinutes || 0 }} min</small>
                </div>
                <div class="row-actions">
                  <span class="badge">{{ item.status }}</span>
                  @if (canSeeRevenue()) { <span class="badge">{{ item.value | currency:'INR':'symbol':'1.0-0' }}</span> }
                  @if (canUpdateAppointments()) {
                    <button class="link-button" type="button" (click)="startService(item.id)">Start</button>
                    <button class="link-button" type="button" (click)="completeService(item.id)">Complete</button>
                  }
                  <button class="link-button" type="button" (click)="openAppointment(item)">Details</button>
                  @if (item.clientId) { <button class="link-button" type="button" (click)="openClientPreview(item.clientId)">Preview</button> }
                  @if (item.clientId) { <a class="button" [routerLink]="['/staff/client-360', item.clientId]">Client 360</a> }
                </div>
              </article>
            } @empty {
              <p class="empty">No appointments assigned to you today.</p>
            }
          </div>
        </section>
      }

      @if (selectedAppointment(); as item) {
        <button class="detail-backdrop" type="button" (click)="closeDrawers()" aria-label="Close details"></button>
        <aside class="detail-drawer">
          <div class="panel-title"><h2>Appointment detail</h2><button class="link-button" type="button" (click)="closeDrawers()">Close</button></div>
          <section class="grid two compact-grid"><article class="kpi"><span>Client</span><strong>{{ item.clientName || 'Walk-in' }}</strong></article><article class="kpi"><span>Status</span><strong>{{ item.status }}</strong></article></section>
          <div class="list"><div class="row"><strong>Time</strong><span>{{ item.startAt | date:'short' }} - {{ item.endAt | date:'shortTime' }}</span></div><div class="row"><strong>Services</strong><span>{{ item.serviceNames.join(', ') || '-' }}</span></div><div class="row"><strong>Duration</strong><span>{{ item.durationMinutes || 0 }} min</span></div><div class="row"><strong>Chair</strong><span>{{ item.chair || '-' }}</span></div><div class="row"><strong>Phone</strong><span>{{ item.clientPhone || '-' }}</span></div></div>
          <div class="form-grid drawer-form"><label>Status<input [(ngModel)]="editStatus" /></label><label>Chair<input [(ngModel)]="editChair" /></label><label>Start ISO<input [(ngModel)]="editStartAt" /></label><label>End ISO<input [(ngModel)]="editEndAt" /></label><label>Services CSV<input [(ngModel)]="editServiceIds" /></label><label>Notes<input [(ngModel)]="editNotes" /></label></div>
          <div class="row-actions drawer-actions">@if (canUpdateAppointments()) { <button class="link-button" type="button" (click)="startService(item.id)">Start</button><button class="link-button" type="button" (click)="completeService(item.id)">Complete</button> } @if (item.clientId) { <button class="link-button" type="button" (click)="openClientPreview(item.clientId)">Client preview</button><a class="button primary" [routerLink]="['/staff/client-360', item.clientId]">Full Client 360</a> }</div>
          <button class="button primary" type="button" (click)="saveAppointment(item.id)">Save changes</button>
        </aside>
      }

      @if (selectedClient(); as client) {
        <button class="detail-backdrop" type="button" (click)="closeClientPreview()" aria-label="Close client preview"></button>
        <aside class="detail-drawer client-preview">
          <div class="panel-title"><h2>Client preview</h2><button class="link-button" type="button" (click)="closeClientPreview()">Close</button></div>
          <section class="grid two compact-grid"><article class="kpi"><span>Retention</span><strong>{{ client.retentionScore }}%</strong></article><article class="kpi"><span>Visits</span><strong>{{ client.visitFrequency }}</strong></article></section>
          <div class="list"><div class="row"><strong>Name</strong><span>{{ client.profile.name }}</span></div><div class="row"><strong>Phone</strong><span>{{ client.profile.phone || '-' }}</span></div><div class="row"><strong>Outstanding</strong><span>{{ client.outstandingBalance | currency:'INR':'symbol':'1.0-0' }}</span></div></div>
          @for (tip of client.aiRecommendations; track tip) { <p class="insight">{{ tip }}</p> }
        </aside>
      }
    </section>
  `,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffAppointmentsPage implements OnInit {
  readonly dashboard = signal<StaffDashboard | null>(null);
  readonly loading = signal(false);
  readonly message = signal("");
  readonly selectedAppointment = signal<StaffAppointment | null>(null);
  readonly selectedClient = signal<StaffClient360 | null>(null);
  editNotes = "";
  editChair = "";
  editStatus = "";
  editStartAt = "";
  editEndAt = "";
  editServiceIds = "";

  constructor(readonly staff: StaffAppService) {}

  ngOnInit() { void this.load(); }

  async load() {
    this.loading.set(true);
    try { this.dashboard.set(await this.staff.dashboard()); } finally { this.loading.set(false); }
  }

  canSeeRevenue(): boolean { return this.staff.hasAnyPermission(["read:finance", "read:sales", "read:payments", "read:invoices"]); }
  canUpdateAppointments(): boolean { return this.staff.hasAnyPermission(["update:appointments", "write:appointments"]); }

  async startService(appointmentId: string) { await this.staff.startService(appointmentId).then(() => this.afterAction("Service started.")); }
  async completeService(appointmentId: string) { await this.staff.completeService(appointmentId).then(() => this.afterAction("Service completed.")); }

  openAppointment(item: StaffAppointment) { this.editNotes = item.notes || ""; this.editChair = item.chair || ""; this.editStatus = item.status || ""; this.editStartAt = item.startAt || ""; this.editEndAt = item.endAt || ""; this.editServiceIds = (item.serviceIds || []).join(", "); this.selectedAppointment.set(item); }
  closeDrawers() { this.selectedAppointment.set(null); this.selectedClient.set(null); }
  closeClientPreview() { this.selectedClient.set(null); }
  async openClientPreview(clientId: string) { this.selectedAppointment.set(null); this.selectedClient.set(await this.staff.client360(clientId)); }
  async saveAppointment(appointmentId: string) { const updated = await this.staff.updateAppointment(appointmentId, { notes: this.editNotes, chair: this.editChair, status: this.editStatus, startAt: this.editStartAt, endAt: this.editEndAt, serviceIds: this.editServiceIds.split(",").map((item) => item.trim()).filter(Boolean) }); this.message.set("Appointment updated."); this.selectedAppointment.set(updated); await this.load(); }

  private async afterAction(message: string) { this.message.set(message); await this.load(); }
}
