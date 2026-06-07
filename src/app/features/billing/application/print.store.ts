import { Injectable, signal } from '@angular/core';
import { ApiRecord, ApiService } from '../../../core/api.service';

@Injectable()
export class PrintStore {
  readonly devices = signal<ApiRecord[]>([]);
  readonly jobs = signal<ApiRecord[]>([]);
  readonly selectedDeviceId = signal('');
  readonly lastBarcodeResult = signal<ApiRecord | null>(null);

  constructor(private readonly api: ApiService) {}

  loadDevices(): void {
    this.api.list<{ rows: ApiRecord[] }>('print/devices').subscribe((response) => this.devices.set(response.rows || []));
  }

  queueInvoicePrint(invoiceId: string, terminalId: string, branchId: string, format = 'thermal'): void {
    this.api.post('print/jobs', {
      invoice_id: invoiceId,
      terminal_id: terminalId,
      branch_id: branchId,
      device_id: this.selectedDeviceId(),
      format
    }).subscribe((job) => this.jobs.update((rows) => [job, ...rows]));
  }

  resolveBarcode(code: string, terminalId = '', branchId = ''): void {
    this.api.post('barcode/resolve', { code, terminal_id: terminalId, branch_id: branchId }).subscribe((result) => this.lastBarcodeResult.set(result));
  }
}
