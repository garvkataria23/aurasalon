import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';

type MigrationSummary = {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  duplicateRows: number;
  byEntity: Record<string, { total: number; valid: number; warnings: number; errors: number; duplicates: number }>;
  byBranch?: Record<string, { total: number; valid: number; warnings: number; errors: number }>;
};

@Component({
  selector: 'app-data-migration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page-header">
      <span class="eyebrow">Data Migration Center</span>
      <h1>Old software data import</h1>
      <p>Zenoti, Salonist, DINGG, Fresha, Tally, Busy, Marg, Excel, CSV ya manual records se master data aur historical transactions safely migrate karo.</p>
    </section>

    <section class="grid two">
      <article class="card">
        <span class="eyebrow">Step 1</span>
        <h2>New import</h2>
        <label>Source software</label>
        <select [(ngModel)]="sourceSoftware">
          <option *ngFor="let source of sourceOptions" [value]="source.value">{{ source.label }}</option>
        </select>

        <label>Resource</label>
        <select [(ngModel)]="resource">
          <option value="">Auto-detect by sheet name</option>
          <option *ngFor="let item of resourceOptions" [value]="item.value">{{ item.label }}</option>
        </select>

        <label>Excel file</label>
        <input type="file" accept=".xlsx,.xls,.csv" (change)="onFile($event)" />

        <div class="import-actions">
          <button class="secondary-button" [disabled]="!fileBase64() || loading()" (click)="analyze()">Analyze</button>
          <button class="secondary-button" [disabled]="!fileBase64() || loading()" (click)="dryRun()">Dry run</button>
          <button class="primary-button" [disabled]="!fileBase64() || loading() || hasCriticalErrors()" (click)="runImport()">Final import</button>
        </div>

        <p class="muted" *ngIf="fileName()">Selected: {{ fileName() }}</p>
        <p class="error-text" *ngIf="error()">{{ error() }}</p>
        <p class="success-text" *ngIf="message()">{{ message() }}</p>
      </article>

      <article class="card">
        <span class="eyebrow">Data safety</span>
        <h2>No-loss migration rules</h2>
        <ul class="check-list">
          <li>Preview before import</li>
          <li>Duplicate client merge by phone/email/name</li>
          <li>Original system, original record ID, createdAt and invoice numbers are preserved</li>
          <li>Dry-run validates required fields, foreign keys, duplicates and unmatched columns</li>
          <li>Transaction-safe import with row-level error report and audit trail</li>
          <li>Rollback available for last import, branch import or resource import</li>
          <li>Imported history appears in dashboards, reports, Customer 360, staff and inventory analytics</li>
        </ul>
      </article>
    </section>

    <section class="grid four" *ngIf="onboarding() as o">
      <article class="metric-card"><span>Upload status</span><strong>{{ o.uploadStatus }}</strong><small>{{ o.migrationProgress }}% progress</small></article>
      <article class="metric-card"><span>Imported records</span><strong>{{ o.importedRecordsCount }}</strong><small>Across migration jobs</small></article>
      <article class="metric-card danger"><span>Errors</span><strong>{{ o.errorsCount }}</strong><small>Needs cleanup before final sign-off</small></article>
      <article class="metric-card"><span>Rollbacks</span><strong>{{ o.rollbackHistory }}</strong><small>Completed rollback batches</small></article>
    </section>

    <section class="card" *ngIf="onboarding()?.completionChecklist?.length">
      <div class="section-title"><div><span class="eyebrow">Onboarding</span><h2>Migration completion checklist</h2></div></div>
      <ul class="check-list">
        <li *ngFor="let item of onboarding()?.completionChecklist">{{ item.done ? 'Done' : 'Open' }} - {{ item.label }}</li>
      </ul>
    </section>

    <section class="grid four" *ngIf="summary() as s">
      <article class="metric-card"><span>Total rows</span><strong>{{ s.totalRows }}</strong></article>
      <article class="metric-card"><span>Valid</span><strong>{{ s.validRows }}</strong></article>
      <article class="metric-card"><span>Warnings</span><strong>{{ s.warningRows }}</strong></article>
      <article class="metric-card danger"><span>Errors</span><strong>{{ s.errorRows }}</strong></article>
    </section>

    <section class="card" *ngIf="summary() as s">
      <div class="section-title">
        <div>
          <span class="eyebrow">Preview</span>
          <h2>Detected data</h2>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Entity</th>
              <th>Total</th>
              <th>Valid</th>
              <th>Warnings</th>
              <th>Errors</th>
              <th>Duplicates</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of entityRows()">
              <td>{{ row.entity }}</td>
              <td>{{ row.total }}</td>
              <td>{{ row.valid }}</td>
              <td>{{ row.warnings }}</td>
              <td>{{ row.errors }}</td>
              <td>{{ row.duplicates }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card" *ngIf="previewRows().length">
      <div class="section-title">
        <div>
          <span class="eyebrow">Row report</span>
          <h2>First 500 rows</h2>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sheet</th>
              <th>Row</th>
              <th>Entity</th>
              <th>Status</th>
              <th>Message</th>
              <th>Target/source</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of previewRows()">
              <td>{{ row.sourceSheet }}</td>
              <td>{{ row.sourceRowNumber }}</td>
              <td>{{ row.entity }}</td>
              <td><span class="badge" [class.danger]="row.status === 'error'" [class.warning]="row.status === 'warning'">{{ row.status }}</span></td>
              <td>{{ row.message }}</td>
              <td>{{ row.sourceExternalId || row.targetId }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <div class="section-title">
        <div>
          <span class="eyebrow">History</span>
          <h2>Migration jobs</h2>
        </div>
        <button class="danger-button" (click)="rollbackLast()">Rollback last import</button>
        <button class="secondary-button" (click)="loadJobs()">Refresh</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Created</th>
              <th>Source</th>
              <th>File</th>
              <th>Status</th>
              <th>Total</th>
              <th>Imported</th>
              <th>Errors</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let job of jobs()">
              <td>{{ job.createdAt | date: 'short' }}</td>
              <td>{{ job.sourceSoftware }}</td>
              <td>{{ job.fileName }}</td>
              <td><span class="badge">{{ job.status }}</span></td>
              <td>{{ job.totalRows }}</td>
              <td>{{ job.importedRows }}</td>
              <td>{{ job.errorRows }}</td>
              <td><button class="danger-button" [disabled]="job.status === 'rolled_back'" (click)="rollback(job.id)">Rollback</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `
})
export class DataMigrationComponent {
  readonly sourceOptions = [
    { value: 'zenoti', label: 'Zenoti' },
    { value: 'salonist', label: 'Salonist' },
    { value: 'dingg', label: 'DINGG' },
    { value: 'fresha', label: 'Fresha' },
    { value: 'tally', label: 'Tally' },
    { value: 'busy', label: 'Busy' },
    { value: 'marg', label: 'Marg' },
    { value: 'excel', label: 'Generic Excel' },
    { value: 'csv', label: 'Generic CSV' },
    { value: 'manual', label: 'Manual records' }
  ];
  readonly resourceOptions = [
    { value: 'clients', label: 'Clients' },
    { value: 'staff', label: 'Staff' },
    { value: 'services', label: 'Services' },
    { value: 'products', label: 'Products' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'vendors', label: 'Vendors' },
    { value: 'expenses', label: 'Expenses' },
    { value: 'memberships', label: 'Memberships' },
    { value: 'appointments', label: 'Appointments' },
    { value: 'sales', label: 'Sales' },
    { value: 'invoices', label: 'Invoices' },
    { value: 'payments', label: 'Payments' }
  ];
  sourceSoftware = 'dingg';
  resource = '';
  fileBase64 = signal('');
  fileName = signal('');
  loading = signal(false);
  error = signal('');
  message = signal('');
  summary = signal<MigrationSummary | null>(null);
  previewRows = signal<any[]>([]);
  jobs = signal<any[]>([]);
  onboarding = signal<any | null>(null);

  entityRows = computed(() => {
    const summary = this.summary();
    if (!summary?.byEntity) return [];
    return Object.entries(summary.byEntity).map(([entity, value]) => ({ entity, ...value }));
  });

  hasCriticalErrors = computed(() => Boolean(this.summary()?.errorRows));

  constructor(private readonly api: ApiService) {
    this.loadJobs();
  }

  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.error.set('');
    this.message.set('');
    const reader = new FileReader();
    reader.onload = () => this.fileBase64.set(String(reader.result || '').split(',').pop() || '');
    reader.onerror = () => this.error.set('File read failed.');
    reader.readAsDataURL(file);
  }

  async analyze() {
    await this.callMigration('migration/analyze', 'Analyze complete.');
  }

  async dryRun() {
    await this.callMigration('migration/dry-run', 'Dry run complete. Data abhi save nahi hua.');
  }

  async runImport() {
    if (!confirm('Final import database me data save karega. Continue?')) return;
    await this.callMigration('migration/import', 'Final import complete. Data live modules me save ho gaya.');
    await this.loadJobs();
  }

  async rollback(jobId: string) {
    if (!confirm('Rollback last imported records delete karega. Continue?')) return;
    try {
      this.loading.set(true);
      const result = await firstValueFrom(this.api.post<any>(`migration/jobs/${jobId}/rollback`, {}));
      this.message.set(result.message || 'Rollback complete.');
      await this.loadJobs();
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Rollback failed.');
    } finally {
      this.loading.set(false);
    }
  }

  async rollbackLast() {
    if (!confirm('Rollback last imported batch?')) return;
    try {
      this.loading.set(true);
      const result = await firstValueFrom(this.api.post<any>('migration/rollback/last', {}));
      this.message.set(result.message || 'Rollback last import complete.');
      await this.loadJobs();
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Rollback failed.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadJobs() {
    try {
      const jobs = await firstValueFrom(this.api.list<any[]>('migration/jobs'));
      this.jobs.set(jobs || []);
      const onboarding = await firstValueFrom(this.api.list<any>('migration/onboarding'));
      this.onboarding.set(onboarding || null);
    } catch {
      this.jobs.set([]);
    }
  }

  private async callMigration(path: string, successMessage: string) {
    if (!this.fileBase64()) {
      this.error.set('Pehle Excel file select karo.');
      return;
    }
    try {
      this.loading.set(true);
      this.error.set('');
      this.message.set('');
      const response = await firstValueFrom(
        this.api.post<any>(path, {
          sourceSoftware: this.sourceSoftware,
          resource: this.resource,
          migrationMode: true,
          fileName: this.fileName(),
          fileBase64: this.fileBase64()
        })
      );
      this.summary.set(response.summary || null);
      this.previewRows.set(response.rows || response.details?.rows || []);
      this.message.set(successMessage);
    } catch (err: any) {
      this.error.set(err?.error?.message || err?.message || 'Migration failed.');
    } finally {
      this.loading.set(false);
    }
  }
}
