import { describe, expect, it } from "vitest";
import { StaffDashboard, StaffEnterpriseOs, StaffToday, StaffUser } from "../../core/staff-app.service";
import { buildStaffDashboardViewModel, DashboardViewModelInput } from "./staff-dashboard.model";

const user: StaffUser = { id: "user-1", name: "Mira Sen", loginId: "mira", email: "mira@example.com", role: "custom-specialist", staffId: "staff-1", branchId: "branch-1", branchIds: ["branch-1"], permissions: [] };
const appointment = { id: "appt-1", clientId: "client-1", clientName: "Anita", clientPhone: "", staffId: "staff-1", branchId: "branch-1", serviceIds: ["service-1"], serviceNames: ["Hair spa"], durationMinutes: 60, value: 120000, startAt: "2026-07-14T12:00:00.000Z", endAt: "2026-07-14T13:00:00.000Z", status: "confirmed", chair: "", source: "", notes: "" };
const dashboard: StaffDashboard = {
  staff: { id: "staff-1", fullName: "Mira Sen", firstName: "Mira", lastName: "Sen", mobile: "", email: "", roleId: "custom", department: "", designation: "", status: "active" },
  summary: { appointments: 1, todayAppointments: 1, liveAppointments: 0, completedAppointments: 0, cancelledAppointments: 0, salesCount: 0, revenue: 125000, appointmentValue: 120000 },
  todayAppointments: [appointment], liveAppointments: [], workReport: [], appointments: [appointment], sales: []
};
const today: StaffToday = { date: "2026-07-14", schedules: [{ id: "shift-1", scheduleDate: "2026-07-14", startTime: "09:00", endTime: "18:00", shiftType: "regular", status: "scheduled" }], attendance: [], activeBreak: null, tasks: [{ id: "task-1", title: "Confirm consultation", description: "", status: "open", priority: "high", dueAt: "", version: 1 }] };
const enterprise: StaffEnterpriseOs = {
  home: { greeting: "", todayAppointments: 1, expectedRevenue: 125000, tasks: 1, lateClients: 0, vipClients: 0, birthdayClients: 0, pendingPayments: 0, recentNotifications: 0, targetProgress: { label: "", targetValue: 0, achievedValue: 0, percentage: 0, remaining: 0 } },
  aiCoach: [{ priority: "high", title: "Review client notes", body: "Prepare before the service.", action: "Open client profile" }, { priority: "medium", title: "Task focus", body: "Finish the follow-up.", action: "Open tasks" }, { priority: "low", title: "Practice", body: "Review your plan.", action: "Review" }, { priority: "low", title: "Extra", body: "Should not show.", action: "Review" }],
  timeline: [], serviceTimers: [], performance: { revenue: 125000, completedServices: 0, avgUtilization: 55, avgRating: 4.8, productivityScore: 72, strengths: [], opportunities: [] }, leaderboard: [], gamification: { points: 40, level: 2, stars: 1, dailyStreak: 1, monthlyStreak: 1, badges: [] }, notifications: [], tasks: [], calendar: [], reports: {}
};

function input(permissions: string[], overrides: Partial<DashboardViewModelInput> = {}): DashboardViewModelInput {
  const grants = new Set(permissions);
  return {
    user: { ...user, permissions }, dashboard, enterprise, today, overtime: null, leaveBalances: [], now: new Date("2026-07-14T11:30:00.000Z"),
    hasPermission: (permission) => grants.has(permission),
    canStartServiceStatus: (status) => ["booked", "confirmed", "arrived"].includes(status),
    canCompleteServiceStatus: (status) => status === "in-service",
    ...overrides
  };
}

