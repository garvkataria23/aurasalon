import { Component } from '@angular/core';
import { StaffOsHeatmapComponent } from '../../ui/staff-os-heatmap.component';

@Component({
  standalone: true,
  imports: [StaffOsHeatmapComponent],
  template: `<app-staff-os-heatmap title="Utilization Heatmap" endpoint="staff-os/reports/utilization" metricKey="utilizationPct" />`
})
export class UtilizationHeatmapPage {}
