import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

type ClientBeautyProfileForm = {
  allergiesText: string;
  allergySeverity: string;
  skinType: string;
  skinConcerns: string;
  hairType: string;
  scalpCondition: string;
  chemicalHistory: string;
  nailShadePreference: string;
  nailShapePreference: string;
  preferredStylistId: string;
  preferredServiceNotes: string;
  productsUsed: string;
  productsToAvoid: string;
  brandPreference: string;
  patchTestDate: string;
  patchTestResult: string;
  appointmentPreference: string;
  preferredChannel: string;
  preferredLanguage: string;
  comfortNotes: string;
  lifestyleNotes: string;
};

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe, StateComponent],
  template: `
    <section class="page-stack">
      <a class="ghost-button fit" routerLink="/clients">Back to clients</a>
      <app-state [loading]="loading()" [error]="error()"></app-state>

      <ng-container *ngIf="client() as client">
        <section class="profile-header">
          <span class="avatar large">{{ initials(client.name) }}</span>
          <div>
            <span class="eyebrow">Client profile</span>
            <h2>{{ client.name }}</h2>
            <p>{{ client.phone }} · {{ client.email || 'No email' }}</p>
            <div class="chip-row">
              <span class="badge" *ngFor="let tag of clientTags(client)">{{ tag }}</span>
            </div>
          </div>
          <div class="profile-stats">
            <strong>{{ totalBilled() | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <span>Total spend</span>
            <strong>{{ loyaltyPoints(client) }} pts</strong>
            <span>Loyalty</span>
          </div>
        </section>

        <section class="client-live-metrics">
          <article class="metric-card teal">
            <span>Wallet balance</span>
            <strong>{{ walletBalance(client) | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>Live client wallet credit</small>
          </article>
          <article class="metric-card red">
            <span>Unpaid balance</span>
            <strong>{{ totalDue() | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>{{ dueInvoices().length }} open invoice(s)</small>
          </article>
          <article class="metric-card amber">
            <span>Average bill</span>
            <strong>{{ averageBill() | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>{{ clientInvoices().length }} saved invoice(s)</small>
          </article>
          <article class="metric-card blue">
            <span>Last visit</span>
            <strong>{{ lastVisitLabel() }}</strong>
            <small>{{ visitFrequencyLabel() }}</small>
          </article>
        </section>

        <div class="dashboard-grid client-intelligence-grid">
          <section class="panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">Front desk intelligence</span>
                <h2>Next best action</h2>
              </div>
              <span class="badge">{{ clientRiskLevel() }}</span>
            </div>
            <div class="client-action-card">
              <strong>{{ nextBestAction() }}</strong>
              <span>{{ nextBestReason() }}</span>
              <div class="client-action-list">
                <span>Health score: {{ clientHealthScore() }}/100</span>
                <span>Preferred staff: {{ preferredStaffLabel() }}</span>
                <span>Top service: {{ topServiceLabel() }}</span>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">Personal and salon context</span>
                <h2>Profile facts</h2>
              </div>
            </div>
            <div class="info-grid">
              <div><span>Gender</span><strong>{{ client.gender || '-' }}</strong></div>
              <div><span>First visit</span><strong>{{ firstVisitLabel(client) }}</strong></div>
              <div><span>Birthday</span><strong>{{ client.birthday || 'Not set' }}</strong></div>
              <div><span>Anniversary</span><strong>{{ client.anniversary || 'Not set' }}</strong></div>
              <div><span>Mobile</span><strong>{{ client.phone || '-' }}</strong></div>
              <div><span>Email</span><strong>{{ client.email || 'No email' }}</strong></div>
              <div><span>Allergies</span><strong [class.danger-text]="profileSummary(client, 'allergies') !== 'None captured'">{{ profileSummary(client, 'allergies') }}</strong></div>
              <div><span>Skin type</span><strong>{{ profileSummary(client, 'skinType') }}</strong></div>
              <div><span>Hair type</span><strong>{{ profileSummary(client, 'hairType') }}</strong></div>
              <div><span>Preferred stylist</span><strong>{{ preferredStylistName(client) }}</strong></div>
            </div>
          </section>
        </div>

        <div class="dashboard-grid client-beauty-layout">
          <section class="panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">Beauty and safety profile</span>
                <h2>Client preferences for faster service</h2>
              </div>
              <button class="primary-button" type="button" (click)="saveBeautyProfile()" [disabled]="profileSaving()">
                {{ profileSaving() ? 'Saving...' : 'Save profile' }}
              </button>
            </div>
            <div class="state success" *ngIf="profileMessage()">{{ profileMessage() }}</div>
            <div class="form-grid beauty-profile-grid">
              <label class="field full">
                <span>Allergies / sensitivity</span>
                <input [(ngModel)]="beautyProfile.allergiesText" placeholder="Hair color, bleach, wax, fragrance, product ingredient" />
              </label>
              <label class="field">
                <span>Allergy risk</span>
                <select [(ngModel)]="beautyProfile.allergySeverity">
                  <option value="">Not checked</option>
                  <option value="clear">Clear</option>
                  <option value="mild">Mild sensitivity</option>
                  <option value="high">High risk</option>
                  <option value="medical">Medical caution</option>
                </select>
              </label>
              <label class="field">
                <span>Patch test date</span>
                <input type="date" [(ngModel)]="beautyProfile.patchTestDate" />
              </label>
              <label class="field">
                <span>Patch test result</span>
                <select [(ngModel)]="beautyProfile.patchTestResult">
                  <option value="">Not tested</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="retest_required">Retest required</option>
                </select>
              </label>
              <label class="field">
                <span>Skin type</span>
                <select [(ngModel)]="beautyProfile.skinType">
                  <option value="">Select skin type</option>
                  <option>Normal</option>
                  <option>Dry</option>
                  <option>Oily</option>
                  <option>Combination</option>
                  <option>Sensitive</option>
                  <option>Acne-prone</option>
                  <option>Pigmented</option>
                  <option>Mature</option>
                </select>
              </label>
              <label class="field">
                <span>Skin concerns</span>
                <input [(ngModel)]="beautyProfile.skinConcerns" placeholder="Acne, pigmentation, tan, dryness, sensitivity" />
              </label>
              <label class="field">
                <span>Hair type</span>
                <select [(ngModel)]="beautyProfile.hairType">
                  <option value="">Select hair type</option>
                  <option>Straight</option>
                  <option>Wavy</option>
                  <option>Curly</option>
                  <option>Coily</option>
                  <option>Fine</option>
                  <option>Thick</option>
                  <option>Chemically treated</option>
                  <option>Color treated</option>
                </select>
              </label>
              <label class="field">
                <span>Scalp condition</span>
                <select [(ngModel)]="beautyProfile.scalpCondition">
                  <option value="">Select scalp condition</option>
                  <option>Normal</option>
                  <option>Dry</option>
                  <option>Oily</option>
                  <option>Dandruff</option>
                  <option>Sensitive</option>
                  <option>Hair fall concern</option>
                </select>
              </label>
              <label class="field full">
                <span>Chemical / color history</span>
                <input [(ngModel)]="beautyProfile.chemicalHistory" placeholder="Last color, keratin, smoothening, bleach, formula notes" />
              </label>
              <label class="field">
                <span>Nail shade preference</span>
                <input [(ngModel)]="beautyProfile.nailShadePreference" placeholder="Nude, french, red, chrome, shade code" />
              </label>
              <label class="field">
                <span>Nail shape preference</span>
                <select [(ngModel)]="beautyProfile.nailShapePreference">
                  <option value="">Select nail shape</option>
                  <option>Round</option>
                  <option>Square</option>
                  <option>Squoval</option>
                  <option>Almond</option>
                  <option>Coffin</option>
                  <option>Stiletto</option>
                </select>
              </label>
              <label class="field">
                <span>Preferred stylist</span>
                <select [(ngModel)]="beautyProfile.preferredStylistId">
                  <option value="">Auto from history</option>
                  <option *ngFor="let person of staff()" [value]="person.id">{{ person.name }} · {{ person.role || 'staff' }}</option>
                </select>
              </label>
              <label class="field">
                <span>Appointment preference</span>
                <input [(ngModel)]="beautyProfile.appointmentPreference" placeholder="Morning, evening, quiet room, female staff" />
              </label>
              <label class="field full">
                <span>Products used in salon</span>
                <textarea [(ngModel)]="beautyProfile.productsUsed" placeholder="Color formula, shampoo, conditioner, facial kit, nail shade, retail products"></textarea>
              </label>
              <label class="field">
                <span>Products to avoid</span>
                <input [(ngModel)]="beautyProfile.productsToAvoid" placeholder="Ammonia, strong fragrance, bleach, wax brand" />
              </label>
              <label class="field">
                <span>Brand preference</span>
                <input [(ngModel)]="beautyProfile.brandPreference" placeholder="L'Oreal, Schwarzkopf, Morfose, Dermalogica" />
              </label>
              <label class="field">
                <span>Preferred channel</span>
                <select [(ngModel)]="beautyProfile.preferredChannel">
                  <option value="">Default</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="call">Call</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="dnd">DND / only essential</option>
                </select>
              </label>
              <label class="field">
                <span>Preferred language</span>
                <select [(ngModel)]="beautyProfile.preferredLanguage">
                  <option value="">Default</option>
                  <option value="en-IN">English</option>
                  <option value="hi-IN">Hindi</option>
                  <option value="ur-IN">Urdu/Hindi</option>
                  <option value="te-IN">Telugu</option>
                </select>
              </label>
              <label class="field full">
                <span>Comfort notes</span>
                <textarea [(ngModel)]="beautyProfile.comfortNotes" placeholder="Tea/coffee, water temperature, massage pressure, privacy, music, room preference"></textarea>
              </label>
              <label class="field full">
                <span>Front desk / consultation notes</span>
                <textarea [(ngModel)]="beautyProfile.preferredServiceNotes" placeholder="How to greet, what to ask before service, upsell do/don't, consultation rules"></textarea>
              </label>
              <label class="field full">
                <span>Lifestyle context</span>
                <textarea [(ngModel)]="beautyProfile.lifestyleNotes" placeholder="Bride, corporate, travel, gym/swim, sun exposure, maintenance level"></textarea>
              </label>
            </div>
          </section>

          <section class="panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">What to capture next</span>
                <h2>Profile completeness</h2>
              </div>
            </div>
            <div class="activity-list compact-history">
              <article *ngFor="let item of clientCaptureSuggestions()">
                <strong>{{ item.title }}</strong>
                <span>{{ item.reason }}</span>
              </article>
            </div>
            <div class="info-grid pos-linked-facts">
              <div><span>Allergy safety</span><strong>{{ profileSummary(client, 'allergies') }}</strong></div>
              <div><span>Patch test</span><strong>{{ profileSummary(client, 'patchTest') }}</strong></div>
              <div><span>Product memory</span><strong>{{ profileSummary(client, 'productsUsed') }}</strong></div>
              <div><span>Communication</span><strong>{{ profileSummary(client, 'preferredChannel') }}</strong></div>
            </div>
          </section>
        </div>

        <div class="dashboard-grid client-ledger-layout">
          <section class="panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">POS billing sync</span>
                <h2>Invoices, payments and due</h2>
              </div>
            </div>
            <div class="client-mini-table" *ngIf="clientInvoices().length; else noInvoices">
              <div class="client-mini-row header">
                <span>Invoice</span>
                <span>Date</span>
                <span>Total</span>
                <span>Paid</span>
                <span>Due</span>
              </div>
              <div class="client-mini-row" *ngFor="let invoice of clientInvoices().slice(0, 6)">
                <button class="table-link invoice-link-button" type="button" (click)="openInvoice(invoice)">
                  <strong>{{ invoice.invoiceNumber || invoice.invoice_no || invoice.id }}</strong>
                </button>
                <span>{{ dateLabel(invoice.createdAt || invoice.created_at || invoice.date) }}</span>
                <span>{{ invoiceTotal(invoice) | currency: 'INR':'symbol':'1.0-0' }}</span>
                <span>{{ invoicePaid(invoice) | currency: 'INR':'symbol':'1.0-0' }}</span>
                <span [class.danger-text]="invoiceBalance(invoice) > 0">{{ invoiceBalance(invoice) | currency: 'INR':'symbol':'1.0-0' }}</span>
              </div>
            </div>
            <ng-template #noInvoices>
              <div class="empty-state">
                <strong>No invoices yet</strong>
                <span>Invoices saved from POS will appear here automatically.</span>
              </div>
            </ng-template>
          </section>

          <section class="panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">POS billing sync</span>
                <h2>Stored value history</h2>
              </div>
            </div>
            <div class="activity-list compact-history">
              <article *ngFor="let item of clientWalletTransactions().slice(0, 4)">
                <strong>{{ item.type || item.reason || 'Wallet entry' }}</strong>
                <span>{{ moneyValue(item.amount) | currency: 'INR':'symbol':'1.0-0' }} · Balance {{ walletEntryBalance(item) | currency: 'INR':'symbol':'1.0-0' }}</span>
              </article>
              <article *ngFor="let tip of clientTips().slice(0, 3)">
                <strong>Tip to {{ tip.staffName || staffName(tip.staffId) }}</strong>
                <span>{{ moneyValue(tip.amount) | currency: 'INR':'symbol':'1.0-0' }} via {{ tip.paymentMode || 'mode' }}</span>
              </article>
              <article *ngIf="!clientWalletTransactions().length && !clientTips().length">
                <strong>No wallet or tip activity</strong>
                <span>Wallet credits, redemptions and staff tips will be tracked live.</span>
              </article>
            </div>
          </section>
        </div>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Family account</span>
              <h2>Linked members and communication rules</h2>
            </div>
            <button class="ghost-button" type="button" (click)="loadFamily(client.id)">Refresh family</button>
          </div>
          <div class="form-grid compact-family">
            <label class="field">
              <span>Add existing client</span>
              <select [(ngModel)]="familyMemberId">
                <option value="">Select member</option>
                <option *ngFor="let item of clients()" [value]="item.id" [disabled]="item.id === client.id">{{ item.name }} · {{ item.phone }}</option>
              </select>
            </label>
            <label class="field">
              <span>Relationship</span>
              <select [(ngModel)]="familyRelationship">
                <option value="child">Child</option>
                <option value="spouse">Spouse</option>
                <option value="parent">Parent</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label class="field check-line">
              <input type="checkbox" [(ngModel)]="familyConsolidate" />
              <span>Consolidate WhatsApp/SMS to primary account</span>
            </label>
            <div class="form-actions">
              <button class="primary-button" type="button" (click)="linkFamilyMember(client.id)" [disabled]="!familyMemberId">Link member</button>
            </div>
          </div>
          <div class="activity-list compact-family-list" *ngIf="family() as tree">
            <article>
              <strong>Primary: {{ tree.primary?.name }}</strong>
              <span>{{ tree.primary?.phone }} · {{ tree.totalMembers || 0 }} linked member(s)</span>
            </article>
            <article *ngFor="let member of (tree.members || [])">
              <strong>{{ member.name }} · {{ member.relationship || 'member' }}</strong>
              <span>{{ member.phone }} · WhatsApp {{ member.consolidateCommunications ? 'consolidated' : 'direct' }}</span>
              <button class="ghost-button mini" type="button" (click)="unlinkFamilyMember(client.id, member.id)">Unlink</button>
            </article>
          </div>
        </section>

        <div class="dashboard-grid">
          <section class="panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">Client notes</span>
                <h2>Front desk context</h2>
              </div>
              <button class="primary-button" type="button" (click)="saveNotes()">Save notes</button>
            </div>
            <textarea class="notes-box" [(ngModel)]="notes"></textarea>
            <div class="info-grid pos-linked-facts">
              <div><span>Last POS invoice</span><strong>{{ latestInvoiceLabel() }}</strong></div>
              <div><span>Open invoices</span><strong>{{ dueInvoices().length }}</strong></div>
              <div><span>Paid through POS</span><strong>{{ totalPaid() | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
              <div><span>Staff tips</span><strong>{{ totalTips() | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            </div>
          </section>

          <section class="panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">Consent forms</span>
                <h2>Forms and safety</h2>
              </div>
            </div>
            <div class="alert-list">
              <article *ngFor="let form of client.consentForms">
                <strong>{{ form.name }}</strong>
                <span>Signed {{ form.signedAt }}</span>
              </article>
              <article *ngIf="!client.consentForms?.length">
                <strong>No forms signed</strong>
                <span>Add consent forms before chemical services.</span>
              </article>
            </div>
          </section>
        </div>

        <div class="three-grid">
          <section class="panel">
            <div class="section-title"><h2>Visit history</h2></div>
            <div class="activity-list">
              <article *ngFor="let visit of liveVisitHistory(client).slice(0, 8)">
                <strong>{{ visit.date }}</strong>
                <span>{{ visit.services || visit.saleId }}</span>
              </article>
              <article *ngIf="!liveVisitHistory(client).length">
                <strong>No visits yet</strong>
                <span>Completed appointments and POS sales will create visits here.</span>
              </article>
            </div>
          </section>

          <section class="panel">
            <div class="section-title"><h2>Purchase history</h2></div>
            <div class="activity-list">
              <article *ngFor="let purchase of livePurchaseHistory(client).slice(0, 8)">
                <strong>{{ purchase.invoice }}</strong>
                <span>{{ purchase.amount | currency: 'INR':'symbol':'1.0-0' }}</span>
              </article>
              <article *ngIf="!livePurchaseHistory(client).length">
                <strong>No purchases yet</strong>
                <span>Saved invoices will update this section.</span>
              </article>
            </div>
          </section>

          <section class="panel">
            <div class="section-title"><h2>WhatsApp follow-ups</h2></div>
            <div class="activity-list">
              <article *ngFor="let item of client.whatsappHistory">
                <strong>{{ item.status }}</strong>
                <span>{{ item.message }} · {{ item.date }}</span>
              </article>
            </div>
          </section>
        </div>
      </ng-container>
    </section>
  `
})
export class ClientDetailComponent implements OnInit {
  readonly client = signal<ApiRecord | null>(null);
  readonly clients = signal<ApiRecord[]>([]);
  readonly family = signal<ApiRecord | null>(null);
  readonly invoices = signal<ApiRecord[]>([]);
  readonly sales = signal<ApiRecord[]>([]);
  readonly payments = signal<ApiRecord[]>([]);
  readonly appointments = signal<ApiRecord[]>([]);
  readonly walletTransactions = signal<ApiRecord[]>([]);
  readonly staff = signal<ApiRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly profileSaving = signal(false);
  readonly profileMessage = signal('');
  notes = '';
  beautyProfile: ClientBeautyProfileForm = this.emptyBeautyProfile();
  familyMemberId = '';
  familyRelationship = 'child';
  familyConsolidate = true;

