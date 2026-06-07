import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-print-settings',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .print-settings { border: 1px solid #dbe3e8; border-radius: 8px; padding: 12px; display: grid; gap: 8px; }
    select, button { min-height: 36px; border: 1px solid #d2dce3; border-radius: 6px; padding: 6px 10px; }
  `],
  template: `
    <section class="print-settings">
      <strong>Print device</strong>
      <select [value]="selectedDeviceId" (change)="selectedDeviceIdChange.emit($any($event.target).value)">
        <option value="">Browser print</option>
        <option *ngFor="let device of devices" [value]="device.id">{{ device.device_name || device.deviceName }}</option>
      </select>
      <button type="button" (click)="refresh.emit()">Refresh devices</button>
    </section>
  `
})
export class PrintSettingsComponent {
  @Input() devices: any[] = [];
  @Input() selectedDeviceId = '';
  @Output() selectedDeviceIdChange = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();
}
