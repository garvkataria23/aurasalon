import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface AuraStatTrend {
  value: string;
  direction: 'up' | 'down' | 'flat';
}

export interface AuraStat {
  label: string;
  value: string;
  trend?: AuraStatTrend;
  subtext?: string;
}

@Component({
  selector: 'aura-stat-strip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aura-stat-strip.component.html',
  styleUrls: ['./aura-stat-strip.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuraStatStripComponent {
  @Input() stats: AuraStat[] = [];

  trendIcon(direction: AuraStatTrend['direction']): string {
    if (direction === 'up') return '↑';
    if (direction === 'down') return '↓';
    return '→';
  }
}
