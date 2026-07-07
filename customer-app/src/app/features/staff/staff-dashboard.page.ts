import { CurrencyPipe, DatePipe } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffAttendance, StaffDashboard, StaffEnterpriseOs, StaffToday } from "../../core/staff-app.service";

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, IonSpinner],
  template: `
    <section class="page">
      <section class="staff-home-hero">
        <div class="hero-main">
          <p class="eyebrow">Staff home</p>
          <h1>{{ os()?.home?.greeting || ('Good to see you, ' + (staff.user()?.name || 'Staff')) }}</h1>
          <p>Attendance, appointments, tasks, client signals, and AI coach for today's floor work.</p>
          <div class="row-actions hero-actions">
            <button type="button" class="link-button" [disabled]="loading() || sessionExpired()" (click)="clockAction()">{{ clockButtonLabel() }}</button>
            <a class="button primary" routerLink="/staff/appointments">Open appointments</a>
            <a class="button" routerLink="/staff/client-360">Client 360</a>
          </div>
        </div>
        <div class="attendance-spotlight">
          <span>Attendance</span>
          <strong>{{ attendanceLabel() }}</strong>
          <small>{{ attendanceHint() }}</small>
          <div class="attendance-meta">
            <b>Shift</b>
            <p>{{ shiftLabel() }}</p>
          </div>
        </div>
      </section>

      <section class="basic-home-grid">
        <a class="basic-home-card" routerLink="/staff/attendance"><span>Attendance</span><strong>{{ attendanceLabel() }}</strong><small>{{ attendanceHint() }}</small></a>
        <a class="basic-home-card" routerLink="/staff/queue"><span>Today's queue</span><strong>{{ data()?.summary?.todayAppointments || os()?.home?.todayAppointments || 0 }}</strong><small>{{ data()?.summary?.liveAppointments || 0 }} live services</small></a>
        <a class="basic-home-card" routerLink="/staff/tasks"><span>Tasks</span><strong>{{ openTaskCount() }}</strong><small>open follow-ups</small></a>
        <a class="basic-home-card" routerLink="/staff/calendar"><span>Shift</span><strong>{{ shiftStartLabel() }}</strong><small>{{ shiftLabel() }}</small></a>
        <a class="basic-home-card wide" routerLink="/staff/appointments"><span>Next client</span><strong>{{ nextClientLabel() }}</strong><small>{{ nextClientHint() }}</small></a>
        <a class="basic-home-card wide ai" routerLink="/staff/ai-coach"><span>AI coach</span><strong>{{ aiCoachTitle() }}</strong><small>{{ aiCoachHint() }}</small></a>
      </section>

      @if (customizerOpen()) {
        <section class="panel compact-panel">
          <div class="panel-title"><h2>Dashboard widgets</h2><span>show / hide / drag</span></div>
          <div class="row-actions">
            @for (widget of orderedWidgets(); track widget.key) { <button type="button" class="link-button" draggable="true" [class.active-toggle]="showWidget(widget.key)" [attr.aria-pressed]="showWidget(widget.key)" (click)="toggleWidget(widget.key)" (dragstart)="dragWidget(widget.key)" (dragover)="$event.preventDefault()" (drop)="dropWidget(widget.key)">{{ widget.label }}</button> }
          </div>
        </section>
      }

      @if (loading()) {
        <section class="state"><ion-spinner name="crescent" /> Loading dashboard...</section>
      } @else if (actionMessage()) {
        <section class="notice success">{{ actionMessage() }}</section>
      } @else if (staff.error() && sessionExpired()) {
        <section class="session-card">
          <p class="eyebrow">Session expired</p>
          <h2>Please login again to sync live staff data.</h2>
          <p>{{ staff.error() }}</p>
          <a class="button primary" routerLink="/staff/login">Open staff login</a>
        </section>
      } @else if (staff.error()) {
        <section class="notice">{{ staff.error() }}</section>
      }

      @if (data(); as dashboard) {
        @if (showWidget('briefing')) {
          <section class="panel dark" [style.order]="widgetOrder('briefing')">
            <div class="panel-title"><h2>AI daily briefing</h2><span>{{ os()?.home?.recentNotifications || 0 }} alerts</span></div>
            <p>{{ dailyBriefing() }}</p>
          </section>
        }

        @if (showWidget('kpis')) { <section class="grid four" [style.order]="widgetOrder('kpis')">
          <article class="kpi"><span>Today's KPIs</span><strong>{{ dashboard.summary.todayAppointments }}</strong><small>assigned bookings</small></article>
          <article class="kpi"><span>Live</span><strong>{{ dashboard.summary.liveAppointments }}</strong><small>active services</small></article>
          <article class="kpi"><span>Completed</span><strong>{{ dashboard.summary.completedAppointments }}</strong><small>current report window</small></article>
          @if (canSeeRevenue()) {
            <article class="kpi"><span>Today's Revenue</span><strong>{{ os()?.home?.expectedRevenue || dashboard.summary.revenue | currency:'INR':'symbol':'1.0-0' }}</strong><small>connected sales/bookings</small></article>
          }
        </section> }

        @if (showWidget('target') || showWidget('actions')) { <section class="grid two" [style.order]="widgetOrder('target')">
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

        @if (showWidget('appointments') || showWidget('notifications')) { <section class="grid two" [style.order]="widgetOrder('appointments')">
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

        @if (showWidget('ai') || showWidget('performance')) { <section class="grid two" [style.order]="widgetOrder('ai')">
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
  readonly today = signal<StaffToday | null>(null);
  readonly loading = signal(false);
  readonly sessionExpired = signal(false);
  readonly actionMessage = signal("");
  readonly customizerOpen = signal(false);
  readonly hiddenWidgets = signal<Set<string>>(this.readHiddenWidgets());
  readonly draggedWidget = signal("");
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
  readonly widgetOrderKeys = signal<string[]>(this.readWidgetOrder());

  constructor(readonly staff: StaffAppService) {}

  ngOnInit() { void this.load(); }

  async load() {
    this.loading.set(true);
    this.sessionExpired.set(false);
    try {
      const [dashboard, enterprise, today] = await Promise.all([this.staff.dashboard(), this.staff.enterpriseOs(), this.staff.today()]);
      this.data.set(dashboard);
      this.os.set(enterprise);
      this.today.set(today);
    } catch (error) {
      const message = this.staff.error() || (error instanceof Error ? error.message : "");
      this.sessionExpired.set(/jwt|expired|session|401/i.test(message));
    } finally {
      this.loading.set(false);
    }
  }

  async clockAction() {
    this.actionMessage.set("");
    try {
      const open = this.openAttendance();
      if (open) await this.staff.clockOut(open.id);
      else await this.staff.clockIn();
      this.actionMessage.set(open ? "Clocked out." : "Clocked in.");
      await this.load();
    } catch {
      this.actionMessage.set(this.staff.error() || "Attendance update failed.");
    }
  }

  canSeeRevenue(): boolean {
    return this.staff.hasAnyPermission(["read:finance", "read:sales", "read:payments", "read:invoices"]);
  }

  unreadCount(): number {
    return (this.os()?.notifications || []).filter((note) => String(note.status || "unread") !== "read").length;
  }

  attendanceLabel(): string {
    return this.openAttendance() ? "Clocked in" : "Not clocked in";
  }

  attendanceHint(): string {
    const open = this.openAttendance();
    if (this.sessionExpired()) return "Login required";
    if (open?.clockInAt) return `Since ${this.timeLabel(open.clockInAt)}`;
    return this.today()?.attendance?.length ? "Last attendance synced" : "Ready to start shift";
  }

  clockButtonLabel(): string {
    return this.openAttendance() ? "Clock out" : "Clock in";
  }

  shiftLabel(): string {
    const shift = this.today()?.schedules?.[0];
    if (!shift) return "No shift assigned";
    return `${shift.startTime || "--"} - ${shift.endTime || "--"} · ${shift.status || "scheduled"}`;
  }

  shiftStartLabel(): string {
    return this.today()?.schedules?.[0]?.startTime || "--";
  }

  openTaskCount(): number {
    const tasks = this.today()?.tasks || this.os()?.tasks || [];
    return tasks.filter((task) => String(task.status || "open").toLowerCase() !== "completed").length;
  }

  nextClientLabel(): string {
    const item = this.data()?.todayAppointments?.[0];
    return item?.clientName || "No client queued";
  }

  nextClientHint(): string {
    const item = this.data()?.todayAppointments?.[0];
    if (!item) return "Appointments will appear here";
    return `${this.timeLabel(item.startAt)} · ${item.serviceNames?.join(", ") || "Service"}`;
  }

  aiCoachTitle(): string {
    return this.os()?.aiCoach?.[0]?.title || "Daily focus";
  }

  aiCoachHint(): string {
    return this.os()?.aiCoach?.[0]?.action || "Complete attendance, check queue, and review client notes.";
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

  orderedWidgets() {
    const byKey = new Map(this.widgets.map((widget) => [widget.key, widget]));
    return this.widgetOrderKeys().map((key) => byKey.get(key)).filter(Boolean) as typeof this.widgets;
  }

  widgetOrder(key: string): number {
    const index = this.widgetOrderKeys().indexOf(key);
    return index >= 0 ? index + 10 : 99;
  }

  dragWidget(key: string) {
    this.draggedWidget.set(key);
  }

  dropWidget(targetKey: string) {
    const sourceKey = this.draggedWidget();
    if (!sourceKey || sourceKey === targetKey) return;
    const next = this.widgetOrderKeys().filter((key) => key !== sourceKey);
    const targetIndex = Math.max(0, next.indexOf(targetKey));
    next.splice(targetIndex, 0, sourceKey);
    this.widgetOrderKeys.set(next);
    this.draggedWidget.set("");
    localStorage.setItem("auraStaffDashboardOrder", JSON.stringify(next));
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

  private readWidgetOrder(): string[] {
    const defaults = this.widgets.map((widget) => widget.key);
    try {
      const parsed = JSON.parse(localStorage.getItem("auraStaffDashboardOrder") || "[]");
      const saved = Array.isArray(parsed) ? parsed.filter((key) => defaults.includes(key)) : [];
      return [...saved, ...defaults.filter((key) => !saved.includes(key))];
    } catch {
      return defaults;
    }
  }

  private openAttendance(): StaffAttendance | null {
    return this.today()?.attendance?.find((item) => !item.clockOutAt && !/out|closed|complete/i.test(String(item.status || ""))) || null;
  }

  private timeLabel(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || "--";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}
