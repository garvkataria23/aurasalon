import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiRecord, ApiService } from '../core/api.service';
import { StateComponent } from '../shared/ui/state/state.component';

@Component({
  selector: 'app-security-policy-center',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, StateComponent],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Enterprise Security Shield</span>
          <h2>Security Policy Center</h2>
          <p>Control device trust, PIN re-auth, export protection and field-level audit policy from one owner/admin surface.</p>
        </div>
        <button class="ghost-button" type="button" (click)="load()">Refresh</button>
      </div>

      <app-state [loading]="loading()" [error]="error()"></app-state>

      <div class="metrics-grid">
        <article class="metric-card"><span>Device trust</span><strong>{{ enabledLabel('deviceTrustEnabled') }}</strong><small>Known browser/device layer</small></article>
        <article class="metric-card"><span>PIN re-auth</span><strong>{{ enabledLabel('securityPinRequiredForRefund') }}</strong><small>Manager action protection</small></article>
        <article class="metric-card"><span>Export guard</span><strong>{{ enabledLabel('exportProtectionEnabled') }}</strong><small>Download/export monitoring</small></article>
        <article class="metric-card"><span>Field audit</span><strong>{{ enabledLabel('fieldAuditEnabled') }}</strong><small>Sensitive field history</small></article>
        <article class="metric-card"><span>Risk score</span><strong>{{ latestRisk()?.riskScore ?? 0 }}</strong><small>{{ latestRisk()?.riskLevel || 'No signal' }}</small></article>
        <article class="metric-card"><span>Zenoti-style pack</span><strong>{{ zenotiPackCount() }}</strong><small>Advanced controls</small></article>
        <article class="metric-card"><span>Access devices</span><strong>{{ managedDevices().devices?.length || 0 }}</strong><small>Netflix-style control</small></article>
      </div>

      <section class="panel">
        <div class="section-title">
          <div>
            <h2>Policy controls</h2>
            <p>Changes apply tenant-wide unless branch scope is active.</p>
          </div>
          <button class="primary-button" type="button" (click)="savePolicies()">Save policies</button>
        </div>
        <div class="quick-grid">
          <label class="action-card policy-toggle" *ngFor="let toggle of toggles">
            <small>{{ toggle.layer }}</small>
            <strong>{{ toggle.label }}</strong>
            <span>{{ toggle.detail }}</span>
            <input type="checkbox" [ngModel]="policies()[toggle.key] === 'true'" (ngModelChange)="setPolicy(toggle.key, $event ? 'true' : 'false')" />
          </label>
        </div>
        <div class="form-grid">
          <label>
            <span>Daily export limit</span>
            <input type="number" [ngModel]="policies().exportDailyLimit" (ngModelChange)="setPolicy('exportDailyLimit', $event)" />
          </label>
          <label>
            <span>Max records per export</span>
            <input type="number" [ngModel]="policies().exportMaxRecords" (ngModelChange)="setPolicy('exportMaxRecords', $event)" />
          </label>
          <label>
            <span>Security PIN test</span>
            <div class="inline-row">
              <input type="password" [(ngModel)]="pin" placeholder="Enter PIN" />
              <button class="ghost-button" type="button" (click)="verifyPin()">Verify</button>
            </div>
          </label>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">
          <div>
            <h2>Manage Access & Devices</h2>
            <p>Review active devices/sessions, sign out one device, or sign out all devices for a user.</p>
          </div>
          <button class="ghost-button" type="button" (click)="loadNetflixPack()">Refresh access</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Device</th><th>User</th><th>IP</th><th>Status</th><th>Last seen</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let device of managedDevices().devices || []">
                <td>{{ device.deviceName || device.deviceId }}</td>
                <td>{{ device.userId || '-' }}</td>
                <td>{{ device.ipAddress || '-' }}</td>
                <td><span class="badge">{{ device.status }}</span></td>
                <td>{{ device.lastSeenAt | date: 'short' }}</td>
                <td>
                  <button class="ghost-button mini" type="button" (click)="signOutDevice(device)">Sign out device</button>
                  <button class="ghost-button mini" type="button" (click)="signOutAll(device.userId)">Sign out all</button>
                </td>
              </tr>
              <tr *ngIf="!(managedDevices().devices || []).length"><td colspan="6">No managed device records yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">
          <div>
            <h2>Subscription Guard + Anti Sharing</h2>
            <p>Premium modules can lock on expired plans, and multi-device/branch account sharing can be flagged.</p>
          </div>
          <button class="ghost-button" type="button" (click)="evaluateAccountSharing()">Evaluate sharing</button>
        </div>
        <div class="quick-grid">
          <article class="action-card">
            <small>Subscription Guard</small>
            <strong>{{ subscriptionEvents().length || 0 }} events</strong>
            <span>Reports/export/AI premium paths are guarded when subscription status is expired or suspended.</span>
          </article>
          <article class="action-card">
            <small>Anti Account Sharing</small>
            <strong>{{ sharingEvents().length || 0 }} signals</strong>
            <span>Flags same account across many devices or branches.</span>
          </article>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">
          <div>
            <h2>Fraud Warning Center</h2>
            <p>Client-visible safety messaging for OTP, password, payment links and phishing risk.</p>
          </div>
          <button class="primary-button" type="button" (click)="saveFraudWarning()">Add warning</button>
        </div>
        <div class="form-grid">
          <label><span>Title</span><input [(ngModel)]="fraudForm.title" placeholder="Never share OTP" /></label>
          <label><span>Message</span><input [(ngModel)]="fraudForm.message" placeholder="Aura staff will never ask for password or OTP." /></label>
          <label><span>Severity</span><select [(ngModel)]="fraudForm.severity"><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>
        </div>
        <div class="quick-grid">
          <article class="action-card" *ngFor="let warning of fraudWarnings()">
            <small>{{ warning.severity }}</small>
            <strong>{{ warning.title }}</strong>
            <span>{{ warning.message }}</span>
          </article>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">
          <div>
            <h2>Responsible Disclosure / Bug Report</h2>
            <p>Professional channel for reporting security issues without public disclosure.</p>
          </div>
          <button class="primary-button" type="button" (click)="createDisclosureReport()">Submit report</button>
        </div>
        <div class="form-grid">
          <label><span>Reporter</span><input [(ngModel)]="disclosureForm.reporterName" placeholder="Name" /></label>
          <label><span>Contact</span><input [(ngModel)]="disclosureForm.reporterContact" placeholder="email / phone" /></label>
          <label><span>Summary</span><input [(ngModel)]="disclosureForm.summary" placeholder="Security issue summary" /></label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Summary</th><th>Reporter</th><th>Severity</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              <tr *ngFor="let report of disclosureReports()">
                <td>{{ report.summary }}</td>
                <td>{{ report.reporterName || '-' }}</td>
                <td>{{ report.severity }}</td>
                <td>{{ report.status }}</td>
                <td>{{ report.createdAt | date: 'short' }}</td>
              </tr>
              <tr *ngIf="!disclosureReports().length"><td colspan="5">No disclosure reports yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">
          <div>
            <h2>Zenoti-Style Enterprise Pack</h2>
            <p>SSO readiness, privileged sessions, API governance, payment guard and privacy request controls.</p>
          </div>
          <button class="ghost-button" type="button" (click)="loadZenotiPack()">Refresh pack</button>
        </div>
        <div class="quick-grid">
          <article class="action-card">
            <small>SSO Readiness</small>
            <strong>{{ ssoSettings().length || 0 }} settings</strong>
            <span>SAML/OIDC provider policy placeholder for owner/admin roles.</span>
            <button class="ghost-button mini" type="button" (click)="saveSsoSetting()">Save draft</button>
          </article>
          <article class="action-card">
            <small>Privileged Session</small>
            <strong>{{ privilegedSessions().length || 0 }} sessions</strong>
            <span>Temporary elevated-action window for sensitive admin work.</span>
            <button class="ghost-button mini" type="button" (click)="startPrivilegedSession()">Start 15 min</button>
          </article>
          <article class="action-card">
            <small>API Governance</small>
            <strong>{{ apiClients().length || 0 }} clients</strong>
            <span>Register API clients with hashed tokens and revocation support.</span>
            <button class="ghost-button mini" type="button" (click)="createApiClient()">Create client</button>
          </article>
          <article class="action-card">
            <small>Payment Guard</small>
            <strong>{{ paymentGuardEvents().length || 0 }} events</strong>
            <span>Track payment data access and suspicious refund/payment events.</span>
            <button class="ghost-button mini" type="button" (click)="recordPaymentGuard()">Record event</button>
          </article>
          <article class="action-card">
            <small>Privacy Governance</small>
            <strong>{{ privacyRequests().length || 0 }} requests</strong>
            <span>Track access/export/delete privacy requests for clients.</span>
            <button class="ghost-button mini" type="button" (click)="createPrivacyRequest()">Create request</button>
          </article>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">
          <div>
            <h2>Risk Scoring Engine</h2>
            <p>Evaluates current session against device, IP, alert and sensitive-route signals.</p>
          </div>
          <button class="ghost-button" type="button" (click)="evaluateRisk()">Evaluate now</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Score</th><th>Level</th><th>Reasons</th><th>IP</th><th>Created</th></tr></thead>
            <tbody>
              <tr *ngFor="let event of riskEvents()">
                <td>{{ event.riskScore }}</td>
                <td><span class="badge">{{ event.riskLevel }}</span></td>
                <td>{{ joinList(event.reasons) || '-' }}</td>
                <td>{{ event.ipAddress || '-' }}</td>
                <td>{{ event.createdAt | date: 'short' }}</td>
              </tr>
              <tr *ngIf="!riskEvents().length"><td colspan="5">No risk events yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">
          <div>
            <h2>Sensitive Action Approval</h2>
            <p>Create approval queue entries for refunds, exports, high discounts and admin overrides.</p>
          </div>
          <button class="primary-button" type="button" (click)="createApproval()">Create request</button>
        </div>
        <div class="form-grid">
          <label><span>Action type</span><input [(ngModel)]="approvalForm.actionType" placeholder="refund_override" /></label>
          <label><span>Summary</span><input [(ngModel)]="approvalForm.summary" placeholder="Approve high-value refund" /></label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Action</th><th>Summary</th><th>Status</th><th>Requested by</th><th>Created</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let approval of approvals()">
                <td>{{ approval.actionType }}</td>
                <td>{{ approval.summary }}</td>
                <td><span class="badge">{{ approval.status }}</span></td>
                <td>{{ approval.requestedBy || '-' }}</td>
                <td>{{ approval.createdAt | date: 'short' }}</td>
                <td>
                  <button class="ghost-button mini" type="button" [disabled]="approval.status !== 'pending'" (click)="decideApproval(approval, 'approve')">Approve</button>
                  <button class="ghost-button mini" type="button" [disabled]="approval.status !== 'pending'" (click)="decideApproval(approval, 'reject')">Reject</button>
                </td>
              </tr>
              <tr *ngIf="!approvals().length"><td colspan="6">No approval requests yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">
          <div>
            <h2>IP Access Rules</h2>
            <p>Watch or deny suspicious IPs without changing the main blocklist flow.</p>
          </div>
          <button class="primary-button" type="button" (click)="createAccessRule()">Add rule</button>
        </div>
        <div class="form-grid">
          <label><span>IP / match value</span><input [(ngModel)]="ruleForm.matchValue" placeholder="103.21.244.0" /></label>
          <label><span>Effect</span><select [(ngModel)]="ruleForm.effect"><option value="watch">Watch</option><option value="deny">Deny signal</option><option value="allow">Allow</option></select></label>
          <label><span>Reason</span><input [(ngModel)]="ruleForm.reason" placeholder="Suspicious export attempts" /></label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Type</th><th>Value</th><th>Effect</th><th>Reason</th><th>Status</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let rule of accessRules()">
                <td>{{ rule.ruleType }}</td>
                <td>{{ rule.matchValue }}</td>
                <td>{{ rule.effect }}</td>
                <td>{{ rule.reason || '-' }}</td>
                <td>{{ rule.status }}</td>
                <td><button class="ghost-button mini" type="button" [disabled]="rule.status !== 'active'" (click)="disableRule(rule)">Disable</button></td>
              </tr>
              <tr *ngIf="!accessRules().length"><td colspan="6">No access rules yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">
          <div>
            <h2>Data Masking Policy</h2>
            <p>Define fields that should be partially or fully masked for restricted roles.</p>
          </div>
          <button class="primary-button" type="button" (click)="saveMask()">Save mask</button>
        </div>
        <div class="form-grid">
          <label><span>Entity</span><input [(ngModel)]="maskForm.entityType" placeholder="client" /></label>
          <label><span>Field</span><input [(ngModel)]="maskForm.fieldName" placeholder="mobile" /></label>
          <label><span>Mask</span><select [(ngModel)]="maskForm.maskType"><option value="partial">Partial</option><option value="full">Full</option><option value="last4">Last 4</option></select></label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Entity</th><th>Field</th><th>Mask</th><th>Allowed roles</th><th>Status</th></tr></thead>
            <tbody>
              <tr *ngFor="let mask of dataMasks()">
                <td>{{ mask.entityType }}</td>
                <td>{{ mask.fieldName }}</td>
                <td>{{ mask.maskType }}</td>
                <td>{{ mask.rolesAllowed }}</td>
                <td>{{ mask.status }}</td>
              </tr>
              <tr *ngIf="!dataMasks().length"><td colspan="5">No data masking policy yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="section-title"><h2>Security Response Playbooks</h2></div>
        <div class="quick-grid">
          <article class="action-card" *ngFor="let playbook of playbooks()">
            <small>{{ playbook.severity }}</small>
            <strong>{{ playbook.title }}</strong>
            <span>{{ joinList(playbook.checklist) }}</span>
          </article>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">
          <div>
            <h2>Device Trust Layer</h2>
            <p>Observe current browser/device, then trust or revoke devices after review.</p>
          </div>
          <button class="ghost-button" type="button" (click)="observeDevice()">Observe this device</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Device</th><th>User</th><th>IP</th><th>Status</th><th>Last seen</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let device of devices()">
                <td>{{ device.deviceName || device.deviceId }}</td>
                <td>{{ device.userId || '-' }}</td>
                <td>{{ device.ipAddress || '-' }}</td>
                <td><span class="badge">{{ device.status }}</span></td>
                <td>{{ device.lastSeenAt | date: 'short' }}</td>
                <td>
                  <button class="ghost-button mini" type="button" (click)="trustDevice(device)">Trust</button>
                  <button class="ghost-button mini" type="button" (click)="revokeDevice(device)">Revoke</button>
                </td>
              </tr>
              <tr *ngIf="!devices().length"><td colspan="6">No trusted-device records yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="section-title"><h2>Field-Level Audit</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Entity</th><th>Field</th><th>Old</th><th>New</th><th>User</th><th>Created</th></tr></thead>
            <tbody>
              <tr *ngFor="let log of fieldLogs()">
                <td>{{ log.entityType }} {{ log.entityId }}</td>
                <td>{{ log.fieldName }}</td>
                <td>{{ log.oldValue }}</td>
                <td>{{ log.newValue }}</td>
                <td>{{ log.userId || '-' }}</td>
                <td>{{ log.createdAt | date: 'short' }}</td>
              </tr>
              <tr *ngIf="!fieldLogs().length"><td colspan="6">No field audit records yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .policy-toggle { position: relative; }
    .policy-toggle input { position: absolute; right: 16px; top: 16px; width: 20px; height: 20px; accent-color: #0f8f82; }
    .form-grid { display: grid; gap: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 18px; }
    .form-grid label span { display: block; margin-bottom: 8px; color: #5b6b80; font-weight: 800; }
    .inline-row { display: flex; gap: 10px; }
    @media (max-width: 900px) { .form-grid { grid-template-columns: 1fr; } .inline-row { flex-direction: column; } }
  `]
})
export class SecurityPolicyCenterComponent implements OnInit {
  readonly policies = signal<ApiRecord>({});
  readonly devices = signal<ApiRecord[]>([]);
  readonly fieldLogs = signal<ApiRecord[]>([]);
  readonly riskEvents = signal<ApiRecord[]>([]);
  readonly approvals = signal<ApiRecord[]>([]);
  readonly accessRules = signal<ApiRecord[]>([]);
  readonly dataMasks = signal<ApiRecord[]>([]);
  readonly playbooks = signal<ApiRecord[]>([]);
  readonly ssoSettings = signal<ApiRecord[]>([]);
  readonly privilegedSessions = signal<ApiRecord[]>([]);
  readonly apiClients = signal<ApiRecord[]>([]);
  readonly paymentGuardEvents = signal<ApiRecord[]>([]);
  readonly privacyRequests = signal<ApiRecord[]>([]);
  readonly managedDevices = signal<ApiRecord>({ devices: [], activeTokens: [], revocations: [] });
  readonly subscriptionEvents = signal<ApiRecord[]>([]);
  readonly sharingEvents = signal<ApiRecord[]>([]);
  readonly fraudWarnings = signal<ApiRecord[]>([]);
  readonly disclosureReports = signal<ApiRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  pin = '';
  approvalForm: ApiRecord = { actionType: 'refund_override', summary: '' };
  ruleForm: ApiRecord = { ruleType: 'ip', matchValue: '', effect: 'watch', reason: '' };
  maskForm: ApiRecord = { entityType: 'client', fieldName: 'mobile', maskType: 'partial', rolesAllowed: 'owner,admin,superAdmin' };
  fraudForm: ApiRecord = { title: 'Never share OTP or password', message: 'Aura staff will never ask for OTP, password, card number or recovery code.', severity: 'warning' };
  disclosureForm: ApiRecord = { reporterName: '', reporterContact: '', summary: '', details: '', severity: 'warning' };

  readonly toggles = [
    { key: 'deviceTrustEnabled', layer: 'Device Trust Layer', label: 'Track trusted devices', detail: 'Observe browser/device identity and let owner/admin trust or revoke it.' },
    { key: 'securityPinRequiredForRefund', layer: 'Security PIN Re-auth', label: 'Require PIN for refunds', detail: 'Use manager PIN before high-risk money actions.' },
    { key: 'securityPinRequiredForExport', layer: 'Export Protection', label: 'Require PIN for exports', detail: 'Protect CSV/PDF/download routes with PIN verification when enabled.' },
    { key: 'exportProtectionEnabled', layer: 'Export Protection', label: 'Monitor export/download routes', detail: 'Detect export-like routes and add sensitive-access signals.' },
    { key: 'fieldAuditEnabled', layer: 'Field-Level Audit', label: 'Record sensitive field changes', detail: 'Store before/after values for investigation-ready history.' },
    { key: 'sessionRiskScoreEnabled', layer: 'Risk Scoring Engine', label: 'Session risk scoring', detail: 'Scores device, IP, open alerts and sensitive-route activity.' },
    { key: 'sensitiveApprovalRequired', layer: 'Sensitive Approval', label: 'Approval queue ready', detail: 'Routes risky admin actions through owner/admin approval.' },
    { key: 'ipAccessRulesEnabled', layer: 'IP Access Rules', label: 'IP rules enabled', detail: 'Watch, allow or deny-signal suspicious network sources.' },
    { key: 'dataMaskingEnabled', layer: 'Data Masking Policy', label: 'Data masking enabled', detail: 'Marks sensitive fields for masking by role.' },
    { key: 'securityPlaybooksEnabled', layer: 'Security Playbooks', label: 'Playbooks enabled', detail: 'Shows response checklists for security incidents.' },
    { key: 'ssoEnforcementReady', layer: 'SSO Readiness', label: 'SSO enforcement ready', detail: 'Prepares SAML/OIDC enforcement policy for admin roles.' },
    { key: 'privilegedSessionRequired', layer: 'Privileged Sessions', label: 'Privileged session required', detail: 'Uses temporary elevated sessions for sensitive admin work.' },
    { key: 'apiClientGovernanceEnabled', layer: 'API Governance', label: 'API client governance', detail: 'Controls API clients with hashed tokens and revocation.' },
    { key: 'paymentDataGuardEnabled', layer: 'Payment Guard', label: 'Payment data guard', detail: 'Tracks suspicious payment/refund data events.' },
    { key: 'privacyGovernanceEnabled', layer: 'Privacy Governance', label: 'Privacy request governance', detail: 'Tracks client access/export/delete privacy requests.' },
    { key: 'manageAccessDevicesEnabled', layer: 'Manage Access & Devices', label: 'Access/device control', detail: 'Shows devices and active sessions for owner/admin review.' },
    { key: 'sessionKillSwitchEnabled', layer: 'Session Kill Switch', label: 'Session kill switch', detail: 'Owner/admin can sign out one device or all user devices.' },
    { key: 'subscriptionGuardEnabled', layer: 'Subscription Guard', label: 'Subscription guard', detail: 'Locks premium reports/export/AI modules on expired plans.' },
    { key: 'antiAccountSharingEnabled', layer: 'Anti Account Sharing', label: 'Account sharing detection', detail: 'Flags many devices or branches using the same account.' },
    { key: 'fraudWarningCenterEnabled', layer: 'Fraud Warning Center', label: 'Fraud warning center', detail: 'Client-visible phishing and OTP safety messages.' },
    { key: 'responsibleDisclosureEnabled', layer: 'Bug Report', label: 'Responsible disclosure', detail: 'Security issue report queue for owner/admin review.' }
  ];

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list<{ policies: ApiRecord }>('security/policy').subscribe({
      next: (result) => {
        this.policies.set(result.policies || {});
        this.loadDevices();
        this.loadFieldAudit();
        this.loadRiskEvents();
        this.loadApprovals();
        this.loadAccessRules();
        this.loadDataMasks();
        this.loadPlaybooks();
        this.loadZenotiPack();
        this.loadNetflixPack();
      },
      error: (error) => { this.error.set(this.api.errorText(error)); this.loading.set(false); }
    });
  }

  loadDevices(): void {
    this.api.list<{ devices: ApiRecord[] }>('security/devices').subscribe({
      next: (result) => this.devices.set(result.devices || []),
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  loadFieldAudit(): void {
    this.api.list<{ logs: ApiRecord[] }>('security/field-audit').subscribe({
      next: (result) => { this.fieldLogs.set(result.logs || []); this.loading.set(false); },
      error: (error) => { this.error.set(this.api.errorText(error)); this.loading.set(false); }
    });
  }

  loadRiskEvents(): void {
    this.api.list<{ events: ApiRecord[] }>('security/risk/events').subscribe({
      next: (result) => this.riskEvents.set(result.events || []),
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  loadApprovals(): void {
    this.api.list<{ approvals: ApiRecord[] }>('security/approvals').subscribe({
      next: (result) => this.approvals.set(result.approvals || []),
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  loadAccessRules(): void {
    this.api.list<{ rules: ApiRecord[] }>('security/access-rules').subscribe({
      next: (result) => this.accessRules.set(result.rules || []),
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  loadDataMasks(): void {
    this.api.list<{ masks: ApiRecord[] }>('security/data-masks').subscribe({
      next: (result) => this.dataMasks.set(result.masks || []),
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  loadPlaybooks(): void {
    this.api.list<{ playbooks: ApiRecord[] }>('security/playbooks').subscribe({
      next: (result) => this.playbooks.set(result.playbooks || []),
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  loadZenotiPack(): void {
    this.api.list<{ settings: ApiRecord[] }>('security/sso-settings').subscribe({ next: (result) => this.ssoSettings.set(result.settings || []), error: (error) => this.error.set(this.api.errorText(error)) });
    this.api.list<{ sessions: ApiRecord[] }>('security/privileged-sessions').subscribe({ next: (result) => this.privilegedSessions.set(result.sessions || []), error: (error) => this.error.set(this.api.errorText(error)) });
    this.api.list<{ clients: ApiRecord[] }>('security/api-clients').subscribe({ next: (result) => this.apiClients.set(result.clients || []), error: (error) => this.error.set(this.api.errorText(error)) });
    this.api.list<{ events: ApiRecord[] }>('security/payment-guard').subscribe({ next: (result) => this.paymentGuardEvents.set(result.events || []), error: (error) => this.error.set(this.api.errorText(error)) });
    this.api.list<{ requests: ApiRecord[] }>('security/privacy-requests').subscribe({ next: (result) => this.privacyRequests.set(result.requests || []), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  loadNetflixPack(): void {
    this.api.list<ApiRecord>('security/access/devices').subscribe({ next: (result) => this.managedDevices.set(result || { devices: [], activeTokens: [], revocations: [] }), error: (error) => this.error.set(this.api.errorText(error)) });
    this.api.list<{ events: ApiRecord[] }>('security/subscription-guard').subscribe({ next: (result) => this.subscriptionEvents.set(result.events || []), error: (error) => this.error.set(this.api.errorText(error)) });
    this.api.list<{ events: ApiRecord[] }>('security/account-sharing').subscribe({ next: (result) => this.sharingEvents.set(result.events || []), error: (error) => this.error.set(this.api.errorText(error)) });
    this.api.list<{ warnings: ApiRecord[] }>('security/fraud-warnings').subscribe({ next: (result) => this.fraudWarnings.set(result.warnings || []), error: (error) => this.error.set(this.api.errorText(error)) });
    this.api.list<{ reports: ApiRecord[] }>('security/disclosure-reports').subscribe({ next: (result) => this.disclosureReports.set(result.reports || []), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  setPolicy(key: string, value: string): void {
    this.policies.set({ ...this.policies(), [key]: String(value) });
  }

  savePolicies(): void {
    this.api.put<{ policies: ApiRecord }>('security/policy', this.policies()).subscribe({
      next: (result) => this.policies.set(result.policies || {}),
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  verifyPin(): void {
    this.api.post('security/pin/verify', { pin: this.pin }).subscribe({
      next: () => { this.pin = ''; this.error.set(''); },
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  observeDevice(): void {
    this.api.post('security/devices/observe', {}).subscribe({
      next: () => this.loadDevices(),
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  trustDevice(device: ApiRecord): void {
    this.api.post(`security/devices/${device.id}/trust`, {}).subscribe({ next: () => this.loadDevices(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  revokeDevice(device: ApiRecord): void {
    this.api.post(`security/devices/${device.id}/revoke`, {}).subscribe({ next: () => this.loadDevices(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  evaluateRisk(): void {
    this.api.post('security/risk/evaluate', {}).subscribe({ next: () => this.loadRiskEvents(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  createApproval(): void {
    this.api.post('security/approvals', this.approvalForm).subscribe({
      next: () => { this.approvalForm = { actionType: 'refund_override', summary: '' }; this.loadApprovals(); },
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  decideApproval(approval: ApiRecord, decision: 'approve' | 'reject'): void {
    this.api.post(`security/approvals/${approval.id}/${decision}`, {}).subscribe({ next: () => this.loadApprovals(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  createAccessRule(): void {
    this.api.post('security/access-rules', this.ruleForm).subscribe({
      next: () => { this.ruleForm = { ruleType: 'ip', matchValue: '', effect: 'watch', reason: '' }; this.loadAccessRules(); },
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  disableRule(rule: ApiRecord): void {
    this.api.post(`security/access-rules/${rule.id}/disable`, {}).subscribe({ next: () => this.loadAccessRules(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  saveMask(): void {
    this.api.post('security/data-masks', this.maskForm).subscribe({
      next: () => { this.maskForm = { entityType: 'client', fieldName: 'mobile', maskType: 'partial', rolesAllowed: 'owner,admin,superAdmin' }; this.loadDataMasks(); },
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  saveSsoSetting(): void {
    this.api.post('security/sso-settings', { provider: 'saml', domainHint: 'company.com', status: 'draft' }).subscribe({ next: () => this.loadZenotiPack(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  startPrivilegedSession(): void {
    this.api.post('security/privileged-sessions', { purpose: 'Sensitive admin operation', minutes: 15 }).subscribe({ next: () => this.loadZenotiPack(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  createApiClient(): void {
    this.api.post('security/api-clients', { clientName: 'Enterprise integration', scopes: 'read:security,write:security' }).subscribe({ next: () => this.loadZenotiPack(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  recordPaymentGuard(): void {
    this.api.post('security/payment-guard', { eventType: 'payment_data_review', summary: 'Payment data guard event created from policy center', severity: 'info' }).subscribe({ next: () => this.loadZenotiPack(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  createPrivacyRequest(): void {
    this.api.post('security/privacy-requests', { requestType: 'access_review', summary: 'Client privacy request review', subjectType: 'client' }).subscribe({ next: () => this.loadZenotiPack(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  signOutDevice(device: ApiRecord): void {
    const deviceId = device.deviceId || device.id;
    this.api.post(`security/access/devices/${deviceId}/sign-out`, {}).subscribe({ next: () => this.loadNetflixPack(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  signOutAll(userId: string): void {
    this.api.post('security/access/sign-out-all', { userId }).subscribe({ next: () => this.loadNetflixPack(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  evaluateAccountSharing(): void {
    this.api.post('security/account-sharing/evaluate', {}).subscribe({ next: () => this.loadNetflixPack(), error: (error) => this.error.set(this.api.errorText(error)) });
  }

  saveFraudWarning(): void {
    this.api.post('security/fraud-warnings', this.fraudForm).subscribe({
      next: () => { this.fraudForm = { title: 'Never share OTP or password', message: 'Aura staff will never ask for OTP, password, card number or recovery code.', severity: 'warning' }; this.loadNetflixPack(); },
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  createDisclosureReport(): void {
    this.api.post('security/disclosure-reports', this.disclosureForm).subscribe({
      next: () => { this.disclosureForm = { reporterName: '', reporterContact: '', summary: '', details: '', severity: 'warning' }; this.loadNetflixPack(); },
      error: (error) => this.error.set(this.api.errorText(error))
    });
  }

  enabledLabel(key: string): string {
    return this.policies()[key] === 'false' ? 'Off' : 'On';
  }

  latestRisk(): ApiRecord | null {
    return this.riskEvents()[0] || null;
  }

  joinList(value: unknown): string {
    return Array.isArray(value) ? value.join(', ') : String(value || '');
  }

  zenotiPackCount(): number {
    return this.ssoSettings().length + this.privilegedSessions().length + this.apiClients().length + this.paymentGuardEvents().length + this.privacyRequests().length;
  }
}
