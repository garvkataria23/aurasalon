import { Routes } from '@angular/router';

export const BILLING_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'core-money-flow' },
  { path: 'core-money-flow', loadComponent: () => import('./pages/core-money-flow-page/core-money-flow-page.component').then((m) => m.CoreMoneyFlowPageComponent), title: 'Core Money Flow Readiness' },
  { path: 'pos', loadComponent: () => import('./pages/pos-page/pos-page.component').then((m) => m.PosPageComponent), title: 'Enterprise POS' },
  { path: 'invoices', loadComponent: () => import('./pages/invoice-list-page/invoice-list-page.component').then((m) => m.InvoiceListPageComponent), title: 'Invoices' },
  { path: 'invoices/:id', loadComponent: () => import('./pages/invoice-detail-page/invoice-detail-page.component').then((m) => m.InvoiceDetailPageComponent), title: 'Invoice Detail' },
  { path: 'refunds', loadComponent: () => import('./pages/refunds-page/refunds-page.component').then((m) => m.RefundsPageComponent), title: 'Refunds' },
  { path: 'daily-closing', loadComponent: () => import('./pages/daily-closing-page/daily-closing-page.component').then((m) => m.DailyClosingPageComponent), title: 'Daily Closing' },
  { path: 'reconciliation', loadComponent: () => import('./pages/reconciliation-page/reconciliation-page.component').then((m) => m.ReconciliationPageComponent), title: 'Reconciliation' }
];
