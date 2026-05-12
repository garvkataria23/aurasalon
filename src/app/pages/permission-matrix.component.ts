import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-permission-matrix',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Level 23 · Permission matrix</span>
          <h2>Detailed role access for owner, manager, receptionist, staff, accountant, inventory manager and custom roles</h2>
          <p>Role definitions and grants are persisted in the tenant database and enforced by the API middleware.</p>
        </div>
        <button class="ghost-button" type="button" (click)="load()">Refresh</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="dashboard-grid">
        <section class="form-panel">
          <h3>Create or update custom role</h3>
          <form [formGroup]="roleForm" (ngSubmit)="saveRole()">
            <label class="field"><span>Role key</span><input formControlName="role" /></label>
            <label class="field"><span>Name</span><input formControlName="name" /></label>
            <label class="field full"><span>Description</span><input formControlName="description" /></label>
            <label class="field"><span>Resource</span><input formControlName="resource" /></label>
            <label class="field"><span>Actions CSV</span><input formControlName="actions" /></label>
            <div class="form-actions">
              <button class="primary-button" type="submit" [disabled]="roleForm.invalid || saving()">Save role</button>
            </div>
          </form>
        </section>

        <section class="panel">
          <div class="section-title"><h2>Role library</h2></div>
          <div class="rank-list">
            <article *ngFor="let role of matrix()?.roles || []">
              <div>
                <strong>{{ role.name }}</strong>
                <span>{{ role.role }} · {{ role.isSystem ? 'system' : 'custom' }}</span>
              </div>
              <span class="badge">{{ role.staticGrants?.length || 0 }} static grants</span>
            </article>
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="section-title">
          <h2>Access matrix</h2>
          <span>{{ matrix()?.resources?.length || 0 }} resources</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th *ngFor="let resource of visibleResources()">{{ resource }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of matrix()?.matrix || []">
                <td><strong>{{ row.role }}</strong></td>
                <td *ngFor="let resource of visibleResources()">
                  <span class="badge" *ngIf="row.resources?.[resource]?.admin">admin</span>
                  <span class="badge success" *ngIf="!row.resources?.[resource]?.admin && row.resources?.[resource]?.write">write</span>
                  <span class="badge" *ngIf="!row.resources?.[resource]?.admin && !row.resources?.[resource]?.write && row.resources?.[resource]?.read">read</span>
                  <span class="muted" *ngIf="!row.resources?.[resource]?.read && !row.resources?.[resource]?.write && !row.resources?.[resource]?.admin">none</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <pre class="result-json" *ngIf="result()">{{ result() | json }}</pre>
    </section>
  `
})
export class PermissionMatrixComponent implements OnInit {
  readonly matrix = signal<ApiRecord | null>(null);
  readonly result = signal<ApiRecord | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly visibleResources = computed(() => (this.matrix()?.resources || []).slice(0, 10));

  readonly roleForm = this.fb.group({
    role: ['customRetentionLead', [Validators.required, Validators.pattern(/^[a-zA-Z][a-zA-Z0-9_-]{2,40}$/)]],
    name: ['Custom retention lead', Validators.required],
    description: ['Can view customers and run retention workflows.'],
    resource: ['workflows', Validators.required],
    actions: ['read,write', Validators.required]
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.list<ApiRecord>('security/permission-matrix').subscribe({
      next: (matrix) => {
        this.matrix.set(matrix);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load permission matrix');
        this.loading.set(false);
      }
    });
  }

  saveRole(): void {
    if (this.roleForm.invalid) return;
    this.saving.set(true);
    const value = this.roleForm.value;
    this.api.post<ApiRecord>('security/roles', {
      role: value.role,
      name: value.name,
      description: value.description,
      permissions: [
        {
          resource: value.resource,
          actions: String(value.actions || '').split(',').map((item) => item.trim()).filter(Boolean)
        }
      ]
    }).subscribe({
      next: (response) => {
        this.result.set(response.definition);
        this.matrix.set(response.matrix);
        this.saving.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to save role');
        this.saving.set(false);
      }
    });
  }
}
