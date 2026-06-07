import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, switchMap, tap } from 'rxjs';
import { StaffOsApi } from '../data/staff-os.api';
import { StaffOsBranch, StaffOsServiceAssignment, StaffOsServiceOption, StaffOsStaff, StaffOsTargetRoleScope } from '../domain/staff-os.models';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="assign-page">
      <header class="topbar">
        <div>
          <p class="eyebrow">Employee Masters</p>
          <h1>Employees Wise Services Assign</h1>
        </div>
        <div class="topbar-actions">
          <a class="refresh" routerLink="/staff-os/employee-masters">Masters</a>
          <button type="button" class="refresh" (click)="load()">Refresh</button>
        </div>
      </header>

      <div class="metrics">
        <article><span>Employees</span><strong>{{ staff().length }}</strong></article>
        <article><span>Services</span><strong>{{ services().length }}</strong></article>
        <article><span>Assigned</span><strong>{{ selectedServiceIds().length }}</strong></article>
        <article><span>Copy Targets</span><strong>{{ copyTargets().length }}</strong></article>
      </div>

      <div *ngIf="loading()" class="state">Loading service assignment...</div>
      <div *ngIf="error()" class="state error">{{ error() }}</div>

      <section class="shell">
        <aside class="left-panel">
          <div class="toggles">
            <label><input type="checkbox" [checked]="includeHide()" (change)="includeHide.set($any($event.target).checked)" /> Include Hide Employees</label>
            <label><input type="checkbox" [checked]="includeLeft()" (change)="includeLeft.set($any($event.target).checked)" /> Include Left Employees</label>
            <label><input type="checkbox" [checked]="onlyHideLeft()" (change)="onlyHideLeft.set($any($event.target).checked)" /> Only Hide & Left Employees</label>
          </div>

          <div class="role-tabs">
            <button type="button" [class.active]="roleScope() === 'operator'" (click)="setRole('operator')">Operator</button>
            <button type="button" [class.active]="roleScope() === 'admin'" (click)="setRole('admin')">Admin</button>
          </div>

          <div class="filters">
            <label>
              <span>Branch</span>
              <select [value]="branchFilter()" (change)="setBranch($any($event.target).value)">
                <option value="">All branches</option>
                <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name || branch.id }}</option>
              </select>
            </label>
            <label>
              <span>Search</span>
              <input [value]="employeeSearch()" (input)="employeeSearch.set($any($event.target).value)" />
            </label>
          </div>

          <div class="list">
            <div class="row" *ngFor="let item of visibleStaff()" [class.active]="selectedStaff()?.id === item.id">
              <label class="copy"><input type="checkbox" [disabled]="selectedStaff()?.id === item.id" [checked]="copySelected(item.id)" (change)="toggleCopy(item, $any($event.target).checked)" /></label>
              <button type="button" (click)="selectStaff(item)">
                <strong>{{ item.fullName }}</strong>
                <small>{{ item.branchId }} · {{ item.staffCategoryName || item.designation || item.roleId || 'Staff' }}</small>
              </button>
              <em *ngIf="assignmentFor(item)">Saved</em>
            </div>
          </div>
        </aside>

        <main class="services-panel">
          <div class="tab-label">Services</div>
          <section class="selected-band">
            <div>
              <p class="eyebrow">Selected</p>
              <h2>{{ selectedStaff()?.fullName || 'Select employee' }}</h2>
            </div>
            <label><input type="checkbox" [checked]="hideRecord()" (change)="hideRecord.set($any($event.target).checked)" /> Hide</label>
          </section>

          <div class="service-toolbar">
            <label>
              <span>Category</span>
              <select [value]="categoryFilter()" (change)="categoryFilter.set($any($event.target).value)">
                <option value="">All categories</option>
                <option *ngFor="let category of serviceCategories()" [value]="category">{{ category }}</option>
              </select>
            </label>
            <label>
              <span>Service Search</span>
              <input [value]="serviceSearch()" (input)="serviceSearch.set($any($event.target).value)" />
            </label>
            <button type="button" class="refresh mini" (click)="selectAllVisible()">Select Visible</button>
            <button type="button" class="refresh mini" (click)="clearVisible()">Clear Visible</button>
          </div>

          <div class="service-grid">
            <div class="service-head"><span>Category</span><span>Service</span><span>Assign</span></div>
            <label class="service-row" *ngFor="let service of visibleServices()">
              <span>{{ service.category || 'General' }}</span>
              <strong>{{ service.name }}</strong>
              <input type="checkbox" [checked]="isServiceSelected(service.id)" (change)="toggleService(service, $any($event.target).checked)" />
            </label>
          </div>

          <label class="notes">
            <span>Remarks</span>
            <textarea rows="3" [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea>
          </label>

          <div class="state error" *ngIf="saveError()">{{ saveError() }}</div>

          <footer class="actions">
            <button type="button" class="refresh" (click)="reset()">Cancel</button>
            <button type="button" class="refresh danger" *ngIf="selectedAssignment()" (click)="archiveOrRestore()">{{ archived() ? 'Restore' : 'Archive' }}</button>
            <button type="button" class="primary" [disabled]="!selectedStaff() || saving()" (click)="save()">{{ saving() ? 'Saving...' : 'Save' }}</button>
            <button type="button" class="primary secondary" [disabled]="!selectedAssignment() || !copyTargets().length || saving()" (click)="saveAndCopy()">Save & Copy To</button>
          </footer>
        </main>
      </section>
    </section>
  `,
  styles: [`
    .assign-page { color: #10201a; display: grid; gap: 18px; padding: 24px; }
    .topbar, .selected-band, .topbar-actions, .actions { align-items: flex-start; display: flex; gap: 12px; justify-content: space-between; }
    .topbar-actions, .actions { align-items: center; justify-content: flex-end; flex-wrap: wrap; }
    .eyebrow { color: #547066; font-size: 12px; font-weight: 850; letter-spacing: .08em; margin: 0 0 5px; text-transform: uppercase; }
    h1, h2 { letter-spacing: 0; margin: 0; }
    h1 { font-size: 30px; }
    h2 { font-size: 20px; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)); gap: 12px; }
    .metrics article, .state, .left-panel, .services-panel { background: #fff; border: 1px solid #d9e5de; border-radius: 8px; }
    .metrics article, .state { padding: 14px; }
    .metrics span, .service-head { color: #60766d; font-size: 12px; font-weight: 850; text-transform: uppercase; }
    .metrics strong { display: block; font-size: 24px; margin-top: 6px; }
    .state { color: #61746c; }
    .error { color: #a52828; border-color: #e7b1b1; }
    .shell { display: grid; grid-template-columns: minmax(320px, .7fr) minmax(640px, 1.3fr); gap: 16px; align-items: start; }
    .left-panel, .services-panel { display: grid; gap: 14px; padding: 16px; }
    .toggles { display: grid; gap: 7px; }
    .toggles label, .selected-band label, .copy { align-items: center; color: #34483f; display: inline-flex; font-size: 13px; font-weight: 850; gap: 8px; }
    input[type='checkbox'] { height: 18px; padding: 0; width: 18px; }
    .role-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .role-tabs button, .refresh, .primary { border: 1px solid #cbd8d2; border-radius: 6px; cursor: pointer; font-weight: 850; min-height: 38px; padding: 9px 12px; text-decoration: none; }
    .role-tabs button, .refresh { background: #fff; color: #34483f; }
    .role-tabs button.active, .primary { background: #0f766e; border-color: #0f766e; color: #fff; }
    .primary.secondary { background: #10201a; border-color: #10201a; }
    .danger { color: #a52828; }
    .mini { min-height: 32px; padding: 6px 9px; }
    .filters, .service-toolbar { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }
    .service-toolbar { grid-template-columns: minmax(170px, .8fr) 1fr auto auto; align-items: end; }
    label { color: #34483f; display: grid; font-size: 13px; font-weight: 850; gap: 6px; }
    input, select, textarea { border: 1px solid #cbd8d2; border-radius: 8px; color: #10201a; font: inherit; padding: 10px 11px; width: 100%; }
    .list { border-top: 1px solid #edf2ef; display: grid; max-height: 560px; overflow: auto; }
    .row { align-items: center; border-bottom: 1px solid #edf2ef; display: grid; gap: 8px; grid-template-columns: auto 1fr auto; min-height: 52px; }
    .row.active { background: #f8fbf9; }
    .row button { background: transparent; border: 0; cursor: pointer; padding: 8px 0; text-align: left; }
    .row small { color: #60766d; display: block; margin-top: 3px; }
    .row em { background: #eef6f1; border-radius: 999px; color: #286345; font-size: 12px; font-style: normal; font-weight: 850; padding: 4px 8px; }
    .tab-label { background: #f8fbf9; border: 1px solid #d9e5de; border-radius: 8px 8px 0 0; font-weight: 900; justify-self: start; padding: 10px 16px; }
    .selected-band, .service-grid { border: 1px solid #d9e5de; border-radius: 8px; padding: 14px; }
    .service-grid { display: grid; max-height: 620px; overflow: auto; padding: 0; }
    .service-head, .service-row { align-items: center; display: grid; gap: 10px; grid-template-columns: minmax(150px, .6fr) 1fr 72px; min-height: 42px; padding: 0 12px; }
    .service-head { background: #f8fbf9; position: sticky; top: 0; }
    .service-row { border-top: 1px solid #edf2ef; font-size: 13px; }
    .service-row strong { font-size: 14px; }
    .actions { border-top: 1px solid #edf2ef; padding-top: 12px; }
    @media (max-width: 1060px) { .shell, .metrics, .service-toolbar { grid-template-columns: 1fr; } }
    @media (max-width: 700px) { .assign-page { padding: 16px; } .topbar, .selected-band { display: grid; } .service-head, .service-row { grid-template-columns: 1fr auto; } .service-head span:first-child, .service-row span { display: none; } }
  `]
})
export class ServiceAssignmentPage implements OnInit {
  readonly branches = signal<StaffOsBranch[]>([]);
  readonly staff = signal<StaffOsStaff[]>([]);
  readonly services = signal<StaffOsServiceOption[]>([]);
  readonly assignments = signal<StaffOsServiceAssignment[]>([]);
  readonly selectedStaff = signal<StaffOsStaff | null>(null);
  readonly selectedAssignment = signal<StaffOsServiceAssignment | null>(null);
  readonly selectedServiceIds = signal<string[]>([]);
  readonly selectedServiceSnapshot = signal<StaffOsServiceOption[]>([]);
  readonly copyTargets = signal<StaffOsStaff[]>([]);
  readonly roleScope = signal<StaffOsTargetRoleScope>('operator');
  readonly branchFilter = signal('');
  readonly employeeSearch = signal('');
  readonly serviceSearch = signal('');
  readonly categoryFilter = signal('');
  readonly includeHide = signal(false);
  readonly includeLeft = signal(false);
  readonly onlyHideLeft = signal(false);
  readonly hideRecord = signal(false);
  readonly notes = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saveError = signal('');

  readonly serviceCategories = computed(() => Array.from(new Set(this.services().map((service) => service.category || 'General'))).sort());

  constructor(private readonly api: StaffOsApi) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      branches: this.api.branches({ limit: 1000 }),
      staff: this.api.staff({ includeArchived: 'true', branchId: this.branchFilter(), limit: 1000 }),
      services: this.api.services({ limit: 10000 }),
      assignments: this.api.serviceAssignments({ branchId: this.branchFilter(), roleScope: this.roleScope(), includeArchived: 'true', limit: 1000 })
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (result) => {
        this.branches.set(result.branches);
        this.staff.set(result.staff);
        this.services.set(result.services || []);
        this.assignments.set(result.assignments);
        this.reselect();
      },
      error: (error: unknown) => this.error.set(this.apiError(error, 'Unable to load service assignment'))
    });
  }

  visibleStaff(): StaffOsStaff[] {
    const term = this.employeeSearch().trim().toLowerCase();
    return this.staff().filter((staff) => {
      const hidden = staff.status === 'archived' || staff.status === 'inactive' || staff.employeeDetails?.hideFromRoster;
      const left = Boolean(staff.employeeDetails?.lastWorkingDate);
      if (this.onlyHideLeft() && !hidden && !left) return false;
      if (!this.includeHide() && hidden) return false;
      if (!this.includeLeft() && left) return false;
      if (this.branchFilter() && staff.branchId !== this.branchFilter()) return false;
      if (this.roleScope() === 'admin') return staff.staffCategoryScope === 'admin' || ['admin', 'manager', 'superAdmin'].includes(staff.roleId || '');
      if (staff.staffCategoryScope === 'admin') return false;
      return !term || staff.fullName.toLowerCase().includes(term) || String(staff.staffCategoryName || staff.designation || '').toLowerCase().includes(term);
    });
  }

  visibleServices(): StaffOsServiceOption[] {
    const term = this.serviceSearch().trim().toLowerCase();
    const category = this.categoryFilter();
    return this.services().filter((service) =>
      (!category || (service.category || 'General') === category) &&
      (!term || service.name.toLowerCase().includes(term) || String(service.category || '').toLowerCase().includes(term))
    );
  }

  setRole(role: StaffOsTargetRoleScope): void {
    this.roleScope.set(role);
    this.reset();
    this.load();
  }

  setBranch(branchId: string): void {
    this.branchFilter.set(branchId);
    this.reset();
    this.load();
  }

  selectStaff(staff: StaffOsStaff): void {
    this.selectedStaff.set(staff);
    const assignment = this.assignmentFor(staff);
    this.selectedAssignment.set(assignment || null);
    this.selectedServiceIds.set(assignment?.serviceIds || []);
    this.selectedServiceSnapshot.set(assignment?.services || []);
    this.hideRecord.set(Boolean(assignment?.hide));
    this.notes.set(assignment?.notes || '');
    this.saveError.set('');
  }

  assignmentFor(staff: StaffOsStaff): StaffOsServiceAssignment | undefined {
    return this.assignments().find((item) => item.staffId === staff.id && item.roleScope === this.roleScope());
  }

  isServiceSelected(id: string): boolean {
    return this.selectedServiceIds().includes(id);
  }

  toggleService(service: StaffOsServiceOption, checked: boolean): void {
    if (checked) {
      this.selectedServiceIds.update((items) => items.includes(service.id) ? items : [...items, service.id]);
      this.selectedServiceSnapshot.update((items) => items.some((item) => item.id === service.id) ? items : [...items, service]);
      return;
    }
    this.selectedServiceIds.update((items) => items.filter((id) => id !== service.id));
    this.selectedServiceSnapshot.update((items) => items.filter((item) => item.id !== service.id));
  }

  selectAllVisible(): void {
    for (const service of this.visibleServices()) this.toggleService(service, true);
  }

  clearVisible(): void {
    for (const service of this.visibleServices()) this.toggleService(service, false);
  }

  toggleCopy(staff: StaffOsStaff, checked: boolean): void {
    this.copyTargets.update((items) => checked
      ? items.some((item) => item.id === staff.id) ? items : [...items, staff]
      : items.filter((item) => item.id !== staff.id));
  }

  copySelected(id: string): boolean {
    return this.copyTargets().some((item) => item.id === id);
  }

  archived(): boolean {
    const assignment = this.selectedAssignment();
    return Boolean(assignment?.hide || assignment?.status !== 'active');
  }

  save(): void {
    const staff = this.selectedStaff();
    if (!staff) return;
    this.saving.set(true);
    this.saveError.set('');
    this.saveRequest()
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => {
          this.selectedAssignment.set(saved);
          this.load();
        },
        error: (error: unknown) => this.saveError.set(this.apiError(error, 'Unable to save service assignment'))
      });
  }

  saveAndCopy(): void {
    if (!this.selectedAssignment() || !this.copyTargets().length) return;
    this.saving.set(true);
    this.saveError.set('');
    this.saveRequest()
      .pipe(
        tap((saved) => this.selectedAssignment.set(saved)),
        switchMap((saved) => this.api.copyServiceAssignment(saved.id, {
          targets: this.copyTargets().map((staff) => ({
            staffId: staff.id,
            staffName: staff.fullName,
            branchId: staff.branchId,
            roleScope: this.roleScope()
          }))
        })),
        finalize(() => this.saving.set(false))
      )
      .subscribe({
        next: () => {
          this.copyTargets.set([]);
          this.load();
        },
        error: (error: unknown) => this.saveError.set(this.apiError(error, 'Unable to save and copy service assignment'))
      });
  }

  archiveOrRestore(): void {
    const assignment = this.selectedAssignment();
    if (!assignment) return;
    const restore = this.archived();
    this.saving.set(true);
    this.api.updateServiceAssignmentStatus(assignment.id, { version: assignment.version, status: restore ? 'active' : 'archived', hide: !restore })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.load(),
        error: (error: unknown) => this.saveError.set(this.apiError(error, 'Unable to update service assignment'))
      });
  }

  reset(): void {
    this.selectedStaff.set(null);
    this.selectedAssignment.set(null);
    this.selectedServiceIds.set([]);
    this.selectedServiceSnapshot.set([]);
    this.copyTargets.set([]);
    this.hideRecord.set(false);
    this.notes.set('');
    this.saveError.set('');
  }

  private saveRequest() {
    const staff = this.selectedStaff();
    const assignment = this.selectedAssignment();
    const payload = {
      staffId: staff?.id,
      staffName: staff?.fullName,
      branchId: staff?.branchId || this.branchFilter(),
      roleScope: this.roleScope(),
      serviceIds: this.selectedServiceIds(),
      services: this.selectedServiceSnapshot(),
      categoryFilters: this.categoryFilter() ? [this.categoryFilter()] : [],
      hide: this.hideRecord(),
      notes: this.notes(),
      status: this.hideRecord() ? 'archived' : 'active',
      ...(assignment ? { version: assignment.version } : {})
    };
    return assignment ? this.api.updateServiceAssignment(assignment.id, payload) : this.api.createServiceAssignment(payload);
  }

  private reselect(): void {
    const selected = this.selectedStaff();
    if (!selected) return;
    const found = this.visibleStaff().find((staff) => staff.id === selected.id);
    if (found) this.selectStaff(found);
  }

  private apiError(error: unknown, fallback: string): string {
    const value = error as { error?: { error?: string; message?: string }; message?: string };
    return value?.error?.error || value?.error?.message || value?.message || fallback;
  }
}
