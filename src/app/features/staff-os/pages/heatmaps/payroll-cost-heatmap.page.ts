import { Component } from '@angular/core';
import { StaffOsHeatmapComponent } from '../../ui/staff-os-heatmap.component';

@Component({
  standalone: true,
  imports: [StaffOsHeatmapComponent],
  template: `<app-staff-os-heatmap title="Payroll Cost Heatmap" endpoint="staff-os/reports/payroll" metricKey="netAmount" />`
})
export class PayrollCostHeatmapPage {}
