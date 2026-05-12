import { CommonModule } from '@angular/common';
import { Component, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ApiRecord, ApiService } from './core/api.service';
import { AppStateService, UserRole } from './core/state/app-state.service';

type NavItem = {
  path: string;
  label: string;
  icon: string;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <ng-container *ngIf="isPortal(); else adminShell">
      <div class="portal-shell">
        <router-outlet></router-outlet>
      </div>
    </ng-container>

    <ng-template #adminShell>
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" routerLink="/dashboard" aria-label="Aura dashboard">
          <span class="brand-mark">A</span>
          <span>
            <strong>Aura Salon</strong>
            <small>CRM / POS suite</small>
          </span>
        </a>

        <nav class="nav-list" aria-label="Primary navigation">
          <a
            *ngFor="let item of navItems"
            class="nav-item"
            [routerLink]="item.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
          >
            <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </a>
        </nav>

        <section class="sidebar-callout">
          <span class="eyebrow">SaaS tenant</span>
          <strong>{{ state.tenantScopeLabel() }}</strong>
          <p>Tenant, branch and role headers scope every API call.</p>
        </section>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div>
            <span class="eyebrow">One source of truth</span>
            <h1>Salon operations console</h1>
          </div>
          <div class="topbar-actions">
            <label class="select-label">
              <span>Tenant</span>
              <select [ngModel]="state.selectedTenantId()" (ngModelChange)="selectTenant($event)">
                <option *ngFor="let tenant of tenants()" [value]="tenant.id">{{ tenant.name }}</option>
              </select>
            </label>
            <label class="select-label">
              <span>Branch</span>
              <select [ngModel]="state.selectedBranchId()" (ngModelChange)="selectBranch($event)">
                <option value="">All branches</option>
                <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option>
              </select>
            </label>
            <label class="select-label">
              <span>Role</span>
              <select [ngModel]="state.userRole()" (ngModelChange)="selectRole($event)">
                <option value="owner">Owner</option>
                <option value="superAdmin">Super admin</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="receptionist">Receptionist</option>
                <option value="frontDesk">Front desk</option>
                <option value="staff">Staff</option>
                <option value="accountant">Accountant</option>
                <option value="inventoryManager">Inventory manager</option>
                <option value="analyst">Analyst</option>
                <option value="customMarketingLead">Custom marketing lead</option>
              </select>
            </label>
            <a class="primary-button" routerLink="/appointments">Quick booking</a>
            <a class="dark-button" routerLink="/pos">Fast POS</a>
          </div>
        </header>
        <div class="state error" *ngIf="globalError()">
          {{ globalError() }}
          <button class="ghost-button mini" type="button" (click)="globalError.set('')">Dismiss</button>
        </div>

        <router-outlet></router-outlet>
      </main>
    </div>
    </ng-template>
  `
})
export class AppComponent {
  readonly branches = signal<ApiRecord[]>([]);
  readonly tenants = signal<ApiRecord[]>([]);
  readonly isPortal = signal(false);
  readonly globalError = signal('');

  readonly navItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'D' },
    { path: '/prd', label: 'PRD', icon: 'P' },
    { path: '/design-system', label: 'Design', icon: 'DS' },
    { path: '/super-admin', label: 'Super Admin', icon: 'SA' },
    { path: '/ai', label: 'AI Assistant', icon: 'A' },
    { path: '/analytics', label: 'Analytics', icon: 'K' },
    { path: '/smart-booking', label: 'Smart Booking', icon: 'SB' },
    { path: '/security', label: 'Security', icon: 'SL' },
    { path: '/permissions', label: 'Permissions', icon: 'PM' },
    { path: '/compliance', label: 'Compliance', icon: 'AC' },
    { path: '/quality', label: 'Quality', icon: 'QA' },
    { path: '/deployment', label: 'Deployment', icon: 'DP' },
    { path: '/offline', label: 'Offline', icon: 'OF' },
    { path: '/white-label', label: 'White Label', icon: 'WL' },
    { path: '/future-features', label: 'Future AI', icon: 'F' },
    { path: '/workflows', label: 'Workflows', icon: 'WF' },
    { path: '/finance', label: 'Finance', icon: 'FN' },
    { path: '/customer-360', label: 'Customer 360', icon: '360' },
    { path: '/book', label: 'Booking Site', icon: 'OB' },
    { path: '/appointments', label: 'Calendar', icon: 'C' },
    { path: '/clients', label: 'Client CRM', icon: 'U' },
    { path: '/pos', label: 'POS Billing', icon: 'P' },
    { path: '/services', label: 'Services', icon: 'S' },
    { path: '/inventory', label: 'Inventory', icon: 'I' },
    { path: '/memberships', label: 'Memberships', icon: 'M' },
    { path: '/staff', label: 'Staff', icon: 'T' },
    { path: '/marketing', label: 'Marketing', icon: 'W' },
    { path: '/whatsapp', label: 'WhatsApp', icon: 'WA' },
    { path: '/reports', label: 'Reports', icon: 'R' },
    { path: '/saas', label: 'SaaS', icon: 'X' },
    { path: '/branches', label: 'Branches', icon: 'B' },
    { path: '/settings', label: 'Settings', icon: 'G' }
  ];

  constructor(
    readonly api: ApiService,
    readonly state: AppStateService,
    private readonly router: Router
  ) {
    this.isPortal.set(this.router.url.startsWith('/book'));
    window.addEventListener('aura:app-error', (event) => {
      this.globalError.set((event as CustomEvent<{ message: string }>).detail?.message || 'Unexpected application error');
    });
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.isPortal.set((event as NavigationEnd).urlAfterRedirects.startsWith('/book'));
    });
    effect(() => {
      this.state.selectedTenantId();
      this.loadTenants();
      this.loadBranches();
    });
  }

  loadBranches(): void {
    this.api.list<ApiRecord[]>('branches').subscribe({
      next: (branches) => this.branches.set(branches),
      error: () => this.branches.set([])
    });
  }

  loadTenants(): void {
    this.api.list<ApiRecord[]>('tenants').subscribe({
      next: (tenants) => {
        this.tenants.set(tenants);
        const selectedTenant = this.state.selectedTenantId();
        if (tenants.length && !tenants.some((tenant) => tenant.id === selectedTenant)) {
          this.state.setTenant(tenants[0].id);
          this.loadBranches();
        }
      },
      error: () => this.tenants.set([])
    });
  }

  selectTenant(tenantId: string): void {
    this.state.setTenant(tenantId);
  }

  selectBranch(branchId: string): void {
    this.state.setBranch(branchId);
  }

  selectRole(role: UserRole): void {
    this.state.setRole(role);
  }
}
