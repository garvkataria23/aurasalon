import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { ComplianceStore } from '../application/compliance.store';
import { ComplianceRouteMeta } from '../domain/compliance.models';

@Component({
  selector: 'app-compliance-section-page',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <section class="compliance-page">
      <header class="hero">
        <div class="hero-content">
          <span class="eyebrow">Indian statutory compliance</span>
          <h1>{{ meta().title }}</h1>
          <p>{{ meta().subtitle }}</p>
        </div>
        <div class="score-card">
          <span class="score-label">Compliance score</span>
          <div class="score-ring">
            <svg viewBox="0 0 64 64" class="circle-svg">
              <circle cx="32" cy="32" r="28" class="track"/>
              <circle cx="32" cy="32" r="28" class="fill" [style.stroke-dasharray]="(store.dashboard()?.complianceScore ?? 0) * 1.76 + ' 176'"/>
            </svg>
            <strong>{{ store.dashboard()?.complianceScore ?? 0 }}%</strong>
          </div>
          <small>{{ store.scoreLabel() }}</small>
        </div>
      </header>

      <nav class="nav-strip" aria-label="Compliance modules">
        <a routerLink="/compliance" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Dashboard</a>
        <a routerLink="/compliance/pf" routerLinkActive="active">PF</a>
        <a routerLink="/compliance/esi" routerLinkActive="active">ESI</a>
        <a routerLink="/compliance/pt" routerLinkActive="active">PT</a>
        <a routerLink="/compliance/tds" routerLinkActive="active">TDS</a>
        <a routerLink="/compliance/gratuity" routerLinkActive="active">Gratuity</a>
        <a routerLink="/compliance/bonus" routerLinkActive="active">Bonus</a>
        <a routerLink="/compliance/reports" routerLinkActive="active">Reports</a>
        <a routerLink="/compliance/fy-closure" routerLinkActive="active">FY closure</a>
      </nav>

      <div class="state" *ngIf="store.loading()">Loading statutory dashboard…</div>
      <div class="state error" *ngIf="store.error()">{{ store.error() }}</div>

      <main class="workspace" *ngIf="!store.loading()">
        <section class="panel">
          <header class="panel-header">
            <h2>{{ meta().module | uppercase }} control center</h2>
            <button type="button">{{ meta().primaryAction }}</button>
          </header>
          <div class="module-grid">
            <article *ngFor="let item of moduleCards(); trackBy:trackByKey" class="metric-card">
              <span class="metric-key">{{ item.key | uppercase }}</span>
              <strong class="metric-val">{{ item.pending }}</strong>
              <span class="metric-label">Pending actions</span>
            </article>
          </div>
        </section>

        <section class="panel">
          <header class="panel-header">
            <h2>Upcoming deadlines</h2>
            <span class="fy-badge">FY {{ store.dashboard()?.fy }}</span>
          </header>
          <div class="deadlines-list">
            <div class="deadline-item" *ngFor="let deadline of store.dashboard()?.upcomingDeadlines ?? []">
              <div class="deadline-info">
                <span class="deadline-dot"></span>
                <div>
                  <strong>{{ deadline.label }}</strong>
                  <small>{{ deadline.module | uppercase }}</small>
                </div>
              </div>
              <span class="deadline-rule">{{ deadline.dueRule }}</span>
            </div>
            <div class="deadlines-empty" *ngIf="!(store.dashboard()?.upcomingDeadlines ?? []).length">
              <span>No upcoming deadlines</span>
            </div>
          </div>
        </section>
      </main>
    </section>
  `,
  styles: [`
    .compliance-page { display: grid; gap: 20px; padding: 24px; color: var(--ink); }
    .hero { align-items: stretch; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; display: grid; gap: 16px; grid-template-columns: 1fr minmax(180px, 200px); padding: 0; overflow: hidden; }
    .hero-content { padding: 22px 0 22px 24px; border-left: 4px solid var(--color-primary); }
    .eyebrow { color: var(--color-primary); font-size: 11px; font-weight: 800; letter-spacing: .1em; margin: 0 0 6px; text-transform: uppercase; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 26px; line-height: 1.15; letter-spacing: -.02em; }
    .hero-content p { color: var(--muted); margin-top: 6px; font-size: 14px; line-height: 1.5; }
    .score-card { background: var(--color-primary); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 18px 16px; text-align: center; }
    .score-label { color: rgba(255,255,255,.7); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
    .score-ring { position: relative; display: inline-flex; align-items: center; justify-content: center; }
    .circle-svg { width: 64px; height: 64px; transform: rotate(-90deg); }
    .circle-svg .track { fill: none; stroke: rgba(255,255,255,.2); stroke-width: 4; }
    .circle-svg .fill { fill: none; stroke: #fff; stroke-width: 4; stroke-linecap: round; transition: stroke-dasharray .6s ease; }
    .score-ring strong { position: absolute; font-size: 18px; letter-spacing: 0; color: #fff; }
    .score-card small { color: rgba(255,255,255,.7); font-size: 12px; margin-top: 2px; }
    .nav-strip { display: flex; flex-wrap: wrap; gap: 6px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 6px 8px; }
    .nav-strip a { border-radius: 8px; color: var(--muted); font-size: 13px; font-weight: 600; padding: 8px 16px; text-decoration: none; transition: all .15s; }
    .nav-strip a:hover { color: var(--color-primary); background: var(--color-primary-soft); }
    .nav-strip a.active { color: var(--surface); background: var(--color-primary); font-weight: 700; }
    .workspace { display: grid; gap: 16px; }
    .panel { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; display: grid; gap: 16px; padding: 0; overflow: hidden; }
    .panel-header { align-items: center; display: flex; justify-content: space-between; gap: 12px; padding: 16px 20px 0; }
    .panel-header h2 { font-size: 15px; font-weight: 800; letter-spacing: -.01em; }
    .fy-badge { background: var(--color-primary-soft); border-radius: 6px; color: var(--color-primary); font-size: 12px; font-weight: 700; padding: 4px 10px; }
    button { background: var(--color-primary); border: 0; border-radius: 8px; color: var(--surface); font-size: 13px; font-weight: 700; min-height: 34px; padding: 0 14px; cursor: pointer; transition: background .15s, transform .1s; white-space: nowrap; }
    button:hover { background: var(--color-primary-strong); transform: translateY(-1px); }
    .module-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); padding: 0 20px 18px; }
    .metric-card { background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; display: grid; gap: 2px; padding: 14px; transition: all .15s; }
    .metric-card:hover { border-color: var(--color-primary-ring); box-shadow: 0 2px 8px rgba(79,70,229,.08); }
    .metric-key { color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .06em; }
    .metric-val { font-size: 22px; color: var(--color-primary); letter-spacing: -.01em; }
    .metric-label { color: var(--muted); font-size: 12px; }
    .deadlines-list { padding: 0 20px 18px; display: grid; gap: 0; }
    .deadline-item { align-items: center; display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
    .deadline-item:last-of-type { border-bottom: 0; }
    .deadline-info { display: flex; align-items: center; gap: 10px; }
    .deadline-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-primary); flex-shrink: 0; }
    .deadline-info div { display: grid; gap: 1px; }
    .deadline-info strong { font-size: 14px; font-weight: 700; }
    .deadline-info small { color: var(--muted); font-size: 12px; font-weight: 600; }
    .deadline-rule { color: var(--muted); font-size: 12px; font-weight: 600; background: var(--surface-2); border-radius: 6px; padding: 4px 10px; white-space: nowrap; }
    .deadlines-empty { padding: 24px 0; text-align: center; color: var(--muted); font-size: 14px; }
    .state { background: var(--color-primary-soft); border: 1px solid var(--color-primary-ring); border-radius: 10px; padding: 14px 18px; color: var(--color-primary-strong); font-weight: 600; }
    .state.error { background: #fef2f2; border-color: #fecaca; color: var(--red); }
    @media (max-width: 820px) {
      .hero { grid-template-columns: 1fr; }
      .compliance-page { padding: 16px; }
      .nav-strip { padding: 6px; }
      .nav-strip a { padding: 6px 12px; font-size: 12px; }
    }
  `]
})
export class ComplianceSectionPage implements OnInit {
  readonly store = inject(ComplianceStore);
  private readonly route = inject(ActivatedRoute);
  readonly meta = computed<ComplianceRouteMeta>(() => this.route.snapshot.data['meta'] as ComplianceRouteMeta);
  readonly moduleCards = computed(() => {
    const modules = this.store.dashboard()?.modules ?? {};
    return Object.entries(modules).map(([key, value]) => ({ key, pending: value.pending ?? 0 }));
  });

  readonly trackByKey = (_i: number, item: { key: string }) => item.key;

  ngOnInit(): void {
    this.store.loadDashboard();
  }
}
