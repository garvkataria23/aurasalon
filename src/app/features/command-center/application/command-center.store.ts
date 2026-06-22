import { Injectable, computed, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ApiRecord } from '../../../core/api.service';
import { CommandCenterApi } from '../data/command-center.api';
import { CommandCenterConfig, CommandCenterMetric, CommandCenterModule, CommandCenterRecord } from '../domain/command-center.models';

export const commandCenterConfigs: Record<CommandCenterModule, CommandCenterConfig> = {
  'ai-workforce': {
    module: 'ai-workforce',
    title: 'AI Workforce Dashboard',
    subtitle: 'Explainable AI agents, safety scores and approval-required decisions.',
    primaryEndpoint: 'ai-workforce/agents',
    secondaryEndpoint: 'ai-workforce/decisions',
    actionEndpoint: 'ai-workforce/agents',
    actionLabel: 'Register agent'
  },
  'ai-ceo': {
    module: 'ai-ceo',
    title: 'AI CEO Daily Brief',
    subtitle: 'Today top actions across revenue, staff, inventory, cash, campaigns and branch risk.',
    primaryEndpoint: 'ai-ceo/actions',
    secondaryEndpoint: 'ai-ceo/daily-brief',
    actionEndpoint: 'ai-ceo/daily-brief',
    actionLabel: 'Generate brief'
  },
  'approval-hub': {
    module: 'approval-hub',
    title: 'Autonomous Approval Hub',
    subtitle: 'Approve, reject, snooze, delegate and request evidence for AI recommendations.',
    primaryEndpoint: 'approval-hub/requests',
    actionEndpoint: 'approval-hub/requests',
    actionLabel: 'Create approval'
  },
  'model-router': {
    module: 'model-router',
    title: 'AI Model Router',
    subtitle: 'Route OpenAI, Gemini, Claude or local models by cost, latency and accuracy policy.',
    primaryEndpoint: 'ai-model-router/providers',
    secondaryEndpoint: 'ai-model-router/metrics',
    actionEndpoint: 'ai-model-router/route',
    actionLabel: 'Route model'
  },
  'event-ledger': {
    module: 'event-ledger',
    title: 'Event-Sourcing Ledger',
    subtitle: 'Append-only booking, invoice, salary, stock and payment event audit replay.',
    primaryEndpoint: 'event-ledger/events',
    actionEndpoint: 'event-ledger/events',
    actionLabel: 'Append event'
  },
  'war-room': {
    module: 'war-room',
    title: 'Multi-Branch War Room',
    subtitle: 'Live branch risk map for revenue, manpower, fraud, stockout, burnout and cash close.',
    primaryEndpoint: 'war-room/alerts',
    secondaryEndpoint: 'war-room/snapshot',
    actionEndpoint: 'war-room/snapshot',
    actionLabel: 'Create snapshot'
  },
  'revenue-leaks': {
    module: 'revenue-leaks',
    title: 'Revenue Leak Center',
    subtitle: 'Find empty slots, unpaid invoices, no-shows and recovery opportunities.',
    primaryEndpoint: 'revenue-leaks',
    secondaryEndpoint: 'revenue-leaks/summary',
    actionEndpoint: 'revenue-leaks/scan',
    actionLabel: 'Scan leaks'
  },
  'digital-twin': {
    module: 'digital-twin',
    title: 'Digital Twin Simulator',
    subtitle: 'Run branch what-if simulations before changing roster, pricing or campaigns.',
    primaryEndpoint: 'digital-twin/recommendations',
    secondaryEndpoint: 'digital-twin/snapshots',
    actionEndpoint: 'digital-twin/simulate',
    actionLabel: 'Simulate'
  },
  'digital-twin-v2': {
    module: 'digital-twin-v2',
    title: 'Salon Digital Twin v2',
    subtitle: 'Full forecast simulator with cost, profit, stock, staff and campaign impact.',
    primaryEndpoint: 'digital-twin-v2/scenarios',
    secondaryEndpoint: 'digital-twin-v2/scenarios',
    actionEndpoint: 'digital-twin-v2/forecast',
    actionLabel: 'Forecast'
  },
  'owner-command': {
    module: 'owner-command',
    title: 'Owner Command Center',
    subtitle: 'Convert business commands into approval-safe action plans.',
    primaryEndpoint: 'command-center/commands',
    actionEndpoint: 'command-center/commands',
    actionLabel: 'Create plan'
  },
  'whatsapp-campaign': {
    module: 'whatsapp-campaign',
    title: 'WhatsApp Campaign Planner',
    subtitle: 'Create consent-aware campaign drafts with quiet-hour and approval controls.',
    primaryEndpoint: 'whatsapp-campaign-planner/plans',
    secondaryEndpoint: 'whatsapp-campaign-planner/outcomes',
    actionEndpoint: 'whatsapp-campaign-planner/plans',
    actionLabel: 'Draft campaign'
  },
  'customer-super-graph': {
    module: 'customer-super-graph',
    title: 'Customer Super Graph',
    subtitle: 'Client, family, referrals, wallet, services, complaints and staff compatibility graph.',
    primaryEndpoint: 'customer-super-graph/demo-client',
    actionEndpoint: 'customer-super-graph/demo-client/rebuild',
    actionLabel: 'Rebuild graph'
  },
  'client-memory': {
    module: 'client-memory',
    title: 'Client Memory Graph',
    subtitle: 'Inspect client preferences, risk signals and next-best actions.',
    primaryEndpoint: '',
    actionLabel: 'Await client'
  },
  'voice-receptionist': {
    module: 'voice-receptionist',
    title: 'Voice AI Receptionist',
    subtitle: 'Call capture, booking intent, transcript privacy and human handoff architecture.',
    primaryEndpoint: 'voice-receptionist/calls',
    actionEndpoint: 'voice-receptionist/calls',
    actionLabel: 'Log call'
  },
  'computer-vision': {
    module: 'computer-vision',
    title: 'Computer Vision Readiness',
    subtitle: 'Queue, cleanliness, before-after and shelf-check events with privacy-first metadata.',
    primaryEndpoint: 'computer-vision/events',
    actionEndpoint: 'computer-vision/events',
    actionLabel: 'Log event'
  },
  'whatsapp-commerce': {
    module: 'whatsapp-commerce',
    title: 'Real WhatsApp Commerce',
    subtitle: 'Booking, invoice, payment, membership, package balance and support commerce sessions.',
    primaryEndpoint: 'whatsapp-commerce/sessions',
    actionEndpoint: 'whatsapp-commerce/sessions',
    actionLabel: 'Open session'
  },
  'owner-mobile': {
    module: 'owner-mobile',
    title: 'Owner Mobile Command API',
    subtitle: 'Owner app briefs, offline-ready policy and push notification architecture.',
    primaryEndpoint: 'owner-mobile/brief',
    actionEndpoint: 'ai-ceo/daily-brief',
    actionLabel: 'Refresh brief'
  },
  'franchise-os': {
    module: 'franchise-os',
    title: 'Franchise Operating System',
    subtitle: 'Franchise onboarding, royalty runs, SOP compliance and multi-owner reporting.',
    primaryEndpoint: 'franchise-os/units',
    actionEndpoint: 'franchise-os/units',
    actionLabel: 'Add franchise'
  },
  'financial-brain': {
    module: 'financial-brain',
    title: 'Financial Brain',
    subtitle: 'Cash flow, P&L, tax reserve, margin and salary-to-revenue intelligence.',
    primaryEndpoint: 'financial-brain/findings',
    actionEndpoint: 'financial-brain/forecast',
    actionLabel: 'Forecast finance'
  },
  marketplace: {
    module: 'marketplace',
    title: 'Marketplace and Connectors',
    subtitle: 'Provider connector framework for Razorpay, WhatsApp, biometric, accounting and ads.',
    primaryEndpoint: 'marketplace/connectors',
    secondaryEndpoint: 'marketplace/plugins',
    actionEndpoint: 'marketplace/connectors',
    actionLabel: 'Add connector'
  },
  'cloud-hardening': {
    module: 'cloud-hardening',
    title: 'Production Cloud Hardening',
    subtitle: 'Postgres, Redis, object storage, backups, secrets, rate limits and DR readiness.',
    primaryEndpoint: 'cloud-hardening/checks',
    actionEndpoint: 'cloud-hardening/checks',
    actionLabel: 'Run check'
  },
  'inventory-autopilot': {
    module: 'inventory-autopilot',
    title: 'Inventory Autopilot',
    subtitle: 'Detect stockout, expiry, vendor delay and service-readiness risks.',
    primaryEndpoint: 'inventory-autopilot/risks',
    secondaryEndpoint: 'inventory-autopilot/purchase-recommendations',
    actionEndpoint: 'inventory-autopilot/scan',
    actionLabel: 'Scan inventory'
  },
  'payment-intelligence': {
    module: 'payment-intelligence',
    title: 'Payment Intelligence',
    subtitle: 'Track refund, discount, cash drawer and payment anomaly risks.',
    primaryEndpoint: 'payment-intelligence/risks',
    secondaryEndpoint: 'payment-intelligence/summary',
    actionEndpoint: 'payment-intelligence/scan',
    actionLabel: 'Scan payments'
  },
  observability: {
    module: 'observability',
    title: 'Observability Center',
    subtitle: 'Monitor health, errors, latency, usage, backup and queue posture.',
    primaryEndpoint: 'observability/health',
    secondaryEndpoint: 'observability/errors',
    actionEndpoint: 'observability/snapshot',
    actionLabel: 'Snapshot'
  },
  'security-hardening': {
    module: 'security-hardening',
    title: 'Security Hardening',
    subtitle: 'Detect suspicious sessions, API abuse and sensitive access anomalies.',
    primaryEndpoint: 'security-hardening/findings',
    secondaryEndpoint: 'security-hardening/summary',
    actionEndpoint: 'security-hardening/scan',
    actionLabel: 'Security scan'
  },
  warehouse: {
    module: 'warehouse',
    title: 'Data Warehouse',
    subtitle: 'Refresh KPI facts and warehouse snapshots for analytics readiness.',
    primaryEndpoint: 'warehouse/kpis',
    secondaryEndpoint: 'warehouse/snapshots',
    actionEndpoint: 'warehouse/refresh',
    actionLabel: 'Refresh'
  }
};

