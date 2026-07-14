import { CurrencyPipe, DatePipe } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonSpinner } from "@ionic/angular/standalone";
import { StaffAppService, StaffDashboard, StaffEnterpriseOs } from "../../core/staff-app.service";

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, IonSpinner],
  template: `
    <section class="page">
      <header class="page-head">
        <div>
          <p class="eyebrow">Reports</p>
          <h1>Staff reports</h1>
          <p>Filter your work, appointments, completed services and sales impact.</p>
        </div>
      </header>

      @if (!canReadReports()) { <section class="notice">You do not have permission to view reports.</section> }
      @if (loading()) { <section class="state"><ion-spinner name="crescent" /> Loading reports...</section> }
      @if (message()) { <section class="notice success">{{ message() }}</section> }
      @if (staff.error()) { <section class="notice">{{ staff.error() }}</section> }

      @if (canReadReports()) {
        <section class="panel">
          <div class="panel-title"><h2>Report filters</h2><span>{{ fromDate }} to {{ toDate }}</span></div>
          <div class="form-grid compact-grid">
            <label>From<input [(ngModel)]="fromDate" type="date" /></label>
            <label>To<input [(ngModel)]="toDate" type="date" /></label>
          </div>
          <div class="row-actions permission-actions">
            <button class="button primary" type="button" (click)="load()">Apply</button>
            <button class="button" type="button" (click)="quickRange(0)">Today</button>
            <button class="button" type="button" (click)="quickRange(6)">7 days</button>
            <button class="button" type="button" (click)="quickRange(29)">30 days</button>
            <button class="button" type="button" (click)="exportCsv()">Export CSV</button>
          </div>
        </section>
      }

      @if (canReadReports() && dashboard(); as dash) {
        <section class="grid four">
          <article class="kpi"><span>Appointments</span><strong>{{ dash.summary.appointments }}</strong><small>{{ dash.summary.todayAppointments }} in selected day</small></article>
          <article class="kpi"><span>Completed</span><strong>{{ dash.summary.completedAppointments }}</strong><small>finished services</small></article>
          <article class="kpi"><span>Live</span><strong>{{ dash.summary.liveAppointments }}</strong><small>active/current</small></article>
          <article class="kpi"><span>Value</span><strong>{{ dash.summary.appointmentValue | currency:'INR':'symbol':'1.0-0' }}</strong><small>appointment value</small></article>
        </section>

        @if (canSeeRevenue()) {
          <section class="grid three">
            <article class="kpi"><span>Sales</span><strong>{{ dash.summary.salesCount }}</strong><small>visible sales records</small></article>
            <article class="kpi"><span>Revenue</span><strong>{{ dash.summary.revenue | currency:'INR':'symbol':'1.0-0' }}</strong><small>connected sales</small></article>
            <article class="kpi"><span>Avg sale</span><strong>{{ averageSale() | currency:'INR':'symbol':'1.0-0' }}</strong><small>revenue per sale</small></article>
          </section>
        }
      }

      @if (canReadReports() && os(); as data) {
        <section class="panel">
          <div class="panel-title"><h2>Performance trend</h2><span>daily to yearly</span></div>
          <div class="trend-grid">
            @for (key of reportKeys(); track key) {
              <article><span>{{ key }}</span><strong>{{ data.reports[key].productivityScore }}/100</strong><div class="timer-track"><span [style.width.%]="data.reports[key].productivityScore"></span></div><small>{{ data.reports[key].services }} services · {{ data.reports[key].rating || 0 }} rating</small></article>
            }
          </div>
        </section>
      }

      @if (canReadReports() && dashboard(); as dash) {
        <section class="grid two">
          <article class="panel">
            <div class="panel-title"><h2>Work report</h2><span>{{ dash.workReport.length }}</span></div>
            <div class="list">
              @for (item of dash.workReport.slice(0, 30); track item.id) {
                <div class="row"><div class="row-main"><strong>{{ item.clientName || 'Client' }}</strong><small>{{ item.startAt | date:'medium' }} · {{ item.serviceNames.join(', ') || 'Service' }}</small></div><span class="badge">{{ item.status }}</span></div>
              } @empty { <p class="empty">No completed work in this report window.</p> }
            </div>
          </article>
          <article class="panel">
            <div class="panel-title"><h2>Sales</h2><span>{{ dash.sales.length }}</span></div>
            <div class="list">
              @for (sale of dash.sales.slice(0, 30); track sale.id) {
                <div class="row"><div class="row-main"><strong>{{ sale.total | currency:'INR':'symbol':'1.0-0' }}</strong><small>{{ sale.createdAt | date:'short' }} · commission {{ sale.commissionTotal | currency:'INR':'symbol':'1.0-0' }}</small></div><span class="badge">{{ sale.status }}</span></div>
              } @empty { <p class="empty">No sales entries visible.</p> }
            </div>
          </article>
        </section>
      }
    </section>
  `,
  styleUrls: ["./staff-app.styles.css"]
})
export class StaffReportsPage implements OnInit {
  readonly os = signal<StaffEnterpriseOs | null>(null);
  readonly dashboard = signal<StaffDashboard | null>(null);
  readonly loading = signal(false);
  readonly message = signal("");
  fromDate = this.dateOffset(6);
  toDate = this.dateOffset(0);

  constructor(readonly staff: StaffAppService) {}

  ngOnInit() { if (this.canReadReports()) void this.load(); }

  async load() {
    if (!this.canReadReports()) {
      this.os.set(null);
      this.dashboard.set(null);
      return;
    }
    this.loading.set(true);
    this.message.set("");
    try {
      const params = { from: this.fromDate, to: this.toDate, date: this.toDate };
      const [os, dashboard] = await Promise.all([this.staff.enterpriseOs(), this.staff.dashboard(params)]);
      this.os.set(os);
      this.dashboard.set(dashboard);
    } finally {
      this.loading.set(false);
    }
  }

  reportKeys(): Array<"daily" | "weekly" | "monthly" | "yearly"> { return ["daily", "weekly", "monthly", "yearly"]; }

  canReadReports(): boolean {
    return this.staff.hasPermission("read:staff");
  }

  canSeeRevenue(): boolean { return this.staff.hasAnyPermission(["read:finance", "read:sales", "read:payments", "read:invoices"]); }

  canExportReports(): boolean {
    return this.staff.hasAnyPermission(["read:finance", "read:sales", "write:finance", "write:staff", "update:staff"]);
  }

  averageSale(): number {
    const summary = this.dashboard()?.summary;
    return summary?.salesCount ? Number(summary.revenue || 0) / Number(summary.salesCount) : 0;
  }

  async quickRange(daysBack: number) {
    this.fromDate = this.dateOffset(daysBack);
    this.toDate = this.dateOffset(0);
    await this.load();
  }

  exportCsv() {
    if (!this.canExportReports()) {
      this.message.set("You do not have permission to export reports.");
      return;
    }
    const dash = this.dashboard();
    if (!dash) return;
    const rows = [
      ["type", "id", "client", "amount", "status", "date"],
      ...dash.workReport.map((item) => ["work", item.id, item.clientName || "", item.value || 0, item.status || "", item.startAt || ""]),
      ...dash.sales.map((sale) => ["sale", sale.id, "", sale.total || 0, sale.status || "", sale.createdAt || ""])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `staff-report-${this.fromDate}-to-${this.toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.message.set("Report CSV exported.");
  }

  private dateOffset(daysBack: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    return date.toISOString().slice(0, 10);
  }
}
