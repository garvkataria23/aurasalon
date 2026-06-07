import { Injectable } from '@angular/core';
import { ApiRecord } from './api.service';
import { AIRecommendation, Employee, Guest, WhatsAppMessage } from './enterprise-salon.models';

@Injectable({ providedIn: 'root' })
export class EnterpriseIntelligenceService {
  employeeRecommendations(input: {
    employee: Employee | ApiRecord;
    revenue: number;
    bookings: number;
    utilization: number;
    punctuality: number;
    targetRevenue: number;
    targetBookings: number;
  }): AIRecommendation[] {
    const employee = input.employee;
    const name = String(employee.name || 'Employee');
    const rows: AIRecommendation[] = [];
    const revenueGap = Math.max(0, input.targetRevenue - input.revenue);
    const bookingGap = Math.max(0, input.targetBookings - input.bookings);
    if (input.utilization >= 85) {
      rows.push({
        type: 'schedule-optimization',
        title: 'Balance workload',
        message: `${name} is above ${input.utilization}% utilization. Move flexible bookings to a lower-load employee or add a protected break.`,
        riskLevel: 'medium',
        recommendedAction: 'Review schedule before accepting more long services',
        sourceMetrics: { utilization: input.utilization }
      });
    }
    if (input.utilization <= 35) {
      rows.push({
        type: 'staff-suggestion',
        title: 'Fill idle capacity',
        message: `${name} has visible idle capacity. Prioritize rebooking, add-on services, or walk-in allocation.`,
        riskLevel: 'low',
        recommendedAction: 'Assign next suitable walk-in or rebooking lead',
        sourceMetrics: { utilization: input.utilization }
      });
    }
    if (revenueGap > 0 || bookingGap > 0) {
      rows.push({
        type: 'next-best-offer',
        title: 'Target recovery plan',
        message: `${name} needs ${revenueGap ? `₹${Math.round(revenueGap)} revenue` : 'no revenue gap'}${bookingGap ? ` and ${bookingGap} booking(s)` : ''} to hit target.`,
        riskLevel: revenueGap > input.targetRevenue * 0.5 ? 'high' : 'medium',
        recommendedAction: 'Suggest high-fit service upsells and membership/package conversion at POS',
        sourceMetrics: { revenueGap, bookingGap }
      });
    }
    if (input.punctuality < 75) {
      rows.push({
        type: 'fraud-anomaly',
        title: 'Attendance anomaly watch',
        message: `${name} has ${input.punctuality}% punctuality. Verify late marks, biometric source, and shift compliance.`,
        riskLevel: 'medium',
        recommendedAction: 'Review attendance and require manager approval for corrections',
        sourceMetrics: { punctuality: input.punctuality }
      });
    }
    if (!rows.length) {
      rows.push({
        type: 'staff-suggestion',
        title: 'Employee plan stable',
        message: `${name} is balanced on current visible performance, attendance and target signals.`,
        riskLevel: 'low',
        recommendedAction: 'Keep current schedule and review after the next commission run',
        sourceMetrics: {
          revenue: input.revenue,
          bookings: input.bookings,
          utilization: input.utilization,
          punctuality: input.punctuality
        }
      });
    }
    return rows;
  }

  guestRecommendations(input: {
    guest: Guest | ApiRecord;
    totalSpend: number;
    visitCount: number;
    inactiveDays: number;
    pendingPayment: number;
    membershipActive: boolean;
  }): AIRecommendation[] {
    const guest = input.guest;
    const name = String(guest.name || 'Guest');
    const rows: AIRecommendation[] = [];
    if (input.pendingPayment > 0) {
      rows.push({
        type: 'next-best-offer',
        title: 'Payment recovery first',
        message: `${name} has ₹${Math.round(input.pendingPayment)} pending. Recover balance before adding a new offer.`,
        riskLevel: 'medium',
        recommendedAction: 'Send polite payment reminder draft'
      });
    }
    if (input.inactiveDays >= 45) {
      rows.push({
        type: 'reactivation',
        title: 'Win-back opportunity',
        message: `${name} has been inactive for ${input.inactiveDays} days. Use a personalized rebooking message.`,
        riskLevel: input.inactiveDays >= 90 ? 'high' : 'medium',
        recommendedAction: 'Offer preferred service slot with favorite staff'
      });
    }
    if (!input.membershipActive && input.visitCount >= 3) {
      rows.push({
        type: 'next-best-offer',
        title: 'Membership conversion',
        message: `${name} is a repeat guest without active membership. Recommend prepaid credits or package renewal.`,
        riskLevel: 'low',
        recommendedAction: 'Offer membership/package at billing'
      });
    }
    return rows.length ? rows : [{
      type: 'guest-recommendation',
      title: 'Guest relationship healthy',
      message: `${name} has no urgent visible recovery signal. Keep rebooking and review request timing active.`,
      riskLevel: 'low',
      recommendedAction: 'Send next-visit recommendation after checkout'
    }];
  }

  whatsappDraft(eventType: WhatsAppMessage['eventType'], target: ApiRecord): WhatsAppMessage {
    const name = String(target.name || target.staffName || target.clientName || 'there');
    const templates: Record<WhatsAppMessage['eventType'], string> = {
      booking_confirmation: `Hi ${name}, your appointment is confirmed. Reply YES to confirm or call us to reschedule.`,
      appointment_reminder: `Hi ${name}, reminder for your upcoming salon appointment. Please arrive 10 minutes early.`,
      payment_link: `Hi ${name}, your payment link is ready. Please complete payment at your convenience.`,
      invoice: `Hi ${name}, your invoice is ready. Thank you for visiting AuraShine Salon.`,
      birthday_offer: `Happy birthday ${name}! We have a special salon treat ready for your next visit.`,
      inactive_guest_reactivation: `Hi ${name}, we miss you. Reply with a preferred time and we will help book your next visit.`,
      package_expiry: `Hi ${name}, your package benefits may expire soon. Book your next service to use remaining value.`,
      membership_renewal: `Hi ${name}, your membership renewal is due. Renew to keep your salon benefits active.`,
      feedback_request: `Hi ${name}, thank you for visiting. Please share your feedback so we can serve you better.`,
      staff_notification: `Hi ${name}, your staff schedule or booking update is ready in AuraShine Salon OS.`
    };
    return {
      eventType,
      body: templates[eventType],
      status: 'draft',
      clientId: target.clientId || target.id || '',
      staffId: target.staffId || ''
    };
  }
}
