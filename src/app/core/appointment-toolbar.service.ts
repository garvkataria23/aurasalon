import { Injectable, signal } from '@angular/core';

export type AppointmentCalendarLayout = 'grid' | 'compact-grid' | 'timeline' | 'list';

@Injectable({ providedIn: 'root' })
export class AppointmentToolbarService {
  readonly visible = signal(false);
  readonly slotMinutes = signal(15);
  readonly calendarLayout = signal<AppointmentCalendarLayout>('grid');
  readonly scheduledStaffVisibleCount = signal(0);
  readonly staffPanelOpen = signal(false);
  readonly staffToggleRequests = signal(0);
  readonly safeSlotCount = signal(0);
  readonly waitlistCount = signal(0);
  readonly riskText = signal('');
  readonly safeSlotRequests = signal(0);
  readonly operationsRequests = signal(0);

  setSlotMinutes(value: string | number): void {
    this.slotMinutes.set(Number(value) === 30 ? 30 : 15);
  }

  setCalendarLayout(value: string): void {
    const allowed = new Set(['grid', 'compact-grid', 'timeline', 'list']);
    this.calendarLayout.set((allowed.has(value) ? value : 'grid') as AppointmentCalendarLayout);
  }

  requestStaffPanelToggle(): void {
    this.staffToggleRequests.update((count) => count + 1);
  }

  requestSafeSlots(): void {
    this.safeSlotRequests.update((count) => count + 1);
  }

  requestOperations(): void {
    this.operationsRequests.update((count) => count + 1);
  }
}
