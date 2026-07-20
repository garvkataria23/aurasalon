import { Component } from '@angular/core';
import { StaffOsHeatmapComponent } from '../../ui/staff-os-heatmap.component';

@Component({
  standalone: true,
  imports: [StaffOsHeatmapComponent],
  template: `<app-staff-os-heatmap title="Roster Heatmap" endpoint="staff-os/roster/coverage" metricKey="coverageScore" />`
})
export class RosterHeatmapPage {}
