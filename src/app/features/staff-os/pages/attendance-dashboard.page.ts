import { Component } from '@angular/core';
import { StaffOsSectionComponent } from '../ui/staff-os-section.component';

@Component({
  standalone: true,
  imports: [StaffOsSectionComponent],
  template: `<app-staff-os-section title="Attendance Dashboard" section="attendance-dashboard" />`
})
export class AttendanceDashboardPage {}
