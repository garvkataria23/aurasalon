import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Params, RouterLink } from '@angular/router';

type KpiTone = string | string[] | Set<string> | { [klass: string]: unknown } | null | undefined;

@Component({
  selector: 'aura-kpi-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a
      class="metric-card"
      [ngClass]="tone"
      [routerLink]="safeTarget"
      [queryParams]="queryParams"
      [attr.aria-label]="ariaLabel || 'Open KPI detail page'">
      <ng-content></ng-content>
    </a>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
      height: 100%;
    }

    .metric-card {
      position: relative;
      width: 100%;
      min-width: 0;
      min-height: 88px;
      height: 100%;
      display: grid;
      align-content: start;
      gap: 6px;
      padding: 14px 16px 12px;
      overflow: hidden;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
    }

    .metric-card:focus-visible {
      outline: 3px solid rgba(59, 130, 246, 0.55);
      outline-offset: 3px;
    }

    .metric-card ::ng-deep span,
    .metric-card ::ng-deep strong,
    .metric-card ::ng-deep small {
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .metric-card ::ng-deep span {
      white-space: nowrap;
    }

    .metric-card ::ng-deep strong {
      white-space: nowrap;
      line-height: 1.15;
    }

    .metric-card ::ng-deep small {
      white-space: nowrap;
      line-height: 1.25;
    }
  `]
})
export class AuraKpiCardComponent {
  @Input() tone: KpiTone = 'teal';
  @Input() target = '';
  @Input() queryParams: Params | null = null;
  @Input() ariaLabel = '';

  get safeTarget(): string {
    return this.target?.startsWith('/') ? this.target : '/dashboard';
  }
}