  constructor(
    private readonly api: ApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.error.set('');
    forkJoin({
      client: this.api.get<ApiRecord>('clients', id),
      clients: this.safeList('clients', { limit: 1000 }),
      invoices: this.safeList('invoices', { limit: 1000 }),
      sales: this.safeList('sales', { limit: 1000 }),
      payments: this.safeList('payments', { limit: 1000 }),
      appointments: this.safeList('appointments', { limit: 1000 }),
      walletTransactions: this.safeList('walletTransactions', { limit: 1000 }),
      staff: this.safeList('staff', { limit: 1000 })
    }).subscribe({
      next: ({ client, clients, invoices, sales, payments, appointments, walletTransactions, staff }) => {
        this.client.set(client);
        this.clients.set(clients || []);
        this.invoices.set(invoices || []);
        this.sales.set(sales || []);
        this.payments.set(payments || []);
        this.appointments.set(appointments || []);
        this.walletTransactions.set(walletTransactions || []);
        this.staff.set(staff || []);
        this.notes = client.notes || '';
        this.beautyProfile = this.profileFormFromClient(client);
        this.profileMessage.set('');
        this.loadFamily(client.id);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load client profile');
        this.loading.set(false);
      }
    });
  }

  private safeList(resource: string, params: ApiRecord = {}) {
    return this.api.list<ApiRecord[]>(resource, params).pipe(catchError(() => of([] as ApiRecord[])));
  }

