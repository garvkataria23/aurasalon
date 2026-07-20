import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AuraBadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
export type AuraBadgeSize = 'sm' | 'md';

@Component({
  selector: 'aura-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aura-badge.component.html',
  styleUrls: ['./aura-badge.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuraBadgeComponent {
  @Input() variant: AuraBadgeVariant = 'neutral';
  @Input() size: AuraBadgeSize = 'sm';
  @Input() dot = false;
}
