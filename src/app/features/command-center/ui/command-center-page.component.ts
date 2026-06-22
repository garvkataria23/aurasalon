import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { CommandCenterStore } from '../application/command-center.store';
import { CommandCenterModule } from '../domain/command-center.models';

@Component({
  selector: 'app-command-center-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="command-center">
      <header class="hero">
        <div>
          <p class="eyebrow">AI-native command center</p>
          <h1>{{ store.config().title }}</h1>
          <p>{{ store.config().subtitle }}</p>
        </div>
        <div class="actions">
          <button type="button" class="ghost" (click)="store.load()">Refresh</button>
          <button type="button" class="primary" (click)="store.runAction()" [disabled]="store.saving() || !store.config().actionEndpoint || store.config().actionLabel === 'Await client'">
            {{ store.saving() ? 'Working...' : store.config().actionLabel }}
          </button>
        </div>
      </header>

      <section class="metrics" aria-label="Command center metrics">
        <article *ngFor="let metric of store.metrics()" [class]="metric.tone">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </article>
      </section>

      <div class="state" *ngIf="store.loading()">Loading command intelligence...</div>
      <div class="state error" *ngIf="store.error()">{{ store.error() }}</div>

      <main class="layout" *ngIf="!store.loading()">
        <section class="panel">
          <div class="panel-head">
            <h2>Live Records</h2>
            <span>{{ store.primary().length }} rows</span>
          </div>
          <div
            class="record"
            *ngFor="let item of store.primary()"
            [class.selected]="isSelected(item)"
            (click)="store.selected.set(item)"
            (keydown.enter)="store.selected.set(item)"
            tabindex="0"
          >
            <div>
              <strong>{{ displayTitle(item) }}</strong>
              <span>{{ displayDescription(item) || displayMeta(item) }}</span>
            </div>
            <small [class]="riskTone(item)">{{ displayRisk(item) }}</small>
          </div>
          <div class="empty" *ngIf="!store.primary().length && !store.error()">No records yet.</div>
        </section>

        <aside class="panel detail">
          <div class="panel-head">
            <h2>{{ store.config().module === 'ai-workforce' ? 'Agent Detail' : 'Approval Detail' }}</h2>
            <span>{{ store.selected()?.status || 'ready' }}</span>
          </div>
          <ng-container *ngIf="store.selected() as selected; else noSelection">
            <div class="detail-hero">
              <span>{{ store.config().module === 'ai-workforce' ? 'Selected agent' : 'Selected record' }}</span>
              <strong>{{ displayTitle(selected) }}</strong>
              <small [class]="riskTone(selected)">{{ displayRisk(selected) }}</small>
            </div>
            <p class="detail-copy" *ngIf="displayDescription(selected)">{{ displayDescription(selected) }}</p>
            <dl class="detail-grid">
              <div *ngFor="let field of detailFields(selected)">
                <dt>{{ field.label }}</dt>
                <dd>{{ field.value }}</dd>
              </div>
            </dl>
          </ng-container>
          <ng-template #noSelection>
            <div class="empty detail-empty">
              <strong>Select a record</strong>
              <span>Click any live record to inspect status, branch, version and approval context.</span>
            </div>
          </ng-template>
        </aside>
      </main>
    </section>
  `,
  styles: [`
    .command-center { display: grid; gap: 18px; padding: 24px; color: #12231d; }
    .hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .eyebrow { margin: 0 0 6px; color: #5f7069; font-size: 12px; text-transform: uppercase; }
    h1, h2, p { margin: 0; letter-spacing: 0; }
    h1 { font-size: 30px; }
    .hero p { max-width: 720px; color: #5b7068; margin-top: 6px; }
    .actions { display: flex; gap: 8px; }
    button { border-radius: 6px; min-height: 38px; padding: 0 13px; cursor: pointer; }
    .primary { border: 0; background: #174f3a; color: #fff; }
    .ghost { border: 1px solid #cbd8d2; background: #fff; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metrics article, .panel, .state { border: 1px solid #d9e5de; background: #fff; border-radius: 8px; }
    .metrics article { display: grid; gap: 8px; min-height: 78px; padding: 14px; }
    .metrics span, .record span, .panel-head span { color: #64776f; font-size: 13px; }
    .metrics strong { font-size: 22px; }
    .critical { border-color: #e5aaa4 !important; color: #9a2519; }
    .warning { border-color: #e5d39b !important; color: #7c5b00; }
    .good { border-color: #aadbbf !important; color: #1f6d43; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, .8fr); gap: 14px; }
    .panel { display: grid; align-content: start; gap: 10px; padding: 16px; }
    .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .record { display: flex; justify-content: space-between; gap: 12px; border: 1px solid #edf2ef; border-radius: 8px; padding: 12px; cursor: pointer; transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease; }
    .record:hover, .record.selected { border-color: #0f766e; box-shadow: 0 8px 22px rgba(15, 118, 110, 0.10); transform: translateY(-1px); }
    .record div { display: grid; gap: 4px; }
    .record small { border-radius: 999px; background: #eef6f1; padding: 4px 8px; align-self: start; }
    .state, .empty { padding: 14px; color: #64776f; }
    .error { border-color: #e5aaa4; color: #9a2519; }
    .detail { gap: 14px; }
    .detail-hero { display: grid; gap: 6px; padding: 14px; border: 1px solid #d9e5de; border-radius: 8px; background: #f8fbfa; }
    .detail-hero span, dt { color: #64776f; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .detail-hero strong { font-size: 20px; line-height: 1.2; }
    .detail-hero small { width: fit-content; border-radius: 999px; background: #eef6f1; padding: 4px 8px; }
    .detail-copy { margin: 0; color: #425952; line-height: 1.5; }
    .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
    .detail-grid div { display: grid; gap: 5px; padding: 12px; border: 1px solid #edf2ef; border-radius: 8px; background: #fff; }
    dd { margin: 0; font-weight: 700; word-break: break-word; }
    .detail-empty { display: grid; gap: 6px; }
    @media (max-width: 920px) {
      .hero, .layout { grid-template-columns: 1fr; display: grid; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .detail-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class CommandCenterPageComponent implements OnChanges {
  @Input({ required: true }) module!: CommandCenterModule;

  constructor(readonly store: CommandCenterStore) {}

  ngOnChanges(): void {
    if (this.module) this.store.setModule(this.module);
  }

  displayTitle(item: Record<string, unknown>): string {
    return String(
      item['agentName'] ||
      item['providerName'] ||
      item['pluginName'] ||
      item['franchiseName'] ||
      item['phone'] ||
      item['eventType'] ||
      item['aggregateType'] ||
      item['scenarioName'] ||
      item['actionType'] ||
      item['title'] ||
      item['summary'] ||
      item['leakType'] ||
      item['riskType'] ||
      item['kpiKey'] ||
      item['id'] ||
      'Record'
    );
  }

  displayMeta(item: Record<string, unknown>): string {
    return String(item['status'] || item['severity'] || item['riskLevel'] || item['createdAt'] || 'active');
  }

  displayDescription(item: Record<string, unknown>): string {
    return String(item['description'] || item['summary'] || item['actionText'] || item['recommendation'] || '');
  }

  displayRisk(item: Record<string, unknown>): string {
    return String(item['riskLevel'] || item['severity'] || item['status'] || 'normal');
  }

  riskTone(item: Record<string, unknown>): string {
    const risk = this.displayRisk(item);
    if (risk.includes('high') || risk.includes('critical')) return 'critical';
    if (risk.includes('pending') || risk.includes('medium')) return 'warning';
    return 'good';
  }

  isSelected(item: Record<string, unknown>): boolean {
    const selected = this.store.selected();
    return selected === item || (!!selected?.id && selected.id === item['id']);
  }

  detailFields(item: Record<string, unknown>): Array<{ label: string; value: string }> {
    const keys = [
      ['Agent type', 'agentType'],
      ['Agent key', 'agentKey'],
      ['Branch', 'branchId'],
      ['Tenant', 'tenantId'],
      ['Version', 'version'],
      ['Created', 'createdAt'],
      ['Updated', 'updatedAt']
    ];
    return keys
      .map(([label, key]) => ({ label, value: this.formatValue(item[key]) }))
      .filter((field) => field.value);
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