describe("staff dashboard permission-first view model", () => {
  it("prioritizes clock-in and exposes attendance only with backend permission", () => {
    const allowed = buildStaffDashboardViewModel(input(["read:appointments", "allow:staff-checkin-checkout"]));
    const restricted = buildStaffDashboardViewModel(input(["read:appointments"]));
    expect(allowed.hero.title).toContain("Clock in");
    expect(allowed.quickActions.some((action) => action.id === "attendance")).toBe(true);
    expect(restricted.quickActions.some((action) => action.id === "attendance")).toBe(false);
  });

  it("prioritizes and acts on an active service after attendance", () => {
    const active = { ...appointment, status: "in-service" };
    const activeDashboard = { ...dashboard, liveAppointments: [active], todayAppointments: [active], summary: { ...dashboard.summary, liveAppointments: 1 } };
    const attended = { ...today, attendance: [{ id: "attendance-1", businessDate: today.date, clockInAt: "2026-07-14T03:30:00.000Z", clockOutAt: "", status: "clocked_in", source: "staff-app", overtimeMinutes: 0, grossMinutes: 0, totalBreakMinutes: 0, totalWorkedMinutes: 0, scheduledShiftMinutes: 540, overtimeCalculationStatus: "pending", overtimeReviewReason: "", overtimePolicyVersion: "1" }] };
    const vm = buildStaffDashboardViewModel(input(["read:appointments", "update:appointments", "allow:staff-checkin-checkout"], { dashboard: activeDashboard, today: attended }));
    expect(vm.work.mode).toBe("active");
    expect(vm.hero.title).toContain("Anita");
    expect(vm.work.action?.kind).toBe("complete-service");
  });

  it("shows a dedicated next-client state and appointment navigation", () => {
    const vm = buildStaffDashboardViewModel(input(["read:appointments", "read:clients"]));
    expect(vm.work).toMatchObject({ mode: "next", title: "Anita", clientRoute: ["/staff/client-360", "client-1"] });
  });

  it("never grants financial visibility from a role name", () => {
    const restricted = buildStaffDashboardViewModel(input(["read:appointments", "read:staff"]));
    const financial = buildStaffDashboardViewModel(input(["read:appointments", "read:staff", "read:finance"]));
    expect(restricted.performance.some((metric) => metric.label === "Revenue")).toBe(false);
    expect(restricted.alerts.some((alert) => alert.id === "payments")).toBe(false);
    expect(financial.performance.some((metric) => metric.label === "Revenue")).toBe(true);
    expect(financial.availableTools.some((tool) => tool.id === "payroll")).toBe(true);
  });

  it("supports a custom restricted role using permissions rather than role defaults", () => {
    const vm = buildStaffDashboardViewModel(input(["read:clients"]));
    expect(vm.quickActions.map((action) => action.id)).toEqual(["clients"]);
    expect(vm.availableTools.map((tool) => tool.id)).toEqual(["clients", "settings"]);
  });

  it("caps AI coach at three real cards and maps permitted actions", () => {
    const vm = buildStaffDashboardViewModel(input(["read:appointments", "read:staff", "read:clients"]));
    expect(vm.coach).toHaveLength(3);
    expect(vm.coach[0].route).toBe("/staff/clients");
    expect(vm.coach[1].route).toBe("/staff/tasks");
  });

  it("honors authorized tool customization after permission filtering", () => {
    const vm = buildStaffDashboardViewModel(input(["read:appointments", "read:staff", "read:clients"], { hiddenToolIds: new Set(["chat", "clients"]), toolOrder: ["learning", "calendar"] }));
    expect(vm.tools.some((tool) => tool.id === "chat" || tool.id === "clients")).toBe(false);
    expect(vm.tools[0].id).toBe("learning");
    expect(vm.tools.length).toBeLessThanOrEqual(6);
  });

  it("uses a meaningful clear-floor empty state instead of inventing metrics", () => {
    const emptyDashboard = { ...dashboard, summary: { ...dashboard.summary, appointments: 0, todayAppointments: 0, revenue: 0, appointmentValue: 0 }, todayAppointments: [], appointments: [] };
    const emptyToday = { ...today, tasks: [] };
    const vm = buildStaffDashboardViewModel(input(["read:appointments"], { dashboard: emptyDashboard, enterprise: null, today: emptyToday }));
    expect(vm.empty).toBe(true);
    expect(vm.work.mode).toBe("empty");
    expect(vm.overview[0]).toMatchObject({ value: "0", hint: "No bookings assigned" });
  });
});
