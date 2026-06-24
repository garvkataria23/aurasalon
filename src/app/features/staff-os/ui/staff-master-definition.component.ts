import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, computed, effect, signal } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, finalize, forkJoin } from 'rxjs';
import { AppStateService } from '../../../core/state/app-state.service';
import { StaffOsApi } from '../data/staff-os.api';
import {
  StaffOsAttendanceMaster,
  StaffOsBranch,
  StaffOsLeaveMaster,
  StaffOsShiftMaster
} from '../domain/staff-os.models';

type StaffMasterKind = 'attendance' | 'leave' | 'shift';
type MasterRecord = StaffOsAttendanceMaster | StaffOsLeaveMaster | StaffOsShiftMaster;

type MasterConfig = {
  title: string;
  eyebrow: string;
  routeName: string;
  primaryMetric: string;
};

const configs: Record<StaffMasterKind, MasterConfig> = {
  attendance: {
    title: 'Attendance Master',
    eyebrow: 'Employee Masters',
    routeName: 'attendance-masters',
    primaryMetric: 'Attendance codes'
  },
  leave: {
    title: 'Leave Master',
    eyebrow: 'Employee Masters',
    routeName: 'leave-masters',
    primaryMetric: 'Leave policies'
  },
  shift: {
    title: 'Shift Master',
    eyebrow: 'Employee Masters',
    routeName: 'shift-masters',
    primaryMetric: 'Shift templates'
  }
};

