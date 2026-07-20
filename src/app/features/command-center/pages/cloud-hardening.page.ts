import { Component } from '@angular/core';
import { CommandCenterPageComponent } from '../ui/command-center-page.component';

@Component({
  standalone: true,
  imports: [CommandCenterPageComponent],
  template: `<app-command-center-page module="cloud-hardening"></app-command-center-page>`
})
export class CloudHardeningPage {}
