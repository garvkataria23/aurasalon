import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingRepository } from '../../data/billing.repository';

@Component({
  selector: 'app-invoice-list-page',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink],
  template: `
    <section class="billing-panel">
      <h1>Invoices</h1>
      <p *ngIf="repo.loading()">Loading invoices...</p>
      <p *ngIf="repo.error()">{{ repo.error() }}</p>
      <p *ngIf="!repo.loading() && !repo.invoices().length">No invoices found.</p>
      <a *ngFor="let invoice of repo.invoices()" [routerLink]="['/billing/invoices', invoice.id]">
        {{ invoice.invoice_no }} - {{ invoice.grand_total | currency:'INR' }} - {{ invoice.payment_status }}
      </a>
    </section>
  `
})
export class InvoiceListPageComponent implements OnInit {
  constructor(readonly repo: BillingRepository) {}
  ngOnInit(): void {
    this.repo.loadInvoices();
  }
}
