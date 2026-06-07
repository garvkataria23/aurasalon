import { Injectable } from '@angular/core';
import { ApiRecord, ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class DataIoService {
  constructor(private readonly api: ApiService) {}

  private xlsx(): Promise<typeof import('xlsx')> {
    return import('xlsx');
  }

  async exportToExcel(rows: ApiRecord[], resourceName: string, columns?: string[]): Promise<void> {
    if (!rows?.length) {
      window.dispatchEvent(new CustomEvent('aura:app-error', { detail: { message: 'Nothing to export' } }));
      return;
    }
    const XLSX = await this.xlsx();
    const sample = rows[0];
    const cols = columns?.length
      ? columns
      : Object.keys(sample).filter((key) => {
          const value = sample[key];
          return value === null || typeof value !== 'object';
        });
    const data = rows.map((row) => {
      const out: ApiRecord = {};
      for (const column of cols) {
        const value = this.valueForColumn(row, column);
        out[column] = value === null || value === undefined ? '' : (typeof value === 'object' ? JSON.stringify(value) : value);
      }
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: cols });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, resourceName.slice(0, 30));
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${resourceName}-${date}.xlsx`);
  }

  async parseExcelFile(file: File): Promise<ApiRecord[]> {
    const XLSX = await this.xlsx();
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<ApiRecord>(firstSheet, { defval: '' });
  }

  async bulkImport(resource: string, rows: ApiRecord[]): Promise<{ created: number; failed: number; errors: { row: ApiRecord; error: string }[] }> {
    let created = 0;
    let failed = 0;
    const errors: { row: ApiRecord; error: string }[] = [];
    for (const raw of rows) {
      const { id, createdAt, updatedAt, tenantId, ...payload } = raw;
      await new Promise<void>((resolve) => {
        this.api.post(resource, payload).subscribe({
          next: () => {
            created++;
            resolve();
          },
          error: (err) => {
            failed++;
            errors.push({
              row: payload,
              error: err?.error?.error || err?.message || 'Unknown'
            });
            resolve();
          }
        });
      });
    }
    return { created, failed, errors };
  }

  private valueForColumn(row: ApiRecord, column: string): unknown {
    return column.split('.').reduce<unknown>((value, key) => {
      if (value === null || value === undefined || typeof value !== 'object') return undefined;
      return (value as ApiRecord)[key];
    }, row);
  }
}
