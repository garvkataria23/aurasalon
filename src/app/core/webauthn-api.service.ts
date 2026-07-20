import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthSessionService } from './auth-session.service';

/**
 * WebAuthn / Passkeys client (ADD-ONLY). Talks to /auth/webauthn/* endpoints.
 * Handles base64url <-> ArrayBuffer conversion required by navigator.credentials.
 */

type Envelope<T> = { success?: boolean; data?: T; error?: { message?: string } };
export type PasskeyInfo = { id: string; label: string; createdAt: string; lastUsedAt: string };

function b64urlToBuf(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

@Injectable({ providedIn: 'root' })
export class WebauthnApiService {
  constructor(private readonly http: HttpClient, private readonly auth: AuthSessionService) {}

  get supported(): boolean {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential;
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ authorization: `Bearer ${this.auth.accessToken()}` });
  }

  private get base(): string {
    return environment.secureApiBaseUrl;
  }

  private unwrap<T>(r: Envelope<T> | T): T {
    if (r && typeof r === 'object' && 'success' in r) {
      const e = r as Envelope<T>;
      if (e.success === false) throw new Error(e.error?.message || 'Request failed');
      return e.data as T;
    }
    return r as T;
  }

  async listCredentials(): Promise<PasskeyInfo[]> {
    const r = await firstValueFrom(
      this.http.get<Envelope<{ credentials: PasskeyInfo[] }>>(`${this.base}/auth/webauthn/credentials`, { headers: this.authHeaders() })
    );
    return this.unwrap(r).credentials || [];
  }

  /** Register a new passkey for the signed-in user. */
  async register(label = 'Passkey'): Promise<{ registered: boolean; credentialId: string }> {
    const begin = this.unwrap(
      await firstValueFrom(
        this.http.post<Envelope<any>>(`${this.base}/auth/webauthn/register/begin`, { label }, { headers: this.authHeaders() })
      )
    );
    const pk = begin.publicKey;
    const credential = (await navigator.credentials.create({
      publicKey: {
        ...pk,
        challenge: b64urlToBuf(pk.challenge),
        user: { ...pk.user, id: b64urlToBuf(pk.user.id) }
      }
    })) as PublicKeyCredential;
    const att = credential.response as AuthenticatorAttestationResponse;
    const body = {
      challengeToken: begin.challengeToken,
      id: credential.id,
      rawId: bufToB64url(credential.rawId),
      response: {
        clientDataJSON: bufToB64url(att.clientDataJSON),
        attestationObject: bufToB64url(att.attestationObject)
      }
    };
    return this.unwrap(
      await firstValueFrom(this.http.post<Envelope<any>>(`${this.base}/auth/webauthn/register/finish`, body, { headers: this.authHeaders() }))
    );
  }

  /** Passkey login. Returns the auth session tokens on success. */
  async login(tenantId: string, loginId: string): Promise<any> {
    const begin = this.unwrap(
      await firstValueFrom(this.http.post<Envelope<any>>(`${this.base}/auth/webauthn/login/begin`, { tenantId, loginId }))
    );
    const pk = begin.publicKey;
    const assertion = (await navigator.credentials.get({
      publicKey: {
        ...pk,
        challenge: b64urlToBuf(pk.challenge),
        allowCredentials: (pk.allowCredentials || []).map((c: any) => ({ ...c, id: b64urlToBuf(c.id) }))
      }
    })) as PublicKeyCredential;
    const resp = assertion.response as AuthenticatorAssertionResponse;
    const body = {
      challengeToken: begin.challengeToken,
      id: assertion.id,
      response: {
        clientDataJSON: bufToB64url(resp.clientDataJSON),
        authenticatorData: bufToB64url(resp.authenticatorData),
        signature: bufToB64url(resp.signature)
      }
    };
    return this.unwrap(
      await firstValueFrom(this.http.post<Envelope<any>>(`${this.base}/auth/webauthn/login/finish`, body))
    );
  }
}
