import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ComplianceStore } from '../application/compliance.store';
import { ComplianceRouteMeta } from '../domain/compliance.models';

@Component({
  selector: 'app-compliance-section-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="compliance-page">
      <header class="hero">
        <div>
          <p class="eyebrow">Indian statutory compliance</p>
          <h1>{{ meta().title }}</h1>
          <p>{{ meta().subtitle }}</p>
        </div>
        <div class="score-card">
          <span>Compliance score</span>
          <strong>{{ store.dashboard()?.complianceScore ?? 0 }}%</strong>
          <small>{{ store.scoreLabel() }}</small>
        </div>
      </header>

      <nav class="tabs" aria-label="Compliance modules">
        <a routerLink="/compliance">Dashboard</a>
        <a routerLink="/compliance/pf">PF</a>
        <a routerLink="/compliance/esi">ESI</a>
        <a routerLink="/compliance/pt">PT</a>
        <a routerLink="/compliance/tds">TDS</a>
        <a routerLink="/compliance/gratuity">Gratuity</a>
        <a routerLink="/compliance/bonus">Bonus</a>
        <a routerLink="/compliance/reports">Reports</a>
        <a routerLink="/compliance/fy-closure">FY closure</a>
      </nav>

      <div class="state" *ngIf="store.loading()">Loading statutory dashboard...</div>
      <div class="state error" *ngIf="store.error()">{{ store.error() }}</div>

      <main class="workspace" *ngIf="!store.loading()">
        <section class="panel">
          <div class="panel-title">
            <h2>{{ meta().module | uppercase }} control center</h2>
            <button type="button">{{ meta().primaryAction }}</button>
          </div>
          <div class="module-grid">
            <article *ngFor="let item of moduleCards()" class="metric">
              <span>{{ item.key | uppercase }}</span>
              <strong>{{ item.pending }}</strong>
              <small>Pending statutory actions</small>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="panel-title">
            <h2>Upcoming deadlines</h2>
            <span>FY {{ store.dashboard()?.fy }}</span>
          </div>
          <div class="deadline" *ngFor="let deadline of store.dashboard()?.upcomingDeadlines ?? []">
            <div>
              <strong>{{ deadline.label }}</strong>
              <small>{{ deadline.module | uppercase }}</small>
            </div>
            <span>{{ deadline.dueRule }}</span>
          </div>
        </section>
      </main>
    </section>
  `,
  styles: [`
    .compliance-page { display: grid; gap: 18px; padding: 20px; color: #172033; }
    .hero { align-items: stretch; background: #f7f9fc; border: 1px solid #e4e9f2; border-radius: 8px; display: grid; gap: 16px; grid-template-columns: 1fr minmax(180px, 240px); padding: 18px; }
    .eyebrow { color: #58647a; font-size: 12px; font-weight: 700; letter-spacing: .08em; margin: 0 0 8px; text-transform: uppercase; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 28px; line-height: 1.1; }
    .hero p:last-child { color: #62708a; margin-top: 8px; }
    .score-card { background: #102033; border-radius: 8px; color: #fff; display: grid; gap: 6px; padding: 16px; }
    .score-card span, .score-card small { color: #c7d2e5; }
    .score-card strong { font-size: 34px; }
    .tabs { display: flex; flex-wrap: wrap; gap: 8px; }
    .tabs a { background: #fff; border: 1px solid #dce3ef; border-radius: 999px; color: #243044; font-size: 13px; font-weight: 700; padding: 9px 12px; text-decoration: none; }
    .workspace { display: grid; gap: 16px; grid-template-columns: minmax(0, 1.2fr) minmax(280px, .8fr); }
    .panel { background: #fff; border: 1px solid #e2e7f0; border-radius: 8px; display: grid; gap: 14px; padding: 16px; }
    .panel-title { align-items: center; display: flex; justify-content: space-between; gap: 12px; }
    .panel-title h2 { font-size: 16px; }
    button { background: #155dfc; border: 0; border-radius: 8px; color: #fff; font-weight: 700; min-height: 40px; padding: 0 14px; }
    .module-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
    .metric { border: 1px solid #e6ebf4; border-radius: 8px; display: grid; gap: 6px; padding: 14px; }
    .metric span, .metric small, .deadline small { color: #69758a; }
    .metric strong { font-size: 26px; }
    .deadline { align-items: center; border-top: 1px solid #edf1f7; display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; }
    .deadline:first-of-type { border-top: 0; }
    .deadline div { display: grid; gap: 3px; }
    .state { background: #eef5ff; border: 1px solid #cfe1ff; border-radius: 8px; padding: 14px; }
    .state.error { background: #fff1f2; border-color: #fecdd3; color: #9f1239; }
    @media (max-width: 820px) {
      .hero, .workspace { grid-template-columns: 1fr; }
      .compliance-page { padding: 14px; }
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

  ngOnInit(): void {
    this.store.loadDashboard();
  }
}
