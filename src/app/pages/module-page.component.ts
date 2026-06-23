import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

type FieldConfig = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'email' | 'date' | 'json';
  required?: boolean;
  defaultValue?: any;
};

type ColumnConfig = {
  key: string;
  label: string;
  type?: 'text' | 'currency' | 'date' | 'badge' | 'json';
};

type PageConfig = {
  entity: string;
  title: string;
  subtitle: string;
  createLabel: string;
  columns: ColumnConfig[];
  fields: FieldConfig[];
};

@Component({
  selector: 'app-module-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, StateComponent],
  template: `
    <section class="page-stack" *ngIf="config">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Module</span>
          <h2>{{ config.title }}</h2>
          <p>{{ config.subtitle }}</p>
        </div>
        <button class="primary-button" type="button" (click)="toggleForm()">{{ showForm ? 'Close form' : config.createLabel }}</button>
      </div>

      <section class="form-panel" *ngIf="showForm">
        <form [formGroup]="form" (ngSubmit)="save()">
          <label class="field" *ngFor="let field of config.fields">
            <span>{{ field.label }}</span>
            <textarea *ngIf="field.type === 'json'; else scalar" [formControlName]="field.key"></textarea>
            <ng-template #scalar>
              <input [type]="field.type || 'text'" [formControlName]="field.key" />
            </ng-template>
            <small class="field-error" *ngIf="form.get(field.key)?.invalid && form.get(field.key)?.touched">Required</small>
          </label>
          <div class="form-actions">
            <button class="ghost-button" type="button" (click)="toggleForm()">Cancel</button>
            <button class="primary-button" type="submit" [disabled]="form.invalid || saving">{{ saving ? 'Saving...' : 'Save' }}</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="table-toolbar">
          <label class="search-field">
            <span>Search</span>
            <input [(ngModel)]="query" placeholder="Search records" />
          </label>
          <div class="service-gst-tools" *ngIf="isServicesPage()">
            <label class="field compact">
              <span>GST %</span>
              <input type="number" min="0" max="28" step="0.1" [(ngModel)]="bulkGstRate" />
            </label>
            <button class="ghost-button" type="button" (click)="applyGstToServices('category')" [disabled]="saving || !activeServiceCategory">Update category GST</button>
            <button class="primary-button" type="button" (click)="applyGstToServices('all')" [disabled]="saving">Update all services GST</button>
          </div>
          <button class="ghost-button" type="button" (click)="load()">Refresh</button>
        </div>
        <p class="state success" *ngIf="actionMessage">{{ actionMessage }}</p>

        <app-state [loading]="loading" [error]="error"></app-state>

        <ng-container *ngIf="isServicesPage(); else genericTable">
          <div class="services-category-workspace" *ngIf="!loading && !error">
            <aside class="service-category-panel">
              <div class="section-title compact">
                <div>
                  <span class="eyebrow">Categories</span>
                  <h3>Service groups</h3>
                </div>
                <span class="badge">{{ categorySummaries().length }}</span>
              </div>
              <button type="button" [class.active]="!activeServiceCategory" (click)="selectServiceCategory('')">
                <span>All categories</span>
                <strong>{{ rows.length }}</strong>
              </button>
              <button type="button" *ngFor="let category of categorySummaries()" [class.active]="activeServiceCategory === category.name" (click)="selectServiceCategory(category.name)">
                <span>{{ category.name }}</span>
                <strong>{{ category.count }}</strong>
              </button>
            </aside>

            <main class="service-list-panel">
              <div class="service-list-head">
                <div>
                  <span class="eyebrow">{{ activeServiceCategory || 'All services' }}</span>
                  <h3>{{ serviceRows().length }} service(s)</h3>
                </div>
                <span class="badge">GST {{ serviceGstSummary() }}</span>
              </div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th *ngFor="let column of config.columns" (click)="sort(column.key)">
                        {{ column.label }}
                        <span *ngIf="sortKey === column.key">{{ sortDir === 'asc' ? 'up' : 'down' }}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of serviceRows()">
                      <td *ngFor="let column of config.columns">
                        <span *ngIf="column.type === 'badge'; else nonBadgeService" class="badge">{{ value(row, column) }}</span>
                        <ng-template #nonBadgeService>{{ value(row, column) }}</ng-template>
                      </td>
                    </tr>
                    <tr *ngIf="!serviceRows().length">
                      <td [attr.colspan]="config.columns.length">No services found for selected category.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </main>
          </div>
        </ng-container>

        <ng-template #genericTable>
        <div class="table-wrap" *ngIf="!loading && !error">
          <table>
            <thead>
              <tr>
                <th *ngFor="let column of config.columns" (click)="sort(column.key)">
                  {{ column.label }}
                  <span *ngIf="sortKey === column.key">{{ sortDir === 'asc' ? 'up' : 'down' }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of viewRows">
                <td *ngFor="let column of config.columns">
                  <span *ngIf="column.type === 'badge'; else nonBadge" class="badge">{{ value(row, column) }}</span>
                  <ng-template #nonBadge>{{ value(row, column) }}</ng-template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </ng-template>
      </section>
    </section>
  `,
  styles: [`
    .service-gst-tools {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 10px;
      margin-left: auto;
    }

    .field.compact {
      min-width: 110px;
    }

    .services-category-workspace {
      display: grid;
      grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }

    .service-category-panel,
    .service-list-panel {
      border: 1px solid #d9e3ec;
      border-radius: 8px;
      background: #fff;
      padding: 14px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.07);
    }

    .service-category-panel {
      display: grid;
      gap: 8px;
      max-height: 680px;
      overflow: auto;
    }

    .service-category-panel button {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      border: 1px solid #d9e3ec;
      border-radius: 8px;
      background: #f8fafc;
      color: #0f172a;
      padding: 11px 12px;
      text-align: left;
      cursor: pointer;
    }

    .service-category-panel button.active,
    .service-category-panel button:hover {
      border-color: #0f766e;
      background: #ecfdf5;
    }

    .service-category-panel span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 800;
    }

    .service-category-panel strong {
      min-width: 34px;
      border-radius: 999px;
      background: #d1fae5;
      color: #065f46;
      padding: 4px 8px;
      text-align: center;
      font-size: 0.78rem;
    }

    .service-list-panel {
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .service-list-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }

    .service-list-head h3 {
      margin: 3px 0 0;
      color: #0f172a;
    }

    @media (max-width: 980px) {
      .services-category-workspace {
        grid-template-columns: 1fr;
      }

      .service-gst-tools,
      .service-list-head {
        align-items: stretch;
        flex-direction: column;
      }
    }
  `]
})
export class ModulePageComponent implements OnInit, OnDestroy {
  config!: PageConfig;
  rows: ApiRecord[] = [];
  query = '';
  loading = true;
  saving = false;
  error = '';
  showForm = false;
  sortKey = '';
  sortDir: 'asc' | 'desc' = 'asc';
  activeServiceCategory = '';
  bulkGstRate = 18;
  actionMessage = '';
  form: UntypedFormGroup = this.fb.group({});
  private readonly subscription = new Subscription();

