import { Component, OnInit, signal } from "@angular/core";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffDashboard } from "../../core/staff-app.service";

@Component({ standalone: true, imports: [IonSpinner], template: `
  <section class="page"><header class="page-head"><div><p class="eyebrow">Settings</p><h1>Staff settings</h1><p>Session, role and application context.</p></div></header>
  @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading settings...</section> } @if (staff.error()) { <section class="notice">{{ staff.error() }}</section> }
  @if (dashboard(); as data) { <section class="grid two"><article class="panel"><div class="panel-title"><h2>Session</h2><span>active</span></div><div class="list"><div class="row"><strong>Login ID</strong><span>{{ staff.user()?.loginId || '-' }}</span></div><div class="row"><strong>Role</strong><span>{{ staff.user()?.role || data.staff.roleId }}</span></div><div class="row"><strong>Branch</strong><span>{{ staff.user()?.branchId || '-' }}</span></div></div></article><article class="panel"><div class="panel-title"><h2>Permissions</h2><span>{{ staff.user()?.permissions?.length || 0 }}</span></div><div class="row-actions">@for (permission of visiblePermissions(); track permission) { <span class="badge">{{ permission }}</span> } @empty { <p class="empty">No permission metadata.</p> }</div></article></section> }
  </section>`, styleUrls: ["./staff-app.styles.css"] })
export class StaffSettingsPage implements OnInit { readonly dashboard = signal<StaffDashboard | null>(null); readonly loading = signal(false); constructor(readonly staff: StaffAppService) {} ngOnInit() { void this.load(); } async load() { this.loading.set(true); try { this.dashboard.set(await this.staff.dashboard()); } finally { this.loading.set(false); } } visiblePermissions(): string[] { return (this.staff.user()?.permissions || []).slice(0, 40); } }
