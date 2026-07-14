import { Routes } from "@angular/router";
import { staffAuthGuard, staffPermissionGuard } from "./core/staff-auth.guard";

export const routes: Routes = [
  { path: "", redirectTo: "staff/login", pathMatch: "full" },
  {
    path: "staff/login",
    loadComponent: () => import("./features/staff/staff-login.page").then((m) => m.StaffLoginPage)
  },
  {
    path: "staff/open",
    loadComponent: () => import("./features/staff/staff-open.page").then((m) => m.StaffOpenPage)
  },
  {
    path: "staff",
    canActivate: [staffAuthGuard],
    loadComponent: () => import("./features/staff/staff-layout.page").then((m) => m.StaffLayoutPage),
    children: [
      { path: "", redirectTo: "dashboard", pathMatch: "full" },
      { path: "dashboard", loadComponent: () => import("./features/staff/staff-dashboard.page").then((m) => m.StaffDashboardPage) },
      { path: "appointments", loadComponent: () => import("./features/staff/staff-appointments.page").then((m) => m.StaffAppointmentsPage) },
      { path: "business", loadComponent: () => import("./features/staff/staff-business.page").then((m) => m.StaffBusinessPage) },
      { path: "queue", redirectTo: "business", pathMatch: "full" },
      { path: "clients", loadComponent: () => import("./features/staff/staff-clients.page").then((m) => m.StaffClientsPage) },
      { path: "client-360", loadComponent: () => import("./features/staff/staff-client360.page").then((m) => m.StaffClient360Page) },
      { path: "client-360/:id", loadComponent: () => import("./features/staff/staff-client360.page").then((m) => m.StaffClient360Page) },
      { path: "tasks", canActivate: [staffPermissionGuard], data: { permissions: "read:staff" }, loadComponent: () => import("./features/staff/staff-tasks.page").then((m) => m.StaffTasksPage) },
      { path: "attendance", loadComponent: () => import("./features/staff/staff-attendance.page").then((m) => m.StaffAttendancePage) },
      { path: "roster", canActivate: [staffPermissionGuard], data: { permissions: "read:staff" }, loadComponent: () => import("./features/staff/staff-roster.page").then((m) => m.StaffRosterPage) },
      { path: "performance", loadComponent: () => import("./features/staff/staff-performance.page").then((m) => m.StaffPerformancePage) },
      { path: "leaderboard", loadComponent: () => import("./features/staff/staff-leaderboard.page").then((m) => m.StaffLeaderboardPage) },
      { path: "ai-coach", loadComponent: () => import("./features/staff/staff-ai-coach.page").then((m) => m.StaffAiCoachPage) },
      { path: "notifications", loadComponent: () => import("./features/staff/staff-notifications.page").then((m) => m.StaffNotificationsPage) },
      { path: "reports", loadComponent: () => import("./features/staff/staff-reports.page").then((m) => m.StaffReportsPage) },
      { path: "calendar", loadComponent: () => import("./features/staff/staff-calendar.page").then((m) => m.StaffCalendarPage) },
      { path: "chat", loadComponent: () => import("./features/staff/staff-chat.page").then((m) => m.StaffChatPage) },
      { path: "learning", loadComponent: () => import("./features/staff/staff-learning.page").then((m) => m.StaffLearningPage) },
      { path: "payroll", canActivate: [staffPermissionGuard], data: { anyPermissions: ["read:payroll", "read:finance"] }, loadComponent: () => import("./features/staff/staff-payroll.page").then((m) => m.StaffPayrollPage) },
      { path: "leaves", canActivate: [staffPermissionGuard], data: { permissions: "read:staff" }, loadComponent: () => import("./features/staff/staff-leaves.page").then((m) => m.StaffLeavesPage) },
      { path: "profile", loadComponent: () => import("./features/staff/staff-profile.page").then((m) => m.StaffProfilePage) },
      { path: "settings", loadComponent: () => import("./features/staff/staff-settings.page").then((m) => m.StaffSettingsPage) },
      { path: "permission-denied", loadComponent: () => import("./features/staff/staff-permission-denied.page").then((m) => m.StaffPermissionDeniedPage) }
    ]
  },
  { path: "**", redirectTo: "staff/login" }
];
