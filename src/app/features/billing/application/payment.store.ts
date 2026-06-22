import { Injectable, signal } from '@angular/core';
import { SplitPaymentLine } from '../domain/payment.model';

@Injectable()
export class PaymentStore {
  readonly splitPayments = signal<SplitPaymentLine[]>([
    { mode: 'cash', amount: 0 },
    { mode: 'upi', amount: 0 }
  ]);

  readonly paymentBusy = signal(false);
}
