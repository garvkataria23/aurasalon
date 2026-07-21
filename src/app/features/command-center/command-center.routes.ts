import { Routes } from '@angular/router';
import { CommandCenterStore } from './application/command-center.store';

export const COMMAND_CENTER_ROUTES: Routes = [
  {
    path: '',
    providers: [CommandCenterStore],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'ai-workforce-dashboard' },
      { path: 'ai-workforce-dashboard', loadComponent: () => import('./pages/ai-workforce-dashboard.page').then((m) => m.AiWorkforceDashboardPage), title: 'AI Workforce' },
      { path: 'engagement', loadComponent: () => import('../../pages/engagement-command-center.component').then((m) => m.EngagementCommandCenterComponent), title: 'Engagement Command Center' },
      { path: 'ai-ceo-daily-brief', loadComponent: () => import('./pages/ai-ceo-daily-brief.page').then((m) => m.AiCeoDailyBriefPage), title: 'AI CEO Daily Brief' },
      { path: 'approval-hub', loadComponent: () => import('./pages/approval-hub.page').then((m) => m.ApprovalHubPage), title: 'Approval Hub' },
      { path: 'ai-model-router', loadComponent: () => import('./pages/ai-model-router.page').then((m) => m.AiModelRouterPage), title: 'AI Model Router' },
      { path: 'event-ledger', loadComponent: () => import('./pages/event-ledger.page').then((m) => m.EventLedgerPage), title: 'Event Ledger' },
      { path: 'oversight', loadComponent: () => import('../../pages/oversight-command-center.component').then((m) => m.OversightCommandCenterComponent), title: 'Oversight Command Center' },
      { path: 'multi-branch-war-room', loadComponent: () => import('./pages/multi-branch-war-room.page').then((m) => m.MultiBranchWarRoomPage), title: 'Multi-Branch War Room' },
      { path: 'revenue-leak-center', loadComponent: () => import('./pages/revenue-leak-center.page').then((m) => m.RevenueLeakCenterPage), title: 'Revenue Leak Center' },
      { path: 'digital-twin-simulator', loadComponent: () => import('./pages/digital-twin-simulator.page').then((m) => m.DigitalTwinSimulatorPage), title: 'Digital Twin' },
      { path: 'digital-twin-v2', loadComponent: () => import('./pages/digital-twin-v2.page').then((m) => m.DigitalTwinV2Page), title: 'Digital Twin v2' },
      { path: 'owner-command-center', loadComponent: () => import('./pages/owner-command-center.page').then((m) => m.OwnerCommandCenterPage), title: 'Owner Command Center' },
      { path: 'whatsapp-campaign-planner', loadComponent: () => import('./pages/whatsapp-campaign-planner.page').then((m) => m.WhatsappCampaignPlannerPage), title: 'WhatsApp Campaign Planner' },
      { path: 'customer-super-graph', loadComponent: () => import('./pages/customer-super-graph.page').then((m) => m.CustomerSuperGraphPage), title: 'Customer Super Graph' },
      { path: 'client-memory-graph', loadComponent: () => import('./pages/client-memory-graph.page').then((m) => m.ClientMemoryGraphPage), title: 'Client Memory Graph' },

      { path: 'computer-vision-readiness', loadComponent: () => import('./pages/computer-vision-readiness.page').then((m) => m.ComputerVisionReadinessPage), title: 'Computer Vision Readiness' },
      { path: 'whatsapp-commerce', loadComponent: () => import('./pages/whatsapp-commerce.page').then((m) => m.WhatsappCommercePage), title: 'WhatsApp Commerce' },
      { path: 'owner-mobile', loadComponent: () => import('./pages/owner-mobile.page').then((m) => m.OwnerMobilePage), title: 'Owner Mobile' },
      { path: 'franchise-os', loadComponent: () => import('./pages/franchise-os.page').then((m) => m.FranchiseOsPage), title: 'Franchise OS' },
      { path: 'financial-brain', loadComponent: () => import('./pages/financial-brain.page').then((m) => m.FinancialBrainPage), title: 'Financial Brain' },
      { path: 'marketplace-platform', loadComponent: () => import('./pages/marketplace-platform.page').then((m) => m.MarketplacePlatformPage), title: 'Marketplace Platform' },
      { path: 'cloud-hardening', loadComponent: () => import('./pages/cloud-hardening.page').then((m) => m.CloudHardeningPage), title: 'Cloud Hardening' },
      { path: 'inventory-autopilot', loadComponent: () => import('./pages/inventory-autopilot.page').then((m) => m.InventoryAutopilotPage), title: 'Inventory Autopilot' },
      { path: 'payment-intelligence', loadComponent: () => import('./pages/payment-intelligence.page').then((m) => m.PaymentIntelligencePage), title: 'Payment Intelligence' },
      { path: 'observability-center', loadComponent: () => import('./pages/observability-center.page').then((m) => m.ObservabilityCenterPage), title: 'Observability Center' },
      { path: 'security-hardening', loadComponent: () => import('./pages/security-hardening.page').then((m) => m.SecurityHardeningPage), title: 'Security Hardening' },
      { path: 'data-warehouse', loadComponent: () => import('./pages/data-warehouse.page').then((m) => m.DataWarehousePage), title: 'Data Warehouse' }
    ]
  }
];
