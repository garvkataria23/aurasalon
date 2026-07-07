import { CurrencyPipe, DatePipe } from "@angular/common";
import { Component, OnDestroy, OnInit, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { IonButton, IonContent, IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffAttendance, StaffDashboard, StaffLeave, StaffLeaveBalance, StaffPayrollItem, StaffTarget, StaffToday } from "../../core/staff-app.service";

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, IonButton, IonContent, IonSpinner],
  template: `
    <ion-content class="staff-shell">
      <main class="staff-wrap">
        <header class="hero">
          <div>
            <p class="eyebrow">Staff workspace</p>
            <h1>{{ data()?.staff?.fullName || staff.user()?.name || "My work" }}</h1>
            <p>{{ data()?.staff?.designation || staff.user()?.role }} · permission based staff app</p>
          </div>
          <ion-button fill="clear" (click)="logout()">Logout</ion-button>
        </header>

        @if (staff.loading() && !data()) {
          <section class="state"><ion-spinner name="crescent"></ion-spinner><span>Loading staff data...</span></section>
        } @else if (staff.error()) {
          <section class="notice">{{ staff.error() }}</section>
        }
        @if (message()) {
          <section class="notice success">{{ message() }}</section>
        }

        @if (data(); as dashboard) {
          <section class="metrics">
            <article><span>Today</span><strong>{{ dashboard.summary.todayAppointments }}</strong></article>
            <article><span>Live</span><strong>{{ dashboard.summary.liveAppointments }}</strong></article>
            <article><span>Done</span><strong>{{ dashboard.summary.completedAppointments }}</strong></article>
            @if (canSeeRevenue()) {
              <article><span>Revenue</span><strong>{{ dashboard.summary.revenue | currency:'INR':'symbol':'1.0-0' }}</strong></article>
            }
          </section>

          @if (canUseAttendance()) {
            <section class="panel attendance-card">
              <div class="panel-title"><h2>Attendance today</h2><span>{{ attendanceStatus() }}</span></div>
              <div class="attendance-grid">
                <article><small>Clock in</small><strong>{{ activeOrLatestAttendance()?.clockInAt ? (activeOrLatestAttendance()?.clockInAt | date:'shortTime') : '-' }}</strong></article>
                <article><small>Clock out</small><strong>{{ activeOrLatestAttendance()?.clockOutAt ? (activeOrLatestAttendance()?.clockOutAt | date:'shortTime') : '-' }}</strong></article>
                <article><small>Worked</small><strong>{{ workedLabel() }}</strong></article>
              </div>
              <p class="device-note">Source: {{ activeOrLatestAttendance()?.source || 'waiting for salon device/app punch' }} · auto-refreshes every 30 sec</p>
              <div class="actions">
                @if (!activeAttendance()) {
                  <ion-button size="small" (click)="clockIn()" [disabled]="staff.loading()">Clock in</ion-button>
                } @else {
                  <ion-button size="small" fill="outline" (click)="startBreak()" [disabled]="staff.loading()">Start break</ion-button>
                  <ion-button size="small" fill="outline" (click)="endBreak()" [disabled]="staff.loading()">End break</ion-button>
                  <ion-button size="small" color="danger" (click)="clockOut()" [disabled]="staff.loading()">Clock out</ion-button>
                }
              </div>
            </section>
          }

          <section class="panel">
            <div class="panel-title"><h2>Today appointments</h2><span>{{ dashboard.todayAppointments.length }}</span></div>
            @for (item of dashboard.todayAppointments; track item.id) {
              <article class="appointment">
                <div>
                  <strong>{{ item.clientName }}</strong>
                  <p>{{ item.serviceNames.join(', ') || 'Service' }}</p>
                  <small>{{ item.startAt | date:'shortTime' }} · {{ item.durationMinutes || 0 }} min · {{ item.status }}</small>
                </div>
                <div class="right-stack">
                  @if (canSeeRevenue()) { <span>{{ item.value | currency:'INR':'symbol':'1.0-0' }}</span> }
                  @if (canUpdateAppointments()) {
                    <button type="button" (click)="startService(item.id)">Start</button>
                    <button type="button" (click)="completeService(item.id)">Complete</button>
                  }
                </div>
              </article>
            } @empty {
              <p class="empty">No appointments assigned to you today.</p>
            }
          </section>

          @if (today(); as staffToday) {
            <section class="split">
              <article class="panel">
                <div class="panel-title"><h2>Roster</h2><span>{{ staffToday.schedules.length }}</span></div>
                @for (shift of staffToday.schedules; track shift.id) {
                  <div class="mini-row"><strong>{{ shift.startTime || '-' }} - {{ shift.endTime || '-' }}</strong><span>{{ shift.shiftType || shift.status }}</span></div>
                } @empty {
                  <p class="empty">No rostered shift found today.</p>
                }
              </article>

              @if (staff.hasPermission('read:staff')) {
                <article class="panel">
                  <div class="panel-title"><h2>Tasks</h2><span>{{ staffToday.tasks.length }}</span></div>
                  @for (task of staffToday.tasks; track task.id) {
                    <div class="mini-row">
                      <strong>{{ task.title }}</strong>
                      <span>{{ task.priority || task.status }}</span>
                      @if (canUpdateTasks()) {
                        <button type="button" (click)="completeTask(task.id, task.version)">Done</button>
                      }
                    </div>
                  } @empty {
                    <p class="empty">No open tasks assigned.</p>
                  }
                </article>
              }
            </section>
          }

          <section class="panel">
            <div class="panel-title"><h2>My work report</h2><span>{{ dashboard.workReport.length }}</span></div>
            @for (item of dashboard.workReport.slice(0, 8); track item.id) {
              <article class="appointment compact">
                <div>
                  <strong>{{ item.clientName }}</strong>
                  <p>{{ item.startAt | date:'mediumDate' }} · {{ item.serviceNames.join(', ') || 'Service' }}</p>
                </div>
                <span>{{ item.status }}</span>
              </article>
            } @empty {
              <p class="empty">No completed work found in this range.</p>
            }
          </section>

          <section class="split">
            @if (canSeePayroll()) {
              <article class="panel">
                <div class="panel-title"><h2>Payroll</h2><span>{{ payroll().length }}</span></div>
                @for (item of payroll().slice(0, 4); track item.id) {
                  <div class="mini-row"><strong>{{ payrollAmount(item) | currency:'INR':'symbol':'1.0-0' }}</strong><span>{{ item.status || item.periodEnd }}</span></div>
                } @empty {
                  <p class="empty">No payroll entries yet.</p>
                }
              </article>
            }

            @if (staff.hasPermission('read:staff')) {
              <article class="panel">
                <div class="panel-title"><h2>Targets</h2><span>{{ targets().length }}</span></div>
                @for (target of targets().slice(0, 4); track target.id) {
                  <div class="mini-row"><strong>{{ target.targetName || target.type || target.targetType || 'Target' }}</strong><span>{{ targetProgress(target) }}</span></div>
                } @empty {
                  <p class="empty">No active targets assigned.</p>
                }
              </article>
            }
          </section>

          @if (staff.hasPermission('read:staff')) {
            <section class="split">
              <article class="panel">
                <div class="panel-title"><h2>Leave balance</h2><span>{{ leaveBalances().length }}</span></div>
                @for (balance of leaveBalances().slice(0, 4); track balance.id) {
                  <div class="mini-row"><strong>{{ balance.leaveType }}</strong><span>{{ leaveBalanceValue(balance) }} left</span></div>
                } @empty {
                  <p class="empty">No leave balances configured.</p>
                }
              </article>

              <article class="panel">
                <div class="panel-title"><h2>Leave history</h2><span>{{ leaves().length }}</span></div>
                @for (leave of leaves().slice(0, 4); track leave.id) {
                  <div class="mini-row"><strong>{{ leave.leaveType }} · {{ leave.days || 1 }}d</strong><span>{{ leave.status }}</span></div>
                } @empty {
                  <p class="empty">No leave requests yet.</p>
                }
              </article>
            </section>

            <section class="panel leave-card">
              <div class="panel-title"><h2>Request leave</h2></div>
              <div class="leave-grid">
                <label>Type<input [(ngModel)]="leaveType" placeholder="casual" /></label>
                <label>From<input [(ngModel)]="leaveStart" type="date" /></label>
                <label>To<input [(ngModel)]="leaveEnd" type="date" /></label>
                <label>Reason<input [(ngModel)]="leaveReason" placeholder="Reason" /></label>
              </div>
              <ion-button size="small" (click)="requestLeave()" [disabled]="staff.loading()">Send request</ion-button>
            </section>

            <section class="panel profile">
              <div class="panel-title"><h2>My details</h2></div>
              <p><b>Mobile:</b> {{ dashboard.staff.mobile || '-' }}</p>
              <p><b>Email:</b> {{ dashboard.staff.email || '-' }}</p>
              <p><b>Department:</b> {{ dashboard.staff.department || '-' }}</p>
              <p><b>Status:</b> {{ dashboard.staff.status }}</p>
            </section>
          }
        }
      </main>
    </ion-content>
  `,
  styles: [`
    .staff-shell { --background: #fff8ea; }
    .staff-wrap { width: min(980px, calc(100% - 24px)); margin: 0 auto; padding: 28px 0 80px; }
    .hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 26px; border-radius: 30px; color: #fff; background: linear-gradient(135deg, #271604, #8a5c12); box-shadow: 0 20px 54px rgba(63, 39, 7, .22); }
    .eyebrow { margin: 0 0 8px; color: #f7d98c; font-size: .75rem; font-weight: 950; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(2rem, 6vw, 3.8rem); line-height: .95; }
    .hero p { margin: 10px 0 0; color: #f8e7bd; font-weight: 800; }
    .metrics, .attendance-grid, .split, .leave-grid { display: grid; gap: 12px; }
    .metrics { grid-template-columns: repeat(4, 1fr); margin: 18px 0; }
    .split { grid-template-columns: repeat(2, 1fr); margin-top: 14px; }
    .attendance-grid { grid-template-columns: repeat(3, 1fr); margin: 14px 0; }
    .leave-grid { grid-template-columns: repeat(4, 1fr); margin: 12px 0; }
    .metrics article, .attendance-grid article, .panel, .state, .notice { border: 1px solid #ead2a2; border-radius: 24px; background: rgba(255,255,255,.86); box-shadow: 0 16px 42px rgba(92, 65, 28, .11); }
    .metrics article, .attendance-grid article { padding: 18px; }
    .metrics span, .attendance-grid small { color: #8a611e; font-weight: 900; }
    .metrics strong, .attendance-grid strong { display: block; margin-top: 8px; color: #1d1307; font-size: 1.5rem; }
    .panel { margin-top: 14px; padding: 18px; }
    .panel-title { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .panel-title h2 { margin: 0; color: #1d1307; }
    .panel-title span { color: #8a611e; font-weight: 950; text-transform: capitalize; }
    .appointment, .mini-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 14px 0; border-top: 1px solid #f0dfbf; }
    .appointment:first-of-type, .mini-row:first-of-type { border-top: 0; }
    .appointment strong, .mini-row strong { color: #1d1307; }
    .appointment p, .appointment small, .empty, .profile p, .mini-row span { margin: 4px 0 0; color: #75552b; font-weight: 700; }
    .right-stack { display: grid; justify-items: end; gap: 6px; color: #6e4810; font-weight: 950; white-space: nowrap; }
    .right-stack button { border: 1px solid #d6aa55; border-radius: 999px; background: #fff8ea; color: #6e4810; font-weight: 900; padding: 5px 10px; }
    .mini-row button { border: 1px solid #d6aa55; border-radius: 999px; background: #fff8ea; color: #6e4810; font-weight: 900; padding: 5px 10px; }
    .compact > span { text-transform: capitalize; }
    .device-note { margin: 2px 0 14px; color: #7c5a2c; font-weight: 800; }
    .state, .notice { display: flex; gap: 10px; align-items: center; margin-top: 18px; padding: 18px; color: #6b4a18; font-weight: 900; }
    .success { border-color: #afd8a8; color: #1f6b2d; background: #effbea; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    label { display: grid; gap: 6px; color: #3a2713; font-size: .8rem; font-weight: 900; }
    input { min-height: 42px; border: 1px solid #ead5aa; border-radius: 14px; padding: 0 12px; color: #1d1307; background: #fff; }
    @media (max-width: 720px) { .hero { display: block; } .metrics, .attendance-grid, .split, .leave-grid { grid-template-columns: 1fr; } .appointment { align-items: flex-start; } }
  `]
})
export class StaffDashboardPage implements OnInit, OnDestroy {
  readonly data = signal<StaffDashboard | null>(null);
  readonly today = signal<StaffToday | null>(null);
  readonly payroll = signal<StaffPayrollItem[]>([]);
  readonly targets = signal<StaffTarget[]>([]);
  readonly leaves = signal<StaffLeave[]>([]);
  readonly leaveBalances = signal<StaffLeaveBalance[]>([]);
  readonly message = signal("");
  readonly activeAttendance = computed(() => this.today()?.attendance.find((item) => item.status === "clocked_in") || null);
  readonly activeOrLatestAttendance = computed(() => this.activeAttendance() || this.today()?.attendance[0] || null);
  leaveType = "casual";
  leaveStart = new Date().toISOString().slice(0, 10);
  leaveEnd = new Date().toISOString().slice(0, 10);
  leaveReason = "";
  private refreshTimer = 0;
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === "visible") void this.load(false);
  };

  constructor(readonly staff: StaffAppService, private readonly router: Router) {}

  ngOnInit() {
    void this.load();
    this.refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") void this.load(false);
    }, 15000);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  ngOnDestroy() {
    window.clearInterval(this.refreshTimer);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }

  async load(showErrors = true) {
    const [dashboard, today, payroll, targets, leaves, leaveBalances] = await Promise.allSettled([
      this.staff.dashboard(),
      this.staff.today(),
      this.canSeePayroll() ? this.staff.payroll() : Promise.resolve([]),
      this.staff.hasPermission("read:staff") ? this.staff.targets() : Promise.resolve([]),
      this.staff.hasPermission("read:staff") ? this.staff.leaves() : Promise.resolve([]),
      this.staff.hasPermission("read:staff") ? this.staff.leaveBalances() : Promise.resolve([])
    ]);
    if (dashboard.status === "fulfilled") this.data.set(dashboard.value);
    if (today.status === "fulfilled") this.today.set(today.value);
    if (payroll.status === "fulfilled") this.payroll.set(payroll.value);
    if (targets.status === "fulfilled") this.targets.set(targets.value);
    if (leaves.status === "fulfilled") this.leaves.set(leaves.value);
    if (leaveBalances.status === "fulfilled") this.leaveBalances.set(leaveBalances.value);
    if (!showErrors) this.staff.error.set("");
  }

  canSeeRevenue(): boolean {
    return this.staff.hasAnyPermission(["read:finance", "read:sales", "read:payments", "read:invoices"]);
  }

  canSeePayroll(): boolean {
    return this.staff.hasAnyPermission(["read:payroll", "read:finance"]);
  }

  canUseAttendance(): boolean {
    return this.staff.hasAnyPermission(["allow:staff-checkin-checkout", "write:staff"]);
  }

  canUpdateAppointments(): boolean {
    return this.staff.hasAnyPermission(["update:appointments", "write:appointments"]);
  }

  canUpdateTasks(): boolean {
    return this.staff.hasAnyPermission(["write:staff", "update:staff"]);
  }

  attendanceStatus(): string {
    return this.activeOrLatestAttendance()?.status?.replace(/_/g, " ") || "not clocked in";
  }

  workedLabel(): string {
    const row = this.activeOrLatestAttendance();
    if (!row?.clockInAt) return "-";
    const end = row.clockOutAt ? new Date(row.clockOutAt) : new Date();
    const start = new Date(row.clockInAt);
    const minutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  payrollAmount(item: StaffPayrollItem): number {
    return Number(item.netPay || item.grossPay || 0);
  }

  targetProgress(target: StaffTarget): string {
    const achieved = Number(target.achievedValue || 0);
    const targetValue = Number(target.targetValue || 0);
    return targetValue ? `${achieved}/${targetValue}` : target.status || "active";
  }

  leaveBalanceValue(balance: StaffLeaveBalance): number {
    return Number(balance.balance ?? (Number(balance.openingBalance || 0) + Number(balance.accrued || 0) - Number(balance.used || 0)));
  }

  async clockIn() {
    await this.staff.clockIn().then(() => this.afterAction("Clock-in saved."));
  }

  async clockOut() {
    await this.staff.clockOut(this.activeAttendance()?.id).then(() => this.afterAction("Clock-out saved."));
  }

  async startBreak() {
    await this.staff.startBreak().then(() => this.afterAction("Break started."));
  }

  async endBreak() {
    await this.staff.endBreak().then(() => this.afterAction("Break ended."));
  }

  async startService(appointmentId: string) {
    await this.staff.startService(appointmentId).then(() => this.afterAction("Service started."));
  }

  async completeService(appointmentId: string) {
    await this.staff.completeService(appointmentId).then(() => this.afterAction("Service completed."));
  }

  async requestLeave() {
    await this.staff.requestLeave({ leaveType: this.leaveType, startDate: this.leaveStart, endDate: this.leaveEnd, reason: this.leaveReason })
      .then(() => {
        this.leaveReason = "";
        this.afterAction("Leave request sent.");
      });
  }

  async completeTask(taskId: string, version: number) {
    await this.staff.completeTask(taskId, version).then(() => this.afterAction("Task completed."));
  }

  logout() {
    this.staff.logout();
    void this.router.navigateByUrl("/staff/login");
  }

  private async afterAction(message: string) {
    this.message.set(message);
    await this.load();
  }
}
