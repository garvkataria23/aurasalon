import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';
import { AuraKpiCardComponent } from '../shared/ui/aura-kpi-card/aura-kpi-card.component';

@Component({
  selector: 'app-booking-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe, DatePipe, RouterLink, StateComponent, AuraKpiCardComponent],
  template: `
    <main class="portal-page">
      <section class="module-hero">
        <div>
          <span class="eyebrow">Level 22 · Online booking website</span>
          <h2>{{ context()?.branding?.brandName || 'Book your salon appointment' }}</h2>
          <p>Select service, staff and slot. The confirmation creates a real appointment and queues booking confirmation messaging.</p>
        </div>
        <a class="ghost-button" routerLink="/dashboard">Admin console</a>
      </section>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="metrics-grid" *ngIf="context()?.paymentReady as payment">
        <aura-kpi-card tone="teal" target="/kpi-details/booking-portal/online-payment"><span>Online payment</span><strong>{{ payment.onlinePayment ? 'Ready' : 'Disabled' }}</strong><small>{{ payment.captureMode }}</small></aura-kpi-card>
        <aura-kpi-card tone="blue" target="/kpi-details/booking-portal/payment-modes"><span>Payment modes</span><strong>{{ payment.modes.length }}</strong><small>{{ payment.modes.join(', ') }}</small></aura-kpi-card>
        <aura-kpi-card tone="green" target="/kpi-details/booking-portal/services"><span>Services</span><strong>{{ services().length }}</strong><small>Available catalog</small></aura-kpi-card>
        <aura-kpi-card tone="amber" target="/kpi-details/booking-portal/staff"><span>Staff</span><strong>{{ staffForBranch().length }}</strong><small>Branch-ready team</small></aura-kpi-card>
      </div>

      <div class="dashboard-grid">
        <section class="form-panel">
          <h3>Choose appointment</h3>
          <form [formGroup]="bookingForm" (ngSubmit)="findSlots()">
            <label class="field">
              <span>Branch</span>
              <select formControlName="branchId" (change)="findSlots()"><option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option></select>
            </label>
            <label class="field">
              <span>Service</span>
              <select formControlName="serviceId" (change)="findSlots()"><option *ngFor="let service of services()" [value]="service.id">{{ service.name }} · {{ service.price | currency: 'INR':'symbol':'1.0-0' }}</option></select>
            </label>
            <label class="field">
              <span>Staff</span>
              <select formControlName="staffId"><option value="">Auto assign</option><option *ngFor="let person of staffForBranch()" [value]="person.id">{{ person.name }}</option></select>
            </label>
            <label class="field">
              <span>Date</span>
              <input type="date" formControlName="date" />
            </label>
            <div class="form-actions"><button class="primary-button" type="submit" [disabled]="bookingForm.invalid">Find slots</button></div>
          </form>
        </section>

        <section class="form-panel">
          <h3>Your details</h3>
          <form [formGroup]="clientForm">
            <label class="field"><span>Name</span><input formControlName="name" /></label>
            <label class="field"><span>Phone</span><input formControlName="phone" /></label>
            <label class="field full"><span>Email</span><input formControlName="email" /></label>
            <div class="form-actions">
              <button class="primary-button" type="button" (click)="confirm()" [disabled]="clientForm.invalid || !selectedSlot()">Confirm booking</button>
            </div>
          </form>
        </section>
      </div>

      <section class="panel">
        <div class="section-title"><h2>Available slots</h2></div>
        <div class="quick-grid" *ngIf="slots().length; else noSlots">
          <button class="action-card command-card" type="button" *ngFor="let slot of slots()" (click)="selectSlot(slot)" [class.active]="selectedSlot()?.startAt === slot.startAt">
            <strong>{{ slot.startAt | date: 'EEE, MMM d, h:mm a' }}</strong>
            <span>{{ slot.staffName }} · {{ slot.chair }} · Score {{ slot.score }}</span>
          </button>
        </div>
        <ng-template #noSlots>
          <div class="empty-state"><strong>No slots loaded</strong><span>Pick branch, service and date, then find slots.</span></div>
        </ng-template>
      </section>

      <section class="panel" *ngIf="appointment() as appt">
        <div class="section-title">
          <div>
            <span class="eyebrow">Booking confirmation</span>
            <h2>Appointment {{ appt.status }} for {{ appt.startAt | date: 'medium' }}</h2>
          </div>
          <span class="badge">{{ appt.onlineStatus }}</span>
        </div>
        <div class="summary-lines">
          <div><span>Appointment ID</span><strong>{{ appt.id }}</strong></div>
          <div><span>Branch</span><strong>{{ branchName(appt.branchId) }}</strong></div>
          <div><span>Staff</span><strong>{{ staffName(appt.staffId) }}</strong></div>
          <div><span>Payment</span><strong>Online payment ready · pay-at-salon fallback</strong></div>
        </div>
        <div class="form-actions">
          <button class="ghost-button" type="button" (click)="cancel()" [disabled]="appt.status === 'cancelled' || appt.status === 'completed'">Cancel booking</button>
          <button class="primary-button" type="button" (click)="reschedule()" [disabled]="!selectedSlot() || appt.status === 'cancelled' || appt.status === 'completed'">Reschedule to selected slot</button>
        </div>
      </section>

      <pre class="result-json" *ngIf="result()">{{ result() | json }}</pre>
    </main>
  `,
  styles: [`
    .portal-page {
      width: min(1180px, calc(100% - 28px));
      display: grid;
      gap: 18px;
      margin: 0 auto;
      padding: 24px 0 36px;
    }
    .command-card.active {
      border-color: rgba(15, 118, 110, 0.6);
      background: #e8f5f3;
      box-shadow: inset 0 3px 0 var(--teal);
    }
  `]
})
export class BookingPortalComponent implements OnInit {
  readonly context = signal<ApiRecord | null>(null);
  readonly slots = signal<ApiRecord[]>([]);
  readonly selectedSlot = signal<ApiRecord | null>(null);
  readonly appointment = signal<ApiRecord | null>(null);
  readonly result = signal<ApiRecord | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly bookingForm = this.fb.group({ branchId: ['', Validators.required], serviceId: ['', Validators.required], staffId: [''], date: [new Date().toISOString().slice(0, 10), Validators.required] });
  readonly clientForm = this.fb.group({ name: ['Aarav Customer', Validators.required], phone: ['+91 90000 55555', Validators.required], email: ['customer@example.com'] });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  branches(): ApiRecord[] {
    return this.context()?.branches || [];
  }

