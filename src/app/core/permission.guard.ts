import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppStateService } from './state/app-state.service';

const GRANTS: Record<string, string[]> = {
  superAdmin: ['*'],
  owner: ['*'],
  admin: ['*'],
  manager: [
    'read:*',
    'write:clients',
    'write:appointments',
    'write:services',
    'write:products',
    'write:inventory',
    'write:sales',
    'write:invoices',
    'write:payments',
    'write:appointment_deposits',
    'write:staff'
  ],
  receptionist: [
    'read:*',
    'write:clients',
    'write:appointments',
    'write:sales',
    'write:invoices',
    'write:payments',
    'write:appointment_deposits'
  ],
  frontDesk: [
    'read:*',
    'write:clients',
    'write:appointments',
    'write:sales',
    'write:invoices',
    'write:payments',
    'write:appointment_deposits'
  ],
  cashier: ['read:*', 'write:clients', 'write:sales', 'write:invoices', 'write:payments', 'read:appointment_deposits', 'read:finance', 'write:finance'],
  accountant: ['read:*', 'write:finance', 'write:invoices', 'write:payments', 'read:appointment_deposits'],
  inventoryManager: ['read:*', 'write:products', 'write:inventory', 'write:suppliers'],
  staff: ['read:staff', 'read:appointments', 'read:clients', 'read:services', 'write:appointments'],
  analyst: ['read:*', 'write:analytics']
};

function allows(role: string, perm: string): boolean {
  const grants = GRANTS[role] || [];
  if (grants.includes('*')) return true;
  if (grants.includes(perm)) return true;
  const [action] = perm.split(':');
  return grants.includes(`${action}:*`);
}

export const permissionGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const state = inject(AppStateService);
  const required = route.data?.['permission'];
  const role = state.userRole();
  const perms = Array.isArray(required) ? required : required ? [required] : [];
  if (perms.length === 0) return true;
  const ok = perms.every((permission: string) => allows(role, permission));
  return ok ? true : router.createUrlTree(['/dashboard']);
};
