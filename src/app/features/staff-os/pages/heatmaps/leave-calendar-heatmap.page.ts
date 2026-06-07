import { Component } from '@angular/core';
import { StaffOsHeatmapComponent } from '../../ui/staff-os-heatmap.component';

@Component({
  standalone: true,
  imports: [StaffOsHeatmapComponent],
  template: `<app-staff-os-heatmap title="Leave Calendar Heatmap" endpoint="staff-os/leave-calendar" metricKey="value" />`
})
export class LeaveCalendarHeatmapPage {}
