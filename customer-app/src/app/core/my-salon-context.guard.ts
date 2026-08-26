import { inject } from "@angular/core";
import { CanActivateFn, Router, UrlTree } from "@angular/router";
import { AuthService } from "./auth.service";
import { MarketplaceService } from "./marketplace.service";

export const mySalonContextGuard: CanActivateFn = async (route, state): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const tenantId = route.paramMap.get("tenantId");
  const branchId = route.paramMap.get("branchId");
  if (!tenantId || !branchId) return router.createUrlTree(["/tabs/my-salon"]);
  if (!auth.isAuthenticated()) return router.createUrlTree(["/login"], { queryParams: { returnUrl: state.url } });

  const marketplace = inject(MarketplaceService);
  try {
    await marketplace.loadMySalons();
    if (!marketplace.hasSalonRelationship(tenantId, branchId)) return router.createUrlTree(["/tabs/my-salon"]);
    marketplace.syncSalonModeContext({ tenantId, branchId });
    return true;
  } catch {
    return router.createUrlTree(["/tabs/my-salon"]);
  }
};
