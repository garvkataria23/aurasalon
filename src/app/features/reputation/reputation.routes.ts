import { Routes } from '@angular/router';

export const REPUTATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/reputation-command-center.page').then((m) => m.ReputationCommandCenterPage),
    title: 'Reputation Command Center'
  },
  {
    path: 'inbox',
    loadComponent: () => import('./pages/reviews-inbox.page').then((m) => m.ReviewsInboxPage),
    title: 'Reviews Inbox'
  }
];
