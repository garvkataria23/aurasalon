import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthSessionService } from './auth-session.service';

/**
 * MFA + session management API client (ADD-ONLY feature).
 * Talks to the new /auth/mfa/*, /auth/secure-login*, and /auth/sessions
 * endpoints. Does not touch the existing AuthSessionService login flow.
 */

type Envelope<T> = { success?: boolean; data?: T; error?: { message?: string } };

export type MfaStatus = {
  enabled: boolean;
  pending: boolean;
  recoveryCodesRemaining?: number;
  verifiedAt?: string;
};

export type MfaEnrolment = {
  secret: string;
  otpauthUri: string;
  digits: number;
  period: number;
  algorithm: string;
};

export type MfaSession = {
  id: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  startedAt: string;
  lastSeenAt: string;
  expiresAt: string;
  status: string;
  current: boolean;
};

@Injectable({ providedIn: 'root' })
export class MfaApiService {
  constructor(private readonly http: HttpClient, private readonly auth: AuthSessionService) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({ authorization: `Bearer ${this.auth.accessToken()}` });
  }

  private get base(): string {
    return environment.secureApiBaseUrl;
  }

  private unwrap<T>(response: Envelope<T> | T): T {
    if (response && typeof response === 'object' && 'success' in response) {
      const env = response as Envelope<T>;
      if (env.success === false) throw new Error(env.error?.message || 'Request failed');
      return env.data as T;
    }
    return response as T;
  }

  status(): Observable<MfaStatus> {
    return this.http
      .get<Envelope<MfaStatus> | MfaStatus>(`${this.base}/auth/mfa/status`, { headers: this.headers() })
      .pipe(map((r) => this.unwrap(r)));
  }

  setup(): Observable<MfaEnrolment> {
    return this.http
      .post<Envelope<MfaEnrolment> | MfaEnrolment>(`${this.base}/auth/mfa/setup`, {}, { headers: this.headers() })
      .pipe(map((r) => this.unwrap(r)));
  }

  enable(code: string): Observable<{ enabled: boolean; recoveryCodes: string[] }> {
    return this.http
      .post<Envelope<{ enabled: boolean; recoveryCodes: string[] }>>(`${this.base}/auth/mfa/enable`, { code }, { headers: this.headers() })
      .pipe(map((r) => this.unwrap(r)));
  }

  disable(code: string): Observable<{ enabled: boolean }> {
    return this.http
      .post<Envelope<{ enabled: boolean }>>(`${this.base}/auth/mfa/disable`, { code }, { headers: this.headers() })
      .pipe(map((r) => this.unwrap(r)));
  }

  sessions(): Observable<MfaSession[]> {
    return this.http
      .get<Envelope<{ sessions: MfaSession[] }>>(`${this.base}/auth/sessions`, { headers: this.headers() })
      .pipe(map((r) => this.unwrap(r).sessions || []));
  }

  revokeSession(id: string): Observable<unknown> {
    return this.http.post(`${this.base}/auth/sessions/${id}/revoke`, {}, { headers: this.headers() });
  }

  revokeOthers(): Observable<{ revoked: number }> {
    return this.http
      .post<Envelope<{ revoked: number }>>(`${this.base}/auth/sessions/revoke-others`, {}, { headers: this.headers() })
      .pipe(map((r) => this.unwrap(r)));
  }
}
