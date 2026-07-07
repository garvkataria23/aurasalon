import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "../../environments/environment";

const STAFF_ACCESS_TOKEN_KEY = "auraStaffAccessToken";
const STAFF_REFRESH_TOKEN_KEY = "auraStaffRefreshToken";
const STAFF_SESSION_KEY = "auraStaffSession";

export type StaffUser = {
  id: string;
  name: string;
  loginId: string;
  email: string;
  role: string;
  staffId: string;
  branchId: string;
  branchIds: string[];
  permissions?: string[];
};

export type StaffAppointment = {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  staffId: string;
  branchId: string;
  serviceNames: string[];
  durationMinutes: number;
  value: number;
  startAt: string;
  endAt: string;
  status: string;
  chair: string;
  source: string;
  notes: string;
};

export type StaffDashboard = {
  staff: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    mobile: string;
    email: string;
    roleId: string;
    department: string;
    designation: string;
    status: string;
  };
  summary: {
    appointments: number;
    todayAppointments: number;
    liveAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    salesCount: number;
    revenue: number;
    appointmentValue: number;
  };
  todayAppointments: StaffAppointment[];
  liveAppointments: StaffAppointment[];
  workReport: StaffAppointment[];
  appointments: StaffAppointment[];
  sales: Array<{ id: string; total: number; commissionTotal: number; status: string; createdAt: string }>;
};

export type StaffEnterpriseOs = {
  home: {
    greeting: string;
    todayAppointments: number;
    expectedRevenue: number;
    tasks: number;
    lateClients: number;
    vipClients: number;
    birthdayClients: number;
    pendingPayments: number;
    recentNotifications: number;
    targetProgress: { label: string; targetValue: number; achievedValue: number; percentage: number; remaining: number };
  };
  aiCoach: Array<{ priority: string; title: string; body: string; action: string }>;
  timeline: Array<{ id: string; clientId: string; clientName: string; serviceNames: string[]; startAt: string; endAt: string; status: string; state: string; minutesToStart: number; durationMinutes: number }>;
  serviceTimers: Array<{ appointmentId: string; clientName: string; status: string; elapsedMinutes: number; totalMinutes: number; remainingMinutes: number; progress: number }>;
  performance: { revenue: number; completedServices: number; avgUtilization: number; avgRating: number; productivityScore: number; strengths: string[]; opportunities: string[] };
  leaderboard: Array<{ rank: number; staffId: string; staffName: string; revenue: number; score: number; rating: number; days: number; isMe: boolean }>;
  gamification: { points: number; level: number; stars: number; dailyStreak: number; monthlyStreak: number; badges: Array<{ label: string; description: string; earned: boolean }> };
  notifications: Array<{ id: string; title: string; body: string; status: string; createdAt: string }>;
  tasks: Array<{ id: string; title: string; priority: string; status: string; dueAt: string; assignedBy: string; checklist: unknown[] }>;
  calendar: Array<{ id: string; date: string; startTime: string; endTime: string; type: string; status: string }>;
  reports: Record<string, { days: number; revenue: number; services: number; productivityScore: number; rating: number }>;
};

export type StaffClient360 = {
  profile: { id: string; name: string; phone: string; email: string; birthday: string; notes: string; allergies: string; preferredStylist: string };
  membership: { status: string; plan: string };
  wallet: { balance: number };
  outstandingBalance: number;
  previousServices: Array<{ id: string; startAt: string; status: string; serviceIds: string[] }>;
  productsBought: Array<{ id: string; total: number; createdAt: string; status: string }>;
  cancellationHistory: Array<{ id: string; startAt: string; status: string; notes: string }>;
  lifetimeSpend: number;
  visitFrequency: number;
  lastVisit: string;
  retentionScore: number;
  aiRecommendations: string[];
};

export type StaffAttendance = {
  id: string;
  businessDate: string;
  clockInAt: string;
  clockOutAt: string;
  status: string;
  source: string;
  overtimeMinutes: number;
};

export type StaffToday = {
  date: string;
  schedules: Array<{ id: string; scheduleDate: string; startTime: string; endTime: string; shiftType: string; status: string }>;
  attendance: StaffAttendance[];
  tasks: Array<{ id: string; title: string; description: string; status: string; priority: string; dueAt: string; version: number }>;
};

export type StaffPayrollItem = {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossPay: number;
  netPay: number;
  status: string;
  createdAt: string;
};

export type StaffTarget = {
  id: string;
  targetName?: string;
  type?: string;
  targetType?: string;
  targetValue?: number;
  achievedValue?: number;
  status?: string;
  createdAt?: string;
};

export type StaffLeave = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  days: number;
  createdAt: string;
};

export type StaffLeaveBalance = {
  id: string;
  leaveType: string;
  openingBalance: number;
  accrued: number;
  used: number;
  balance: number;
  updatedAt: string;
};

type StaffLoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: StaffUser;
};

type ApiEnvelope<T> = { success?: boolean; data?: T; error?: { message?: string } | string; message?: string };

@Injectable({ providedIn: "root" })
export class StaffAppService {
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, "");
  readonly loading = signal(false);
  readonly error = signal("");
  readonly user = signal<StaffUser | null>(this.readSession());

  constructor(private readonly http: HttpClient) {}

  isAuthenticated(): boolean {
    return !!this.accessToken() && !!this.user()?.staffId;
  }

  async ensureDemoSession(): Promise<boolean> {
    if (this.isAuthenticated()) return true;
    try {
      const response = await firstValueFrom(this.http.get<StaffLoginResponse | ApiEnvelope<StaffLoginResponse>>(`${this.baseUrl}/auth/demo-staff-session`));
      const session = this.unwrap(response);
      if (!session.user?.staffId) return false;
      this.saveSession(session);
      return true;
    } catch {
      return false;
    }
  }

  hasPermission(permission: string): boolean {
    const grants = this.user()?.permissions || [];
    if (!permission) return true;
    if (grants.includes("*")) return true;
    if (grants.includes(permission)) return true;
    const [action, resource] = permission.split(":");
    const writeAliases = new Set(["create", "update", "delete", "back", "print", "export"]);
    return grants.includes(`${action}:*`) ||
      grants.includes("admin:*") ||
      (resource ? grants.includes(`admin:${resource}`) : false) ||
      (resource && writeAliases.has(action) ? grants.includes(`write:${resource}`) || grants.includes("write:*") : false);
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((permission) => this.hasPermission(permission));
  }

  hasEveryPermission(permissions: string[]): boolean {
    return permissions.every((permission) => this.hasPermission(permission));
  }

  async login(payload: { tenantId: string; loginId: string; password: string; branchId?: string }): Promise<StaffUser> {
    this.loading.set(true);
    this.error.set("");
    try {
      const response = await firstValueFrom(this.http.post<StaffLoginResponse | ApiEnvelope<StaffLoginResponse>>(`${this.baseUrl}/auth/login`, {
        tenantId: payload.tenantId.trim() || "tenant_aura",
        loginId: payload.loginId.trim(),
        password: payload.password,
        branchId: payload.branchId?.trim() || undefined,
        device: { type: "staff-app", name: "Aura Staff App", platform: "web" }
      }));
      const session = this.unwrap(response);
      if (!session.user?.staffId) throw new Error("This login is not linked with a staff profile.");
      if (!this.isStaffRole(session.user.role)) throw new Error("Use a staff login, not an owner/admin login.");
      this.saveSession(session);
      return session.user;
    } catch (error) {
      const message = this.errorMessage(error, "Unable to login staff.");
      this.error.set(message);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async dashboard(): Promise<StaffDashboard> {
    const token = this.accessToken();
    if (!token) throw new Error("Staff login required.");
    this.loading.set(true);
    this.error.set("");
    try {
      const response = await firstValueFrom(this.http.get<StaffDashboard | ApiEnvelope<StaffDashboard>>(`${this.baseUrl}/staff-self/dashboard`, {
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
      }));
      return this.unwrap(response);
    } catch (error) {
      const message = this.errorMessage(error, "Unable to load staff dashboard.");
      this.error.set(message);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async enterpriseOs(): Promise<StaffEnterpriseOs> {
    return this.get<StaffEnterpriseOs>("/staff-self/enterprise-os");
  }

  async client360(clientId: string): Promise<StaffClient360> {
    return this.get<StaffClient360>(`/staff-self/clients/${encodeURIComponent(clientId)}/360`);
  }

  async today(date = new Date().toISOString().slice(0, 10)): Promise<StaffToday> {
    return this.get<StaffToday>("/staff-os/mobile/today", { date, staffId: this.staffId() });
  }

  async payroll(): Promise<StaffPayrollItem[]> {
    return this.get<StaffPayrollItem[]>("/staff-os/mobile/payroll", { staffId: this.staffId() });
  }

  async targets(): Promise<StaffTarget[]> {
    return this.get<StaffTarget[]>("/staff-os/mobile/targets", { staffId: this.staffId() });
  }

  async leaves(): Promise<StaffLeave[]> {
    return this.get<StaffLeave[]>("/staff-os/leaves", { staffId: this.staffId(), limit: "6" });
  }

  async leaveBalances(): Promise<StaffLeaveBalance[]> {
    return this.get<StaffLeaveBalance[]>("/staff-os/leave-balances", { staffId: this.staffId() });
  }

  async clockIn(): Promise<StaffAttendance> {
    return this.post<StaffAttendance>("/staff-os/attendance/clock-in", { staffId: this.staffId(), source: "staff-app" });
  }

  async clockOut(attendanceId?: string): Promise<StaffAttendance> {
    return this.post<StaffAttendance>("/staff-os/attendance/clock-out", { staffId: this.staffId(), attendanceId });
  }

  async startBreak(): Promise<unknown> {
    return this.post("/staff-os/attendance/break-start", { staffId: this.staffId(), breakType: "regular" });
  }

  async endBreak(): Promise<unknown> {
    return this.post("/staff-os/attendance/break-end", { staffId: this.staffId() });
  }

  async requestLeave(payload: { leaveType: string; startDate: string; endDate: string; reason: string }): Promise<unknown> {
    return this.post("/staff-os/mobile/request-leave", { ...payload, staffId: this.staffId() });
  }

  async startService(appointmentId: string): Promise<unknown> {
    return this.post("/staff-os/mobile/start-service", { staffId: this.staffId(), appointmentId });
  }

  async completeService(appointmentId: string): Promise<unknown> {
    return this.post("/staff-os/mobile/complete-service", { staffId: this.staffId(), appointmentId });
  }

  async completeTask(taskId: string, version: number): Promise<unknown> {
    return this.patch(`/staff-os/tasks/${taskId}`, { status: "completed", version });
  }

  logout() {
    localStorage.removeItem(STAFF_ACCESS_TOKEN_KEY);
    localStorage.removeItem(STAFF_REFRESH_TOKEN_KEY);
    localStorage.removeItem(STAFF_SESSION_KEY);
    this.user.set(null);
  }

  openSession(session: { accessToken: string; refreshToken?: string; user: StaffUser }) {
    this.saveSession({ accessToken: session.accessToken, refreshToken: session.refreshToken || "", user: session.user });
  }

  private accessToken(): string {
    return localStorage.getItem(STAFF_ACCESS_TOKEN_KEY) || "";
  }

  private staffId(): string {
    const staffId = this.user()?.staffId || "";
    if (!staffId) throw new Error("Staff profile is not linked.");
    return staffId;
  }

  private authHeaders(): HttpHeaders {
    const token = this.accessToken();
    if (!token) throw new Error("Staff login required.");
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    this.loading.set(true);
    this.error.set("");
    try {
      const response = await firstValueFrom(this.http.get<T | ApiEnvelope<T>>(`${this.baseUrl}${path}`, { headers: this.authHeaders(), params }));
      return this.unwrap(response);
    } catch (error) {
      const message = this.errorMessage(error, "Unable to load staff data.");
      this.error.set(message);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  private async post<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
    this.loading.set(true);
    this.error.set("");
    try {
      const response = await firstValueFrom(this.http.post<T | ApiEnvelope<T>>(`${this.baseUrl}${path}`, body, { headers: this.authHeaders() }));
      return this.unwrap(response);
    } catch (error) {
      const message = this.errorMessage(error, "Unable to update staff data.");
      this.error.set(message);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  private async patch<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
    this.loading.set(true);
    this.error.set("");
    try {
      const response = await firstValueFrom(this.http.patch<T | ApiEnvelope<T>>(`${this.baseUrl}${path}`, body, { headers: this.authHeaders() }));
      return this.unwrap(response);
    } catch (error) {
      const message = this.errorMessage(error, "Unable to update staff data.");
      this.error.set(message);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  private saveSession(session: StaffLoginResponse) {
    localStorage.setItem(STAFF_ACCESS_TOKEN_KEY, session.accessToken);
    localStorage.setItem(STAFF_REFRESH_TOKEN_KEY, session.refreshToken || "");
    localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session.user));
    this.user.set(session.user);
  }

  private readSession(): StaffUser | null {
    try {
      const raw = localStorage.getItem(STAFF_SESSION_KEY);
      return raw ? JSON.parse(raw) as StaffUser : null;
    } catch {
      return null;
    }
  }

  private isStaffRole(role: string): boolean {
    return ["staff", "frontDesk", "cashier", "manager"].includes(String(role || ""));
  }

  private unwrap<T>(response: T | ApiEnvelope<T>): T {
    if (response && typeof response === "object" && "data" in response) {
      const envelope = response as ApiEnvelope<T>;
      if (envelope.data !== undefined) return envelope.data;
      const error = envelope.error;
      const message = typeof error === "string" ? error : error?.message || envelope.message;
      throw new Error(message || "Unexpected staff API response.");
    }
    return response as T;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === "object" && "error" in error) {
      const httpError = error as { error?: ApiEnvelope<unknown> | { message?: string } | string; message?: string };
      const body = httpError.error;
      if (typeof body === "string" && body.trim()) return body;
      if (body && typeof body === "object") {
        const nested = "error" in body ? body.error : undefined;
        const message = typeof nested === "string" ? nested : nested?.message || body.message;
        if (message) return message;
      }
      if (httpError.message) return httpError.message;
    }
    return error instanceof Error ? error.message : fallback;
  }
}
