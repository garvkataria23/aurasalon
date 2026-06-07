import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-product-360',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, DecimalPipe, RouterLink, StateComponent],
  template: `
    <section class="page-stack product-360-page">
      <div class="module-hero compact-hero">
        <div>
          <span class="eyebrow">Inventory / Product 360</span>
          <h2>{{ product()?.name || 'Product intelligence' }}</h2>
          <p>Current stock, branch stock, batch expiry, purchase history, POS sale history, service usage, margin and reorder risk in one place.</p>
        </div>
        <div class="hero-actions">
          <a class="ghost-button" routerLink="/inventory">Back to inventory</a>
          <a class="primary-button" routerLink="/inventory/purchase-orders">Create PO draft</a>
        </div>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <ng-container *ngIf="product() as item">
        <section class="product-kpis">
          <article class="metric-card teal"><span>Current stock</span><strong>{{ item.stock || 0 }}</strong><small>Reorder at {{ item.lowStockThreshold || 0 }}</small></article>
          <article class="metric-card amber"><span>Stock value</span><strong>{{ stockValue(item) | currency: 'INR':'symbol':'1.0-0' }}</strong><small>Cash locked in this SKU</small></article>
          <article class="metric-card blue"><span>Gross margin</span><strong>{{ margin(item) | currency: 'INR':'symbol':'1.0-0' }}</strong><small>{{ marginPercent(item) | number: '1.0-0' }}% on sale price</small></article>
          <article class="metric-card red"><span>Expiry risk</span><strong>{{ expiringBatches().length }}</strong><small>{{ nearestExpiry(item.id) }}</small></article>
        </section>

        <div class="product-layout">
          <section class="panel product-card">
            <div class="product-avatar">{{ initials(item.name) }}</div>
            <span class="eyebrow">Product profile</span>
            <h2>{{ item.name }}</h2>
            <p>{{ item.category || 'Uncategorised' }} · {{ item.usageType || 'retail' }}</p>
            <div class="detail-list">
              <div><span>SKU / barcode</span><strong>{{ item.sku || 'Not set' }}</strong></div>
              <div><span>GST</span><strong>{{ item.gstRate || 0 }}%</strong></div>
              <div><span>Supplier</span><strong>{{ supplierName(item) }}</strong></div>
              <div><span>Branch</span><strong>{{ branchName(item.branchId) }}</strong></div>
              <div><span>Unit cost</span><strong>{{ (item.unitCost || 0) | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
              <div><span>Selling price</span><strong>{{ (item.price || 0) | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            </div>
          </section>

          <section class="panel">
            <div class="section-title">
              <div><span class="eyebrow">AI reorder autopilot</span><h2>Stockout and purchase recommendation</h2></div>
            </div>
            <div class="recommendation-card" *ngIf="recommendation() as rec; else noRecommendation">
              <strong>{{ rec.recommendedQty || 0 }} units suggested</strong>
              <span>{{ rec.reason || 'Demand or low-stock rule' }} · stockout {{ rec.predictedStockoutDate || 'not projected' }}</span>
              <small>{{ rec.estimatedCost | currency: 'INR':'symbol':'1.0-0' }} estimated cost · approval required before supplier order</small>
              <a class="primary-button" routerLink="/inventory/purchase-orders">Open purchase order</a>
            </div>
            <ng-template #noRecommendation>
              <div class="empty-state"><strong>No active reorder risk</strong><span>Low stock, expiry or demand-based signals will appear here.</span></div>
            </ng-template>
          </section>
        </div>

        <section class="panel">
          <div class="section-title"><div><span class="eyebrow">Branch stock</span><h2>Same product across branches</h2></div></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Branch</th><th>Stock</th><th>Reorder level</th><th>Value</th><th>Risk</th></tr></thead>
              <tbody>
                <tr *ngFor="let row of branchStock()">
                  <td>{{ branchName(row.branchId) }}</td>
                  <td>{{ row.stock || 0 }}</td>
                  <td>{{ row.lowStockThreshold || 0 }}</td>
                  <td>{{ stockValue(row) | currency: 'INR':'symbol':'1.0-0' }}</td>
                  <td><span class="badge" [class.warn]="isLowStock(row)">{{ isLowStock(row) ? 'low stock' : 'healthy' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="product-grid">
          <section class="panel">
            <div class="section-title"><div><span class="eyebrow">Batch + FIFO</span><h2>Batch, expiry and supplier trail</h2></div></div>
            <div class="timeline">
              <article *ngFor="let batch of productBatches()">
                <strong>{{ batch.batchNumber || batch.id }}</strong>
                <span>{{ batch.quantityAvailable || 0 }} left of {{ batch.quantityReceived || 0 }} · expires {{ batch.expiryDate || 'not set' }}</span>
                <small>{{ supplierNameFromId(batch.supplierId) }} · {{ batch.unitCost | currency: 'INR':'symbol':'1.0-0' }} unit cost</small>
              </article>
              <article *ngIf="!productBatches().length"><strong>No batch received yet</strong><span>Purchase receiving will create FIFO batch entries here.</span></article>
            </div>
          </section>

          <section class="panel">
            <div class="section-title"><div><span class="eyebrow">Usage intelligence</span><h2>POS sales and service consumption</h2></div></div>
            <div class="mini-metrics">
              <div><span>POS sold</span><strong>{{ productSaleUsage(item.id) }}</strong></div>
              <div><span>Service used</span><strong>{{ productServiceUsage(item.id) }}</strong></div>
              <div><span>Waste/write-off</span><strong>{{ wasteUsage(item.id) }}</strong></div>
              <div><span>Movement rows</span><strong>{{ productMovements().length }}</strong></div>
            </div>
            <div class="timeline mini">
              <article *ngFor="let row of productMovements().slice(0, 8)">
                <strong>{{ row.type }}</strong>
                <span>{{ row.quantity }} units · {{ row.reason || row.referenceType || 'movement' }}</span>
                <small>{{ row.createdAt | date: 'short' }}</small>
              </article>
            </div>
          </section>
        </div>

        <div class="product-grid">
          <section class="panel">
            <div class="section-title"><div><span class="eyebrow">Service Recipe / BOM</span><h2>Services using this product</h2></div></div>
            <div class="timeline mini">
              <article *ngFor="let service of servicesUsingProduct()">
                <strong>{{ service.name }}</strong>
                <span>{{ service.category || 'Service' }} · auto-deduct ready when service completes</span>
              </article>
              <article *ngIf="!servicesUsingProduct().length"><strong>No recipe linked</strong><span>Add this product to service requiredProducts JSON to enable exact professional stock deduction.</span></article>
            </div>
          </section>

          <section class="panel">
            <div class="section-title"><div><span class="eyebrow">POS sale history</span><h2>Invoices that used this product</h2></div></div>
            <div class="timeline mini">
              <article *ngFor="let sale of productSales().slice(0, 8)">
                <strong>{{ sale.invoiceNumber || sale.id }}</strong>
                <span>{{ sale.clientName || 'Walk-in client' }} · {{ (sale.total || sale.grandTotal || 0) | currency: 'INR':'symbol':'1.0-0' }}</span>
                <small>{{ sale.createdAt | date: 'short' }}</small>
              </article>
              <article *ngIf="!productSales().length"><strong>No POS sale found</strong><span>Retail product invoices will appear here.</span></article>
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
      gap: 8px;
      justify-content: flex-end;
    }

    .product-kpis,
    .product-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .product-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .product-layout {
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr);
      gap: 12px;
    }

    .product-card {
      display: grid;
      gap: 10px;
    }

    .product-avatar {
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

    .detail-list,
    .mini-metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .detail-list div,
    .mini-metrics div,
    .recommendation-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      background: #fff;
    }

    .detail-list span,
    .mini-metrics span,
    .recommendation-card span,
    .recommendation-card small {
      display: block;
      color: var(--muted);
      margin-top: 3px;
    }

    .recommendation-card {
      display: grid;
      gap: 8px;
      border-color: rgba(15, 118, 110, 0.28);
      background: #f4fbf9;
    }

    .table-wrap {
      overflow: auto;
    }

    table {
      min-width: 780px;
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

    .badge.warn {
      background: #fff3d8;
      color: #7c4d00;
    }

    .empty-state {
      display: grid;
      gap: 4px;
      color: var(--muted);
    }

    .empty-state strong {
      color: var(--ink);
    }

    @media (max-width: 1180px) {
      .product-kpis,
      .product-layout,
      .product-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .product-kpis,
      .product-layout,
      .product-grid,
      .detail-list,
      .mini-metrics {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class Product360Component implements OnInit {
  readonly product = signal<ApiRecord | null>(null);
  readonly products = signal<ApiRecord[]>([]);
  readonly branches = signal<ApiRecord[]>([]);
  readonly suppliers = signal<ApiRecord[]>([]);
  readonly batches = signal<ApiRecord[]>([]);
  readonly transactions = signal<ApiRecord[]>([]);
  readonly sales = signal<ApiRecord[]>([]);
  readonly services = signal<ApiRecord[]>([]);
  readonly intelligence = signal<ApiRecord | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly productBatches = computed(() => {
    const product = this.product();
    return product ? this.batches().filter((batch) => batch.productId === product.id).sort((a, b) => String(a.expiryDate || '9999-12-31').localeCompare(String(b.expiryDate || '9999-12-31'))) : [];
  });

  readonly productMovements = computed(() => {
    const product = this.product();
    return product
      ? this.transactions().filter((row) => row.productId === product.id).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      : [];
  });

  readonly branchStock = computed(() => {
    const product = this.product();
    if (!product) return [];
    const key = this.productKey(product);
    return this.products().filter((item) => this.productKey(item) === key);
  });

  readonly recommendation = computed(() => {
    const product = this.product();
    const suggestions = (this.intelligence()?.['suggestions'] || []) as ApiRecord[];
    return product ? suggestions.find((item) => item.productId === product.id) || null : null;
  });

  readonly expiringBatches = computed(() => this.productBatches().filter((batch) => batch.expiryDate && this.daysUntil(batch.expiryDate) <= 60));

  constructor(
    private readonly api: ApiService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const productId = this.route.snapshot.paramMap.get('id') || '';
    this.loading.set(true);
    this.error.set('');
    Promise.all([
      firstValueFrom(this.api.get<ApiRecord>('products', productId)),
      firstValueFrom(this.api.list<ApiRecord[]>('products', { limit: 10000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('branches', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('suppliers', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('inventoryBatches', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('inventory', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('sales', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord[]>('services', { limit: 1000 })),
      firstValueFrom(this.api.list<ApiRecord>('inventory-intelligence/summary', { branchId: this.api.selectedBranchId() }))
    ]).then(([product, products, branches, suppliers, batches, transactions, sales, services, intelligence]) => {
      this.product.set(product);
      this.products.set(products || []);
      this.branches.set(branches || []);
      this.suppliers.set(suppliers || []);
      this.batches.set(batches || []);
      this.transactions.set(transactions || []);
      this.sales.set(sales || []);
      this.services.set(services || []);
      this.intelligence.set(intelligence || null);
      this.loading.set(false);
    }).catch((error) => {
      this.error.set(error?.error?.error || error?.message || 'Unable to load Product 360');
      this.loading.set(false);
    });
  }

  stockValue(product: ApiRecord): number {
    return Number(product.stock || 0) * Number(product.unitCost || product.price || 0);
  }

  margin(product: ApiRecord): number {
    return Number(product.price || 0) - Number(product.unitCost || 0);
  }

  marginPercent(product: ApiRecord): number {
    const price = Number(product.price || 0);
    return price ? (this.margin(product) / price) * 100 : 0;
  }

  isLowStock(product: ApiRecord): boolean {
    return Number(product.stock || 0) <= Number(product.lowStockThreshold || 0);
  }

  supplierName(product: ApiRecord): string {
    if (product.supplier) return product.supplier;
    const batch = this.batches().find((row) => row.productId === product.id && row.supplierId);
    return this.supplierNameFromId(batch?.supplierId || '');
  }

  supplierNameFromId(id: string): string {
    if (!id) return 'Not linked';
    return this.suppliers().find((supplier) => supplier.id === id)?.name || id;
  }

  branchName(id: string): string {
    return this.branches().find((branch) => branch.id === id)?.name || id || 'All branches';
  }

  nearestExpiry(productId: string): string {
    const expiry = this.batches()
      .filter((batch) => batch.productId === productId && Number(batch.quantityAvailable || 0) > 0 && batch.expiryDate)
      .map((batch) => String(batch.expiryDate))
      .sort()[0];
    return expiry || this.product()?.expiryDate || 'No expiry set';
  }

  productSaleUsage(productId: string): number {
    return Math.abs(this.transactions().filter((row) => row.productId === productId && String(row.type || '').includes('sale')).reduce((total, row) => total + Number(row.quantity || 0), 0));
  }

  productServiceUsage(productId: string): number {
    return Math.abs(this.transactions().filter((row) => row.productId === productId && String(row.type || '').includes('service')).reduce((total, row) => total + Number(row.quantity || 0), 0));
  }

  wasteUsage(productId: string): number {
    return Math.abs(this.transactions().filter((row) => {
      const text = `${row.type || ''} ${row.reason || ''}`.toLowerCase();
      return row.productId === productId && (text.includes('waste') || text.includes('expiry') || text.includes('damage'));
    }).reduce((total, row) => total + Number(row.quantity || 0), 0));
  }

  servicesUsingProduct(): ApiRecord[] {
    const product = this.product();
    if (!product) return [];
    return this.services().filter((service) => {
      const required = this.asArray(service.requiredProducts);
      return required.some((item) => item.productId === product.id || item.id === product.id);
    });
  }

  productSales(): ApiRecord[] {
    const product = this.product();
    if (!product) return [];
    return this.sales().filter((sale) => this.asArray(sale.items).some((item) => item.productId === product.id || item.id === product.id || item.name === product.name));
  }

  initials(value = ''): string {
    return String(value).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'P';
  }

  private asArray(value: unknown): ApiRecord[] {
    if (Array.isArray(value)) return value as ApiRecord[];
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private productKey(product: ApiRecord): string {
    return String(product.sku || product.name || '').toLowerCase().trim();
  }

  private daysUntil(value: string): number {
    const time = new Date(value).getTime();
    if (!value || Number.isNaN(time)) return 9999;
    return Math.round((time - Date.now()) / 86400000);
  }
}
