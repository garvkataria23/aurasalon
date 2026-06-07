import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { ApiRecord } from '../../../core/api.service';
import { CommandCenterApi } from '../data/command-center.api';

type AiTab = 'overview' | 'queue' | 'runs' | 'alerts' | 'settings' | 'premium';
type Tone = 'neutral' | 'good' | 'warning' | 'critical';

interface AiTotals {
  agents: number;
  activeAgents: number;
  pendingApprovals: number;
  highRiskActions: number;
  failedRuns: number;
  openAlerts: number;
  aiCostToday: number;
  aiCostMonth: number;
  estimatedKpiImpact: number;
  providerConfigs: number;
  promptVersions: number;
}

interface AiAgent extends ApiRecord {
  id: string;
  agentName?: string;
  agentKey?: string;
  agentType?: string;
  description?: string;
  status?: string;
  riskLevel?: string;
  autonomyLevel?: string;
  providerKey?: string;
  branchId?: string;
  safetyScore?: number;
}

interface AiQueueItem extends ApiRecord {
  id: string;
  agentId?: string;
  runId?: string;
  title?: string;
  summary?: string;
  suggestedAction?: string;
  riskLevel?: string;
  confidence?: number;
  safetyScore?: number;
  approvalStatus?: string;
  status?: string;
  createdAt?: string;
  proposedActionJson?: unknown;
}

interface AiRun extends ApiRecord {
  id: string;
  agentId?: string;
  status?: string;
  riskLevel?: string;
  approvalStatus?: string;
  providerKey?: string;
  modelKey?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  estimatedCost?: number;
  totalTokens?: number;
  resultSummary?: string;
  errorMessage?: string;
  outputJson?: unknown;
}

interface AiAlert extends ApiRecord {
  id: string;
  agentId?: string;
  runId?: string;
  alertType?: string;
  title?: string;
  message?: string;
  severity?: string;
  riskLevel?: string;
  status?: string;
  createdAt?: string;
}

interface AiSetting extends ApiRecord {
  id?: string;
  agentId: string;
  autonomyLevel?: string;
  approvalRequired?: number | boolean;
  riskThreshold?: string;
  providerKey?: string;
  modelKey?: string;
  promptVersion?: number;
  modulePermissionsJson?: unknown;
  branchPermissionsJson?: unknown;
  status?: string;
}

interface AiDashboard extends ApiRecord {
  totals?: Partial<AiTotals>;
  agents?: AiAgent[];
  queue?: AiQueueItem[];
  alerts?: AiAlert[];
  recentRuns?: AiRun[];
}

interface AiProvider extends ApiRecord {
  providerKey: string;
  providerName?: string;
  modelKey?: string;
  status?: string;
  configured?: boolean;
  envKey?: string;
  apiKeyRef?: string;
}

interface AiMarketplaceTemplate extends ApiRecord {
  templateKey: string;
  agentKey?: string;
  agentName?: string;
  description?: string;
  defaultTaskType?: string;
  riskLevel?: string;
  installed?: boolean;
}

interface AiPromptVersion extends ApiRecord {
  id: string;
  agentId?: string;
  version?: number;
  status?: string;
  providerKey?: string;
  modelKey?: string;
  promptKey?: string;
  promptTitle?: string;
  approvalStatus?: string;
  createdAt?: string;
}

interface AiCostSummary {
  todayCost?: number;
  monthCost?: number;
  totalCost?: number;
  totalTokens?: number;
}

interface AiCostReport extends ApiRecord {
  summary?: AiCostSummary;
  byAgent?: Array<ApiRecord & { agentId?: string; totalCost?: number; totalTokens?: number }>;
  rows?: ApiRecord[];
}

interface AiKpiImpact extends ApiRecord {
  id: string;
  agentId?: string;
  kpiLabel?: string;
  impactType?: string;
  estimatedValue?: number;
  estimatedRevenueImpact?: number;
  confidence?: number;
  status?: string;
  impactDate?: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page-stack ai-workforce-page">
      <article class="module-hero ai-workforce-hero">
        <div>
          <span class="eyebrow">AI-Native Command Center</span>
          <h2>AI Workforce OS</h2>
          <p>Queue, approvals, run history, alerts and agent controls for safe salon automation.</p>
        </div>
        <div class="hero-actions">
          <button class="ghost-button" type="button" (click)="loadAll()" [disabled]="loading()">Refresh</button>
          <button class="primary-button" type="button" (click)="registerAgent()" [disabled]="!!saving()">Register agent</button>
        </div>
      </article>

      <div *ngIf="loading()" class="state loading">Loading AI workforce data...</div>
      <div *ngIf="error()" class="state error">
        {{ error() }}
        <button class="ghost-button mini" type="button" (click)="loadAll()">Retry</button>
      </div>

      <nav class="ai-tabs" aria-label="AI Workforce tabs">
        <button
          *ngFor="let tab of tabs"
          type="button"
          [class.active]="activeTab() === tab.id"
          (click)="activeTab.set(tab.id)"
        >
          <span>{{ tab.label }}</span>
          <strong *ngIf="tab.count() !== null">{{ tab.count() }}</strong>
        </button>
      </nav>

      <section *ngIf="activeTab() === 'overview'" class="ai-tab-panel">
        <div class="ai-metrics-grid">
          <article *ngFor="let metric of overviewMetrics()" class="metric-card" [ngClass]="metric.tone">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <small>{{ metric.caption }}</small>
          </article>
        </div>

        <div class="ai-overview-grid">
          <article class="panel ai-list-panel">
            <div class="section-title">
              <div>
                <span class="eyebrow">Agents</span>
                <h3>Live Workforce</h3>
              </div>
              <span class="badge info">{{ agents().length }} agents</span>
            </div>

            <div *ngIf="!agents().length && !loading()" class="empty-state">
              <strong>No AI agents yet</strong>
              <span>Register an agent to start building the workforce queue.</span>
            </div>

