import { inject } from "@angular/core";
import { CanActivateFn } from "@angular/router";
import { MarketplaceService } from "./marketplace.service";

export const mySalonContextGuard: CanActivateFn = (route) => {
  const tenantId = route.paramMap.get("tenantId");
  const branchId = route.paramMap.get("branchId");
  if (tenantId && branchId) {
    const marketplace = inject(MarketplaceService);
    if (!marketplace.salonMode() && typeof window !== "undefined" && !window.confirm("Open My Salon mode for this salon?")) return false;
    marketplace.syncSalonModeContext({ tenantId, branchId });
  }
  return true;
};
