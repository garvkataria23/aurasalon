import { Routes } from '@angular/router';
import { AiAssistantComponent } from './pages/ai-assistant.component';
import { AiMarketingAutomationComponent } from './pages/ai-marketing-automation.component';
import { AnalyticsEngineComponent } from './pages/analytics-engine.component';
import { AppointmentsComponent } from './pages/appointments.component';
import { BookingPortalComponent } from './pages/booking-portal.component';
import { ClientDetailComponent } from './pages/client-detail.component';
import { ClientsComponent } from './pages/clients.component';
import { ComplianceAuditComponent } from './pages/compliance-audit.component';
import { Customer360Component } from './pages/customer-360.component';
import { DashboardComponent } from './pages/dashboard.component';
import { DeploymentReadyComponent } from './pages/deployment-ready.component';
import { DesignSystemComponent } from './pages/design-system.component';
import { FinanceEngineComponent } from './pages/finance-engine.component';
import { FutureFeaturesComponent } from './pages/future-features.component';
import { InventoryComponent } from './pages/inventory.component';
import { MembershipsComponent } from './pages/memberships.component';
import { ModulePageComponent } from './pages/module-page.component';
import { OfflineSupportComponent } from './pages/offline-support.component';
import { PermissionMatrixComponent } from './pages/permission-matrix.component';
import { PosComponent } from './pages/pos.component';
import { PrdComponent } from './pages/prd.component';
import { QualityCenterComponent } from './pages/quality-center.component';
import { ReportsComponent } from './pages/reports.component';
import { SaasOnboardingComponent } from './pages/saas-onboarding.component';
import { SecurityLayerComponent } from './pages/security-layer.component';
import { SmartBookingComponent } from './pages/smart-booking.component';
import { StaffManagementComponent } from './pages/staff-management.component';
import { SuperAdminComponent } from './pages/super-admin.component';
import { WhatsAppAutomationComponent } from './pages/whatsapp-automation.component';
import { WhiteLabelComponent } from './pages/white-label.component';
import { WorkflowEngineComponent } from './pages/workflow-engine.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent, title: 'Dashboard' },
  { path: 'prd', component: PrdComponent, title: 'Product Requirement Document' },
  { path: 'design-system', component: DesignSystemComponent, title: 'Design System' },
  { path: 'ai', component: AiAssistantComponent, title: 'AI Assistant' },
  { path: 'analytics', component: AnalyticsEngineComponent, title: 'Advanced Analytics' },
  { path: 'smart-booking', component: SmartBookingComponent, title: 'Smart Booking System' },
  { path: 'security', component: SecurityLayerComponent, title: 'Enterprise Security' },
  { path: 'permissions', component: PermissionMatrixComponent, title: 'Permission Matrix' },
  { path: 'compliance', component: ComplianceAuditComponent, title: 'Audit and Compliance' },
  { path: 'quality', component: QualityCenterComponent, title: 'Testing and Quality' },
  { path: 'deployment', component: DeploymentReadyComponent, title: 'Deployment Ready' },
  { path: 'offline', component: OfflineSupportComponent, title: 'Offline Support' },
  { path: 'white-label', component: WhiteLabelComponent, title: 'White Label SaaS' },
  { path: 'future-features', component: FutureFeaturesComponent, title: 'Future Salon Intelligence' },
  { path: 'workflows', component: WorkflowEngineComponent, title: 'Workflow Engine' },
  { path: 'finance', component: FinanceEngineComponent, title: 'Finance Engine' },
  { path: 'customer-360', component: Customer360Component, title: 'Customer 360' },
  { path: 'book', component: BookingPortalComponent, title: 'Online Booking' },
  { path: 'appointments', component: AppointmentsComponent, title: 'Appointment Calendar' },
  { path: 'clients', component: ClientsComponent, title: 'Client CRM' },
  { path: 'clients/:id', component: ClientDetailComponent, title: 'Client Profile' },
  { path: 'pos', component: PosComponent, title: 'POS Billing' },
  {
    path: 'services',
    component: ModulePageComponent,
    title: 'Services',
    data: {
      entity: 'services',
      title: 'Services, Add-ons & Packages',
      subtitle: 'Configure price, duration, staff assignment, GST and internal product usage.',
      createLabel: 'Add service',
      columns: [
        { key: 'name', label: 'Service' },
        { key: 'category', label: 'Category' },
        { key: 'price', label: 'Price', type: 'currency' },
        { key: 'durationMinutes', label: 'Duration' },
        { key: 'gstRate', label: 'GST %' },
        { key: 'status', label: 'Status', type: 'badge' }
      ],
      fields: [
        { key: 'name', label: 'Service name', required: true },
        { key: 'category', label: 'Category', required: true },
        { key: 'price', label: 'Price', type: 'number', required: true },
        { key: 'durationMinutes', label: 'Duration minutes', type: 'number', required: true },
        { key: 'gstRate', label: 'GST rate', type: 'number', defaultValue: 18 },
        { key: 'assignedStaff', label: 'Assigned staff IDs JSON', type: 'json', defaultValue: [] },
        { key: 'requiredProducts', label: 'Required products JSON', type: 'json', defaultValue: [] },
        { key: 'addOns', label: 'Add-ons JSON', type: 'json', defaultValue: [] },
        { key: 'packageServices', label: 'Package service IDs JSON', type: 'json', defaultValue: [] }
      ]
    }
  },
  { path: 'inventory', component: InventoryComponent, title: 'Products & Inventory' },
  { path: 'memberships', component: MembershipsComponent, title: 'Memberships & Loyalty' },
  { path: 'staff', component: StaffManagementComponent, title: 'Smart Staff Management' },
  { path: 'marketing', component: AiMarketingAutomationComponent, title: 'AI Marketing Automation' },
  { path: 'whatsapp', component: WhatsAppAutomationComponent, title: 'WhatsApp Automation' },
  { path: 'reports', component: ReportsComponent, title: 'Reports & Analytics' },
  { path: 'saas', component: SaasOnboardingComponent, title: 'SaaS Control' },
  { path: 'super-admin', component: SuperAdminComponent, title: 'SaaS Super Admin' },
  {
    path: 'branches',
    component: ModulePageComponent,
    title: 'Multi-Branch',
    data: {
      entity: 'branches',
      title: 'Multi-Branch Operations',
      subtitle: 'Manage salon locations, GSTIN, contact details and operational status.',
      createLabel: 'Add branch',
      columns: [
        { key: 'name', label: 'Branch' },
        { key: 'city', label: 'City' },
        { key: 'phone', label: 'Phone' },
        { key: 'gstin', label: 'GSTIN' },
        { key: 'status', label: 'Status', type: 'badge' }
      ],
      fields: [
        { key: 'name', label: 'Branch name', required: true },
        { key: 'city', label: 'City', required: true },
        { key: 'address', label: 'Address' },
        { key: 'phone', label: 'Phone' },
        { key: 'gstin', label: 'GSTIN' },
        { key: 'timezone', label: 'Timezone', defaultValue: 'Asia/Kolkata' }
      ]
    }
  },
  {
    path: 'settings',
    component: ModulePageComponent,
    title: 'Settings',
    data: {
      entity: 'settings',
      title: 'Settings',
      subtitle: 'Salon profile, GST, payment modes, invoices, roles and notification templates.',
      createLabel: 'Add setting',
      columns: [
        { key: 'key', label: 'Key' },
        { key: 'scope', label: 'Scope' },
        { key: 'value', label: 'Value', type: 'json' }
      ],
      fields: [
        { key: 'key', label: 'Key', required: true },
        { key: 'scope', label: 'Scope', defaultValue: 'global' },
        { key: 'value', label: 'Value JSON', type: 'json', defaultValue: {} }
      ]
    }
  },
  { path: '**', redirectTo: 'dashboard' }
];