@Component({
  selector: 'app-staff-master-definition',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="master-page">
      <header class="topbar">
        <div>
          <p class="eyebrow">{{ config().eyebrow }}</p>
          <h1>{{ config().title }}</h1>
        </div>
        <div class="topbar-actions">
          <a class="ghost" routerLink="/staff-os/employee-masters">Masters</a>
          <button type="button" class="ghost" (click)="load()">Refresh</button>
          <button type="button" class="primary" (click)="startNew()">Add</button>
        </div>
      </header>

      <section class="metric-grid" aria-label="Master summary">
        <article>
          <span>{{ config().primaryMetric }}</span>
          <strong>{{ records().length }}</strong>
        </article>
        <article>
          <span>Visible</span>
          <strong>{{ visibleCount() }}</strong>
        </article>
        <article>
          <span>Hidden</span>
          <strong>{{ hiddenCount() }}</strong>
        </article>
        <article>
          <span>{{ auxiliaryMetricLabel() }}</span>
          <strong>{{ auxiliaryMetricValue() }}</strong>
        </article>
      </section>

      <div class="state" *ngIf="loading()">Loading {{ config().title }}...</div>
      <div class="state error" *ngIf="error()">{{ error() }}</div>

      <section class="master-shell">
        <aside class="list-panel">
          <div class="panel-heading">
            <div>
              <h2>Records</h2>
              <span>{{ filteredRecords().length }} shown</span>
            </div>
            <label class="compact-filter">
              <span>Branch</span>
              <select [value]="branchFilter()" (change)="setBranchFilter($any($event.target).value)">
                <option value="">All</option>
                <option *ngFor="let branch of branchOptions()" [value]="branch.id">{{ branch.name || branch.id }}</option>
              </select>
            </label>
          </div>

          <label class="search-box">
            <span>Search</span>
            <input [value]="search()" (input)="search.set($any($event.target).value)" />
          </label>

          <div class="record-table">
            <button type="button" class="record-row" *ngFor="let record of filteredRecords()" [class.active]="editing()?.id === record.id" (click)="edit(record)">
              <span class="swatch" [style.background]="recordColor(record)"></span>
              <span>
                <strong>{{ record.name }}</strong>
                <small>{{ recordCode(record) }} · {{ recordSubline(record) }}</small>
              </span>
              <i [class.hidden]="record.hide">{{ record.hide ? 'Hidden' : record.status }}</i>
            </button>
            <div class="empty" *ngIf="!filteredRecords().length && !loading()">No records for this filter.</div>
          </div>
        </aside>

        <main class="editor-panel">
          <form [formGroup]="masterForm" (ngSubmit)="save()">
            <div class="form-title">
              <div>
                <p class="eyebrow">{{ editing() ? 'Edit' : 'New' }}</p>
                <h2>{{ editing()?.name || config().title }}</h2>
              </div>
              <label class="hide-toggle">
                <input type="checkbox" formControlName="hide" />
                Hide
              </label>
            </div>

            <label class="field">
              <span>Branch</span>
              <select formControlName="branchId">
                <option value="">All branches</option>
                <option *ngFor="let branch of branchOptions()" [value]="branch.id">{{ branch.name || branch.id }}</option>
              </select>
            </label>

            <label class="field">
              <span>{{ isShift() ? 'Short code' : 'Short Code' }}</span>
              <input formControlName="code" [readonly]="!!editing()" />
              <small *ngIf="!!editing()">Non editable</small>
            </label>

            <label class="field full">
              <span>Name</span>
              <input formControlName="name" />
              <small *ngIf="fieldInvalid('name')">Name is required.</small>
            </label>

            <ng-container *ngIf="isAttendance() || isLeave()">
              <section class="sub-panel full">
                <h3>{{ isAttendance() ? 'Attendance Details' : 'Leave Details' }}</h3>
                <div class="form-grid">
                  <label class="field">
                    <span>Day Count</span>
                    <input type="number" formControlName="dayCount" min="0" step="0.5" />
                  </label>
                  <label class="field">
                    <span>Paid Status</span>
                    <select formControlName="paid">
                      <option [ngValue]="true">Paid</option>
                      <option [ngValue]="false">Un Paid</option>
                    </select>
                  </label>
                  <label class="check-field">
                    <input type="checkbox" formControlName="availableForAppointment" />
                    <span>Available For Appointment</span>
                  </label>
                  <label class="field">
                    <span>Color</span>
                    <input type="color" formControlName="color" />
                  </label>
                </div>
              </section>
            </ng-container>

            <ng-container *ngIf="isLeave()">
              <label class="field">
                <span>No Of Leave</span>
                <input type="number" formControlName="leaveQuota" min="0" step="0.5" />
              </label>
              <label class="field">
                <span>Quota Period</span>
                <select formControlName="quotaPeriod">
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </label>
              <label class="field full">
                <span>Shift</span>
                <select formControlName="shiftTemplateId" (change)="syncSelectedShiftName()">
                  <option value="">No shift mapped</option>
                  <option *ngFor="let shift of shifts()" [value]="shift.id">{{ shift.name }} · {{ shift.startTime }} - {{ shift.endTime }}</option>
                </select>
              </label>
              <label class="check-field">
                <input type="checkbox" formControlName="carryForwardAllowed" />
                <span>Carry Forward</span>
              </label>
              <label class="check-field">
                <input type="checkbox" formControlName="approvalRequired" />
                <span>Approval Required</span>
              </label>
            </ng-container>

            <ng-container *ngIf="isShift()">
              <label class="field full">
                <span>Description</span>
                <input formControlName="description" />
              </label>
              <label class="field">
                <span>Start Time</span>
                <input type="time" formControlName="startTime" />
                <small *ngIf="fieldInvalid('startTime')">Start time is required.</small>
              </label>
              <label class="field">
                <span>End Time</span>
                <input type="time" formControlName="endTime" />
                <small *ngIf="fieldInvalid('endTime')">End time is required.</small>
              </label>
              <label class="field">
                <span>Break Minutes</span>
                <input type="number" formControlName="breakMinutes" min="0" step="5" />
              </label>
              <label class="field">
                <span>Color</span>
                <input type="color" formControlName="color" />
              </label>
              <fieldset class="choice-field full">
                <legend>Shift Type</legend>
                <label><input type="radio" formControlName="shiftType" value="regular" /> Regular</label>
                <label><input type="radio" formControlName="shiftType" value="weekly_off" /> Weekly Off</label>
                <label><input type="radio" formControlName="shiftType" value="holiday" /> Holiday</label>
                <label><input type="radio" formControlName="shiftType" value="leave" /> Leave</label>
              </fieldset>
            </ng-container>

            <label class="field full">
              <span>Notes</span>
              <textarea formControlName="notes" rows="3"></textarea>
            </label>

            <div class="state error full" *ngIf="saveError()">{{ saveError() }}</div>

            <footer class="form-actions">
              <button type="button" class="ghost" (click)="cancel()">Cancel</button>
              <button type="button" class="danger" *ngIf="editing()" [disabled]="saving()" (click)="archiveOrRestore()">
                {{ editing()?.status === 'active' && !editing()?.hide ? 'Archive' : 'Restore' }}
              </button>
              <button type="submit" class="primary" [disabled]="masterForm.invalid || saving()">
                {{ saving() ? 'Saving...' : 'Save' }}
              </button>
            </footer>
          </form>
        </main>
      </section>
    </section>
  `,
  styles: [`
    .master-page { display: grid; gap: 18px; padding: 24px; color: #10201a; }
    .topbar, .panel-heading, .form-title, .form-actions { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
    .topbar h1, .panel-heading h2, .form-title h2, .sub-panel h3 { margin: 0; letter-spacing: 0; }
    .topbar h1 { font-size: 28px; }
    .eyebrow { margin: 0 0 4px; color: #557169; font-size: 12px; font-weight: 900; letter-spacing: 0; text-transform: uppercase; }
    .topbar-actions, .form-actions { align-items: center; flex-wrap: wrap; }
    .primary, .ghost, .danger { border: 1px solid #cbd8d2; border-radius: 7px; cursor: pointer; font: inherit; font-weight: 850; min-height: 38px; padding: 9px 13px; text-decoration: none; }
    .primary { background: #0f766e; border-color: #0f766e; color: #fff; }
    .ghost { background: #fff; color: #0f513f; }
    .danger { background: #fff6f3; border-color: #f0b9aa; color: #a33720; }
    .primary:disabled, .danger:disabled { cursor: wait; opacity: .65; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric-grid article, .list-panel, .editor-panel, .state { border: 1px solid #d9e5de; border-radius: 8px; background: #fff; }
    .metric-grid article { display: grid; gap: 6px; padding: 14px; }
    .metric-grid span, .panel-heading span, .record-row small, .field small { color: #60766d; }
    .metric-grid strong { font-size: 24px; }
    .state, .empty { padding: 14px; color: #60766d; }
    .state.error { border-color: #e6b4a6; color: #a33720; background: #fff8f6; }
    .master-shell { display: grid; grid-template-columns: minmax(320px, .78fr) minmax(520px, 1.22fr); gap: 16px; }
    .list-panel, .editor-panel { display: grid; gap: 14px; padding: 16px; }
    .compact-filter, .search-box, .field { display: grid; gap: 6px; color: #34483f; font-size: 13px; font-weight: 850; }
    .compact-filter { min-width: 180px; }
    input, select, textarea { width: 100%; border: 1px solid #cbd8d2; border-radius: 8px; background: #fff; color: #10201a; font: inherit; padding: 10px 11px; }
    input[readonly] { background: #f3f7f5; color: #68786f; }
    input[type="color"] { min-height: 42px; padding: 4px; }
    textarea { min-height: 84px; resize: vertical; }
    .record-table { display: grid; gap: 8px; max-height: 590px; overflow: auto; padding-right: 2px; }
    .record-row { align-items: center; background: #fbfdfc; border: 1px solid #e2ebe6; border-radius: 8px; color: inherit; cursor: pointer; display: grid; gap: 10px; grid-template-columns: auto minmax(0, 1fr) auto; min-height: 58px; padding: 10px; text-align: left; }
    .record-row.active { border-color: #0f766e; box-shadow: 0 0 0 2px rgba(15, 118, 110, .12); }
    .record-row strong, .record-row small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .record-row i { border-radius: 999px; background: #eef7f2; color: #1d6649; font-size: 11px; font-style: normal; font-weight: 900; padding: 5px 8px; text-transform: uppercase; }
    .record-row i.hidden { background: #fff0ed; color: #9e321d; }
    .swatch { width: 18px; height: 18px; border: 1px solid rgba(16, 32, 26, .15); border-radius: 5px; }
    form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .full, .form-title, .form-actions { grid-column: 1 / -1; }
    .sub-panel { border: 1px solid #e2ebe6; border-radius: 8px; background: #f8fbf9; display: grid; gap: 12px; padding: 14px; }
    .form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .check-field { align-items: center; border: 1px solid #edf2ef; border-radius: 8px; color: #34483f; display: grid; font-size: 13px; font-weight: 850; gap: 8px; grid-template-columns: auto 1fr; min-height: 43px; padding: 10px 11px; }
    .check-field input, .hide-toggle input, .choice-field input { width: auto; }
    .hide-toggle { align-items: center; color: #34483f; display: inline-flex; font-size: 13px; font-weight: 850; gap: 8px; }
    .choice-field { border: 1px solid #e2ebe6; border-radius: 8px; display: flex; gap: 14px; margin: 0; padding: 12px; flex-wrap: wrap; }
    .choice-field legend { color: #34483f; font-size: 13px; font-weight: 900; padding: 0 6px; }
    .choice-field label { align-items: center; display: inline-flex; gap: 6px; font-size: 13px; font-weight: 850; }
    .form-actions { justify-content: flex-end; border-top: 1px solid #edf2ef; padding-top: 12px; }
    @media (max-width: 1080px) {
      .metric-grid, .master-shell, .form-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 720px) {
      .master-page { padding: 16px; }
      .topbar, .panel-heading, .form-title { flex-direction: column; }
      .metric-grid, .master-shell, form, .form-grid { grid-template-columns: 1fr; }
      .record-row { grid-template-columns: auto minmax(0, 1fr); }
      .record-row i { grid-column: 2; width: fit-content; }
    }
  `]
})
export class StaffMasterDefinitionComponent implements OnInit {
  @Input({ required: true }) kind!: StaffMasterKind;

  readonly branches = signal<StaffOsBranch[]>([]);
  readonly shifts = signal<StaffOsShiftMaster[]>([]);
  readonly records = signal<MasterRecord[]>([]);
  readonly editing = signal<MasterRecord | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saveError = signal('');
  readonly search = signal('');
  readonly branchFilter = signal('');
  private liveBranchSyncedId = '';
  private recordsLoaded = false;
  readonly branchOptions = computed(() => this.normalizedBranches(this.branches()));
  readonly filteredRecords = computed(() => {
    const query = this.search().trim().toLowerCase();
    const branchId = this.branchFilter();
    return this.records().filter((record) => {
      const branchMatches = !branchId || !record.branchId || record.branchId === branchId;
      if (!branchMatches) return false;
      if (!query) return true;
      return `${record.name} ${this.recordCode(record)} ${this.recordSubline(record)}`.toLowerCase().includes(query);
    });
  });
  readonly visibleCount = computed(() => this.records().filter((record) => !record.hide && record.status === 'active').length);
  readonly hiddenCount = computed(() => this.records().filter((record) => record.hide || record.status !== 'active').length);
  readonly auxiliaryMetricLabel = computed(() => {
    if (this.isShift()) return 'Regular';
    if (this.isLeave()) return 'Paid';
    return 'Bookable';
  });
  readonly auxiliaryMetricValue = computed(() => {
    if (this.isShift()) return this.records().filter((record) => (record as StaffOsShiftMaster).shiftType === 'regular').length;
    if (this.isLeave()) return this.records().filter((record) => (record as StaffOsLeaveMaster).paid).length;
    return this.records().filter((record) => (record as StaffOsAttendanceMaster).availableForAppointment).length;
  });

  readonly masterForm = this.fb.group({
    branchId: [''],
    code: ['', Validators.required],
    name: ['', Validators.required],
    dayCount: [1],
    paid: [true],
    availableForAppointment: [false],
    color: ['#0f766e'],
    sortOrder: [0],
    leaveQuota: [0],
    quotaPeriod: ['yearly'],
    shiftTemplateId: [''],
    shiftName: [''],
    carryForwardAllowed: [false],
    approvalRequired: [true],
    description: [''],
    startTime: ['10:00'],
    endTime: ['20:00'],
    breakMinutes: [0],
    shiftType: ['regular'],
    hide: [false],
    notes: [''],
    status: ['active']
  });

  constructor(
    private readonly api: StaffOsApi,
    private readonly fb: UntypedFormBuilder,
    private readonly route: ActivatedRoute,
    private readonly appState: AppStateService
  ) {
    effect(() => {
      const branchId = this.preferredBranchId();
      if (!branchId || branchId === this.liveBranchSyncedId) return;
      this.applyLiveBranch(branchId);
      if (this.recordsLoaded) this.load();
    });
  }

  ngOnInit(): void {
    this.applyLiveBranch(this.preferredBranchId());
    this.applyModeValidators();
    this.startNew();
    this.load();
  }

  config(): MasterConfig {
    return configs[this.kind];
  }

  isAttendance(): boolean {
    return this.kind === 'attendance';
  }

  isLeave(): boolean {
    return this.kind === 'leave';
  }

  isShift(): boolean {
    return this.kind === 'shift';
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const masterRequest = this.isAttendance()
      ? this.api.attendanceMasters({ branchId: this.branchFilter(), limit: 500 })
      : this.isLeave()
        ? this.api.leaveMasters({ branchId: this.branchFilter(), limit: 500 })
        : this.api.shiftMasters({ branchId: this.branchFilter(), limit: 500 });

    forkJoin({
      branches: this.api.branches({ includeAllBranches: true, limit: 500 }),
      records: masterRequest,
      shifts: this.api.shiftMasters({ limit: 500 })
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ branches, records, shifts }) => {
        this.branches.set(branches || []);
        this.records.set(records as MasterRecord[]);
        this.shifts.set(shifts);
        this.recordsLoaded = true;
        this.applyLiveBranch(this.preferredBranchId());
      },
      error: (error: unknown) => this.error.set(this.apiError(error, `Unable to load ${this.config().title}`))
    });
  }

  setBranchFilter(branchId: string): void {
    this.branchFilter.set(branchId);
    if (!this.editing()) {
      this.masterForm.patchValue({ branchId }, { emitEvent: false });
    }
    this.load();
  }

  startNew(): void {
    this.editing.set(null);
    this.saveError.set('');
    this.masterForm.reset(this.defaultValue());
    this.applyModeValidators();
  }

  edit(record: MasterRecord): void {
    this.editing.set(record);
    this.saveError.set('');
    this.masterForm.reset(this.valueFromRecord(record));
    this.applyModeValidators();
  }

  cancel(): void {
    this.startNew();
  }

  save(): void {
    if (this.masterForm.invalid) {
      this.masterForm.markAllAsTouched();
      return;
    }
    this.syncSelectedShiftName();
    const record = this.editing();
    const rawPayload = this.payload();
    const duplicate = record ? null : this.duplicateRecordForPayload(rawPayload);
    const targetRecord = record || duplicate;
    const payload = targetRecord ? { ...rawPayload, version: targetRecord.version } : rawPayload;
    this.saving.set(true);
    this.saveError.set('');
    const request: Observable<MasterRecord> = targetRecord
      ? this.updateRecord(targetRecord.id, payload)
      : this.createRecord(payload);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.startNew();
        this.load();
      },
      error: (error: unknown) => this.saveError.set(this.apiError(error, 'Unable to save master record'))
    });
  }

  archiveOrRestore(): void {
    const record = this.editing();
    if (!record) return;
    const restore = record.status !== 'active' || record.hide;
    this.saving.set(true);
    this.saveError.set('');
    const request: Observable<MasterRecord> = this.updateStatus(record.id, { status: restore ? 'active' : 'archived', hide: !restore, version: record.version });
    request
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.startNew();
          this.load();
        },
        error: (error: unknown) => this.saveError.set(this.apiError(error, 'Unable to update record status'))
      });
  }

  fieldInvalid(name: string): boolean {
    const control = this.masterForm.get(name);
    return Boolean(control && control.invalid && (control.dirty || control.touched));
  }

  syncSelectedShiftName(): void {
    if (!this.isLeave()) return;
    const shiftId = this.masterForm.get('shiftTemplateId')?.value || '';
    const shift = this.shifts().find((item) => item.id === shiftId);
    this.masterForm.patchValue({ shiftName: shift?.name || '' }, { emitEvent: false });
  }

  recordCode(record: MasterRecord): string {
    return this.isShift() ? (record as StaffOsShiftMaster).shortCode : (record as StaffOsAttendanceMaster | StaffOsLeaveMaster).code;
  }

  recordColor(record: MasterRecord): string {
    return (record as { color?: string }).color || '#0f766e';
  }

  recordSubline(record: MasterRecord): string {
    if (this.isShift()) {
      const shift = record as StaffOsShiftMaster;
      return `${shift.startTime} - ${shift.endTime} · ${this.shiftTypeLabel(shift.shiftType)}`;
    }
    if (this.isLeave()) {
      const leave = record as StaffOsLeaveMaster;
      return `${leave.dayCount} day · ${leave.leaveQuota || 0} ${leave.quotaPeriod}`;
    }
    const attendance = record as StaffOsAttendanceMaster;
    return `${attendance.dayCount} day · ${attendance.paid ? 'Paid' : 'Un Paid'}`;
  }

  private duplicateRecordForPayload(payload: Record<string, unknown>): MasterRecord | null {
    const code = String(payload['code'] || payload['shortCode'] || '').trim().toLowerCase();
    const branchId = String(payload['branchId'] || '').trim();
    if (!code) return null;
    return this.records().find((record) => {
      const recordCode = this.recordCode(record).trim().toLowerCase();
      const recordBranch = String(record.branchId || '').trim();
      return recordCode === code && recordBranch === branchId;
    }) || null;
  }

  private createRecord(payload: Record<string, unknown>): Observable<MasterRecord> {
    if (this.isAttendance()) return this.api.createAttendanceMaster(payload);
    if (this.isLeave()) return this.api.createLeaveMaster(payload);
    return this.api.createShiftMaster(payload);
  }

  private updateRecord(id: string, payload: Record<string, unknown>): Observable<MasterRecord> {
    if (this.isAttendance()) return this.api.updateAttendanceMaster(id, payload);
    if (this.isLeave()) return this.api.updateLeaveMaster(id, payload);
    return this.api.updateShiftMaster(id, payload);
  }

  private updateStatus(id: string, payload: Record<string, unknown>): Observable<MasterRecord> {
    if (this.isAttendance()) return this.api.updateAttendanceMasterStatus(id, payload);
    if (this.isLeave()) return this.api.updateLeaveMasterStatus(id, payload);
    return this.api.updateShiftMasterStatus(id, payload);
  }

  private applyModeValidators(): void {
    this.masterForm.get('startTime')?.clearValidators();
    this.masterForm.get('endTime')?.clearValidators();
    if (this.isShift()) {
      this.masterForm.get('startTime')?.setValidators([Validators.required]);
      this.masterForm.get('endTime')?.setValidators([Validators.required]);
    }
    this.masterForm.get('startTime')?.updateValueAndValidity({ emitEvent: false });
    this.masterForm.get('endTime')?.updateValueAndValidity({ emitEvent: false });
  }

  private defaultValue(): Record<string, unknown> {
    const common = {
      branchId: this.branchFilter(),
      code: '',
      name: '',
      dayCount: 1,
      paid: true,
      availableForAppointment: false,
      color: this.isShift() ? '#bbf7d0' : '#0f766e',
      sortOrder: 0,
      leaveQuota: 0,
      quotaPeriod: 'yearly',
      shiftTemplateId: '',
      shiftName: '',
      carryForwardAllowed: false,
      approvalRequired: true,
      description: '',
      startTime: '10:00',
      endTime: '20:00',
      breakMinutes: 0,
      shiftType: 'regular',
      hide: false,
      notes: '',
      status: 'active'
    };
    if (this.isAttendance()) return { ...common, code: 'PR', name: 'Present' };
    if (this.isLeave()) return { ...common, code: 'CL', name: 'Casual Leave', availableForAppointment: false, leaveQuota: 12 };
    return { ...common, code: 'REG', name: 'Regular Shift' };
  }

  private preferredBranchId(): string {
    return this.appState.selectedBranchId()
      || this.route.snapshot.queryParamMap.get('branchId')
      || this.route.snapshot.queryParamMap.get('branchld')
      || '';
  }

  private applyLiveBranch(branchId: string): void {
    if (!branchId) return;
    this.liveBranchSyncedId = branchId;
    this.branchFilter.set(branchId);
    if (!this.editing()) {
      this.masterForm.patchValue({ branchId }, { emitEvent: false });
    }
  }

  private normalizedBranches(branches: StaffOsBranch[]): StaffOsBranch[] {
    const selectedBranchId = this.preferredBranchId();
    const seenIds = new Set<string>();
    const seenLabels = new Set<string>();
    const rows: StaffOsBranch[] = [];
    const orderedBranches = selectedBranchId
      ? [...branches].sort((left, right) => {
          if (left.id === selectedBranchId) return -1;
          if (right.id === selectedBranchId) return 1;
          return 0;
        })
      : branches;

    for (const branch of orderedBranches) {
      const id = String(branch.id || '').trim();
      const label = String(branch.name || id).trim();
      const labelKey = label.toLowerCase();
      if (id !== selectedBranchId && this.isGeneratedBranchLabel(label)) continue;
      if (!id || seenIds.has(id) || seenLabels.has(labelKey)) continue;
      seenIds.add(id);
      seenLabels.add(labelKey);
      rows.push({ ...branch, id, name: label });
    }

    if (selectedBranchId && !rows.some((branch) => branch.id === selectedBranchId)) {
      rows.unshift({ id: selectedBranchId, name: selectedBranchId });
    }

    return rows.sort((left, right) => {
      if (left.id === selectedBranchId) return -1;
      if (right.id === selectedBranchId) return 1;
      return String(left.name || left.id).localeCompare(String(right.name || right.id));
    });
  }

  private isGeneratedBranchLabel(label: string): boolean {
    const normalized = label.trim().toLowerCase();
    return normalized.startsWith('client 360 branch') || normalized.startsWith('level 8 lock branch');
  }

  private valueFromRecord(record: MasterRecord): Record<string, unknown> {
    const base = {
      ...this.defaultValue(),
      branchId: record.branchId || '',
      code: this.recordCode(record),
      name: record.name,
      hide: record.hide,
      notes: (record as { notes?: string }).notes || '',
      status: record.status
    };
    if (this.isShift()) {
      const shift = record as StaffOsShiftMaster;
      return {
        ...base,
        description: shift.description || '',
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes || 0,
        color: shift.color || '#bbf7d0',
        shiftType: shift.shiftType
      };
    }
    if (this.isLeave()) {
      const leave = record as StaffOsLeaveMaster;
      return {
        ...base,
        dayCount: leave.dayCount,
        paid: leave.paid,
        availableForAppointment: leave.availableForAppointment,
        leaveQuota: leave.leaveQuota,
        quotaPeriod: leave.quotaPeriod,
        shiftTemplateId: leave.shiftTemplateId || '',
        shiftName: leave.shiftName || '',
        carryForwardAllowed: leave.carryForwardAllowed,
        approvalRequired: leave.approvalRequired
      };
    }
    const attendance = record as StaffOsAttendanceMaster;
    return {
      ...base,
      dayCount: attendance.dayCount,
      paid: attendance.paid,
      availableForAppointment: attendance.availableForAppointment,
      color: attendance.color || '#0f766e',
      sortOrder: attendance.sortOrder || 0
    };
  }

  private payload(): Record<string, unknown> {
    const value = this.masterForm.getRawValue();
    const common = {
      branchId: value.branchId || '',
      code: value.code,
      name: value.name,
      hide: Boolean(value.hide),
      notes: value.notes || '',
      status: value.status || 'active'
    };
    if (this.isShift()) {
      return {
        ...common,
        shortCode: value.code,
        description: value.description || '',
        startTime: value.startTime,
        endTime: value.endTime,
        breakMinutes: Number(value.breakMinutes || 0),
        color: value.color || '#bbf7d0',
        shiftType: value.shiftType || 'regular'
      };
    }
    if (this.isLeave()) {
      return {
        ...common,
        dayCount: Number(value.dayCount || 0),
        paid: Boolean(value.paid),
        availableForAppointment: Boolean(value.availableForAppointment),
        leaveQuota: Number(value.leaveQuota || 0),
        quotaPeriod: value.quotaPeriod || 'yearly',
        shiftTemplateId: value.shiftTemplateId || '',
        shiftName: value.shiftName || '',
        carryForwardAllowed: Boolean(value.carryForwardAllowed),
        approvalRequired: Boolean(value.approvalRequired)
      };
    }
    return {
      ...common,
      dayCount: Number(value.dayCount || 0),
      paid: Boolean(value.paid),
      availableForAppointment: Boolean(value.availableForAppointment),
      color: value.color || '#0f766e',
      sortOrder: Number(value.sortOrder || 0)
    };
  }

  private shiftTypeLabel(value: string): string {
    const labels: Record<string, string> = {
      regular: 'Regular',
      weekly_off: 'Weekly Off',
      holiday: 'Holiday',
      leave: 'Leave'
    };
    return labels[value] || value;
  }

  private apiError(error: unknown, fallback: string): string {
    const err = error as { error?: { error?: string; message?: string }; message?: string };
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