@Injectable()
export class CommandCenterStore {
  readonly config = signal<CommandCenterConfig>(commandCenterConfigs['ai-workforce']);
  readonly primary = signal<CommandCenterRecord[]>([]);
  readonly secondary = signal<CommandCenterRecord[]>([]);
  readonly summary = signal<ApiRecord | null>(null);
  readonly selected = signal<CommandCenterRecord | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly metrics = computed<CommandCenterMetric[]>(() => {
    const records = this.primary();
    const secondary = this.secondary();
    const highRisk = records.filter((item) => item.riskLevel === 'high' || item.severity === 'high').length;
    if (this.config().module === 'ai-workforce') {
      const activeAgents = records.filter((item) => String(item.status || '').toLowerCase() === 'active').length;
      const pendingDecisions = secondary.filter((item) => String(item.status || '').toLowerCase().includes('pending')).length;
      return [
        { label: 'Agents', value: String(records.length), tone: 'neutral' },
        { label: 'Active agents', value: String(activeAgents), tone: activeAgents ? 'good' : 'warning' },
        { label: 'Pending approvals', value: String(pendingDecisions), tone: pendingDecisions ? 'warning' : 'good' },
        { label: 'High risk', value: String(highRisk), tone: highRisk ? 'critical' : 'good' }
      ];
    }
    return [
      { label: 'Records', value: String(records.length), tone: 'neutral' },
      { label: 'High risk', value: String(highRisk), tone: highRisk ? 'critical' : 'good' },
      { label: 'Pending', value: String(records.filter((item) => String(item.status || '').includes('pending')).length), tone: 'warning' },
      { label: 'Module', value: this.config().module.replace(/-/g, ' '), tone: 'neutral' }
    ];
  });

