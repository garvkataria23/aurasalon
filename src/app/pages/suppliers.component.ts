import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

type SupplierFilter =
  | 'all'
  | 'active'
  | 'risk'
  | 'pending-po'
  | 'missing-gstin'
  | 'missing-contact'
  | 'no-purchase'
  | 'blocked'
  | 'price-rise'
  | 'cheaper-available';

interface SupplierCommandRow {
  supplier: ApiRecord;
  status: string;
  score: number;
  purchaseValue: number;
  openPoCount: number;
  openPoValue: number;
  qualityRisk: number;
  expiringBatchCount: number;
  suppliedProducts: number;
  lastPurchaseAt: string;
  topProductName: string;
  missingContact: boolean;
  missingGstin: boolean;
  draftItems: string;
  statusReason: string;
  statusHistoryCount: number;
  complianceIssues: string[];
  priceChangePct: number;
  cheaperAlternative: string;
  cheaperSavingPct: number;
  trendBars: number[];
  suggestedPurchase: ApiRecord | null;
}

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, FormsModule, ReactiveFormsModule, RouterLink, StateComponent],
  template: `
    <section class="page-stack suppliers-page">
      <div class="module-hero compact-hero">
        <div>
          <span class="eyebrow">Inventory / Supplier command</span>
          <h2>Supplier intelligence and vendor GST control</h2>
          <p>Track supplier score, open PO value, purchase spend, quality risk and compliance readiness from live inventory data.</p>
        </div>
        <div class="hero-actions">
          <a class="ghost-button" routerLink="/inventory">Back to inventory</a>
          <a class="ghost-button" routerLink="/inventory/purchase-orders">Purchase orders</a>
          <button class="primary-button" type="button" (click)="showForm.set(true)">Add supplier</button>
        </div>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="metrics-grid supplier-kpis">
        <article class="metric-card teal">
          <span>Total suppliers</span>
          <strong>{{ suppliers().length }}</strong>
          <small>{{ activeSuppliers().length }} active vendors</small>
        </article>
        <article class="metric-card green">
          <span>Supplier spend</span>
          <strong>{{ totalSupplierSpend() | currency: 'INR':'symbol':'1.0-0' }}</strong>
          <small>Purchase value across vendors</small>
        </article>
        <article class="metric-card blue">
          <span>Open PO value</span>
          <strong>{{ openPoValue() | currency: 'INR':'symbol':'1.0-0' }}</strong>
          <small>{{ openPoSuppliers().length }} suppliers need follow-up</small>
        </article>
        <article class="metric-card red">
          <span>Quality risk</span>
          <strong>{{ qualityRiskSuppliers().length }}</strong>
          <small>Expiry, waste or low stock linked</small>
        </article>
        <article class="metric-card amber">
          <span>WhatsApp drafts</span>
          <strong>{{ pendingWhatsappDrafts() }}</strong>
          <small>Supplier orders waiting to send</small>
        </article>
        <article class="metric-card violet">
          <span>Price rising</span>
          <strong>{{ priceRiseSuppliers().length }}</strong>
          <small>Unit cost increased over history</small>
        </article>
      </div>

      <section class="supplier-intelligence-grid">
        <article class="panel supplier-trend-panel">
          <div class="section-title"><div><span class="eyebrow">Supplier-wise spend trend</span><h2>Top vendor purchase movement</h2></div></div>
          <div class="trend-list">
            <article *ngFor="let row of topSpendRows()">
              <div>
                <strong>{{ row.supplier.name }}</strong>
                <span>{{ row.purchaseValue | currency: 'INR':'symbol':'1.0-0' }} · {{ row.openPoCount }} open PO</span>
              </div>
              <div class="trend-bars" aria-label="Spend trend">
                <span *ngFor="let bar of row.trendBars" [style.height.%]="bar || 8"></span>
              </div>
            </article>
            <div class="empty-state compact" *ngIf="!topSpendRows().length"><strong>No purchase trend yet</strong><span>Receive supplier batches to build trend.</span></div>
          </div>
        </article>

        <article class="panel supplier-alert-panel">
          <div class="section-title"><div><span class="eyebrow">Purchase intelligence</span><h2>Price rise and cheaper supplier signals</h2></div></div>
          <div class="alert-list compact">
            <article *ngFor="let row of purchaseIntelligenceRows()">
              <strong>{{ row.supplier.name }}</strong>
              <span *ngIf="row.priceChangePct > 0">Price increased {{ row.priceChangePct | number: '1.0-1' }}% on tracked items.</span>
              <span *ngIf="row.cheaperAlternative">{{ row.cheaperAlternative }} may save {{ row.cheaperSavingPct | number: '1.0-1' }}% on matched products.</span>
              <small>{{ row.topProductName }}</small>
            </article>
            <div class="empty-state compact" *ngIf="!purchaseIntelligenceRows().length"><strong>No price warning</strong><span>Supplier costs are stable in available purchase history.</span></div>
          </div>
        </article>
      </section>

      <section class="panel supplier-command-panel">
        <div class="section-title">
          <div>
            <span class="eyebrow">Smart filters</span>
            <h2>Supplier command register</h2>
          </div>
          <div class="toolbar-actions">
            <button class="ghost-button" type="button" (click)="load()">Refresh</button>
            <button class="primary-button" type="button" (click)="showForm.set(true)">Add supplier</button>
          </div>
        </div>

        <div class="supplier-filter-row">
          <label class="search-field">
            <span>Search supplier</span>
            <input [(ngModel)]="query" placeholder="Name, phone, GSTIN, contact, status" />
          </label>
          <div class="filter-chip-row" role="group" aria-label="Supplier filters">
            <button type="button" class="filter-chip" [class.active]="activeFilter() === 'all'" (click)="setFilter('all')">All <strong>{{ supplierRows().length }}</strong></button>
            <button type="button" class="filter-chip" [class.active]="activeFilter() === 'active'" (click)="setFilter('active')">Active <strong>{{ filterCount('active') }}</strong></button>
            <button type="button" class="filter-chip" [class.active]="activeFilter() === 'risk'" (click)="setFilter('risk')">Risk <strong>{{ filterCount('risk') }}</strong></button>
            <button type="button" class="filter-chip" [class.active]="activeFilter() === 'pending-po'" (click)="setFilter('pending-po')">Pending PO <strong>{{ filterCount('pending-po') }}</strong></button>
            <button type="button" class="filter-chip" [class.active]="activeFilter() === 'missing-gstin'" (click)="setFilter('missing-gstin')">GSTIN missing <strong>{{ filterCount('missing-gstin') }}</strong></button>
            <button type="button" class="filter-chip" [class.active]="activeFilter() === 'missing-contact'" (click)="setFilter('missing-contact')">Contact missing <strong>{{ filterCount('missing-contact') }}</strong></button>
            <button type="button" class="filter-chip" [class.active]="activeFilter() === 'no-purchase'" (click)="setFilter('no-purchase')">No purchase <strong>{{ filterCount('no-purchase') }}</strong></button>
            <button type="button" class="filter-chip" [class.active]="activeFilter() === 'blocked'" (click)="setFilter('blocked')">Paused/blocked <strong>{{ filterCount('blocked') }}</strong></button>
            <button type="button" class="filter-chip" [class.active]="activeFilter() === 'price-rise'" (click)="setFilter('price-rise')">Price rise <strong>{{ filterCount('price-rise') }}</strong></button>
            <button type="button" class="filter-chip" [class.active]="activeFilter() === 'cheaper-available'" (click)="setFilter('cheaper-available')">Cheaper supplier <strong>{{ filterCount('cheaper-available') }}</strong></button>
          </div>
        </div>

        <div class="state success" *ngIf="success()">{{ success() }}</div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Score</th>
                <th>Purchase spend</th>
                <th>Open PO</th>
                <th>Risk</th>
                <th>Compliance</th>
                <th>Price intel</th>
                <th>Last purchase</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of filteredSupplierRows()">
                <td>
                  <a class="supplier-link" [routerLink]="['/suppliers', row.supplier.id]">
                    <strong>{{ row.supplier.name }}</strong>
                  </a>
                  <small>{{ row.topProductName }} · {{ row.suppliedProducts }} linked products</small>
                </td>
                <td>
                  <span class="score-pill" [class.score-good]="row.score >= 85" [class.score-warn]="row.score < 85 && row.score >= 70" [class.score-danger]="row.score < 70">{{ row.score | number: '1.0-0' }}</span>
                  <small>{{ row.status }}</small>
                </td>
                <td>
                  <strong>{{ row.purchaseValue | currency: 'INR':'symbol':'1.0-0' }}</strong>
                  <small>{{ row.purchaseValue ? 'Live purchases' : 'No purchase yet' }}</small>
                </td>
                <td>
                  <strong>{{ row.openPoValue | currency: 'INR':'symbol':'1.0-0' }}</strong>
                  <small>{{ row.openPoCount }} open PO</small>
                </td>
                <td>
                  <span class="badge" [class.warn]="row.qualityRisk > 0">{{ row.qualityRisk ? row.qualityRisk + ' signals' : 'clear' }}</span>
                  <small>{{ row.expiringBatchCount }} expiring batches</small>
                </td>
                <td>
                  <div class="compliance-stack">
                    <span class="mini-status" [class.ok]="!row.missingGstin" [class.warn]="row.missingGstin">{{ row.missingGstin ? 'GSTIN missing' : 'GSTIN ready' }}</span>
                    <span class="mini-status" [class.ok]="!row.missingContact" [class.warn]="row.missingContact">{{ row.missingContact ? 'Contact missing' : 'Contact ready' }}</span>
                    <span class="mini-status warn" *ngIf="row.statusReason">{{ row.statusReason }}</span>
                    <span class="mini-status" *ngIf="row.statusHistoryCount">{{ row.statusHistoryCount }} status events</span>
                  </div>
                </td>
                <td>
                  <strong *ngIf="row.priceChangePct > 0">+{{ row.priceChangePct | number: '1.0-1' }}%</strong>
                  <strong *ngIf="row.priceChangePct <= 0">Stable</strong>
                  <small>{{ row.cheaperAlternative || 'No cheaper match' }}</small>
                </td>
                <td>{{ row.lastPurchaseAt ? (row.lastPurchaseAt | date: 'mediumDate') : 'No purchase' }}</td>
                <td class="supplier-actions">
                  <a class="ghost-button mini" [routerLink]="['/suppliers', row.supplier.id]">360</a>
                  <button class="ghost-button mini" type="button" (click)="createPoForSupplier(row)" [disabled]="saving()">Create PO</button>
                  <button class="ghost-button mini" type="button" (click)="buildWhatsAppDraft(row)">Draft</button>
                  <button class="ghost-button mini danger" type="button" *ngIf="row.status === 'active'" (click)="markSupplierStatus(row, 'blocked')" [disabled]="saving()">Block</button>
                  <button class="ghost-button mini" type="button" *ngIf="row.status !== 'active'" (click)="markSupplierStatus(row, 'active')" [disabled]="saving()">Reactivate</button>
                  <button class="ghost-button mini" type="button" (click)="editSupplier(row.supplier)">Edit</button>
                </td>
              </tr>
              <tr *ngIf="!filteredSupplierRows().length && !loading()">
                <td colspan="9">
                  <div class="empty-state">
                    <strong>No suppliers match this view</strong>
                    <span>Change filter or add your product distributors, brand vendors and purchase contacts here.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel supplier-draft-panel" *ngIf="whatsappDraft()">
        <div class="section-title">
          <div><span class="eyebrow">Supplier WhatsApp draft</span><h2>Approval-safe message</h2></div>
          <button class="ghost-button" type="button" (click)="whatsappDraft.set('')">Clear draft</button>
        </div>
        <div class="draft-box">{{ whatsappDraft() }}</div>
      </section>

      <section class="panel" *ngIf="showForm()">
        <div class="section-title">
          <div>
            <span class="eyebrow">{{ editingId() ? 'Edit supplier' : 'Create supplier' }}</span>
            <h2>{{ editingId() ? 'Update vendor record' : 'New supplier' }}</h2>
          </div>
          <button class="ghost-button" type="button" (click)="resetForm()">Close form</button>
        </div>

        <form [formGroup]="supplierForm" (ngSubmit)="saveSupplier()" class="supplier-form">
          <div class="validation-stack full" *ngIf="formWarnings().length">
            <strong>Supplier validation</strong>
            <span *ngFor="let warning of formWarnings()">{{ warning }}</span>
          </div>
          <label class="field"><span>Supplier name</span><input formControlName="name" placeholder="Vendor / distributor name" /></label>
          <label class="field"><span>Contact person</span><input formControlName="contactName" placeholder="Owner or sales person" /></label>
          <label class="field"><span>Phone</span><input formControlName="phone" placeholder="+91 mobile / landline" /></label>
          <label class="field"><span>Email</span><input type="email" formControlName="email" placeholder="supplier@example.com" /></label>
          <label class="field"><span>GSTIN</span><input formControlName="gstin" placeholder="GST number" /></label>
          <label class="field"><span>Payment terms</span><input formControlName="preferredPaymentTerms" placeholder="Net 7, COD, advance" /></label>
          <label class="field"><span>Lead time days</span><input type="number" formControlName="leadTimeDays" min="0" /></label>
          <label class="field">
            <span>Status</span>
            <select formControlName="status">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <label class="field"><span>Status reason</span><input formControlName="statusReason" placeholder="Reason for pause/block/reactivation" /></label>
          <label class="field full"><span>Address</span><textarea formControlName="address" placeholder="Billing address, delivery terms or warehouse note"></textarea></label>
          <div class="form-actions full">
            <button class="ghost-button" type="button" (click)="resetForm()">Cancel</button>
            <button class="primary-button" type="submit" [disabled]="supplierForm.invalid || saving()">
              {{ saving() ? 'Saving...' : editingId() ? 'Update supplier' : 'Save supplier' }}
            </button>
          </div>
        </form>
      </section>
    </section>
  `,
  styles: [`
    .suppliers-page {
      gap: 14px;
    }

    .compact-hero {
      align-items: center;
      min-height: auto;
      padding: 16px 20px;
    }

    .compact-hero h2 {
      font-size: 1.25rem;
      line-height: 1.2;
    }

    .hero-actions,
    .toolbar-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    .supplier-kpis {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
    }

    .supplier-intelligence-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
      gap: 12px;
      align-items: start;
    }

    .supplier-command-panel,
    .supplier-draft-panel {
      overflow: hidden;
    }

    .supplier-filter-row {
      display: grid;
      grid-template-columns: minmax(280px, 0.46fr) minmax(0, 1fr);
      gap: 12px;
      align-items: end;
      margin-bottom: 14px;
    }

    .filter-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    .filter-chip {
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 0 11px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #fff;
      color: var(--ink);
      font-weight: 800;
      cursor: pointer;
    }

    .filter-chip strong {
      min-width: 22px;
      min-height: 22px;
      display: inline-grid;
      place-items: center;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--color-surface-sunken);
      color: var(--muted);
      font-size: 0.74rem;
    }

    .filter-chip.active {
      border-color: rgba(15, 118, 110, 0.34);
      background: var(--color-primary-soft);
      color: var(--teal);
    }

    .filter-chip.active strong {
      background: #fff;
      color: var(--teal);
    }

    .trend-list,
    .alert-list.compact {
      display: grid;
      gap: 9px;
    }

    .trend-list article,
    .alert-list.compact article {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(120px, 0.5fr);
      gap: 12px;
      align-items: center;
      padding: 11px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
    }

    .alert-list.compact article {
      grid-template-columns: 1fr;
    }

    .trend-list span,
    .alert-list.compact span,
    .alert-list.compact small {
      display: block;
      margin-top: 3px;
      color: var(--muted);
      font-size: 0.82rem;
    }

    .trend-bars {
      height: 48px;
      display: flex;
      align-items: end;
      gap: 5px;
      justify-content: flex-end;
    }

    .trend-bars span {
      width: 14px;
      min-height: 8px;
      border-radius: 6px 6px 2px 2px;
      background: linear-gradient(180deg, #0f766e, #6ee7b7);
    }

    .supplier-form {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .supplier-form .full {
      grid-column: 1 / -1;
    }

    .validation-stack {
      display: grid;
      gap: 4px;
      padding: 11px 12px;
      border: 1px solid #f7d48a;
      border-radius: 8px;
      background: #fff8e6;
      color: #7c4d00;
    }

    .validation-stack strong,
    .validation-stack span {
      display: block;
    }

    .validation-stack span {
      font-size: 0.84rem;
    }

    .supplier-form textarea {
      min-height: 88px;
      resize: vertical;
    }

    .table-wrap {
      overflow: auto;
    }

    table {
      min-width: 1160px;
    }

    td strong,
    td small {
      display: block;
    }

    td small {
      margin-top: 3px;
      color: var(--muted);
      font-size: 0.78rem;
      max-width: 360px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .supplier-link {
      color: var(--ink);
      text-decoration: none;
    }

    .supplier-link:hover {
      color: var(--teal);
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    .score-pill {
      min-width: 54px;
      display: inline-grid;
      place-items: center;
      padding: 5px 10px;
      border-radius: 999px;
      background: #eef2f7;
      color: #475569;
      font-weight: 900;
    }

    .score-pill.score-good {
      background: #daf5ef;
      color: #075e53;
    }

    .score-pill.score-warn {
      background: #fff3d8;
      color: #7c4d00;
    }

    .score-pill.score-danger {
      background: #fde7e4;
      color: #9f2418;
    }

    .badge.warn,
    .mini-status.warn {
      background: #fff3d8;
      color: #7c4d00;
    }

    .compliance-stack {
      display: grid;
      gap: 5px;
      min-width: 132px;
    }

    .mini-status {
      width: fit-content;
      display: inline-flex;
      align-items: center;
      min-height: 25px;
      padding: 0 9px;
      border-radius: 999px;
      background: #eef2f7;
      color: #475569;
      font-size: 0.74rem;
      font-weight: 800;
    }

    .mini-status.ok {
      background: #daf5ef;
      color: #075e53;
    }

    .supplier-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      min-width: 330px;
    }

    .ghost-button.danger {
      color: #b42318;
      border-color: rgba(180, 35, 24, 0.28);
      background: #fff;
    }

    .draft-box {
      border: 1px solid rgba(15, 118, 110, 0.28);
      border-radius: 12px;
      padding: 14px;
      background: #f4fbf9;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    .empty-state {
      display: grid;
      gap: 4px;
      padding: 24px;
      text-align: center;
      color: var(--muted);
    }

    .empty-state strong {
      color: var(--ink);
    }

    .empty-state.compact {
      padding: 18px;
      border: 1px dashed var(--line);
      border-radius: 8px;
      background: #fff;
    }

    @media (max-width: 1180px) {
      .supplier-kpis,
      .supplier-intelligence-grid,
      .supplier-form,
      .supplier-filter-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .compact-hero {
        align-items: stretch;
      }

      .supplier-kpis,
      .supplier-intelligence-grid,
      .supplier-form,
      .supplier-filter-row {
        grid-template-columns: 1fr;
      }

      .filter-chip-row {
        justify-content: flex-start;
      }
    }
  `]
})
export class SuppliersComponent implements OnInit {
  readonly suppliers = signal<ApiRecord[]>([]);
  readonly products = signal<ApiRecord[]>([]);
  readonly batches = signal<ApiRecord[]>([]);
  readonly transactions = signal<ApiRecord[]>([]);
  readonly purchaseOrders = signal<ApiRecord[]>([]);
  readonly whatsappQueue = signal<ApiRecord[]>([]);
  readonly intelligence = signal<ApiRecord | null>(null);
  readonly inventoryReport = signal<ApiRecord | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly showForm = signal(false);
  readonly editingId = signal('');
  readonly activeFilter = signal<SupplierFilter>('all');
  readonly whatsappDraft = signal('');
  query = '';

