import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type ShieldLayer = {
  level: string;
  title: string;
  status: string;
  detail: string;
  target?: string;
};

@Component({
  selector: 'app-enterprise-security-shield',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-stack">
      <div class="module-hero">
        <div>
          <span class="eyebrow">Enterprise Security Shield</span>
          <h2>Detect, alert, block, audit and recover from suspicious activity</h2>
          <p>Layered protection for browser headers, admin login, threat detection, active defense, device trust, PIN re-auth, export control, field audit, risk scoring, approvals, SSO readiness, subscription guard and access-device control.</p>
        </div>
        <a class="primary-button" routerLink="/security-alerts">Open alerts</a>
      </div>

      <div class="metrics-grid">
        <article class="metric-card"><span>Protection model</span><strong>28</strong><small>Security layers</small></article>
        <article class="metric-card"><span>Response mode</span><strong>Auto</strong><small>Alert + block</small></article>
        <article class="metric-card"><span>Audit trail</span><strong>On</strong><small>Existing security logs</small></article>
        <article class="metric-card"><span>Recovery</span><strong>Ready</strong><small>Backup/security controls</small></article>
      </div>

      <section class="panel">
        <div class="section-title"><h2>Security layers</h2></div>
        <div class="quick-grid">
          <article class="action-card" *ngFor="let layer of layers">
            <small>{{ layer.level }}</small>
            <strong>{{ layer.title }}</strong>
            <span>{{ layer.detail }}</span>
            <a *ngIf="layer.target" [routerLink]="layer.target">Open</a>
          </article>
        </div>
      </section>

      <section class="panel">
        <div class="section-title"><h2>Operational posture</h2></div>
        <div class="quick-grid">
          <article class="action-card">
            <strong>Secure Foundation</strong>
            <span>CSP, HSTS, cross-origin protections and API rate limiting are layered into middleware.</span>
          </article>
          <article class="action-card">
            <strong>Active Defense</strong>
            <span>Critical brute-force alerts can create temporary IP blocks without affecting localhost development by default.</span>
          </article>
          <article class="action-card">
            <strong>Honest Security Claim</strong>
            <span>The system does not claim impossible security; it focuses on detection, alerting, blocking, audit and recovery.</span>
          </article>
        </div>
      </section>
    </section>
  `
})
export class EnterpriseSecurityShieldComponent {
  readonly layers: ShieldLayer[] = [
    { level: 'Level 1', title: 'Secure Foundation', status: 'active', detail: 'Security headers, CSP, HSTS, frame protection and rate limiting.', target: '/security' },
    { level: 'Level 2', title: 'Strong Login Protection', status: 'active', detail: 'Admin 2FA with authenticator and recovery codes.', target: '/two-factor' },
    { level: 'Level 3', title: 'Threat Detection', status: 'active', detail: 'Failed login, new IP, off-hours, sensitive access and probing signals.', target: '/security-alerts' },
    { level: 'Level 4', title: 'Real-Time Alerts', status: 'active', detail: 'Critical and warning alerts are queued for owner/admin notification.', target: '/security-alerts' },
    { level: 'Level 5', title: 'Active Defense', status: 'active', detail: 'Automatic blocklist for critical brute-force indicators.', target: '/security-blocklist' },
    { level: 'Level 6', title: 'Audit Trail', status: 'active', detail: 'Security actions are written to the existing audit architecture.', target: '/audit-logs' },
    { level: 'Level 7', title: 'Recovery Readiness', status: 'available', detail: 'Backup and security controls remain visible in the security module.', target: '/security' },
    { level: 'Level 8', title: 'Device Trust Layer', status: 'active', detail: 'Owner/admin can observe, trust or revoke browser/device records.', target: '/security-policy-center' },
    { level: 'Level 9', title: 'Security PIN Re-auth', status: 'active', detail: 'High-risk actions can require an owner/admin security PIN.', target: '/security-policy-center' },
    { level: 'Level 10', title: 'Export Protection', status: 'active', detail: 'Export/download routes are detected and can require PIN verification.', target: '/security-policy-center' },
    { level: 'Level 11', title: 'Field-Level Audit', status: 'active', detail: 'Sensitive before/after field changes are stored for investigation history.', target: '/security-policy-center' },
    { level: 'Level 12', title: 'Security Policy Center', status: 'active', detail: 'Owner/admin can control tenant security flags from one page.', target: '/security-policy-center' },
    { level: 'Level 13', title: 'Risk Scoring Engine', status: 'active', detail: 'Current session risk can be scored from device, IP, alert and export signals.', target: '/security-policy-center' },
    { level: 'Level 14', title: 'Sensitive Action Approval', status: 'active', detail: 'Risky admin actions can be queued for owner/admin approval.', target: '/security-policy-center' },
    { level: 'Level 15', title: 'IP Access Rules', status: 'active', detail: 'Suspicious IPs can be watched or marked as deny-signal sources.', target: '/security-policy-center' },
    { level: 'Level 16', title: 'Data Masking Policy', status: 'active', detail: 'Sensitive fields can be registered for role-aware masking.', target: '/security-policy-center' },
    { level: 'Level 17', title: 'Security Response Playbooks', status: 'active', detail: 'Incident review checklists are available for fast owner/admin response.', target: '/security-policy-center' },
    { level: 'Level 18', title: 'SSO Readiness', status: 'active', detail: 'SAML/OIDC policy records are ready for enterprise identity enforcement.', target: '/security-policy-center' },
    { level: 'Level 19', title: 'Privileged Session Control', status: 'active', detail: 'Sensitive admin work can run inside temporary elevated sessions.', target: '/security-policy-center' },
    { level: 'Level 20', title: 'API Client Governance', status: 'active', detail: 'Integration clients use hashed tokens, scopes and revocation records.', target: '/security-policy-center' },
    { level: 'Level 21', title: 'Payment Data Guard', status: 'active', detail: 'Payment and refund security events can be tracked for review.', target: '/security-policy-center' },
    { level: 'Level 22', title: 'Privacy Governance', status: 'active', detail: 'Client access, export and delete requests are tracked through a review queue.', target: '/security-policy-center' },
    { level: 'Level 23', title: 'Manage Access & Devices', status: 'active', detail: 'Owner/admin can review devices, sessions, IP and last activity.', target: '/security-policy-center' },
    { level: 'Level 24', title: 'Session Kill Switch', status: 'active', detail: 'Owner/admin can sign out one device or all devices for a user.', target: '/security-policy-center' },
    { level: 'Level 25', title: 'Subscription Guard', status: 'active', detail: 'Expired or suspended plans can lock reports, exports and AI modules.', target: '/security-policy-center' },
    { level: 'Level 26', title: 'Anti Account Sharing', status: 'active', detail: 'Same account across many devices or branches is flagged for review.', target: '/security-policy-center' },
    { level: 'Level 27', title: 'Fraud Warning Center', status: 'active', detail: 'Client-visible OTP, password, payment-link and phishing warnings.', target: '/security-policy-center' },
    { level: 'Level 28', title: 'Responsible Disclosure', status: 'active', detail: 'Security issue reports are captured in a professional review queue.', target: '/security-policy-center' }
  ];
}