  constructor(
    private readonly api: ApiService,
    private readonly route: ActivatedRoute,
    private readonly fb: UntypedFormBuilder
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.route.data.subscribe((data) => {
        this.config = data as PageConfig;
        this.buildForm();
        this.load();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get viewRows(): ApiRecord[] {
    const filtered = this.rows.filter((row) => JSON.stringify(row).toLowerCase().includes(this.query.toLowerCase()));
    return this.sortedRows(filtered);
  }

  isServicesPage(): boolean {
    return this.config?.entity === 'services';
  }

  categorySummaries(): Array<{ name: string; count: number }> {
    const map = new Map<string, number>();
    for (const row of this.rows) {
      const category = this.serviceCategoryName(row);
      map.set(category, (map.get(category) || 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  serviceRows(): ApiRecord[] {
    const term = this.query.toLowerCase();
    const rows = this.rows.filter((row) => {
      const categoryMatch = !this.activeServiceCategory || this.serviceCategoryName(row) === this.activeServiceCategory;
      const searchMatch = !term || JSON.stringify(row).toLowerCase().includes(term);
      return categoryMatch && searchMatch;
    });
    return this.sortedRows(rows);
  }

  selectServiceCategory(category: string): void {
    this.activeServiceCategory = category;
    const first = this.rows.find((row) => !category || this.serviceCategoryName(row) === category);
    if (first?.gstRate !== undefined) this.bulkGstRate = Number(first.gstRate || 0);
  }

  serviceGstSummary(): string {
    const rates = [...new Set(this.serviceRows().map((row) => Number(row.gstRate ?? 0)))].sort((a, b) => a - b);
    if (!rates.length) return '-';
    return rates.length === 1 ? `${rates[0]}%` : `${rates.length} rates`;
  }

  applyGstToServices(scope: 'all' | 'category'): void {
    const rate = Number(this.bulkGstRate);
    if (Number.isNaN(rate) || rate < 0) {
      this.error = 'GST rate must be a valid positive number';
      return;
    }
    const targets = (scope === 'all' ? this.rows : this.rows.filter((row) => this.serviceCategoryName(row) === this.activeServiceCategory))
      .filter((row) => row.id);
    if (!targets.length) {
      this.actionMessage = 'No service found for GST update.';
      return;
    }
    const label = scope === 'all' ? 'all services' : this.activeServiceCategory;
    if (!window.confirm(`Update GST to ${rate}% for ${targets.length} ${label}?`)) return;
    this.saving = true;
    this.error = '';
    this.actionMessage = '';
    this.api.post<{ updated: number }>('services/bulk-gst', {
      gstRate: rate,
      scope,
      category: this.activeServiceCategory,
      branchId: this.api.selectedBranchId()
    }).subscribe({
      next: (result) => {
        this.saving = false;
        this.actionMessage = `GST updated to ${rate}% for ${result.updated || targets.length} service(s).`;
        this.load();
      },
      error: (error) => {
        this.saving = false;
        this.error = this.api.errorText(error, 'Unable to update service GST');
      }
    });
  }

  private sortedRows(rows: ApiRecord[]): ApiRecord[] {
    if (!this.sortKey) return rows;
    return [...rows].sort((a, b) => {
      const left = String(a[this.sortKey] ?? '');
      const right = String(b[this.sortKey] ?? '');
      return this.sortDir === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
    });
  }

  private serviceCategoryName(row: ApiRecord): string {
    return String(row.category || row.serviceCategory || row.service_category || 'Uncategorized').trim() || 'Uncategorized';
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.list<ApiRecord[]>(this.config.entity, { branchId: this.api.selectedBranchId() }).subscribe({
      next: (rows) => {
        this.rows = rows;
        this.loading = false;
      },
      error: (error) => {
        this.error = error?.error?.error || 'Unable to load records';
        this.loading = false;
      }
    });
  }

  buildForm(): void {
    const group: Record<string, FormControl> = {};
    for (const field of this.config.fields) {
      const value = field.type === 'json' ? JSON.stringify(field.defaultValue ?? [], null, 2) : field.defaultValue ?? '';
      group[field.key] = new FormControl(value, field.required ? Validators.required : []);
    }
    this.form = this.fb.group(group);
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (this.showForm) this.buildForm();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.error = '';
    const payload: ApiRecord = {};
    for (const field of this.config.fields) {
      const raw = this.form.value[field.key];
      try {
        payload[field.key] = field.type === 'json' ? JSON.parse(raw || 'null') : raw;
      } catch {
        this.error = `${field.label} must be valid JSON`;
        this.saving = false;
        return;
      }
    }
    this.api.create(this.config.entity, payload).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.load();
      },
      error: (error) => {
        this.error = error?.error?.error || 'Unable to save record';
        this.saving = false;
      }
    });
  }

  sort(key: string): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
  }

  value(row: ApiRecord, column: ColumnConfig): string {
    const cell = row[column.key];
    if (column.type === 'currency') return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(cell || 0));
    if (column.type === 'date' && cell) return new Intl.DateTimeFormat('en-IN').format(new Date(cell));
    if (column.type === 'json') return JSON.stringify(cell);
    if (Array.isArray(cell)) return cell.join(', ');
    if (cell && typeof cell === 'object') return JSON.stringify(cell);
    return String(cell ?? '');
  }
}
