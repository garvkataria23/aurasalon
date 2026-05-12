import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Unexpected application error';
    window.dispatchEvent(new CustomEvent('aura:app-error', { detail: { message } }));
  }
}
