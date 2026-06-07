import { CommonModule, TitleCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

interface InventoryKpiData {
  products: ApiRecord[];
  transactions: ApiRecord[];
  batches: ApiRecord[];
  suppliers: ApiRecord[];
  intelligence: ApiRecord | null;
}

interface KpiStat {
  label: string;
  value: string;
  hint: string;
}

interface KpiRow {
  title: string;
  meta: string;
  value: string;
  status: string;
}

@Component({
  selector: 'app-kpi-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, TitleCasePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero kpi-hero">
        <div>
          <span class="eyebrow">KPI details · {{ moduleName() | titlecase }}</span>
          <h2>{{ kpiTitle() }}</h2>
          <p>{{ kpiDescription() }}</p>
        </div>
        <a class="ghost-button" [routerLink]="backRoute()">Back to module</a>
      </div>

      <ng-container *ngIf="isInventory(); else genericDetail">
        <app-state [loading]="loading()" [error]="error()"></app-state>

        <section class="panel kpi-summary-panel" *ngIf="!loading()">
          <div class="kpi-summary-strip">
            <article *ngFor="let stat of inventoryStats()">
              <span>{{ stat.label }}</span>
              <strong>{{ stat.value }}</strong>
              <small>{{ stat.hint }}</small>
            </article>
          </div>
        </section>

        <section class="panel" *ngIf="!loading()">
          <div class="section-title">
            <div>
              <span class="eyebrow">Inventory drill-down</span>
              <h3>{{ inventoryPanelTitle() }}</h3>
            </div>
            <small>{{ inventoryRows().length }} rows</small>
          </div>
          <div class="kpi-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Context</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of inventoryRows()">
                  <td><strong>{{ row.title }}</strong></td>
                  <td>{{ row.meta }}</td>
                  <td>{{ row.value }}</td>
                  <td><span class="badge">{{ row.status }}</span></td>
                </tr>
                <tr *ngIf="!inventoryRows().length">
                  <td colspan="4">
                    <div class="empty-state">
                      <strong>No rows for this KPI</strong>
                      <span>Inventory records will appear here once stock activity is saved.</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </ng-container>

      <ng-template #genericDetail>
        <section class="panel">
          <div class="section-title">
            <h3>Current KPI value summary</h3>
          </div>
          <div class="empty-state">
            <strong>{{ kpiTitle() }}</strong>
            <span>Detailed breakdown coming soon</span>
          </div>
        </section>
      </ng-template>
    </section>
  `,
  styles: [`
    .kpi-hero {
      min-height: auto;
      padding: 18px 20px;
    }

    .kpi-hero h2 {
      font-size: 1.45rem;
      line-height: 1.2;
      margin-bottom: 4px;
    }

    .kpi-summary-panel {
      padding: 0;
      overflow: hidden;
    }

    .kpi-summary-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      min-height: 82px;
    }

    .kpi-summary-strip article {
      display: grid;
      align-content: center;
      gap: 3px;
      padding: 14px 18px;
      border-right: 1px solid var(--line);
    }

    .kpi-summary-strip article:last-child {
      border-right: 0;
    }

    .kpi-summary-strip span {
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .kpi-summary-strip strong {
      font-size: 1.45rem;
      line-height: 1.1;
    }

    .kpi-summary-strip small {
      color: var(--muted);
    }

    .kpi-table-wrap {
      max-height: calc(100vh - 330px);
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 10px;
    }

    .kpi-table-wrap table {
      width: 100%;
      min-width: 780px;
      border-collapse: collapse;
    }

    .kpi-table-wrap th,
    .kpi-table-wrap td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      text-align: left;
    }

    .kpi-table-wrap th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: #f6f8f8;
      color: var(--muted);
      font-size: 0.72rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .badge {
      display: inline-flex;
      border-radius: 999px;
      background: #eef3f2;
      color: var(--teal-2);
      padding: 3px 9px;
      font-size: 0.72rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    @media (max-width: 900px) {
      .kpi-summary-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .kpi-summary-strip {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class KpiDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  readonly moduleName = computed(() => this.route.snapshot.paramMap.get('module') || 'dashboard');
  readonly kpiKey = computed(() => this.route.snapshot.paramMap.get('kpiKey') || 'kpi');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly inventoryData = signal<InventoryKpiData>({
    products: [],
    transactions: [],
    batches: [],
    suppliers: [],
    intelligence: null
  });

  readonly kpiTitle = computed(() => this.toTitle(this.kpiKey()));
  readonly backRoute = computed(() => this.moduleRoute(this.moduleName()));

  ngOnInit(): void {
    if (this.isInventory()) {
      this.loadInventory();
    }
  }

  isInventory(): boolean {
    return this.moduleName() === 'inventory';
  }

  kpiDescription(): string {
    if (!this.isInventory()) return 'Route-based KPI detail screen for focused analytics and drill-down reporting.';
    const descriptions: Record<string, string> = {
      'stock-value': 'Live value of retail and professional stock with product-level breakdown.',
      'reorder-suggestions': 'Purchase prediction based on current stock, usage, batches and reorder thresholds.',
      'expiring-soon': 'Batch and product expiry risk, designed for action before stock becomes waste.',
      'waste-cost': 'Waste and expiry impact from saved inventory movements and intelligence metrics.'
    };
    return descriptions[this.kpiKey()] || 'Inventory KPI detail calculated from saved salon stock records.';
  }

  inventoryPanelTitle(): string {
    const titles: Record<string, string> = {
      'stock-value': 'Stock value by product',
      'reorder-suggestions': 'AI reorder suggestions',
      'expiring-soon': 'Expiry and batch alerts',
      'waste-cost': 'Waste and write-off movements'
    };
    return titles[this.kpiKey()] || 'Inventory records';
  }

  inventoryStats(): KpiStat[] {
    const data = this.inventoryData();
    const intelligence = data.intelligence || {};
    const metrics = intelligence['metrics'] || {};
    const lowStock = data.products.filter((product) => Number(product.stock) <= Number(product.lowStockThreshold));
    const expiring = this.expiringProducts();
    const stockValue = Number(metrics['stockValue'] || data.products.reduce((sum, product) => sum + this.productValue(product), 0));
    const suggestions = (intelligence['suggestions'] || []) as ApiRecord[];
    const estimatedCost = suggestions.reduce((sum, item) => sum + Number(item['estimatedCost'] || 0), 0);

    if (this.kpiKey() === 'reorder-suggestions') {
      return [
        { label: 'Suggestions', value: String(metrics['reorderCount'] || suggestions.length), hint: 'Products to reorder' },
        { label: 'Estimated cost', value: this.money(estimatedCost), hint: 'Recommended purchase value' },
        { label: 'Low stock', value: String(lowStock.length), hint: 'Below threshold' },
        { label: 'Products', value: String(data.products.length), hint: 'Inventory base' }
      ];
    }

    if (this.kpiKey() === 'expiring-soon') {
      return [
        { label: 'Expiring soon', value: String(metrics['expiringSoon'] || expiring.length), hint: 'Batches/products at risk' },
        { label: 'Low stock', value: String(lowStock.length), hint: 'Needs purchase planning' },
        { label: 'Batches', value: String(data.batches.length), hint: 'Tracked purchase batches' },
        { label: 'Waste cost', value: this.money(Number(metrics['wasteCost'] || 0)), hint: 'Current waste exposure' }
      ];
    }

    if (this.kpiKey() === 'waste-cost') {
      return [
        { label: 'Waste cost', value: this.money(Number(metrics['wasteCost'] || 0)), hint: 'Recorded waste impact' },
        { label: 'Waste rows', value: String(this.wasteTransactions().length), hint: 'Write-off movements' },
        { label: 'Expiring soon', value: String(metrics['expiringSoon'] || expiring.length), hint: 'Future waste risk' },
        { label: 'Stock value', value: this.money(stockValue), hint: 'Current inventory value' }
      ];
    }

    return [
      { label: 'Stock value', value: this.money(stockValue), hint: 'Unit cost × stock' },
      { label: 'Products', value: String(metrics['products'] || data.products.length), hint: 'Saved inventory items' },
      { label: 'Low stock', value: String(lowStock.length), hint: 'Below threshold' },
      { label: 'Expiring soon', value: String(metrics['expiringSoon'] || expiring.length), hint: 'Expiry risk' }
    ];
  }

  inventoryRows(): KpiRow[] {
    const data = this.inventoryData();
    const intelligence = data.intelligence || {};
    const key = this.kpiKey();

    if (key === 'reorder-suggestions') {
      return ((intelligence['suggestions'] || []) as ApiRecord[]).map((item) => ({
        title: String(item['name'] || 'Product'),
        meta: `${item['reason'] || 'Reorder threshold reached'} · ${Number(item['daysOfStock'] || 0).toFixed(1)} days of stock`,
        value: `${Number(item['recommendedQty'] || 0)} units · ${this.money(Number(item['estimatedCost'] || 0))}`,
        status: 'reorder'
      }));
    }

    if (key === 'expiring-soon') {
      const batchRows = ((intelligence['expiringBatches'] || []) as ApiRecord[]).map((batch) => ({
        title: `${batch['productName'] || 'Product'} · ${batch['batchNumber'] || 'Batch'}`,
        meta: `${batch['quantityAvailable'] || 0} left · expires ${this.dateText(batch['expiryDate'])}`,
        value: `${batch['daysToExpiry'] || 0} days`,
        status: 'expiry risk'
      }));
      const productRows = this.expiringProducts().map((product) => ({
        title: String(product.name || 'Product'),
        meta: `${product.stock || 0} left · ${product.branchId || 'all branches'}`,
        value: this.dateText(product.expiryDate),
        status: 'expiry'
      }));
      return [...batchRows, ...productRows];
    }

    if (key === 'waste-cost') {
      return this.wasteTransactions().map((transaction) => ({
        title: `${this.productName(transaction.productId)} · ${transaction.type || 'movement'}`,
        meta: `${transaction.quantity || 0} units · ${transaction.reason || 'No reason'} · ${this.dateText(transaction.createdAt)}`,
        value: this.money(Math.abs(Number(transaction.quantity || 0)) * this.productUnitCost(transaction.productId)),
        status: 'waste'
      }));
    }

    return data.products
      .slice()
      .sort((a, b) => this.productValue(b) - this.productValue(a))
      .map((product) => ({
        title: String(product.name || 'Product'),
        meta: `${product.sku || 'No SKU'} · ${product.branchId || 'all branches'} · ${product.usageType || 'retail'}`,
        value: this.money(this.productValue(product)),
        status: Number(product.stock) <= Number(product.lowStockThreshold) ? 'low stock' : 'healthy'
      }));
  }

  private loadInventory(): void {
    this.loading.set(true);
    this.error.set('');
    Promise.all([
      firstValueFrom(this.api.list<ApiRecord[]>('products', { branchId: this.api.selectedBranchId() })),
      firstValueFrom(this.api.list<ApiRecord[]>('inventory', { branchId: this.api.selectedBranchId(), limit: 100 })),
      firstValueFrom(this.api.list<ApiRecord[]>('inventoryBatches', { branchId: this.api.selectedBranchId(), limit: 100 })),
      firstValueFrom(this.api.list<ApiRecord[]>('suppliers')),
      firstValueFrom(this.api.list<ApiRecord>('inventory-intelligence/summary', { branchId: this.api.selectedBranchId() }))
    ])
      .then(([products, transactions, batches, suppliers, intelligence]) => {
        this.inventoryData.set({
          products: products || [],
          transactions: transactions || [],
          batches: batches || [],
          suppliers: suppliers || [],
          intelligence: intelligence || null
        });
        this.loading.set(false);
      })
      .catch((error) => {
        this.error.set(error?.error?.error || error?.message || 'Unable to load KPI details');
        this.loading.set(false);
      });
  }

  private expiringProducts(): ApiRecord[] {
    return this.inventoryData().products.filter((product) => product.expiryDate && product.expiryDate <= '2026-08-31');
  }

  private wasteTransactions(): ApiRecord[] {
    return this.inventoryData().transactions.filter((transaction) => {
      const text = JSON.stringify(transaction).toLowerCase();
      return text.includes('waste') || text.includes('expiry') || text.includes('writeoff') || text.includes('damaged') || text.includes('spillage');
    });
  }

  private productName(id: string): string {
    return this.inventoryData().products.find((product) => product.id === id)?.name || id || 'Product';
  }

  private productUnitCost(id: string): number {
    return Number(this.inventoryData().products.find((product) => product.id === id)?.unitCost || 0);
  }

  private productValue(product: ApiRecord): number {
    return Number(product.stock || 0) * Number(product.unitCost || product.price || 0);
  }

  private money(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  private dateText(value: unknown): string {
    if (!value) return 'No date';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private toTitle(value: string): string {
    return value
      .split('-')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private moduleRoute(moduleName: string): string {
    const routes: Record<string, string> = {
      analytics: '/analytics',
      'ai-marketing': '/ai-marketing',
      'booking-portal': '/book',
      compliance: '/compliance',
      'customer-360': '/customer-360',
      dashboard: '/dashboard',
      deployment: '/deployment',
      finance: '/finance',
      'future-features': '/future-features',
      inventory: '/inventory',
      offline: '/offline',
      prd: '/prd',
      quality: '/quality',
      reports: '/reports',
      'saas-onboarding': '/saas-onboarding',
      security: '/security',
      'smart-booking': '/smart-booking',
      staff: '/staff',
      'super-admin': '/super-admin',
      whatsapp: '/whatsapp',
      'white-label': '/white-label',
      workflow: '/workflows'
    };

    return routes[moduleName] || '/dashboard';
  }
}
