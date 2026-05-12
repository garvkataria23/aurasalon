import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-offline-support',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePipe, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Level 14 · Offline-first architecture</span>
          <h2>Local caching, sync when online, offline billing and offline appointment management</h2>
          <p>Offline operations are queued, processed through the same persisted booking/POS logic and marked synced or conflict.</p>
        </div>
        <button class="ghost-button" type="button" (click)="load()">Refresh</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="metrics-grid" *ngIf="summary()?.metrics as metrics">
        <article class="metric-card amber"><span>Queued</span><strong>{{ metrics.queued }}</strong><small>Pending sync</small></article>
        <article class="metric-card green"><span>Synced</span><strong>{{ metrics.synced }}</strong><small>Processed items</small></article>
        <article class="metric-card red"><span>Conflicts</span><strong>{{ metrics.conflicts }}</strong><small>Needs review</small></article>
        <article class="metric-card blue"><span>Cache snapshots</span><strong>{{ metrics.cacheSnapshots }}</strong><small>Local data packs</small></article>
        <article class="metric-card teal"><span>Offline appointments</span><strong>{{ metrics.offlineAppointments }}</strong><small>Queued bookings</small></article>
        <article class="metric-card violet"><span>Offline bills</span><strong>{{ metrics.offlineBills }}</strong><small>Queued sales</small></article>
      </div>

      <div class="three-grid">
        <section class="form-panel">
          <h3>Create cache snapshot</h3>
          <form [formGroup]="cacheForm" (ngSubmit)="createSnapshot()">
            <label class="field"><span>Device ID</span><input formControlName="deviceId" /></label>
            <label class="field"><span>Branch</span><select formControlName="branchId"><option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option></select></label>
            <div class="form-actions"><button class="primary-button" type="submit">Cache branch data</button></div>
          </form>
        </section>

        <section class="form-panel">
          <h3>Offline appointment</h3>
          <form [formGroup]="appointmentForm" (ngSubmit)="offlineAppointment()">
            <label class="field"><span>Client</span><select formControlName="clientId"><option *ngFor="let client of clients()" [value]="client.id">{{ client.name }}</option></select></label>
            <label class="field"><span>Service</span><select formControlName="serviceId"><option *ngFor="let service of services()" [value]="service.id">{{ service.name }}</option></select></label>
            <label class="field"><span>Branch</span><select formControlName="branchId"><option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option></select></label>
            <label class="field"><span>Start</span><input type="datetime-local" formControlName="startAt" /></label>
            <div class="form-actions"><button class="primary-button" type="submit">Queue and sync</button></div>
          </form>
        </section>

        <section class="form-panel">
          <h3>Offline billing</h3>
          <form [formGroup]="billingForm" (ngSubmit)="offlineBilling()">
            <label class="field"><span>Client</span><select formControlName="clientId"><option *ngFor="let client of clients()" [value]="client.id">{{ client.name }}</option></select></label>
            <label class="field"><span>Service</span><select formControlName="serviceId"><option *ngFor="let service of services()" [value]="service.id">{{ service.name }}</option></select></label>
            <label class="field"><span>Branch</span><select formControlName="branchId"><option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option></select></label>
            <label class="field"><span>Payment mode</span><select formControlName="mode"><option value="upi">UPI</option><option value="cash">Cash</option><option value="card">Card</option></select></label>
            <div class="form-actions"><button class="primary-button" type="submit">Sync bill</button></div>
          </form>
        </section>
      </div>

      <section class="panel">
        <div class="section-title">
          <h2>Sync queue</h2>
          <button class="ghost-button" type="button" (click)="sync()">Sync queued</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Entity</th><th>Operation</th><th>Device</th><th>Status</th><th>Server</th><th>Created</th></tr></thead>
            <tbody>
              <tr *ngFor="let item of summary()?.syncItems || []">
                <td>{{ item.entity }}</td>
                <td>{{ item.operation }}</td>
                <td>{{ item.deviceId }}</td>
                <td><span class="badge">{{ item.status }}</span></td>
                <td>{{ item.serverId || '-' }}</td>
                <td>{{ item.createdAt | date: 'short' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="dashboard-grid">
        <section class="panel">
          <div class="section-title"><h2>Cache snapshots</h2></div>
          <div class="rank-list">
            <article *ngFor="let snapshot of summary()?.snapshots || []">
              <div><strong>{{ snapshot.resource }}</strong><span>{{ snapshot.deviceId }} · v{{ snapshot.version }}</span></div>
              <small>{{ snapshot.createdAt | date: 'short' }}</small>
            </article>
          </div>
        </section>
        <section class="panel">
          <div class="section-title"><h2>Offline guidance</h2></div>
          <div class="quick-grid">
            <article class="action-card" *ngFor="let item of summary()?.guidance || []"><strong>{{ item }}</strong><span>Operational rule</span></article>
          </div>
        </section>
      </div>

      <pre class="result-json" *ngIf="result()">{{ result() | json }}</pre>
    </section>
  `
})
export class OfflineSupportComponent implements OnInit {
  readonly summary = signal<ApiRecord | null>(null);
  readonly branches = signal<ApiRecord[]>([]);
  readonly clients = signal<ApiRecord[]>([]);
  readonly services = signal<ApiRecord[]>([]);
  readonly result = signal<ApiRecord | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly cacheForm = this.fb.group({ deviceId: ['front-desk-terminal', Validators.required], branchId: ['', Validators.required] });
  readonly appointmentForm = this.fb.group({ clientId: ['', Validators.required], serviceId: ['', Validators.required], branchId: ['', Validators.required], startAt: [this.defaultLocalTime(), Validators.required] });
  readonly billingForm = this.fb.group({ clientId: ['', Validators.required], serviceId: ['', Validators.required], branchId: ['', Validators.required], mode: ['upi'] });

  constructor(private readonly api: ApiService, private readonly fb: UntypedFormBuilder) {}

  ngOnInit(): void {
    this.loadLists();
    this.load();
  }

  loadLists(): void {
    this.api.list<ApiRecord[]>('branches').subscribe((rows) => {
      this.branches.set(rows);
      if (rows[0]) {
        this.cacheForm.patchValue({ branchId: rows[0].id });
        this.appointmentForm.patchValue({ branchId: rows[0].id });
        this.billingForm.patchValue({ branchId: rows[0].id });
      }
    });
    this.api.list<ApiRecord[]>('clients').subscribe((rows) => {
      this.clients.set(rows);
      if (rows[0]) {
        this.appointmentForm.patchValue({ clientId: rows[0].id });
        this.billingForm.patchValue({ clientId: rows[0].id });
      }
    });
    this.api.list<ApiRecord[]>('services').subscribe((rows) => {
      this.services.set(rows);
      if (rows[0]) {
        this.appointmentForm.patchValue({ serviceId: rows[0].id });
        this.billingForm.patchValue({ serviceId: rows[0].id });
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.list<ApiRecord>('offline/summary').subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to load offline support');
        this.loading.set(false);
      }
    });
  }

  createSnapshot(): void {
    this.api.post<ApiRecord>('offline/cache-snapshots', this.cacheForm.value).subscribe((response) => {
      this.result.set(response);
      this.load();
    });
  }

  offlineAppointment(): void {
    const value = this.appointmentForm.value;
    this.api.post<ApiRecord>('offline/appointments', {
      ...value,
      serviceIds: [value.serviceId],
      startAt: new Date(value.startAt).toISOString()
    }).subscribe((response) => {
      this.result.set(response);
      this.load();
    });
  }

  offlineBilling(): void {
    const service = this.services().find((item) => item.id === this.billingForm.value.serviceId);
    this.api.post<ApiRecord>('offline/billing', {
      clientId: this.billingForm.value.clientId,
      branchId: this.billingForm.value.branchId,
      items: [{ type: 'service', id: service?.id, quantity: 1, price: service?.price }],
      payments: [{ mode: this.billingForm.value.mode, amount: service?.price || 0 }]
    }).subscribe((response) => {
      this.result.set(response);
      this.load();
    });
  }

  sync(): void {
    this.api.post<ApiRecord>('offline/sync', {}).subscribe((response) => {
      this.result.set(response);
      this.load();
    });
  }

  defaultLocalTime(): string {
    const date = new Date(Date.now() + 3 * 60 * 60 * 1000);
    date.setMinutes(0, 0, 0);
    return date.toISOString().slice(0, 16);
  }
}
