import { Injectable, signal } from '@angular/core';
import { AuthSessionService } from './auth-session.service';
import { AppStateService } from './state/app-state.service';

export type RealtimeFrame<T = unknown> = {
  type: string;
  payload: T;
  meta?: {
    version?: string;
    timestamp?: string;
    eventId?: string;
    channel?: string;
  };
};

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  readonly connected = signal(false);
  readonly events = signal<RealtimeFrame[]>([]);

  private socket: WebSocket | null = null;

  constructor(
    private readonly auth: AuthSessionService,
    private readonly appState: AppStateService
  ) {}

  connect(): void {
    const token = this.auth.accessToken();
    if (!token || this.socket?.readyState === WebSocket.OPEN) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const branchId = encodeURIComponent(this.appState.selectedBranchId());
    const url = `${protocol}://${window.location.host}/api/v1/realtime?token=${encodeURIComponent(token)}&branchId=${branchId}`;
    this.socket = new WebSocket(url);
    this.socket.onopen = () => {
      this.connected.set(true);
      this.send({ type: 'subscribe', channel: `tenant:${this.appState.selectedTenantId()}` });
    };
    this.socket.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data) as RealtimeFrame;
        this.events.update((items) => [frame, ...items].slice(0, 100));
      } catch {
        this.events.update((items) => [{ type: 'error', payload: { message: 'Realtime frame parse failed' } }, ...items].slice(0, 100));
      }
    };
    this.socket.onclose = () => this.connected.set(false);
    this.socket.onerror = () => this.connected.set(false);
  }

  send(frame: { type: string; channel?: string; payload?: unknown }): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(frame));
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
    this.connected.set(false);
  }
}
