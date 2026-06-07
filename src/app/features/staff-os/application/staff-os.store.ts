import { Injectable, computed, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ApiRecord } from '../../../core/api.service';
import { StaffOsApi } from '../data/staff-os.api';
import {
  StaffOsBranch,
  StaffOsMetric,
  StaffOsPerformanceResponse,
  StaffOsRiskScore,
  StaffOsSchedule,
  StaffOsServiceOption,
  StaffOsStaff,
  StaffOsStaffCategory,
  StaffOsTask
} from '../domain/staff-os.models';

const emptyPerformance: StaffOsPerformanceResponse = {
  rows: [],
  summary: { days: 0, revenue: 0, avgUtilization: 0, avgScore: 0 }
};

@Injectable()
export class StaffOsStore {
  readonly branches = signal<StaffOsBranch[]>([]);
  readonly services = signal<StaffOsServiceOption[]>([]);
  readonly products = signal<ApiRecord[]>([]);
  readonly memberships = signal<ApiRecord[]>([]);
  readonly packages = signal<ApiRecord[]>([]);
  readonly staffCategories = signal<StaffOsStaffCategory[]>([]);
  readonly staff = signal<StaffOsStaff[]>([]);
  readonly schedules = signal<StaffOsSchedule[]>([]);
  readonly attendance = signal<ApiRecord[]>([]);
  readonly biometricCenter = signal<ApiRecord | null>(null);
  readonly biometricDevices = signal<ApiRecord[]>([]);
  readonly biometricMappings = signal<ApiRecord[]>([]);
  readonly biometricConsents = signal<ApiRecord[]>([]);
  readonly gatewayManifest = signal<ApiRecord | null>(null);
  readonly attendanceRisks = signal<ApiRecord[]>([]);
  readonly attendancePayrollPreview = signal<ApiRecord[]>([]);
  readonly ownerAlerts = signal<ApiRecord[]>([]);
  readonly performance = signal<StaffOsPerformanceResponse>(emptyPerformance);
  readonly risks = signal<StaffOsRiskScore[]>([]);
  readonly tasks = signal<StaffOsTask[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly metrics = computed<StaffOsMetric[]>(() => {
    const performance = this.performance().summary;
    const risks = this.risks();
    return [
      { label: 'Active staff', value: String(this.staff().filter((item) => item.status === 'active').length), tone: 'good' },
      { label: 'Rostered shifts', value: String(this.schedules().length), tone: 'neutral' },
      { label: 'Productivity', value: Math.round(performance.avgScore).toString(), tone: performance.avgScore >= 70 ? 'good' : 'warning' },
      { label: 'Burnout alerts', value: String(risks.filter((item) => item.level === 'high').length), tone: risks.some((item) => item.level === 'high') ? 'critical' : 'good' }
    ];
  });

  constructor(private readonly api: StaffOsApi) {}

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.staff()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (staff) => this.staff.set(staff),
        error: (error: Error) => this.error.set(error.message || 'Unable to load staff')
    });
    this.api.branches({ limit: 1000 }).subscribe({ next: (rows) => this.branches.set(rows), error: () => undefined });
    this.api.services({ limit: 1000 }).subscribe({ next: (rows) => this.services.set(rows || []), error: () => this.services.set([]) });
    this.api.products({ limit: 1000 }).subscribe({ next: (rows) => this.products.set(rows || []), error: () => this.products.set([]) });
    this.api.memberships({ limit: 1000 }).subscribe({ next: (rows) => this.memberships.set(rows || []), error: () => this.memberships.set([]) });
    this.api.packages({ limit: 1000 }).subscribe({ next: (rows) => this.packages.set(rows || []), error: () => this.packages.set([]) });
    this.api.staffCategories({ limit: 500 }).subscribe({ next: (rows) => this.staffCategories.set(rows), error: () => undefined });
    this.api.schedules().subscribe({ next: (rows) => this.schedules.set(rows), error: () => undefined });
    this.loadAttendanceCenter();
    this.api.performance().subscribe({ next: (response) => this.performance.set(response), error: () => undefined });
    this.api.burnoutRisk().subscribe({ next: (rows) => this.risks.set(rows), error: () => undefined });
    this.api.tasks().subscribe({ next: (rows) => this.tasks.set(rows), error: () => undefined });
  }

  createStaff(payload: Record<string, unknown>) {
    return this.api.createStaff(payload);
  }

  updateStaffStatus(staff: StaffOsStaff, status: string) {
    return this.api.updateStaffStatus(staff.id, { status, version: staff.version });
  }

  createStaffCategory(payload: Record<string, unknown>) {
    return this.api.createStaffCategory(payload);
  }

  updateStaffCategory(category: StaffOsStaffCategory, payload: Record<string, unknown>) {
    return this.api.updateStaffCategory(category.id, { ...payload, version: category.version });
  }

  updateStaffCategoryStatus(category: StaffOsStaffCategory, status: string) {
    return this.api.updateStaffCategoryStatus(category.id, { status, version: category.version });
  }

  loadAttendanceCenter(params: ApiRecord = {}): void {
    const date = params.date || new Date().toISOString().slice(0, 10);
    this.api.attendance({ dateFrom: date, dateTo: date, limit: 200, ...params }).subscribe({ next: (rows) => this.attendance.set(rows || []), error: () => this.attendance.set([]) });
    this.api.biometricCenter({ date, limit: 120, ...params }).subscribe({ next: (center) => this.biometricCenter.set(center), error: () => this.biometricCenter.set(null) });
    this.api.biometricDevices({ limit: 200, ...params }).subscribe({ next: (rows) => this.biometricDevices.set(rows || []), error: () => this.biometricDevices.set([]) });
    this.api.biometricMappings({ limit: 200, ...params }).subscribe({ next: (rows) => this.biometricMappings.set(rows || []), error: () => this.biometricMappings.set([]) });
    this.api.biometricConsents({ limit: 200, ...params }).subscribe({ next: (rows) => this.biometricConsents.set(rows || []), error: () => this.biometricConsents.set([]) });
    this.api.gatewayManifest({ ...params }).subscribe({ next: (manifest) => this.gatewayManifest.set(manifest), error: () => this.gatewayManifest.set(null) });
    this.api.attendanceRisks({ limit: 200, ...params }).subscribe({ next: (rows) => this.attendanceRisks.set(rows || []), error: () => this.attendanceRisks.set([]) });
    this.api.attendancePayrollPreview({ periodStart: date, periodEnd: date, limit: 200, ...params }).subscribe({ next: (rows) => this.attendancePayrollPreview.set(rows || []), error: () => this.attendancePayrollPreview.set([]) });
    this.api.ownerAlerts({ limit: 100, ...params }).subscribe({ next: (rows) => this.ownerAlerts.set(rows || []), error: () => this.ownerAlerts.set([]) });
  }

  registerBiometricDevice(payload: ApiRecord) {
    return this.api.registerBiometricDevice(payload);
  }

  createBiometricMapping(payload: ApiRecord) {
    return this.api.createBiometricMapping(payload);
  }

  approveBiometricMapping(mappingId: string, payload: ApiRecord) {
    return this.api.approveBiometricMapping(mappingId, payload);
  }

  processBiometricQueue(payload: ApiRecord) {
    return this.api.processBiometricQueue(payload);
  }

  registerGateway(payload: ApiRecord) {
    return this.api.registerGateway(payload);
  }

  gatewayHeartbeat(gatewayId: string, payload: ApiRecord) {
    return this.api.gatewayHeartbeat(gatewayId, payload);
  }

  upsertBiometricConsent(payload: ApiRecord) {
    return this.api.upsertBiometricConsent(payload);
  }

  requestBiometricConsentDeletion(consentId: string, payload: ApiRecord) {
    return this.api.requestBiometricConsentDeletion(consentId, payload);
  }

  cameraPunch(payload: ApiRecord) {
    return this.api.cameraPunch(payload);
  }

  runAttendanceFraudScan(payload: ApiRecord) {
    return this.api.runAttendanceFraudScan(payload);
  }

  generateAttendancePayrollPreview(payload: ApiRecord) {
    return this.api.generateAttendancePayrollPreview(payload);
  }
}
