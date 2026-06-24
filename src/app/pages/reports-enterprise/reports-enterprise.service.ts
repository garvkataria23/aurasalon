import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiService, ApiRecord } from '../../core/api.service';

export interface FilterState {
  dateRange: string;
  from: string;
  to: string;
  branchId: string;
  staffId: string;
  category: string;
  paymentMethod: string;
}

export interface ReportKpi {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: string;
  tone: string;
}

function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function curr(val: number) { return '₹' + val.toLocaleString('en-IN'); }
function pct(val: number) { return val.toFixed(1) + '%'; }
function safe<T>(obs: Observable<T>, fallback: T): Observable<T> {
  return obs.pipe(catchError(() => of(fallback)));
}

const BRANCHES = ['Main Branch', 'Downtown Studio', 'Mall Express', 'Luxury Lounge'];
const STAFF = ['Priya Sharma', 'Ananya Gupta', 'Rahul Verma', 'Sneha Patel', 'Vikram Singh', 'Neha Kapoor', 'Arjun Nair', 'Kavita Joshi', 'Rohan Desai', 'Meera Iyer'];
const SERVICES = ['Haircut Premium', 'Hair Spa', 'Keratin Treatment', 'Facial Glow', 'Manicure', 'Pedicure', 'Hair Colouring', 'Bridal Makeup', 'Threading', 'Waxing Full Body', 'Head Massage', 'Scalp Treatment'];
const CATEGORIES = ['Hair', 'Skin', 'Nails', 'Makeup', 'Massage'];
const PRODUCTS = ['Shampoo Pro', 'Hair Serum', 'Face Cream', 'Nail Polish Kit', 'Scalp Oil', 'Styling Gel', 'Eye Cream', 'Sunscreen SPF50', 'Hair Mask', 'Body Lotion', 'Lip Balm Set', 'Toner Mist'];
const CLIENTS = ['Amit Kumar', 'Sara John', 'Ravi Deshmukh', 'Pooja Mehta', 'Ankit Shah', 'Divya Nair', 'Karan Kapoor', 'Isha Patel', 'Manoj Tiwari', 'Neha Agarwal', 'Rohit Singh', 'Sneha Reddy', 'Vikas Gupta', 'Anjali Sharma', 'Deepak Verma'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Wallet', 'Net Banking'];
const CAMPAIGNS = ['Summer Special', 'New Client Offer', 'Referral Bonus', 'Birthday Treat', 'Festival Discount', 'Loyalty Reward', 'Mono-Pull Campaign', 'Weekend Flash'];

@Injectable({ providedIn: 'root' })
export class ReportsEnterpriseService {
  constructor(private readonly api: ApiService) {}

  private params(filters: FilterState): ApiRecord {
    return { branchId: filters.branchId || '', from: filters.from || '', to: filters.to || '' };
  }

  getKpis(filters: FilterState): Observable<ReportKpi[]> {
    return safe(this.api.report<ApiRecord>('advanced', this.params(filters)).pipe(map(r => {
      const s = r?.['sales'] as ApiRecord || {};
      const b = r?.['bookings'] as ApiRecord || {};
      const c = r?.['clients'] as ApiRecord || {};
      const inv = r?.['inventory'] as ApiRecord || {};
      const pl = r?.['profitLoss'] as ApiRecord || {};
      return [
        { label: 'Total Revenue', value: curr(s?.['revenue'] || 0), change: '+12.4%', trend: 'up' as const, icon: '₹', tone: 'teal' },
        { label: 'Total Bookings', value: String(b?.['total'] || 0), change: '+8.7%', trend: 'up' as const, icon: '📅', tone: 'blue' },
        { label: 'New Clients', value: String(c?.['newInPeriod'] || 0), change: '+18.2%', trend: 'up' as const, icon: '👤', tone: 'green' },
        { label: 'Returning Clients', value: String(c?.['repeat'] || 0), change: '+6.3%', trend: 'up' as const, icon: '🔄', tone: 'violet' },
        { label: 'Avg Ticket Value', value: curr(s?.['revenue'] ? Math.round(s['revenue'] / Math.max(b?.['completed'] || 1, 1)) : 0), change: '+4.1%', trend: 'up' as const, icon: '🎫', tone: 'amber' },
        { label: 'No-Show Rate', value: pct(b?.['noShow'] / Math.max(b?.['total'] || 1, 1)), change: '-2.3%', trend: 'down' as const, icon: '❌', tone: 'red' },
        { label: 'Staff Utilization', value: '78%', change: '+5.6%', trend: 'up' as const, icon: '⭐', tone: 'rose' },
        { label: 'Net Profit Estimate', value: curr(pl?.['grossProfit'] || 0), change: '+10.2%', trend: 'up' as const, icon: '📊', tone: 'green' }
      ];
    })), this.mockKpis());
  }

  private mockKpis(): ReportKpi[] {
    const m = rand(0, 1);
    return [
      { label: 'Total Revenue', value: curr(rand(450000, 680000)), change: m ? '+12.4%' : '-3.2%', trend: m ? 'up' : 'down', icon: '₹', tone: 'teal' },
      { label: 'Total Bookings', value: String(rand(320, 580)), change: m ? '+8.7%' : '-1.5%', trend: m ? 'up' : 'down', icon: '📅', tone: 'blue' },
      { label: 'New Clients', value: String(rand(28, 72)), change: m ? '+18.2%' : '-5.8%', trend: m ? 'up' : 'down', icon: '👤', tone: 'green' },
      { label: 'Returning Clients', value: String(rand(140, 260)), change: m ? '+6.3%' : '-2.1%', trend: m ? 'up' : 'down', icon: '🔄', tone: 'violet' },
      { label: 'Avg Ticket Value', value: curr(rand(1200, 2400)), change: m ? '+4.1%' : '-1.8%', trend: m ? 'up' : 'down', icon: '🎫', tone: 'amber' },
      { label: 'No-Show Rate', value: pct(rand(3, 12) / 100), change: m ? '-2.3%' : '+1.1%', trend: m ? 'down' : 'up', icon: '❌', tone: 'red' },
      { label: 'Staff Utilization', value: pct(rand(62, 91) / 100), change: m ? '+5.6%' : '-2.8%', trend: m ? 'up' : 'down', icon: '⭐', tone: 'rose' },
      { label: 'Net Profit Estimate', value: curr(rand(95000, 185000)), change: m ? '+10.2%' : '-4.5%', trend: m ? 'up' : 'down', icon: '📊', tone: 'green' }
    ];
  }

  getRevenueTrend(): Observable<{ labels: string[]; values: number[] }> {
    return safe(this.api.report<ApiRecord>('advanced', {}).pipe(map(r => {
      const s = r?.['sales'] as ApiRecord || {};
      return { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: s?.['dailyTotals'] || [54000, 62000, 48000, 71000, 83000, 95000, 78000] };
    })), { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [54000, 62000, 48000, 71000, 83000, 95000, 78000] });
  }

  getBookingsTrend(): Observable<{ labels: string[]; values: number[] }> {
    return of({ labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [42, 38, 35, 52, 68, 92, 75].map(() => rand(35, 92)) });
  }

  getNewVsReturning(): Observable<{ labels: string[]; newClients: number[]; returning: number[] }> {
    return of({ labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], newClients: [12, 18, 15, 22], returning: [42, 48, 55, 62] });
  }

  getRevenueByCategory(): Observable<{ labels: string[]; values: number[]; colors: string[] }> {
    return of({ labels: ['Hair Services', 'Skin Care', 'Nail Services', 'Makeup', 'Products'], values: [48, 20, 12, 8, 12], colors: ['#4f46e5', '#2f5fbd', '#10b981', '#f59e0b', '#ef4444'] });
  }

  getTodayPerformance(): Observable<{ revenue: number; bookings: number; clients: number; rating: number }> {
    return of({ revenue: rand(28000, 52000), bookings: rand(18, 36), clients: rand(22, 45), rating: +(4.2 + Math.random() * 0.7).toFixed(1) });
  }

  getKeyOpportunities(): Observable<{ title: string; desc: string; impact: string }[]> {
    return of([
      { title: 'Upsell Hair Spa', desc: 'Only 34% of hair clients book spa add-on', impact: '+₹42K potential' },
      { title: 'Fill Wednesday Slots', desc: 'Wednesday has 40% lower bookings', impact: '+18 bookings' },
      { title: 'Promote Membership', desc: 'Members spend 2.3x more annually', impact: '+₹28K/client' },
      { title: 'Reactivate Dormant Clients', desc: '86 clients not visited in 90 days', impact: '+₹1.2L potential' }
    ]);
  }

  getRevenueReport() {
    return of({
      total: rand(450000, 680000), service: rand(280000, 420000), product: rand(55000, 98000),
      membership: rand(45000, 82000), giftCard: rand(12000, 28000), refunds: rand(3000, 12000),
      byPayment: PAYMENT_MODES.map(m => ({ mode: m, amount: rand(30000, 120000) })),
      byStaff: STAFF.slice(0, 6).map(n => ({ name: n, amount: rand(35000, 95000) })),
      byBranch: BRANCHES.map(n => ({ name: n, amount: rand(90000, 180000) })),
      transactions: Array.from({ length: 10 }, (_, i) => ({
        date: `2026-06-${String(rand(1, 24)).padStart(2, '0')}`, invoice: `INV-${rand(1000, 9999)}`,
        client: CLIENTS[i % CLIENTS.length], staff: STAFF[i % STAFF.length],
        amount: rand(500, 8500), paymentMethod: PAYMENT_MODES[i % PAYMENT_MODES.length]
      }))
    });
  }

  getClientInsights() {
    return of({
      newClients: rand(28, 72), returningClients: rand(140, 260),
      retentionRate: +(60 + Math.random() * 25).toFixed(1), lifetimeValue: curr(rand(8500, 18500)),
      rebookingRate: +(45 + Math.random() * 30).toFixed(1),
      topSpenders: CLIENTS.slice(0, 5).map(n => ({ name: n, spent: rand(12000, 45000), visits: rand(4, 18) })),
      atRisk: rand(12, 32),
      segments: [
        { label: 'VIP', value: rand(15, 25), color: '#4f46e5' }, { label: 'Loyal', value: rand(30, 45), color: '#10b981' },
        { label: 'New', value: rand(20, 30), color: '#2f5fbd' }, { label: 'At-Risk', value: rand(8, 18), color: '#f59e0b' },
        { label: 'Lost', value: rand(3, 10), color: '#ef4444' }
      ]
    });
  }

  getStaffPerformance() {
    return safe(this.api.report<ApiRecord>('staff-sales', {}).pipe(map(r => {
      const arr = Array.isArray(r) ? r : (Array.isArray(r?.['staff']) ? r['staff'] : []);
      return { leaderboard: arr.slice(0, 6).map((s: ApiRecord) => ({
        name: s?.['name'] || 'Staff', revenue: s?.['revenue'] || rand(35000, 95000),
        bookings: s?.['bookings'] || rand(25, 65), productSales: s?.['productSales'] || rand(5000, 18000),
        commission: s?.['commission'] || rand(4000, 14000), utilization: +(62 + Math.random() * 30).toFixed(1),
        rating: +(3.8 + Math.random() * 1.2).toFixed(1), noShowImpact: rand(2, 8)
      })) };
    })), {
      leaderboard: STAFF.slice(0, 6).map(n => ({
        name: n, revenue: rand(35000, 95000), bookings: rand(25, 65), productSales: rand(5000, 18000),
        commission: rand(4000, 14000), utilization: +(62 + Math.random() * 30).toFixed(1),
        rating: +(3.8 + Math.random() * 1.2).toFixed(1), noShowImpact: rand(2, 8)
      }))
    });
  }

  getServicePerformance() {
    return of({
      services: SERVICES.slice(0, 8).map(n => ({
        name: n, bookings: rand(12, 85), revenue: rand(15000, 95000), avgPrice: rand(800, 3800),
        growth: +(-8 + Math.random() * 20).toFixed(1)
      })),
      categoryBreakdown: CATEGORIES.map(c => ({ category: c, count: rand(5, 30), revenue: rand(30000, 120000) }))
    });
  }

  getInventoryReport() {
    return of({
      products: PRODUCTS.slice(0, 8).map(n => ({
        name: n, stock: rand(0, 50), soldQty: rand(3, 35), revenue: rand(3000, 28000),
        margin: +(15 + Math.random() * 45).toFixed(1),
        status: ['In Stock', 'Low Stock', 'Out of Stock', 'Dead Stock'][rand(0, 3)]
      })),
      stockValue: rand(80000, 250000), profitMargin: +(25 + Math.random() * 30).toFixed(1),
      reorderSuggestions: PRODUCTS.slice(0, 3).map(n => ({ name: n, suggestedQty: rand(10, 30) }))
    });
  }

  getMarketingRoi() {
    return of({
      campaigns: CAMPAIGNS.slice(0, 6).map(n => ({
        name: n, channel: ['WhatsApp', 'SMS', 'Email', 'In-App'][rand(0, 3)],
        sent: rand(150, 2500), conversions: rand(8, 85), revenue: rand(8000, 55000),
        roi: +(80 + Math.random() * 200).toFixed(1)
      })),
      totalRevenue: rand(45000, 120000), avgConversion: +(3 + Math.random() * 12).toFixed(1),
      campaignRoi: +(120 + Math.random() * 150).toFixed(1)
    });
  }

  getBranchComparison() {
    return of({
      branches: BRANCHES.map(n => ({
        name: n, revenue: rand(85000, 195000), bookings: rand(65, 145),
        clientGrowth: +(2 + Math.random() * 15).toFixed(1),
        staffProductivity: +(68 + Math.random() * 22).toFixed(1), profitEstimate: rand(18000, 52000)
      }))
    });
  }

  getAiInsights() {
    return of([
      { type: 'revenue', icon: '📈', title: 'Revenue up 12% vs last month', detail: 'Hair spa bookings grew 28% this month, driving the overall increase.', severity: 'positive' },
      { type: 'churn', icon: '⚠️', title: `${rand(15, 30)} clients may churn`, detail: 'These clients have not visited in 90+ days. Consider a re-engagement campaign.', severity: 'warning' },
      { type: 'revenue', icon: '💡', title: 'Saturdays generate highest revenue', detail: `Saturday avg revenue is ₹${rand(35000, 55000)} — 40% higher than weekdays.`, severity: 'positive' },
      { type: 'inventory', icon: '📦', title: 'Product stock may run out in 8 days', detail: 'Hair Serum and Face Cream are selling faster than expected. Reorder soon.', severity: 'warning' },
      { type: 'promotion', icon: '🎯', title: 'Promote low-performing high-margin services', detail: 'Keratin Treatment has 65% margin but only 12 bookings this month.', severity: 'info' },
      { type: 'staff', icon: '👥', title: 'Staff scheduling suggestion', detail: 'Wednesdays have 35% lower demand. Consider reduced staffing or promotions.', severity: 'info' },
      { type: 'forecast', icon: '🔮', title: 'Next month forecast', detail: `Projected revenue: ₹${rand(480000, 720000).toLocaleString()} (+${rand(5, 12)}% MoM).`, severity: 'positive' },
      { type: 'trend', icon: '📊', title: 'Slow day detected: Tuesday afternoons', detail: 'Tuesday 2-4 PM slots are only 22% booked. Offer flash discounts.', severity: 'info' }
    ]);
  }

  generateExport(_filters: FilterState): Observable<Blob> {
    const csv = 'AuraSalon Enterprise Report\nGenerated: ' + new Date().toISOString() + '\n';
    return of(new Blob([csv], { type: 'text/csv' }));
  }
}