  services(): ApiRecord[] {
    return this.context()?.services || [];
  }

  staffForBranch(): ApiRecord[] {
    return (this.context()?.staff || []).filter((person: ApiRecord) => !this.bookingForm.value.branchId || person.branchId === this.bookingForm.value.branchId);
  }

  load(): void {
    this.loading.set(true);
    this.api.list<ApiRecord>('booking-portal/context').subscribe({
      next: (context) => {
        this.context.set(context);
        if (context.branches?.[0]) this.bookingForm.patchValue({ branchId: context.branches[0].id });
        if (context.services?.[0]) this.bookingForm.patchValue({ serviceId: context.services[0].id });
        this.loading.set(false);
        this.findSlots();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load booking portal');
        this.loading.set(false);
      }
    });
  }

  findSlots(): void {
    if (this.bookingForm.invalid) return;
    this.api.post<ApiRecord>('booking-portal/slots', this.bookingForm.value).subscribe({
      next: (response) => {
        this.slots.set(response.recommendations || []);
        this.selectedSlot.set((response.recommendations || [])[0] || null);
      },
      error: (error) => this.error.set(error?.error?.error || 'Unable to find slots')
    });
  }

  selectSlot(slot: ApiRecord): void {
    this.selectedSlot.set(slot);
  }

  confirm(): void {
    if (!this.selectedSlot() || this.clientForm.invalid) return;
    this.api.post<ApiRecord>('booking-portal/confirm', {
      branchId: this.bookingForm.value.branchId,
      serviceId: this.bookingForm.value.serviceId,
      staffId: this.bookingForm.value.staffId,
      slot: this.selectedSlot(),
      client: this.clientForm.value,
      paymentMode: 'pay-at-salon'
    }).subscribe((response) => {
      this.result.set(response);
      this.appointment.set(response.appointment);
    });
  }

  cancel(): void {
    const appt = this.appointment();
    if (!appt) return;
    this.api.patch<ApiRecord>(`booking-portal/appointments/${appt.id}/cancel`, { reason: 'Customer portal cancellation' }).subscribe((response) => {
      this.result.set(response);
      this.appointment.set(response.appointment);
    });
  }

  reschedule(): void {
    const appt = this.appointment();
    if (!appt || !this.selectedSlot()) return;
    this.api.patch<ApiRecord>(`booking-portal/appointments/${appt.id}/reschedule`, { slot: this.selectedSlot() }).subscribe((response) => {
      this.result.set(response);
      this.appointment.set(response.appointment);
    });
  }

  branchName(id: string): string {
    return this.branches().find((branch) => branch.id === id)?.name || id;
  }

  staffName(id: string): string {
    return (this.context()?.staff || []).find((person: ApiRecord) => person.id === id)?.name || id;
  }
}
