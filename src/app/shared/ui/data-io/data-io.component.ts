import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { ApiRecord } from '../../../core/api.service';
import { DataIoService } from '../../../core/data-io.service';

@Component({
  selector: 'app-data-io',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="data-io">
      <button class="ghost-button" type="button" (click)="onExport()" [disabled]="busy()">
        Export Excel
      </button>
      <label class="ghost-button data-io-import" [class.disabled]="busy() || !allowImport">
        Import Excel
        <input type="file" accept=".xlsx,.xls" (change)="onFile($event)" [disabled]="busy() || !allowImport" />
      </label>
      <span class="data-io-status" *ngIf="status()">
        {{ status() }}
      </span>
    </div>
  `,
  styles: [`
    .data-io {
      display: inline-flex; gap: 8px; align-items: center;
      flex-wrap: wrap;
    }
    .data-io-import { position: relative; cursor: pointer; }
    .data-io-import.disabled {
      opacity: .5; pointer-events: none;
    }
    .data-io-import input[type=file] {
      position: absolute; inset: 0; opacity: 0; cursor: pointer;
    }
    .data-io-status {
      font-size: 12px; opacity: .75;
    }
  `]
})
export class DataIoComponent {
  @Input() resource = '';
  @Input() rows: ApiRecord[] = [];
  @Input() exportColumns: string[] = [];
  @Input() allowImport = true;
  @Output() imported = new EventEmitter<void>();

  readonly busy = signal(false);
  readonly status = signal('');

  constructor(private readonly io: DataIoService) {}

  async onExport(): Promise<void> {
    if (!this.resource) return;
    this.busy.set(true);
    this.status.set('Generating Excel...');
    try {
      await this.io.exportToExcel(this.rows || [], this.resource, this.exportColumns);
      this.status.set(`Exported ${this.rows?.length || 0}`);
    } finally {
      this.busy.set(false);
    }
  }

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.resource || !this.allowImport) return;
    this.busy.set(true);
    this.status.set('Reading file...');
    try {
      const rows = await this.io.parseExcelFile(file);
      if (!rows.length) {
        this.status.set('Empty file');
        this.busy.set(false);
        return;
      }
      this.status.set(`Importing ${rows.length} rows...`);
      const result = await this.io.bulkImport(this.resource, rows);
      this.status.set(`Imported ${result.created}, failed ${result.failed}`);
      this.imported.emit();
      if (result.failed && result.errors.length) {
        window.dispatchEvent(new CustomEvent('aura:app-error', {
          detail: {
            message: `${result.failed} row(s) failed: ` + result.errors.slice(0, 2).map((error) => error.error).join('; ')
          }
        }));
      }
    } catch (err: any) {
      this.status.set('Import failed');
      console.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
