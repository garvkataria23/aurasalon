import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AuraButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type AuraButtonSize = 'sm' | 'md';

@Component({
  selector: 'aura-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aura-button.component.html',
  styleUrls: ['./aura-button.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuraButtonComponent {
  @Input() variant: AuraButtonVariant = 'secondary';
  @Input() size: AuraButtonSize = 'md';
  @Input() icon = '';
  @Input() loading = false;
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' = 'button';
  @Output() auraClick = new EventEmitter<MouseEvent>();

  get isDisabled(): boolean {
    return this.disabled || this.loading;
  }

  onClick(event: MouseEvent): void {
    if (this.isDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.auraClick.emit(event);
  }
}