            <button
              *ngFor="let agent of agents(); trackBy: trackById"
              class="agent-card"
              type="button"
              [class.selected]="selectedAgentId() === agent.id"
              (click)="selectedAgentId.set(agent.id)"
            >
              <span class="agent-avatar">{{ initials(agent.agentName || agent.agentKey || 'AI') }}</span>
              <span>
                <strong>{{ agent.agentName || agent.agentKey || 'Unnamed agent' }}</strong>
                <small>{{ agent.description || agent.agentType || 'Approval-safe salon automation agent' }}</small>
              </span>
              <span class="badge" [ngClass]="statusTone(agent.status)">{{ agent.status || 'active' }}</span>
            </button>
          </article>

          <article class="panel agent-detail-panel" *ngIf="selectedAgent() as agent">
            <div class="section-title">
              <div>
                <span class="eyebrow">Agent Detail</span>
                <h3>{{ agent.agentName || agent.agentKey }}</h3>
              </div>
              <span class="badge" [ngClass]="riskTone(agent.riskLevel)">{{ agent.riskLevel || 'low' }} risk</span>
            </div>

            <div class="detail-grid">
              <div>
                <span>Provider</span>
                <strong>{{ providerLabel(settingFor(agent.id)?.providerKey || agent.providerKey) }}</strong>
              </div>
              <div>
                <span>Autonomy</span>
                <strong>{{ autonomyLabel(settingFor(agent.id)?.autonomyLevel || agent.autonomyLevel) }}</strong>
              </div>
              <div>
                <span>Approval</span>
                <strong>{{ isApprovalRequired(settingFor(agent.id)) ? 'Required' : 'Low-risk only' }}</strong>
              </div>
              <div>
                <span>Branch</span>
                <strong>{{ agent.branchId || 'All branches' }}</strong>
              </div>
            </div>

            <div class="agent-safety-card">
              <div>
                <span>Safety score</span>
                <strong>{{ scoreFor(agent) }}%</strong>
              </div>
              <div class="progress-track"><i [style.width.%]="scoreFor(agent)"></i></div>
            </div>

            <div class="agent-actions">
              <button class="primary-button" type="button" (click)="runAgent(agent)" [disabled]="!!saving()">Run safely</button>
              <button class="ghost-button" type="button" (click)="simulateAgent(agent)" [disabled]="!!saving()">Simulate</button>
              <button class="ghost-button" type="button" (click)="toggleAgent(agent)" [disabled]="!!saving()">
                {{ agent.status === 'disabled' ? 'Enable' : 'Disable' }}
              </button>
              <button class="ghost-button" type="button" (click)="activeTab.set('settings')">Settings</button>
              <button class="ghost-button" type="button" (click)="activeTab.set('premium')">Premium controls</button>
            </div>

            <div class="section-title compact">
              <h3>Recent runs</h3>
              <span class="muted">{{ selectedAgentRuns().length }} linked</span>
            </div>
            <div *ngIf="!selectedAgentRuns().length" class="empty-state compact">
              <strong>No runs for this agent</strong>
              <span>Use Run safely to create a provider-aware run record.</span>
            </div>
            <div *ngFor="let run of selectedAgentRuns().slice(0, 3); trackBy: trackById" class="run-mini">
              <span class="badge" [ngClass]="statusTone(run.status)">{{ run.status || 'created' }}</span>
              <strong>{{ runSummary(run) }}</strong>
              <small>{{ formatDate(run.startedAt) }} · {{ formatCurrency(run.estimatedCost || 0) }}</small>
            </div>
          </article>
        </div>
      </section>

      <section *ngIf="activeTab() === 'queue'" class="ai-tab-panel">
        <article class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Human Approval Required</span>
              <h3>Approval Queue</h3>
            </div>
            <span class="badge warning">{{ queue().length }} pending</span>
          </div>

          <div *ngIf="!queue().length && !loading()" class="empty-state">
            <strong>No pending AI decisions</strong>
            <span>High-risk and approval-required suggestions will appear here.</span>
          </div>

          <div class="queue-grid">
            <article *ngFor="let item of queue(); trackBy: trackById" class="decision-card">
              <div class="decision-head">
                <div>
                  <span class="eyebrow">{{ agentName(item.agentId) }}</span>
                  <h3>{{ item.title || 'AI decision needs approval' }}</h3>
                </div>
                <span class="badge" [ngClass]="riskTone(item.riskLevel)">{{ item.riskLevel || 'medium' }}</span>
              </div>
              <p>{{ item.summary || item.suggestedAction || 'Review the proposed action before any execution.' }}</p>
              <div class="decision-stats">
                <span>Confidence <strong>{{ percent(item.confidence) }}</strong></span>
                <span>Safety <strong>{{ percent(item.safetyScore) }}</strong></span>
                <span>Status <strong>{{ item.approvalStatus || 'pending' }}</strong></span>
              </div>
              <div class="action-chips">
                <span *ngFor="let chip of actionLabels(item)">{{ chip }}</span>
              </div>
              <div class="agent-actions">
                <button class="primary-button" type="button" (click)="approveQueue(item)" [disabled]="!!saving()">Approve</button>
                <button class="ghost-button" type="button" (click)="editQueue(item)" [disabled]="!!saving()">Edit</button>
                <button class="ghost-button" type="button" (click)="askAgain(item)" [disabled]="!!saving()">Ask again</button>
                <button class="ghost-button danger-text" type="button" (click)="rejectQueue(item)" [disabled]="!!saving()">Reject</button>
              </div>
            </article>
          </div>
        </article>
      </section>

      <section *ngIf="activeTab() === 'runs'" class="ai-tab-panel">
        <article class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Execution Evidence</span>
              <h3>Run History</h3>
            </div>
            <span class="badge info">{{ runs().length }} runs</span>
          </div>

          <div *ngIf="!runs().length && !loading()" class="empty-state">
            <strong>No run history yet</strong>
            <span>Agent runs will show duration, token usage, cost and result summaries.</span>
          </div>

