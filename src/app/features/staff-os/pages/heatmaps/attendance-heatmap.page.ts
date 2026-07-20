import { Component } from '@angular/core';
import { StaffOsHeatmapComponent } from '../../ui/staff-os-heatmap.component';

@Component({
  standalone: true,
  imports: [StaffOsHeatmapComponent],
  template: `<app-staff-os-heatmap title="Attendance Heatmap" endpoint="staff-os/reports/attendance" metricKey="days" />`
})
export class AttendanceHeatmapPage {}
