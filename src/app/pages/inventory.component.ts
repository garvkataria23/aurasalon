import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe, DatePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Products and inventory</span>
          <h2>Retail stock, professional stock, purchase entry and auto deduction</h2>
          <p>Product sales and completed services create inventory transactions automatically.</p>
        </div>
        <button class="primary-button" type="button" (click)="showProductForm.set(!showProductForm())">Add product</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <ng-container *ngIf="intelligence() as intelligence">
        <div class="metrics-grid">
          <article class="metric-card teal">
            <span>Stock value</span>
            <strong>{{ intelligence.metrics.stockValue | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>{{ intelligence.metrics.products }} products</small>
          </article>
          <article class="metric-card amber">
            <span>Reorder suggestions</span>
            <strong>{{ intelligence.metrics.reorderCount }}</strong>
            <small>AI purchase prediction</small>
          </article>
          <article class="metric-card red">
            <span>Expiring soon</span>
            <strong>{{ intelligence.metrics.expiringSoon }}</strong>
            <small>Batch expiry alerts</small>
          </article>
          <article class="metric-card blue">
            <span>Waste cost</span>
            <strong>{{ intelligence.metrics.wasteCost | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <small>Waste analysis</small>
          </article>
        </div>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Inventory intelligence</span>
              <h2>Purchase prediction and reorder insights</h2>
            </div>
            <button class="ghost-button" type="button" (click)="runReorder()">Generate reorder snapshot</button>
          </div>
          <div class="quick-grid">
            <article class="action-card" *ngFor="let insight of intelligence.insights">
              <strong>{{ insight }}</strong>
              <span>Calculated from stock, batches, usage and waste</span>
            </article>
          </div>
        </section>
      </ng-container>

      <section class="form-panel" *ngIf="showProductForm()">
        <form [formGroup]="productForm" (ngSubmit)="saveProduct()">
          <label class="field"><span>Name</span><input formControlName="name" /></label>
          <label class="field"><span>SKU</span><input formControlName="sku" /></label>
          <label class="field"><span>Category</span><input formControlName="category" /></label>
          <label class="field">
            <span>Usage type</span>
            <select formControlName="usageType">
              <option value="retail">Retail</option>
              <option value="internal">Professional/internal</option>
            </select>
          </label>
          <label class="field"><span>Supplier</span><input formControlName="supplier" /></label>
          <label class="field">
            <span>Branch</span>
            <select formControlName="branchId">
              <option value="">Select branch</option>
              <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option>
            </select>
          </label>
          <label class="field"><span>Stock</span><input type="number" formControlName="stock" /></label>
          <label class="field"><span>Low stock threshold</span><input type="number" formControlName="lowStockThreshold" /></label>
          <label class="field"><span>Expiry date</span><input type="date" formControlName="expiryDate" /></label>
          <label class="field"><span>Unit cost</span><input type="number" formControlName="unitCost" /></label>
          <label class="field"><span>Retail price</span><input type="number" formControlName="price" /></label>
          <label class="field"><span>GST rate</span><input type="number" formControlName="gstRate" /></label>
          <div class="form-actions">
            <button class="ghost-button" type="button" (click)="showProductForm.set(false)">Cancel</button>
            <button class="primary-button" type="submit" [disabled]="productForm.invalid || saving()">Save product</button>
          </div>
        </form>
      </section>

      <div class="dashboard-grid">
        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Alerts</span>
              <h2>Low stock and expiry</h2>
            </div>
          </div>
          <div class="alert-list">
            <article *ngFor="let product of lowStock()">
              <strong>{{ product.name }}</strong>
              <span>{{ product.stock }} left · threshold {{ product.lowStockThreshold }} · {{ product.branchId }}</span>
            </article>
            <article *ngFor="let product of expiring()">
              <strong>{{ product.name }}</strong>
              <span>Expires {{ product.expiryDate | date: 'mediumDate' }}</span>
            </article>
            <article *ngIf="!lowStock().length && !expiring().length">
              <strong>Inventory healthy</strong>
              <span>No active alerts.</span>
            </article>
          </div>
        </section>

        <section class="form-panel">
          <h3>Purchase entry / stock adjustment</h3>
          <form [formGroup]="adjustForm" (ngSubmit)="adjustStock()">
            <label class="field">
              <span>Product</span>
              <select formControlName="productId">
                <option value="">Select product</option>
                <option *ngFor="let product of products()" [value]="product.id">{{ product.name }} - {{ product.stock }} left</option>
              </select>
            </label>
            <label class="field">
              <span>Branch</span>
              <select formControlName="branchId">
                <option value="">Select branch</option>
                <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option>
              </select>
            </label>
            <label class="field">
              <span>Type</span>
              <select formControlName="type">
                <option value="purchase-entry">Purchase entry</option>
                <option value="adjustment">Stock adjustment</option>
                <option value="expiry-writeoff">Expiry write-off</option>
              </select>
            </label>
            <label class="field"><span>Quantity (+/-)</span><input type="number" formControlName="quantity" /></label>
            <label class="field full"><span>Reason</span><textarea formControlName="reason"></textarea></label>
            <div class="form-actions">
              <button class="primary-button" type="submit" [disabled]="adjustForm.invalid || saving()">Apply stock movement</button>
            </div>
          </form>
        </section>
      </div>

      <div class="dashboard-grid">
        <section class="form-panel">
          <h3>Supplier management</h3>
          <form [formGroup]="supplierForm" (ngSubmit)="saveSupplier()">
            <label class="field"><span>Name</span><input formControlName="name" /></label>
            <label class="field"><span>Contact</span><input formControlName="contactName" /></label>
            <label class="field"><span>Phone</span><input formControlName="phone" /></label>
            <label class="field"><span>Email</span><input type="email" formControlName="email" /></label>
            <label class="field"><span>GSTIN</span><input formControlName="gstin" /></label>
            <label class="field full"><span>Address</span><textarea formControlName="address"></textarea></label>
            <div class="form-actions">
              <button class="primary-button" type="submit" [disabled]="supplierForm.invalid || saving()">Save supplier</button>
            </div>
          </form>
        </section>

        <section class="form-panel">
          <h3>Batch purchase entry</h3>
          <form [formGroup]="purchaseForm" (ngSubmit)="purchaseEntry()">
            <label class="field">
              <span>Product</span>
              <select formControlName="productId">
                <option value="">Select product</option>
                <option *ngFor="let product of products()" [value]="product.id">{{ product.name }}</option>
              </select>
            </label>
            <label class="field">
              <span>Supplier</span>
              <select formControlName="supplierId">
                <option value="">No supplier</option>
                <option *ngFor="let supplier of suppliers()" [value]="supplier.id">{{ supplier.name }}</option>
              </select>
            </label>
            <label class="field">
              <span>Branch</span>
              <select formControlName="branchId">
                <option value="">Select branch</option>
                <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option>
              </select>
            </label>
            <label class="field"><span>Batch number</span><input formControlName="batchNumber" /></label>
            <label class="field"><span>Expiry date</span><input type="date" formControlName="expiryDate" /></label>
            <label class="field"><span>Quantity</span><input type="number" formControlName="quantity" /></label>
            <label class="field"><span>Unit cost</span><input type="number" formControlName="unitCost" /></label>
            <div class="form-actions">
              <button class="primary-button" type="submit" [disabled]="purchaseForm.invalid || saving()">Receive batch</button>
            </div>
          </form>
        </section>
      </div>

      <section class="form-panel">
        <h3>Waste / expiry tracking</h3>
        <form [formGroup]="wasteForm" (ngSubmit)="recordWaste()">
          <label class="field">
            <span>Product</span>
            <select formControlName="productId">
              <option value="">Select product</option>
              <option *ngFor="let product of products()" [value]="product.id">{{ product.name }}</option>
            </select>
          </label>
          <label class="field">
            <span>Batch</span>
            <select formControlName="batchId">
              <option value="">Auto / no batch</option>
              <option *ngFor="let batch of batchesForProduct(wasteForm.value.productId)" [value]="batch.id">{{ batch.batchNumber }} · {{ batch.quantityAvailable }} left</option>
            </select>
          </label>
          <label class="field">
            <span>Branch</span>
            <select formControlName="branchId">
              <option value="">Select branch</option>
              <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option>
            </select>
          </label>
          <label class="field"><span>Quantity</span><input type="number" formControlName="quantity" /></label>
          <label class="field">
            <span>Reason</span>
            <select formControlName="reason">
              <option value="expired">Expired</option>
              <option value="damaged">Damaged</option>
              <option value="spillage">Spillage</option>
              <option value="service overuse">Service overuse</option>
            </select>
          </label>
          <label class="field full"><span>Notes</span><textarea formControlName="notes"></textarea></label>
          <div class="form-actions">
            <button class="primary-button" type="submit" [disabled]="wasteForm.invalid || saving()">Record waste</button>
          </div>
        </form>
      </section>

      <ng-container *ngIf="intelligence() as intelligence">
        <div class="dashboard-grid">
          <section class="panel">
            <div class="section-title"><h2>AI reorder suggestions</h2></div>
            <div class="rank-list">
              <article *ngFor="let item of intelligence.suggestions">
                <div>
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.reason }} · {{ item.daysOfStock | number: '1.0-1' }} days of stock</span>
                </div>
                <div class="right">
                  <strong>{{ item.recommendedQty }} units</strong>
                  <small>{{ item.estimatedCost | currency: 'INR':'symbol':'1.0-0' }}</small>
                </div>
              </article>
            </div>
          </section>

          <section class="panel">
            <div class="section-title"><h2>Product usage tracking</h2></div>
            <div class="summary-lines">
              <div *ngFor="let item of intelligence.usage.slice(0, 6)">
                <span>{{ item.name }}</span>
                <strong>{{ item.totalUsage }} used · {{ item.averageDailyUsage | number: '1.0-2' }}/day</strong>
              </div>
            </div>
          </section>
        </div>

        <div class="dashboard-grid">
          <section class="panel">
            <div class="section-title"><h2>Batch expiry alerts</h2></div>
            <div class="activity-list">
              <article *ngFor="let batch of intelligence.expiringBatches">
                <strong>{{ batch.productName }} · {{ batch.batchNumber }}</strong>
                <span>{{ batch.quantityAvailable }} left · expires {{ batch.expiryDate | date: 'mediumDate' }} · {{ batch.daysToExpiry }} days</span>
              </article>
            </div>
          </section>

          <section class="panel">
            <div class="section-title"><h2>Supplier scorecards</h2></div>
            <div class="summary-lines">
              <div *ngFor="let supplier of intelligence.supplierScorecards">
                <span>{{ supplier.name }}</span>
                <strong>{{ supplier.reliabilityScore | number: '1.0-1' }} score · {{ supplier.batches }} batches</strong>
              </div>
            </div>
          </section>
        </div>
      </ng-container>

      <section class="panel">
        <div class="table-toolbar">
          <label class="search-field"><span>Search products</span><input [(ngModel)]="query" /></label>
          <button class="ghost-button" type="button" (click)="load()">Refresh</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Type</th>
                <th>Supplier</th>
                <th>Branch</th>
                <th>Stock</th>
                <th>Price</th>
                <th>Expiry</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let product of filteredProducts()">
                <td><strong>{{ product.name }}</strong><small>{{ product.sku }}</small></td>
                <td><span class="badge">{{ product.usageType }}</span></td>
                <td>{{ product.supplier }}</td>
                <td>{{ product.branchId }}</td>
                <td>{{ product.stock }}</td>
                <td>{{ product.price | currency: 'INR':'symbol':'1.0-0' }}</td>
                <td>{{ product.expiryDate | date: 'mediumDate' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="section-title"><h2>Recent inventory transactions</h2></div>
        <div class="activity-list">
          <article *ngFor="let transaction of transactions().slice(0, 10)">
            <strong>{{ productName(transaction.productId) }} · {{ transaction.type }}</strong>
            <span>{{ transaction.quantity }} units · {{ transaction.reason }} · {{ transaction.createdAt | date: 'short' }}</span>
          </article>
        </div>
      </section>
    </section>
  `
})
export class InventoryComponent implements OnInit {
  readonly products = signal<ApiRecord[]>([]);
  readonly transactions = signal<ApiRecord[]>([]);
  readonly branches = signal<ApiRecord[]>([]);
  readonly suppliers = signal<ApiRecord[]>([]);
  readonly batches = signal<ApiRecord[]>([]);
  readonly predictions = signal<ApiRecord[]>([]);
  readonly intelligence = signal<ApiRecord | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly showProductForm = signal(false);
  query = '';

  readonly productForm = this.fb.group({
    name: ['', Validators.required],
    sku: ['', Validators.required],
    category: [''],
    usageType: ['retail'],
    supplier: [''],
    branchId: ['', Validators.required],
    stock: [0],
    lowStockThreshold: [5],
    expiryDate: [''],
    unitCost: [0],
    price: [0],
    gstRate: [18]
  });

  readonly adjustForm = this.fb.group({
    productId: ['', Validators.required],
    branchId: ['', Validators.required],
    type: ['purchase-entry'],
    quantity: [1, Validators.required],
    reason: ['Purchase entry']
  });

  readonly supplierForm = this.fb.group({
    name: ['', Validators.required],
    contactName: [''],
    phone: [''],
    email: [''],
    gstin: [''],
    address: ['']
  });

  readonly purchaseForm = this.fb.group({
    productId: ['', Validators.required],
    supplierId: [''],
    branchId: ['', Validators.required],
    batchNumber: [`BATCH-${new Date().toISOString().slice(0, 10)}`],
    expiryDate: [''],
    quantity: [1, Validators.required],
    unitCost: [0]
  });

  readonly wasteForm = this.fb.group({
    productId: ['', Validators.required],
    batchId: [''],
    branchId: ['', Validators.required],
    quantity: [1, Validators.required],
    reason: ['expired', Validators.required],
    notes: ['']
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    Promise.all([
      this.api.list<ApiRecord[]>('products', { branchId: this.api.selectedBranchId() }).toPromise(),
      this.api.list<ApiRecord[]>('inventory', { branchId: this.api.selectedBranchId(), limit: 100 }).toPromise(),
      this.api.list<ApiRecord[]>('branches').toPromise(),
      this.api.list<ApiRecord[]>('suppliers').toPromise(),
      this.api.list<ApiRecord[]>('inventoryBatches', { branchId: this.api.selectedBranchId(), limit: 100 }).toPromise(),
      this.api.list<ApiRecord[]>('inventory-intelligence/predictions', { limit: 5 }).toPromise(),
      this.api.list<ApiRecord>('inventory-intelligence/summary', { branchId: this.api.selectedBranchId() }).toPromise()
    ])
      .then(([products, transactions, branches, suppliers, batches, predictions, intelligence]) => {
        this.products.set(products || []);
        this.transactions.set(transactions || []);
        this.branches.set(branches || []);
        this.suppliers.set(suppliers || []);
        this.batches.set(batches || []);
        this.predictions.set(predictions || []);
        this.intelligence.set(intelligence || null);
        this.loading.set(false);
      })
      .catch((error) => {
        this.error.set(error?.error?.error || 'Unable to load inventory');
        this.loading.set(false);
      });
  }

  saveProduct(): void {
    if (this.productForm.invalid) return;
    this.saving.set(true);
    this.api.create('products', this.productForm.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.showProductForm.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to save product');
        this.saving.set(false);
      }
    });
  }

  adjustStock(): void {
    if (this.adjustForm.invalid) return;
    this.saving.set(true);
    this.api.post('inventory/adjust', this.adjustForm.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to adjust stock');
        this.saving.set(false);
      }
    });
  }

  saveSupplier(): void {
    if (this.supplierForm.invalid) return;
    this.saving.set(true);
    this.api.post('inventory-intelligence/suppliers', this.supplierForm.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.supplierForm.reset({ name: '', contactName: '', phone: '', email: '', gstin: '', address: '' });
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to save supplier');
        this.saving.set(false);
      }
    });
  }

  purchaseEntry(): void {
    if (this.purchaseForm.invalid) return;
    this.saving.set(true);
    this.api.post('inventory-intelligence/purchase-entry', this.purchaseForm.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to receive batch');
        this.saving.set(false);
      }
    });
  }

  recordWaste(): void {
    if (this.wasteForm.invalid) return;
    this.saving.set(true);
    this.api.post('inventory-intelligence/waste', this.wasteForm.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to record waste');
        this.saving.set(false);
      }
    });
  }

  runReorder(): void {
    this.saving.set(true);
    this.api.post('inventory-intelligence/reorder-suggestions/run', { branchId: this.api.selectedBranchId() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to generate reorder suggestions');
        this.saving.set(false);
      }
    });
  }

  filteredProducts(): ApiRecord[] {
    return this.products().filter((product) => JSON.stringify(product).toLowerCase().includes(this.query.toLowerCase()));
  }

  lowStock(): ApiRecord[] {
    return this.products().filter((product) => Number(product.stock) <= Number(product.lowStockThreshold));
  }

  expiring(): ApiRecord[] {
    return this.products().filter((product) => product.expiryDate && product.expiryDate <= '2026-08-31');
  }

  productName(id: string): string {
    return this.products().find((product) => product.id === id)?.name || id;
  }

  batchesForProduct(productId: string): ApiRecord[] {
    return this.batches().filter((batch) => !productId || batch.productId === productId);
  }
}
