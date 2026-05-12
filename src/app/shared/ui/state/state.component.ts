import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="state loading" *ngIf="loading">Loading live salon data...</div>
    <div class="state error" *ngIf="!loading && error">{{ error }}</div>
  `
})
export class StateComponent {
  @Input() loading = false;
  @Input() error = '';
}
