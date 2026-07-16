import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export type LoginPayload = {
  tenantId: string;
  email?: string;
  loginId?: string;
  password: string;
  branchId?: string;
  totpToken?: string;
};

type AuthEnvelope<T> = { success?: boolean; data?: T; error?: { message?: string } };
export type TwoFactorStatus = { enabled: boolean; verifiedAt?: string; pendingSetup?: boolean };
export type TwoFactorSetup = { secret: string; provisioningUri: string };
export type TwoFactorEnableResult = { enabled: boolean; recoveryCodes: string[] };
export type AuthSession = {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  refreshExpiresAt: string;
  user: { id: string; name: string; loginId?: string; email: string; role: string; staffId?: string; branchId: string; branchIds: string[]; permissions?: string[] };
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

  bootstrapOwnerPosHandoff(): Observable<void> {
    if (!window.location.pathname.replace(/\/$/, '').endsWith('/pos')) return of(undefined);
    sessionStorage.removeItem('aura.ownerPosContext');
    return this.http.post<AuthEnvelope<{ session: AuthSession; posContext: Record<string, unknown> }> | { session: AuthSession; posContext: Record<string, unknown> }>(
      `${environment.secureApiBaseUrl}/auth/owner-pos-handoff/consume`,
      {},
      { withCredentials: true }
    ).pipe(
      map((response) => this.unwrap(response)),
      tap(({ session, posContext }) => {
        this.setSession(session);
        sessionStorage.setItem('aura.ownerPosContext', JSON.stringify(posContext));
        localStorage.setItem('aura.selectedTenantId', session.tenant.id);
        localStorage.setItem('aura.userRole', session.user.role);
        localStorage.setItem('aura.selectedBranchId', session.user.branchId || '');
        localStorage.setItem(`aura.selectedBranchId.${session.tenant.id}`, session.user.branchId || '');
      }),
      map(() => undefined),
      catchError(() => of(undefined))
    );
  }

  login(payload: LoginPayload): Observable<AuthSession> {
    return this.http.post<AuthEnvelope<AuthSession> | AuthSession>(`${environment.secureApiBaseUrl}/auth/login`, payload).pipe(
      map((response) => this.unwrap(response)),
      tap((session) => this.setSession(session))
    );
  }

  static requiresTotp(error: unknown): boolean {
    const err = error as {
      error?: {
        error?: { details?: { requiresTotp?: boolean }; message?: unknown };
        details?: { requiresTotp?: boolean };
      };
    };
    return Boolean(err?.error?.error?.details?.requiresTotp || err?.error?.details?.requiresTotp);
  }

  twoFactorStatus(): Observable<TwoFactorStatus> {
    return this.authGet<TwoFactorStatus>('auth/2fa/status');
  }

  twoFactorSetup(): Observable<TwoFactorSetup> {
    return this.authPost<TwoFactorSetup>('auth/2fa/setup', {});
  }

  twoFactorEnable(token: string): Observable<TwoFactorEnableResult> {
    return this.authPost<TwoFactorEnableResult>('auth/2fa/enable', { token });
  }

  twoFactorDisable(token: string): Observable<TwoFactorStatus> {
    return this.authPost<TwoFactorStatus>('auth/2fa/disable', { token });
  }

  refreshSession(): Observable<AuthSession> {
    const current = this.session();
    if (!current) {
      this.clearSession();
      return throwError(() => new Error('Session expired. Please sign in again.'));
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.http.post<AuthEnvelope<AuthSession> | AuthSession>(`${environment.secureApiBaseUrl}/auth/refresh`, {
        refreshToken: current.refreshToken || ''
      }, { withCredentials: true }).pipe(
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
    if (accessToken) {
      this.http
        .post(`${environment.secureApiBaseUrl}/auth/logout`, { refreshToken }, { headers: { authorization: `Bearer ${accessToken}` }, withCredentials: true })
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

  private authHeaders(): { headers: { authorization: string } } {
    return { headers: { authorization: `Bearer ${this.accessToken()}` } };
  }

  private authGet<T>(path: string): Observable<T> {
    return this.http.get<AuthEnvelope<T> | T>(`${environment.secureApiBaseUrl}/${path}`, this.authHeaders()).pipe(
      map((response) => this.unwrap(response))
    );
  }

  private authPost<T>(path: string, payload: Record<string, unknown>): Observable<T> {
    return this.http.post<AuthEnvelope<T> | T>(`${environment.secureApiBaseUrl}/${path}`, payload, this.authHeaders()).pipe(
      map((response) => this.unwrap(response))
    );
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
