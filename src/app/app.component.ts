import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ApiRecord, ApiService } from './core/api.service';
import { AuthSessionService } from './core/auth-session.service';
import { AppStateService, UserRole } from './core/state/app-state.service';

type NavItem = {
  path: string;
  label: string;
  icon: string;
  keywords?: string;
  children?: NavItem[];
};

type NavGroup = {
  id: string;
  label: string;
  icon: string;
  primaryPath: string;
  items: NavItem[];
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <ng-container *ngIf="!session.isAuthenticated() && !isPortal(); else authenticatedApp">
      <main class="auth-shell">
        <section class="auth-card">
          <span class="eyebrow">Secure salon SaaS login</span>
          <h1>Aura Salon OS</h1>
          <p>Sign in with a tenant user before accessing CRM, POS, finance, inventory, reports and admin modules.</p>
          <form [formGroup]="loginForm" (ngSubmit)="login()" class="form-grid">
            <label class="field"><span>Tenant ID</span><input formControlName="tenantId" /></label>
            <label class="field"><span>Email / Staff Login ID</span><input formControlName="email" autocomplete="username" /></label>
            <label class="field"><span>Password</span><input formControlName="password" type="password" /></label>
            <label class="field"><span>Branch ID</span><input formControlName="branchId" placeholder="Optional" /></label>
            <div class="state error" *ngIf="loginError()">{{ loginError() }}</div>
            <button class="primary-button" type="submit" [disabled]="loginForm.invalid || loginBusy()">
              {{ loginBusy() ? 'Signing in...' : 'Sign in securely' }}
            </button>
          </form>
          <small>Default seeded owner: owner@aurasalon.example. Set DEMO_ADMIN_PASSWORD in production before first run.</small>
        </section>
      </main>
    </ng-container>

    <ng-template #authenticatedApp>
    <ng-container *ngIf="isPortal(); else adminShell">
      <div class="portal-shell">
        <button
          class="ghost-button portal-back-button"
          type="button"
          *ngIf="previousRoute()"
          (click)="goBack()"
          [attr.aria-label]="backButtonLabel()"
          [title]="backButtonLabel()"
        >
          <span aria-hidden="true">&larr;</span>
          <span>Back</span>
        </button>
        <router-outlet></router-outlet>
      </div>
    </ng-container>

    <ng-template #adminShell>
    <div class="app-shell" [class.sidebar-is-compact]="sidebarCompact()">
      <aside class="sidebar enterprise-sidebar" [class.sidebar-compact]="sidebarCompact()">
        <div class="sidebar-brand-row">
          <a class="brand" routerLink="/dashboard" aria-label="Aura dashboard">
            <span class="brand-mark">A</span>
            <span>
              <strong>Aura Salon</strong>
              <small>CRM / POS suite</small>
            </span>
          </a>
          <button class="sidebar-toggle" type="button" (click)="toggleSidebarCompact()" [attr.aria-pressed]="sidebarCompact()" [title]="sidebarCompact() ? 'Expand sidebar' : 'Collapse sidebar'">
            {{ sidebarCompact() ? '>>' : '<<' }}
          </button>
        </div>

        <label class="sidebar-search" *ngIf="!sidebarCompact()">
          <span>Find module</span>
          <input [ngModel]="navQuery()" (ngModelChange)="navQuery.set($event)" placeholder="Search POS, staff, reports" />
          <button class="sidebar-search-clear" type="button" *ngIf="navQuery()" (click)="navQuery.set('')">Clear</button>
        </label>

        <section class="nav-favorites" *ngIf="!sidebarCompact() && !navQuery()">
          <span class="nav-section-label">Pinned</span>
          <div class="nav-favorite-grid">
            <a class="nav-favorite" *ngFor="let item of favoriteNavItems" [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }">
              <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
              <span>{{ item.label }}</span>
            </a>
          </div>
        </section>

        <nav class="nav-list nav-accordion" aria-label="Primary navigation">
          <section class="nav-section" *ngFor="let group of visibleNavGroups()" [class.active-section]="isGroupActive(group)" [class.expanded]="isGroupExpanded(group)">
            <button class="nav-section-trigger" type="button" (click)="openNavGroup(group)" [attr.aria-expanded]="isGroupExpanded(group)" [title]="group.label">
              <span class="nav-icon" aria-hidden="true">{{ group.icon }}</span>
              <span class="nav-section-copy">
                <strong>{{ group.label }}</strong>
                <small>{{ group.items.length }} modules</small>
              </span>
              <span class="nav-count">{{ group.items.length }}</span>
            </button>
            <div class="nav-section-items" *ngIf="!sidebarCompact() && (navQuery() || isGroupExpanded(group))">
              <a
                *ngFor="let item of group.items"
                class="nav-subitem"
                [routerLink]="item.path"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
                (click)="rememberNavGroup(group.id)"
              >
                <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
                <span>{{ item.label }}</span>
              </a>
            </div>
          </section>
          <div class="nav-empty" *ngIf="!visibleNavGroups().length && !sidebarCompact()">
            <strong>No module found</strong>
            <button class="ghost-button mini" type="button" (click)="navQuery.set('')">Reset search</button>
          </div>
        </nav>

        <section class="sidebar-callout">
          <span class="eyebrow">SaaS tenant</span>
          <strong>{{ state.tenantScopeLabel() }}</strong>
          <p>Tenant, branch and role headers scope every API call.</p>
        </section>
      </aside>

      <main class="workspace" id="main-content">
        <header class="topbar">
          <div class="topbar-brand-title">
            <span class="eyebrow">Enterprise command workspace</span>
            <h1>Aurashine OS</h1>
            <div class="topbar-signal-row" aria-label="Current workspace context">
              <span>{{ activePageLabel() }}</span>
              <span>{{ state.tenantScopeLabel() }}</span>
              <span>{{ state.userRole() }}</span>
            </div>
          </div>
          <div class="topbar-actions">
            <button
              class="ghost-button back-button"
              type="button"
              (click)="goBack()"
              [attr.aria-label]="backButtonLabel()"
              [title]="backButtonLabel()"
            >
              <span aria-hidden="true">&larr;</span>
              <span>Back</span>
            </button>
            <label class="select-label tenant-scope">
              <span>Tenant</span>
              <select [ngModel]="state.selectedTenantId()" (ngModelChange)="selectTenant($event)">
                <option *ngFor="let tenant of tenants()" [value]="tenant.id">{{ tenant.name }}</option>
              </select>
            </label>
            <label class="select-label branch-scope">
              <span>Branch</span>
              <select [ngModel]="state.selectedBranchId()" (ngModelChange)="selectBranch($event)">
                <option *ngFor="let branch of branches()" [value]="branch.id">{{ branch.name }}</option>
              </select>
            </label>
            <label class="select-label role-scope">
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
            <a class="dark-button" routerLink="/pos">Fast POS</a>
            <button class="ghost-button" type="button" (click)="logout()">Logout</button>
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
    </ng-template>
  `
})
export class AppComponent {
  private readonly fb = inject(FormBuilder);
  readonly branches = signal<ApiRecord[]>([]);
  readonly tenants = signal<ApiRecord[]>([]);
  readonly isPortal = signal(false);
  readonly globalError = signal('');
  readonly loginBusy = signal(false);
  readonly loginError = signal('');
  readonly loginForm = this.fb.group({
    tenantId: ['tenant_aura', Validators.required],
    email: ['owner@aurasalon.example', Validators.required],
    password: ['', Validators.required],
    branchId: ['']
  });

  readonly navQuery = signal('');
  readonly activeRoute = signal('');
  readonly previousRoute = signal('');
  readonly sidebarCompact = signal(localStorage.getItem('aura.sidebarCompact') === '1');
  readonly expandedGroupIds = signal<string[]>(this.readExpandedGroups());

  readonly favoriteNavItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'D', keywords: 'home kpi overview' },
    { path: '/apps', label: 'All Apps', icon: 'AP', keywords: 'launchpad modules full suite apps' },
    { path: '/appointments', label: 'Calendar', icon: 'C', keywords: 'booking appointment schedule enterprise scheduler staff calendar' },
    { path: '/appointment-activity', label: 'Appt Activity', icon: 'AA', keywords: 'appointment audit cancellation reschedule no show reliability' },
    { path: '/salon-3d', label: '3D Salon', icon: '3D', keywords: 'public salon website three dimensional booking' },
    { path: '/clients', label: 'Clients', icon: 'CL', keywords: 'crm guest customer' },
    { path: '/pos', label: 'POS', icon: 'P', keywords: 'billing checkout' },
    { path: '/pos/invoices', label: 'Invoices', icon: 'IN', keywords: 'invoice receipt due paid' },
    { path: '/reports/invoices', label: 'Invoice Reports', icon: 'IR', keywords: 'invoice reports gst staff discount product membership due wallet' },
    { path: '/memberships', label: 'Memberships', icon: 'MB', keywords: 'membership loyalty packages credits renewal' },
    { path: '/suppliers', label: 'Suppliers', icon: 'SP', keywords: 'vendor purchase gst' },
    { path: '/reports', label: 'Reports', icon: 'R', keywords: 'analytics sales report' },
    { path: '/staff', label: 'Staff', icon: 'T', keywords: 'employee team payroll' },
    { path: '/staff/my-work', label: 'My Work', icon: 'MW', keywords: 'staff own report live appointments' }
  ];

  readonly navGroups: NavGroup[] = [
    {
      id: 'command',
      label: 'Command',
      icon: 'CM',
      primaryPath: '/dashboard',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: 'D', keywords: 'home overview kpi owner' },
        { path: '/apps', label: 'All Apps', icon: 'AP', keywords: 'launchpad modules full suite salon apps' },
        { path: '/command-center', label: 'Command Center', icon: 'CC', keywords: 'control tower enterprise' },
        { path: '/command-center/engagement', label: 'Engagement', icon: 'EC', keywords: 'hyperconnect unified inbox whatsapp client engagement' },
        { path: '/analytics', label: 'Analytics', icon: 'AN', keywords: 'metrics insight kpi' },
        { path: '/reports', label: 'Reports', icon: 'R', keywords: 'sales business reports' },
        { path: '/reports/invoices', label: 'Invoice Reports', icon: 'IR', keywords: 'invoice staff discount gst product membership wallet due audit reports' },
        { path: '/kpi-monitoring', label: 'KPI Monitor', icon: 'KM', keywords: 'monitor alerts targets' },
        { path: '/data-warehouse', label: 'Warehouse', icon: 'DW', keywords: 'data warehouse snapshots' },
        { path: '/predictive-forecasting', label: 'Forecast AI', icon: 'PF', keywords: 'forecast prediction revenue' }
      ]
    },
    {
      id: 'frontdesk',
      label: 'Front Desk',
      icon: 'FD',
      primaryPath: '/appointments',
      items: [
        { path: '/appointments', label: 'Calendar', icon: 'C', keywords: 'appointments booking schedule enterprise scheduler zenoti dingg fresha boulevard staff multi service booking' },
        { path: '/appointment-activity', label: 'Activity Center', icon: 'AC', keywords: 'appointment audit cancellation reschedule no show reliability' },
        { path: '/smart-booking', label: 'Smart Booking', icon: 'SB', keywords: 'ai booking slot' },
        { path: '/salon-3d', label: '3D Salon Website', icon: '3D', keywords: 'public website three dimensional salon landing booking' },
        { path: '/book', label: 'Booking Site', icon: 'OB', keywords: 'online booking portal' },
        { path: '/queue-system', label: 'Queue TV', icon: 'QT', keywords: 'walkin queue display' },
        { path: '/customer-360', label: 'Customer 360', icon: '360', keywords: 'customer intelligence guest' },
        { path: '/clients', label: 'Client CRM', icon: 'CL', keywords: 'client guest crm' },
        { path: '/client-masters', label: 'Client Masters', icon: 'CM', keywords: 'flexi client masters category source consultation feedback preferences' }
      ]
    },
    {
      id: 'pos',
      label: 'POS',
      icon: 'POS',
      primaryPath: '/pos',
      items: [
        { path: '/pos', label: 'POS Billing', icon: 'P', keywords: 'checkout bill billing' },
        { path: '/pos/invoices', label: 'POS Invoices', icon: 'IN', keywords: 'invoice paid due received' },
        { path: '/pos/holds', label: 'Hold Invoices', icon: 'HI', keywords: 'hold pending invoice' },
        { path: '/pos/tips', label: 'Tip Register', icon: 'TP', keywords: 'tips staff tip' },
        { path: '/pos/payment-modes', label: 'Payment Modes', icon: 'PM', keywords: 'cash card upi payment' },
        { path: '/memberships', label: 'Membership Sales', icon: 'MS', keywords: 'membership sale pos loyalty credits redemption' },
        { path: '/packages', label: 'Packages', icon: 'PK', keywords: 'package prepaid credits bundle' }
      ]
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: 'INV',
      primaryPath: '/inventory',
      items: [
        { path: '/inventory', label: 'Inventory', icon: 'I', keywords: 'stock products inventory' },
        { path: '/inventory/purchase-bill-drafts', label: 'AI Bill Drafts', icon: 'AI', keywords: 'ai purchase bill scanner draft invoice receiving' },
        { path: '/inventory/purchase-orders', label: 'Purchase Orders', icon: 'PO', keywords: 'purchase order po vendor' },
        { path: '/suppliers', label: 'Suppliers', icon: 'SP', keywords: 'supplier vendor gst purchase' },
        { path: '/services', label: 'Services', icon: 'S', keywords: 'service menu catalog' },
        { path: '/inventory/recipes', label: 'Service Recipes', icon: 'BOM', keywords: 'bom recipe service consumption' },
        { path: '/inventory/stock-audit', label: 'Stock Audit', icon: 'SA', keywords: 'audit count stock' },
        { path: '/inventory/reports', label: 'Inventory Reports', icon: 'IR', keywords: 'cogs margin expiry report' },
        { path: '/inventory/scanner', label: 'Inventory Scanner', icon: 'QR', keywords: 'barcode scanner qr' }
      ]
    },
    {
      id: 'staff',
      label: 'Staff',
      icon: 'ST',
      primaryPath: '/staff',
      items: [
        { path: '/staff', label: 'Staff', icon: 'T', keywords: 'employee staff team' },
        { path: '/staff/my-work', label: 'My Work', icon: 'MW', keywords: 'staff login live appointments own work report' },
        { path: '/staff/connected-modules', label: 'Connected Modules', icon: 'CM', keywords: 'staff connected modules reports appointment pos payroll' },
        { path: '/staff-os', label: 'Staff OS', icon: 'SO', keywords: 'hr operating system attendance payroll' },
        { path: '/staff-enterprise', label: 'Staff Enterprise', icon: 'SE', keywords: 'enterprise staff profile documents leave transfer reviews' },
        { path: '/staff-os/employee-masters', label: 'Employee Masters', icon: 'EM', keywords: 'flexi employee masters category attendance leave shift payroll' },
        { path: '/staff-os/attendance-master', label: 'Attendance Master', icon: 'AM', keywords: 'attendance master absent present holiday day count paid unpaid' },
        { path: '/staff-os/leave-master', label: 'Leave Master', icon: 'LM', keywords: 'leave master casual paid sick quota monthly yearly' },
        { path: '/staff-os/shift-master', label: 'Shift Master', icon: 'SM', keywords: 'shift master start time end time weekly off holiday leave' },
        { path: '/staff-os/attendance-category', label: 'Attendance Category', icon: 'AC', keywords: 'attendance category late mark overtime shift slabs' },
        { path: '/staff-os/attendance-dashboard', label: 'Attendance Dash', icon: 'AD', keywords: 'attendance dashboard biometric present absent late' },
        { path: '/staff-os/roster-calendar', label: 'Roster Calendar', icon: 'RC', keywords: 'roster schedule shift calendar availability' },
        { path: '/staff-os/leave-management', label: 'Leave Mgmt', icon: 'LV', keywords: 'leave request approval balance calendar' },
        { path: '/staff-os/target-incentives/service', label: 'Target Incentives', icon: 'TI', keywords: 'service product membership admin target incentive slabs flexi' },
        { path: '/staff-os/service-assignment', label: 'Service Assign', icon: 'SA', keywords: 'employee wise service assign operator admin flexi' },
        { path: '/staff-os/fines-penalties', label: 'Fines Penalty', icon: 'FP', keywords: 'fine penalty master payroll flexi' },
        { path: '/staff-os/allowance-deduction', label: 'Allowance Deduction', icon: 'AD', keywords: 'allowance deduction payroll master flexi' },
        { path: '/staff-os/payroll-salary-structure', label: 'Salary Structure', icon: 'PF', keywords: 'payroll salary structure pf pt esic tds statutory flexi' },
        { path: '/staff-os/payroll-dashboard', label: 'Payroll Dash', icon: 'PD', keywords: 'payroll export salary payout statutory' },
        { path: '/staff-os/bulk-employee-update', label: 'Bulk Employee Update', icon: 'BU', keywords: 'bulk master update employee pan aadhar statutory flexi' },
        { path: '/commissions', label: 'Commissions', icon: 'CM', keywords: 'commission incentives payout' },
        { path: '/staff-os/commission-dashboard', label: 'Commission Dash', icon: 'CD', keywords: 'commission rules payout incentive' },
        { path: '/staff-os/performance-dashboard', label: 'Performance', icon: 'PR', keywords: 'performance productivity staff ranking' },
        { path: '/staff-os/leaderboard', label: 'Leaderboard', icon: 'LB', keywords: 'leaderboard staff ranking gamification' },
        { path: '/reports/staff-sales', label: 'Staff Sales', icon: 'SSR', keywords: 'staff sales performance' },
        { path: '/reports/invoices', label: 'Invoice Reports', icon: 'IR', keywords: 'invoice reports service product membership gst due wallet discount audit' },
        { path: '/reports/commission-preview', label: 'Commission Preview', icon: 'CP', keywords: 'commission preview payroll' },
        { path: '/staff-os/training-center', label: 'Training Center', icon: 'TC', keywords: 'training staff lessons certification' },
        { path: '/training-academy', label: 'Academy', icon: 'TA', keywords: 'training lessons academy' },
        { path: '/pos/tips', label: 'Tips Register', icon: 'TP', keywords: 'tips payout staff pos' }
      ]
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: 'FN',
      primaryPath: '/finance',
      items: [
        { path: '/finance', label: 'Finance', icon: 'FN', keywords: 'cash expense finance' },
        { path: '/account-master', label: 'Account Master', icon: 'AM', keywords: 'ledger accounts chart' },
        { path: '/transactions/outgoing-funds', label: 'Transactions', icon: 'TR', keywords: 'outgoing funds payments' },
        { path: '/compliance', label: 'Compliance', icon: 'AC', keywords: 'statutory pf esi tax' }
      ]
    },
    {
      id: 'marketing',
      label: 'Marketing',
      icon: 'MK',
      primaryPath: '/marketing',
      items: [
        { path: '/marketing', label: 'Marketing', icon: 'W', keywords: 'campaign marketing automation' },
        { path: '/growth-rank-bot', label: 'AI Rank Bot', icon: 'RB', keywords: 'instagram facebook google rank local seo dhanda ai growth bot reviews' },
        { path: '/engagement', label: 'Engagement Center', icon: 'EC', keywords: 'unified inbox hyperconnect client engagement whatsapp email calls' },
        { path: '/whatsapp', label: 'WhatsApp', icon: 'WA', keywords: 'whatsapp campaign chat' },
        { path: '/message-logs', label: 'Messages', icon: 'ML', keywords: 'message logs communication' },
        { path: '/reputation', label: 'Reviews', icon: 'RV', keywords: 'reviews reputation google' },
        { path: '/growth-advisor', label: 'Growth AI', icon: 'GA', keywords: 'growth advisor ai' },
        { path: '/smart-forms', label: 'Smart Forms', icon: 'SF', keywords: 'forms consent smart' },
        { path: '/recommendation-engine', label: 'Recommend AI', icon: 'RE', keywords: 'recommendation upsell ai' },
        { path: '/notification-center', label: 'Notify Center', icon: 'NC', keywords: 'notifications alerts' }
      ]
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: 'AD',
      primaryPath: '/settings',
      items: [
        { path: '/super-admin', label: 'Super Admin', icon: 'SA', keywords: 'tenant admin platform' },
        { path: '/saas', label: 'SaaS', icon: 'X', keywords: 'saas onboarding tenant' },
        { path: '/branches', label: 'Branches', icon: 'B', keywords: 'branch location' },
        { path: '/settings', label: 'Settings', icon: 'G', keywords: 'settings configuration' },
        { path: '/permissions', label: 'Permissions', icon: 'PM', keywords: 'role rbac permission' },
        { path: '/security', label: 'Security', icon: 'SL', keywords: 'security auth sessions' },
        { path: '/audit-logs', label: 'Audit Logs', icon: 'AL', keywords: 'audit logs activity' },
        { path: '/business-details', label: 'Business Details', icon: 'BD', keywords: 'business profile details' },
        { path: '/data-migration', label: 'Data Migration', icon: 'DM', keywords: 'import migration data' },
        { path: '/deployment', label: 'Deployment', icon: 'DP', keywords: 'deployment release' },
        { path: '/offline', label: 'Offline', icon: 'OF', keywords: 'offline sync pos' },
        { path: '/white-label', label: 'White Label', icon: 'WL', keywords: 'brand theme white label' },
        { path: '/quality', label: 'Quality', icon: 'QA', keywords: 'quality checks qa' }
      ]
    },
    {
      id: 'ai-platform',
      label: 'AI Platform',
      icon: 'AI',
      primaryPath: '/ai',
      items: [
        { path: '/ai', label: 'AI Assistant', icon: 'A', keywords: 'assistant ai' },
        { path: '/future-features', label: 'Future AI', icon: 'F', keywords: 'future features ai' },
        { path: '/workflows', label: 'Workflows', icon: 'WF', keywords: 'workflow automation' },
        { path: '/voice-receptionist', label: 'Voice AI', icon: 'VR', keywords: 'voice receptionist ai' },
        { path: '/dynamic-pricing', label: 'Pricing AI', icon: 'DP', keywords: 'dynamic pricing ai' },
        { path: '/franchise', label: 'Franchise', icon: 'FR', keywords: 'franchise expansion' },
        { path: '/image-analysis', label: 'Image AI', icon: 'IA', keywords: 'image analysis ai' },
        { path: '/marketplace-integrations', label: 'Integrations', icon: 'IN', keywords: 'integrations marketplace' },
        { path: '/gamification', label: 'Gamification', icon: 'GM', keywords: 'points badges gamification' },
        { path: '/fraud-detection', label: 'Fraud AI', icon: 'FD', keywords: 'fraud detection risk' },
        { path: '/appointment-optimization', label: 'Appt Optimize', icon: 'AO', keywords: 'appointment optimization ai' },
        { path: '/developer-api', label: 'API Platform', icon: 'API', keywords: 'api platform developer' },
        { path: '/webhooks', label: 'Webhooks', icon: 'WH', keywords: 'webhooks api events' },
        { path: '/knowledge-base', label: 'Knowledge', icon: 'KB', keywords: 'knowledge base ai' },
        { path: '/plugins', label: 'Plugins', icon: 'PL', keywords: 'plugins extension' },
        { path: '/app-marketplace', label: 'Marketplace', icon: 'AM', keywords: 'marketplace apps' },
        { path: '/localization', label: 'Countries', icon: 'LC', keywords: 'localization countries tax' },
        { path: '/design-system', label: 'Design', icon: 'DS', keywords: 'design system ui' },
        { path: '/prd', label: 'PRD', icon: 'P', keywords: 'product requirements prd' }
      ]
    }
  ];

  readonly visibleNavGroups = computed(() => {
    const term = this.navQuery().trim().toLowerCase();
    if (!term) return this.navGroups;
    return this.navGroups
      .map((group) => {
        const groupMatches = `${group.label} ${group.id}`.toLowerCase().includes(term);
        const items = groupMatches ? group.items : group.items.filter((item) => this.navItemText(item, group).includes(term));
        return { ...group, items };
      })
      .filter((group) => group.items.length);
  });
  readonly activePageLabel = computed(() => {
    return this.pageLabelForUrl(this.activeRoute()) || 'Command workspace';
  });
  readonly backButtonLabel = computed(() => {
    const previous = this.previousRoute();
    if (previous && previous !== this.activeRoute()) {
      return `Back to ${this.pageLabelForUrl(previous) || 'previous page'}`;
    }
    return 'Back to Dashboard';
  });

  constructor(
    readonly api: ApiService,
    readonly state: AppStateService,
    readonly session: AuthSessionService,
    private readonly router: Router
  ) {
    delete document.documentElement.dataset.theme;
    this.isPortal.set(this.isPortalUrl(this.router.url));
    this.activeRoute.set(this.router.url);
    this.ensureActiveGroupExpanded(this.router.url);
    window.addEventListener('aura:app-error', (event) => {
      this.globalError.set(this.readGlobalError((event as CustomEvent<{ message: unknown }>).detail?.message));
    });
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const url = (event as NavigationEnd).urlAfterRedirects;
      const current = this.activeRoute();
      if (url !== current && this.isBackHistoryCandidate(current)) {
        this.previousRoute.set(current);
      }
      this.isPortal.set(this.isPortalUrl(url));
      this.activeRoute.set(url);
      this.ensureActiveGroupExpanded(url);
    });
    effect(() => {
      this.state.selectedTenantId();
      this.session.session();
      if (this.session.isAuthenticated()) {
        this.loadTenants();
        this.loadBranches();
      }
    });
  }

  login(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.loginBusy.set(true);
    this.loginError.set('');
    this.session.login(this.loginForm.getRawValue() as { tenantId: string; email: string; password: string; branchId?: string }).subscribe({
      next: (session) => {
        this.state.setTenant(session.tenant.id);
        this.state.setRole(session.user.role as UserRole);
        this.state.setBranch(session.user.branchId || '');
        this.loginBusy.set(false);
        this.loadTenants();
        this.loadBranches();
      },
      error: (error) => {
        this.loginError.set(error?.error?.error?.message || error?.error?.error || error?.message || 'Unable to sign in');
        this.loginBusy.set(false);
      }
    });
  }

  logout(): void {
    this.session.logout();
  }

  goBack(): void {
    const current = this.activeRoute();
    const previous = this.previousRoute();
    if (previous && previous !== current) {
      this.router.navigateByUrl(previous);
      return;
    }
    if (current !== '/dashboard') {
      this.router.navigateByUrl('/dashboard');
    }
  }

  loadBranches(): void {
    this.api.list<ApiRecord[]>('branches').subscribe({
      next: (branches) => {
        const rows = branches || [];
        this.branches.set(rows);
        const selectedBranchId = this.state.selectedBranchId();
        const selectedExists = rows.some((branch) => branch.id === selectedBranchId);
        if (rows.length && (!selectedBranchId || !selectedExists)) {
          this.state.setBranch(rows[0].id);
        }
      },
      error: () => this.branches.set([])
    });
  }

  loadTenants(): void {
    this.api.list<ApiRecord[]>('tenants', { limit: 1000 }).subscribe({
      next: (tenants) => {
        const businessTenants = tenants.filter((tenant) => !this.isGeneratedTestTenant(tenant.id));
        const tenantOptions = businessTenants.length ? businessTenants : tenants;
        const orderedTenants = [...tenantOptions].sort((left, right) => {
          if (left.id === 'tenant_aura') return -1;
          if (right.id === 'tenant_aura') return 1;
          return String(left.name || left.id).localeCompare(String(right.name || right.id));
        });
        this.tenants.set(orderedTenants);
        const selectedTenant = this.state.selectedTenantId();
        if (orderedTenants.length && !orderedTenants.some((tenant) => tenant.id === selectedTenant)) {
          this.state.setTenant(orderedTenants.find((tenant) => tenant.id === 'tenant_aura')?.id || orderedTenants[0].id);
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

  openNavGroup(group: NavGroup): void {
    if (this.sidebarCompact()) {
      this.router.navigateByUrl(group.primaryPath);
      return;
    }
    const current = new Set(this.expandedGroupIds());
    if (current.has(group.id)) current.delete(group.id);
    else current.add(group.id);
    this.expandedGroupIds.set([...current]);
    localStorage.setItem('aura.expandedNavGroups', JSON.stringify([...current]));
  }

  rememberNavGroup(groupId: string): void {
    const current = new Set(this.expandedGroupIds());
    current.add(groupId);
    this.expandedGroupIds.set([...current]);
    localStorage.setItem('aura.expandedNavGroups', JSON.stringify([...current]));
  }

  toggleSidebarCompact(): void {
    const next = !this.sidebarCompact();
    this.sidebarCompact.set(next);
    localStorage.setItem('aura.sidebarCompact', next ? '1' : '0');
  }

  isGroupExpanded(group: NavGroup): boolean {
    return Boolean(this.navQuery()) || this.expandedGroupIds().includes(group.id);
  }

  isGroupActive(group: NavGroup): boolean {
    const url = this.activeRoute();
    return group.items.some((item) => this.isRouteActive(url, item.path));
  }

  private ensureActiveGroupExpanded(url: string): void {
    const group = this.navGroups.find((item) => item.items.some((navItem) => this.isRouteActive(url, navItem.path)));
    if (!group || this.expandedGroupIds().includes(group.id)) return;
    const next = [...this.expandedGroupIds(), group.id];
    this.expandedGroupIds.set(next);
    localStorage.setItem('aura.expandedNavGroups', JSON.stringify(next));
  }

  private navItemText(item: NavItem, group: NavGroup): string {
    return `${item.label} ${item.path} ${item.icon} ${item.keywords || ''} ${group.label}`.toLowerCase();
  }

  private isRouteActive(url: string, path: string): boolean {
    const cleanUrl = this.routePath(url);
    return cleanUrl === path || cleanUrl.startsWith(`${path}/`);
  }

  private pageLabelForUrl(url: string): string {
    return this.navGroups
      .flatMap((group) => group.items)
      .find((item) => this.isRouteActive(url, item.path))?.label || '';
  }

  private routePath(url: string): string {
    return (url || '/').split(/[?#]/)[0] || '/';
  }

  private isBackHistoryCandidate(url: string): boolean {
    const path = this.routePath(url);
    return Boolean(path && path !== '/' && !this.isPortalUrl(path) && !path.startsWith('/auth'));
  }

  private isPortalUrl(url: string): boolean {
    const path = this.routePath(url);
    return path.startsWith('/book') || path.startsWith('/salon-3d');
  }

  private isGeneratedTestTenant(tenantId: unknown): boolean {
    return /^tenant_(ai|import)_/i.test(String(tenantId || ''));
  }

  private readExpandedGroups(): string[] {
    try {
      const parsed = JSON.parse(localStorage.getItem('aura.expandedNavGroups') || '[]');
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : ['frontdesk', 'pos', 'inventory'];
    } catch {
      return ['frontdesk', 'pos', 'inventory'];
    }
  }

  private readGlobalError(message: unknown): string {
    if (typeof message === 'string') return message;
    if (message && typeof message === 'object') {
      const value = message as { message?: unknown; code?: unknown };
      if (typeof value.message === 'string') return value.message;
      if (typeof value.code === 'string') return value.code;
    }
    return 'Unexpected application error';
  }
}
