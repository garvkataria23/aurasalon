import { Injectable, computed, signal } from '@angular/core';

export type UserRole =
  | 'superAdmin'
  | 'owner'
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'receptionist'
  | 'frontDesk'
  | 'staff'
  | 'accountant'
  | 'inventoryManager'
  | 'analyst'
  | 'customMarketingLead'
  | (string & {});

const DEFAULT_TENANT_ID = 'tenant_aura';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  readonly selectedTenantId = signal(this.normalizeTenantId(localStorage.getItem('aura.selectedTenantId')));
  readonly selectedBranchId = signal(localStorage.getItem('aura.selectedBranchId') || '');
  readonly userRole = signal<UserRole>((localStorage.getItem('aura.userRole') as UserRole) || 'owner');
  readonly globalSearch = signal('');

  readonly tenantScopeLabel = computed(() => this.selectedTenantId());
  readonly branchScopeLabel = computed(() => this.selectedBranchId() || 'All branches');
  readonly canManageSettings = computed(() => ['superAdmin', 'owner', 'admin'].includes(this.userRole()));

  setTenant(tenantId: string): void {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    this.selectedTenantId.set(normalizedTenantId);
    localStorage.setItem('aura.selectedTenantId', normalizedTenantId);
    this.setBranch('');
  }

  setBranch(branchId: string): void {
    this.selectedBranchId.set(branchId);
    localStorage.setItem('aura.selectedBranchId', branchId);
  }

  setRole(role: UserRole): void {
    this.userRole.set(role);
    localStorage.setItem('aura.userRole', role);
  }

  private normalizeTenantId(tenantId: string | null): string {
    const value = tenantId || DEFAULT_TENANT_ID;
    if (/^tenant_(ai|import)_/i.test(value)) return DEFAULT_TENANT_ID;
    return value;
  }
}
