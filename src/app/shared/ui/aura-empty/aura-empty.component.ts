import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuraButtonComponent } from '../aura-button/aura-button.component';

@Component({
  selector: 'aura-empty',
  standalone: true,
  imports: [CommonModule, AuraButtonComponent],
  templateUrl: './aura-empty.component.html',
  styleUrls: ['./aura-empty.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuraEmptyComponent {
  @Input() icon = '📋';
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();
}