  readonly activeSuppliers = computed(() => this.suppliers().filter((supplier) => this.supplierStatus(supplier) === 'active'));
  readonly suppliersWithGstin = computed(() => this.suppliers().filter((supplier) => Boolean(String(supplier.gstin || '').trim())));
  readonly suppliersMissingContact = computed(() =>
    this.suppliers().filter((supplier) => !String(supplier.phone || '').trim() && !String(supplier.email || '').trim())
  );
  readonly supplierRows = computed(() => this.buildSupplierRows());
  readonly filteredSupplierRows = computed(() => this.supplierRows().filter((row) => this.matchesFilter(row) && this.matchesQuery(row)));
  readonly openPoValue = computed(() => this.supplierRows().reduce((total, row) => total + row.openPoValue, 0));
  readonly openPoSuppliers = computed(() => this.supplierRows().filter((row) => row.openPoCount > 0));
  readonly qualityRiskSuppliers = computed(() => this.supplierRows().filter((row) => row.qualityRisk > 0 || row.score < 70));
  readonly pendingWhatsappDrafts = computed(() => this.whatsappQueue().filter((row) => !['sent', 'cancelled'].includes(String(row.status || '').toLowerCase())).length);
  readonly totalSupplierSpend = computed(() => this.supplierRows().reduce((total, row) => total + row.purchaseValue, 0));
  readonly priceRiseSuppliers = computed(() => this.supplierRows().filter((row) => row.priceChangePct > 0));
  readonly topSpendRows = computed(() => this.supplierRows().filter((row) => row.purchaseValue > 0).slice(0, 6));
  readonly purchaseIntelligenceRows = computed(() =>
    this.supplierRows().filter((row) => row.priceChangePct > 0 || row.cheaperAlternative).slice(0, 6)
  );

