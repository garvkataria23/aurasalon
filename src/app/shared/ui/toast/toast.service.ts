import { Injectable, signal } from '@angular/core';

export type AuraToast = {
  id: string;
  message: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
};

@Injectable({ providedIn: 'root' })
export class AuraToastService {
  readonly toasts = signal<AuraToast[]>([]);

  show(message: string, tone: AuraToast['tone'] = 'info'): void {
    const id = `toast_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    this.toasts.update((rows) => [...rows, { id, message, tone }]);
    setTimeout(() => this.dismiss(id), 4000);
  }

  dismiss(id: string): void {
    this.toasts.update((rows) => rows.filter((toast) => toast.id !== id));
  }
}
