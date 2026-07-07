import { CurrencyPipe, DatePipe } from "@angular/common";
import { Component, OnInit, computed, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffClient360, StaffDashboard } from "../../core/staff-app.service";

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, IonSpinner],
  template: `
    <section class="page">
      <header class="page-head"><div><p class="eyebrow">Client 360</p><h1>{{ client()?.profile?.name || 'Client 360' }}</h1><p>Separate client workspace, not embedded in dashboard.</p></div></header>
      @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading Client 360...</section> }
      @if (staff.error()) { <section class="notice">{{ staff.error() }}</section> }

      @if (!clientId()) {
        <section class="panel">
          <div class="panel-title"><h2>Select a client</h2><span>{{ clients().length }}</span></div>
          <div class="list">
            @for (item of clients(); track item.id) { <div class="row"><div class="row-main"><strong>{{ item.name }}</strong><small>{{ item.phone || 'No phone on file' }}</small></div><a class="button" [routerLink]="['/staff/client-360', item.id]">Open</a></div> } @empty { <p class="empty">No assigned clients available for Client 360.</p> }
          </div>
        </section>
      }

      @if (client(); as data) {
        <section class="grid four">
          <article class="kpi"><span>Retention</span><strong>{{ data.retentionScore }}%</strong></article>
          <article class="kpi"><span>Visits</span><strong>{{ data.visitFrequency }}</strong></article>
          <article class="kpi"><span>Lifetime</span><strong>{{ data.lifetimeSpend | currency:'INR':'symbol':'1.0-0' }}</strong></article>
          <article class="kpi"><span>Outstanding</span><strong>{{ data.outstandingBalance | currency:'INR':'symbol':'1.0-0' }}</strong></article>
        </section>
        <section class="grid two">
          <article class="panel"><div class="panel-title"><h2>Profile</h2><span>{{ data.membership.status || 'standard' }}</span></div><div class="list"><div class="row"><strong>Phone</strong><span>{{ data.profile.phone || '-' }}</span></div><div class="row"><strong>Email</strong><span>{{ data.profile.email || '-' }}</span></div><div class="row"><strong>Birthday</strong><span>{{ data.profile.birthday || '-' }}</span></div><div class="row"><strong>Preferred</strong><span>{{ data.profile.preferredStylist || '-' }}</span></div></div></article>
          <article class="panel"><div class="panel-title"><h2>AI recommendations</h2><span>{{ data.aiRecommendations.length }}</span></div>@for (tip of data.aiRecommendations; track tip) { <p class="insight">{{ tip }}</p> } @empty { <p class="empty">No recommendations yet.</p> }</article>
        </section>
        <section class="panel"><div class="panel-title"><h2>Previous services</h2><span>{{ data.previousServices.length }}</span></div><div class="list">@for (item of data.previousServices; track item.id) { <div class="row"><div class="row-main"><strong>{{ item.startAt | date:'mediumDate' }}</strong><small>{{ item.serviceIds.join(', ') || 'Service' }}</small></div><span class="badge">{{ item.status }}</span></div> } @empty { <p class="empty">No previous services found.</p> }</div></section>
      }
    </section>
  `,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffClient360Page implements OnInit {
  readonly client = signal<StaffClient360 | null>(null);
  readonly dashboard = signal<StaffDashboard | null>(null);
  readonly loading = signal(false);
  readonly clientId = signal("");
  readonly clients = computed(() => {
    const map = new Map<string, { id: string; name: string; phone: string }>();
    for (const item of this.dashboard()?.todayAppointments || []) if (item.clientId) map.set(item.clientId, { id: item.clientId, name: item.clientName || item.clientId, phone: item.clientPhone || "" });
    return [...map.values()];
  });
  constructor(readonly staff: StaffAppService, private readonly route: ActivatedRoute) {}
  ngOnInit() { void this.load(); }
  async load() {
    this.loading.set(true);
    try {
      const id = this.route.snapshot.paramMap.get("id") || "";
      this.clientId.set(id);
      if (id) this.client.set(await this.staff.client360(id));
      else this.dashboard.set(await this.staff.dashboard());
    } finally { this.loading.set(false); }
  }
}
