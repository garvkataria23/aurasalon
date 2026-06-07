import { Injectable, signal } from '@angular/core';

@Injectable()
export class BillingStore {
  readonly selectedCustomerId = signal('');
  readonly selectedBranchId = signal('');
  readonly draftAutosaveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly permission = signal({ canRefund: true, canVoid: true });
}
