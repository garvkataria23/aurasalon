import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface AuraBreadcrumbItem {
  label: string;
  link?: string;
}

@Component({
  selector: 'aura-page-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './aura-page-header.component.html',
  styleUrls: ['./aura-page-header.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuraPageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() breadcrumb: AuraBreadcrumbItem[] = [];
  @Input() subtitle = '';
}
