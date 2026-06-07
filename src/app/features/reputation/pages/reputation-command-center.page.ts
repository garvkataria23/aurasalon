import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { StateComponent } from '../../../shared/ui/state/state.component';
import { ReputationApiService } from '../data-access/reputation-api.service';
import { PlatformSummary, ReputationAlert, ReputationDashboard, ReputationReview, ReviewPlatform, SupportedPlatform } from '../domain/reputation.models';

interface PlatformCard {
  code: string;
  platformId: string;
  name: string;
  connected: boolean;
  reviewCount: number;
  averageRating: number;
  lastSyncStatus: string;
  lastSyncedAt: string;
}

interface StaffPreview {
  staffId: string;
  rating: number;
  mentions: number;
  negatives: number;
}

@Component({
  selector: 'app-reputation-command-center-page',
  standalone: true,
  imports: [CommonModule, RouterLink, StateComponent],
  template: `
    <section class="rep-page">
      <header class="page-heading">
        <div>
          <span class="eyebrow">Reputation</span>
          <h2>Command Center</h2>
          <p>Multi-platform review health, response workflow, alerts and salon quality signals in one operating view.</p>
        </div>
        <div class="heading-actions">
          <button class="ghost-button" type="button" (click)="load()" [disabled]="loading">Refresh</button>
          <a class="primary-link" routerLink="/reputation/inbox">Open inbox</a>
        </div>
      </header>

      <app-state [loading]="loading" [error]="error"></app-state>

      <ng-container *ngIf="!loading && !error && dashboard as data">
        <section class="kpi-grid" aria-label="Reputation KPIs">
          <article class="kpi-card">
            <span>Average rating</span>
            <strong>{{ data.metrics.averageRating | number: '1.1-1' }} / 5</strong>
            <small>{{ data.score.positivePct }}% positive</small>
          </article>
          <article class="kpi-card">
            <span>Total reviews</span>
            <strong>{{ data.metrics.totalReviews }}</strong>
            <small>{{ data.score.netPromoterScore }} NPS proxy</small>
          </article>
          <article class="kpi-card">
            <span>Reply rate</span>
            <strong>{{ data.metrics.replyRate }}%</strong>
            <small>{{ data.metrics.pendingReplyApprovals }} pending approvals</small>
          </article>
          <article class="kpi-card danger">
            <span>Avg reply time</span>
            <strong>{{ data.metrics.avgReplyTimeHours | number: '1.1-1' }} hrs</strong>
            <small>{{ data.metrics.unresolvedNegative }} recovery alerts</small>
          </article>
        </section>

        <section class="score-grid">
          <article class="score-panel">
            <div class="score-copy">
              <span class="eyebrow">Unified score</span>
              <h3>{{ data.score.overallScore }} / 100</h3>
              <p>{{ scoreLabel(data.score.overallScore) }}</p>
            </div>
            <div class="gauge" [style.background]="gaugeBackground(data.score.overallScore)">
              <div class="gauge-inner">
                <strong>{{ data.score.overallScore }}</strong>
                <span>score</span>
              </div>
            </div>
            <div class="score-segments">
              <div *ngFor="let segment of scoreSegmentRows">
                <span>{{ segment.label }}</span>
                <div class="meter"><i [style.width.%]="segment.value"></i></div>
                <strong>{{ segment.value }}</strong>
              </div>
            </div>
          </article>

          <article class="alerts-panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">Urgent</span>
                <h3>Alerts</h3>
              </div>
              <span class="count-pill">{{ data.alerts.length }}</span>
            </div>
            <div class="alert-list" *ngIf="data.alerts.length; else noAlerts">
              <button type="button" class="alert-row" *ngFor="let alert of data.alerts">
                <span [class]="'severity ' + alert.severity"></span>
                <div>
                  <strong>{{ alert.severity || 'normal' | titlecase }} review alert</strong>
                  <small>{{ alert.createdAt ? (alert.createdAt | date: 'medium') : 'Time not captured' }}</small>
                </div>
              </button>
            </div>
            <ng-template #noAlerts>
              <div class="empty-box">
                <strong>No urgent alerts</strong>
                <span>Low-rating escalations will appear here.</span>
              </div>
            </ng-template>
          </article>
        </section>

        <section class="platform-grid">
          <article class="platform-card" *ngFor="let platform of platformCards">
            <div class="platform-icon" [style.background]="platformColor(platform.code)">{{ initials(platform.name) }}</div>
            <div>
              <strong>{{ platform.name }}</strong>
              <span>{{ platform.connected ? platform.lastSyncStatus || 'connected' : platform.reviewCount ? 'legacy data only' : 'not connected' }}</span>
            </div>
            <div class="platform-rating">
              <b>{{ platform.averageRating | number: '1.1-1' }}</b>
              <small>{{ platform.reviewCount }} reviews</small>
            </div>
            <button class="ghost-button slim" type="button" (click)="runPlatformAction(platform)" [disabled]="platformActionBusy === platform.code">
              {{ platformActionBusy === platform.code ? 'Working' : platform.connected && platform.platformId ? 'Sync now' : 'Connect' }}
            </button>
          </article>
        </section>
        <p class="platform-action-message" *ngIf="platformActionMessage">{{ platformActionMessage }}</p>

        <div class="drawer-backdrop" *ngIf="setupPlatform" (click)="closePlatformSetup()"></div>
        <aside class="platform-setup-drawer" *ngIf="setupPlatform as setup">
          <div class="drawer-head">
            <button type="button" class="close-button" (click)="closePlatformSetup()" aria-label="Close">x</button>
            <div>
              <span class="eyebrow">Platform setup</span>
              <h3>Connect {{ setup.name }}</h3>
            </div>
          </div>
          <div class="drawer-body">
            <div class="connect-hero">
              <div class="platform-icon large" [style.background]="platformColor(setup.code)">{{ initials(setup.name) }}</div>
              <div>
                <strong>{{ setup.name }}</strong>
                <p>{{ setup.code === 'google' ? 'Google Business Profile needs OAuth access to your verified business listing before reviews/replies can sync.' : 'Create the platform record first, then configure the provider adapter or OAuth credentials.' }}</p>
              </div>
            </div>

            <div class="setup-warning" *ngIf="!selectedBranchId">
              Select one branch from the top Branch dropdown. Google reviews connect branch-by-branch, so "All branches" cannot be used for first setup.
            </div>
            <p class="setup-message" *ngIf="platformSetupMessage">{{ platformSetupMessage }}</p>

            <section>
              <strong>Required details</strong>
              <ul>
                <li *ngFor="let item of platformSetupRequirements">{{ item }}</li>
              </ul>
            </section>

            <section>
              <strong>Steps</strong>
              <ol>
                <li *ngFor="let step of platformSetupSteps">{{ step }}</li>
              </ol>
            </section>

            <div class="drawer-actions">
              <button class="ghost-button" type="button" (click)="closePlatformSetup()">Cancel</button>
              <button class="primary-link button-like" type="button" (click)="confirmPlatformConnect(setup)" [class.disabled]="platformActionBusy === setup.code">
                {{ platformActionBusy === setup.code ? 'Working' : selectedBranchId ? 'Create connection record' : 'Select branch first' }}
              </button>
            </div>
          </div>
        </aside>

        <section class="ops-grid">
          <article class="feed-panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">Live feed</span>
                <h3>Recent reviews</h3>
              </div>
              <a routerLink="/reputation/inbox">View all</a>
            </div>
            <div class="review-stream" *ngIf="data.recentReviews.length; else noReviews">
              <a class="feed-row" *ngFor="let review of data.recentReviews" routerLink="/reputation/inbox" [queryParams]="reviewQueryParams[review.id]">
                <div class="avatar" [style.background]="platformColor(review.platformCode)">{{ initials(review.reviewerName) }}</div>
                <div>
                  <strong>{{ review.reviewerName }}</strong>
                  <p>{{ review.reviewText || 'No review text captured.' }}</p>
                  <small>{{ review.platformName }} · {{ review.createdAt ? (review.createdAt | date: 'mediumDate') : 'Date missing' }}</small>
                </div>
                <span [class]="'sentiment ' + sentimentClass(review)">{{ sentimentLabel(review) }}</span>
              </a>
            </div>
            <ng-template #noReviews>
              <div class="empty-box">
                <strong>No reviews yet</strong>
                <span>Connected and legacy reviews will appear here.</span>
              </div>
            </ng-template>
          </article>

          <aside class="analytics-panel">
            <section>
              <span class="eyebrow">Sentiment preview</span>
              <h3>Visible review mix</h3>
              <div class="sentiment-bars">
                <div *ngFor="let row of sentimentPreviewRows">
                  <span>{{ row.label }}</span>
                  <div class="meter"><i [style.width.%]="row.value"></i></div>
                  <strong>{{ row.value }}%</strong>
                </div>
              </div>
            </section>

            <section>
              <span class="eyebrow">Staff preview</span>
              <h3>Attribution</h3>
              <div class="staff-list" *ngIf="staffPreviewRows.length; else noStaff">
                <div class="staff-row" *ngFor="let staff of staffPreviewRows">
                  <strong>{{ staff.staffId }}</strong>
                  <span>{{ staff.mentions }} mentions · {{ staff.rating | number: '1.1-1' }} avg</span>
                  <small>{{ staff.negatives }} recovery signals</small>
                </div>
              </div>
              <ng-template #noStaff>
                <div class="empty-box compact">
                  <strong>No staff attribution yet</strong>
                  <span>Phase 4 analysis will enrich this view.</span>
                </div>
              </ng-template>
            </section>
          </aside>
        </section>
      </ng-container>
    </section>
  `,
  styles: [`
    .rep-page { display: grid; gap: 18px; }
    .page-heading, .score-panel, .alerts-panel, .feed-panel, .analytics-panel, .kpi-card, .platform-card {
      border: 1px solid #dbe4e8;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.06);
    }
    .page-heading { display: flex; justify-content: space-between; gap: 20px; padding: 24px; align-items: center; }
    .page-heading h2 { margin: 4px 0 8px; font-size: 32px; line-height: 1.1; color: #0f172a; letter-spacing: 0; }
    .page-heading p { margin: 0; color: #53657d; max-width: 760px; line-height: 1.55; }
    .heading-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .primary-link { display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; background: #0f8f79; color: #fff; padding: 12px 16px; text-decoration: none; font-weight: 800; }
    .kpi-grid, .platform-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .kpi-card { min-height: 128px; padding: 18px; display: grid; align-content: space-between; border-top: 4px solid #0f8f79; }
    .kpi-card.danger { border-top-color: #e11d48; }
    .kpi-card span, .kpi-card small, .platform-card span, .platform-card small, .feed-row small, .feed-row p, .empty-box span, .staff-row span, .staff-row small { color: #53657d; }
    .kpi-card strong { font-size: 30px; color: #0f172a; line-height: 1; }
    .score-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; }
    .score-panel { padding: 22px; display: grid; grid-template-columns: 240px 220px minmax(0, 1fr); gap: 20px; align-items: center; }
    .score-copy h3 { margin: 5px 0; font-size: 40px; color: #0f172a; letter-spacing: 0; }
    .score-copy p { margin: 0; color: #53657d; line-height: 1.5; }
    .gauge { width: 190px; aspect-ratio: 1; border-radius: 50%; padding: 18px; display: grid; place-items: center; }
    .gauge-inner { width: 100%; height: 100%; border-radius: 50%; background: #fff; display: grid; place-items: center; align-content: center; border: 1px solid #e5edf1; }
    .gauge-inner strong { font-size: 42px; color: #0f172a; line-height: 1; }
    .gauge-inner span { color: #53657d; font-weight: 800; }
    .score-segments, .sentiment-bars { display: grid; gap: 12px; }
    .score-segments > div, .sentiment-bars > div { display: grid; grid-template-columns: 92px minmax(0, 1fr) 42px; gap: 10px; align-items: center; color: #334155; font-weight: 800; }
    .meter { height: 9px; border-radius: 999px; overflow: hidden; background: #edf2f5; }
    .meter i { display: block; height: 100%; border-radius: inherit; background: #0f8f79; }
    .alerts-panel, .feed-panel, .analytics-panel { padding: 20px; }
    .section-title { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
    .section-title h3, .analytics-panel h3 { margin: 4px 0 0; color: #0f172a; letter-spacing: 0; }
    .count-pill { background: #fff1f2; color: #be123c; border-radius: 999px; padding: 6px 10px; font-weight: 900; }
    .alert-list, .review-stream, .staff-list { display: grid; gap: 10px; }
    .alert-row, .feed-row { width: 100%; border: 1px solid #e5edf1; border-radius: 8px; background: #fff; padding: 12px; display: flex; align-items: center; gap: 12px; text-align: left; text-decoration: none; color: inherit; }
    .severity { width: 10px; height: 42px; border-radius: 999px; background: #f59e0b; }
    .severity.high, .severity.critical { background: #e11d48; }
    .platform-card { padding: 16px; display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 12px; align-items: center; }
    .platform-icon, .avatar { color: #fff; font-weight: 900; display: grid; place-items: center; }
    .platform-icon { width: 44px; height: 44px; border-radius: 8px; }
    .platform-rating { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #edf2f5; padding-top: 12px; }
    .platform-rating b { color: #0f172a; font-size: 24px; }
    .platform-card .slim { grid-column: 1 / -1; padding: 9px 10px; }
    .platform-action-message { margin: 10px 0 0; color: #53657d; font-size: 13px; }
    .drawer-backdrop { position: fixed; inset: 0; z-index: 40; background: rgba(15, 23, 42, .56); }
    .platform-setup-drawer { position: fixed; inset: 0 0 0 auto; z-index: 41; width: min(560px, 100vw); background: #fff; box-shadow: -22px 0 44px rgba(15, 23, 42, .24); display: flex; flex-direction: column; }
    .drawer-head { display: flex; gap: 12px; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e5edf1; }
    .drawer-head h3 { margin: 2px 0 0; color: #0f172a; letter-spacing: 0; }
    .close-button { width: 34px; height: 34px; border: 0; background: transparent; color: #0f172a; cursor: pointer; font-size: 30px; line-height: 1; }
    .drawer-body { padding: 24px; overflow: auto; display: grid; gap: 18px; }
    .connect-hero { display: flex; gap: 14px; align-items: center; border: 1px solid #e5edf1; border-radius: 8px; padding: 14px; background: #f8fafc; }
    .connect-hero p { margin: 4px 0 0; color: #53657d; line-height: 1.45; }
    .platform-icon.large { width: 58px; height: 58px; border-radius: 14px; flex: 0 0 auto; }
    .setup-warning { border: 1px solid #fed7aa; background: #fff7ed; color: #9a3412; border-radius: 8px; padding: 12px; font-weight: 800; line-height: 1.45; }
    .setup-message { margin: 0; border: 1px solid #c7e8df; background: #f4fbf8; color: #0f766e; border-radius: 8px; padding: 12px; font-weight: 800; line-height: 1.45; }
    .platform-setup-drawer section { border-top: 1px solid #edf2f5; padding-top: 16px; display: grid; gap: 10px; }
    .platform-setup-drawer ul, .platform-setup-drawer ol { margin: 0; padding-left: 22px; color: #53657d; line-height: 1.55; display: grid; gap: 8px; }
    .drawer-actions { display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #edf2f5; padding-top: 16px; }
    .button-like { border: 0; cursor: pointer; }
    .button-like.disabled { opacity: .6; pointer-events: none; }
    .ops-grid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: start; }
    .avatar { width: 38px; height: 38px; border-radius: 50%; flex: 0 0 auto; }
    .feed-row p { margin: 3px 0; max-width: 680px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sentiment { margin-left: auto; border-radius: 999px; padding: 6px 10px; font-weight: 900; font-size: 12px; background: #eef2f7; color: #475569; white-space: nowrap; }
    .sentiment.positive, .sentiment.very_positive { background: #e8f7f1; color: #047857; }
    .sentiment.negative, .sentiment.very_negative { background: #fff1f2; color: #be123c; }
    .analytics-panel { display: grid; gap: 22px; }
    .analytics-panel section + section { border-top: 1px solid #e5edf1; padding-top: 20px; }
    .staff-row { border: 1px solid #edf2f5; border-radius: 8px; padding: 12px; display: grid; gap: 4px; }
    .empty-box { border: 1px dashed #cfdbe3; border-radius: 8px; padding: 20px; display: grid; gap: 6px; text-align: center; color: #0f172a; }
    .empty-box.compact { text-align: left; }
    @media (max-width: 1180px) {
      .kpi-grid, .platform-grid, .score-grid, .ops-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .score-panel { grid-template-columns: 1fr; }
    }
    @media (max-width: 760px) {
      .page-heading, .heading-actions, .alert-row, .feed-row { align-items: stretch; flex-direction: column; }
      .kpi-grid, .platform-grid, .score-grid, .ops-grid { grid-template-columns: 1fr; }
      .page-heading h2 { font-size: 28px; }
      .sentiment { margin-left: 0; width: fit-content; }
    }
  `]
})
export class ReputationCommandCenterPage implements OnInit {
  dashboard: ReputationDashboard | null = null;
  platforms: ReviewPlatform[] = [];
  supported: SupportedPlatform[] = [];
  platformCards: PlatformCard[] = [];
  scoreSegmentRows: Array<{ label: string; value: number }> = [];
  sentimentPreviewRows: Array<{ label: string; value: number }> = [];
  staffPreviewRows: StaffPreview[] = [];
  reviewQueryParams: Record<string, { selected: string }> = {};
  setupPlatform: PlatformCard | null = null;
  platformSetupSteps: string[] = [];
  platformSetupRequirements: string[] = [];
  platformSetupMessage = '';
  loading = true;
  error = '';
  platformActionBusy = '';
  platformActionMessage = '';

