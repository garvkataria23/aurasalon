import { ApiRecord } from './api.service';

export type EntityStatus = 'active' | 'inactive' | 'on-leave' | 'draft' | 'archived';
export type AppointmentStatus =
  | 'draft'
  | 'booked'
  | 'confirmed'
  | 'arrived'
  | 'waiting'
  | 'in-service'
  | 'completed'
  | 'billed'
  | 'paid'
  | 'cancelled'
  | 'no-show'
  | 'rescheduled';
export type PaymentMode = 'cash' | 'upi' | 'card' | 'wallet' | 'split' | 'bank-transfer';
export type AIRecommendationType =
  | 'booking'
  | 'staff-suggestion'
  | 'guest-recommendation'
  | 'churn'
  | 'next-best-offer'
  | 'schedule-optimization'
  | 'reactivation'
  | 'review-timing'
  | 'fraud-anomaly';

export interface Branch {
  id: string;
  tenantId?: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  status?: EntityStatus;
}

export interface CommissionRule {
  type: 'percentage' | 'flat' | 'tiered';
  value?: number;
  servicePercent?: number;
  retailPercent?: number;
  membershipPercent?: number;
  packagePercent?: number;
  flatAmount?: number;
  tiers?: { threshold: number; bonusPercent: number }[];
}

export interface Employee {
  id: string;
  tenantId?: string;
  name: string;
  role: string;
  designation?: string;
  department?: string;
  phone?: string;
  email?: string;
  branchId: string;
  multiBranchIds?: string[];
  joiningDate?: string;
  shift?: string;
  status?: EntityStatus;
  assignedServices?: string[];
  permissions?: string[];
  commissionRule?: CommissionRule;
  targetMetrics?: {
    revenue?: number;
    bookings?: number;
    retailSales?: number;
    membershipSales?: number;
    packageSales?: number;
  };
  breakRules?: { start?: string; end?: string; minutes?: number };
  weeklyOffs?: string[];
  leaveBalance?: { casual?: number; sick?: number; paid?: number };
  biometricConfig?: { provider?: string; employeeCode?: string; enabled?: boolean };
  performance?: ApiRecord;
  attendance?: Attendance[];
  aiProfile?: ApiRecord;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeSchedule {
  id: string;
  tenantId?: string;
  branchId: string;
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  role?: string;
  chair?: string;
  room?: string;
  serviceIds?: string[];
  status?: 'planned' | 'published' | 'completed' | 'cancelled';
  notes?: string;
}

export interface Attendance {
  id?: string;
  tenantId?: string;
  branchId?: string;
  staffId: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'half-day' | 'leave';
  clockIn?: string;
  clockOut?: string;
  minutesWorked?: number;
  overtimeMinutes?: number;
  notes?: string;
}

export interface Payroll {
  id?: string;
  tenantId?: string;
  branchId?: string;
  staffId?: string;
  periodStart: string;
  periodEnd: string;
  basePay?: number;
  commission?: number;
  incentives?: number;
  overtimePay?: number;
  deductions?: number;
  grossPayout?: number;
  netPayout?: number;
  status?: 'draft' | 'ready' | 'paid';
}

export interface Guest {
  id: string;
  tenantId?: string;
  name: string;
  phone: string;
  email?: string;
  gender?: string;
  birthday?: string;
  anniversary?: string;
  tags?: string[];
  notes?: string;
  branchId?: string;
  totalSpend?: number;
  visitCount?: number;
  lastVisitAt?: string;
  walletBalance?: number;
  loyaltyPoints?: number;
  membershipId?: string;
  familyAccount?: { headClientId?: string; memberIds?: string[] };
  preferences?: ApiRecord;
  allergies?: string[];
  formulas?: ApiRecord[];
}

export interface GuestTimeline {
  id: string;
  clientId: string;
  type: 'appointment' | 'sale' | 'invoice' | 'payment' | 'membership' | 'package' | 'note' | 'complaint' | 'whatsapp';
  title: string;
  description?: string;
  amount?: number;
  staffId?: string;
  branchId?: string;
  metadata?: ApiRecord;
  createdAt: string;
}

export interface Appointment {
  id: string;
  tenantId?: string;
  branchId: string;
  clientId: string;
  staffId: string;
  serviceIds: string[];
  room?: string;
  chair?: string;
  startAt: string;
  endAt?: string;
  status?: AppointmentStatus;
  source?: 'front-desk' | 'online' | 'whatsapp' | 'walk-in' | 'phone' | 'campaign';
  billable?: boolean;
  notes?: string;
}

export interface Invoice {
  id: string;
  saleId: string;
  clientId: string;
  branchId?: string;
  staffId?: string;
  invoiceNumber: string;
  lineItems?: ApiRecord[];
  subtotal?: number;
  discount?: number;
  gstAmount?: number;
  total?: number;
  paid?: number;
  balance?: number;
  status?: 'unpaid' | 'partial' | 'paid' | 'refunded';
}

export interface Payment {
  id: string;
  invoiceId: string;
  mode: PaymentMode;
  amount: number;
  reference?: string;
  createdAt?: string;
}

export interface Membership {
  id: string;
  clientId: string;
  planName: string;
  price?: number;
  planCredits?: number;
  creditsRemaining?: number;
  validityDate?: string;
  status?: EntityStatus | 'expired';
}

export interface Package {
  id: string;
  tenantId?: string;
  name: string;
  code?: string;
  price?: number;
  validityDays?: number;
  serviceIds?: string[];
  benefits?: ApiRecord[];
  status?: EntityStatus;
}

export interface Loyalty {
  clientId: string;
  points: number;
  tier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  multiplier?: number;
}

export interface Wallet {
  clientId: string;
  balance: number;
  transactions?: ApiRecord[];
}

export interface InventoryUsage {
  id?: string;
  appointmentId?: string;
  saleId?: string;
  serviceId?: string;
  productId: string;
  branchId: string;
  quantity: number;
  reason?: string;
}

export interface WhatsAppMessage {
  id?: string;
  tenantId?: string;
  branchId?: string;
  clientId?: string;
  staffId?: string;
  eventType:
    | 'booking_confirmation'
    | 'appointment_reminder'
    | 'payment_link'
    | 'invoice'
    | 'birthday_offer'
    | 'inactive_guest_reactivation'
    | 'package_expiry'
    | 'membership_renewal'
    | 'feedback_request'
    | 'staff_notification';
  body: string;
  status?: 'draft' | 'queued' | 'sent' | 'failed' | 'blocked';
}

export interface AIRecommendation {
  id?: string;
  type: AIRecommendationType;
  title: string;
  message: string;
  score?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  recommendedAction?: string;
  sourceMetrics?: ApiRecord;
  createdAt?: string;
}
