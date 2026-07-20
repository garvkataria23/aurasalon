import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

const DEDUPE_MS = 4000;
let lastErrorKey = '';
let lastErrorAt = 0;

function errorMessage(err: HttpErrorResponse): string {
  const raw =
    err?.error?.error?.message ||
    err?.error?.message ||
    err?.error?.error ||
    err?.message ||
    'Request failed';

  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    return (raw as { message?: string; code?: string }).message ||
      (raw as { code?: string }).code ||
      'Request failed';
  }
  return String(raw || 'Request failed');
}

function normalizeProxyError(err: HttpErrorResponse): HttpErrorResponse {
  if (err.status !== 400 || typeof err.error !== 'string' || !/<title>\s*400 Bad Request\s*<\/title>/i.test(err.error)) return err;
  return new HttpErrorResponse({
    error: { success: false, error: { message: 'Request rejected by the hosting proxy. Please retry.' } },
    headers: err.headers,
    status: err.status,
    statusText: err.statusText,
    url: err.url || undefined
  });
}

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((sourceError: HttpErrorResponse) => {
      const err = normalizeProxyError(sourceError);
      const message = errorMessage(err);
      const isPermissionError = err.status === 403 && /permission|forbidden/i.test(message);
      const shouldSuppress = isPermissionError && req.url.includes('/reports/dashboard');
      const key = `${err.status}:${message}:${req.method}:${req.url}`;
      const now = Date.now();
      const isDuplicate = key === lastErrorKey && now - lastErrorAt < DEDUPE_MS;
      lastErrorKey = key;
      lastErrorAt = now;
      if (!shouldSuppress && !isDuplicate) {
        window.dispatchEvent(new CustomEvent('aura:app-error', {
          detail: { message, status: err.status }
        }));
      }
      return throwError(() => err);
    })
  );
