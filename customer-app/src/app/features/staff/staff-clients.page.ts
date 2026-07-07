import { Component, OnInit, computed, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffDashboard } from "../../core/staff-app.service";

@Component({
  standalone: true,
  imports: [RouterLink, IonSpinner],
  template: `
    <section class="page">
      <header class="page-head"><div><p class="eyebrow">Clients</p><h1>Today's clients</h1><p>Client list from assigned appointments.</p></div></header>
      @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading clients...</section> }
      @if (staff.error()) { <section class="notice">{{ staff.error() }}</section> }
      <section class="panel">
        <div class="panel-title"><h2>Connected clients</h2><span>{{ clients().length }}</span></div>
        <div class="list">
          @for (client of clients(); track client.id) {
            <div class="row"><div class="row-main"><strong>{{ client.name }}</strong><small>{{ client.phone || 'No phone on file' }}</small></div><a class="button" [routerLink]="['/staff/client-360', client.id]">Open Client 360</a></div>
          } @empty { <p class="empty">No assigned clients found for today.</p> }
        </div>
      </section>
    </section>
  `,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffClientsPage implements OnInit {
  readonly dashboard = signal<StaffDashboard | null>(null);
  readonly loading = signal(false);
  readonly clients = computed(() => {
    const map = new Map<string, { id: string; name: string; phone: string }>();
    for (const item of this.dashboard()?.todayAppointments || []) {
      if (item.clientId) map.set(item.clientId, { id: item.clientId, name: item.clientName || item.clientId, phone: item.clientPhone || "" });
    }
    return [...map.values()];
  });
  constructor(readonly staff: StaffAppService) {}
  ngOnInit() { void this.load(); }
  async load() { this.loading.set(true); try { this.dashboard.set(await this.staff.dashboard()); } finally { this.loading.set(false); } }
}
