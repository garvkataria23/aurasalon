import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-supplier-360',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, DecimalPipe, RouterLink, StateComponent],
  template: `
    <section class="page-stack supplier-360-page">
      <div class="module-hero compact-hero">
        <div>
          <span class="eyebrow">Inventory / Supplier 360</span>
          <h2>{{ supplier()?.name || 'Supplier intelligence' }}</h2>
          <p>Supplier score, GSTIN, purchase value, pending PO, last purchase, price trend, quality risk and replacement supplier suggestion.</p>
        </div>
        <div class="hero-actions">
          <a class="ghost-button" routerLink="/suppliers">Back to suppliers</a>
          <a class="primary-button" routerLink="/inventory/purchase-orders">Open purchase orders</a>
        </div>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <ng-container *ngIf="supplier() as vendor">
        <section class="supplier-kpis">
          <article class="metric-card teal"><span>Supplier score</span><strong>{{ supplierScore() | number: '1.0-0' }}</strong><small>Reliability and expiry quality</small></article>
          <article class="metric-card blue"><span>Total purchase</span><strong>{{ purchaseValue() | currency: 'INR':'symbol':'1.0-0' }}</strong><small>{{ purchaseTransactions().length }} purchase entries</small></article>
          <article class="metric-card amber"><span>Pending PO</span><strong>{{ pendingRecommendations().length }}</strong><small>Approval-safe drafts</small></article>
          <article class="metric-card red"><span>Quality issues</span><strong>{{ qualityIssues().length }}</strong><small>Expiry, waste or stockout risk</small></article>
        </section>

        <div class="supplier-layout">
          <section class="panel supplier-card">
            <div class="supplier-avatar">{{ initials(vendor.name) }}</div>
            <span class="eyebrow">Supplier profile</span>
            <h2>{{ vendor.name }}</h2>
            <p>{{ vendor.status || 'active' }} vendor · GST-ready master</p>
            <div class="detail-list">
              <div><span>Contact</span><strong>{{ vendor.contactName || 'Not set' }}</strong></div>
              <div><span>Phone</span><strong>{{ vendor.phone || 'No phone' }}</strong></div>
              <div><span>Email</span><strong>{{ vendor.email || 'No email' }}</strong></div>
              <div><span>GSTIN</span><strong>{{ vendor.gstin || 'Not captured' }}</strong></div>
              <div><span>Last purchase</span><strong>{{ lastPurchaseDate() }}</strong></div>
              <div><span>Replacement supplier</span><strong>{{ replacementSupplier() }}</strong></div>
            </div>
          </section>

          <section class="panel">
            <div class="section-title">
              <div><span class="eyebrow">WhatsApp supplier ordering</span><h2>Approval-safe draft</h2></div>
              <button class="ghost-button" type="button" (click)="buildWhatsAppDraft(vendor)">Build draft</button>
            </div>
            <div class="draft-box" *ngIf="whatsappDraft(); else noDraft">{{ whatsappDraft() }}</div>
            <ng-template #noDraft>
              <div class="empty-state"><strong>No draft generated</strong><span>Build a draft after PO approval. Message is not sent automatically.</span></div>
            </ng-template>
          </section>
        </div>

        <div class="supplier-grid">
          <section class="panel">
            <div class="section-title"><div><span class="eyebrow">Pending purchase orders</span><h2>Autopilot recommendations for this supplier</h2></div></div>
            <div class="timeline">
              <article *ngFor="let row of pendingRecommendations()">
                <strong>{{ productName(row.productId) }}</strong>
                <span>{{ row.quantity || row.recommendedQty || 0 }} units · {{ row.estimatedCost | currency: 'INR':'symbol':'1.0-0' }} · {{ row.status || 'pending approval' }}</span>
                <small>{{ row.recommendationText || row.reason || 'Reorder recommendation' }}</small>
              </article>
              <article *ngIf="!pendingRecommendations().length"><strong>No pending PO</strong><span>Reorder drafts linked to this supplier will appear here.</span></article>
            </div>
          </section>

          <section class="panel">
            <div class="section-title"><div><span class="eyebrow">Price trend</span><h2>Purchase cost movement</h2></div></div>
            <div class="timeline mini">
              <article *ngFor="let row of purchaseTransactions().slice(0, 8)">
                <strong>{{ productName(row.productId) }}</strong>
                <span>{{ row.quantity || 0 }} units · {{ row.unitCost | currency: 'INR':'symbol':'1.0-0' }} unit · {{ row.totalCost | currency: 'INR':'symbol':'1.0-0' }}</span>
                <small>{{ row.createdAt | date: 'short' }}</small>
              </article>
              <article *ngIf="!purchaseTransactions().length"><strong>No purchase history</strong><span>Receive batches from this supplier to build price trend.</span></article>
            </div>
          </section>
        </div>

        <div class="supplier-grid">
          <section class="panel">
            <div class="section-title"><div><span class="eyebrow">Products supplied</span><h2>Branch stock and batch quality</h2></div></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Product</th><th>Stock</th><th>Branch</th><th>Expiry</th><th>Risk</th></tr></thead>
                <tbody>
                  <tr *ngFor="let product of suppliedProducts()">
                    <td><a [routerLink]="['/inventory/products', product.id]">{{ product.name }}</a></td>
                    <td>{{ product.stock || 0 }}</td>
                    <td>{{ branchName(product.branchId) }}</td>
                    <td>{{ nearestExpiry(product.id) }}</td>
                    <td><span class="badge" [class.warn]="isLowStock(product)">{{ isLowStock(product) ? 'low stock' : 'ok' }}</span></td>
                  </tr>
                  <tr *ngIf="!suppliedProducts().length"><td colspan="5">No products linked to this supplier yet.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="panel">
            <div class="section-title"><div><span class="eyebrow">Quality issue log</span><h2>Expiry, waste and replacement risk</h2></div></div>
            <div class="timeline mini">
              <article *ngFor="let row of qualityIssues()">
                <strong>{{ productName(row.productId) }}</strong>
                <span>{{ row.reason || 'Supplier quality watch' }}</span>
                <small>{{ row.expiryDate || row.createdAt || 'live signal' }}</small>
              </article>
              <article *ngIf="!qualityIssues().length"><strong>No quality issues</strong><span>Expiry, waste and purchase anomalies will appear here.</span></article>
            </div>
          </section>
        </div>
      </ng-container>
    </section>
  `,
  styles: [`
    .compact-hero,
    .hero-actions,
    .section-title {
      align-items: center;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    .supplier-kpis,
    .supplier-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .supplier-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .supplier-layout {
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr);
      gap: 12px;
    }

    .supplier-card {
      display: grid;
      gap: 10px;
    }

    .supplier-avatar {
      width: 96px;
      height: 96px;
      border-radius: 24px;
      display: grid;
      place-items: center;
      background: #d8f3ee;
      color: #064e45;
      font-size: 1.8rem;
      font-weight: 800;
    }

    .detail-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .detail-list div,
    .draft-box {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      background: #fff;
    }

    .detail-list span {
      display: block;
      color: var(--muted);
      margin-bottom: 3px;
    }

    .draft-box {
      white-space: pre-wrap;
      background: #f4fbf9;
      border-color: rgba(15, 118, 110, 0.28);
      line-height: 1.5;
    }

    .timeline {
      display: grid;
      gap: 8px;
    }

    .timeline article {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 11px 12px;
      background: #fff;
    }

    .timeline span,
    .timeline small {
      display: block;
      color: var(--muted);
      margin-top: 3px;
    }

    .table-wrap {
      overflow: auto;
    }

    table {
      min-width: 760px;
    }

    .badge.warn {
      background: #fff3d8;
      color: #7c4d00;
    }

    .empty-state {
      color: var(--muted);
    }

    .empty-state strong {
      display: block;
      color: var(--ink);
    }

    @media (max-width: 1180px) {
      .supplier-kpis,
      .supplier-layout,
      .supplier-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .supplier-kpis,
      .supplier-layout,
      .supplier-grid,
      .detail-list {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class Supplier360Component implements OnInit {
  readonly supplier = signal<ApiRecord | null>(null);
  readonly suppliers = signal<ApiRecord[]>([]);
  readonly products = signal<ApiRecord[]>([]);
  readonly branches = signal<ApiRecord[]>([]);
  readonly batches = signal<ApiRecord[]>([]);
  readonly transactions = signal<ApiRecord[]>([]);
  readonly recommendations = signal<ApiRecord[]>([]);
  readonly intelligence = signal<ApiRecord | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly whatsappDraft = signal('');

  readonly supplierBatches = computed(() => {
    const vendor = this.supplier();
    return vendor ? this.batches().filter((batch) => batch.supplierId === vendor.id) : [];
  });

  readonly purchaseTransactions = computed(() => {
    const vendor = this.supplier();
    return vendor
      ? this.transactions().filter((row) => row.supplierId === vendor.id && String(row.type || '').includes('purchase')).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      : [];
  });

  readonly purchaseValue = computed(() => this.purchaseTransactions().reduce((total, row) => total + Math.abs(Number(row.totalCost || 0)), 0));

  readonly pendingRecommendations = computed(() => {
    const vendor = this.supplier();
    if (!vendor) return [];
    const suppliedIds = new Set(this.supplierBatches().map((batch) => batch.productId));
    const vendorName = String(vendor.name || '').toLowerCase();
    return [
      ...this.recommendations(),
      ...((this.intelligence()?.['suggestions'] || []) as ApiRecord[])
    ].filter((row) =>
      suppliedIds.has(row.productId)
      || row.supplierId === vendor.id
      || String(row.supplier || '').toLowerCase() === vendorName
    );
  });

  readonly suppliedProducts = computed(() => {
    const ids = new Set(this.supplierBatches().map((batch) => batch.productId));
    const name = String(this.supplier()?.name || '').toLowerCase();
    return this.products().filter((product) => ids.has(product.id) || String(product.supplier || '').toLowerCase() === name);
  });

  readonly qualityIssues = computed<ApiRecord[]>(() => {
    const ids = new Set(this.suppliedProducts().map((product) => product.id));
    const expiry = this.supplierBatches()
      .filter((batch) => batch.expiryDate && this.daysUntil(batch.expiryDate) <= 60)
      .map((batch) => ({ ...batch, reason: 'Expiry risk within 60 days' }));
    const lowStock = this.products()
      .filter((product) => ids.has(product.id) && this.isLowStock(product))
      .map((product) => ({ ...product, productId: product.id, reason: 'Low stock on supplier-linked product' }));
    const waste = this.transactions()
      .filter((row) => ids.has(row.productId) && `${row.type || ''} ${row.reason || ''}`.toLowerCase().match(/waste|expiry|damage/))
      .map((row) => ({ ...row, reason: row.reason || 'Waste, expiry or damage signal' }));
    return [...expiry, ...lowStock, ...waste];
  });

  readonly supplierScore = computed(() => {
    const vendor = this.supplier();
    const scorecard = ((this.intelligence()?.['supplierScorecards'] || []) as ApiRecord[]).find((row) => row.id === vendor?.id);
    if (scorecard) return Number(scorecard.reliabilityScore || 0);
    return Math.max(55, 96 - this.qualityIssues().length * 7);
  });

  constructor(
    private readonly api: ApiService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const supplierId = this.route.snapshot.paramMap.get('id') || '';
    this.loading.set(true);
    this.error.set('');
    Promise.all([
      firstValueFrom(this.api.get<ApiRecord>('suppliers', supplierId)),
      firstValueFrom(this.api.list<ApiRecord[]>('suppliers', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('products', { limit: 10000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('branches', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('inventoryBatches', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('inventory', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('inventory-autopilot/purchase-recommendations', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord>('inventory-intelligence/summary', { branchId: this.api.selectedBranchId() }))
    ]).then(([supplier, suppliers, products, branches, batches, transactions, recommendations, intelligence]) => {
      this.supplier.set(supplier);
      this.suppliers.set(suppliers || []);
      this.products.set(products || []);
      this.branches.set(branches || []);
      this.batches.set(batches || []);
      this.transactions.set(transactions || []);
      this.recommendations.set(recommendations || []);
      this.intelligence.set(intelligence || null);
      this.loading.set(false);
    }).catch((error) => {
      this.error.set(error?.error?.error || error?.message || 'Unable to load Supplier 360');
      this.loading.set(false);
    });
  }

  buildWhatsAppDraft(vendor: ApiRecord): void {
    const rows = this.pendingRecommendations().slice(0, 6);
    const items = rows.length
      ? rows.map((row) => `${this.productName(row.productId)} - ${row.quantity || row.recommendedQty || 0} units`).join(', ')
      : 'Please share latest price list and next delivery availability.';
    this.whatsappDraft.set(`Draft to ${vendor.name}\nPurchase request: ${items}\nNote: Send only after owner approval.`);
  }

  lastPurchaseDate(): string {
    const row = this.purchaseTransactions()[0];
    return row?.createdAt ? new Date(row.createdAt).toLocaleDateString() : 'No purchase yet';
  }

  replacementSupplier(): string {
    const current = this.supplier();
    const replacement = this.suppliers().filter((item) => item.id !== current?.id && (item.status || 'active') === 'active')[0];
    return replacement?.name || 'No alternate supplier';
  }

  productName(id: string): string {
    return this.products().find((product) => product.id === id)?.name || id || 'Product';
  }

  branchName(id: string): string {
    return this.branches().find((branch) => branch.id === id)?.name || id || 'All branches';
  }

  nearestExpiry(productId: string): string {
    const expiry = this.batches().filter((batch) => batch.productId === productId && batch.expiryDate).map((batch) => String(batch.expiryDate)).sort()[0];
    return expiry || 'No expiry';
  }

  isLowStock(product: ApiRecord): boolean {
    return Number(product.stock || 0) <= Number(product.lowStockThreshold || 0);
  }

  initials(value = ''): string {
    return String(value).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S';
  }

  private daysUntil(value: string): number {
    const time = new Date(value).getTime();
    if (!value || Number.isNaN(time)) return 9999;
    return Math.round((time - Date.now()) / 86400000);
  }
}
