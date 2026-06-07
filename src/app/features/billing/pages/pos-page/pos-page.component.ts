import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { ServiceProductPickerComponent } from '../../ui/service-product-picker/service-product-picker.component';
import { InvoiceCartComponent } from '../../ui/invoice-cart/invoice-cart.component';
import { CustomerPanelComponent } from '../../ui/customer-panel/customer-panel.component';
import { PaymentModalComponent } from '../../ui/payment-modal/payment-modal.component';
import { SplitPaymentComponent } from '../../ui/split-payment/split-payment.component';
import { TaxBreakdownComponent } from '../../ui/tax-breakdown/tax-breakdown.component';
import { InvoicePreviewComponent } from '../../ui/invoice-preview/invoice-preview.component';
import { PrintSettingsComponent } from '../../ui/print-settings/print-settings.component';
import { BarcodeInputComponent } from '../../ui/barcode-input/barcode-input.component';
import { PosCartStore } from '../../application/pos-cart.store';
import { PaymentStore } from '../../application/payment.store';
import { BillingStore } from '../../application/billing.store';
import { OfflineSyncStore } from '../../application/offline-sync.store';
import { PrintStore } from '../../application/print.store';
import { BillingRepository } from '../../data/billing.repository';

@Component({
  selector: 'app-enterprise-pos-page',
  standalone: true,
  providers: [PosCartStore, PaymentStore, BillingStore, OfflineSyncStore, PrintStore],
  imports: [CommonModule, ServiceProductPickerComponent, InvoiceCartComponent, CustomerPanelComponent, PaymentModalComponent, SplitPaymentComponent, TaxBreakdownComponent, InvoicePreviewComponent, PrintSettingsComponent, BarcodeInputComponent],
  styles: [`
    .billing-shell { display: grid; grid-template-columns: 280px minmax(0, 1fr) 320px; gap: 16px; padding: 16px; }
    .billing-panel { border: 1px solid #dbe3e8; border-radius: 8px; padding: 14px; background: #fff; }
    .stack { display: grid; gap: 12px; }
    .status-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .badge { border-radius: 999px; background: #e7f5f2; color: #087568; padding: 6px 10px; font-weight: 700; }
    .badge.offline { background: #fff1f0; color: #b42318; }
    @media (max-width: 900px) { .billing-shell { grid-template-columns: 1fr; } }
  `],
  template: `
    <section class="stack">
      <header class="billing-panel status-row">
        <div>
          <h1>Enterprise POS Billing</h1>
          <p>Draft autosave, barcode input, split payment, refund/void guards, print and WhatsApp-ready invoice flow.</p>
        </div>
        <span class="badge" [class.offline]="!offline.online()">{{ offline.badge() }}</span>
      </header>
      <div class="billing-shell">
        <section class="stack">
          <app-barcode-input (scanned)="print.resolveBarcode($event, '', billing.selectedBranchId())" />
          <app-service-product-picker (itemPicked)="cart.add($event)" />
        </section>
        <main class="stack">
          <app-invoice-cart [items]="cart.items()" (remove)="cart.remove($event)" />
          <app-tax-breakdown [taxTotal]="cart.tax()" />
          <app-split-payment [payments]="payments.splitPayments()" />
        </main>
        <aside class="stack">
          <app-customer-panel (customerChange)="billing.selectedCustomerId.set($event)" />
          <app-payment-modal [total]="cart.total()" (checkout)="createDraft()" />
          <app-invoice-preview [invoice]="repo.selectedInvoice()" />
          <app-print-settings
            [devices]="print.devices()"
            [selectedDeviceId]="print.selectedDeviceId()"
            (selectedDeviceIdChange)="print.selectedDeviceId.set($event)"
            (refresh)="print.loadDevices()"
          />
          <button type="button">Thermal print</button>
          <button type="button">WhatsApp invoice</button>
        </aside>
      </div>
    </section>
  `
})
export class PosPageComponent {
  readonly cart = inject(PosCartStore);
  readonly payments = inject(PaymentStore);
  readonly billing = inject(BillingStore);
  readonly offline = inject(OfflineSyncStore);
  readonly print = inject(PrintStore);
  readonly repo = inject(BillingRepository);

  constructor() {
    this.print.loadDevices();
    effect(() => {
      if (this.cart.items().length) this.billing.draftAutosaveState.set('saved');
    });
  }

  createDraft(): void {
    this.repo.createDraft({
      branch_id: this.billing.selectedBranchId() || 'branch_hyd',
      customer_id: this.billing.selectedCustomerId(),
      invoice_type: this.cart.items().some((item) => item.item_type === 'product') ? 'mixed' : 'service',
      source: 'enterprise_pos',
      items: this.cart.items()
    });
  }
}
