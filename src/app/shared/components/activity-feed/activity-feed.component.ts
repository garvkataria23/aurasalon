import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnInit, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WebSocketService } from '../../../core/websocket.service';

export type ActivityItem = {
  type: string;
  title: string;
  subtitle?: string;
  createdAt?: string;
  link?: string;
};

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './activity-feed.component.html',
  styleUrl: './activity-feed.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityFeedComponent implements OnInit {
  @Input() items: ActivityItem[] = [];
  @Input() loading = false;
  @Input() error = '';

  readonly realtimeItems = computed<ActivityItem[]>(() =>
    this.realtime.events()
      .filter((event) => event.type.startsWith('dashboard:') || event.type.includes('booking') || event.type.includes('payment'))
      .map((event) => ({
        type: event.type,
        title: this.titleFor(event.type),
        subtitle: this.subtitleFor(event.payload),
        createdAt: event.meta?.timestamp || new Date().toISOString()
      }))
  );

  constructor(private readonly realtime: WebSocketService) {}

  ngOnInit(): void {
    this.realtime.connect();
  }

  mergedItems(): ActivityItem[] {
    return [...this.realtimeItems(), ...(this.items || [])].slice(0, 20);
  }

  icon(type: string): string {
    if (type.includes('payment')) return '₹';
    if (type.includes('alert') || type.includes('anomaly')) return '!';
    if (type.includes('booking')) return 'B';
    if (type.includes('stock')) return 'S';
    if (type.includes('audit')) return 'A';
    return '•';
  }

  relativeTime(value = ''): string {
    if (!value) return 'Now';
    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.max(0, Math.round(diff / 60000));
    if (minutes < 1) return 'Now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.round(hours / 24)} d ago`;
  }

  private titleFor(type: string): string {
    return type
      .replace(/^dashboard:/, '')
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private subtitleFor(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';
    const record = payload as Record<string, unknown>;
    return String(record['message'] || record['title'] || record['source'] || record['appointmentId'] || '');
  }
}
