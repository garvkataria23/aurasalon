import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuraToastComponent } from './aura-toast.component';
import { AuraToastService } from './aura-toast.service';

@Component({
  selector: 'aura-toast-container',
  standalone: true,
  imports: [CommonModule, AuraToastComponent],
  templateUrl: './aura-toast-container.component.html',
  styleUrls: ['./aura-toast-container.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuraToastContainerComponent {
  constructor(readonly toast: AuraToastService) {}
}
