import { CurrencyPipe, DatePipe } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffDashboard, StaffEnterpriseOs } from "../../core/staff-app.service";

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, IonSpinner],
  template: `
    <section class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Dashboard</p>
          <h1>{{ os()?.home?.greeting || data()?.staff?.fullName || 'Staff dashboard' }}</h1>
          <p>Overview only. Use the sidebar for detailed pages.</p>
        </div>
        <div class="row-actions"><button type="button" class="link-button" (click)="toggleCustomizer()">Customize</button><a class="button primary" routerLink="/staff/appointments">Open appointments</a></div>
      </header>

      @if (customizerOpen()) {
        <section class="panel compact-panel">
          <div class="panel-title"><h2>Dashboard widgets</h2><span>show / hide</span></div>
          <div class="row-actions">
            @for (widget of widgets; track widget.key) { <button type="button" class="link-button" [class.active-toggle]="showWidget(widget.key)" (click)="toggleWidget(widget.key)">{{ widget.label }}</button> }
          </div>
        </section>
      }

      @if (loading()) {
        <section class="state"><ion-spinner name="crescent" /> Loading dashboard...</section>
      } @else if (staff.error()) {
        <section class="notice">{{ staff.error() }}</section>
      }

      @if (data(); as dashboard) {
        @if (showWidget('briefing')) {
          <section class="panel dark">
            <div class="panel-title"><h2>AI daily briefing</h2><span>{{ os()?.home?.recentNotifications || 0 }} alerts</span></div>
            <p>{{ dailyBriefing() }}</p>
          </section>
        }

        @if (showWidget('kpis')) { <section class="grid four">
          <article class="kpi"><span>Today's KPIs</span><strong>{{ dashboard.summary.todayAppointments }}</strong><small>assigned bookings</small></article>
          <article class="kpi"><span>Live</span><strong>{{ dashboard.summary.liveAppointments }}</strong><small>active services</small></article>
          <article class="kpi"><span>Completed</span><strong>{{ dashboard.summary.completedAppointments }}</strong><small>current report window</small></article>
          @if (canSeeRevenue()) {
            <article class="kpi"><span>Today's Revenue</span><strong>{{ os()?.home?.expectedRevenue || dashboard.summary.revenue | currency:'INR':'symbol':'1.0-0' }}</strong><small>connected sales/bookings</small></article>
          }
        </section> }

        @if (showWidget('target') || showWidget('actions')) { <section class="grid two">
          @if (showWidget('target')) {
          <article class="panel dark">
            <div class="panel-title"><h2>Today's target</h2><span>{{ os()?.home?.targetProgress?.percentage || 0 }}%</span></div>
            <p>{{ os()?.home?.targetProgress?.label || 'Target progress' }}</p>
            <h2>{{ os()?.home?.targetProgress?.achievedValue || 0 }} / {{ os()?.home?.targetProgress?.targetValue || 0 }}</h2>
          </article>
          }

          @if (showWidget('actions')) {
          <article class="panel">
            <div class="panel-title"><h2>Quick actions</h2><span>instant</span></div>
            <div class="row-actions">
              <a class="button" routerLink="/staff/attendance">Clock in/out</a>
              <a class="button" routerLink="/staff/tasks">Tasks</a>
              <a class="button" routerLink="/staff/leaves">Request leave</a>
              <a class="button" routerLink="/staff/ai-coach">AI coach</a>
            </div>
          </article>
          }
        </section> }

        @if (showWidget('appointments') || showWidget('notifications')) { <section class="grid two">
          @if (showWidget('appointments')) {
          <article class="panel">
            <div class="panel-title"><h2>Upcoming appointments</h2><span>{{ dashboard.todayAppointments.length }}</span></div>
            <div class="list">
              @for (item of dashboard.todayAppointments.slice(0, 5); track item.id) {
                <div class="row">
                  <div class="row-main"><strong>{{ item.clientName || 'Walk-in client' }}</strong><small>{{ item.startAt | date:'shortTime' }} · {{ item.serviceNames.join(', ') || 'Service' }}</small></div>
                  <a class="button" [routerLink]="['/staff/client-360', item.clientId]">Client 360</a>
                </div>
              } @empty {
                <p class="empty">No upcoming appointments assigned today.</p>
              }
            </div>
          </article>
          }

          @if (showWidget('notifications')) {
          <article class="panel">
            <div class="panel-title"><h2>Recent notifications</h2><span>{{ os()?.notifications?.length || 0 }}</span></div>
            <div class="list">
              @for (note of os()?.notifications?.slice(0, 4) || []; track note.id) {
                <div class="row"><div class="row-main"><strong>{{ note.title }}</strong><small>{{ note.body || note.status }}</small></div><span class="badge">{{ note.status }}</span></div>
              } @empty {
                <p class="empty">No recent notifications.</p>
              }
            </div>
          </article>
          }
        </section> }

        @if (showWidget('ai') || showWidget('performance')) { <section class="grid two">
          @if (showWidget('ai')) {
          <article class="panel">
            <div class="panel-title"><h2>AI summary</h2><span>{{ os()?.aiCoach?.length || 0 }} cues</span></div>
            @if (os()?.aiCoach?.[0]; as card) {
              <p class="insight"><b>{{ card.title }}:</b> {{ card.body }} {{ card.action }}</p>
            } @else {
              <p class="empty">AI summary will appear after staff data is connected.</p>
            }
          </article>
          }

          @if (showWidget('performance')) {
          <article class="panel">
            <div class="panel-title"><h2>Performance snapshot</h2><span>{{ os()?.performance?.productivityScore || 0 }}/100</span></div>
            <div class="grid three">
              <article class="kpi"><span>Services</span><strong>{{ os()?.performance?.completedServices || dashboard.summary.completedAppointments }}</strong></article>
              <article class="kpi"><span>Utilization</span><strong>{{ os()?.performance?.avgUtilization || 0 }}%</strong></article>
              <article class="kpi"><span>Rating</span><strong>{{ os()?.performance?.avgRating || '-' }}</strong></article>
            </div>
          </article>
          }
        </section> }
      }
    </section>
  `,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffDashboardPage implements OnInit {
  readonly data = signal<StaffDashboard | null>(null);
  readonly os = signal<StaffEnterpriseOs | null>(null);
  readonly loading = signal(false);
  readonly customizerOpen = signal(false);
  readonly hiddenWidgets = signal<Set<string>>(this.readHiddenWidgets());
  readonly widgets = [
    { key: "briefing", label: "AI briefing" },
    { key: "kpis", label: "KPIs" },
    { key: "target", label: "Target" },
    { key: "actions", label: "Quick actions" },
    { key: "appointments", label: "Appointments" },
    { key: "notifications", label: "Notifications" },
    { key: "ai", label: "AI summary" },
    { key: "performance", label: "Performance" }
  ];

  constructor(readonly staff: StaffAppService) {}

  ngOnInit() { void this.load(); }

  async load() {
    this.loading.set(true);
    try {
      const [dashboard, enterprise] = await Promise.all([this.staff.dashboard(), this.staff.enterpriseOs()]);
      this.data.set(dashboard);
      this.os.set(enterprise);
    } finally {
      this.loading.set(false);
    }
  }

  canSeeRevenue(): boolean {
    return this.staff.hasAnyPermission(["read:finance", "read:sales", "read:payments", "read:invoices"]);
  }

  showWidget(key: string): boolean {
    return !this.hiddenWidgets().has(key);
  }

  toggleCustomizer() {
    this.customizerOpen.update((open) => !open);
  }

  toggleWidget(key: string) {
    const next = new Set(this.hiddenWidgets());
    if (next.has(key)) next.delete(key); else next.add(key);
    this.hiddenWidgets.set(next);
    localStorage.setItem("auraStaffDashboardHidden", JSON.stringify([...next]));
  }

  dailyBriefing(): string {
    const home = this.os()?.home;
    const coach = this.os()?.aiCoach?.[0];
    if (!home) return "Your connected staff briefing will appear once today's data is available.";
    return `${home.todayAppointments} bookings today, ${home.tasks} open tasks, ${home.vipClients} VIP signals, ${home.pendingPayments} payment alerts. ${coach?.action || 'Focus on premium client experience.'}`;
  }

  private readHiddenWidgets(): Set<string> {
    try {
      const parsed = JSON.parse(localStorage.getItem("auraStaffDashboardHidden") || "[]");
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }
}
