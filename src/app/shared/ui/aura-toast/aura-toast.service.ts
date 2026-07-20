import { Injectable, signal } from '@angular/core';

export type AuraToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface AuraToastAction {
  label: string;
  onClick: () => void;
}

export interface AuraToastRequest {
  message: string;
  variant?: AuraToastVariant;
  duration?: number;
  action?: AuraToastAction;
}

export interface AuraToast extends Required<Omit<AuraToastRequest, 'action'>> {
  id: string;
  action?: AuraToastAction;
}

@Injectable({ providedIn: 'root' })
export class AuraToastService {
  readonly toasts = signal<AuraToast[]>([]);

  show(request: AuraToastRequest): string {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const toast: AuraToast = {
      id,
      message: request.message,
      variant: request.variant || 'info',
      duration: request.duration ?? 4000,
      action: request.action
    };
    this.toasts.update((items) => [...items, toast]);
    if (toast.duration > 0) {
      window.setTimeout(() => this.dismiss(id), toast.duration);
    }
    return id;
  }

  success(message: string): string {
    return this.show({ message, variant: 'success' });
  }

  error(message: string): string {
    return this.show({ message, variant: 'error' });
  }

  warning(message: string): string {
    return this.show({ message, variant: 'warning' });
  }

  info(message: string): string {
    return this.show({ message, variant: 'info' });
  }

  dismiss(id: string): void {
    this.toasts.update((items) => items.filter((toast) => toast.id !== id));
  }
}
