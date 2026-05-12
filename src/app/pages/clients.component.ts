import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Client CRM</span>
          <h2>Profiles, history, wallet, loyalty and WhatsApp follow-up</h2>
          <p>Every row is loaded from the backend. Sales update purchase history and loyalty automatically.</p>
        </div>
        <button class="primary-button" type="button" (click)="showForm.set(!showForm())">{{ showForm() ? 'Close form' : 'Add client' }}</button>
      </div>

      <section class="form-panel" *ngIf="showForm()">
        <form [formGroup]="form" (ngSubmit)="save()">
          <label class="field">
            <span>Name</span>
            <input formControlName="name" />
          </label>
          <label class="field">
            <span>Phone</span>
            <input formControlName="phone" />
          </label>
          <label class="field">
            <span>Email</span>
            <input type="email" formControlName="email" />
          </label>
          <label class="field">
            <span>Birthday</span>
            <input type="date" formControlName="birthday" />
          </label>
          <label class="field">
            <span>Anniversary</span>
            <input type="date" formControlName="anniversary" />
          </label>
          <label class="field">
            <span>Tags</span>
            <select formControlName="tag">
              <option>new</option>
              <option>VIP</option>
              <option>inactive</option>
              <option>high spender</option>
            </select>
          </label>
          <label class="field full">
            <span>Notes</span>
            <textarea formControlName="notes"></textarea>
          </label>
          <div class="form-actions">
            <button class="ghost-button" type="button" (click)="showForm.set(false)">Cancel</button>
            <button class="primary-button" type="submit" [disabled]="form.invalid || saving()">Save client</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="table-toolbar">
          <label class="search-field">
            <span>Search/filter</span>
            <input [(ngModel)]="query" placeholder="Name, phone, tag, membership" />
          </label>
          <div class="segmented">
            <button type="button" *ngFor="let tag of ['', 'VIP', 'new', 'inactive', 'high spender']" [class.active]="tagFilter() === tag" (click)="tagFilter.set(tag)">
              {{ tag || 'All' }}
            </button>
          </div>
        </div>

        <app-state [loading]="loading()" [error]="error()"></app-state>

        <div class="table-wrap" *ngIf="!loading()">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Tags</th>
                <th>Spend</th>
                <th>Visits</th>
                <th>Wallet</th>
                <th>Loyalty</th>
                <th>Last visit</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let client of filteredClients">
                <td>
                  <a class="identity-cell" [routerLink]="['/clients', client.id]">
                    <span class="avatar">{{ initials(client.name) }}</span>
                    <span>
                      <strong>{{ client.name }}</strong>
                      <small>{{ client.phone }} · {{ client.email || 'No email' }}</small>
                    </span>
                  </a>
                </td>
                <td>
                  <span class="badge" *ngFor="let tag of client.tags">{{ tag }}</span>
                </td>
                <td>{{ client.totalSpend | currency: 'INR':'symbol':'1.0-0' }}</td>
                <td>{{ client.visitCount }}</td>
                <td>{{ client.walletBalance | currency: 'INR':'symbol':'1.0-0' }}</td>
                <td>{{ client.loyaltyPoints }} pts</td>
                <td>{{ client.lastVisitAt ? (client.lastVisitAt | date: 'mediumDate') : 'New' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `
})
export class ClientsComponent implements OnInit {
  readonly clients = signal<ApiRecord[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly showForm = signal(false);
  readonly tagFilter = signal('');
  query = '';

  readonly form = this.fb.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    email: [''],
    birthday: [''],
    anniversary: [''],
    tag: ['new'],
    notes: ['']
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  get filteredClients(): ApiRecord[] {
    return this.clients().filter((client) => {
      const queryMatch = JSON.stringify(client).toLowerCase().includes(this.query.toLowerCase());
      const tagMatch = this.tagFilter() ? (client.tags || []).includes(this.tagFilter()) : true;
      return queryMatch && tagMatch;
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.list<ApiRecord[]>('clients', { branchId: this.api.selectedBranchId() }).subscribe({
      next: (clients) => {
        this.clients.set(clients);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load clients');
        this.loading.set(false);
      }
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.value;
    this.api.create('clients', {
      name: value.name,
      phone: value.phone,
      email: value.email,
      birthday: value.birthday,
      anniversary: value.anniversary,
      tags: [value.tag],
      notes: value.notes,
      branchId: this.api.selectedBranchId() || 'branch_hyd',
      walletBalance: 0,
      loyaltyPoints: 0,
      visitCount: 0,
      totalSpend: 0,
      visitHistory: [],
      purchaseHistory: [],
      whatsappHistory: [],
      consentForms: []
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to save client');
        this.saving.set(false);
      }
    });
  }

  initials(name: string): string {
    return String(name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }
}
