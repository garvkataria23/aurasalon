import { Routes } from '@angular/router';

export const CLIENT_MASTERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/client-masters.page').then((m) => m.ClientMastersPage),
    title: 'Client Masters'
  }
];
