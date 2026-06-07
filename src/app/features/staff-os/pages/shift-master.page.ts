import { Component } from '@angular/core';
import { StaffMasterDefinitionComponent } from '../ui/staff-master-definition.component';

@Component({
  standalone: true,
  imports: [StaffMasterDefinitionComponent],
  template: `<app-staff-master-definition kind="shift" />`
})
export class ShiftMasterPage {}
