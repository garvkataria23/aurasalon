import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ApiRecord, ApiService } from '../core/api.service';

type Channel = 'whatsapp' | 'sms';

@Component({
  selector: 'app-birthday-campaign',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="birthday-page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Marketing automation</span>
          <h1>Birthday AI campaigns</h1>
          <p>Track current and upcoming birthdays, pick one of 10 AI messages and 10 offers, then send WhatsApp and SMS from the SaaS console.</p>
        </div>
        <div class="header-actions">
          <label>
            <span>Days ahead</span>
            <input type="number" min="1" max="60" [(ngModel)]="daysAhead" />
          </label>
          <button type="button" class="secondary-button" (click)="load()" [disabled]="loading()">Refresh</button>
          <button type="button" class="primary-button" (click)="sendBulk('today')" [disabled]="sending() || !(metrics().currentBirthdays || 0)">Send today</button>
          <button type="button" class="ghost-button" (click)="sendBulk('upcoming')" [disabled]="sending() || !(metrics().upcomingBirthdays || 0)">Send upcoming</button>
        </div>
      </header>

      <section class="metric-strip">
        <article><span>Today birthdays</span><strong>{{ metrics().currentBirthdays || 0 }}</strong></article>
        <article><span>Upcoming birthdays</span><strong>{{ metrics().upcomingBirthdays || 0 }}</strong></article>
        <article><span>Reachable clients</span><strong>{{ metrics().reachableClients || 0 }}</strong></article>
        <article><span>AI messages</span><strong>{{ metrics().messageSuggestions || 10 }}</strong></article>
        <article><span>AI offers</span><strong>{{ metrics().offerSuggestions || 10 }}</strong></article>
      </section>

      <section class="campaign-layout">
        <aside class="panel selector-panel">
          <div class="panel-head">
            <div>
              <span>Birthday queue</span>
              <h2>Current & upcoming</h2>
            </div>
            <button type="button" class="ghost-button" (click)="selectFirstCurrent()">Today</button>
          </div>
          <div class="filter-row">
            <button type="button" [class.active]="clientFilter() === 'all'" (click)="clientFilter.set('all')">All</button>
            <button type="button" [class.active]="clientFilter() === 'today'" (click)="clientFilter.set('today')">Today</button>
            <button type="button" [class.active]="clientFilter() === 'upcoming'" (click)="clientFilter.set('upcoming')">Upcoming</button>
          </div>
          <div class="client-list">
            <button
              type="button"
              *ngFor="let client of filteredClients()"
              [class.active]="selectedClientId() === client.id"
              (click)="selectClient(client)"
            >
              <span class="avatar">{{ initials(client.name) }}</span>
              <span><strong>{{ client.name || 'Client' }}</strong><small>{{ birthdayLabel(client) }} · {{ client.phone || 'phone missing' }}</small></span>
              <em [class.today]="client.birthdayStatus === 'today'">{{ client.birthdayStatus }}</em>
            </button>
            <p class="empty" *ngIf="!clients().length && !loading()">No birthdays found in the selected window.</p>
          </div>
        </aside>

        <main class="detail-stack">
          <section class="panel selected-panel" *ngIf="selectedClient() as client; else noClient">
            <div class="panel-head">
              <div>
                <span>{{ client.birthdayStatus === 'today' ? 'Current birthday' : 'Upcoming birthday' }}</span>
                <h2>{{ client.name }}</h2>
                <small>{{ birthdayLabel(client) }} · {{ client.phone || 'No reachable phone' }}</small>
              </div>
              <div class="channel-toggles">
                <label><input type="checkbox" [checked]="hasChannel('whatsapp')" (change)="toggleChannel('whatsapp')" /> WhatsApp</label>
                <label><input type="checkbox" [checked]="hasChannel('sms')" (change)="toggleChannel('sms')" /> SMS</label>
              </div>
            </div>

            <div class="suggestion-grid">
              <article>
                <div class="panel-head compact"><h3>10 AI text messages</h3></div>
                <button type="button" class="suggestion" *ngFor="let item of messageSuggestions(); let i = index" [class.active]="selectedMessageId() === item.id" (click)="selectMessage(item)">
                  <strong>{{ i + 1 }}. {{ item.title }}</strong>
                  <span>{{ renderMessage(item.template) }}</span>
                </button>
              </article>
              <article>
                <div class="panel-head compact"><h3>10 AI offers</h3></div>
                <button type="button" class="suggestion offer" *ngFor="let item of offerSuggestions(); let i = index" [class.active]="selectedOfferId() === item.id" (click)="selectOffer(item)">
                  <strong>{{ i + 1 }}. {{ item.title }}</strong>
                  <span>{{ item.discount }} · valid {{ item.validity }} · {{ item.bestFor }}</span>
                </button>
              </article>
            </div>

            <section class="panel preview-panel">
              <div class="panel-head compact">
                <h3>Send preview</h3>
                <button type="button" class="primary-button" [disabled]="sending() || !client.phone || !selectedChannels().length" (click)="sendSelected(client)">{{ sending() ? 'Sending...' : 'Send WhatsApp + SMS' }}</button>
              </div>
              <textarea rows="4" [(ngModel)]="customMessage"></textarea>
              <p class="success" *ngIf="message()">{{ message() }}</p>
              <p class="error" *ngIf="error()">{{ error() }}</p>
            </section>
          </section>

          <ng-template #noClient>
            <section class="panel empty-state">
              <h2>Select a birthday client</h2>
              <p>Choose a current or upcoming birthday from the left to review AI message and offer suggestions.</p>
            </section>
          </ng-template>
        </main>
      </section>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .birthday-page { display: grid; gap: 16px; padding: 16px; color: #24131c; background: radial-gradient(circle at top left, #fff3f8 0, #faf7f4 34%, #f4efe9 100%); min-height: calc(100vh - 20px); }
    .page-header, .panel, .metric-strip article { border: 1px solid #eadbd2; border-radius: 18px; background: rgba(255,255,255,.92); box-shadow: 0 18px 44px rgba(78, 22, 55, .09); }
    .page-header { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: center; padding: 22px; }
    .page-header::after { content: ''; position: absolute; inset: auto -70px -120px auto; width: 260px; height: 260px; border-radius: 999px; background: linear-gradient(135deg, rgba(90,21,63,.16), rgba(196,116,70,.12)); pointer-events: none; }
    .page-header > * { position: relative; z-index: 1; }
    .page-header h1 { margin: 5px 0 7px; color: #3d0f2c; font-size: clamp(28px, 4vw, 42px); line-height: 1; letter-spacing: -.03em; }
    .page-header p { margin: 0; color: #75616c; max-width: 880px; line-height: 1.55; }
    .eyebrow, .panel-head span, label span, .metric-strip span { color: #8b6479; font-size: 11px; font-weight: 950; letter-spacing: .09em; text-transform: uppercase; }
    .header-actions { display: flex; gap: 10px; align-items: end; }
    input, textarea { width: 100%; border: 1px solid #eadbd2; border-radius: 12px; background: #fffaf8; padding: 11px 12px; color: #24131c; font-weight: 850; box-sizing: border-box; }
    input:focus, textarea:focus { border-color: #8b2d61; box-shadow: 0 0 0 3px rgba(90,21,63,.12); outline: none; }
    textarea { resize: vertical; font-family: inherit; line-height: 1.5; }
    button { min-height: 42px; border: 1px solid #eadbd2; border-radius: 12px; padding: 0 15px; background: #fff; color: #3d0f2c; font-weight: 950; cursor: pointer; transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
    button:not(:disabled):hover { border-color: #caa99b; box-shadow: 0 10px 22px rgba(78,22,55,.10); transform: translateY(-1px); }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .primary-button { background: linear-gradient(135deg, #5A153F, #7A2D57); border-color: #5A153F; color: #fff; }
    .secondary-button { background: #F8EEF4; border-color: #E7DDD6; color: #4B1238; }
    .ghost-button { background: #fff; }
    .metric-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
    .metric-strip article { position: relative; overflow: hidden; padding: 16px; }
    .metric-strip article::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; background: linear-gradient(#5A153F, #d09768); }
    .metric-strip strong { display: block; margin-top: 6px; color: #3d0f2c; font-size: 28px; letter-spacing: -.03em; }
    .campaign-layout { display: grid; grid-template-columns: minmax(280px, 360px) minmax(0, 1fr); gap: 14px; align-items: start; }
    .panel { padding: 16px; min-width: 0; }
    .selector-panel { position: sticky; top: 92px; }
    .panel-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 12px; }
    .panel-head h2, .panel-head h3 { margin: 2px 0 0; color: #3d0f2c; letter-spacing: -.02em; }
    .panel-head small { color: #7d6a73; font-weight: 750; }
    .panel-head.compact { margin-bottom: 8px; }
    .client-list, .detail-stack, .suggestion-grid article { display: grid; gap: 8px; }
    .filter-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-bottom: 8px; }
    .filter-row button.active { background: #5A153F; border-color: #5A153F; color: #fff; }
    .client-list button { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px; align-items: center; min-height: 74px; text-align: left; }
    .client-list button.active, .suggestion.active { background: linear-gradient(135deg, #fff0f6, #fffaf6); border-color: #d8b8a9; box-shadow: inset 0 0 0 1px rgba(90,21,63,.08); }
    .avatar { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #F1E8EE, #fff1e8); color: #3D0F2C; font-weight: 950; }
    .client-list strong, .client-list small { display: block; }
    .client-list small { margin-top: 3px; color: #7d6a73; font-size: 12px; }
    .client-list em { align-self: start; padding: 5px 8px; border-radius: 999px; background: #F1E8EE; color: #3D0F2C; font-size: 10px; font-style: normal; text-transform: uppercase; }
    .client-list em.today { background: #5A153F; color: #fff; }
    .channel-toggles { display: flex; flex-wrap: wrap; gap: 8px; }
    .channel-toggles label { display: inline-flex; gap: 6px; align-items: center; font-weight: 900; color: #172033; }
    .channel-toggles input { width: 16px; padding: 0; }
    .suggestion-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .suggestion { display: grid; gap: 6px; min-height: 86px; padding: 12px; text-align: left; align-content: start; }
    .suggestion strong { color: #3d0f2c; }
    .suggestion span { color: #75616c; font-size: 13px; line-height: 1.38; font-weight: 750; }
    .preview-panel { margin-top: 12px; background: linear-gradient(135deg, #fffaf8, #fff4f8); }
    .success { color: #7A4A28; font-weight: 900; }
    .error { color: #b91c1c; font-weight: 900; }
    .empty, .empty-state p { color: #64748b; font-weight: 700; }
    @media (max-width: 1100px) { .campaign-layout, .suggestion-grid { grid-template-columns: 1fr; } .selector-panel { position: static; } .metric-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) { .page-header, .metric-strip { grid-template-columns: 1fr; } .header-actions { align-items: stretch; flex-direction: column; } }
  `]
})
export class BirthdayCampaignComponent implements OnInit {
  daysAhead = 30;
  customMessage = '';
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly summary = signal<ApiRecord>({});
  readonly selectedClientId = signal('');
  readonly clientFilter = signal<'all' | 'today' | 'upcoming'>('all');
  readonly selectedMessageId = signal('birthday_msg_1');
  readonly selectedOfferId = signal('birthday_offer_1');
  readonly selectedChannels = signal<Channel[]>(['whatsapp', 'sms']);
  readonly message = signal('');
  readonly error = signal('');
  readonly metrics = computed(() => this.summary()['metrics'] || {});
  readonly clients = computed<ApiRecord[]>(() => this.rows(this.summary()['clients']));
  readonly filteredClients = computed<ApiRecord[]>(() => {
    const filter = this.clientFilter();
    if (filter === 'today') return this.clients().filter((client) => client['birthdayStatus'] === 'today');
    if (filter === 'upcoming') return this.clients().filter((client) => client['birthdayStatus'] === 'upcoming');
    return this.clients();
  });
  readonly messageSuggestions = computed<ApiRecord[]>(() => this.rows(this.summary()['messageSuggestions']));
  readonly offerSuggestions = computed<ApiRecord[]>(() => this.rows(this.summary()['offerSuggestions']));
  readonly selectedClient = computed<ApiRecord | null>(() => this.clients().find((client) => client.id === this.selectedClientId()) || this.clients()[0] || null);
  readonly selectedOffer = computed<ApiRecord>(() => this.offerSuggestions().find((item) => item.id === this.selectedOfferId()) || this.offerSuggestions()[0] || {});
  readonly selectedTemplate = computed<ApiRecord>(() => this.messageSuggestions().find((item) => item.id === this.selectedMessageId()) || this.messageSuggestions()[0] || {});

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list<ApiRecord>('birthday-campaign/summary', { daysAhead: this.daysAhead })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (value) => {
          this.summary.set(value || {});
          if (!this.selectedClientId() && this.clients().length) this.selectedClientId.set(this.clients()[0].id);
          this.refreshPreview();
        },
        error: (error) => this.error.set(error?.error?.error || 'Unable to load birthday campaigns')
      });
  }

  selectFirstCurrent(): void {
    const client = this.clients().find((row) => row.birthdayStatus === 'today') || this.clients()[0];
    if (client) this.selectClient(client);
  }

  selectClient(client: ApiRecord): void {
    this.selectedClientId.set(client.id || '');
    this.refreshPreview();
  }

  selectMessage(item: ApiRecord): void {
    this.selectedMessageId.set(item.id || '');
    this.refreshPreview();
  }

  selectOffer(item: ApiRecord): void {
    this.selectedOfferId.set(item.id || '');
    this.refreshPreview();
  }

  hasChannel(channel: Channel): boolean { return this.selectedChannels().includes(channel); }

  toggleChannel(channel: Channel): void {
    const next = this.hasChannel(channel) ? this.selectedChannels().filter((item) => item !== channel) : [...this.selectedChannels(), channel];
    this.selectedChannels.set(next);
  }

  sendBulk(mode: 'today' | 'upcoming' | 'all'): void {
    this.sending.set(true);
    this.message.set('');
    this.error.set('');
    this.api.post<ApiRecord>('birthday-campaign/send-bulk', {
      mode,
      daysAhead: this.daysAhead,
      messageId: this.selectedMessageId(),
      offerId: this.selectedOfferId(),
      channels: this.selectedChannels(),
      message: this.customMessage
    }).pipe(finalize(() => this.sending.set(false))).subscribe({
      next: (result) => this.message.set(`Birthday campaign queued: ${result['sent'] || 0} sent, ${result['failed'] || 0} failed.`),
      error: (error) => this.error.set(error?.error?.error || 'Unable to send birthday campaign')
    });
  }

  sendSelected(client: ApiRecord): void {
    this.sending.set(true);
    this.message.set('');
    this.error.set('');
    this.api.post<ApiRecord>('birthday-campaign/send', {
      clientId: client.id,
      messageId: this.selectedMessageId(),
      offerId: this.selectedOfferId(),
      channels: this.selectedChannels(),
      message: this.customMessage
    }).pipe(finalize(() => this.sending.set(false))).subscribe({
      next: () => this.message.set('Birthday WhatsApp/SMS queued successfully.'),
      error: (error) => this.error.set(error?.error?.error || 'Unable to send birthday campaign')
    });
  }

  refreshPreview(): void { this.customMessage = this.renderMessage(this.selectedTemplate()['template'] || ''); }

  renderMessage(template: string): string {
    const client = this.selectedClient() || {};
    const offer = this.selectedOffer();
    return String(template || '')
      .replaceAll('{{name}}', client['name'] || 'Client')
      .replaceAll('{{offer}}', offer['title'] || 'birthday offer')
      .replaceAll('{{discount}}', offer['discount'] || '20% off')
      .replaceAll('{{validity}}', offer['validity'] || '7 days')
      .replaceAll('{{salon}}', 'Aura Shine');
  }

  birthdayLabel(client: ApiRecord): string {
    const days = Number(client['daysUntilBirthday'] ?? 0);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days} days left`;
  }

  initials(name = ''): string {
    return String(name || 'Client').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }

  private rows(value: unknown): ApiRecord[] { return Array.isArray(value) ? value as ApiRecord[] : []; }
}

