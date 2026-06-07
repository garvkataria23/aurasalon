import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DailyClosingPanelComponent } from '../../ui/daily-closing-panel/daily-closing-panel.component';

@Component({
  selector: 'app-daily-closing-page',
  standalone: true,
  imports: [CommonModule, DailyClosingPanelComponent],
  template: `<app-daily-closing-panel (closeDay)="lastClose = $event" /><pre>{{ lastClose | json }}</pre>`
})
export class DailyClosingPageComponent {
  lastClose: unknown = null;
}
