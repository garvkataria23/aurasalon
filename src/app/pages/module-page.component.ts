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
          <button class="ghost-button" type="button" (click)="load()">Refresh</button>
        </div>

        <app-state [loading]="loading" [error]="error"></app-state>

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
      </section>
    </section>
  `
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
    if (!this.sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const left = String(a[this.sortKey] ?? '');
      const right = String(b[this.sortKey] ?? '');
      return this.sortDir === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
    });
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