          <div *ngIf="runs().length" class="table-wrap ai-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Module</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Cost</th>
                  <th>Tokens</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let run of runs(); trackBy: trackById">
                  <td><strong>{{ agentName(run.agentId) }}</strong></td>
                  <td>{{ run.module || run.providerKey || 'ai-workforce' }}</td>
                  <td>{{ formatDate(run.startedAt) }}</td>
                  <td>{{ formatDuration(run.durationMs) }}</td>
                  <td><span class="badge" [ngClass]="statusTone(run.status)">{{ run.status || 'created' }}</span></td>
                  <td>{{ formatCurrency(run.estimatedCost || 0) }}</td>
                  <td>{{ run.totalTokens || 0 }}</td>
                  <td>
                    {{ runSummary(run) }}
                    <small *ngIf="run.errorMessage" class="danger-text">{{ run.errorMessage }}</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section *ngIf="activeTab() === 'alerts'" class="ai-tab-panel">
        <article class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Risk Monitor</span>
              <h3>Alerts</h3>
            </div>
            <span class="badge danger">{{ alerts().length }} open</span>
          </div>

          <div *ngIf="!alerts().length && !loading()" class="empty-state">
            <strong>No open AI alerts</strong>
            <span>Provider, cost, high-risk and failed-run alerts will appear here.</span>
          </div>

          <div class="alerts-grid">
            <article *ngFor="let alert of alerts(); trackBy: trackById" class="alert-card" [ngClass]="riskTone(alert.riskLevel || alert.severity)">
              <div class="decision-head">
                <div>
                  <span class="eyebrow">{{ alert.alertType || 'AI alert' }}</span>
                  <h3>{{ alert.title || 'AI workforce alert' }}</h3>
                </div>
                <span class="badge" [ngClass]="riskTone(alert.riskLevel || alert.severity)">{{ alert.severity || alert.riskLevel || 'medium' }}</span>
              </div>
              <p>{{ alert.message || 'Review this alert and take the next safe action.' }}</p>
              <small>{{ agentName(alert.agentId) }} · {{ formatDate(alert.createdAt) }}</small>
              <div class="agent-actions">
                <button class="ghost-button" type="button" (click)="acknowledgeAlert(alert)" [disabled]="!!saving()">Acknowledge</button>
                <button class="primary-button" type="button" (click)="resolveAlert(alert)" [disabled]="!!saving()">Resolve</button>
              </div>
            </article>
          </div>
        </article>
      </section>

      <section *ngIf="activeTab() === 'settings'" class="ai-tab-panel">
        <article class="panel">
          <div class="section-title">
            <div>
              <span class="eyebrow">Governance Defaults</span>
              <h3>Agent Settings</h3>
            </div>
            <span class="badge info">Approval ON by default</span>
          </div>

          <div *ngIf="!agents().length && !loading()" class="empty-state">
            <strong>No agents to configure</strong>
            <span>Register an agent before setting provider, autonomy and permissions.</span>
          </div>

          <div class="settings-grid">
            <article *ngFor="let agent of agents(); trackBy: trackById" class="settings-card">
              <div class="section-title compact">
                <div>
                  <h3>{{ agent.agentName || agent.agentKey }}</h3>
                  <span class="muted">{{ agent.description || 'Safe automation agent' }}</span>
                </div>
                <label class="switch-line">
                  <input
                    type="checkbox"
                    [ngModel]="agent.status !== 'disabled'"
                    (ngModelChange)="toggleAgent(agent)"
                    [disabled]="!!saving()"
                  />
                  <span>{{ agent.status === 'disabled' ? 'Disabled' : 'Enabled' }}</span>
                </label>
              </div>

              <ng-container *ngIf="settingFor(agent.id) as setting">
                <div class="settings-form-grid">
                  <label class="field">
                    <span>Autonomy level</span>
                    <select [(ngModel)]="setting.autonomyLevel">
                      <option value="suggest_only">Suggest only</option>
                      <option value="draft_only">Draft only</option>
                      <option value="approval_required">Approval required</option>
                      <option value="auto_execute_low_risk">Auto-execute low-risk</option>
                      <option value="full_auto_disabled">Full auto disabled</option>
                    </select>
                  </label>

                  <label class="field">
                    <span>Risk threshold</span>
                    <select [(ngModel)]="setting.riskThreshold">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>

                  <label class="field">
                    <span>Provider</span>
                    <select [(ngModel)]="setting.providerKey">
                      <option value="not_configured">Local / not configured</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="gemini">Gemini</option>
                    </select>
                  </label>

                  <label class="field">
                    <span>Prompt version</span>
                    <input type="number" min="1" [(ngModel)]="setting.promptVersion" />
                  </label>
                </div>

                <div class="permission-row">
                  <span>Module permissions</span>
                  <strong>{{ permissionSummary(setting.modulePermissionsJson) }}</strong>
                </div>
                <div class="permission-row">
                  <span>Branch permissions</span>
                  <strong>{{ permissionSummary(setting.branchPermissionsJson) }}</strong>
                </div>
                <label class="check-line approval-line">
                  <input
                    type="checkbox"
                    [ngModel]="isApprovalRequired(setting)"
                    (ngModelChange)="setting.approvalRequired = $event ? 1 : 0"
                  />
                  Human approval required
                </label>

                <div class="agent-actions">
                  <button class="primary-button" type="button" (click)="saveSetting(setting)" [disabled]="!!saving()">Save settings</button>
                  <button class="ghost-button" type="button" (click)="runAgent(agent)" [disabled]="!!saving()">Test run</button>
                  <button class="ghost-button" type="button" (click)="simulateAgent(agent)" [disabled]="!!saving()">Simulation</button>
                </div>
              </ng-container>
            </article>
          </div>
        </article>
      </section>

      <section *ngIf="activeTab() === 'premium'" class="ai-tab-panel">
        <div class="premium-grid">
          <article class="panel premium-card">
            <div class="section-title">
              <div>
                <span class="eyebrow">Provider Switching</span>
                <h3>AI Providers</h3>
              </div>
              <span class="badge info">{{ configuredProviders() }} configured</span>
            </div>

            <div class="provider-grid">
              <article *ngFor="let provider of providers(); trackBy: trackByProvider" class="provider-card">
                <div>
                  <span class="provider-key">{{ provider.providerKey }}</span>
                  <h3>{{ provider.providerName || providerLabel(provider.providerKey) }}</h3>
                  <small>{{ provider.envKey || 'Local provider / no secret stored' }}</small>
                </div>
                <span class="badge" [ngClass]="providerConfigured(provider) ? 'success' : 'warning'">
                  {{ providerConfigured(provider) ? 'configured' : 'not configured' }}
                </span>
                <label class="field">
                  <span>Model</span>
                  <input [(ngModel)]="provider.modelKey" placeholder="model key" />
                </label>
                <label class="field" *ngIf="provider.providerKey !== 'local' && provider.providerKey !== 'local_rules'">
                  <span>API key reference</span>
                  <input [(ngModel)]="provider.apiKeyRef" placeholder="env:OPENAI_API_KEY or vault ref" />
                </label>
                <button class="ghost-button full-button" type="button" (click)="saveProvider(provider)" [disabled]="!!saving()">
                  Save provider
                </button>
              </article>
            </div>
          </article>

