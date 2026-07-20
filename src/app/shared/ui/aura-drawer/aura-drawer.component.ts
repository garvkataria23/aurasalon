import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AuraDrawerWidth = '380' | '480' | '640';

@Component({
  selector: 'aura-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aura-drawer.component.html',
  styleUrls: ['./aura-drawer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuraDrawerComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input({ required: true }) title = '';
  @Input() width: AuraDrawerWidth = '480';
  @Input() closeOnBackdrop = true;
  @Output() openChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if ('open' in changes) this.syncBodyScroll();
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  onBackdrop(): void {
    if (this.closeOnBackdrop) this.close();
  }

  close(): void {
    this.open = false;
    this.openChange.emit(false);
    this.closed.emit();
    this.unlockBodyScroll();
  }

  private syncBodyScroll(): void {
    if (this.open) {
      if (typeof document !== 'undefined') document.body.style.overflow = 'hidden';
      return;
    }
    this.unlockBodyScroll();
  }

  private unlockBodyScroll(): void {
    if (typeof document !== 'undefined') document.body.style.overflow = '';
  }
}
