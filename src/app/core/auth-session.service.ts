import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export type LoginPayload = {
  tenantId: string;
  email: string;
  password: string;
  branchId?: string;
};

type AuthEnvelope<T> = { success?: boolean; data?: T; error?: { message?: string } };
export type AuthSession = {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: string;
  user: { id: string; name: string; loginId?: string; email: string; role: string; staffId?: string; branchId: string; branchIds: string[] };
  tenant: { id: string; name: string; slug: string; subscriptionStatus: string };
};

const STORAGE_KEY = 'aura.authSession';
const REFRESH_BUFFER_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  readonly session = signal<AuthSession | null>(this.readStoredSession());
  readonly isAuthenticated = computed(() => Boolean(this.session()?.accessToken));
  readonly accessToken = computed(() => this.session()?.accessToken || '');
  readonly currentUser = computed(() => this.session()?.user || null);
  private refreshInFlight?: Observable<AuthSession>;

  constructor(private readonly http: HttpClient) {}

  login(payload: LoginPayload): Observable<AuthSession> {
    return this.http.post<AuthEnvelope<AuthSession> | AuthSession>(`${environment.secureApiBaseUrl}/auth/login`, payload).pipe(
      map((response) => this.unwrap(response)),
      tap((session) => this.setSession(session))
    );
  }

  refreshSession(): Observable<AuthSession> {
    const current = this.session();
    if (!current?.refreshToken) {
      this.clearSession();
      return throwError(() => new Error('Session expired. Please sign in again.'));
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.http.post<AuthEnvelope<AuthSession> | AuthSession>(`${environment.secureApiBaseUrl}/auth/refresh`, {
        refreshToken: current.refreshToken
      }).pipe(
        map((response) => this.unwrap(response)),
        tap((session) => this.setSession(session)),
        finalize(() => this.refreshInFlight = undefined),
        shareReplay(1)
      );
    }
    return this.refreshInFlight;
  }

  shouldRefreshAccessToken(): boolean {
    const current = this.session();
    if (!current?.accessToken) return false;
    const expiresAt = this.tokenExpiresAt(current.accessToken);
    return Boolean(expiresAt && Date.now() + REFRESH_BUFFER_MS >= expiresAt);
  }

  logout(): void {
    const current = this.session();
    const refreshToken = current?.refreshToken || '';
    const accessToken = current?.accessToken || '';
    this.clearSession();
    if (refreshToken && accessToken) {
      this.http
        .post(`${environment.secureApiBaseUrl}/auth/logout`, { refreshToken }, { headers: { authorization: `Bearer ${accessToken}` } })
        .subscribe({ error: () => undefined });
    }
  }

  setSession(session: AuthSession): void {
    this.session.set(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  clearSession(): void {
    this.session.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private unwrap<T>(response: AuthEnvelope<T> | T): T {
    if (response && typeof response === 'object' && 'success' in response) {
      const envelope = response as AuthEnvelope<T>;
      if (envelope.success === false) throw new Error(envelope.error?.message || 'Authentication failed');
      return envelope.data as T;
    }
    return response as T;
  }

  private readStoredSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  private tokenExpiresAt(token: string): number {
    try {
      const body = token.split('.')[1];
      if (!body) return 0;
      const normalized = body.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const payload = JSON.parse(atob(padded)) as { exp?: number };
      return payload.exp ? payload.exp * 1000 : 0;
    } catch {
      return 0;
    }
  }
}