  saveNotes(): void {
    const client = this.client();
    if (!client) return;
    this.api.update<ApiRecord>('clients', client.id, { notes: this.notes }).subscribe({
      next: (updated) => this.client.set(updated),
      error: (error) => this.error.set(error?.error?.error || 'Unable to save notes')
    });
  }

  saveBeautyProfile(): void {
    const client = this.client();
    if (!client) return;
    const existingPreferences = this.readJson(client.preferences);
    const existingSafetyFlags = this.readJson(client.safetyFlags);
    const existingCommunication = this.readJson(client.communicationPreferences);
    const profile = this.beautyProfile;
    const preferences = {
      ...existingPreferences,
      skinType: profile.skinType,
      skinConcerns: profile.skinConcerns,
      hairType: profile.hairType,
      scalpCondition: profile.scalpCondition,
      chemicalHistory: profile.chemicalHistory,
      nailShadePreference: profile.nailShadePreference,
      nailShapePreference: profile.nailShapePreference,
      preferredStylistId: profile.preferredStylistId,
      preferredServiceNotes: profile.preferredServiceNotes,
      productsUsed: profile.productsUsed,
      productsToAvoid: profile.productsToAvoid,
      brandPreference: profile.brandPreference,
      appointmentPreference: profile.appointmentPreference,
      comfortNotes: profile.comfortNotes,
      lifestyleNotes: profile.lifestyleNotes,
      lastProfileReviewAt: new Date().toISOString()
    };
    const safetyFlags = {
      ...existingSafetyFlags,
      allergySeverity: profile.allergySeverity,
      patchTestDate: profile.patchTestDate,
      patchTestResult: profile.patchTestResult,
      productsToAvoid: profile.productsToAvoid
    };
    const communicationPreferences = {
      ...existingCommunication,
      preferredChannel: profile.preferredChannel,
      preferredLanguage: profile.preferredLanguage,
      appointmentPreference: profile.appointmentPreference
    };

    this.profileSaving.set(true);
    this.error.set('');
    this.profileMessage.set('');
    this.api.update<ApiRecord>('clients', client.id, {
      allergies: this.toList(profile.allergiesText),
      preferences,
      safetyFlags,
      communicationPreferences
    }).subscribe({
      next: (updated) => {
        this.client.set(updated);
        this.beautyProfile = this.profileFormFromClient(updated);
        this.profileSaving.set(false);
        this.error.set('');
        this.profileMessage.set('Client beauty profile saved. POS, booking and AI recommendations can now use these details.');
      },
      error: (error) => {
        this.profileSaving.set(false);
        this.error.set(this.api.errorText(error, 'Unable to save client beauty profile'));
      }
    });
  }

