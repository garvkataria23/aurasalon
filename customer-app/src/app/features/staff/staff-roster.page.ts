import { Component, OnInit, signal } from "@angular/core";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffEnterpriseOs, StaffToday } from "../../core/staff-app.service";

@Component({
  standalone: true,
  imports: [IonSpinner],
  template: `
    <section class="page"><header class="page-head"><div><p class="eyebrow">Roster</p><h1>Roster</h1><p>Shift and calendar assignments.</p></div></header>
      @if (!staff.hasPermission('read:staff')) { <section class="notice">You do not have permission to read roster data.</section> }
      @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading roster...</section> }
      @if (staff.error()) { <section class="notice">{{ staff.error() }}</section> }
      @if (today(); as data) { <section class="grid two"><article class="panel"><div class="panel-title"><h2>Today shift</h2><span>{{ data.schedules.length }}</span></div><div class="list">@for (shift of data.schedules; track shift.id) { <div class="row"><div class="row-main"><strong>{{ shift.startTime || '-' }} - {{ shift.endTime || '-' }}</strong><small>{{ shift.scheduleDate }}</small></div><span class="badge">{{ shift.shiftType || shift.status }}</span></div> } @empty { <p class="empty">No rostered shift found today.</p> }</div></article><article class="panel"><div class="panel-title"><h2>Upcoming roster</h2><span>{{ os()?.calendar?.length || 0 }}</span></div><div class="list">@for (item of os()?.calendar?.slice(0, 8) || []; track item.id) { <div class="row"><div class="row-main"><strong>{{ item.date }}</strong><small>{{ item.startTime || '-' }} - {{ item.endTime || '-' }}</small></div><span class="badge">{{ item.status }}</span></div> } @empty { <p class="empty">No upcoming roster entries.</p> }</div></article></section> }
    </section>
  `,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffRosterPage implements OnInit {
  readonly today = signal<StaffToday | null>(null);
  readonly os = signal<StaffEnterpriseOs | null>(null);
  readonly loading = signal(false);
  constructor(readonly staff: StaffAppService) {}
  ngOnInit() { if (this.staff.hasPermission("read:staff")) void this.load(); }
  async load() { this.loading.set(true); try { const [today, os] = await Promise.all([this.staff.today(), this.staff.enterpriseOs()]); this.today.set(today); this.os.set(os); } finally { this.loading.set(false); } }
}