          <article class="panel premium-card">
            <div class="section-title">
              <div>
                <span class="eyebrow">Agent Marketplace</span>
                <h3>Install Ready Agents</h3>
              </div>
              <span class="badge info">{{ marketplace().length }} templates</span>
            </div>

            <div *ngIf="!marketplace().length && !loading()" class="empty-state compact">
              <strong>No marketplace templates</strong>
              <span>Backend marketplace templates will appear here.</span>
            </div>

            <div class="marketplace-grid">
              <article *ngFor="let template of marketplace(); trackBy: trackByTemplate" class="marketplace-card">
                <span class="badge" [ngClass]="template.installed ? 'success' : riskTone(template.riskLevel)">
                  {{ template.installed ? 'installed' : (template.riskLevel || 'low') + ' risk' }}
                </span>
                <h3>{{ template.agentName || template.agentKey }}</h3>
                <p>{{ template.description || 'Approval-safe AI automation template.' }}</p>
                <small>{{ template.defaultTaskType || 'manual task' }}</small>
                <button class="primary-button full-button" type="button" (click)="installTemplate(template)" [disabled]="!!saving() || !!template.installed">
                  {{ template.installed ? 'Installed' : 'Install agent' }}
                </button>
              </article>
            </div>
          </article>

          <article class="panel premium-card">
            <div class="section-title">
              <div>
                <span class="eyebrow">Prompt Governance</span>
                <h3>Prompt Versions</h3>
              </div>
              <button class="ghost-button mini" type="button" (click)="createPromptVersion(selectedAgent())" [disabled]="!!saving() || !selectedAgent()">
                New version
              </button>
            </div>

            <div *ngIf="!promptVersions().length && !loading()" class="empty-state compact">
              <strong>No prompt versions yet</strong>
              <span>Create a version from the selected agent before switching prompts.</span>
            </div>

            <div class="prompt-version-list">
              <article *ngFor="let prompt of promptVersions(); trackBy: trackById" class="prompt-version-card">
                <div>
                  <h3>{{ prompt.promptTitle || agentName(prompt.agentId) }}</h3>
                  <small>v{{ prompt.version || 1 }} · {{ providerLabel(prompt.providerKey) }} · {{ prompt.modelKey || 'default model' }}</small>
                </div>
                <span class="badge" [ngClass]="prompt.status === 'active' ? 'success' : 'info'">{{ prompt.status || 'draft' }}</span>
                <button class="ghost-button mini" type="button" (click)="activatePrompt(prompt)" [disabled]="!!saving() || prompt.status === 'active'">
                  Activate
                </button>
              </article>
            </div>
          </article>

          <article class="panel premium-card">
            <div class="section-title">
              <div>
                <span class="eyebrow">Cost & KPI Impact</span>
                <h3>AI Spend Control</h3>
              </div>
              <button class="ghost-button mini" type="button" (click)="recordKpiImpact(selectedAgent())" [disabled]="!!saving() || !selectedAgent()">
                Add impact
              </button>
            </div>

            <div class="cost-grid">
              <div>
                <span>Today</span>
                <strong>{{ formatCurrency(costSummary().todayCost || 0) }}</strong>
              </div>
              <div>
                <span>This month</span>
                <strong>{{ formatCurrency(costSummary().monthCost || 0) }}</strong>
              </div>
              <div>
                <span>Tokens</span>
                <strong>{{ formatNumber(costSummary().totalTokens || 0) }}</strong>
              </div>
            </div>

            <div *ngIf="!kpiImpact().length && !loading()" class="empty-state compact">
              <strong>No KPI impact tracked</strong>
              <span>Record projected savings or recovered revenue from selected agents.</span>
            </div>

            <div class="kpi-impact-list">
              <article *ngFor="let impact of kpiImpact(); trackBy: trackById" class="kpi-impact-card">
                <div>
                  <h3>{{ impact.kpiLabel || impact.impactType || 'AI impact' }}</h3>
                  <small>{{ agentName(impact.agentId) }} · {{ percent(impact.confidence) }} confidence</small>
                </div>
                <strong>{{ formatCurrency(impactAmount(impact)) }}</strong>
              </article>
            </div>
          </article>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .ai-workforce-page {
      gap: 18px;
    }

    .ai-workforce-hero h2 {
      font-size: clamp(2rem, 1.45rem + 1.6vw, 3rem);
    }