  loadClients(): void {
    this.api.list<ApiRecord[]>('clients', { limit: 1000 }).subscribe({
      next: (clients) => this.clients.set(clients || []),
      error: () => undefined
    });
  }

  loadFamily(clientId: string): void {
    this.api.list<ApiRecord>(`clients/${clientId}/family-members`).subscribe({
      next: (family) => this.family.set(family),
      error: () => this.family.set(null)
    });
  }

  linkFamilyMember(clientId: string): void {
    if (!this.familyMemberId) return;
    this.api.post<ApiRecord>(`clients/${clientId}/link-member`, {
      memberCustomerId: this.familyMemberId,
      relationship: this.familyRelationship,
      consolidateCommunications: this.familyConsolidate ? 1 : 0
    }).subscribe({
      next: () => {
        this.familyMemberId = '';
        this.loadFamily(clientId);
      },
      error: (error) => this.error.set(error?.error?.error || 'Unable to link family member')
    });
  }

  unlinkFamilyMember(clientId: string, memberId: string): void {
    this.api.delete<ApiRecord>(`clients/${clientId}/link-member`, memberId).subscribe({
      next: () => this.loadFamily(clientId),
      error: (error) => this.error.set(error?.error?.error || 'Unable to unlink family member')
    });
  }

  initials(name: string): string {
    return String(name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }

  clientTags(client: ApiRecord): string[] {
    if (Array.isArray(client.tags)) return client.tags.filter(Boolean);
    if (typeof client.tags === 'string') {
      return client.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    }
    return [];
  }

  profileSummary(client: ApiRecord, key: string): string {
    const preferences = this.readJson(client.preferences);
    const safetyFlags = this.readJson(client.safetyFlags);
    const communication = this.readJson(client.communicationPreferences);
    if (key === 'allergies') {
      const allergies = this.readList(client.allergies);
      return allergies.length ? allergies.slice(0, 3).join(', ') : 'None captured';
    }
    if (key === 'patchTest') {
      const result = String(safetyFlags.patchTestResult || '').replace(/_/g, ' ');
      const date = safetyFlags.patchTestDate ? this.dateLabel(safetyFlags.patchTestDate) : '';
      return result || date ? [result || 'Recorded', date].filter(Boolean).join(' · ') : 'Not tested';
    }
    if (key === 'preferredChannel') {
      return this.titleText(communication.preferredChannel || 'Default');
    }
    const value = preferences[key];
    return value ? this.shortValue(value) : 'Not set';
  }

  preferredStylistName(client: ApiRecord): string {
    const preferredStylistId = String(this.readJson(client.preferences).preferredStylistId || '');
    if (preferredStylistId) return this.staffName(preferredStylistId);
    return this.preferredStaffLabel();
  }

  clientCaptureSuggestions(): Array<{ title: string; reason: string }> {
    const client = this.client();
    if (!client) return [];
    const preferences = this.readJson(client.preferences);
    const safetyFlags = this.readJson(client.safetyFlags);
    const communication = this.readJson(client.communicationPreferences);
    const suggestions = [
      {
        done: this.readList(client.allergies).length > 0,
        title: 'Capture allergies before chemical services',
        reason: 'Hair color, bleach, wax, peel and facial services need allergy safety context.'
      },
      {
        done: !!preferences.skinType,
        title: 'Add skin type and concerns',
        reason: 'Facial recommendations, retail upsell and consent warnings become more accurate.'
      },
      {
        done: !!preferences.hairType && !!preferences.chemicalHistory,
        title: 'Record hair type and chemical history',
        reason: 'Staff can avoid repeat consultation and choose safer color/keratin formulas.'
      },
      {
        done: !!preferences.productsUsed,
        title: 'Save product and formula memory',
        reason: 'Next visit can repeat exact shade, shampoo, facial kit or nail color faster.'
      },
      {
        done: !!preferences.preferredStylistId,
        title: 'Set preferred stylist',
        reason: 'Booking and POS can guide assignment to the right staff member.'
      },
      {
        done: !!safetyFlags.patchTestDate || safetyFlags.patchTestResult === 'passed',
        title: 'Update patch test status',
        reason: 'Front desk can check safety before color, bleach and other sensitive services.'
      },
      {
        done: !!communication.preferredChannel,
        title: 'Choose communication channel',
        reason: 'WhatsApp, call, SMS, language and DND preferences reduce friction.'
      }
    ];
    const open = suggestions.filter((item) => !item.done);
    return (open.length ? open : suggestions).slice(0, 5);
  }

  loyaltyPoints(client: ApiRecord): number {
    return this.moneyValue(client.loyaltyPoints || client.loyalty || 0);
  }

  walletBalance(client: ApiRecord): number {
    const entries = this.clientWalletTransactions();
    const latest = entries[0];
    const live = latest ? this.walletEntryBalance(latest) : undefined;
    return this.moneyValue(live ?? client.walletBalance ?? client.wallet ?? 0);
  }

  clientSales(): ApiRecord[] {
    const id = this.client()?.id;
    if (!id) return [];
    return this.sales().filter((sale) => String(sale.clientId || sale.customerId || '') === String(id));
  }

  clientInvoices(): ApiRecord[] {
    const id = this.client()?.id;
    if (!id) return [];
    const saleIds = new Set(this.clientSales().map((sale) => String(sale.id)));
    return this.invoices()
      .filter((invoice) => String(invoice.clientId || invoice.customerId || '') === String(id) || saleIds.has(String(invoice.saleId || '')))
      .sort((a, b) => this.dateMs(b.createdAt || b.date) - this.dateMs(a.createdAt || a.date));
  }

  clientPayments(): ApiRecord[] {
    const invoiceIds = new Set(this.clientInvoices().map((invoice) => String(invoice.id)));
    return this.payments().filter((payment) => invoiceIds.has(String(payment.invoiceId || '')));
  }

  openInvoice(invoice: ApiRecord): void {
    const invoiceId = String(invoice.id || '').trim();
    if (!invoiceId) return;
    this.router.navigate(['/pos/invoices'], { queryParams: { invoice: invoiceId } });
  }

  clientWalletTransactions(): ApiRecord[] {
    const id = this.client()?.id;
    if (!id) return [];
    return this.walletTransactions()
      .filter((item) => String(item.clientId || item.customerId || '') === String(id))
      .sort((a, b) => this.dateMs(b.createdAt || b.date) - this.dateMs(a.createdAt || a.date));
  }

  clientAppointments(): ApiRecord[] {
    const id = this.client()?.id;
    if (!id) return [];
    return this.appointments()
      .filter((appointment) => String(appointment.clientId || appointment.customerId || '') === String(id))
      .sort((a, b) => this.dateMs(b.startTime || b.date || b.createdAt) - this.dateMs(a.startTime || a.date || a.createdAt));
  }

  clientTips(): ApiRecord[] {
    return this.clientSales().flatMap((sale) => {
      const redeem = this.readJson(sale.membershipRedeem);
      const tips = Array.isArray(redeem?.tips) ? redeem.tips : [];
      return tips.map((tip: ApiRecord) => ({ ...tip, saleId: sale.id }));
    });
  }

  dueInvoices(): ApiRecord[] {
    return this.clientInvoices().filter((invoice) => this.invoiceBalance(invoice) > 0);
  }

  totalBilled(): number {
    return this.clientInvoices().reduce((sum, invoice) => sum + this.invoiceTotal(invoice), 0);
  }

  totalPaid(): number {
    return this.clientInvoices().reduce((sum, invoice) => sum + this.invoicePaid(invoice), 0);
  }

  totalTips(): number {
    return this.clientTips().reduce((sum, tip) => sum + this.moneyValue(tip.amount), 0);
  }

  totalDue(): number {
    return this.clientInvoices().reduce((sum, invoice) => sum + this.invoiceBalance(invoice), 0);
  }

  latestInvoiceLabel(): string {
    const invoice = this.clientInvoices()[0];
    if (!invoice) return 'No POS invoice';
    return String(invoice.invoiceNumber || invoice.id || 'POS invoice');
  }

  averageBill(): number {
    const invoices = this.clientInvoices();
    if (!invoices.length) return 0;
    return this.totalBilled() / invoices.length;
  }

  invoiceTotal(invoice: ApiRecord): number {
    return this.moneyValue(invoice.total ?? invoice.grandTotal ?? invoice.grand_total ?? invoice.amount ?? 0);
  }

  invoicePaid(invoice: ApiRecord): number {
    const direct = invoice.paid ?? invoice.paidAmount ?? invoice.paid_amount ?? invoice.collected;
    if (direct !== undefined && direct !== null) return this.moneyValue(direct);
    return this.payments()
      .filter((payment) => String(payment.invoiceId || '') === String(invoice.id))
      .reduce((sum, payment) => sum + this.moneyValue(payment.amount), 0);
  }

  invoiceBalance(invoice: ApiRecord): number {
    const direct = invoice.balance ?? invoice.due ?? invoice.due_amount ?? invoice.balanceDue;
    if (direct !== undefined && direct !== null) return Math.max(0, this.moneyValue(direct));
    return Math.max(0, this.invoiceTotal(invoice) - this.invoicePaid(invoice));
  }

  clientHealthScore(): number {
    let score = 100;
    if (this.totalDue() > 0) score -= 25;
    if (this.daysSinceLastVisit() > 60) score -= 20;
    if (this.clientTags(this.client() || {}).some((tag) => tag.toLowerCase().includes('dnd'))) score -= 10;
    if (!this.readList(this.client()?.allergies).length) score -= 5;
    if (!this.readJson(this.client()?.preferences).skinType && !this.readJson(this.client()?.preferences).hairType) score -= 5;
    if (!this.clientAppointments().length && !this.clientInvoices().length) score -= 10;
    return Math.max(0, Math.min(100, score));
  }

  clientRiskLevel(): string {
    if (this.totalDue() > 0) return 'Payment follow-up';
    if (this.daysSinceLastVisit() > 60) return 'Reactivation';
    if (this.clientTags(this.client() || {}).some((tag) => tag.toLowerCase().includes('dnd'))) return 'DND careful';
    return 'Healthy';
  }

  nextBestAction(): string {
    if (this.totalDue() > 0) return 'Collect or settle pending balance';
    if (!this.readList(this.client()?.allergies).length) return 'Capture allergy and patch-test safety';
    if (!this.readJson(this.client()?.preferences).skinType && !this.readJson(this.client()?.preferences).hairType) return 'Complete beauty profile';
    if (this.walletBalance(this.client() || {}) > 0) return 'Offer wallet redemption on next invoice';
    if (this.daysSinceLastVisit() > 60) return 'Send reactivation follow-up';
    if (!this.client()?.membershipId) return 'Offer membership during checkout';
    return 'Book the next appointment';
  }

  nextBestReason(): string {
    if (this.totalDue() > 0) return 'Client has unpaid invoice balance, so front desk should resolve dues before new credit.';
    if (!this.readList(this.client()?.allergies).length) return 'Allergy and patch-test details reduce risk before color, wax, bleach, peel and facial services.';
    if (!this.readJson(this.client()?.preferences).skinType && !this.readJson(this.client()?.preferences).hairType) return 'Skin, hair and product preferences help staff prepare before the service starts.';
    if (this.walletBalance(this.client() || {}) > 0) return 'Client has wallet credit available and can redeem it in POS.';
    if (this.daysSinceLastVisit() > 60) return 'Client has not visited recently based on saved invoice and appointment dates.';
    if (!this.client()?.membershipId) return 'Client does not have an active membership recorded on profile.';
    return 'Client is active, so the safest growth action is a confirmed next visit.';
  }

  preferredStaffLabel(): string {
    const preferredStylistId = String(this.readJson(this.client()?.preferences).preferredStylistId || '');
    if (preferredStylistId) return this.staffName(preferredStylistId);
    const counts = new Map<string, number>();
    for (const sale of this.clientSales()) {
      const staffId = String(sale.staffId || '');
      if (!staffId) continue;
      counts.set(staffId, (counts.get(staffId) || 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return best ? this.staffName(best[0]) : 'Not enough history';
  }

  topServiceLabel(): string {
    const counts = new Map<string, number>();
    for (const sale of this.clientSales()) {
      for (const item of this.saleItems(sale)) {
        const name = String(item.name || item.serviceName || item.productName || item.type || '').trim();
        if (!name) continue;
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Not enough history';
  }

  firstVisitLabel(client: ApiRecord): string {
    const dates = [
      client.firstVisit,
      client.firstVisitDate,
      ...this.clientInvoices().map((invoice) => invoice.createdAt || invoice.date),
      ...this.clientAppointments().map((appointment) => appointment.startTime || appointment.date || appointment.createdAt)
    ].filter(Boolean);
    const oldest = dates.sort((a, b) => this.dateMs(a) - this.dateMs(b))[0];
    return oldest ? this.dateLabel(oldest) : '-';
  }

  lastVisitLabel(): string {
    const dates = [
      ...this.clientInvoices().map((invoice) => invoice.createdAt || invoice.date),
      ...this.clientAppointments().map((appointment) => appointment.startTime || appointment.date || appointment.createdAt)
    ].filter(Boolean);
    const latest = dates.sort((a, b) => this.dateMs(b) - this.dateMs(a))[0];
    return latest ? this.dateLabel(latest) : 'New';
  }

  visitFrequencyLabel(): string {
    const count = Math.max(this.clientAppointments().length, this.clientInvoices().length);
    if (!count) return 'No visit rhythm yet';
    if (count === 1) return 'One recorded visit';
    return `${count} recorded touchpoints`;
  }

  liveVisitHistory(client: ApiRecord): ApiRecord[] {
    const invoiceVisits = this.clientInvoices().map((invoice) => ({
      date: this.dateLabel(invoice.createdAt || invoice.date),
      saleId: invoice.invoiceNumber || invoice.id,
      services: this.saleSummary(invoice.saleId)
    }));
    return [...invoiceVisits, ...(client.visitHistory || [])];
  }

  livePurchaseHistory(client: ApiRecord): ApiRecord[] {
    const purchases = this.clientInvoices().map((invoice) => ({
      invoice: invoice.invoiceNumber || invoice.id,
      amount: this.invoiceTotal(invoice)
    }));
    return [...purchases, ...(client.purchaseHistory || [])];
  }

  staffName(id: string): string {
    return this.staff().find((staff) => String(staff.id) === String(id))?.name || 'Unassigned';
  }

  walletEntryBalance(item: ApiRecord): number {
    return this.moneyValue(item.balanceAfter ?? item.balance ?? item.walletBalance ?? item.amount ?? 0);
  }

  moneyValue(value: unknown): number {
    const parsed = Number(String(value ?? 0).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  dateLabel(value: unknown): string {
    if (!value) return '-';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private daysSinceLastVisit(): number {
    const dates = [
      ...this.clientInvoices().map((invoice) => invoice.createdAt || invoice.date),
      ...this.clientAppointments().map((appointment) => appointment.startTime || appointment.date || appointment.createdAt)
    ].filter(Boolean);
    const latest = dates.sort((a, b) => this.dateMs(b) - this.dateMs(a))[0];
    if (!latest) return 999;
    return Math.floor((Date.now() - this.dateMs(latest)) / 86400000);
  }

  private dateMs(value: unknown): number {
    const time = new Date(String(value || '')).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  private readJson(value: unknown): ApiRecord {
    if (!value) return {};
    if (typeof value === 'object') return value as ApiRecord;
    try {
      return JSON.parse(String(value));
    } catch {
      return {};
    }
  }

  private readList(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      } catch {
        // Plain comma/newline text is also accepted.
      }
      return this.toList(value);
    }
    return [];
  }

  private toList(value: unknown): string[] {
    return String(value || '')
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private emptyBeautyProfile(): ClientBeautyProfileForm {
    return {
      allergiesText: '',
      allergySeverity: '',
      skinType: '',
      skinConcerns: '',
      hairType: '',
      scalpCondition: '',
      chemicalHistory: '',
      nailShadePreference: '',
      nailShapePreference: '',
      preferredStylistId: '',
      preferredServiceNotes: '',
      productsUsed: '',
      productsToAvoid: '',
      brandPreference: '',
      patchTestDate: '',
      patchTestResult: '',
      appointmentPreference: '',
      preferredChannel: '',
      preferredLanguage: '',
      comfortNotes: '',
      lifestyleNotes: ''
    };
  }

  private profileFormFromClient(client: ApiRecord): ClientBeautyProfileForm {
    const preferences = this.readJson(client.preferences);
    const safetyFlags = this.readJson(client.safetyFlags);
    const communication = this.readJson(client.communicationPreferences);
    return {
      allergiesText: this.readList(client.allergies).join(', '),
      allergySeverity: String(safetyFlags.allergySeverity || ''),
      skinType: String(preferences.skinType || ''),
      skinConcerns: String(preferences.skinConcerns || ''),
      hairType: String(preferences.hairType || ''),
      scalpCondition: String(preferences.scalpCondition || ''),
      chemicalHistory: String(preferences.chemicalHistory || ''),
      nailShadePreference: String(preferences.nailShadePreference || ''),
      nailShapePreference: String(preferences.nailShapePreference || ''),
      preferredStylistId: String(preferences.preferredStylistId || ''),
      preferredServiceNotes: String(preferences.preferredServiceNotes || ''),
      productsUsed: String(preferences.productsUsed || ''),
      productsToAvoid: String(preferences.productsToAvoid || safetyFlags.productsToAvoid || ''),
      brandPreference: String(preferences.brandPreference || ''),
      patchTestDate: String(safetyFlags.patchTestDate || ''),
      patchTestResult: String(safetyFlags.patchTestResult || ''),
      appointmentPreference: String(preferences.appointmentPreference || communication.appointmentPreference || ''),
      preferredChannel: String(communication.preferredChannel || ''),
      preferredLanguage: String(communication.preferredLanguage || ''),
      comfortNotes: String(preferences.comfortNotes || ''),
      lifestyleNotes: String(preferences.lifestyleNotes || '')
    };
  }

  private shortValue(value: unknown): string {
    const text = String(value || '').trim();
    return text.length > 36 ? `${text.slice(0, 34)}...` : text;
  }

  private titleText(value: unknown): string {
    return String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private saleItems(sale: ApiRecord): ApiRecord[] {
    const items = sale.items;
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private saleSummary(saleId: string): string {
    const sale = this.sales().find((item) => String(item.id) === String(saleId));
    if (!sale) return 'POS sale';
    const names = this.saleItems(sale).map((item) => item.name || item.serviceName || item.productName).filter(Boolean);
    return names.length ? names.slice(0, 3).join(', ') : 'POS sale';
  }
}
