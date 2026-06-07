import { Route, Routes } from '@angular/router';
import { ComplianceRouteMeta } from './domain/compliance.models';

const page = (path: string, meta: ComplianceRouteMeta): Route => ({
  path,
  loadComponent: () => import('./pages/compliance-section.page').then((m) => m.ComplianceSectionPage),
  data: { meta },
  title: meta.title
});

export const COMPLIANCE_ROUTES: Routes = [
  page('', {
    title: 'Statutory Compliance Dashboard',
    subtitle: 'PF, ESI, PT, TDS, gratuity, bonus, LWF and FY closure control center.',
    module: 'dashboard',
    primaryAction: 'Refresh status'
  }),
  page('pf', {
    title: 'Provident Fund Management',
    subtitle: 'Calculate PF, generate ECR, track TRRN challans and annual PF returns.',
    module: 'pf',
    primaryAction: 'Calculate PF batch'
  }),
  page('esi', {
    title: 'ESI Management',
    subtitle: 'Manage ESI applicability, contribution periods, return files and challan status.',
    module: 'esi',
    primaryAction: 'Calculate ESI batch'
  }),
  page('pt', {
    title: 'Professional Tax',
    subtitle: 'State-wise PT slabs, monthly deductions, return generation and cap checks.',
    module: 'pt',
    primaryAction: 'Generate PT return'
  }),
  page('tds', {
    title: 'TDS Section 192',
    subtitle: 'Old/new regime comparison, declarations, proof verification, 24Q and Form 16.',
    module: 'tds',
    primaryAction: 'Compare regimes'
  }),
  page('tax-declaration', {
    title: 'Tax Declaration',
    subtitle: 'Staff-facing tax declaration workflow with proof submission and HR verification.',
    module: 'tds',
    primaryAction: 'Submit declaration'
  }),
  page('proof-verification', {
    title: 'Proof Verification',
    subtitle: 'HR queue for validating employee investment proofs and locking declarations.',
    module: 'tds',
    primaryAction: 'Verify proofs'
  }),
  page('gratuity', {
    title: 'Gratuity Tracker',
    subtitle: 'Eligibility, monthly provisioning and final payout calculations.',
    module: 'gratuity',
    primaryAction: 'Provision monthly'
  }),
  page('bonus', {
    title: 'Bonus Calculator',
    subtitle: 'Bonus Act eligibility, Form C export and annual disbursement workflow.',
    module: 'bonus',
    primaryAction: 'Calculate bonus'
  }),
  page('form-16', {
    title: 'Form 16 Generator',
    subtitle: 'Generate employee-wise Form 16 drafts with salary and TDS totals.',
    module: 'tds',
    primaryAction: 'Generate Form 16'
  }),
  page('form-24q', {
    title: 'Form 24Q Generator',
    subtitle: 'Quarterly TDS return file generation with FVU-ready structure.',
    module: 'tds',
    primaryAction: 'Generate 24Q'
  }),
  page('calendar', {
    title: 'Compliance Calendar',
    subtitle: 'Indian statutory deadline reminders across monthly, quarterly and annual filings.',
    module: 'calendar',
    primaryAction: 'View deadlines'
  }),
  page('reports', {
    title: 'Compliance Reports',
    subtitle: 'Export-ready PF, ESI, PT, TDS, annual compliance pack and audit trail reports.',
    module: 'reports',
    primaryAction: 'Export report'
  }),
  page('fy-closure', {
    title: 'FY Closure',
    subtitle: 'Lock or reopen statutory financial years with audit-backed controls.',
    module: 'fy',
    primaryAction: 'Check FY status'
  })
];
