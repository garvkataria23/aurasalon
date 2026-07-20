import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface AuraTab {
  id: string;
  label: string;
  badge?: string | number;
  icon?: string;
  disabled?: boolean;
}

@Component({
  selector: 'aura-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aura-tabs.component.html',
  styleUrls: ['./aura-tabs.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuraTabsComponent {
  @Input() tabs: AuraTab[] = [];
  @Input() activeTabId = '';
  @Output() activeTabIdChange = new EventEmitter<string>();
  @Output() tabChange = new EventEmitter<string>();

  select(tab: AuraTab): void {
    if (tab.disabled || tab.id === this.activeTabId) return;
    this.activeTabId = tab.id;
    this.activeTabIdChange.emit(tab.id);
    this.tabChange.emit(tab.id);
  }
}