  constructor(private readonly api: CommandCenterApi) {}

  setModule(module: CommandCenterModule): void {
    this.config.set(commandCenterConfigs[module]);
    this.load();
  }

  load(): void {
    const config = this.config();
    this.error.set('');
    this.primary.set([]);
    this.secondary.set([]);
    this.summary.set(null);
    if (!config.primaryEndpoint) return;
    this.loading.set(true);
    this.api.list<ApiRecord | ApiRecord[]>(config.primaryEndpoint)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response: ApiRecord | ApiRecord[]) => this.applyPrimary(response),
        error: (error: Error) => this.error.set(error?.message || 'Unable to load command center data')
      });
    if (config.secondaryEndpoint) {
      this.api.list<ApiRecord | ApiRecord[]>(config.secondaryEndpoint).subscribe({
        next: (response: ApiRecord | ApiRecord[]) => this.applySecondary(response),
        error: () => undefined
      });
    }
  }

  runAction(): void {
    const config = this.config();
    if (!config.actionEndpoint || config.actionLabel === 'Await client') return;
    this.saving.set(true);
    this.error.set('');
    this.api.post<ApiRecord>(config.actionEndpoint, this.defaultPayload(config.module))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.load(),
        error: (error: Error) => this.error.set(error?.message || 'Unable to run command center action')
      });
  }

  private applyPrimary(response: ApiRecord | ApiRecord[]): void {
    if (Array.isArray(response)) {
      this.primary.set(response as CommandCenterRecord[]);
      return;
    }
    this.summary.set(response);
    this.primary.set(this.flatten(response));
  }

  private applySecondary(response: ApiRecord | ApiRecord[]): void {
    if (Array.isArray(response)) {
      this.secondary.set(response as CommandCenterRecord[]);
      return;
    }
    this.summary.set({ ...(this.summary() || {}), ...response });
    this.secondary.set(this.flatten(response));
  }

  private flatten(response: ApiRecord | null): CommandCenterRecord[] {
    if (!response) return [];
    return Object.entries(response).map(([key, value]) => ({ id: key, title: key, value }));
  }

  private defaultPayload(module: CommandCenterModule): ApiRecord {
    const branchId = '';
    const payloads: Record<CommandCenterModule, ApiRecord> = {
      'ai-workforce': { agentKey: `custom-agent-${Date.now()}`, agentName: 'Custom AI Operator', agentType: 'custom', branchId },
      'ai-ceo': { branchId, briefDate: new Date().toISOString().slice(0, 10) },
      'approval-hub': { branchId, sourceModule: 'frontend', requestType: 'manual_review', title: 'Review autonomous recommendation', riskLevel: 'medium' },
      'model-router': { branchId, taskType: 'owner_daily_brief', strategy: 'balanced', estimatedTokens: 1200 },
      'event-ledger': { branchId, aggregateType: 'booking', aggregateId: `booking-${Date.now()}`, eventType: 'booking.recommended', eventPayload: { approvalSafe: true } },
      'war-room': { branchId, branchIds: branchId ? [branchId] : ['all'] },
      'revenue-leaks': { branchId },
      'digital-twin': { branchId, scenario: 'what if weekend demand spikes', historicalDataSparse: true },
      'digital-twin-v2': { branchId, scenarioType: 'weekly_forecast', scenarioName: 'Next week profit and staffing forecast', historicalDataSparse: true },
      'owner-command': { branchId, commandText: 'increase next week revenue safely' },
      'whatsapp-campaign': { branchId, campaignType: 'empty_slot_fill', title: 'Empty Slot Fill' },
      'customer-super-graph': { branchId, favoriteService: 'Hair color', walletBalance: 1200, referrals: ['family'] },
      'client-memory': { branchId },
      'voice-receptionist': { branchId, phone: '+919999999999', intent: 'booking', transcript: [{ role: 'client', text: 'Need appointment tomorrow' }] },
      'computer-vision': { branchId, eventType: 'queue_detection', queueLength: 3, privacyMode: 'metadata_only' },
      'whatsapp-commerce': { branchId, phone: '+919999999999', intent: 'membership_renewal', totalAmount: 999, items: [{ type: 'membership', name: 'Gold renewal' }] },
      'owner-mobile': { branchId, briefDate: new Date().toISOString().slice(0, 10) },
      'franchise-os': { branchId, franchiseName: `Aura Franchise ${Date.now()}`, ownerName: 'Franchise Owner', royaltyPercent: 8 },
      'financial-brain': { branchId, revenue: 200000, expenses: 128000, salaryCost: 64000 },
      marketplace: { branchId, providerKey: `whatsapp-${Date.now()}`, providerType: 'whatsapp', displayName: 'WhatsApp Provider Draft', capabilities: ['messages', 'commerce'] },
      'cloud-hardening': { branchId, checkType: 'production_cloud_hardening', providerTarget: 'postgres_supabase' },
      'inventory-autopilot': { branchId, riskType: 'stockout_risk' },
      'payment-intelligence': { branchId, riskType: 'discount_abuse' },
      observability: { branchId },
      'security-hardening': { branchId, signalType: 'sensitive_data_access' },
      warehouse: { branchId }
    };
    return payloads[module];
  }
}