  constructor(private readonly reputationApi: ReputationApiService) {}

  ngOnInit(): void {
    this.load();
  }

  get selectedBranchId(): string {
    return this.reputationApi.selectedBranchId();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      dashboard: this.reputationApi.dashboard(),
      platforms: this.reputationApi.platforms()
    }).subscribe({
      next: ({ dashboard, platforms }) => {
        this.dashboard = dashboard;
        this.platforms = platforms.platforms;
        this.supported = platforms.supported;
        this.refreshViewModels();
        this.loading = false;
      },
      error: (error) => {
        this.error = error?.error?.error || error?.message || 'Unable to load reputation command center';
        this.loading = false;
      }
    });
  }

  runPlatformAction(platform: PlatformCard): void {
    if (this.platformActionBusy) return;
    if (!platform.connected || !platform.platformId) {
      this.openPlatformSetup(platform);
      return;
    }

    this.platformActionBusy = platform.code;
    this.platformActionMessage = '';
    const request = platform.connected && platform.platformId
      ? this.reputationApi.syncPlatform(platform.platformId)
      : this.reputationApi.connectPlatform(platform.code, '');

    request.subscribe({
      next: (response) => {
        const result = response as { status?: string; message?: string };
        const status = result.status || result.message || 'not_configured';
        this.platformActionMessage = `${platform.name}: ${status}`;
        this.platformActionBusy = '';
        this.load();
      },
      error: (error) => {
        this.platformActionMessage = error?.error?.error || error?.message || `Unable to update ${platform.name}`;
        this.platformActionBusy = '';
      }
    });
  }

  openPlatformSetup(platform: PlatformCard): void {
    this.setupPlatform = platform;
    this.platformSetupMessage = '';
    if (platform.code === 'google') {
      this.platformSetupRequirements = [
        'Verified Google Business Profile listing access',
        'Google Cloud project with Business Profile APIs enabled',
        'OAuth client ID and secret configured on backend',
        'Business Profile account ID and location/listing ID',
        'A specific AuraShine branch selected in the Branch dropdown'
      ];
      this.platformSetupSteps = [
        'Select the exact salon branch from the top Branch dropdown.',
        'In Google Cloud Console, enable Google Business Profile APIs for the project.',
        'Create an OAuth Web Application and add AuraShine callback URL from backend config.',
        'Grant the Google account Manager or Owner access to the Business Profile listing.',
        'Create the connection record here, then complete OAuth once provider credentials are configured.'
      ];
      return;
    }
    this.platformSetupRequirements = [
      'Provider OAuth/API credentials',
      'Business listing ID or page/account ID',
      'A specific AuraShine branch selected in the Branch dropdown'
    ];
    this.platformSetupSteps = [
      'Select the branch that owns this listing.',
      'Create the connection record.',
      'Configure the provider adapter credentials on the backend.',
      'Run Sync now after credentials are active.'
    ];
  }

  closePlatformSetup(): void {
    this.setupPlatform = null;
    this.platformSetupMessage = '';
  }

  confirmPlatformConnect(platform: PlatformCard): void {
    if (!this.selectedBranchId) {
      this.platformSetupMessage = 'Branch missing: top dropdown me "All branches" ke bajay ek real branch select karo, phir connect karo.';
      return;
    }
    this.platformActionBusy = platform.code;
    this.platformSetupMessage = '';
    this.reputationApi.connectPlatform(platform.code, this.selectedBranchId).subscribe({
      next: (response) => {
        const result = response as { providerStatus?: string; status?: string; message?: string };
        this.platformSetupMessage = result.message || `${platform.name}: ${result.providerStatus || result.status || 'connection record created'}`;
        this.platformActionMessage = this.platformSetupMessage;
        this.platformActionBusy = '';
        this.load();
      },
      error: (error) => {
        this.platformSetupMessage = error?.error?.error || error?.message || `Unable to connect ${platform.name}`;
        this.platformActionBusy = '';
      }
    });
  }

  gaugeBackground(score: number): string {
    const degrees = Math.max(0, Math.min(360, Math.round(score * 3.6)));
    return `conic-gradient(#0f8f79 0deg ${degrees}deg, #edf2f5 ${degrees}deg 360deg)`;
  }

  scoreLabel(score: number): string {
    if (score >= 85) return 'Excellent reputation health across visible review channels.';
    if (score >= 70) return 'Strong reputation with a few response and recovery opportunities.';
    if (score > 0) return 'Reputation needs manager attention and faster recovery workflows.';
    return 'Connect review data to activate reputation scoring.';
  }

  private refreshViewModels(): void {
    this.platformCards = this.buildPlatformCards();
    this.scoreSegmentRows = this.dashboard ? this.buildScoreSegments(this.dashboard) : [];
    const recentReviews = this.dashboard?.recentReviews || [];
    this.sentimentPreviewRows = this.buildSentimentRows(recentReviews);
    this.staffPreviewRows = this.buildStaffLeaderboard(recentReviews);
    this.reviewQueryParams = Object.fromEntries(recentReviews.map((review) => [review.id, { selected: review.id }]));
  }

  private buildPlatformCards(): PlatformCard[] {
    const summaries = new Map<string, PlatformSummary>();
    for (const summary of this.dashboard?.platforms || []) {
      summaries.set(summary.platformCode || summary.platformId || summary.platformName, summary);
    }
    const connected = new Map(this.platforms.map((platform) => [platform.platformCode, platform]));
    const supported = this.supported.length ? this.supported.slice(0, 8) : [...summaries.values()].map((summary) => ({ code: summary.platformCode, name: summary.platformName, rateLimitPerDay: 0 }));
    return supported.map((platform) => {
      const summary = summaries.get(platform.code) || summaries.get(platform.name) || null;
      const connection = connected.get(platform.code) || null;
      return {
        code: platform.code,
        platformId: connection?.id || summary?.platformId || '',
        name: platform.name,
        connected: Boolean(connection),
        reviewCount: summary?.reviewCount || 0,
        averageRating: summary?.averageRating || 0,
        lastSyncStatus: connection?.lastSyncStatus || summary?.lastSyncStatus || 'not_configured',
        lastSyncedAt: connection?.lastSyncedAt || summary?.lastSyncedAt || ''
      };
    });
  }

  private buildScoreSegments(data: ReputationDashboard): Array<{ label: string; value: number }> {
    const segments = data.score.segments || {};
    return [
      { label: 'Quality', value: Math.round(segments['quality'] || (data.metrics.averageRating / 5) * 100 || 0) },
      { label: 'Response', value: Math.round(segments['response'] || data.metrics.replyRate || 0) },
      { label: 'Sentiment', value: Math.round(segments['sentiment'] || data.score.positivePct || 0) },
      { label: 'Recency', value: Math.round(segments['recency'] || 0) }
    ];
  }

  private buildSentimentRows(reviews: ReputationReview[]): Array<{ label: string; value: number }> {
    const total = Math.max(1, reviews.length);
    const positive = reviews.filter((review) => this.sentimentClass(review).includes('positive')).length;
    const negative = reviews.filter((review) => this.sentimentClass(review).includes('negative')).length;
    const neutral = Math.max(0, reviews.length - positive - negative);
    return [
      { label: 'Positive', value: Math.round((positive / total) * 100) },
      { label: 'Neutral', value: Math.round((neutral / total) * 100) },
      { label: 'Negative', value: Math.round((negative / total) * 100) }
    ];
  }

  private buildStaffLeaderboard(reviews: ReputationReview[]): StaffPreview[] {
    const grouped = new Map<string, { total: number; mentions: number; negatives: number }>();
    for (const review of reviews) {
      if (!review.primaryStaffId) continue;
      const row = grouped.get(review.primaryStaffId) || { total: 0, mentions: 0, negatives: 0 };
      row.total += review.rating;
      row.mentions += 1;
      if (this.sentimentClass(review).includes('negative') || review.rating <= 3) row.negatives += 1;
      grouped.set(review.primaryStaffId, row);
    }
    return [...grouped.entries()]
      .map(([staffId, row]) => ({ staffId, mentions: row.mentions, negatives: row.negatives, rating: row.mentions ? row.total / row.mentions : 0 }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);
  }

  sentimentClass(review: ReputationReview): string {
    if (review.sentiment) return review.sentiment;
    if (review.rating >= 4) return 'positive';
    if (review.rating <= 3) return 'negative';
    return 'neutral';
  }

  sentimentLabel(review: ReputationReview): string {
    return this.sentimentClass(review).replace(/_/g, ' ') || 'neutral';
  }

  platformColor(code: string): string {
    const colors: Record<string, string> = {
      google: '#4285f4',
      justdial: '#b77900',
      zomato: '#e23744',
      facebook: '#1877f2',
      instagram: '#c13584',
      whatsapp: '#0f8f79',
      internal: '#334155'
    };
    return colors[String(code || '').toLowerCase()] || '#475569';
  }

  initials(value: string): string {
    return String(value || 'NA').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }
}
