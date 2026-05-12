import { Injectable, computed, signal } from '@angular/core';

export type UserRole =
  | 'superAdmin'
  | 'owner'
  | 'admin'
  | 'manager'
  | 'receptionist'
  | 'frontDesk'
  | 'staff'
  | 'accountant'
  | 'inventoryManager'
  | 'analyst'
  | 'customMarketingLead';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  readonly selectedTenantId = signal(localStorage.getItem('aura.selectedTenantId') || 'tenant_aura');
  readonly selectedBranchId = signal(localStorage.getItem('aura.selectedBranchId') || '');
  readonly userRole = signal<UserRole>((localStorage.getItem('aura.userRole') as UserRole) || 'owner');
  readonly globalSearch = signal('');

  readonly tenantScopeLabel = computed(() => this.selectedTenantId());
  readonly branchScopeLabel = computed(() => this.selectedBranchId() || 'All branches');
  readonly canManageSettings = computed(() => ['superAdmin', 'owner', 'admin'].includes(this.userRole()));

  setTenant(tenantId: string): void {
    this.selectedTenantId.set(tenantId || 'tenant_aura');
    localStorage.setItem('aura.selectedTenantId', tenantId || 'tenant_aura');
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
}
