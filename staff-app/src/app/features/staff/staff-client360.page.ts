import { DatePipe } from "@angular/common";
import { Component, OnDestroy, OnInit, computed, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { IonSpinner } from "@ionic/angular/standalone";
import { Subscription } from "rxjs";
import { isQueuedMutation, StaffAppService, StaffClient360, StaffDashboard } from "../../core/staff-app.service";
import { PaiseInrPipe } from "../../core/paise-inr.pipe";

@Component({
  standalone: true,
  imports: [PaiseInrPipe, DatePipe, FormsModule, RouterLink, IonSpinner],
  template: `
    <section class="page">
      <header class="page-head"><div><p class="eyebrow">Client 360</p><h1>{{ client()?.profile?.name || 'Client 360' }}</h1><p>Separate client workspace, not embedded in dashboard.</p></div></header>
      @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading Client 360...</section> }
      @if (message()) { <section class="notice success">{{ message() }}</section> }
      @if (localError()) { <section class="notice">{{ localError() }}</section> }
      @if (staff.error() && !localError()) { <section class="notice">{{ staff.error() }}</section> }

      @if (!clientId()) {
        <section class="panel">
          <div class="panel-title"><h2>Select a client</h2><span>{{ clients().length }}</span></div>
          <div class="list">
            @for (item of clients(); track item.id) { <div class="row"><div class="row-main"><strong>{{ item.name }}</strong><small>{{ item.phone || 'No phone on file' }}</small></div><a class="button" [routerLink]="['/staff/client-360', item.id]">Open</a></div> } @empty { <p class="empty">No assigned clients available for Client 360.</p> }
          </div>
        </section>
      }

      @if (client(); as data) {
        <section class="grid four">
          <article class="kpi"><span>Retention</span><strong>{{ data.retentionScore }}%</strong></article>
          <article class="kpi"><span>Visits</span><strong>{{ data.visitFrequency }}</strong></article>
          <article class="kpi"><span>Lifetime</span><strong>{{ data.lifetimeSpend | paiseInr }}</strong></article>
          <article class="kpi"><span>Outstanding</span><strong>{{ data.outstandingBalance | paiseInr }}</strong></article>
        </section>
        <section class="grid two">
          <article class="panel"><div class="panel-title"><h2>Profile</h2><span>{{ data.membership.status || 'standard' }}</span></div><div class="list"><div class="row"><strong>Phone</strong><span>{{ data.profile.phone || '-' }}</span></div><div class="row"><strong>Email</strong><span>{{ data.profile.email || '-' }}</span></div><div class="row"><strong>Birthday</strong><span>{{ data.profile.birthday || '-' }}</span></div><div class="row"><strong>Preferred</strong><span>{{ data.profile.preferredStylist || '-' }}</span></div></div></article>
          <article class="panel"><div class="panel-title"><h2>AI recommendations</h2><span>{{ data.aiRecommendations.length }}</span></div>@for (tip of data.aiRecommendations; track tip) { <p class="insight">{{ tip }}</p> } @empty { <p class="empty">No recommendations yet.</p> }</article>
        </section>
        <section class="grid two">
          <article class="panel"><div class="panel-title"><h2>Preferences</h2><span>{{ data.preferences?.tags?.length || 0 }} tags</span></div><div class="list"><div class="row"><strong>Notes</strong><span>{{ data.preferences?.notes || '-' }}</span></div><div class="row"><strong>Allergies</strong><span>{{ data.preferences?.allergies || '-' }}</span></div><div class="row"><strong>Preferred</strong><span>{{ data.preferences?.preferredStylist || '-' }}</span></div></div></article>
          <article class="panel"><div class="panel-title"><h2>Media portfolio</h2><span>{{ data.mediaPortfolio?.length || 0 }}</span></div><div class="form-grid compact-grid"><label>Title<input [(ngModel)]="mediaTitle" [disabled]="mediaPending()" /></label><label>Type<input [(ngModel)]="mediaType" [disabled]="mediaPending()" /></label><label>URL<input [(ngModel)]="mediaUrl" [disabled]="mediaPending()" placeholder="Optional external URL" /></label><label>Upload<input type="file" accept="image/*" [disabled]="mediaPending()" (change)="onMediaFile($event)" /></label></div>@if (mediaFileName()) { <p class="insight">Ready to upload: {{ mediaFileName() }}</p> }<button class="link-button" type="button" [disabled]="mediaPending()" (click)="addMedia()">{{ mediaPending() ? 'Adding...' : 'Add media' }}</button><div class="media-grid">@for (media of data.mediaPortfolio || []; track media.id) { <article><div class="media-thumb">@if (media.url) { <img [src]="media.url" [alt]="media.title" /> } @else { {{ media.type }} } </div><strong>{{ media.title }}</strong><small>{{ media.createdAt || 'ready for upload' }}</small></article> } @empty { <p class="empty">No media attached yet.</p> }</div></article>
        </section>
        <section class="panel"><div class="panel-title"><h2>Previous services</h2><span>{{ data.previousServices.length }}</span></div><div class="list">@for (item of data.previousServices; track item.id) { <div class="row"><div class="row-main"><strong>{{ item.startAt | date:'mediumDate' }}</strong><small>{{ item.serviceIds.join(', ') || 'Service' }}</small></div><span class="badge">{{ item.status }}</span></div> } @empty { <p class="empty">No previous services found.</p> }</div></section>
      }
    </section>
  `,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffClient360Page implements OnInit, OnDestroy {
  readonly client = signal<StaffClient360 | null>(null);
  readonly dashboard = signal<StaffDashboard | null>(null);
  readonly loading = signal(false);
  readonly clientId = signal("");
  mediaTitle = "Before/after photo";
  mediaType = "photo";
  mediaUrl = "";
  readonly mediaDataUrl = signal("");
  readonly mediaFileName = signal("");
  readonly mediaPending = signal(false);
  readonly message = signal("");
  readonly localError = signal("");
  readonly clients = computed(() => {
    const map = new Map<string, { id: string; name: string; phone: string }>();
    for (const item of this.dashboard()?.todayAppointments || []) if (item.clientId) map.set(item.clientId, { id: item.clientId, name: item.clientName || item.clientId, phone: item.clientPhone || "" });
    return [...map.values()];
  });
  constructor(readonly staff: StaffAppService, private readonly route: ActivatedRoute) {}
  private routeSubscription?: Subscription;
  private loadGeneration = 0;
  private fileGeneration = 0;
  ngOnInit() { this.routeSubscription = this.route.paramMap.subscribe((params) => void this.load(params.get("id") || "")); }
  ngOnDestroy() { this.routeSubscription?.unsubscribe(); }
  async load(id = this.route.snapshot.paramMap.get("id") || "") {
    const generation = ++this.loadGeneration;
    this.client.set(null);
    this.dashboard.set(null);
    this.clearMediaSelection();
    this.message.set("");
    this.localError.set("");
    this.clientId.set(id);
    this.loading.set(true);
    try {
      if (id) { const client = await this.staff.client360(id); if (generation === this.loadGeneration) this.client.set(client); }
      else { const dashboard = await this.staff.dashboard(); if (generation === this.loadGeneration) this.dashboard.set(dashboard); }
    } catch { if (generation === this.loadGeneration) this.localError.set(this.staff.error() || "Unable to load Client 360."); }
    finally { if (generation === this.loadGeneration) this.loading.set(false); }
  }

  async addMedia() {
    const id = this.clientId();
    if (!id || !this.mediaTitle.trim() || this.mediaPending()) return;
    if (!this.mediaUrl.trim() && !this.mediaDataUrl()) { this.localError.set("Choose an image or enter an external URL."); return; }
    this.mediaPending.set(true);
    this.message.set("");
    this.localError.set("");
    try {
      const result = await this.staff.addClientMedia(id, { title: this.mediaTitle.trim(), type: this.mediaType.trim() || "photo", url: this.mediaUrl.trim(), dataUrl: this.mediaDataUrl() });
      if (isQueuedMutation(result)) { this.message.set(`Media addition queued for sync (${result.queueId}).`); this.clearMediaSelection(); return; }
      this.message.set("Media added.");
      this.clearMediaSelection();
      const client = await this.staff.client360(id);
      if (id === this.clientId()) this.client.set(client);
    } catch { this.localError.set(this.staff.error() || "Unable to add client media."); }
    finally { this.mediaPending.set(false); }
  }

  onMediaFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.localError.set("");
    if (!file.type.startsWith("image/")) { this.localError.set("Only image files can be uploaded."); input.value = ""; this.clearMediaSelection(); return; }
    if (file.size > 5 * 1024 * 1024) { this.localError.set("Image must be 5 MB or smaller."); input.value = ""; this.clearMediaSelection(); return; }
    const generation = ++this.fileGeneration;
    this.mediaFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => { if (generation === this.fileGeneration) this.mediaDataUrl.set(String(reader.result || "")); };
    reader.onerror = () => { if (generation === this.fileGeneration) { this.clearMediaSelection(); this.localError.set("Unable to read the selected image."); } };
    reader.readAsDataURL(file);
  }

  private clearMediaSelection() { this.fileGeneration += 1; this.mediaUrl = ""; this.mediaDataUrl.set(""); this.mediaFileName.set(""); }
}
