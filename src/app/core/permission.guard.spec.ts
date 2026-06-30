// Tests the GRANTS permission matrix logic without Angular DI.
// The allows() function is internal, so we replicate its logic here to validate the matrix.

const GRANTS: Record<string, string[]> = {
  superAdmin: ['*'],
  owner: ['*'],
  admin: ['*'],
  manager: [
    'read:*', 'write:clients', 'write:appointments', 'write:services',
    'write:products', 'write:inventory', 'write:sales', 'write:invoices',
    'write:payments', 'write:appointment_deposits', 'write:staff'
  ],
  receptionist: [
    'read:*', 'write:clients', 'write:appointments', 'write:sales',
    'write:invoices', 'write:payments', 'write:appointment_deposits'
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

describe('Permission GRANTS matrix', () => {
  // Superuser roles
  it('owner can do everything', () => {
    expect(allows('owner', 'write:finance')).toBe(true);
    expect(allows('owner', 'write:super_admin')).toBe(true);
    expect(allows('owner', 'read:audit')).toBe(true);
  });

  it('superAdmin can do everything', () => {
    expect(allows('superAdmin', 'write:invoices')).toBe(true);
  });

  // Manager
  it('manager can write invoices and read anything', () => {
    expect(allows('manager', 'write:invoices')).toBe(true);
    expect(allows('manager', 'read:clients')).toBe(true);
    expect(allows('manager', 'read:analytics')).toBe(true);
  });

  it('manager cannot write finance', () => {
    expect(allows('manager', 'write:finance')).toBe(false);
  });

  // Receptionist
  it('receptionist can write appointments', () => {
    expect(allows('receptionist', 'write:appointments')).toBe(true);
  });

  it('receptionist cannot write finance', () => {
    expect(allows('receptionist', 'write:finance')).toBe(false);
  });

  it('receptionist cannot write inventory', () => {
    expect(allows('receptionist', 'write:inventory')).toBe(false);
  });

  // Cashier
  it('cashier can read and write finance', () => {
    expect(allows('cashier', 'read:finance')).toBe(true);
    expect(allows('cashier', 'write:finance')).toBe(true);
  });

  it('cashier cannot write appointments', () => {
    expect(allows('cashier', 'write:appointments')).toBe(false);
  });

  // Accountant
  it('accountant can write finance and invoices', () => {
    expect(allows('accountant', 'write:finance')).toBe(true);
    expect(allows('accountant', 'write:invoices')).toBe(true);
  });

  it('accountant cannot write clients', () => {
    expect(allows('accountant', 'write:clients')).toBe(false);
  });

  // Inventory manager
  it('inventoryManager can write inventory and suppliers', () => {
    expect(allows('inventoryManager', 'write:inventory')).toBe(true);
    expect(allows('inventoryManager', 'write:suppliers')).toBe(true);
  });

  it('inventoryManager cannot write invoices', () => {
    expect(allows('inventoryManager', 'write:invoices')).toBe(false);
  });

  // Staff
  it('staff can write appointments', () => {
    expect(allows('staff', 'write:appointments')).toBe(true);
  });

  it('staff cannot read finance', () => {
    expect(allows('staff', 'read:finance')).toBe(false);
  });

  it('staff cannot read analytics', () => {
    expect(allows('staff', 'read:analytics')).toBe(false);
  });

  // Unknown role
  it('unknown role has no permissions', () => {
    expect(allows('guest', 'read:clients')).toBe(false);
    expect(allows('', 'write:invoices')).toBe(false);
  });
});
