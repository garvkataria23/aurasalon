import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-memberships',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe, DatePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Memberships, packages and loyalty</span>
          <h2>Credits, validity, auto-renewal, gift cards and redeem tracking</h2>
          <p>Membership redemption reduces credits from the database and records the transaction history.</p>
        </div>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="three-grid">
        <section class="form-panel">
          <h3>Create membership</h3>
          <form [formGroup]="membershipForm" (ngSubmit)="saveMembership()">
            <label class="field">
              <span>Client</span>
              <select formControlName="clientId">
                <option value="">Select client</option>
                <option *ngFor="let client of clients()" [value]="client.id">{{ client.name }}</option>
              </select>
            </label>
            <label class="field"><span>Plan name</span><input formControlName="planName" /></label>
            <label class="field"><span>Price</span><input type="number" formControlName="price" /></label>
            <label class="field"><span>Credits</span><input type="number" formControlName="planCredits" /></label>
            <label class="field"><span>Validity</span><input type="date" formControlName="validityDate" /></label>
            <label class="field check-line"><input type="checkbox" formControlName="autoRenew" /><span>Auto-renewal</span></label>
            <button class="primary-button" type="submit" [disabled]="membershipForm.invalid || saving()">Save plan</button>
          </form>
        </section>

        <section class="form-panel">
          <h3>Redeem credits</h3>
          <form [formGroup]="redeemForm" (ngSubmit)="redeem()">
            <label class="field">
              <span>Membership</span>
              <select formControlName="membershipId">
                <option value="">Select membership</option>
                <option *ngFor="let membership of memberships()" [value]="membership.id">{{ membership.planName }} - {{ clientName(membership.clientId) }}</option>
              </select>
            </label>
            <label class="field"><span>Credits used</span><input type="number" formControlName="creditsUsed" /></label>
            <button class="primary-button" type="submit" [disabled]="redeemForm.invalid || saving()">Redeem</button>
          </form>
        </section>

        <section class="form-panel">
          <h3>Gift card</h3>
          <form [formGroup]="giftForm" (ngSubmit)="saveGiftCard()">
            <label class="field"><span>Code</span><input formControlName="code" /></label>
            <label class="field"><span>Initial value</span><input type="number" formControlName="initialValue" /></label>
            <label class="field"><span>Expiry</span><input type="date" formControlName="expiryDate" /></label>
            <button class="primary-button" type="submit" [disabled]="giftForm.invalid || saving()">Create gift card</button>
          </form>
        </section>
      </div>

      <section class="panel">
        <div class="section-title"><h2>Active memberships</h2></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Plan</th>
                <th>Credits</th>
                <th>Validity</th>
                <th>Auto-renew</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let membership of memberships()">
                <td>{{ clientName(membership.clientId) }}</td>
                <td><strong>{{ membership.planName }}</strong><small>{{ membership.status }}</small></td>
                <td>{{ membership.creditsRemaining }} / {{ membership.planCredits }}</td>
                <td>{{ membership.validityDate | date: 'mediumDate' }}</td>
                <td>{{ membership.autoRenew ? 'Yes' : 'No' }}</td>
                <td>{{ membership.price | currency: 'INR':'symbol':'1.0-0' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="section-title"><h2>Gift cards</h2></div>
        <div class="quick-grid">
          <article class="action-card" *ngFor="let card of giftCards()">
            <strong>{{ card.code }}</strong>
            <span>{{ card.balance | currency: 'INR':'symbol':'1.0-0' }} balance · expires {{ card.expiryDate }}</span>
          </article>
        </div>
      </section>
    </section>
  `
})
export class MembershipsComponent implements OnInit {
  readonly memberships = signal<ApiRecord[]>([]);
  readonly clients = signal<ApiRecord[]>([]);
  readonly giftCards = signal<ApiRecord[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly membershipForm = this.fb.group({
    clientId: ['', Validators.required],
    planName: ['', Validators.required],
    price: [0],
    planCredits: [1],
    validityDate: [''],
    autoRenew: [true]
  });
  readonly redeemForm = this.fb.group({
    membershipId: ['', Validators.required],
    creditsUsed: [1, Validators.required]
  });
  readonly giftForm = this.fb.group({
    code: ['', Validators.required],
    initialValue: [1000, Validators.required],
    expiryDate: ['2026-12-31']
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    Promise.all([
      this.api.list<ApiRecord[]>('memberships').toPromise(),
      this.api.list<ApiRecord[]>('clients').toPromise(),
      this.api.list<ApiRecord[]>('giftCards').toPromise()
    ])
      .then(([memberships, clients, giftCards]) => {
        this.memberships.set(memberships || []);
        this.clients.set(clients || []);
        this.giftCards.set(giftCards || []);
        this.loading.set(false);
      })
      .catch((error) => {
        this.error.set(error?.error?.error || 'Unable to load memberships');
        this.loading.set(false);
      });
  }

  saveMembership(): void {
    if (this.membershipForm.invalid) return;
    this.saving.set(true);
    const value = this.membershipForm.value;
    this.api.create('memberships', {
      ...value,
      creditsRemaining: value.planCredits,
      serviceCredits: [],
      redeemHistory: [],
      autoRenew: value.autoRenew ? 1 : 0,
      branchId: this.api.selectedBranchId() || 'branch_hyd'
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to save membership');
        this.saving.set(false);
      }
    });
  }

  redeem(): void {
    if (this.redeemForm.invalid) return;
    this.saving.set(true);
    this.api.post(`memberships/${this.redeemForm.value.membershipId}/redeem`, { creditsUsed: this.redeemForm.value.creditsUsed }).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to redeem credits');
        this.saving.set(false);
      }
    });
  }

  saveGiftCard(): void {
    if (this.giftForm.invalid) return;
    this.saving.set(true);
    const value = this.giftForm.value;
    this.api.create('giftCards', { ...value, balance: value.initialValue, redeemHistory: [] }).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to save gift card');
        this.saving.set(false);
      }
    });
  }

  clientName(id: string): string {
    return this.clients().find((client) => client.id === id)?.name || id;
  }
}
