import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

const STATUSES = ['booked', 'arrived', 'no-show', 'completed', 'cancelled'];

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Appointment calendar</span>
          <h2>Day, week and month booking board</h2>
          <p>Drag bookings between statuses, assign staff, chair or room, and complete appointments before billing.</p>
        </div>
        <div class="segmented">
          <button type="button" *ngFor="let option of ['day', 'week', 'month']" [class.active]="viewMode() === option" (click)="viewMode.set(option)">{{ option }}</button>
        </div>
      </div>

      <div class="split-layout">
        <section class="form-panel">
          <h3>Front-desk quick booking</h3>
          <form [formGroup]="form" (ngSubmit)="save()">
            <label class="field">
              <span>Client</span>
              <select formControlName="clientId">
                <option value="">Select client</option>
                <option *ngFor="let client of clients()" [value]="client.id">{{ client.name }}</option>
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
              <span>Branch</span>
              <select formControlName="branchId">
                <option value="">Select branch</option>
                <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option>
              </select>
            </label>
            <label class="field">
              <span>Service</span>
              <select formControlName="serviceId">
                <option value="">Select service</option>
                <option *ngFor="let service of services()" [value]="service.id">{{ service.name }} - ₹{{ service.price }}</option>
              </select>
            </label>
            <label class="field">
              <span>Start time</span>
              <input type="datetime-local" formControlName="startAt" />
            </label>
            <label class="field">
              <span>Chair / room</span>
              <input formControlName="chair" placeholder="Chair 1 or Room A" />
            </label>
            <label class="field check-line">
              <input type="checkbox" formControlName="walkIn" />
              <span>Walk-in booking</span>
            </label>
            <div class="form-actions">
              <button class="primary-button" type="submit" [disabled]="form.invalid || saving()">Create booking</button>
            </div>
          </form>
        </section>

        <section class="panel">
          <div class="table-toolbar">
            <label class="select-label">
              <span>Staff filter</span>
              <select [value]="staffFilter()" (change)="staffFilter.set($any($event.target).value)">
                <option value="">All staff</option>
                <option *ngFor="let person of staff()" [value]="person.id">{{ person.name }}</option>
              </select>
            </label>
            <button class="ghost-button" type="button" (click)="load()">Refresh</button>
          </div>
          <app-state [loading]="loading()" [error]="error()"></app-state>
          <div class="calendar-board" *ngIf="!loading()">
            <section class="status-lane" *ngFor="let status of statuses" (dragover)="$event.preventDefault()" (drop)="dropStatus(status)">
              <div class="column-header">
                <h3>{{ status }}</h3>
                <span>{{ byStatus(status).length }}</span>
              </div>
              <article
                class="booking-card"
                *ngFor="let appointment of byStatus(status)"
                draggable="true"
                (dragstart)="draggingId = appointment.id"
              >
                <strong>{{ clientName(appointment.clientId) }}</strong>
                <span>{{ serviceNames(appointment.serviceIds) }}</span>
                <small>{{ appointment.startAt | date: 'MMM d, h:mm a' }} - {{ staffName(appointment.staffId) }}</small>
                <small>{{ appointment.chair || appointment.room || 'No chair assigned' }} · {{ appointment.source }}</small>
                <div class="card-actions">
                  <button class="ghost-button mini" type="button" *ngIf="appointment.status !== 'completed'" (click)="complete(appointment.id)">Complete</button>
                  <button class="ghost-button mini" type="button" (click)="changeStatus(appointment.id, 'cancelled')">Cancel</button>
                </div>
              </article>
            </section>
          </div>
        </section>
      </div>
    </section>
  `
})
export class AppointmentsComponent implements OnInit {
  readonly statuses = STATUSES;
  readonly appointments = signal<ApiRecord[]>([]);
  readonly clients = signal<ApiRecord[]>([]);
  readonly staff = signal<ApiRecord[]>([]);
  readonly services = signal<ApiRecord[]>([]);
  readonly branches = signal<ApiRecord[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly viewMode = signal('day');
  readonly staffFilter = signal('');
  draggingId = '';

  readonly form = this.fb.group({
    clientId: ['', Validators.required],
    staffId: ['', Validators.required],
    branchId: ['', Validators.required],
    serviceId: ['', Validators.required],
    startAt: [this.localDateTime(), Validators.required],
    chair: ['Chair 1'],
    walkIn: [false]
  });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    Promise.all([
      this.api.list<ApiRecord[]>('appointments', { branchId: this.api.selectedBranchId() }).toPromise(),
      this.api.list<ApiRecord[]>('clients', { branchId: this.api.selectedBranchId() }).toPromise(),
      this.api.list<ApiRecord[]>('staff', { branchId: this.api.selectedBranchId() }).toPromise(),
      this.api.list<ApiRecord[]>('services').toPromise(),
      this.api.list<ApiRecord[]>('branches').toPromise()
    ])
      .then(([appointments, clients, staff, services, branches]) => {
        this.appointments.set(appointments || []);
        this.clients.set(clients || []);
        this.staff.set(staff || []);
        this.services.set(services || []);
        this.branches.set(branches || []);
        this.loading.set(false);
      })
      .catch((error) => {
        this.error.set(error?.error?.error || 'Unable to load appointment calendar');
        this.loading.set(false);
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.value;
    this.api.create('appointments', {
      clientId: value.clientId,
      staffId: value.staffId,
      branchId: value.branchId,
      serviceIds: [value.serviceId],
      startAt: new Date(String(value.startAt)).toISOString(),
      source: value.walkIn ? 'walk-in' : 'front-desk',
      onlineStatus: value.walkIn ? 'not-online' : 'confirmed',
      chair: value.chair,
      status: value.walkIn ? 'arrived' : 'booked'
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to create appointment');
        this.saving.set(false);
      }
    });
  }

  byStatus(status: string): ApiRecord[] {
    return this.appointments().filter((appointment) => {
      const staffMatch = this.staffFilter() ? appointment.staffId === this.staffFilter() : true;
      return appointment.status === status && staffMatch;
    });
  }

  dropStatus(status: string): void {
    if (!this.draggingId) return;
    this.changeStatus(this.draggingId, status);
    this.draggingId = '';
  }

  changeStatus(id: string, status: string): void {
    this.api.post(`appointments/${id}/status`, { status }).subscribe({
      next: () => this.load(),
      error: (error) => this.error.set(error?.error?.error || 'Unable to update status')
    });
  }

  complete(id: string): void {
    this.api.post(`appointments/${id}/complete`, {}).subscribe({
      next: () => this.load(),
      error: (error) => this.error.set(error?.error?.error || 'Unable to complete appointment')
    });
  }

  clientName(id: string): string {
    return this.clients().find((client) => client.id === id)?.name || 'Client';
  }

  staffName(id: string): string {
    return this.staff().find((person) => person.id === id)?.name || 'Staff';
  }

  serviceNames(ids: string[] = []): string {
    return ids.map((id) => this.services().find((service) => service.id === id)?.name || id).join(', ');
  }

  private localDateTime(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }
}
