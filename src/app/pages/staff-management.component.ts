import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-staff-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe, DecimalPipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Smart staff management</span>
          <h2>Commission, attendance, shifts, performance, incentives and payroll</h2>
          <p>Staff intelligence calculates from saved sales, appointments, shifts and attendance records.</p>
        </div>
        <div class="hero-actions">
          <button class="ghost-button" type="button" (click)="runCommission()">Run commission</button>
          <button class="primary-button" type="button" (click)="exportPayroll()">Export payroll</button>
        </div>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <section class="form-panel">
        <h3>Analysis scope</h3>
        <form [formGroup]="filterForm" (ngSubmit)="load()">
          <label class="field"><span>Period start</span><input type="date" formControlName="periodStart" /></label>
          <label class="field"><span>Period end</span><input type="date" formControlName="periodEnd" /></label>
          <label class="field">
            <span>Branch</span>
            <select formControlName="branchId">
              <option value="">All branches</option>
              <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option>
            </select>
          </label>
          <div class="form-actions">
            <button class="primary-button" type="submit">Refresh</button>
          </div>
        </form>
      </section>

      <ng-container *ngIf="summary() as summary">
        <div class="metrics-grid">
          <article class="metric-card teal">
            <span>Total revenue</span>
            <strong>{{ summary.metrics.totalRevenue | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>{{ summary.metrics.staffCount }} active staff</small>
          </article>
          <article class="metric-card amber">
            <span>Commission</span>
            <strong>{{ summary.metrics.totalCommission | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>{{ summary.commission.entries.length }} commission lines</small>
          </article>
          <article class="metric-card green">
            <span>Incentives</span>
            <strong>{{ summary.metrics.totalIncentives | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>Dynamic bonus engine</small>
          </article>
          <article class="metric-card blue">
            <span>Average score</span>
            <strong>{{ summary.metrics.averageScore | number: '1.0-1' }}</strong>
            <small>Productivity ranking</small>
          </article>
          <article class="metric-card violet">
            <span>Present days</span>
            <strong>{{ summary.attendance.presentDays }}</strong>
            <small>{{ summary.attendance.overtimeMinutes }} overtime minutes</small>
          </article>
          <article class="metric-card rose">
            <span>Planned shifts</span>
            <strong>{{ summary.metrics.scheduledShifts }}</strong>
            <small>Shift planner</small>
          </article>
        </div>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">AI staff insights</span>
              <h2>Performance recommendations</h2>
            </div>
          </div>
          <div class="quick-grid">
            <article class="action-card" *ngFor="let insight of summary.insights">
              <strong>{{ insight }}</strong>
              <span>Generated from saved operational data</span>
            </article>
          </div>
        </section>

        <div class="dashboard-grid">
          <section class="panel">
            <div class="section-title"><h2>Performance ranking</h2></div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Staff</th><th>Score</th><th>Revenue</th><th>Bookings</th><th>Efficiency</th><th>Attendance</th></tr>
                </thead>
                <tbody>
                  <tr *ngFor="let person of summary.ranking">
                    <td><strong>{{ person.name }}</strong><small>{{ person.role }}</small></td>
                    <td>{{ person.performanceScore | number: '1.0-1' }}</td>
                    <td>{{ person.revenue | currency: 'INR':'symbol':'1.0-0' }}</td>
                    <td>{{ person.bookings }}</td>
                    <td>{{ person.serviceEfficiency | number: '1.0-1' }}%</td>
                    <td>{{ person.attendanceScore | number: '1.0-1' }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="panel">
            <div class="section-title"><h2>Incentive calculation</h2></div>
            <div class="rank-list">
              <article *ngFor="let row of summary.incentives.rows">
                <div>
                  <strong>{{ row.name }}</strong>
                  <span>{{ row.reason }}</span>
                </div>
                <div class="right">
                  <strong>{{ row.incentive | currency: 'INR':'symbol':'1.0-0' }}</strong>
                  <small>{{ row.commission | currency: 'INR':'symbol':'1.0-0' }} commission</small>
                </div>
              </article>
            </div>
          </section>
        </div>
      </ng-container>

      <div class="dashboard-grid">
        <section class="form-panel">
          <h3>Attendance tracking</h3>
          <form [formGroup]="attendanceForm" (ngSubmit)="saveAttendance()">
            <label class="field">
              <span>Staff</span>
              <select formControlName="staffId">
                <option value="">Select staff</option>
                <option *ngFor="let person of staff()" [value]="person.id">{{ person.name }}</option>
              </select>
            </label>
            <label class="field"><span>Date</span><input type="date" formControlName="date" /></label>
            <label class="field">
              <span>Status</span>
              <select formControlName="status">
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="half-day">Half day</option>
              </select>
            </label>
            <label class="field"><span>Clock in</span><input type="time" formControlName="clockIn" /></label>
            <label class="field"><span>Clock out</span><input type="time" formControlName="clockOut" /></label>
            <label class="field full"><span>Notes</span><textarea formControlName="notes"></textarea></label>
            <div class="form-actions">
              <button class="primary-button" type="submit" [disabled]="attendanceForm.invalid || saving()">Save attendance</button>
            </div>
          </form>
        </section>

        <section class="form-panel">
          <h3>Shift planner</h3>
          <form [formGroup]="shiftForm" (ngSubmit)="saveShift()">
            <label class="field">
              <span>Staff</span>
              <select formControlName="staffId">
                <option value="">Select staff</option>
                <option *ngFor="let person of staff()" [value]="person.id">{{ person.name }}</option>
              </select>
            </label>
            <label class="field">
              <span>Branch</span>
              <select formControlName="branchId">
                <option value="">Select branch</option>
                <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option>
              </select>
            </label>
            <label class="field"><span>Date</span><input type="date" formControlName="date" /></label>
            <label class="field"><span>Start</span><input type="time" formControlName="startTime" /></label>
            <label class="field"><span>End</span><input type="time" formControlName="endTime" /></label>
            <label class="field"><span>Chair / room</span><input formControlName="chair" /></label>
            <div class="form-actions">
              <button class="primary-button" type="submit" [disabled]="shiftForm.invalid || saving()">Plan shift</button>
            </div>
          </form>
        </section>
      </div>

      <section class="panel" *ngIf="summary() as summary">
        <div class="section-title"><h2>Payroll preview</h2></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Staff</th><th>Present</th><th>Minutes</th><th>Revenue</th><th>Commission</th><th>Incentive</th><th>Gross payout</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of summary.payrollPreview">
                <td><strong>{{ row.name }}</strong><small>{{ row.role }}</small></td>
                <td>{{ row.presentDays }}</td>
                <td>{{ row.minutesWorked }}</td>
                <td>{{ row.revenue | currency: 'INR':'symbol':'1.0-0' }}</td>
                <td>{{ row.commission | currency: 'INR':'symbol':'1.0-0' }}</td>
                <td>{{ row.incentive | currency: 'INR':'symbol':'1.0-0' }}</td>
                <td>{{ row.grossPayout | currency: 'INR':'symbol':'1.0-0' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre class="export-preview" *ngIf="payrollCsv()">{{ payrollCsv() }}</pre>
      </section>

      <section class="panel">
        <div class="section-title"><h2>Recent commission and payroll runs</h2></div>
        <div class="activity-list">
          <article *ngFor="let run of commissionRuns()">
            <strong>{{ run.id }} · {{ run.periodStart }} to {{ run.periodEnd }}</strong>
            <span>{{ run.summary?.totalCommission | currency: 'INR':'symbol':'1.0-0' }} commission · {{ run.status }}</span>
          </article>
          <article *ngFor="let item of payrollRuns()">
            <strong>{{ item.id }} · {{ item.periodStart }} to {{ item.periodEnd }}</strong>
            <span>{{ item.totals?.grossPayout | currency: 'INR':'symbol':'1.0-0' }} payout · {{ item.status }}</span>
          </article>
        </div>
      </section>
    </section>
  `
})
export class StaffManagementComponent implements OnInit {
  readonly summary = signal<ApiRecord | null>(null);
  readonly staff = signal<ApiRecord[]>([]);
  readonly branches = signal<ApiRecord[]>([]);
  readonly commissionRuns = signal<ApiRecord[]>([]);
  readonly payrollRuns = signal<ApiRecord[]>([]);
  readonly payrollCsv = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly filterForm = this.fb.group({
    periodStart: [this.defaultStart()],
    periodEnd: [new Date().toISOString().slice(0, 10)],
    branchId: ['']
  });

  readonly attendanceForm = this.fb.group({
    staffId: ['', Validators.required],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    status: ['present', Validators.required],
    clockIn: ['10:00'],
    clockOut: ['19:00'],
    notes: ['']
  });

  readonly shiftForm = this.fb.group({
    staffId: ['', Validators.required],
    branchId: ['', Validators.required],
    date: [this.tomorrow(), Validators.required],
    startTime: ['10:00', Validators.required],
    endTime: ['19:00', Validators.required],
    chair: ['']
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.filterForm.patchValue({ branchId: this.api.selectedBranchId() });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const filters = this.filterForm.value;
    Promise.all([
      this.api.list<ApiRecord[]>('staff', { branchId: filters.branchId || this.api.selectedBranchId() }).toPromise(),
      this.api.list<ApiRecord[]>('branches').toPromise(),
      this.api.list<ApiRecord>('staff-management/summary', filters).toPromise(),
      this.api.list<ApiRecord>('staff-management/runs', { limit: 5 }).toPromise()
    ])
      .then(([staff, branches, summary, runs]) => {
        this.staff.set(staff || []);
        this.branches.set(branches || []);
        this.summary.set(summary || null);
        this.commissionRuns.set(runs?.commissionRuns || []);
        this.payrollRuns.set(runs?.payrollExports || []);
        this.loading.set(false);
      })
      .catch((error) => {
        this.error.set(error?.error?.error || 'Unable to load smart staff management');
        this.loading.set(false);
      });
  }

  saveAttendance(): void {
    if (this.attendanceForm.invalid) return;
    this.saving.set(true);
    this.api.post('staff-management/attendance', this.attendanceForm.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to save attendance');
        this.saving.set(false);
      }
    });
  }

  saveShift(): void {
    if (this.shiftForm.invalid) return;
    this.saving.set(true);
    this.api.post('staff-management/shifts', this.shiftForm.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to plan shift');
        this.saving.set(false);
      }
    });
  }

  runCommission(): void {
    this.saving.set(true);
    this.api.post('staff-management/commissions/run', this.filterForm.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to run commission engine');
        this.saving.set(false);
      }
    });
  }

  exportPayroll(): void {
    this.saving.set(true);
    this.api.post<ApiRecord>('staff-management/payroll/export', this.filterForm.value).subscribe({
      next: (result) => {
        this.payrollCsv.set(result.csv || '');
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to export payroll');
        this.saving.set(false);
      }
    });
  }

  private defaultStart(): string {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return date.toISOString().slice(0, 10);
  }

  private tomorrow(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }
}
