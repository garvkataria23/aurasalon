import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, Validators } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { AppStateService } from '../core/state/app-state.service';
import { StateComponent } from '../shared/ui/state/state.component';
import { AuraKpiCardComponent } from '../shared/ui/aura-kpi-card/aura-kpi-card.component';

@Component({
  selector: 'app-saas-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CurrencyPipe, DatePipe, StateComponent, AuraKpiCardComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">SaaS control plane</span>
          <h2>Tenant onboarding, subscriptions, usage limits and custom domains</h2>
          <p>New salons receive isolated tenant data, their own trial subscription, first branch, owner user and optional domain mapping.</p>
        </div>
        <button class="ghost-button" type="button" (click)="load()">Refresh SaaS context</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <ng-container *ngIf="context() as context">
        <div class="metrics-grid">
          <aura-kpi-card tone="teal" target="/kpi-details/saas-onboarding/current-tenant">
            <span>Current tenant</span>
            <strong>{{ context.tenant?.name }}</strong>
            <small>{{ context.tenant?.subscriptionStatus }} · {{ context.tenant?.slug }}</small>
          </aura-kpi-card>
          <aura-kpi-card tone="amber" target="/kpi-details/saas-onboarding/trial-ends">
            <span>Trial ends</span>
            <strong>{{ context.tenant?.trialEndsAt | date: 'mediumDate' }}</strong>
            <small>{{ context.plan?.name }} plan</small>
          </aura-kpi-card>
          <aura-kpi-card tone="blue" target="/kpi-details/saas-onboarding/primary-domain">
            <span>Primary domain</span>
            <strong>{{ context.tenant?.primaryDomain || 'Not mapped' }}</strong>
            <small>{{ context.domains?.length || 0 }} domain records</small>
          </aura-kpi-card>
          <aura-kpi-card tone="green" target="/kpi-details/saas-onboarding/role-scope">
            <span>Role scope</span>
            <strong>{{ context.access?.role }}</strong>
            <small>{{ context.access?.branchId || 'All permitted branches' }}</small>
          </aura-kpi-card>
        </div>

        <section class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Usage limits</span>
              <h2>Plan consumption</h2>
            </div>
          </div>
          <div class="quick-grid">
            <article class="action-card" *ngFor="let item of usageRows(context.usage)">
              <strong>{{ item.label }}</strong>
              <span>{{ item.used }} used / {{ item.limit || 'unlimited' }} allowed</span>
              <div class="stage-track"><span [style.width.%]="item.percent"></span></div>
            </article>
          </div>
        </section>
      </ng-container>

      <div class="dashboard-grid">
        <section class="form-panel">
          <h3>Onboard a salon tenant</h3>
          <form [formGroup]="onboardingForm" (ngSubmit)="onboard()">
            <label class="field"><span>Salon name</span><input formControlName="salonName" /></label>
            <label class="field"><span>Slug</span><input formControlName="slug" placeholder="my-salon" /></label>
            <label class="field"><span>Owner name</span><input formControlName="ownerName" /></label>
            <label class="field"><span>Owner email</span><input type="email" formControlName="ownerEmail" /></label>
            <label class="field"><span>Main branch</span><input formControlName="branchName" /></label>
            <label class="field"><span>City</span><input formControlName="city" /></label>
            <label class="field"><span>GSTIN</span><input formControlName="gstin" /></label>
            <label class="field">
              <span>Plan</span>
              <select formControlName="planId">
                <option *ngFor="let plan of plans()" [value]="plan.id">{{ plan.name }} - {{ plan.priceMonthly | currency: 'INR':'symbol':'1.0-0' }}/mo</option>
              </select>
            </label>
            <label class="field full"><span>Domain</span><input formControlName="domain" placeholder="salon.example.com" /></label>
            <div class="form-actions">
              <button class="primary-button" type="submit" [disabled]="onboardingForm.invalid || saving()">Create tenant</button>
            </div>
          </form>
        </section>

        <section class="form-panel">
          <h3>Domain mapping</h3>
          <form [formGroup]="domainForm" (ngSubmit)="addDomain()">
            <label class="field"><span>Domain</span><input formControlName="domain" placeholder="booking.salon.com" /></label>
            <label class="field check-line"><input type="checkbox" formControlName="isPrimary" /><span>Make primary domain</span></label>
            <button class="primary-button" type="submit" [disabled]="domainForm.invalid || saving()">Add domain</button>
          </form>

          <div class="activity-list" *ngIf="context()?.domains?.length">
            <article *ngFor="let domain of context()?.domains">
              <div>
                <strong>{{ domain.domain }}</strong>
                <span>{{ domain.status }} · {{ domain.isPrimary ? 'primary' : 'secondary' }}</span>
              </div>
              <button class="ghost-button mini" type="button" (click)="verifyDomain(domain.id)" *ngIf="domain.status !== 'verified'">Verify</button>
            </article>
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="section-title">
          <div>
            <span class="eyebrow">Subscription plans</span>
            <h2>Trial and plan catalogue</h2>
          </div>
        </div>
        <div class="quick-grid">
          <article class="action-card" *ngFor="let plan of plans()">
            <strong>{{ plan.name }}</strong>
            <span>{{ plan.priceMonthly | currency: 'INR':'symbol':'1.0-0' }}/month · {{ plan.trialDays }} day trial</span>
            <small>{{ plan.features?.join(', ') }}</small>
            <button class="ghost-button mini" type="button" (click)="switchPlan(plan.id)">Switch current tenant</button>
          </article>
        </div>
      </section>
    </section>
  `
})
export class SaasOnboardingComponent implements OnInit {
  readonly context = signal<ApiRecord | null>(null);
  readonly plans = signal<ApiRecord[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly onboardingForm = this.fb.group({
    salonName: ['', Validators.required],
    slug: [''],
    ownerName: [''],
    ownerEmail: ['', Validators.required],
    branchName: ['Main Branch'],
    city: [''],
    gstin: [''],
    planId: ['plan_starter'],
    domain: ['']
  });

  readonly domainForm = this.fb.group({
    domain: ['', Validators.required],
    isPrimary: [false]
  });

  constructor(
    private readonly api: ApiService,
    private readonly fb: UntypedFormBuilder,
    private readonly state: AppStateService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    Promise.all([
      this.api.list<ApiRecord>('saas/context').toPromise(),
      this.api.list<ApiRecord[]>('saas/plans').toPromise()
    ])
      .then(([context, plans]) => {
        this.context.set(context || null);
        this.plans.set(plans || []);
        if (!this.onboardingForm.value.planId && plans?.[0]?.id) this.onboardingForm.patchValue({ planId: plans[0].id });
        this.loading.set(false);
      })
      .catch((error) => {
        this.error.set(error?.error?.error || 'Unable to load SaaS context');
        this.loading.set(false);
      });
  }

  onboard(): void {
    if (this.onboardingForm.invalid) return;
    this.saving.set(true);
    this.api.post<ApiRecord>('saas/onboarding', this.onboardingForm.value).subscribe({
      next: (result) => {
        this.state.setTenant(result.tenant.id);
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to create tenant');
        this.saving.set(false);
      }
    });
  }

  addDomain(): void {
    if (this.domainForm.invalid) return;
    this.saving.set(true);
    this.api.post('saas/domain-mappings', this.domainForm.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error?.error?.error || 'Unable to add domain');
        this.saving.set(false);
      }
    });
  }

  verifyDomain(domainId: string): void {
    this.api.post(`saas/domain-mappings/${domainId}/verify`, {}).subscribe({
      next: () => this.load(),
      error: (error) => this.error.set(error?.error?.error || 'Unable to verify domain')
    });
  }

  switchPlan(planId: string): void {
    this.api.patch('saas/subscription', { planId }).subscribe({
      next: () => this.load(),
      error: (error) => this.error.set(error?.error?.error || 'Unable to switch plan')
    });
  }

  usageRows(usage: ApiRecord = {}): Array<{ label: string; used: number; limit: number | null; percent: number }> {
    return Object.entries(usage).map(([label, value]: [string, any]) => ({
      label,
      used: Number(value.used || 0),
      limit: value.limit ?? null,
      percent: value.limit ? Math.min(100, Math.round((Number(value.used || 0) / Number(value.limit)) * 100)) : 12
    }));
  }
}