  readonly supplierForm = this.fb.group({
    name: ['', Validators.required],
    contactName: [''],
    phone: [''],
    email: [''],
    gstin: [''],
    address: [''],
    status: ['active'],
    statusReason: [''],
    preferredPaymentTerms: [''],
    leadTimeDays: [0]
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const branchId = this.api.selectedBranchId();
    Promise.all([
      firstValueFrom(this.api.list<ApiRecord[]>('suppliers', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('products', { limit: 10000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('inventoryBatches', { limit: 10000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('inventory', { limit: 10000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('inventory-intelligence/purchase-orders', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('inventory-intelligence/supplier-whatsapp-queue', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord>('inventory-intelligence/summary', { branchId })),
      firstValueFrom(this.api.list<ApiRecord>('inventory-intelligence/reports', { branchId }))
    ]).then(([suppliers, products, batches, transactions, purchaseOrders, whatsappQueue, intelligence, inventoryReport]) => {
      this.suppliers.set(suppliers || []);
      this.products.set(products || []);
      this.batches.set(batches || []);
      this.transactions.set(transactions || []);
      this.purchaseOrders.set(purchaseOrders || []);
      this.whatsappQueue.set(whatsappQueue || []);
      this.intelligence.set(intelligence || null);
      this.inventoryReport.set(inventoryReport || null);
      this.loading.set(false);
    }).catch((error) => {
      this.error.set(error?.error?.error || error?.message || 'Unable to load suppliers');
      this.loading.set(false);
    });
  }

  saveSupplier(): void {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      return;
    }
    const blockingWarnings = this.formWarnings().filter((warning) => warning.includes('Invalid GSTIN') || warning.includes('Duplicate'));
    if (blockingWarnings.length) {
      this.error.set(blockingWarnings[0]);
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    const existing = this.suppliers().find((supplier) => supplier.id === this.editingId());
    const raw = this.supplierForm.getRawValue();
    const payload = this.withStatusHistory(raw, existing);
    const request = this.editingId()
      ? this.api.update('suppliers', this.editingId(), payload)
      : this.api.create('suppliers', payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(this.editingId() ? 'Supplier updated.' : 'Supplier saved in register.');
        this.resetForm(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || error?.message || 'Unable to save supplier');
        this.saving.set(false);
      }
    });
  }

  editSupplier(supplier: ApiRecord): void {
    this.editingId.set(String(supplier.id || ''));
    this.showForm.set(true);
    this.supplierForm.reset({
      name: supplier.name || '',
      contactName: supplier.contactName || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      gstin: supplier.gstin || '',
      address: supplier.address || '',
      status: supplier.status || 'active',
      statusReason: supplier.statusReason || '',
      preferredPaymentTerms: supplier.preferredPaymentTerms || '',
      leadTimeDays: Number(supplier.leadTimeDays || 0)
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetForm(clearMessage = true): void {
    this.editingId.set('');
    this.showForm.set(false);
    if (clearMessage) this.success.set('');
    this.supplierForm.reset({
      name: '',
      contactName: '',
      phone: '',
      email: '',
      gstin: '',
      address: '',
      status: 'active',
      statusReason: '',
      preferredPaymentTerms: '',
      leadTimeDays: 0
    });
  }

  setFilter(filter: SupplierFilter): void {
    this.activeFilter.set(filter);
  }

  filterCount(filter: SupplierFilter): number {
    return this.supplierRows().filter((row) => this.matchesFilter(row, filter)).length;
  }

  buildWhatsAppDraft(row: SupplierCommandRow): void {
    const vendor = row.supplier;
    const contact = vendor.phone || vendor.email || 'supplier contact';
    const items = row.draftItems || 'Please share latest rate card, delivery availability and GST invoice terms.';
    this.whatsappDraft.set(`Draft to ${vendor.name} (${contact})\nPurchase follow-up: ${items}\nOpen PO value: INR ${Math.round(row.openPoValue).toLocaleString('en-IN')}\nNote: Send only after owner approval.`);
    this.success.set('Supplier WhatsApp draft prepared.');
  }

  createPoForSupplier(row: SupplierCommandRow): void {
    const draft = row.suggestedPurchase;
    if (!draft?.['productId'] || !draft?.['branchId']) {
      this.error.set('No linked product or branch found for this supplier. Link a product/batch first.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.api.post<ApiRecord>('inventory-intelligence/purchase-orders', {
      branchId: draft['branchId'],
      supplierId: row.supplier.id,
      sourceType: 'supplier_command',
      notes: `Supplier command draft for ${row.supplier.name}. ${draft['reason'] || 'Replenishment required.'}`,
      items: [{
        productId: draft['productId'],
        quantity: Number(draft['quantity'] || 1),
        unitCost: Number(draft['unitCost'] || 0)
      }]
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(`PO draft created for ${row.supplier.name}.`);
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.error.set(error?.error?.error || error?.message || 'Unable to create supplier PO draft');
      }
    });
  }

  markSupplierStatus(row: SupplierCommandRow, status: 'active' | 'blocked'): void {
    const reason = status === 'blocked' ? 'Blocked from supplier command register' : 'Reactivated from supplier command register';
    this.saving.set(true);
    this.error.set('');
    this.api.update('suppliers', row.supplier.id, this.withStatusHistory({
      ...row.supplier,
      status,
      statusReason: reason
    }, row.supplier)).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(`${row.supplier.name} ${status === 'blocked' ? 'blocked' : 'reactivated'}.`);
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.error.set(error?.error?.error || error?.message || 'Unable to update supplier status');
      }
    });
  }

  formWarnings(): string[] {
    const raw = this.supplierForm.getRawValue();
    const warnings: string[] = [];
    const gstin = String(raw.gstin || '').trim().toUpperCase();
    if (gstin && !this.isValidGstin(gstin)) warnings.push('Invalid GSTIN format. Use 15-character Indian GSTIN.');
    if (!String(raw.phone || '').trim() && !String(raw.email || '').trim()) warnings.push('Phone or email is required for supplier ordering.');
    if (!String(raw.address || '').trim()) warnings.push('Billing address is missing.');
    for (const duplicate of this.duplicateWarnings(raw)) warnings.push(duplicate);
    return warnings;
  }

  private withStatusHistory(raw: ApiRecord, existing?: ApiRecord): ApiRecord {
    const nextStatus = String(raw.status || 'active');
    const previousStatus = String(existing?.['status'] || '');
    const history = this.statusHistory(existing || {});
    const statusChanged = !existing || (previousStatus && previousStatus !== nextStatus);
    if (statusChanged) {
      history.unshift({
        status: nextStatus,
        reason: raw.statusReason || (existing ? 'Status changed from supplier command register' : 'Supplier created'),
        at: new Date().toISOString()
      });
    }
    return {
      ...raw,
      gstin: String(raw.gstin || '').trim().toUpperCase(),
      leadTimeDays: Number(raw.leadTimeDays || 0),
      statusHistory: JSON.stringify(history.slice(0, 20)),
      statusChangedAt: statusChanged ? new Date().toISOString() : existing?.['statusChangedAt'] || ''
    };
  }

  private buildSupplierRows(): SupplierCommandRow[] {
    const scorecards = ((this.intelligence()?.['supplierScorecards'] || []) as ApiRecord[]);
    const supplierSpend = ((this.inventoryReport()?.['supplierSpend'] || []) as ApiRecord[]);
    const suggestions = ((this.intelligence()?.['suggestions'] || []) as ApiRecord[]);
    return this.suppliers()
      .map((supplier) => {
        const supplierId = String(supplier.id || '');
        const supplierName = String(supplier.name || '').toLowerCase();
        const scorecard = scorecards.find((row) => row.id === supplierId);
        const spendRow = supplierSpend.find((row) => row.supplierId === supplierId || row.supplier_id === supplierId);
        const supplierBatches = this.batches().filter((batch) => this.recordSupplierId(batch) === supplierId);
        const batchProductIds = new Set(supplierBatches.map((batch) => String(batch.productId || batch.product_id || '')).filter(Boolean));
        const suppliedProducts = this.products().filter((product) => batchProductIds.has(String(product.id || '')) || String(product.supplier || '').toLowerCase() === supplierName);
        const suppliedProductIds = new Set(suppliedProducts.map((product) => String(product.id || '')));
        const purchaseTransactions = this.transactions()
          .filter((row) => this.recordSupplierId(row) === supplierId && String(row.type || '').includes('purchase'))
          .slice()
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        const openPoRows = this.purchaseOrders().filter((row) => this.recordSupplierId(row) === supplierId && !['received', 'closed', 'cancelled'].includes(String(row.status || 'draft').toLowerCase()));
        const openPoValue = this.money(openPoRows.reduce((total, row) => total + this.poValue(row), 0));
        const expiringBatchCount = supplierBatches.filter((batch) => Number(batch.quantityAvailable ?? batch.quantity_available ?? 0) > 0 && this.daysUntil(String(batch.expiryDate || batch.expiry_date || '')) <= 60).length;
        const lowStockCount = suppliedProducts.filter((product) => Number(product.stock || 0) <= Number(product.lowStockThreshold || product.low_stock_threshold || 0)).length;
        const wasteCount = this.transactions().filter((row) => suppliedProductIds.has(String(row.productId || row.product_id || '')) && /waste|expiry|damage/i.test(`${row.type || ''} ${row.reason || ''}`)).length;
        const qualityRisk = expiringBatchCount + lowStockCount + wasteCount;
        const fallbackScore = Math.max(55, 96 - qualityRisk * 7);
        const score = Number(scorecard?.['reliabilityScore'] ?? scorecard?.['score'] ?? fallbackScore);
        const purchaseValue = this.money(Math.max(
          Number(scorecard?.['purchaseValue'] || 0),
          Number(spendRow?.['spend'] || 0),
          Math.abs(purchaseTransactions.reduce((total, row) => total + Number(row.totalCost || row.total_cost || 0), 0))
        ));
        const supplierSuggestions = suggestions.filter((row) =>
          this.recordSupplierId(row) === supplierId
          || String(row.supplier || '').toLowerCase() === supplierName
          || suppliedProductIds.has(String(row.productId || row.product_id || ''))
        );
        const priceSignal = this.priceSignalForSupplier(supplierId, suppliedProductIds);
        const cheaperSignal = this.cheaperSupplierSignal(supplierId, suppliedProductIds);
        const suggestedPurchase = this.suggestedPurchaseForSupplier(supplier, suppliedProducts, supplierSuggestions);
        const topProductName = suppliedProducts[0]?.['name'] || supplierSuggestions[0]?.['name'] || 'No product linked';
        const draftItems = supplierSuggestions
          .slice(0, 4)
          .map((row) => `${row.name || this.productName(String(row.productId || row.product_id || ''))} - ${row.recommendedQty || row.quantity || 0} units`)
          .join(', ');
        return {
          supplier,
          status: this.supplierStatus(supplier),
          score: this.money(score),
          purchaseValue,
          openPoCount: openPoRows.length,
          openPoValue,
          qualityRisk,
          expiringBatchCount,
          suppliedProducts: suppliedProducts.length,
          lastPurchaseAt: String(purchaseTransactions[0]?.['createdAt'] || ''),
          topProductName,
          missingContact: !String(supplier.phone || '').trim() && !String(supplier.email || '').trim(),
          missingGstin: !String(supplier.gstin || '').trim(),
          draftItems,
          statusReason: String(supplier.statusReason || ''),
          statusHistoryCount: this.statusHistory(supplier).length,
          complianceIssues: this.complianceIssues(supplier),
          priceChangePct: priceSignal.priceChangePct,
          cheaperAlternative: cheaperSignal.supplierName,
          cheaperSavingPct: cheaperSignal.savingPct,
          trendBars: this.trendBarsFor(purchaseTransactions),
          suggestedPurchase
        };
      })
      .sort((a, b) => b.qualityRisk - a.qualityRisk || b.openPoValue - a.openPoValue || b.purchaseValue - a.purchaseValue || a.supplier.name.localeCompare(b.supplier.name));
  }

  private matchesFilter(row: SupplierCommandRow, override?: SupplierFilter): boolean {
    const filter = override || this.activeFilter();
    if (filter === 'active') return row.status === 'active';
    if (filter === 'risk') return row.qualityRisk > 0 || row.score < 70;
    if (filter === 'pending-po') return row.openPoCount > 0;
    if (filter === 'missing-gstin') return row.missingGstin;
    if (filter === 'missing-contact') return row.missingContact;
    if (filter === 'no-purchase') return row.purchaseValue <= 0;
    if (filter === 'blocked') return row.status !== 'active';
    if (filter === 'price-rise') return row.priceChangePct > 0;
    if (filter === 'cheaper-available') return Boolean(row.cheaperAlternative);
    return true;
  }

  private matchesQuery(row: SupplierCommandRow): boolean {
    const term = this.query.trim().toLowerCase();
    if (!term) return true;
    return [
      row.supplier.name,
      row.supplier.contactName,
      row.supplier.phone,
      row.supplier.email,
      row.supplier.gstin,
      row.supplier.address,
      row.status,
      row.topProductName
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term);
  }

  private duplicateWarnings(raw: ApiRecord): string[] {
    const currentId = this.editingId();
    const normalizedPhone = this.digits(raw.phone);
    const normalizedEmail = String(raw.email || '').trim().toLowerCase();
    const normalizedGstin = String(raw.gstin || '').trim().toUpperCase();
    const warnings: string[] = [];
    const duplicatePhone = normalizedPhone && this.suppliers().find((supplier) => supplier.id !== currentId && this.digits(supplier.phone) === normalizedPhone);
    const duplicateEmail = normalizedEmail && this.suppliers().find((supplier) => supplier.id !== currentId && String(supplier.email || '').trim().toLowerCase() === normalizedEmail);
    const duplicateGstin = normalizedGstin && this.suppliers().find((supplier) => supplier.id !== currentId && String(supplier.gstin || '').trim().toUpperCase() === normalizedGstin);
    if (duplicatePhone) warnings.push(`Duplicate phone already used by ${duplicatePhone.name}.`);
    if (duplicateEmail) warnings.push(`Duplicate email already used by ${duplicateEmail.name}.`);
    if (duplicateGstin) warnings.push(`Duplicate GSTIN already used by ${duplicateGstin.name}.`);
    return warnings;
  }

  private complianceIssues(supplier: ApiRecord): string[] {
    const issues: string[] = [];
    const gstin = String(supplier.gstin || '').trim();
    if (!gstin) issues.push('GSTIN missing');
    else if (!this.isValidGstin(gstin)) issues.push('GSTIN invalid');
    if (!String(supplier.phone || '').trim() && !String(supplier.email || '').trim()) issues.push('Contact missing');
    if (!String(supplier.address || '').trim()) issues.push('Billing address missing');
    return issues;
  }

  private isValidGstin(value: string): boolean {
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(value || '').trim().toUpperCase());
  }

  private statusHistory(supplier: ApiRecord): ApiRecord[] {
    const raw = supplier?.['statusHistory'];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(String(raw || '[]'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private suggestedPurchaseForSupplier(supplier: ApiRecord, suppliedProducts: ApiRecord[], suggestions: ApiRecord[]): ApiRecord | null {
    const suggested = suggestions.find((row) => row.productId || row.product_id);
    if (suggested) {
      const product = this.products().find((item) => item.id === (suggested.productId || suggested.product_id));
      return {
        productId: suggested.productId || suggested.product_id,
        branchId: suggested.branchId || suggested.branch_id || product?.['branchId'] || product?.['branch_id'] || this.api.selectedBranchId(),
        quantity: Number(suggested.recommendedQty || suggested.quantity || 1),
        unitCost: Number(product?.['unitCost'] || product?.['unit_cost'] || 0),
        reason: suggested.reason || 'AI reorder suggestion'
      };
    }
    const lowStockProduct = suppliedProducts.find((product) => Number(product.stock || 0) <= Number(product.lowStockThreshold || product.low_stock_threshold || 0));
    const product = lowStockProduct || suppliedProducts[0];
    if (!product) return null;
    const threshold = Number(product.lowStockThreshold || product.low_stock_threshold || 1);
    const stock = Number(product.stock || 0);
    return {
      productId: product.id,
      branchId: product.branchId || product.branch_id || this.api.selectedBranchId(),
      quantity: Math.max(1, threshold * 2 - stock),
      unitCost: Number(product.unitCost || product.unit_cost || 0),
      reason: lowStockProduct ? 'Low stock supplier-linked product' : `Manual supplier replenishment for ${supplier.name}`
    };
  }

  private trendBarsFor(rows: ApiRecord[]): number[] {
    const values = rows
      .slice()
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
      .slice(-6)
      .map((row) => Math.abs(Number(row.totalCost || row.total_cost || 0)));
    const max = Math.max(...values, 1);
    const bars = values.map((value) => Math.max(8, Math.round((value / max) * 100)));
    while (bars.length < 6) bars.unshift(8);
    return bars;
  }

  private priceSignalForSupplier(supplierId: string, productIds: Set<string>): { priceChangePct: number } {
    let maxChange = 0;
    for (const productId of productIds) {
      const rows = this.transactions()
        .filter((row) => this.recordSupplierId(row) === supplierId && String(row.productId || row.product_id || '') === productId && Number(row.unitCost || row.unit_cost || 0) > 0)
        .slice()
        .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      if (rows.length < 2) continue;
      const first = Number(rows[0].unitCost || rows[0].unit_cost || 0);
      const last = Number(rows[rows.length - 1].unitCost || rows[rows.length - 1].unit_cost || 0);
      if (first > 0 && last > first) maxChange = Math.max(maxChange, ((last - first) / first) * 100);
    }
    return { priceChangePct: this.money(maxChange) };
  }

  private cheaperSupplierSignal(supplierId: string, productIds: Set<string>): { supplierName: string; savingPct: number } {
    let best = { supplierName: '', savingPct: 0 };
    for (const productId of productIds) {
      const rows = this.transactions()
        .filter((row) => String(row.productId || row.product_id || '') === productId && Number(row.unitCost || row.unit_cost || 0) > 0)
        .slice()
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      const current = rows.find((row) => this.recordSupplierId(row) === supplierId);
      if (!current) continue;
      const currentCost = Number(current.unitCost || current.unit_cost || 0);
      const alternate = rows
        .filter((row) => this.recordSupplierId(row) && this.recordSupplierId(row) !== supplierId)
        .sort((a, b) => Number(a.unitCost || a.unit_cost || 0) - Number(b.unitCost || b.unit_cost || 0))[0];
      if (!alternate) continue;
      const alternateCost = Number(alternate.unitCost || alternate.unit_cost || 0);
      if (alternateCost <= 0 || alternateCost >= currentCost) continue;
      const savingPct = ((currentCost - alternateCost) / currentCost) * 100;
      if (savingPct > best.savingPct) {
        best = {
          supplierName: this.suppliers().find((supplier) => supplier.id === this.recordSupplierId(alternate))?.name || 'Alternate supplier',
          savingPct: this.money(savingPct)
        };
      }
    }
    return best;
  }

  private digits(value: unknown): string {
    return String(value || '').replace(/\D/g, '');
  }

  private recordSupplierId(row: ApiRecord): string {
    return String(row.supplierId || row.supplier_id || '');
  }

  private supplierStatus(supplier: ApiRecord): string {
    return String(supplier.status || 'active').toLowerCase();
  }

  private productName(id: string): string {
    return this.products().find((product) => product.id === id)?.name || id || 'Product';
  }

  private poValue(row: ApiRecord): number {
    if (row.totalEstimatedCost || row.total_estimated_cost) return Number(row.totalEstimatedCost || row.total_estimated_cost || 0);
    const items = Array.isArray(row.items) ? row.items : [];
    return items.reduce((total, item) => total + Number(item.estimatedTotal || item.estimated_total || 0), 0);
  }

  private daysUntil(value: string): number {
    if (!value) return 9999;
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return 9999;
    return Math.round((time - Date.now()) / 86400000);
  }

  private money(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }
}
