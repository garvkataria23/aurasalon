import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BillingApi } from '../../data/billing.api';
import { Invoice } from '../../domain/invoice.model';
import { InvoicePreviewComponent } from '../../ui/invoice-preview/invoice-preview.component';
import { RefundModalComponent } from '../../ui/refund-modal/refund-modal.component';
import { VoidInvoiceModalComponent } from '../../ui/void-invoice-modal/void-invoice-modal.component';

@Component({
  selector: 'app-invoice-detail-page',
  standalone: true,
  imports: [CommonModule, InvoicePreviewComponent, RefundModalComponent, VoidInvoiceModalComponent],
  template: `
    <app-invoice-preview [invoice]="invoice()" />
    <app-refund-modal (refund)="refund($event)" />
    <app-void-invoice-modal (voidInvoice)="voidReason.set($event)" />
    <p *ngIf="message()">{{ message() }}</p>
  `
})
export class InvoiceDetailPageComponent implements OnInit {
  readonly invoice = signal<Invoice | null>(null);
  readonly message = signal('');
  readonly voidReason = signal('');
  private id = '';

  constructor(private readonly route: ActivatedRoute, private readonly api: BillingApi) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.api.invoice(this.id).subscribe((invoice) => this.invoice.set(invoice));
  }

  refund(payload: { amount: number; reason: string }): void {
    this.api.refund(this.id, payload).subscribe(() => this.message.set('Refund workflow started'));
  }
}
