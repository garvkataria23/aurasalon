import { ErrorHandler, Injectable } from '@angular/core';

const CHUNK_RELOAD_KEY = 'aura:chunk-reload-attempted';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error(error);

    const message = this.messageFrom(error);

    if (this.isStaleChunkError(message)) {
      this.recoverFromStaleChunk();
      return;
    }

    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    window.dispatchEvent(new CustomEvent('aura:app-error', { detail: { message } }));
  }

  private messageFrom(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      const wrapped = error as {
        message?: unknown;
        reason?: unknown;
        rejection?: unknown;
        error?: unknown;
      };

      for (const value of [wrapped.message, wrapped.reason, wrapped.rejection, wrapped.error]) {
        if (value instanceof Error) {
          return value.message;
        }

        if (typeof value === 'string' && value.trim()) {
          return value;
        }
      }
    }

    return 'Unexpected application error';
  }

  private isStaleChunkError(message: string): boolean {
    const normalized = message.toLowerCase();

    return [
      'failed to fetch dynamically imported module',
      'dynamically imported module',
      'chunkloaderror',
      'loading chunk',
      'importing a module script failed'
    ].some((needle) => normalized.includes(needle));
  }

  private recoverFromStaleChunk(): void {
    if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') {
      window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      window.dispatchEvent(
        new CustomEvent('aura:app-error', {
          detail: { message: 'Application files changed. Please refresh once to load the latest screen.' }
        })
      );
      return;
    }

    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    window.location.reload();
  }
}
