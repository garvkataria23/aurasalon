import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiRecord, ApiService } from '../core/api.service';
import { AuthSessionService } from '../core/auth-session.service';
import { AppStateService } from '../core/state/app-state.service';

type StaffSelfDashboard = {
  staff: ApiRecord;
  identityIds: string[];
  range: { from: string; to: string; date: string };
  summary: ApiRecord;
  liveAppointments: ApiRecord[];
  todayAppointments: ApiRecord[];
  workReport: ApiRecord[];
  appointments: ApiRecord[];
  sales: ApiRecord[];
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="staff-workspace">
      <header class="hero">
        <div>
          <p class="eyebrow">Staff workspace</p>
          <h1>My live appointments and work report</h1>
          <p>{{ staffName() }} can see only their own bookings, completed services and sales handoff.</p>
        </div>
        <div class="hero-actions">
          <a class="ghost" routerLink="/appointments">Calendar</a>
          <a class="ghost" routerLink="/staff-os/mobile-preview">Mobile preview</a>
          <button class="primary" type="button" (click)="load()">Refresh</button>
        </div>
      </header>

      <section class="filters" aria-label="Staff report filters">
        <label>
          <span>Report from</span>
          <input type="date" [ngModel]="fromDate()" (ngModelChange)="fromDate.set($event); load()" />
        </label>
        <label>
          <span>Report to</span>
          <input type="date" [ngModel]="toDate()" (ngModelChange)="toDate.set($event); load()" />
        </label>
        <label>
          <span>Live date</span>
          <input type="date" [ngModel]="liveDate()" (ngModelChange)="liveDate.set($event); load()" />
        </label>
        <label *ngIf="canSelectStaff()">
          <span>View staff</span>
          <select [ngModel]="selectedStaffId()" (ngModelChange)="selectedStaffId.set($event); load()">
            <option value="">Auto select staff</option>
            <option *ngFor="let staff of staffOptions()" [value]="staff.id">{{ staffLabel(staff) }}</option>
          </select>
        </label>
        <span class="identity">Linked IDs: {{ linkedIds() }}</span>
      </section>

      <div class="state error" *ngIf="error()">{{ error() }}</div>
      <div class="state" *ngIf="loading()">Loading your staff report...</div>

      <section class="metrics" *ngIf="dashboard() as data">
        <article><span>Live now</span><strong>{{ data.summary.liveAppointments || 0 }}</strong><small>active bookings</small></article>
        <article><span>Today</span><strong>{{ data.summary.todayAppointments || 0 }}</strong><small>appointments</small></article>
        <article><span>Completed</span><strong>{{ data.summary.completedAppointments || 0 }}</strong><small>services done</small></article>
        <article><span>Sales</span><strong>{{ data.summary.revenue || 0 | currency:'INR':'symbol-narrow':'1.0-0' }}</strong><small>{{ data.summary.salesCount || 0 }} bills</small></article>
      </section>

      <section class="grid" *ngIf="dashboard() as data">
        <article class="panel">
          <header>
            <div>
              <p class="eyebrow">Live appointments</p>
              <h2>Today queue</h2>
            </div>
            <span>{{ data.range.date }}</span>
          </header>
          <div class="appointment-list" *ngIf="data.liveAppointments.length; else noLive">
            <div class="booking" *ngFor="let booking of data.liveAppointments">
              <time>{{ booking.startAt | date:'shortTime' }} - {{ booking.endAt | date:'shortTime' }}</time>
              <strong>{{ booking.clientName }}</strong>
              <span>{{ serviceText(booking) }}</span>
              <small>{{ booking.status }} · {{ booking.chair || 'No chair' }}</small>
            </div>
          </div>
          <ng-template #noLive><div class="empty">No live appointment for this staff on selected date.</div></ng-template>
        </article>

        <article class="panel">
          <header>
            <div>
              <p class="eyebrow">Own work report</p>
              <h2>Completed work</h2>
            </div>
            <span>{{ data.workReport.length }} rows</span>
          </header>
          <div class="table" *ngIf="data.workReport.length; else noWork">
            <div class="row head"><span>Time</span><span>Client</span><span>Services</span><span>Status</span></div>
            <div class="row" *ngFor="let booking of data.workReport">
              <span>{{ booking.startAt | date:'mediumDate' }} {{ booking.startAt | date:'shortTime' }}</span>
              <span>{{ booking.clientName }}</span>
              <span>{{ serviceText(booking) }}</span>
              <span class="badge">{{ booking.status }}</span>
            </div>
          </div>
          <ng-template #noWork><div class="empty">No completed work found in selected range.</div></ng-template>
        </article>
      </section>

      <section class="panel" *ngIf="dashboard() as data">
        <header>
          <div>
            <p class="eyebrow">All appointments</p>
            <h2>Staff-only booking history</h2>
          </div>
          <span>{{ data.appointments.length }} bookings</span>
        </header>
        <div class="table" *ngIf="data.appointments.length; else noAppointments">
          <div class="row head"><span>Date</span><span>Client</span><span>Service</span><span>Status</span></div>
          <div class="row" *ngFor="let booking of data.appointments">
            <span>{{ booking.startAt | date:'medium' }}</span>
            <span>{{ booking.clientName }}</span>
            <span>{{ serviceText(booking) }}</span>
            <span class="badge">{{ booking.status }}</span>
          </div>
        </div>
        <ng-template #noAppointments><div class="empty">No appointment data for this staff in selected range.</div></ng-template>
      </section>
    </section>
  `,
  styles: [`
    .staff-workspace { display: grid; gap: 18px; color: #17212f; }
    .hero, .filters, .panel, .metrics article { background: rgba(255,255,255,.94); border: 1px solid #dbe8e4; border-radius: 8px; box-shadow: 0 16px 38px rgba(15, 23, 42, .08); }
    .hero { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 22px; }
    .hero h1, .panel h2 { margin: 0; letter-spacing: 0; }
    .hero p:not(.eyebrow) { margin: 8px 0 0; color: #64748b; max-width: 760px; }
    .eyebrow { margin: 0 0 6px; color: #2563c7; font-size: 12px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; }
    .hero-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
    .primary, .ghost { border: 1px solid #cfded9; border-radius: 8px; min-height: 42px; padding: 10px 14px; font-weight: 900; text-decoration: none; cursor: pointer; }
    .primary { background: #0f8a7d; color: #fff; border-color: #0f8a7d; }
    .ghost { background: #fff; color: #17212f; }
    .filters { display: grid; grid-template-columns: repeat(4, minmax(160px, 220px)) 1fr; gap: 12px; align-items: end; padding: 14px; }
    label { display: grid; gap: 6px; color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    input, select { border: 1px solid #cfded9; border-radius: 8px; min-height: 42px; padding: 8px 10px; font: inherit; color: #17212f; background: #fff; min-width: 0; }
    .identity { color: #64748b; font-size: 13px; justify-self: end; overflow-wrap: anywhere; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metrics article { display: grid; gap: 7px; min-height: 112px; padding: 16px; border-top: 4px solid #0f8a7d; }
    .metrics span, .metrics small { color: #64748b; font-weight: 800; }
    .metrics strong { font-size: 30px; line-height: 1; }
    .grid { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 14px; }
    .panel { padding: 16px; display: grid; gap: 14px; min-width: 0; }
    .panel header { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #edf3f1; padding-bottom: 12px; }
    .panel header > span { color: #64748b; font-weight: 800; }
    .appointment-list { display: grid; gap: 10px; }
    .booking { border: 1px solid #dbe8e4; border-left: 4px solid #0f8a7d; border-radius: 8px; padding: 12px; display: grid; gap: 5px; }
    .booking time { color: #0f766e; font-weight: 900; }
    .booking span, .booking small, .empty, .state { color: #64748b; }
    .table { display: grid; overflow: auto; }
    .row { display: grid; grid-template-columns: 1.1fr 1fr 1.2fr .7fr; gap: 12px; min-width: 760px; border-bottom: 1px solid #edf3f1; padding: 11px 0; align-items: center; }
    .row.head { color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .badge { border: 1px solid #b7dfd8; border-radius: 999px; color: #0f766e; font-size: 12px; font-weight: 900; padding: 4px 9px; width: fit-content; }
    .empty, .state { border: 1px dashed #dbe8e4; border-radius: 8px; padding: 18px; text-align: center; }
    .error { color: #b42318; border-color: #f2b8ad; background: #fff8f7; }
    @media (max-width: 900px) {
      .hero, .panel header { align-items: flex-start; flex-direction: column; }
      .filters, .metrics, .grid { grid-template-columns: 1fr; }
      .identity { justify-self: start; }
    }
  `]
})
export class StaffMyWorkComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly session = inject(AuthSessionService);
  private readonly appState = inject(AppStateService);
  private readonly route = inject(ActivatedRoute);

  readonly dashboard = signal<StaffSelfDashboard | null>(null);
  readonly staffOptions = signal<ApiRecord[]>([]);
  readonly selectedStaffId = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly liveDate = signal(this.today());
  readonly fromDate = signal(this.shiftDate(-30));
  readonly toDate = signal(this.shiftDate(30));

  readonly staffName = computed(() => {
    const data = this.dashboard();
    return String(data?.staff?.fullName || this.session.currentUser()?.name || 'Staff');
  });
  readonly linkedIds = computed(() => this.dashboard()?.identityIds?.join(', ') || this.session.currentUser()?.staffId || 'Not linked');
  readonly canSelectStaff = computed(() => ['superAdmin', 'owner', 'admin', 'manager'].includes(this.userRole()));

  ngOnInit(): void {
    this.selectedStaffId.set(this.route.snapshot.queryParamMap.get('staffId') || this.session.currentUser()?.staffId || '');
    if (this.canSelectStaff()) {
      this.loadStaffOptions();
      return;
    }
    this.load();
  }

  loadStaffOptions(): void {
    this.api.list<ApiRecord[]>('staff-os/staff', {
      branchId: this.appState.selectedBranchId(),
      status: 'active',
      limit: 200
    }).subscribe({
      next: (staff) => {
        this.staffOptions.set(staff || []);
        if (!this.selectedStaffId() && staff?.[0]?.id) {
          this.selectedStaffId.set(String(staff[0].id));
        }
        this.load();
      },
      error: () => this.load()
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list<StaffSelfDashboard>('staff-self/dashboard', {
      staffId: this.selectedStaffId() || '',
      from: this.fromDate(),
      to: this.toDate(),
      date: this.liveDate()
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (data) => this.dashboard.set(data),
      error: (error) => this.error.set(this.api.errorText(error, 'Unable to load staff work report'))
    });
  }

  staffLabel(staff: ApiRecord): string {
    return String(staff.fullName || staff.name || staff.firstName || staff.id || 'Staff');
  }

  serviceText(booking: ApiRecord): string {
    const names = Array.isArray(booking.serviceNames) ? booking.serviceNames.filter(Boolean) : [];
    return names.length ? names.join(', ') : 'Service not mapped';
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private shiftDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private userRole(): string {
    return String(this.session.currentUser()?.role || this.appState.userRole() || '').trim();
  }
}
