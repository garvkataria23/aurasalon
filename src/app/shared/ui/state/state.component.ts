import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="state loading" *ngIf="visibleLoading && loadingText">{{ loadingText }}</div>
    <div class="state error" *ngIf="!loading && error">{{ error }}</div>
    <div class="state empty" *ngIf="!loading && !error && empty">{{ empty }}</div>
  `
})
export class StateComponent implements OnChanges, OnDestroy {
  @Input() loading = false;
  @Input() loadingText = '';
  @Input() error = '';
  @Input() empty = '';

  visibleLoading = false;
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loading']) {
      this.syncLoadingState();
    }
  }

  ngOnDestroy(): void {
    this.clearLoadingTimer();
  }

  private syncLoadingState(): void {
    this.clearLoadingTimer();
    if (!this.loading) {
      this.visibleLoading = false;
      return;
    }

    this.loadingTimer = setTimeout(() => {
      if (this.loading && this.loadingText) {
        this.visibleLoading = true;
      }
    }, 900);
  }

  private clearLoadingTimer(): void {
    if (!this.loadingTimer) return;
    clearTimeout(this.loadingTimer);
    this.loadingTimer = null;
  }
}
