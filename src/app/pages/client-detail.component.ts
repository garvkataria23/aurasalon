import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

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
              <span class="badge" *ngFor="let tag of client.tags">{{ tag }}</span>
            </div>
          </div>
          <div class="profile-stats">
            <strong>{{ client.totalSpend | currency: 'INR':'symbol':'1.0-0' }}</strong>
            <span>Total spend</span>
            <strong>{{ client.loyaltyPoints }} pts</strong>
            <span>Loyalty</span>
          </div>
        </section>

        <div class="dashboard-grid">
          <section class="panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">Notes and preferences</span>
                <h2>Front desk context</h2>
              </div>
              <button class="primary-button" type="button" (click)="saveNotes()">Save notes</button>
            </div>
            <textarea class="notes-box" [(ngModel)]="notes"></textarea>
            <div class="info-grid">
              <div><span>Birthday</span><strong>{{ client.birthday || 'Not set' }}</strong></div>
              <div><span>Anniversary</span><strong>{{ client.anniversary || 'Not set' }}</strong></div>
              <div><span>Wallet</span><strong>{{ client.walletBalance | currency: 'INR':'symbol':'1.0-0' }}</strong></div>
              <div><span>Membership</span><strong>{{ client.membershipId || 'None' }}</strong></div>
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
              <article *ngFor="let visit of client.visitHistory">
                <strong>{{ visit.date }}</strong>
                <span>{{ visit.services || visit.saleId }}</span>
              </article>
            </div>
          </section>

          <section class="panel">
            <div class="section-title"><h2>Purchase history</h2></div>
            <div class="activity-list">
              <article *ngFor="let purchase of client.purchaseHistory">
                <strong>{{ purchase.invoice }}</strong>
                <span>{{ purchase.amount | currency: 'INR':'symbol':'1.0-0' }}</span>
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
  readonly loading = signal(true);
  readonly error = signal('');
  notes = '';

  constructor(private readonly api: ApiService, private readonly route: ActivatedRoute) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.api.get<ApiRecord>('clients', id).subscribe({
      next: (client) => {
        this.client.set(client);
        this.notes = client.notes || '';
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load client profile');
        this.loading.set(false);
      }
    });
  }

  saveNotes(): void {
    const client = this.client();
    if (!client) return;
    this.api.update<ApiRecord>('clients', client.id, { notes: this.notes }).subscribe({
      next: (updated) => this.client.set(updated),
      error: (error) => this.error.set(error?.error?.error || 'Unable to save notes')
    });
  }

  initials(name: string): string {
    return String(name || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }
}
