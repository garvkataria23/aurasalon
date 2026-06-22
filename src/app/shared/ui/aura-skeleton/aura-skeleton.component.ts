import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

@Component({
  selector: 'aura-skeleton',
  standalone: true,
  templateUrl: './aura-skeleton.component.html',
  styleUrls: ['./aura-skeleton.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuraSkeletonComponent {
  @Input() width = '100%';
  @Input() height = '14px';
  @Input() radius = 'var(--aura-radius-sm)';
  @Input() circle = false;

  @HostBinding('style.width')
  get hostWidth(): string {
    return this.circle ? this.height : this.width;
  }

  @HostBinding('style.height')
  get hostHeight(): string {
    return this.height;
  }

  @HostBinding('style.border-radius')
  get hostRadius(): string {
    return this.circle ? 'var(--aura-radius-full)' : this.radius;
  }
}
