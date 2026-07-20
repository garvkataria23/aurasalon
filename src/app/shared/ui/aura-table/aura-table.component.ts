import { ChangeDetectionStrategy, Component, ContentChildren, Directive, EventEmitter, Input, Output, QueryList, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuraEmptyComponent } from '../aura-empty/aura-empty.component';
import { AuraSkeletonComponent } from '../aura-skeleton/aura-skeleton.component';

export interface AuraTableColumn {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
}

export interface AuraSortChange {
  key: string;
  direction: 'asc' | 'desc';
}

@Directive({
  selector: 'ng-template[auraCell]',
  standalone: true
})
export class AuraCellDirective {
  @Input('auraCell') key = '';

  constructor(public readonly template: TemplateRef<unknown>) {}
}

@Component({
  selector: 'aura-table',
  standalone: true,
  imports: [CommonModule, AuraEmptyComponent, AuraSkeletonComponent],
  templateUrl: './aura-table.component.html',
  styleUrls: ['./aura-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuraTableComponent {
  @Input() columns: AuraTableColumn[] = [];
  @Input() rows: unknown[] = [];
  @Input() selectable = false;
  @Input() loading = false;
  @Input() emptyMessage = 'No records found';
  @Output() rowClick = new EventEmitter<unknown>();
  @Output() sortChange = new EventEmitter<AuraSortChange>();
  @Output() selectionChange = new EventEmitter<unknown[]>();
  @ContentChildren(AuraCellDirective) cellTemplates?: QueryList<AuraCellDirective>;

  sortKey = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  selected = new Set<unknown>();

  get skeletonRows(): number[] {
    return Array.from({ length: 6 }, (_, index) => index);
  }

  get columnSpan(): number {
    return this.columns.length + (this.selectable ? 1 : 0) + 1;
  }

  templateFor(key: string): TemplateRef<unknown> | null {
    return this.cellTemplates?.find((template) => template.key === key)?.template || null;
  }

  valueFor(row: unknown, key: string): unknown {
    return row && typeof row === 'object' ? (row as Record<string, unknown>)[key] : '';
  }

  onSort(column: AuraTableColumn): void {
    if (!column.sortable) return;
    if (this.sortKey === column.key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = column.key;
      this.sortDirection = 'asc';
    }
    this.sortChange.emit({ key: column.key, direction: this.sortDirection });
  }

  isSelected(row: unknown): boolean {
    return this.selected.has(row);
  }

  toggleRow(row: unknown, checked: boolean): void {
    if (checked) this.selected.add(row);
    else this.selected.delete(row);
    this.selectionChange.emit([...this.selected]);
  }

  toggleAll(checked: boolean): void {
    this.selected = checked ? new Set(this.rows) : new Set<unknown>();
    this.selectionChange.emit([...this.selected]);
  }

  allSelected(): boolean {
    return !!this.rows.length && this.rows.every((row) => this.selected.has(row));
  }
}
