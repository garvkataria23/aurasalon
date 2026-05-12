import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <article class="metric-card" [ngClass]="tone">
      <span>{{ label }}</span>
      <strong>{{ value }}</strong>
      <small>{{ hint }}</small>
    </article>
  `
})
export class MetricCardComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() hint = '';
  @Input() tone = 'teal';
}
