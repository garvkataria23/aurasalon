import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { StaffAppService } from "./staff-app.service";

export const staffAuthGuard: CanActivateFn = () => {
  const staff = inject(StaffAppService);
  const router = inject(Router);
  return staff.isAuthenticated() || router.createUrlTree(["/staff/login"]);
};

export const staffPermissionGuard: CanActivateFn = (route) => {
  const staff = inject(StaffAppService);
  const router = inject(Router);
  if (!staff.isAuthenticated()) return router.createUrlTree(["/staff/login"]);
  const required = route.data?.["permissions"];
  const permissions = Array.isArray(required) ? required : required ? [required] : [];
  return staff.hasEveryPermission(permissions) || router.createUrlTree(["/staff/login"]);
};
