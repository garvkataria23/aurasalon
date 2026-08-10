import { ActivatedRouteSnapshot, BaseRouteReuseStrategy, DetachedRouteHandle } from "@angular/router";

/**
 * Optional hook implemented by tab pages that want a silent background refresh
 * when the user returns to a previously visited tab. Called after the stored
 * page instance is re-attached to the router outlet (ngOnInit does NOT re-run).
 */
export interface ReusableTabPage {
  onTabReenter?(): void;
}

/**
 * Keeps read-only bottom-tab pages mounted so tab switching feels instant:
 * returning to a tab re-attaches the same component instance + its DOM, so
 * there is no remount, no refetch and no skeleton flash. Only data that the
 * user is viewing is cached; transactional/form routes fall back to the
 * default destroy-and-recreate behaviour so Ionic lifecycle hooks still fire.
 */
export class TabRouteReuseStrategy extends BaseRouteReuseStrategy {
  /** Full paths of the read-only tab / hub pages that stay mounted. */
  private static readonly TAB_PATHS = new Set([
    "/tabs/home",
    "/tabs/my-salon",
    "/tabs/search",
    "/tabs/profile",
    "/tabs/offers",
    "/tabs/rewards",
    "/tabs/wallet",
    "/tabs/memberships",
    "/tabs/packages",
    "/tabs/gift-cards",
    "/tabs/payments",
    "/tabs/invoices",
    "/tabs/referrals",
    "/tabs/family",
    "/tabs/corporate",
    "/tabs/goals",
    "/tabs/support"
  ]);

  /** My Salon sub-pages (all render MySalonPage) that stay mounted per salon. */
  private static readonly SALON_SUB_PATHS = new Set(["", "home", "services", "staff", "reviews", "offers", "happy-hours"]);

  private readonly storedHandles = new Map<string, DetachedRouteHandle>();

  override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (future.routeConfig !== curr.routeConfig) return false;
    // Same route but different params (e.g. switching primary salon) must
    // recreate the page instead of reusing the previous salon's instance.
    const futureKeys = new Set(future.paramMap.keys);
    for (const key of futureKeys) {
      if (future.paramMap.get(key) !== curr.paramMap.get(key)) return false;
    }
    return true;
  }

  override shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.reusableKey(route) !== null;
  }

  override store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle): void {
    const key = this.reusableKey(route);
    if (key) this.storedHandles.set(key, handle);
  }

  override shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.reusableKey(route);
    return key !== null && this.storedHandles.has(key);
  }

  override retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.reusableKey(route);
    if (!key) return null;
    const handle = this.storedHandles.get(key);
    if (!handle) return null;
    const instance = (handle as { componentRef?: { instance?: unknown } } | null)?.componentRef?.instance as ReusableTabPage | undefined;
    if (instance?.onTabReenter) window.setTimeout(() => instance.onTabReenter?.(), 0);
    return handle;
  }

  private reusableKey(route: ActivatedRouteSnapshot): string | null {
    const ownPath = route.routeConfig?.path;
    if (typeof ownPath !== "string") return null;

    const segments: string[] = [];
    let cursor: ActivatedRouteSnapshot | null = route;
    while (cursor) {
      const path = cursor.routeConfig?.path;
      if (typeof path === "string") segments.unshift(path);
      cursor = cursor.parent;
    }
    const full = "/" + segments.join("/").replace(/\/+$/, "");

    if (TabRouteReuseStrategy.TAB_PATHS.has(full)) return `tab:${full}`;

    // My Salon leaf pages only (the my-salon shell itself is never kept mounted).
    if (!TabRouteReuseStrategy.SALON_SUB_PATHS.has(ownPath)) return null;
    if (!/^\/my-salon\/[^/]+\/[^/]+$/.test(full)) return null;
    const tenantId = route.paramMap.get("tenantId") ?? route.parent?.paramMap.get("tenantId") ?? route.parent?.parent?.paramMap.get("tenantId");
    const branchId = route.paramMap.get("branchId") ?? route.parent?.paramMap.get("branchId") ?? route.parent?.parent?.paramMap.get("branchId");
    if (tenantId && branchId) return `salon:${tenantId}:${branchId}:${ownPath || "/"}`;
    return null;
  }
}
