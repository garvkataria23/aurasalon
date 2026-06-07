import { Component } from '@angular/core';
import { CommandCenterPageComponent } from '../ui/command-center-page.component';

@Component({
  standalone: true,
  imports: [CommandCenterPageComponent],
  template: `<app-command-center-page module="model-router"></app-command-center-page>`
})
export class AiModelRouterPage {}

