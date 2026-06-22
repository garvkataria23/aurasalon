import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, finalize, forkJoin, switchMap, tap } from 'rxjs';
import { StaffOsApi } from '../data/staff-os.api';
import {
  StaffOsBranch,
  StaffOsStaff,
  StaffOsTargetAssigneeType,
  StaffOsTargetIncentive,
  StaffOsTargetIncentiveSlab,
  StaffOsTargetIncentiveType,
  StaffOsTargetRoleScope
} from '../domain/staff-os.models';

type TargetAssignee = {
  id: string;
  name: string;
  type: StaffOsTargetAssigneeType;
  roleScope: StaffOsTargetRoleScope;
  branchId?: string;
  meta?: string;
};

const targetMeta: Record<StaffOsTargetIncentiveType, { title: string; label: string; branchMode?: boolean; defaultRole: StaffOsTargetRoleScope }> = {
  service: { title: 'Employees Target Incentives (Service)', label: 'Service', defaultRole: 'operator' },
  product: { title: 'Employees Target Incentives (Product)', label: 'Product', defaultRole: 'operator' },
  membership: { title: 'Employees Target Incentives (Membership)', label: 'Membership', defaultRole: 'operator' },
  branch_admin: { title: 'Branch Wise Target Incentives', label: 'Branch-Admin', branchMode: true, defaultRole: 'all' },
  admin: { title: 'Employees Target Incentives (Admin)', label: 'Admin', defaultRole: 'admin' },
  all_transaction: { title: 'Employees Target Incentives (All Tr.)', label: 'All Transaction', defaultRole: 'operator' }
};