    .ai-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: rgba(255, 255, 255, 0.78);
      box-shadow: var(--shadow-xs);
    }

    .ai-tabs button {
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 0 14px;
      border: 0;
      border-radius: var(--radius-sm);
      color: var(--muted);
      background: transparent;
      font-weight: 700;
    }

    .ai-tabs button.active {
      color: var(--ink);
      background: var(--color-primary-soft);
      box-shadow: inset 0 0 0 1px rgba(15, 118, 110, 0.2);
    }

    .ai-tabs strong {
      min-width: 24px;
      height: 24px;
      display: grid;
      place-items: center;
      border-radius: var(--radius-pill);
      background: #fff;
      color: var(--teal-2);
      font-size: 0.78rem;
    }

    .ai-tab-panel {
      display: grid;
      gap: 18px;
    }

    .ai-metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }

    .ai-overview-grid {
      display: grid;
      grid-template-columns: minmax(360px, 0.9fr) minmax(0, 1.2fr);
      gap: 18px;
      align-items: start;
    }

    .agent-card {
      width: 100%;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      margin-top: 10px;
      padding: 13px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: #fff;
      color: var(--ink);
      text-align: left;
    }

    .agent-card:hover,
    .agent-card.selected {
      border-color: rgba(15, 118, 110, 0.45);
      background: var(--color-primary-soft);
    }

    .agent-avatar {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, var(--teal), #3aa39a);
      color: #fff;
      font-weight: 900;
    }

    .agent-card strong,
    .agent-card small {
      display: block;
    }

    .agent-card small {
      margin-top: 4px;
      color: var(--muted);
      line-height: 1.4;
    }

    .detail-grid,
    .settings-form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .detail-grid div,
    .agent-safety-card,
    .permission-row {
      padding: 13px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--color-surface-sunken);
    }

    .detail-grid span,
    .agent-safety-card span,
    .permission-row span {
      display: block;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .detail-grid strong,
    .agent-safety-card strong,
    .permission-row strong {
      display: block;
      margin-top: 6px;
    }

    .agent-safety-card {
      display: grid;
      grid-template-columns: 150px minmax(0, 1fr);
      gap: 14px;
      align-items: center;
      margin-top: 14px;
    }

    .progress-track {
      height: 10px;
      overflow: hidden;
      border-radius: var(--radius-pill);
      background: #e4ecea;
    }

    .progress-track i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--teal), var(--green));
    }

    .agent-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
    }

    .section-title.compact {
      margin-top: 16px;
      margin-bottom: 10px;
    }

    .run-mini,
    .decision-card,
    .alert-card,
    .settings-card {
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: #fff;
    }

    .run-mini {
      display: grid;
      gap: 5px;
      margin-top: 8px;
    }

    .queue-grid,
    .alerts-grid,
    .settings-grid {
      display: grid;
      gap: 12px;
    }

    .decision-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: start;
    }

    .decision-head h3,
    .settings-card h3 {
      margin: 0;
      line-height: 1.25;
    }

    .decision-card p,
    .alert-card p {
      margin: 10px 0;
      color: var(--muted);
      line-height: 1.5;
    }

    .decision-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .decision-stats span {
      padding: 10px;
      border-radius: var(--radius-sm);
      background: var(--color-surface-sunken);
      color: var(--muted);
      font-size: 0.82rem;
    }

    .decision-stats strong {
      display: block;
      margin-top: 3px;
      color: var(--ink);
    }

    .action-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 12px;
    }

    .action-chips span {
      padding: 6px 10px;
      border-radius: var(--radius-pill);
      background: var(--surface-2);
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .ai-table-wrap table {
      min-width: 1060px;
    }

    .alert-card.critical,
    .alert-card.danger {
      border-color: rgba(180, 35, 24, 0.25);
      background: #fff7f6;
    }

    .alert-card.warning {
      border-color: rgba(183, 121, 31, 0.25);
      background: #fffaf0;
    }

    .settings-card {
      display: grid;
      gap: 13px;
    }

    .premium-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      align-items: start;
    }

    .premium-card {
      min-height: 100%;
    }

    .provider-grid,
    .marketplace-grid,
    .prompt-version-list,
    .kpi-impact-list {
      display: grid;
      gap: 10px;
    }

    .provider-grid,
    .marketplace-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .provider-card,
    .marketplace-card,
    .prompt-version-card,
    .kpi-impact-card {
      display: grid;
      gap: 10px;
      padding: 13px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: #fff;
    }

    .provider-card h3,
    .marketplace-card h3,
    .prompt-version-card h3,
    .kpi-impact-card h3 {
      margin: 0;
      line-height: 1.25;
    }

    .provider-key {
      display: inline-flex;
      width: fit-content;
      margin-bottom: 5px;
      padding: 3px 8px;
      border-radius: var(--radius-pill);
      background: var(--color-primary-soft);
      color: var(--teal-2);
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .marketplace-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
    }

    .prompt-version-card,
    .kpi-impact-card {
      grid-template-columns: minmax(0, 1fr) auto auto;
      align-items: center;
    }

    .cost-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 12px;
    }

    .cost-grid div {
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--color-surface-sunken);
    }

    .cost-grid span {
      display: block;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .cost-grid strong {
      display: block;
      margin-top: 5px;
      font-size: 1.12rem;
    }

    .switch-line {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-weight: 700;
      white-space: nowrap;
    }

    .switch-line input,
    .approval-line input {
      width: auto;
      min-height: auto;
      accent-color: var(--teal);
    }

    .permission-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }

    .approval-line {
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      background: var(--color-primary-soft);
      color: var(--teal-2);
      font-weight: 800;
    }

    .badge.neutral {
      color: #334155;
      background: #e8eef2;
    }

    .badge.good,
    .badge.success {
      color: #145a2c;
      background: #d4f0dd;
    }

    .badge.warning {
      color: #7a4d10;
      background: #fdecc8;
    }

    .badge.critical,
    .badge.danger {
      color: #7a1610;
      background: #fbdcd9;
    }

    .metric-card.good {
      border-top: 4px solid var(--green);
    }

    .metric-card.warning {
      border-top: 4px solid var(--amber);
    }

    .metric-card.critical {
      border-top: 4px solid var(--red);
    }

    .metric-card.neutral {
      border-top: 4px solid var(--teal);
    }

    .danger-text {
      color: var(--red) !important;
    }

    .empty-state.compact {
      min-height: 92px;
    }

    @media (max-width: 1180px) {
      .ai-metrics-grid,
      .ai-overview-grid,
      .settings-form-grid,
      .premium-grid,
      .provider-grid,
      .marketplace-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .ai-overview-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      .ai-metrics-grid,
      .detail-grid,
      .decision-stats,
      .settings-form-grid,
      .premium-grid,
      .provider-grid,
      .marketplace-grid,
      .cost-grid,
      .prompt-version-card,
      .kpi-impact-card,
      .agent-safety-card {
        grid-template-columns: 1fr;
      }

      .agent-card {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .agent-card .badge {
        grid-column: 1 / -1;
        width: fit-content;
      }

      .permission-row,
      .decision-head {
        flex-direction: column;
      }
    }
  `]
})
export class AiWorkforceDashboardPage implements OnInit {
  readonly tabs: Array<{ id: AiTab; label: string; count: () => number | null }> = [
    { id: 'overview', label: 'Overview', count: () => null },
    { id: 'queue', label: 'Approval Queue', count: () => this.queue().length },
    { id: 'runs', label: 'Run History', count: () => this.runs().length },
    { id: 'alerts', label: 'Alerts', count: () => this.alerts().length },
    { id: 'settings', label: 'Agent Settings', count: () => this.settings().length },
    { id: 'premium', label: 'Premium AI', count: () => this.providers().length || null }
  ];

  readonly activeTab = signal<AiTab>('overview');
  readonly loading = signal(false);
  readonly saving = signal('');
  readonly error = signal('');
  readonly dashboard = signal<AiDashboard | null>(null);
  readonly agents = signal<AiAgent[]>([]);
  readonly queue = signal<AiQueueItem[]>([]);
  readonly runs = signal<AiRun[]>([]);
  readonly alerts = signal<AiAlert[]>([]);
  readonly settings = signal<AiSetting[]>([]);
  readonly providers = signal<AiProvider[]>([]);
  readonly marketplace = signal<AiMarketplaceTemplate[]>([]);
  readonly promptVersions = signal<AiPromptVersion[]>([]);
  readonly costReport = signal<AiCostReport | null>(null);
  readonly kpiImpact = signal<AiKpiImpact[]>([]);
  readonly selectedAgentId = signal('');

  readonly selectedAgent = computed(() => {
    const id = this.selectedAgentId();
    return this.agents().find((agent) => agent.id === id) || this.agents()[0] || null;
  });

  readonly selectedAgentRuns = computed(() => {
    const id = this.selectedAgent()?.id;
    return id ? this.runs().filter((run) => run.agentId === id) : [];
  });

  readonly configuredProviders = computed(() => this.providers().filter((provider) => this.providerConfigured(provider)).length);

  readonly costSummary = computed(() => this.costReport()?.summary || {});

  readonly overviewMetrics = computed(() => {
    const totals = this.totals();
    return [
      { label: 'Total agents', value: String(totals.agents), caption: `${totals.activeAgents} active`, tone: 'neutral' as Tone },
      { label: 'Pending approvals', value: String(totals.pendingApprovals), caption: 'Human approval required', tone: totals.pendingApprovals ? 'warning' as Tone : 'good' as Tone },
      { label: 'High-risk actions', value: String(totals.highRiskActions), caption: `${totals.openAlerts} open alerts`, tone: totals.highRiskActions ? 'critical' as Tone : 'good' as Tone },
      { label: 'Failed runs', value: String(totals.failedRuns), caption: 'Needs review', tone: totals.failedRuns ? 'critical' as Tone : 'good' as Tone },
      { label: 'AI cost today', value: this.formatCurrency(totals.aiCostToday), caption: 'Estimated provider spend', tone: 'neutral' as Tone },
      { label: 'AI cost month', value: this.formatCurrency(totals.aiCostMonth), caption: `${this.formatNumber(this.costSummary().totalTokens || 0)} tokens tracked`, tone: 'neutral' as Tone },
      { label: 'Providers', value: `${totals.providerConfigs}/${this.providers().length || 0}`, caption: `${totals.promptVersions} prompt versions`, tone: totals.providerConfigs ? 'good' as Tone : 'warning' as Tone },
      { label: 'KPI impact', value: this.formatCurrency(totals.estimatedKpiImpact), caption: 'Projected value protected', tone: 'good' as Tone }
    ];
  });

  constructor(private readonly api: CommandCenterApi) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      dashboard: this.api.list<AiDashboard>('ai-workforce/dashboard'),
      agents: this.api.list<AiAgent[]>('ai-workforce/agents'),
      queue: this.api.list<AiQueueItem[]>('ai-workforce/queue'),
      runs: this.api.list<AiRun[]>('ai-workforce/runs'),
      alerts: this.api.list<AiAlert[]>('ai-workforce/alerts'),
      settings: this.api.list<AiSetting[]>('ai-workforce/settings'),
      providers: this.api.list<AiProvider[]>('ai-workforce/providers'),
      marketplace: this.api.list<AiMarketplaceTemplate[]>('ai-workforce/marketplace'),
      promptVersions: this.api.list<AiPromptVersion[]>('ai-workforce/prompt-versions'),
      costReport: this.api.list<AiCostReport>('ai-workforce/costs'),
      kpiImpact: this.api.list<AiKpiImpact[]>('ai-workforce/kpi-impact')
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ dashboard, agents, queue, runs, alerts, settings, providers, marketplace, promptVersions, costReport, kpiImpact }) => {
          this.dashboard.set(dashboard);
          this.agents.set(agents || dashboard.agents || []);
          this.queue.set(queue || dashboard.queue || []);
          this.runs.set(runs || dashboard.recentRuns || []);
          this.alerts.set(alerts || dashboard.alerts || []);
          this.settings.set(settings || []);
          this.providers.set(providers || []);
          this.marketplace.set(marketplace || []);
          this.promptVersions.set(promptVersions || []);
          this.costReport.set(costReport || null);
          this.kpiImpact.set(kpiImpact || []);

          if (!this.selectedAgentId() && (agents?.length || dashboard.agents?.length)) {
            this.selectedAgentId.set((agents?.[0] || dashboard.agents?.[0])?.id || '');
          }
        },
        error: (err: { message?: string }) => {
          this.error.set(err?.message || 'AI Workforce data load nahi ho paya.');
        }
      });
  }

  registerAgent(): void {
    const stamp = Date.now();
    this.saveAction('register-agent', this.api.post<AiAgent>('ai-workforce/agents', {
      agentKey: `custom-agent-${stamp}`,
      agentName: `Custom AI Agent ${String(stamp).slice(-4)}`,
      agentType: 'custom',
      description: 'Custom approval-safe salon automation agent.',
      providerKey: 'not_configured',
      autonomyLevel: 'approval_required',
      riskLevel: 'low',
      promptTitle: 'Custom salon operations copilot',
      promptText: 'Review salon operating data and create approval-safe recommendations only.',
      status: 'active'
    }));
  }

  toggleAgent(agent: AiAgent): void {
    const nextAction = agent.status === 'disabled' ? 'enable' : 'disable';
    this.saveAction(agent.id, this.api.post<AiAgent>(`ai-workforce/agents/${agent.id}/${nextAction}`, {}));
  }

  runAgent(agent: AiAgent): void {
    const setting = this.settingFor(agent.id);
    this.saveAction(agent.id, this.api.post<AiRun>(`ai-workforce/agents/${agent.id}/run`, {
      taskType: 'manual_dashboard_run',
      requestedAction: 'Prepare the next safe operational recommendation for this agent.',
      providerKey: setting?.providerKey || agent.providerKey || 'not_configured'
    }));
  }

  simulateAgent(agent: AiAgent | null): void {
    if (!agent) {
      this.error.set('Simulation ke liye pehle agent select karo.');
      return;
    }

    const setting = this.settingFor(agent.id);
    this.saveAction(`simulate-${agent.id}`, this.api.post<AiRun>(`ai-workforce/agents/${agent.id}/simulate`, {
      taskType: 'simulation_mode',
      requestedAction: 'Simulate this agent outcome without writing production data.',
      providerKey: setting?.providerKey || agent.providerKey || 'not_configured'
    }));
  }

  approveQueue(item: AiQueueItem): void {
    this.saveAction(item.id, this.api.post(`ai-workforce/queue/${item.id}/approve`, {
      note: 'Approved from AI Workforce OS.'
    }));
  }

  rejectQueue(item: AiQueueItem): void {
    this.saveAction(item.id, this.api.post(`ai-workforce/queue/${item.id}/reject`, {
      reason: 'Rejected from AI Workforce OS.'
    }));
  }

  editQueue(item: AiQueueItem): void {
    this.saveAction(item.id, this.api.post(`ai-workforce/queue/${item.id}/edit`, {
      editedPayload: {
        summary: `${item.summary || item.suggestedAction || 'AI decision'} Manager edited before approval.`,
        editedFromDashboard: true
      }
    }));
  }

  askAgain(item: AiQueueItem): void {
    if (!item.agentId) {
      this.error.set('Ask again ke liye queue item me agent link missing hai.');
      return;
    }

    this.saveAction(item.id, this.api.post(`ai-workforce/agents/${item.agentId}/run`, {
      taskType: 'approval_recheck',
      requestedAction: `Re-check this queued decision and produce a safer alternative for ${item.title || item.id}.`,
      sourceQueueId: item.id
    }));
  }

  acknowledgeAlert(alert: AiAlert): void {
    this.saveAction(alert.id, this.api.post(`ai-workforce/alerts/${alert.id}/acknowledge`, {}));
  }

  resolveAlert(alert: AiAlert): void {
    this.saveAction(alert.id, this.api.post(`ai-workforce/alerts/${alert.id}/resolve`, {
      resolutionNote: 'Resolved from AI Workforce OS.'
    }));
  }

  saveSetting(setting: AiSetting): void {
    this.saveAction(setting.agentId, this.api.patch(`ai-workforce/settings/${setting.agentId}`, {
      autonomyLevel: setting.autonomyLevel || 'approval_required',
      approvalRequired: this.isApprovalRequired(setting) ? 1 : 0,
      riskThreshold: setting.riskThreshold || 'medium',
      providerKey: setting.providerKey || 'not_configured',
      modelKey: setting.modelKey || 'not_configured',
      promptVersion: Number(setting.promptVersion || 1)
    }));
  }

  saveProvider(provider: AiProvider): void {
    const localProvider = provider.providerKey === 'local' || provider.providerKey === 'local_rules';
    const apiKeyRef = String(provider.apiKeyRef || '').trim();

    this.saveAction(`provider-${provider.providerKey}`, this.api.patch(`ai-workforce/providers/${provider.providerKey}`, {
      status: localProvider || apiKeyRef ? 'configured' : 'not_configured',
      modelKey: provider.modelKey || (localProvider ? 'rules-v1' : 'default'),
      apiKeyRef: apiKeyRef || undefined,
      configJson: {
        source: 'ai_workforce_dashboard',
        secretPolicy: 'reference_only'
      }
    }));
  }

  installTemplate(template: AiMarketplaceTemplate): void {
    this.saveAction(`marketplace-${template.templateKey}`, this.api.post(`ai-workforce/marketplace/${template.templateKey}/install`, {
      status: 'active',
      autonomyLevel: 'approval_required'
    }));
  }

  createPromptVersion(agent: AiAgent | null): void {
    if (!agent) {
      this.error.set('Prompt version ke liye pehle agent select karo.');
      return;
    }

    const setting = this.settingFor(agent.id);
    this.saveAction(`prompt-${agent.id}`, this.api.post(`ai-workforce/agents/${agent.id}/prompt-versions`, {
      promptTitle: `${agent.agentName || agent.agentKey} operating prompt`,
      promptKey: `${agent.agentKey || agent.id}-dashboard`,
      promptText: 'Create approval-safe, tenant-scoped salon operations recommendations with risk and confidence scores.',
      providerKey: setting?.providerKey || agent.providerKey || 'not_configured',
      modelKey: setting?.modelKey || 'not_configured',
      status: 'draft',
      approvalStatus: 'pending'
    }));
  }

  activatePrompt(prompt: AiPromptVersion): void {
    if (!prompt.agentId) {
      this.error.set('Prompt activate karne ke liye agent link missing hai.');
      return;
    }

    this.saveAction(`activate-prompt-${prompt.id}`, this.api.post(`ai-workforce/agents/${prompt.agentId}/prompt-versions/${prompt.id}/activate`, {
      approvalStatus: 'approved'
    }));
  }

  recordKpiImpact(agent: AiAgent | null): void {
    if (!agent) {
      this.error.set('KPI impact ke liye pehle agent select karo.');
      return;
    }

    this.saveAction(`kpi-${agent.id}`, this.api.post('ai-workforce/kpi-impact', {
      agentId: agent.id,
      kpiLabel: `${agent.agentName || agent.agentKey} projected value`,
      impactType: 'simulation_projection',
      estimatedRevenueImpact: 18000,
      confidence: 0.72,
      status: 'projected'
    }));
  }

  settingFor(agentId?: string): AiSetting | undefined {
    if (!agentId) {
      return undefined;
    }

    return this.settings().find((setting) => setting.agentId === agentId);
  }

  isApprovalRequired(setting?: AiSetting): boolean {
    if (!setting) {
      return true;
    }

    return setting.approvalRequired === true || setting.approvalRequired === 1 || setting.approvalRequired === undefined;
  }

  agentName(agentId?: string): string {
    if (!agentId) {
      return 'Unassigned agent';
    }

    const agent = this.agents().find((item) => item.id === agentId);
    return agent?.agentName || agent?.agentKey || 'AI agent';
  }

  actionLabels(item: AiQueueItem): string[] {
    const action = item.proposedActionJson;
    if (Array.isArray(action)) {
      return action.slice(0, 3).map((value) => String(value));
    }

    if (action && typeof action === 'object') {
      return Object.entries(action as Record<string, unknown>)
        .slice(0, 3)
        .map(([key, value]) => `${this.labelize(key)}: ${String(value)}`);
    }

    return [item.suggestedAction || 'Review before execution'];
  }

  permissionSummary(value: unknown): string {
    if (Array.isArray(value)) {
      return value.length ? value.join(', ') : 'All allowed';
    }

    if (value && typeof value === 'object') {
      const keys = Object.keys(value as Record<string, unknown>).filter((key) => Boolean((value as Record<string, unknown>)[key]));
      return keys.length ? keys.join(', ') : 'All allowed';
    }

    return 'All allowed';
  }

  runSummary(run: AiRun): string {
    if (run.resultSummary) {
      return run.resultSummary;
    }

    const output = run.outputJson;
    if (output && typeof output === 'object' && 'summary' in output) {
      return String((output as { summary?: unknown }).summary || 'Run completed');
    }

    if (run.errorMessage) {
      return 'Run failed';
    }

    return 'Provider-aware run record';
  }

  statusTone(status?: string): string {
    const normalized = String(status || '').toLowerCase();
    if (['active', 'completed', 'approved', 'resolved', 'success', 'posted'].includes(normalized)) {
      return 'good';
    }
    if (['pending', 'created', 'running', 'acknowledged'].includes(normalized)) {
      return 'warning';
    }
    if (['failed', 'disabled', 'rejected', 'open'].includes(normalized)) {
      return 'danger';
    }
    return 'neutral';
  }

  riskTone(risk?: string): string {
    const normalized = String(risk || '').toLowerCase();
    if (normalized === 'critical') {
      return 'critical';
    }
    if (normalized === 'high') {
      return 'danger';
    }
    if (normalized === 'medium') {
      return 'warning';
    }
    return 'good';
  }

  scoreFor(agent: AiAgent): number {
    const agentScore = Number(agent.safetyScore);
    if (Number.isFinite(agentScore) && agentScore > 0) {
      return Math.max(0, Math.min(100, Math.round(agentScore)));
    }

    const setting = this.settingFor(agent.id);
    if (setting?.riskThreshold === 'critical') {
      return 50;
    }
    if (setting?.riskThreshold === 'high') {
      return 70;
    }
    if (setting?.riskThreshold === 'medium') {
      return 86;
    }
    return 94;
  }

  autonomyLabel(value?: string): string {
    return this.labelize(value || 'approval_required');
  }

  providerLabel(value?: string): string {
    return this.labelize(value || 'not_configured');
  }

  providerConfigured(provider?: AiProvider): boolean {
    if (!provider) {
      return false;
    }
    if (provider.providerKey === 'local' || provider.providerKey === 'local_rules') {
      return true;
    }
    return provider.configured === true || provider.status === 'configured' || !!provider.apiKeyRef;
  }

  impactAmount(impact: AiKpiImpact): number {
    return Number(impact.estimatedValue ?? impact.estimatedRevenueImpact ?? 0);
  }

  initials(value: string): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'AI';
  }

  percent(value?: number): string {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) {
      return '0%';
    }

    const normalized = numeric > 1 ? numeric : numeric * 100;
    return `${Math.round(normalized)}%`;
  }

  formatDate(value?: string): string {
    if (!value) {
      return 'Not started';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  formatDuration(value?: number): string {
    const ms = Number(value || 0);
    if (!ms) {
      return '0s';
    }
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${Math.round(ms / 1000)}s`;
    }
    return `${Math.round(ms / 60000)}m`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: value >= 100 ? 0 : 2
    }).format(Number(value || 0));
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-IN').format(Number(value || 0));
  }

  trackById(_index: number, item: { id?: string }): string {
    return item.id || String(_index);
  }

  trackByProvider(_index: number, item: AiProvider): string {
    return item.providerKey;
  }

  trackByTemplate(_index: number, item: AiMarketplaceTemplate): string {
    return item.templateKey;
  }

  private totals(): AiTotals {
    const dashboardTotals = this.dashboard()?.totals || {};
    return {
      agents: Number(dashboardTotals.agents ?? this.agents().length),
      activeAgents: Number(dashboardTotals.activeAgents ?? this.agents().filter((agent) => agent.status !== 'disabled').length),
      pendingApprovals: Number(dashboardTotals.pendingApprovals ?? this.queue().length),
      highRiskActions: Number(dashboardTotals.highRiskActions ?? this.queue().filter((item) => ['high', 'critical'].includes(String(item.riskLevel))).length),
      failedRuns: Number(dashboardTotals.failedRuns ?? this.runs().filter((run) => run.status === 'failed').length),
      openAlerts: Number(dashboardTotals.openAlerts ?? this.alerts().length),
      aiCostToday: Number(dashboardTotals.aiCostToday ?? this.runs().reduce((sum, run) => sum + Number(run.estimatedCost || 0), 0)),
      aiCostMonth: Number(dashboardTotals.aiCostMonth ?? this.costSummary().monthCost ?? 0),
      estimatedKpiImpact: Number(dashboardTotals.estimatedKpiImpact ?? this.kpiImpact().reduce((sum, item) => sum + this.impactAmount(item), 0)),
      providerConfigs: Number(dashboardTotals.providerConfigs ?? this.configuredProviders()),
      promptVersions: Number(dashboardTotals.promptVersions ?? this.promptVersions().length)
    };
  }

  private saveAction(label: string, request$ = this.api.post(label, {})): void {
    this.saving.set(label);
    this.error.set('');

    request$
      .pipe(finalize(() => this.saving.set('')))
      .subscribe({
        next: () => this.loadAll(),
        error: (err: { message?: string }) => this.error.set(err?.message || 'Action complete nahi ho paya.')
      });
  }

  private labelize(value: string): string {
    return String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
