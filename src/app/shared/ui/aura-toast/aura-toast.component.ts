import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuraToast } from './aura-toast.service';

@Component({
  selector: 'aura-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aura-toast.component.html',
  styleUrls: ['./aura-toast.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuraToastComponent {
  @Input({ required: true }) toast!: AuraToast;
  @Output() dismissed = new EventEmitter<string>();

  runAction(): void {
    this.toast.action?.onClick();
    this.dismissed.emit(this.toast.id);
  }
}
