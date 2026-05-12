import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

type SaleItem = {
  type: 'service' | 'product' | 'custom';
  id: string;
  name: string;
  quantity: number;
  price: number;
  gstRate: number;
};

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">POS / GST billing</span>
          <h2>Fast checkout for services, products, UPI and split payments</h2>
          <p>Checkout saves a sale, invoice and payments, then updates stock, client history, loyalty and commission.</p>
        </div>
        <button class="ghost-button" type="button" (click)="printInvoice()" [disabled]="!invoice()">Print invoice</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="pos-layout" *ngIf="!loading()">
        <section class="panel">
          <form [formGroup]="form" class="pos-form">
            <label class="field">
              <span>Client</span>
              <select formControlName="clientId">
                <option value="">Select client</option>
                <option *ngFor="let client of clients()" [value]="client.id">{{ client.name }} - {{ client.phone }}</option>
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
              <span>Staff</span>
              <select formControlName="staffId">
                <option value="">Select staff</option>
                <option *ngFor="let person of staff()" [value]="person.id">{{ person.name }}</option>
              </select>
            </label>
            <label class="field">
              <span>Completed appointment</span>
              <select formControlName="appointmentId">
                <option value="">Walk-in / no appointment</option>
                <option *ngFor="let appointment of billableAppointments()" [value]="appointment.id">
                  {{ clientName(appointment.clientId) }} · {{ appointment.startAt | date: 'short' }}
                </option>
              </select>
            </label>
          </form>

          <div class="catalog-picker">
            <label class="field">
              <span>Add service</span>
              <select #serviceSelect>
                <option value="">Choose service</option>
                <option *ngFor="let service of services()" [value]="service.id">{{ service.name }} - ₹{{ service.price }}</option>
              </select>
            </label>
            <button class="ghost-button" type="button" (click)="addService(serviceSelect.value); serviceSelect.value = ''">Add</button>
            <label class="field">
              <span>Add product</span>
              <select #productSelect>
                <option value="">Choose product</option>
                <option *ngFor="let product of products()" [value]="product.id">{{ product.name }} - ₹{{ product.price }} ({{ product.stock }} left)</option>
              </select>
            </label>
            <button class="ghost-button" type="button" (click)="addProduct(productSelect.value); productSelect.value = ''">Add</button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>GST</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of items(); let index = index">
                  <td>{{ item.name }}</td>
                  <td><input class="small-input" type="number" min="1" [(ngModel)]="item.quantity" (ngModelChange)="touchItems()" /></td>
                  <td><input class="small-input" type="number" min="0" [(ngModel)]="item.price" (ngModelChange)="touchItems()" /></td>
                  <td>{{ item.gstRate }}%</td>
                  <td>{{ lineTotal(item) | currency: 'INR':'symbol':'1.0-0' }}</td>
                  <td><button class="ghost-button mini" type="button" (click)="removeItem(index)">Remove</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <aside class="panel checkout-panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Invoice summary</span>
              <h2>GST and payment</h2>
            </div>
          </div>
          <label class="field">
            <span>Discount</span>
            <input type="number" min="0" [(ngModel)]="discount" />
          </label>
          <div class="coupon-row">
            <label class="field">
              <span>Coupon code</span>
              <input type="text" [(ngModel)]="couponCode" (ngModelChange)="clearCoupon()" placeholder="GLOW10" />
            </label>
            <button class="ghost-button" type="button" (click)="validateCoupon()" [disabled]="couponChecking() || !couponCode || !items().length || !form.value.branchId">
              {{ couponChecking() ? 'Checking...' : 'Apply' }}
            </button>
          </div>
          <p class="inline-hint" *ngIf="couponMessage()">{{ couponMessage() }}</p>
          <label class="field">
            <span>Membership credits to redeem</span>
            <input type="number" min="0" [(ngModel)]="creditsUsed" />
          </label>
          <label class="field">
            <span>Membership</span>
            <select [(ngModel)]="membershipId">
              <option value="">No redemption</option>
              <option *ngFor="let membership of memberships()" [value]="membership.id">{{ membership.planName }} - {{ membership.creditsRemaining }} credits</option>
            </select>
          </label>

          <div class="summary-lines">
            <div><span>Subtotal</span><strong>{{ subtotal | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            <div><span>Manual discount</span><strong>{{ discount | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            <div><span>Coupon discount</span><strong>{{ couponDiscount | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            <div><span>GST</span><strong>{{ gst | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
            <div class="total"><span>Total</span><strong>{{ total | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
          </div>

          <div class="payment-grid">
            <label class="field"><span>Cash</span><input type="number" min="0" [(ngModel)]="payments.cash" /></label>
            <label class="field"><span>UPI</span><input type="number" min="0" [(ngModel)]="payments.upi" /></label>
            <label class="field"><span>Card</span><input type="number" min="0" [(ngModel)]="payments.card" /></label>
            <label class="field"><span>Wallet</span><input type="number" min="0" [(ngModel)]="payments.wallet" /></label>
          </div>
          <p class="inline-hint" *ngIf="selectedClient() as client">Wallet balance: {{ Number(client.walletBalance || 0) | currency: 'INR':'symbol':'1.0-0' }}</p>

          <button class="primary-button full-button" type="button" (click)="checkout()" [disabled]="saving() || !items().length || form.invalid">
            {{ saving() ? 'Saving sale...' : 'Save sale and invoice' }}
          </button>

          <section class="invoice-preview" *ngIf="invoice() as invoice">
            <span class="eyebrow">Invoice generated</span>
            <h3>{{ invoice.invoiceNumber }}</h3>
            <p>Status: <strong>{{ invoice.status }}</strong></p>
            <button class="ghost-button" type="button" (click)="downloadInvoice()">Download invoice</button>
          </section>
        </aside>
      </div>
    </section>
  `
})
export class PosComponent implements OnInit {
  readonly clients = signal<ApiRecord[]>([]);
  readonly staff = signal<ApiRecord[]>([]);
  readonly services = signal<ApiRecord[]>([]);
  readonly products = signal<ApiRecord[]>([]);
  readonly branches = signal<ApiRecord[]>([]);
  readonly appointments = signal<ApiRecord[]>([]);
  readonly memberships = signal<ApiRecord[]>([]);
  readonly items = signal<SaleItem[]>([]);
  readonly invoice = signal<ApiRecord | null>(null);
  readonly couponResult = signal<ApiRecord | null>(null);
  readonly couponMessage = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly couponChecking = signal(false);
  readonly error = signal('');
  discount = 0;
  couponCode = '';
  creditsUsed = 0;
  membershipId = '';
  payments = { cash: 0, upi: 0, card: 0, wallet: 0 };
  readonly Number = Number;

  readonly form = this.fb.group({
    clientId: ['', Validators.required],
    branchId: ['', Validators.required],
    staffId: [''],
    appointmentId: ['']
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  get subtotal(): number {
    return this.items().reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  }

  get gst(): number {
    const afterDiscountRatio = this.subtotal ? Math.max(0, this.subtotal - this.totalDiscount) / this.subtotal : 0;
    return this.items().reduce((sum, item) => sum + Number(item.price) * Number(item.quantity) * afterDiscountRatio * (Number(item.gstRate) / 100), 0);
  }

  get total(): number {
    return Math.max(0, this.subtotal - this.totalDiscount) + this.gst;
  }

  get couponDiscount(): number {
    return Number(this.couponResult()?.discountAmount || 0);
  }

  get totalDiscount(): number {
    return Math.min(this.subtotal, Number(this.discount || 0) + this.couponDiscount);
  }

  load(): void {
    this.loading.set(true);
    Promise.all([
      this.api.list<ApiRecord[]>('clients').toPromise(),
      this.api.list<ApiRecord[]>('staff').toPromise(),
      this.api.list<ApiRecord[]>('services').toPromise(),
      this.api.list<ApiRecord[]>('products').toPromise(),
      this.api.list<ApiRecord[]>('branches').toPromise(),
      this.api.list<ApiRecord[]>('appointments').toPromise(),
      this.api.list<ApiRecord[]>('memberships').toPromise()
    ])
      .then(([clients, staff, services, products, branches, appointments, memberships]) => {
        this.clients.set(clients || []);
        this.staff.set(staff || []);
        this.services.set(services || []);
        this.products.set(products || []);
        this.branches.set(branches || []);
        this.appointments.set(appointments || []);
        this.memberships.set(memberships || []);
        this.loading.set(false);
      })
      .catch((error) => {
        this.error.set(error?.error?.error || 'Unable to load POS data');
        this.loading.set(false);
      });
  }

  billableAppointments(): ApiRecord[] {
    const clientId = this.form.value.clientId;
    return this.appointments().filter((appointment) => appointment.status === 'completed' && (!clientId || appointment.clientId === clientId));
  }

  addService(id: string): void {
    const service = this.services().find((item) => item.id === id);
    if (!service) return;
    this.items.update((items) => [...items, { type: 'service', id: service.id, name: service.name, quantity: 1, price: Number(service.price), gstRate: Number(service.gstRate || 18) }]);
    this.clearCoupon();
  }

  addProduct(id: string): void {
    const product = this.products().find((item) => item.id === id);
    if (!product) return;
    this.items.update((items) => [...items, { type: 'product', id: product.id, name: product.name, quantity: 1, price: Number(product.price), gstRate: Number(product.gstRate || 18) }]);
    this.clearCoupon();
  }

  removeItem(index: number): void {
    this.items.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
    this.clearCoupon();
  }

  touchItems(): void {
    this.items.set([...this.items()]);
    this.clearCoupon();
  }

  lineTotal(item: SaleItem): number {
    return Number(item.price) * Number(item.quantity);
  }

  selectedClient(): ApiRecord | undefined {
    return this.clients().find((client) => client.id === this.form.value.clientId);
  }

  clearCoupon(): void {
    this.couponResult.set(null);
    this.couponMessage.set('');
  }

  validateCoupon(): void {
    const code = this.couponCode.trim();
    if (!code || !this.items().length) return;
    this.couponChecking.set(true);
    this.couponMessage.set('');
    this.api.post<ApiRecord>('sales/coupons/validate', {
      code,
      branchId: this.form.value.branchId || '',
      items: this.items(),
      subtotal: this.subtotal
    }).subscribe({
      next: (result) => {
        this.couponResult.set(result);
        this.couponMessage.set(`Applied ${result.coupon?.code || code}: ${result.discountAmount || 0} discount`);
        this.couponChecking.set(false);
      },
      error: (error) => {
        this.couponResult.set(null);
        this.couponMessage.set(error?.error?.error || 'Coupon could not be applied');
        this.couponChecking.set(false);
      }
    });
  }

  checkout(): void {
    if (this.form.invalid || !this.items().length) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const splitPayments = Object.entries(this.payments)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([mode, amount]) => ({ mode, amount: Number(amount), reference: mode === 'upi' ? 'UPI collected at counter' : '' }));
    this.api.post<{ sale: ApiRecord; invoice: ApiRecord; coupon?: ApiRecord | null; invoiceDocument?: ApiRecord }>('sales/checkout', {
      ...this.form.value,
      items: this.items(),
      discount: Number(this.discount || 0),
      couponCode: this.couponCode.trim(),
      payments: splitPayments,
      membershipRedeem: this.membershipId ? { membershipId: this.membershipId, creditsUsed: Number(this.creditsUsed || 0) } : {}
    }).subscribe({
      next: (result) => {
        this.invoice.set(result.invoice);
        this.couponResult.set(result.coupon || null);
        this.items.set([]);
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to save sale');
        this.saving.set(false);
      }
    });
  }

  printInvoice(): void {
    window.print();
  }

  downloadInvoice(): void {
    const invoice = this.invoice();
    if (!invoice) return;
    this.api.post<ApiRecord>(`invoices/${invoice.id}/document`, {}).subscribe({
      next: (documentRecord) => {
        const blob = new Blob([String(documentRecord.content || '')], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${invoice.invoiceNumber}.html`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => this.error.set(error?.error?.error || 'Unable to download invoice')
    });
  }

  clientName(id: string): string {
    return this.clients().find((client) => client.id === id)?.name || 'Client';
  }
}
