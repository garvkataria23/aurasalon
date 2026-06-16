import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiRecord, ApiService } from '../core/api.service';

interface ConsumeLine {
  productId: string;
  productName: string;
  unit: string;
  expectedQty: number;
  actualQty: number;
  wastagePct: number;
  minQty?: number;
  maxQty?: number;
  substitutes?: string;
  unitCost: number;
  expectedCost: number;
  actualCost: number;
}

interface ConsumeDraft extends ApiRecord {
  id: string;
  invoiceNumber: string;
  serviceName: string;
  clientName: string;
  staffName: string;
  status: string;
  expectedCost: number;
  actualCost: number;
  lineItems: ConsumeLine[];
  notes?: string;
}

interface ProductRow extends ApiRecord {
  id: string;
  name: string;
  unit?: string;
  unitCost?: number;
  stock?: number;
}

const RECIPE_UNITS = ['ml', 'gm', 'g', 'pcs', 'tube', 'pack', 'box', 'nos'];

@Component({
  selector: 'app-product-consume',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Inventory - service usage</span>
          <h1>Product Consume</h1>
          <p>POS invoice se auto draft aayega. Qty check karo, phir confirm par stock minus hoga.</p>
        </div>
        <div class="hero-actions">
          <a class="ghost" routerLink="/inventory/recipes">Service Recipes</a>
          <button type="button" class="primary" (click)="load()">Refresh</button>
        </div>
      </div>

      <div class="metric-grid">
        <article><span>Draft pending</span><strong>{{ draftCount() }}</strong><small>review before stock minus</small></article>
        <article><span>Confirmed</span><strong>{{ confirmedCount() }}</strong><small>stock ledger posted</small></article>
        <article><span>Expected cost</span><strong>{{ money(totalExpected()) }}</strong><small>recipe based</small></article>
        <article><span>Actual cost</span><strong>{{ money(totalActual()) }}</strong><small>edited consume value</small></article>
      </div>

      <div *ngIf="error()" class="alert">{{ error() }}</div>
      <div *ngIf="message()" class="success">{{ message() }}</div>

      <div class="workspace">
        <aside class="draft-list">
          <div class="list-head">
            <strong>Invoice drafts</strong>
            <select [ngModel]="statusFilter()" (ngModelChange)="setStatus($event)">
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="recipe_missing">Recipe missing</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
          <button
            type="button"
            class="draft-card"
            *ngFor="let draft of drafts()"
            [class.active]="draft.id === selectedId()"
            (click)="select(draft)"
          >
            <span class="badge" [class.done]="draft.status === 'confirmed'">{{ draft.status }}</span>
            <strong>{{ draft.invoiceNumber || draft.id }}</strong>
            <small>{{ draft.serviceName }} - {{ draft.clientName || 'Walk-in client' }}</small>
            <em>{{ money(draft.actualCost || draft.expectedCost) }}</em>
          </button>
          <p *ngIf="!loading() && !drafts().length" class="empty">No product consume draft found.</p>
          <p *ngIf="loading()" class="empty">Loading...</p>
        </aside>

        <section class="editor" *ngIf="selected() as draft; else noSelection">
          <div class="editor-head">
            <div>
              <span class="eyebrow">Consume draft</span>
              <h2>{{ draft.invoiceNumber }}</h2>
            </div>
            <span class="badge" [class.done]="draft.status === 'confirmed'">{{ draft.status }}</span>
          </div>

          <div class="info-grid">
            <label><span>Service</span><strong>{{ draft.serviceName }}</strong></label>
            <label><span>Client</span><strong>{{ draft.clientName || 'Walk-in client' }}</strong></label>
            <label><span>Staff</span><strong>{{ draft.staffName || 'Unassigned' }}</strong></label>
            <label><span>Cost</span><strong>{{ money(draft.actualCost || draft.expectedCost) }}</strong></label>
          </div>

          <div class="consume-table">
            <div class="row head">
              <span>Product</span><span>Auto qty / unit</span><span>Waste</span><span>Range</span><span>Substitutes</span><span>Cost</span>
            </div>
            <div class="row" *ngFor="let line of draft.lineItems; let i = index">
              <span><strong>{{ line.productName || line.productId }}</strong><small>{{ line.unitCost | number:'1.2-2' }} / {{ line.unit }}</small></span>
              <span class="qty-unit">
                <input type="number" min="0" step="0.01" [ngModel]="line.actualQty" (ngModelChange)="updateQty(i, $event)" [disabled]="draft.status === 'confirmed'">
                <select [ngModel]="line.unit" (ngModelChange)="updateLine(i, { unit: $event })" [disabled]="draft.status === 'confirmed'">
                  <option *ngFor="let unit of units" [value]="unit">{{ unit }}</option>
                </select>
              </span>
              <span><input type="number" min="0" step="0.01" [ngModel]="line.wastagePct || 0" (ngModelChange)="updateLine(i, { wastagePct: $event })" [disabled]="draft.status === 'confirmed'"></span>
              <span class="range-fields">
                <input type="number" min="0" step="0.01" placeholder="Min" [ngModel]="line.minQty || 0" (ngModelChange)="updateLine(i, { minQty: $event })" [disabled]="draft.status === 'confirmed'">
                <input type="number" min="0" step="0.01" placeholder="Max" [ngModel]="line.maxQty || 0" (ngModelChange)="updateLine(i, { maxQty: $event })" [disabled]="draft.status === 'confirmed'">
              </span>
              <span><input [ngModel]="line.substitutes || ''" (ngModelChange)="updateLine(i, { substitutes: $event })" placeholder="Alternate product ids/name" [disabled]="draft.status === 'confirmed'"></span>
              <span>{{ money(lineActualCost(line)) }}</span>
            </div>
          </div>

          <div class="manual-product-add" *ngIf="draft.status !== 'confirmed'">
            <label class="product-picker">
              <span>Product</span>
              <input [(ngModel)]="productQuery" (ngModelChange)="productForm.productId = ''; productPickerOpen = true" placeholder="Search product by name / SKU">
              <div class="product-results" *ngIf="productPickerOpen && filteredProducts().length">
                <button type="button" *ngFor="let product of filteredProducts()" (click)="selectProduct(product)">
                  <strong>{{ product.name }}</strong>
                  <small>Qty {{ product.stock || 0 }} {{ product.unit || product['stockUnit'] || 'pcs' }}</small>
                </button>
              </div>
              <small class="selected-stock" *ngIf="selectedProduct() as product">
                Available qty: {{ product.stock || 0 }} {{ product.unit || product['stockUnit'] || 'pcs' }}
              </small>
            </label>
            <label>
              <span>Auto qty</span>
              <input type="number" min="0" step="0.01" [(ngModel)]="productForm.qty">
            </label>
            <label>
              <span>Unit</span>
              <select [(ngModel)]="productForm.unit">
                <option *ngFor="let unit of units" [value]="unit">{{ unit }}</option>
              </select>
            </label>
            <label>
              <span>Waste</span>
              <input type="number" min="0" step="0.01" [(ngModel)]="productForm.wastagePct">
            </label>
            <label>
              <span>Min</span>
              <input type="number" min="0" step="0.01" [(ngModel)]="productForm.minQty">
            </label>
            <label>
              <span>Max</span>
              <input type="number" min="0" step="0.01" [(ngModel)]="productForm.maxQty">
            </label>
            <label>
              <span>Substitutes</span>
              <input [(ngModel)]="productForm.substitutes" placeholder="Alternate product ids/name">
            </label>
            <button type="button" class="ghost" (click)="addProductLine()">Add product</button>
          </div>

          <label class="notes">
            <span>Notes</span>
            <textarea rows="3" [ngModel]="draft.notes || ''" (ngModelChange)="updateNotes($event)" [disabled]="draft.status === 'confirmed'"></textarea>
          </label>

          <div class="action-row">
            <button type="button" class="ghost" (click)="saveDraft()" [disabled]="saving() || draft.status === 'confirmed'">Save draft</button>
            <button type="button" class="primary" (click)="confirmDraft()" [disabled]="saving() || draft.status !== 'draft' || !draft.lineItems.length">Confirm consume</button>
          </div>
        </section>
        <ng-template #noSelection>
          <section class="editor empty-editor">Select invoice draft to edit product consumption.</section>
        </ng-template>
      </div>
    </section>
  `,
  styles: [`
    .page-stack { display: grid; gap: 18px; }
    .module-hero, .workspace, .metric-grid article, .editor, .draft-list { background: rgba(255,255,255,.92); border: 1px solid #dcebea; box-shadow: 0 18px 45px rgba(15,23,42,.08); }
    .module-hero { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 24px; border-radius: 22px; }
    .module-hero h1, .editor h2 { margin: 4px 0; color: #111827; }
    .module-hero p { margin: 0; color: #64748b; }
    .eyebrow { color: #0f766e; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .hero-actions, .action-row { display: flex; gap: 10px; flex-wrap: wrap; }
    button, a.ghost { border: 1px solid #d7e6e4; border-radius: 14px; padding: 12px 16px; font-weight: 900; text-decoration: none; cursor: pointer; }
    .primary { background: #0f172a; color: white; }
    .ghost { background: white; color: #0f172a; }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric-grid article { border-radius: 18px; padding: 16px; display: grid; gap: 5px; }
    .metric-grid span, .info-grid span, .consume-table .head { color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .metric-grid strong { font-size: 24px; }
    .metric-grid small, .draft-card small, .consume-table small { color: #64748b; }
    .workspace { display: grid; grid-template-columns: 340px 1fr; border-radius: 22px; overflow: hidden; }
    .draft-list { border: 0; border-right: 1px solid #dcebea; box-shadow: none; padding: 14px; display: grid; gap: 10px; align-content: start; max-height: 72vh; overflow: auto; }
    .list-head, .editor-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
    select, input, textarea { width: 100%; border: 1px solid #d7e6e4; border-radius: 12px; padding: 10px; font: inherit; }
    .draft-card { text-align: left; background: white; display: grid; gap: 5px; }
    .draft-card.active { background: #e8f4f2; border-color: #14b8a6; }
    .badge { width: max-content; border-radius: 999px; padding: 5px 10px; background: #fff7ed; color: #9a3412; font-size: 12px; font-weight: 900; }
    .badge.done { background: #dcfce7; color: #166534; }
    .editor { border: 0; box-shadow: none; padding: 18px; display: grid; gap: 16px; }
    .info-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .info-grid label { border: 1px solid #dcebea; border-radius: 14px; padding: 12px; display: grid; gap: 6px; }
    .consume-table { border: 1px solid #dcebea; border-radius: 16px; overflow: auto; }
    .row { display: grid; grid-template-columns: 1.7fr 1.2fr .8fr 1.2fr 1.6fr .8fr; gap: 12px; align-items: center; padding: 12px; border-bottom: 1px solid #edf4f3; min-width: 980px; }
    .row:last-child { border-bottom: 0; }
    .qty-unit, .range-fields { display: grid; grid-template-columns: 1fr 86px; gap: 8px; }
    .range-fields { grid-template-columns: 1fr 1fr; }
    .notes { display: grid; gap: 8px; }
    .manual-product-add { display: grid; grid-template-columns: minmax(260px, 2fr) .7fr .7fr .7fr .7fr .7fr 1.2fr auto; gap: 10px; align-items: end; }
    .manual-product-add label { display: grid; gap: 6px; }
    .manual-product-add span { color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .product-picker { position: relative; }
    .product-results { position: absolute; left: 0; right: 0; top: 72px; z-index: 5; max-height: 260px; overflow: auto; background: white; border: 1px solid #cfe1df; border-radius: 14px; box-shadow: 0 18px 45px rgba(15,23,42,.18); padding: 6px; }
    .product-results button { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; text-align: left; padding: 10px 12px; border: 0; border-radius: 10px; background: white; }
    .product-results button:hover { background: #e8f4f2; }
    .product-results small, .selected-stock { color: #0f766e; font-weight: 900; }
    .alert, .success { border-radius: 14px; padding: 12px 16px; font-weight: 800; }
    .alert { background: #fee2e2; color: #991b1b; }
    .success { background: #dcfce7; color: #166534; }
    .empty, .empty-editor { color: #64748b; padding: 18px; }
    @media (max-width: 900px) {
      .module-hero, .workspace { display: grid; }
      .metric-grid, .info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .manual-product-add { grid-template-columns: 1fr; }
      .draft-list { border-right: 0; border-bottom: 1px solid #dcebea; max-height: 360px; }
    }
    @media (max-width: 560px) {
      .metric-grid, .info-grid { grid-template-columns: 1fr; }
      .module-hero { padding: 18px; }
    }
  `]
})
export class ProductConsumeComponent {
  private readonly api = inject(ApiService);

  readonly drafts = signal<ConsumeDraft[]>([]);
  readonly selectedId = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly statusFilter = signal('');
  readonly products = signal<ProductRow[]>([]);
  readonly units = RECIPE_UNITS;
  productForm = { productId: '', qty: 1, unit: 'pcs', wastagePct: 0, minQty: 0, maxQty: 0, substitutes: '' };
  productQuery = '';
  productPickerOpen = false;
  readonly selected = computed(() => this.drafts().find((draft) => draft.id === this.selectedId()) || null);
  readonly draftCount = computed(() => this.drafts().filter((draft) => draft.status !== 'confirmed').length);
  readonly confirmedCount = computed(() => this.drafts().filter((draft) => draft.status === 'confirmed').length);
  readonly totalExpected = computed(() => this.drafts().reduce((sum, draft) => sum + Number(draft.expectedCost || 0), 0));
  readonly totalActual = computed(() => this.drafts().reduce((sum, draft) => sum + Number(draft.actualCost || draft.expectedCost || 0), 0));

  constructor() {
    this.loadProducts();
    this.load();
  }

  loadProducts(): void {
    this.api.list<ProductRow[]>('products', { branchId: this.api.selectedBranchId(), limit: 10000 }).subscribe({
      next: (rows) => this.products.set(rows || []),
      error: () => this.products.set([])
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params: ApiRecord = { branchId: this.api.selectedBranchId(), limit: 250 };
    if (this.statusFilter()) params['status'] = this.statusFilter();
    this.api.list<ConsumeDraft[]>('inventory-intelligence/product-consume-drafts', params).subscribe({
      next: (rows) => {
        const normalized = (rows || []).map((row) => ({ ...row, lineItems: row.lineItems || [] }));
        this.drafts.set(normalized);
        if (!normalized.some((row) => row.id === this.selectedId())) this.selectedId.set(normalized[0]?.id || '');
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || err?.message || 'Product consume drafts load nahi huye.');
        this.loading.set(false);
      }
    });
  }

  setStatus(status: string): void {
    this.statusFilter.set(status);
    this.load();
  }

  select(draft: ConsumeDraft): void {
    this.selectedId.set(draft.id);
  }

  updateQty(index: number, value: string | number): void {
    this.patchSelected((draft) => {
      const lineItems = [...draft.lineItems];
      const line = { ...lineItems[index], actualQty: Number(value || 0) };
      line.actualCost = this.lineActualCost(line);
      lineItems[index] = line;
      return { ...draft, lineItems, actualCost: lineItems.reduce((sum, item) => sum + this.lineActualCost(item), 0) };
    });
  }

  updateNotes(notes: string): void {
    this.patchSelected((draft) => ({ ...draft, notes }));
  }

  fillProductDefaults(): void {
    const product = this.products().find((row) => row.id === this.productForm.productId);
    this.productForm.unit = String(product?.unit || product?.['stockUnit'] || this.productForm.unit || 'pcs');
    if (!this.productForm.qty) this.productForm.qty = 1;
  }

  selectedProduct(): ProductRow | null {
    return this.products().find((row) => row.id === this.productForm.productId) || null;
  }

  filteredProducts(): ProductRow[] {
    const query = this.productQuery.trim().toLowerCase();
    const rows = this.products().filter((product) => {
      const text = `${product.name || ''} ${product['sku'] || ''} ${product['category'] || ''}`.toLowerCase();
      return !query || text.includes(query);
    });
    return rows.slice(0, 12);
  }

  selectProduct(product: ProductRow): void {
    this.productForm.productId = product.id;
    this.productQuery = product.name;
    this.productPickerOpen = false;
    this.fillProductDefaults();
  }

  updateLine(index: number, patch: Partial<ConsumeLine>): void {
    this.patchSelected((draft) => {
      const lineItems = [...draft.lineItems];
      const line = { ...lineItems[index], ...patch };
      line.actualQty = Number(line.actualQty || 0);
      line.wastagePct = Number(line.wastagePct || 0);
      line.minQty = Number(line.minQty || 0);
      line.maxQty = Number(line.maxQty || 0);
      line.actualCost = this.lineActualCost(line);
      lineItems[index] = line;
      return { ...draft, lineItems, actualCost: lineItems.reduce((sum, item) => sum + this.lineActualCost(item), 0) };
    });
  }

  addProductLine(): void {
    const product = this.products().find((row) => row.id === this.productForm.productId);
    const qty = Number(this.productForm.qty || 0);
    if (!product || qty <= 0) {
      this.error.set('Product select karo aur qty 0 se zyada rakho.');
      return;
    }
    const unitCost = Number(product.unitCost || product['costPrice'] || product['purchasePrice'] || 0);
    const line: ConsumeLine = {
      productId: product.id,
      productName: product.name,
      unit: String(this.productForm.unit || product.unit || product['stockUnit'] || product['unitName'] || 'pcs'),
      expectedQty: qty,
      actualQty: qty,
      wastagePct: Number(this.productForm.wastagePct || 0),
      minQty: Number(this.productForm.minQty || 0),
      maxQty: Number(this.productForm.maxQty || 0),
      substitutes: this.productForm.substitutes || '',
      unitCost,
      expectedCost: Math.round(qty * unitCost * 100) / 100,
      actualCost: Math.round(qty * unitCost * 100) / 100
    };
    this.patchSelected((draft) => {
      const lineItems = [...draft.lineItems, line];
      return {
        ...draft,
        status: draft.status === 'recipe_missing' ? 'draft' : draft.status,
        lineItems,
        expectedCost: lineItems.reduce((sum, item) => sum + Number(item.expectedCost || 0), 0),
        actualCost: lineItems.reduce((sum, item) => sum + this.lineActualCost(item), 0),
        notes: draft.notes || 'Manual product consume added from invoice draft.'
      };
    });
    this.productForm = { productId: '', qty: 1, unit: 'pcs', wastagePct: 0, minQty: 0, maxQty: 0, substitutes: '' };
    this.message.set('Product line added. Save draft ya Confirm consume karo.');
  }

  saveDraft(): void {
    const draft = this.selected();
    if (!draft) return;
    this.persist('Draft saved.', this.api.update<ConsumeDraft>('inventory-intelligence/product-consume-drafts', draft.id, {
      lineItems: draft.lineItems,
      notes: draft.notes || ''
    }));
  }

  confirmDraft(): void {
    const draft = this.selected();
    if (!draft) return;
    this.persist('Product consume confirmed. Stock ledger updated.', this.api.post<{ draft: ConsumeDraft }>(`inventory-intelligence/product-consume-drafts/${draft.id}/confirm`, {
      lineItems: draft.lineItems,
      notes: draft.notes || ''
    }), true);
  }

  lineActualCost(line: ConsumeLine): number {
    return Math.round(Number(line.actualQty || 0) * Number(line.unitCost || 0) * 100) / 100;
  }

  money(value: number | string | undefined): string {
    return `₹${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
  }

  private persist(successMessage: string, request: any, unwrap = false): void {
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    request.subscribe({
      next: (response: ConsumeDraft | { draft: ConsumeDraft }) => {
        const updated = unwrap ? (response as { draft: ConsumeDraft }).draft : response as ConsumeDraft;
        this.replaceDraft({ ...updated, lineItems: updated.lineItems || [] });
        this.message.set(successMessage);
        this.saving.set(false);
      },
      error: (err: any) => {
        this.error.set(err?.error?.error || err?.message || 'Product consume save nahi hua.');
        this.saving.set(false);
      }
    });
  }

  private patchSelected(mutator: (draft: ConsumeDraft) => ConsumeDraft): void {
    const id = this.selectedId();
    this.drafts.update((rows) => rows.map((row) => row.id === id ? mutator(row) : row));
  }

  private replaceDraft(updated: ConsumeDraft): void {
    this.drafts.update((rows) => rows.map((row) => row.id === updated.id ? updated : row));
  }
}
