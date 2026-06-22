import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AuraToastService } from './toast.service';

@Component({
  selector: 'aura-toast-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="aura-toast-host" aria-live="polite">
      <article class="aura-toast" *ngFor="let toast of toastService.toasts()" [class]="toast.tone">
        <span>{{ toast.message }}</span>
        <button type="button" aria-label="Dismiss toast" (click)="toastService.dismiss(toast.id)">×</button>
      </article>
    </div>
  `,
  styles: [`
    .aura-toast-host {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 120;
      display: grid;
      gap: 8px;
      width: min(360px, calc(100vw - 32px));
    }
    .aura-toast {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 44px;
      border: 1px solid var(--line);
      border-left-width: 4px;
      border-radius: var(--aura-radius-lg, 8px);
      padding: 10px 12px;
      background: var(--surface);
      box-shadow: var(--shadow-md);
      color: var(--ink);
      font-size: var(--aura-fs-sm, 13px);
      font-weight: 700;
    }
    .success { border-left-color: var(--success-500, #10b981); }
    .warning { border-left-color: var(--warning-500, #f59e0b); }
    .danger { border-left-color: var(--danger-500, #ef4444); }
    .info { border-left-color: var(--info-500, #3b82f6); }
    button {
      width: 26px;
      height: 26px;
      border: 0;
      border-radius: 999px;
      background: var(--surface-2);
      cursor: pointer;
    }
  `]
})
export class AuraToastComponent {
  constructor(readonly toastService: AuraToastService) {}
}