@Component({
  selector: 'app-staff-target-incentive',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="target-page">
      <header class="topbar">
        <div>
          <p class="eyebrow">Employee Masters</p>
          <h1>{{ meta().title }}</h1>
        </div>
        <div class="topbar-actions">
          <a class="refresh" routerLink="/staff-os/employee-masters">Masters</a>
          <button type="button" class="refresh" (click)="load()">Refresh</button>
        </div>
      </header>

      <div class="metrics">
        <article><span>Assignments</span><strong>{{ assignments().length }}</strong></article>
        <article><span>Visible Targets</span><strong>{{ assignees().length }}</strong></article>
        <article><span>{{ isAdminMode() ? 'Selected Rule' : 'Selected Slabs' }}</span><strong>{{ slabs().length }}</strong></article>
        <article><span>Copy Targets</span><strong>{{ copySelection().length }}</strong></article>
      </div>

      <div *ngIf="loading()" class="state">Loading target incentive slabs...</div>
      <div *ngIf="loadError()" class="state error">{{ loadError() }}</div>

      <section class="target-shell">
        <aside class="left-panel">
          <div class="toggles">
            <label><input type="checkbox" [checked]="includeHide()" (change)="includeHide.set($any($event.target).checked)" /> Include Hide Employees</label>
            <label><input type="checkbox" [checked]="includeLeft()" (change)="includeLeft.set($any($event.target).checked)" /> Include Left Employees</label>
            <label><input type="checkbox" [checked]="onlyHideLeft()" (change)="onlyHideLeft.set($any($event.target).checked)" /> Only Hide & Left Employees</label>
          </div>

          <div class="role-tabs" *ngIf="!meta().branchMode">
            <button type="button" [class.active]="roleScope() === 'operator'" (click)="setRoleScope('operator')">Operator</button>
            <button type="button" [class.active]="roleScope() === 'admin'" (click)="setRoleScope('admin')">Admin</button>
          </div>

          <div class="filters">
            <label>
              <span>Branch</span>
              <select [value]="branchFilter()" (change)="setBranchFilter($any($event.target).value)">
                <option value="">All branches</option>
                <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name || branch.id }}</option>
              </select>
            </label>
            <label>
              <span>Search</span>
              <input [value]="search()" (input)="search.set($any($event.target).value)" />
            </label>
          </div>

          <div class="list-toolbar">
            <button type="button" class="refresh mini" (click)="load()">List Emps.</button>
            <span>{{ assignees().length }} records</span>
          </div>

          <div class="assignee-list">
            <div class="assignee-row" *ngFor="let assignee of assignees()" [class.active]="selectedAssignee()?.id === assignee.id">
              <label class="copy-check">
                <input type="checkbox" [checked]="isCopySelected(assignee.id)" [disabled]="selectedAssignee()?.id === assignee.id" (change)="toggleCopy(assignee, $any($event.target).checked)" />
              </label>
              <button type="button" (click)="selectAssignee(assignee)">
                <strong>{{ assignee.name }}</strong>
                <small>{{ assignee.meta || assignee.roleScope }}</small>
              </button>
              <em *ngIf="assignmentFor(assignee)">Saved</em>
            </div>
          </div>
        </aside>

        <main class="slab-panel">
          <div class="tab-label">Target Slabs</div>
          <section class="selected-band">
            <div>
              <p class="eyebrow">Selected</p>
              <h2>{{ selectedAssignee()?.name || 'Select a target' }}</h2>
            </div>
            <label class="hide-toggle"><input type="checkbox" [checked]="hideRecord()" (change)="hideRecord.set($any($event.target).checked)" /> Hide</label>
          </section>

          <section class="slab-workbench">
            <ng-container *ngIf="isAdminMode(); else slabGrid">
              <div class="admin-target-box">
                <p class="eyebrow">Admin Target Inc.</p>
                <label>
                  <span>Employee Amount (%)</span>
                  <input type="number" min="0" [value]="adminAmountPercent()" (input)="updateAdminAmount('percent', $any($event.target).value)" />
                </label>
                <label>
                  <span>Employee Amount</span>
                  <input type="number" min="0" [value]="adminAmount()" (input)="updateAdminAmount('amount', $any($event.target).value)" />
                </label>
              </div>
            </ng-container>
            <ng-template #slabGrid>
              <button type="button" class="copy-standard" (click)="copyFromStandard()">Copy From Standard Def.</button>
              <div class="grid header"><span>S.No.</span><span>From Amt.</span><span>To Amt.</span><span>Ince. %</span><span>Or Ince. Amt.</span><span></span></div>
              <div class="grid" *ngFor="let slab of slabs(); let i = index; trackBy: trackSlab">
                <span>{{ i + 1 }}</span>
                <input type="number" min="0" [value]="slab.fromAmount" (input)="updateSlab(i, 'fromAmount', $any($event.target).value)" />
                <input type="number" min="0" [value]="slab.toAmount" (input)="updateSlab(i, 'toAmount', $any($event.target).value)" />
                <input type="number" min="0" [value]="slab.incentivePercent" (input)="updateSlab(i, 'incentivePercent', $any($event.target).value)" />
                <input type="number" min="0" [value]="slab.incentiveAmount" (input)="updateSlab(i, 'incentiveAmount', $any($event.target).value)" />
                <button type="button" class="icon-button" (click)="removeSlab(i)">×</button>
              </div>
              <button type="button" class="refresh mini add-row" (click)="addSlab()">Add Slab</button>
            </ng-template>
          </section>

          <label class="notes">
            <span>Notes</span>
            <textarea rows="3" [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea>
          </label>

          <div class="state error" *ngIf="saveError()">{{ saveError() }}</div>

          <footer class="actions">
            <button type="button" class="refresh" (click)="resetSelection()">Cancel</button>
            <button type="button" class="refresh danger" *ngIf="selectedAssignment()" (click)="archiveOrRestore()">
              {{ selectedAssignment()?.hide || selectedAssignment()?.status !== 'active' ? 'Restore' : 'Archive' }}
            </button>
            <button type="button" class="primary" [disabled]="!selectedAssignee() || saving()" (click)="save()">{{ saving() ? 'Saving...' : 'Save' }}</button>
            <button type="button" class="primary secondary" [disabled]="!selectedAssignee() || !copySelection().length || saving()" (click)="saveAndCopy()">Save & Copy To</button>
          </footer>
        </main>
      </section>
    </section>
  `,
  styles: [`
    .target-page { color: #10201a; display: grid; gap: 18px; padding: 24px; }
    .topbar, .selected-band { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
    .topbar-actions, .actions, .list-toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; justify-content: flex-end; }
    .eyebrow { color: #547066; font-size: 12px; font-weight: 850; letter-spacing: .08em; margin: 0 0 5px; text-transform: uppercase; }
    h1, h2 { margin: 0; letter-spacing: 0; }
    h1 { font-size: 30px; }
    h2 { font-size: 20px; }
    .primary, .refresh { border: 1px solid #cbd8d2; border-radius: 6px; cursor: pointer; font-weight: 850; min-height: 38px; padding: 9px 12px; text-decoration: none; }
    .primary { background: #0f766e; border-color: #0f766e; color: #fff; }
    .primary.secondary { background: #10201a; border-color: #10201a; }
    .primary:disabled { opacity: .65; cursor: wait; }
    .refresh { background: #fff; color: #34483f; }
    .danger { color: #a52828; }
    .mini { min-height: 32px; padding: 6px 9px; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr)); gap: 12px; }
    .metrics article, .state, .left-panel, .slab-panel { background: #fff; border: 1px solid #d9e5de; border-radius: 8px; }
    .metrics article { padding: 14px; }
    .metrics span { color: #60766d; font-size: 12px; font-weight: 850; text-transform: uppercase; }
    .metrics strong { display: block; font-size: 24px; margin-top: 6px; }
    .state { color: #61746c; padding: 14px; }
    .error { color: #a52828; border-color: #e7b1b1; }
    .target-shell { display: grid; grid-template-columns: minmax(320px, .7fr) minmax(620px, 1.3fr); gap: 16px; align-items: start; }
    .left-panel, .slab-panel { display: grid; gap: 14px; padding: 16px; }
    .toggles { display: grid; gap: 7px; }
    .toggles label, .hide-toggle, .copy-check { align-items: center; color: #34483f; display: inline-flex; font-size: 13px; font-weight: 850; gap: 8px; }
    .toggles input, .hide-toggle input, .copy-check input { height: 18px; padding: 0; width: 18px; }
    .role-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .role-tabs button { background: #fff; border: 1px solid #cbd8d2; border-radius: 6px; color: #34483f; cursor: pointer; font-weight: 850; min-height: 38px; }
    .role-tabs button.active { background: #10201a; border-color: #10201a; color: #fff; }
    .filters { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }
    .filters label, .notes { color: #34483f; display: grid; font-size: 13px; font-weight: 850; gap: 6px; }
    input, select, textarea { background: #fff; border: 1px solid #cbd8d2; border-radius: 8px; color: #10201a; font: inherit; padding: 10px 11px; width: 100%; }
    .assignee-list { border-top: 1px solid #edf2ef; display: grid; max-height: 520px; overflow: auto; }
    .assignee-row { align-items: center; border-bottom: 1px solid #edf2ef; display: grid; gap: 8px; grid-template-columns: auto 1fr auto; min-height: 52px; }
    .assignee-row.active { background: #f8fbf9; }
    .assignee-row button { background: transparent; border: 0; cursor: pointer; padding: 8px 0; text-align: left; }
    .assignee-row small { color: #60766d; display: block; margin-top: 3px; }
    .assignee-row em { background: #eef6f1; border-radius: 999px; color: #286345; font-size: 12px; font-style: normal; font-weight: 850; padding: 4px 8px; }
    .tab-label { background: #f8fbf9; border: 1px solid #d9e5de; border-radius: 8px 8px 0 0; color: #10201a; font-weight: 900; justify-self: start; padding: 10px 16px; }
    .selected-band, .slab-workbench { border: 1px solid #d9e5de; border-radius: 8px; padding: 14px; }
    .slab-workbench { display: grid; gap: 10px; }
    .admin-target-box { align-content: start; display: grid; gap: 14px; grid-template-columns: minmax(180px, 280px); justify-content: center; min-height: 260px; padding-top: 34px; }
    .admin-target-box label { color: #34483f; display: grid; font-size: 13px; font-weight: 850; gap: 7px; }
    .copy-standard { align-self: start; background: #fff; border: 1px solid #cbd8d2; border-radius: 6px; color: #34483f; cursor: pointer; font-weight: 850; justify-self: start; min-height: 38px; padding: 8px 11px; }
    .grid { align-items: center; display: grid; gap: 8px; grid-template-columns: 54px repeat(4, minmax(90px, 1fr)) 36px; }
    .grid.header { color: #60766d; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .icon-button { align-items: center; background: #fff; border: 1px solid #e7b1b1; border-radius: 6px; color: #a52828; cursor: pointer; display: inline-flex; font-size: 18px; font-weight: 900; height: 34px; justify-content: center; width: 34px; }
    .add-row { justify-self: start; }
    .actions { border-top: 1px solid #edf2ef; padding-top: 12px; }
    @media (max-width: 1060px) { .target-shell, .metrics { grid-template-columns: 1fr; } }
    @media (max-width: 760px) { .filters, .grid { grid-template-columns: 1fr; } .grid.header { display: none; } }
  `]
})
export class StaffTargetIncentiveComponent implements OnInit {
  @Input({ required: true }) kind: StaffOsTargetIncentiveType = 'service';

  readonly branches = signal<StaffOsBranch[]>([]);
  readonly staff = signal<StaffOsStaff[]>([]);
  readonly assignments = signal<StaffOsTargetIncentive[]>([]);
  readonly selectedAssignee = signal<TargetAssignee | null>(null);
  readonly selectedAssignment = signal<StaffOsTargetIncentive | null>(null);
  readonly slabs = signal<StaffOsTargetIncentiveSlab[]>([this.blankSlab(1)]);
  readonly copySelection = signal<TargetAssignee[]>([]);
  readonly roleScope = signal<StaffOsTargetRoleScope>('operator');
  readonly branchFilter = signal('');
  readonly search = signal('');
  readonly includeHide = signal(false);
  readonly includeLeft = signal(false);
  readonly onlyHideLeft = signal(false);
  readonly hideRecord = signal(false);
  readonly notes = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');

  constructor(private readonly api: StaffOsApi) {}

  ngOnInit(): void {
    this.roleScope.set(this.meta().defaultRole);
    this.load();
  }

  meta() {
    return targetMeta[this.kind];
  }

  isAdminMode(): boolean {
    return this.kind === 'admin';
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      branches: this.api.branches({ limit: 1000 }),
      staff: this.api.staff({ includeArchived: 'true', branchId: this.branchFilter(), limit: 1000 }),
      assignments: this.api.targetIncentives({ targetType: this.kind, branchId: this.branchFilter(), roleScope: this.roleScope(), includeArchived: 'true', limit: 1000 })
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (result) => {
        this.branches.set(result.branches);
        this.staff.set(result.staff);
        this.assignments.set(result.assignments);
        this.reselectCurrent();
      },
      error: (error: unknown) => this.loadError.set(this.apiError(error, 'Unable to load target incentives'))
    });
  }

  assignees(): TargetAssignee[] {
    const term = this.search().trim().toLowerCase();
    const standard: TargetAssignee = { id: 'standard', name: 'Standard Definition', type: 'standard', roleScope: this.roleScope(), meta: 'Copy source' };
    const records = this.meta().branchMode ? this.branchAssignees() : this.staffAssignees();
    return [standard, ...records].filter((item) => !term || item.name.toLowerCase().includes(term) || String(item.meta || '').toLowerCase().includes(term));
  }

  setRoleScope(roleScope: StaffOsTargetRoleScope): void {
    this.roleScope.set(roleScope);
    this.resetSelection();
    this.load();
  }

  setBranchFilter(branchId: string): void {
    this.branchFilter.set(branchId);
    this.resetSelection();
    this.load();
  }

  selectAssignee(assignee: TargetAssignee): void {
    this.selectedAssignee.set(assignee);
    const assignment = this.assignmentFor(assignee);
    this.selectedAssignment.set(assignment || null);
    this.slabs.set(assignment?.slabs?.length ? assignment.slabs : [this.blankSlab(1)]);
    this.hideRecord.set(Boolean(assignment?.hide));
    this.notes.set(assignment?.notes || '');
    this.saveError.set('');
  }

  assignmentFor(assignee: TargetAssignee): StaffOsTargetIncentive | undefined {
    return this.assignments().find((item) =>
      item.targetType === this.kind &&
      item.assigneeType === assignee.type &&
      item.assigneeId === (assignee.type === 'standard' ? '' : assignee.id) &&
      item.roleScope === assignee.roleScope
    );
  }

  copyFromStandard(): void {
    const standard = this.assignments().find((item) => item.assigneeType === 'standard' && item.targetType === this.kind && item.roleScope === this.roleScope());
    if (!standard?.slabs?.length) {
      this.saveError.set('Standard definition is not saved yet.');
      return;
    }
    this.slabs.set(standard.slabs);
    this.saveError.set('');
  }

  save(): void {
    this.saving.set(true);
    this.saveError.set('');
    this.saveRequest().pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => {
        this.selectedAssignment.set(saved);
        this.load();
      },
      error: (error: unknown) => this.saveError.set(this.apiError(error, 'Unable to save target incentive'))
    });
  }

  saveAndCopy(): void {
    if (!this.copySelection().length) return;
    this.saving.set(true);
    this.saveError.set('');
    this.saveRequest()
      .pipe(
        tap((saved) => this.selectedAssignment.set(saved)),
        switchMap((saved) => this.api.copyTargetIncentive(saved.id, {
          targets: this.copySelection().map((item) => ({
            assigneeType: item.type,
            assigneeId: item.type === 'standard' ? '' : item.id,
            assigneeName: item.name,
            roleScope: item.roleScope,
            branchId: item.branchId || this.branchFilter()
          }))
        })),
        finalize(() => this.saving.set(false))
      )
      .subscribe({
        next: () => {
          this.copySelection.set([]);
          this.load();
        },
        error: (error: unknown) => this.saveError.set(this.apiError(error, 'Unable to save and copy target incentive'))
      });
  }

  archiveOrRestore(): void {
    const assignment = this.selectedAssignment();
    if (!assignment) return;
    const restore = assignment.hide || assignment.status !== 'active';
    this.saving.set(true);
    this.api.updateTargetIncentiveStatus(assignment.id, { version: assignment.version, status: restore ? 'active' : 'archived', hide: !restore })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.load(),
        error: (error: unknown) => this.saveError.set(this.apiError(error, 'Unable to update target incentive'))
      });
  }

  resetSelection(): void {
    this.selectedAssignee.set(null);
    this.selectedAssignment.set(null);
    this.slabs.set([this.blankSlab(1)]);
    this.copySelection.set([]);
    this.hideRecord.set(false);
    this.notes.set('');
    this.saveError.set('');
  }

  addSlab(): void {
    this.slabs.update((items) => [...items, this.blankSlab(items.length + 1)]);
  }

  removeSlab(index: number): void {
    this.slabs.update((items) => items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sNo: i + 1 })));
  }

  updateSlab(index: number, key: 'fromAmount' | 'toAmount' | 'incentivePercent' | 'incentiveAmount', value: string): void {
    this.slabs.update((items) => items.map((item, i) => i === index ? { ...item, [key]: Number(value || 0) } : item));
  }

  trackSlab(index: number, slab: StaffOsTargetIncentiveSlab): number {
    return Number(slab.sNo || index + 1);
  }

  adminAmountPercent(): number {
    const slab = this.slabs()[0] || this.blankSlab(1);
    return Number(slab.employeeAmountPercent ?? slab.incentivePercent ?? 0);
  }

  adminAmount(): number {
    const slab = this.slabs()[0] || this.blankSlab(1);
    return Number(slab.employeeAmount ?? slab.incentiveAmount ?? 0);
  }

  updateAdminAmount(field: 'percent' | 'amount', value: string): void {
    const current = this.slabs()[0] || this.blankSlab(1);
    const employeeAmountPercent = field === 'percent' ? Number(value || 0) : this.adminAmountPercent();
    const employeeAmount = field === 'amount' ? Number(value || 0) : this.adminAmount();
    this.slabs.set([{
      ...current,
      sNo: 1,
      fromAmount: 0,
      toAmount: 0,
      incentivePercent: employeeAmountPercent,
      incentiveAmount: employeeAmount,
      employeeAmountPercent,
      employeeAmount
    }]);
  }

  isCopySelected(id: string): boolean {
    return this.copySelection().some((item) => item.id === id);
  }

  toggleCopy(assignee: TargetAssignee, checked: boolean): void {
    if (checked) {
      this.copySelection.update((items) => items.some((item) => item.id === assignee.id) ? items : [...items, assignee]);
      return;
    }
    this.copySelection.update((items) => items.filter((item) => item.id !== assignee.id));
  }

  private saveRequest(): Observable<StaffOsTargetIncentive> {
    const assignee = this.selectedAssignee();
    if (!assignee) throw new Error('Select an employee or branch target first');
    const assignment = this.selectedAssignment();
    const payload = {
      branchId: assignee.branchId || this.branchFilter(),
      targetType: this.kind,
      assigneeType: assignee.type,
      assigneeId: assignee.type === 'standard' ? '' : assignee.id,
      assigneeName: assignee.name,
      roleScope: assignee.roleScope,
      slabs: this.slabs(),
      notes: this.notes(),
      hide: this.hideRecord(),
      status: this.hideRecord() ? 'archived' : 'active',
      ...(assignment ? { version: assignment.version } : {})
    };
    return assignment ? this.api.updateTargetIncentive(assignment.id, payload) : this.api.createTargetIncentive(payload);
  }

  private staffAssignees(): TargetAssignee[] {
    return this.staff().filter((staff) => {
      const hidden = staff.status === 'archived' || staff.status === 'inactive' || staff.employeeDetails?.hideFromRoster;
      const left = Boolean(staff.employeeDetails?.lastWorkingDate);
      if (this.onlyHideLeft() && !hidden && !left) return false;
      if (!this.includeHide() && hidden) return false;
      if (!this.includeLeft() && left) return false;
      if (this.branchFilter() && staff.branchId !== this.branchFilter()) return false;
      if (this.roleScope() === 'admin') return staff.staffCategoryScope === 'admin' || ['admin', 'manager', 'superAdmin'].includes(staff.roleId || '');
      return staff.staffCategoryScope !== 'admin';
    }).map((staff) => ({
      id: staff.id,
      name: staff.fullName,
      type: 'staff',
      roleScope: this.roleScope(),
      branchId: staff.branchId,
      meta: `${staff.branchId || 'All'} · ${staff.staffCategoryName || staff.designation || staff.roleId || 'Staff'}`
    }));
  }

  private branchAssignees(): TargetAssignee[] {
    return this.branches()
      .filter((branch) => !this.branchFilter() || branch.id === this.branchFilter())
      .map((branch) => ({
        id: branch.id,
        name: branch.name || branch.id,
        type: 'branch',
        roleScope: 'all',
        branchId: branch.id,
        meta: branch.status || 'branch'
      }));
  }

  private reselectCurrent(): void {
    const selected = this.selectedAssignee();
    if (!selected) return;
    const found = this.assignees().find((item) => item.id === selected.id && item.type === selected.type);
    if (found) this.selectAssignee(found);
  }

  private blankSlab(sNo: number): StaffOsTargetIncentiveSlab {
    return { sNo, fromAmount: 0, toAmount: 0, incentivePercent: 0, incentiveAmount: 0, employeeAmountPercent: 0, employeeAmount: 0 };
  }

  private apiError(error: unknown, fallback: string): string {
    const value = error as { error?: { error?: string; message?: string }; message?: string };
    return value?.error?.error || value?.error?.message || value?.message || fallback;
  }
}

@Component({ standalone: true, imports: [StaffTargetIncentiveComponent], template: `<app-staff-target-incentive kind="service" />` })
export class ServiceTargetIncentivePage {}

@Component({ standalone: true, imports: [StaffTargetIncentiveComponent], template: `<app-staff-target-incentive kind="product" />` })
export class ProductTargetIncentivePage {}

@Component({ standalone: true, imports: [StaffTargetIncentiveComponent], template: `<app-staff-target-incentive kind="membership" />` })
export class MembershipTargetIncentivePage {}

@Component({ standalone: true, imports: [StaffTargetIncentiveComponent], template: `<app-staff-target-incentive kind="branch_admin" />` })
export class BranchTargetIncentivePage {}

@Component({ standalone: true, imports: [StaffTargetIncentiveComponent], template: `<app-staff-target-incentive kind="admin" />` })
export class AdminTargetIncentivePage {}

@Component({ standalone: true, imports: [StaffTargetIncentiveComponent], template: `<app-staff-target-incentive kind="all_transaction" />` })
export class AllTransactionTargetIncentivePage {}
