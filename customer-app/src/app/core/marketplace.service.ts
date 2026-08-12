import { Injectable, computed, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import {
  AvailabilityDay,
  AvailabilityQuery,
  Booking,
  Business,
  Category,
  CreateBookingPayload,
  CustomerAccountModule,
  CustomerFavorite,
  CustomerGiftCard,
  CustomerInvoice,
  CustomerMembership,
  CustomerMembershipPlan,
  CustomerPackage,
  CustomerPaymentLink,
  CustomerPrimarySalon,
  CustomerProfile,
  CustomerSalonRelationship,
  CustomerSalonsResponse,
  CustomerWaitlistEntry,
  JoinWaitlistPayload,
  MySalonDashboard,
  PublicOffersResponse,
  PurchaseGiftCardPayload,
  RedeemGiftCardPayload,
  RedeemGiftCardResponse,
  RescheduleBookingPayload,
  SearchBusinessesParams,
  SlotHold,
  SlotHoldPayload
} from "./api.types";
import { AuthService } from "./auth.service";
import { CustomerApiService } from "./customer-api.service";

export type SalonModeContext = { tenantId: string; branchId: string; businessId?: string; businessName?: string };

/** Shared in-progress booking state used by both the Salon (discovery) and Book (transaction) sections. */
export interface CustomerBookingDraft {
  businessSlug: string;
  businessId?: string;
  serviceIds: string[];
  updatedAt: number;
}

@Injectable({ providedIn: "root" })
export class MarketplaceService {
  private static readonly PUBLIC_BUSINESSES_CACHE_KEY = "aura_cached_public_businesses";
  private static readonly PUBLIC_BUSINESSES_CACHE_TTL_MS = 15 * 60_000;
  private static readonly AVAILABILITY_CACHE_TTL_MS = 15_000;
  private readonly loadingCount = signal(0);
  readonly loading = computed(() => this.loadingCount() > 0);
  readonly offline = signal(false);
  private static readonly OFFLINE_MSG = "You're offline. Check your connection and try again.";
  private readonly skeletonTick = signal(0);
  private skeletonTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingStartedAt = 0;
  private static readonly SKELETON_DELAY_MS = 300;
  /**
   * Loading flag that only turns on once a request has persisted past a short
   * delay, so very fast responses never flash a skeleton loader.
   */
  readonly loadingForSkeleton = computed(() => {
    void this.skeletonTick();
    return this.loadingCount() > 0 && Date.now() - this.loadingStartedAt >= MarketplaceService.SKELETON_DELAY_MS;
  });
  readonly error = signal("");
  readonly businesses = signal<Business[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly favorites = signal<CustomerFavorite[]>([]);
  readonly savedSalons = signal<CustomerFavorite[]>([]);
  readonly selectedBusiness = signal<Business | null>(null);
  /** Single shared booking state across Salon and Book sections (not persisted — session only). */
  readonly bookingDraft = signal<CustomerBookingDraft | null>(null);
  readonly bookings = signal<Booking[]>([]);
  readonly selectedBooking = signal<Booking | null>(null);
  readonly latestBooking = signal<Booking | null>(null);
  readonly availability = signal<AvailabilityDay[]>([]);
  readonly accountModule = signal<CustomerAccountModule | null>(null);
  readonly membershipPlans = signal<CustomerMembershipPlan[]>([]);
  /** Last successfully loaded account module per hub slug, kept so failed or empty refetches never wipe known data. */
  private readonly moduleCacheStore = new Map<string, CustomerAccountModule>();
  readonly customer = computed(() => this.auth.customer());
  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());
  readonly mySalons = signal<CustomerSalonRelationship[]>([]);
  readonly primarySalon = signal<CustomerPrimarySalon | null>(null);
  readonly shouldPromptPrimary = signal(false);
  readonly suggestedSalon = signal<CustomerSalonRelationship | null>(null);
  readonly salonOffers = signal<PublicOffersResponse | null>(null);
  readonly mySalonDashboard = signal<MySalonDashboard | null>(null);
  private readonly salonModeStore = signal(false);
  readonly salonMode = this.salonModeStore.asReadonly();
  private readonly salonModeContextStore = signal<SalonModeContext | null>(null);
  readonly salonModeContext = this.salonModeContextStore.asReadonly();
  private favoritesLoaded = false;
  private savedSalonsLoaded = false;
  private businessesRequestCounter = 0;
  private publicBusinessesLoadedAt = 0;
  private readonly BUSINESS_CACHE_TTL_MS = 60_000;
  private readonly BOOKINGS_CACHE_TTL_MS = 30_000;
  private static readonly MEM_CACHE_CAP = 200;
  private readonly memCache = new Map<string, { expiresAt: number; value: unknown }>();
  private readonly inFlightResponses = new Map<string, Promise<unknown>>();
  private static readonly DATA_CACHE_PREFIX = "auraCustomerDataCache:";

  constructor(private readonly api: CustomerApiService, private readonly auth: AuthService) {
    try {
      this.salonModeStore.set(localStorage.getItem("aura_salon_mode") === "1");
      this.salonModeContextStore.set(this.readSalonModeContext());
    } catch {
      this.salonModeStore.set(false);
      this.salonModeContextStore.set(null);
    }
    this.hydrateBusinessesCache();
    this.initOfflineTracking();
    this.listenForSessionChanges();
  }

  private listenForSessionChanges(): void {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    window.addEventListener("aura-session-expired", () => this.clearAllCached());
  }

  private initOfflineTracking(): void {
    if (typeof window === "undefined" || !("onLine" in navigator)) return;
    const apply = (online: boolean) => {
      this.offline.set(!online);
      if (online && this.error() === MarketplaceService.OFFLINE_MSG) this.error.set("");
    };
    apply(navigator.onLine);
    window.addEventListener("online", () => apply(true));
    window.addEventListener("offline", () => apply(false));
  }

enterSalonMode(context?: SalonModeContext | null): void {
    this.salonModeStore.set(true);
    if (context?.tenantId && context.branchId) {
      const previous = this.salonModeContextStore();
      if (previous?.tenantId !== context.tenantId || previous?.branchId !== context.branchId) this.accountModule.set(null);
      this.salonModeContextStore.set(context);
      try {
        localStorage.setItem("aura_salon_mode", "1");
        localStorage.setItem("aura_salon_mode_context", JSON.stringify(context));
      } catch {
      }
    } else {
      // No valid context provided - clear any stale context
      this.salonModeContextStore.set(null);
      try {
        localStorage.removeItem("aura_salon_mode_context");
      } catch {
      }
    }
  }

  exitSalonMode(): void {
    this.salonModeStore.set(false);
    try {
      localStorage.removeItem("aura_salon_mode");
      localStorage.removeItem("aura_salon_mode_context");
    } catch {
      // storage unavailable — mode already off for this session
    }
    this.salonModeContextStore.set(null);
  }

  syncSalonModeContext(context: SalonModeContext): void {
    if (!context.tenantId || !context.branchId) return;
    this.enterSalonMode(context);
  }

  salonModeUrl(...segments: Array<string | number | null | undefined>): string {
    const context = this.salonModeContext();
    const primary = this.primarySalon();
    const tenantId = primary?.tenantId || context?.tenantId;
    const branchId = primary?.branchId || context?.branchId;
    if (!tenantId || !branchId) return "/tabs/my-salon";
    const tail = segments
      .filter((segment): segment is string | number => segment !== null && segment !== undefined && String(segment).length > 0)
      .map((segment) => encodeURIComponent(String(segment)))
      .join("/");
    return `/my-salon/${encodeURIComponent(tenantId)}/${encodeURIComponent(branchId)}${tail ? `/${tail}` : ""}`;
  }

private readSalonModeContext(): SalonModeContext | null {
    const raw = localStorage.getItem("aura_salon_mode_context");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SalonModeContext>;
    return parsed.tenantId && parsed.branchId ? { tenantId: parsed.tenantId, branchId: parsed.branchId, businessId: parsed.businessId, businessName: parsed.businessName } : null;
  }

  private get cacheAuth(): { tid: string; bid: string } | null {
    try {
      const tid = localStorage.getItem("tenantId");
      const bid = localStorage.getItem("branchId");
      if (tid && bid) return { tid, bid };
      const context = this.salonModeContext();
      if (context?.tenantId && context.branchId) return { tid: context.tenantId, bid: context.branchId };
      return null;
    } catch {
      return null;
    }
  }

  private cacheKey(name: string, key: string): string {
    const a = this.cacheAuth;
    if (!a) return `${MarketplaceService.DATA_CACHE_PREFIX}global:${name}:${key}`;
    return `${MarketplaceService.DATA_CACHE_PREFIX}${a.tid}:${a.bid}:${name}:${key}`;
  }

  private readStoredData<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { expiresAt?: number; value?: T };
      if (!parsed || typeof parsed.expiresAt !== "number" || parsed.value === undefined) return null;
      if (Date.now() > parsed.expiresAt) return null;
      return parsed.value;
    } catch {
      return null;
    }
  }

  /**
   * Reads the stored value ignoring TTL, used as an offline fallback when a
   * revalidation request fails. Returns null when nothing is stored yet.
   */
  private readStaleData<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { expiresAt?: number; value?: T };
      if (!parsed || typeof parsed.expiresAt !== "number" || parsed.value === undefined) return null;
      return parsed.value;
    } catch {
      return null;
    }
  }

  private writeStoredData<T>(key: string, value: T, ttlMs: number): void {
    try {
      localStorage.setItem(key, JSON.stringify({ expiresAt: Date.now() + ttlMs, value }));
    } catch {
      // storage unavailable or full — cache is best-effort only.
    }
  }

  private async cachedGet<T>(name: string, key: string, ttlMs: number, fetcher: () => Promise<T>, force = false): Promise<T> {
    const cacheKey = this.cacheKey(name, key);
    if (!force) {
      const mem = this.memCache.get(cacheKey);
      if (mem && mem.expiresAt > Date.now()) return mem.value as T;
      const stored = this.readStoredData<T>(cacheKey);
      if (stored !== null) return stored;
    }
    const inFlight = this.inFlightResponses.get(cacheKey);
    if (inFlight) return inFlight as Promise<T>;
    const p = fetcher()
      .then((data) => {
        this.pruneMemCache();
        this.memCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, value: data });
        this.writeStoredData(cacheKey, data, ttlMs);
        return data;
      })
      .catch((error) => {
        const stale = this.readStaleData<T>(cacheKey);
        if (stale !== null) {
          // Do NOT write stale back with fresh TTL — that poisons the cache.
          // Return stale once; next call will re-attempt fetch.
          return stale;
        }
        throw error;
      })
      .finally(() => {
        this.inFlightResponses.delete(cacheKey);
      });
    this.inFlightResponses.set(cacheKey, p);
    return p;
  }

  private pruneMemCache(): void {
    while (this.memCache.size >= MarketplaceService.MEM_CACHE_CAP) {
      let oldestKey: string | undefined;
      let oldestExpiry = Infinity;
      for (const [cacheKey, entry] of this.memCache) {
        if (entry.expiresAt < oldestExpiry) {
          oldestExpiry = entry.expiresAt;
          oldestKey = cacheKey;
        }
      }
      if (oldestKey) this.memCache.delete(oldestKey);
    }
  }

  private peekCached<T>(name: string, key: string): T | null {
    const cacheKey = this.cacheKey(name, key);
    const mem = this.memCache.get(cacheKey);
    if (mem && mem.expiresAt > Date.now()) return mem.value as T;
    return this.readStoredData<T>(cacheKey);
  }

  /**
   * Stale-while-revalidate loader: serves the last known data instantly (from
   * memory or storage, even after the TTL expires) and refreshes it silently in
   * the background so the UI never blocks on a network round-trip. The loading
   * counter/skeleton only engages on a true cache miss. Cache writes stay inside
   * `cachedGet` so every successful response refreshes the store.
   */
  private async cachedLoad<T>(
    name: string,
    key: string,
    ttlMs: number,
    fallback: string,
    force: boolean,
    fetcher: () => Promise<T>,
    onData?: (data: T) => void
  ): Promise<T> {
    if (!force) {
      const cacheKey = this.cacheKey(name, key);
      const fresh = this.peekCached<T>(name, key);
      if (fresh !== null) {
        onData?.(fresh);
        return fresh;
      }
      const staleMem = this.memCache.get(cacheKey)?.value as T | undefined;
      const stale = this.readStaleData<T>(cacheKey) ?? (staleMem !== undefined ? staleMem : null);
      if (stale !== null) {
        onData?.(stale);
        void this.cachedGet(name, key, ttlMs, fetcher, true)
          .then((data) => onData?.(data))
          .catch(() => undefined);
        return stale;
      }
    }
    return this.run(fallback, async () => {
      const data = await this.cachedGet(name, key, ttlMs, fetcher, force);
      onData?.(data);
      return data;
    });
  }

  /**
   * Warms the caches for the primary tabs (salon/profile, services, rewards,
   * bookings) right after app load so the first visit to each tab renders
   * instantly. Every call is cache-first and best-effort, so this never
   * re-fetches unchanged data and never blocks first paint.
   */
  prefetchPrimaryTabs(): void {
    if (this.offline()) return;
    void this.loadPublicBusinesses().catch(() => undefined);
    void this.loadCategories().catch(() => undefined);
    if (!this.isAuthenticated()) return;
    void this.loadCustomer().catch(() => undefined);
    void this.loadBookings().catch(() => undefined);
    void this.loadMySalons().catch(() => undefined);
    void this.loadMySalonDashboard().catch(() => undefined);
    void this.loadAccountModule("rewards").catch(() => undefined);
    void this.loadAccountModule("wallet").catch(() => undefined);
  }

  clearAllCached(): void {
    this.memCache.clear();
    this.inFlightResponses.clear();
    this.favoritesLoaded = false;
    this.savedSalonsLoaded = false;
    this.favorites.set([]);
    this.savedSalons.set([]);
    try {
      Object.keys(localStorage)
        .filter((storedKey) => storedKey.startsWith(MarketplaceService.DATA_CACHE_PREFIX))
        .forEach((storedKey) => localStorage.removeItem(storedKey));
    } catch {
      // storage unavailable — memory cache still cleared above.
    }
  }

  clearCached(name: string, key?: string): void {
    try {
      if (key) {
        const exact = this.cacheKey(name, key);
        this.memCache.delete(exact);
        localStorage.removeItem(exact);
        return;
      }
      const marker = `:${name}:`;
      for (const cacheKey of this.memCache.keys()) {
        if (cacheKey.includes(marker)) this.memCache.delete(cacheKey);
      }
      for (const cacheKey of this.inFlightResponses.keys()) {
        if (cacheKey.includes(marker)) this.inFlightResponses.delete(cacheKey);
      }
      Object.keys(localStorage)
        .filter((storedKey) => storedKey.startsWith(MarketplaceService.DATA_CACHE_PREFIX) && storedKey.includes(marker))
        .forEach((storedKey) => localStorage.removeItem(storedKey));
    } catch {
      // storage unavailable — memory cache still cleared above.
    }
  }

  private setBusinesses(rows: Business[]) {
    this.businesses.set(rows);
    this.persistBusinessesCache(rows);
  }

  private hydrateBusinessesCache(): void {
    try {
      const raw = localStorage.getItem(MarketplaceService.PUBLIC_BUSINESSES_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { at?: number; rows?: Business[] };
      if (!parsed?.at || !Array.isArray(parsed.rows)) return;
      if (parsed.at < Date.now() - MarketplaceService.PUBLIC_BUSINESSES_CACHE_TTL_MS) return;
      const rows = parsed.rows.map((business) => this.normalizeBusiness(business));
      if (!rows.length) return;
      this.businesses.set(rows);
      this.publicBusinessesLoadedAt = parsed.at;
    } catch {
      // localStorage can be unavailable or corrupted.
    }
  }

  private persistBusinessesCache(rows: Business[]): void {
    try {
      localStorage.setItem(MarketplaceService.PUBLIC_BUSINESSES_CACHE_KEY, JSON.stringify({ at: Date.now(), rows }));
    } catch {
      // localStorage can be unavailable.
    }
  }

  async loadPublicBusinesses(params: SearchBusinessesParams = {}, force = false): Promise<Business[]> {
    const key = this.businessListKey(params);
    const isDefault = Object.keys(params).length === 0;
    const requestId = ++this.businessesRequestCounter;
    return this.cachedLoad("public-businesses", key, MarketplaceService.PUBLIC_BUSINESSES_CACHE_TTL_MS, "Unable to load businesses", force, async () => {
      const rows = (await firstValueFrom(this.api.listPublicBusinesses(params))).map((business) => this.normalizeBusiness(business));
      return rows;
    }, (rows) => {
      if (requestId !== this.businessesRequestCounter) return;
      this.setBusinesses(rows);
      if (isDefault) this.publicBusinessesLoadedAt = Date.now();
    });
  }

  async searchBusinesses(params: SearchBusinessesParams = {}, force = false): Promise<Business[]> {
    const key = this.businessListKey(params);
    const requestId = ++this.businessesRequestCounter;
    return this.cachedLoad("search", key, this.BUSINESS_CACHE_TTL_MS, "Search service is unavailable. Please try again.", force, async () => {
      const rows = (await firstValueFrom(this.api.searchPublicBusinesses(params))).map((business) => this.normalizeBusiness(business));
      return rows;
    }, (rows) => {
      if (requestId !== this.businessesRequestCounter) return;
      this.setBusinesses(rows);
    });
  }

  private businessListKey(params: SearchBusinessesParams): string {
    if (Object.keys(params).length === 0) return "all";
    return JSON.stringify(params);
  }

  async loadCategories(force = false): Promise<Category[]> {
    return this.cachedLoad("categories", "all", MarketplaceService.PUBLIC_BUSINESSES_CACHE_TTL_MS, "Unable to load categories", force, () => firstValueFrom(this.api.listPublicCategories()), (rows) => {
      this.categories.set(rows);
    });
  }

  async loadBusiness(slug: string, force = false): Promise<Business> {
    return this.cachedLoad("business", slug, this.BUSINESS_CACHE_TTL_MS, "Unable to load business profile", force, async () => {
      const [business, services, staff, reviews] = await Promise.all([
        firstValueFrom(this.api.getPublicBusiness(slug)),
        firstValueFrom(this.api.getPublicBusinessServices(slug)),
        firstValueFrom(this.api.getPublicBusinessStaff(slug)),
        firstValueFrom(this.api.listBusinessReviews(slug)).catch(() => [])
      ]);
      return this.normalizeBusiness({ ...business, services, staff, reviews });
    }, (profile) => {
      this.selectedBusiness.set(profile);
      this.businesses.update((rows) => {
        const index = rows.findIndex((row) => row.slug === slug || row.id === profile.id);
        if (index === -1) return [profile, ...rows];
        return rows.map((row, rowIndex) => rowIndex === index ? profile : row);
      });
      this.persistBusinessesCache(this.businesses());
    });
  }

  findBusiness(slug: string | null): Business | null {
    if (!slug) return this.selectedBusiness();
    const selected = this.selectedBusiness();
    if (selected?.slug === slug || selected?.id === slug) return selected;
    return this.businesses().find((business) => business.slug === slug || business.id === slug) ?? null;
  }

  setBookingDraft(draft: CustomerBookingDraft | null): void {
    this.bookingDraft.set(draft);
  }

  clearBookingDraft(): void {
    this.bookingDraft.set(null);
  }

  async loadAvailability(slug: string, query: AvailabilityQuery, force = false): Promise<AvailabilityDay[]> {
    const key = `${slug}:${JSON.stringify(query)}`;
    return this.cachedLoad("availability", key, MarketplaceService.AVAILABILITY_CACHE_TTL_MS, "Unable to load availability", force, () => firstValueFrom(this.api.getAvailability(slug, query)), (rows) => {
      this.availability.set(rows);
    });
  }

  async loadBookings(status?: "upcoming" | "past" | "cancelled", force = false): Promise<Booking[]> {
    const key = this.bookingsCacheKey(status);
    return this.cachedLoad("bookings", key, this.BOOKINGS_CACHE_TTL_MS, "Unable to load bookings", force, () => firstValueFrom(this.api.listBookings(status)), (rows) => {
      this.bookings.set(rows);
    });
  }

  private bookingsCacheKey(status?: "upcoming" | "past" | "cancelled"): string {
    const context = this.salonModeContext();
    const prefix = context?.tenantId && context.branchId ? `${context.tenantId}:${context.branchId}` : "global";
    return `${prefix}:${status ?? "all"}`;
  }

  async loadBooking(id: string): Promise<Booking> {
    return this.run("Unable to load booking", async () => {
      const booking = await firstValueFrom(this.api.getBooking(id));
      this.selectedBooking.set(booking);
      this.bookings.update((rows) => {
        const index = rows.findIndex((row) => row.id === booking.id);
        if (index === -1) return [booking, ...rows];
        return rows.map((row, rowIndex) => rowIndex === index ? booking : row);
      });
      return booking;
    });
  }

  findBooking(id: string | null): Booking | null {
    if (!id) return this.selectedBooking() ?? this.latestBooking();
    return this.selectedBooking()?.id === id ? this.selectedBooking() : this.bookings().find((booking) => booking.id === id) ?? null;
  }

  async createBooking(payload: CreateBookingPayload): Promise<Booking> {
    return this.run("Unable to create booking", async () => {
      const booking = await firstValueFrom(this.api.createBooking(payload));
      this.latestBooking.set(booking);
      this.bookings.update((rows) => [booking, ...rows.filter((row) => row.id !== booking.id)]);
      this.clearCached("bookings");
      return booking;
    });
  }

  async cancelBooking(id: string): Promise<Booking> {
    return this.run("Unable to cancel booking", async () => {
      const booking = await firstValueFrom(this.api.cancelBooking(id));
      this.replaceBooking(booking);
      this.clearCached("bookings");
      return booking;
    });
  }

  async rescheduleBooking(id: string, payload: RescheduleBookingPayload): Promise<Booking> {
    return this.run("Unable to reschedule booking", async () => {
      const booking = await firstValueFrom(this.api.rescheduleBooking(id, payload));
      this.replaceBooking(booking);
      this.clearCached("bookings");
      return booking;
    });
  }

  async createSlotHold(payload: SlotHoldPayload): Promise<SlotHold> {
    return this.run("Unable to reserve slot", async () => {
      const hold = await firstValueFrom(this.api.createSlotHold(payload));
      return hold;
    });
  }

  async releaseSlotHold(holdId: string): Promise<void> {
    await firstValueFrom(this.api.releaseSlotHold(holdId));
  }

  async logout() {
    const result = await this.run("Unable to logout", () => this.auth.logout());
    this.clearAllCached();
    return result;
  }

  async loadCustomer(force = false) {
    return this.run("Unable to load customer profile", () => this.auth.loadMe(force));
  }

  async loadFavorites(force = false): Promise<CustomerFavorite[]> {
    return this.cachedLoad("favorites", "all", this.BUSINESS_CACHE_TTL_MS, "Unable to load saved salons", force, () => firstValueFrom(this.api.listFavorites()), (rows) => {
      this.favorites.set(rows);
      this.favoritesLoaded = true;
    });
  }

  async ensureFavorites(): Promise<CustomerFavorite[]> {
    if (!this.isAuthenticated()) return [];
    if (this.favoritesLoaded) return this.favorites();
    return this.loadFavorites();
  }

  isFavorite(businessId: string): boolean {
    return this.favorites().some((favorite) => favorite.businessId === businessId || favorite.business?.id === businessId || favorite.business?.slug === businessId);
  }

  async addFavorite(businessId: string): Promise<CustomerFavorite> {
    return this.run("Unable to save salon", async () => {
      const favorite = await firstValueFrom(this.api.addFavorite(businessId));
      this.favorites.update((rows) => [favorite, ...rows.filter((row) => row.businessId !== favorite.businessId)]);
      this.favoritesLoaded = true;
      this.clearCached("favorites");
      return favorite;
    });
  }

  async removeFavorite(businessId: string): Promise<void> {
    return this.run("Unable to remove saved salon", async () => {
      await firstValueFrom(this.api.removeFavorite(businessId));
      this.favorites.update((rows) => rows.filter((row) => row.businessId !== businessId && row.business?.id !== businessId && row.business?.slug !== businessId));
      this.favoritesLoaded = true;
      this.clearCached("favorites");
    });
  }

  async toggleFavorite(businessId: string): Promise<boolean> {
    return this.run("Unable to update saved salon", async () => {
      const wasFavorite = this.isFavorite(businessId);
      const placeholder = this.optimisticFavorite(businessId);
      this.favorites.update((rows) => wasFavorite
        ? this.withoutFavorite(rows, businessId)
        : [placeholder, ...rows]);
      this.favoritesLoaded = true;
      try {
        if (wasFavorite) {
          await firstValueFrom(this.api.removeFavorite(businessId));
          this.clearCached("favorites");
          return false;
        }
        const favorite = await firstValueFrom(this.api.addFavorite(businessId));
        this.favorites.update((rows) => [favorite, ...this.withoutFavorite(rows, businessId)]);
        this.clearCached("favorites");
        return true;
      } catch (error) {
        this.favorites.update((rows) => wasFavorite
          ? [placeholder, ...this.withoutFavorite(rows, businessId)]
          : this.withoutFavorite(rows, businessId));
        throw error;
      }
    });
  }

  private optimisticFavorite(businessId: string): CustomerFavorite {
    return { businessId, business: { id: businessId } as Business, createdAt: new Date().toISOString() };
  }

  private withoutFavorite(rows: CustomerFavorite[], businessId: string): CustomerFavorite[] {
    return rows.filter((row) => row.businessId !== businessId && row.business?.id !== businessId && row.business?.slug !== businessId);
  }

  async ensureSavedSalons(force = false): Promise<CustomerFavorite[]> {
    if (!this.isAuthenticated()) return [];
    return this.cachedLoad("saved-salons", "all", this.BUSINESS_CACHE_TTL_MS, "Unable to load saved salons", force, () => firstValueFrom(this.api.listSavedSalons()), (rows) => {
      this.savedSalons.set(rows);
      this.savedSalonsLoaded = true;
    });
  }

  isSalonSaved(businessId: string): boolean {
    return this.savedSalons().some((row) => row.businessId === businessId || row.business?.id === businessId || row.business?.slug === businessId);
  }

  async toggleSavedSalon(businessId: string): Promise<boolean> {
    return this.run("Unable to update saved salons", async () => {
      const wasSaved = this.isSalonSaved(businessId);
      const placeholder = this.optimisticFavorite(businessId);
      this.savedSalons.update((rows) => wasSaved
        ? this.withoutFavorite(rows, businessId)
        : [placeholder, ...rows]);
      this.savedSalonsLoaded = true;
      try {
        if (wasSaved) {
          await firstValueFrom(this.api.removeSavedSalon(businessId));
          this.clearCached("saved-salons");
          return false;
        }
        const saved = await firstValueFrom(this.api.saveSalon(businessId));
        this.savedSalons.update((rows) => [saved, ...this.withoutFavorite(rows, businessId)]);
        this.clearCached("saved-salons");
        return true;
      } catch (error) {
        this.savedSalons.update((rows) => wasSaved
          ? [placeholder, ...this.withoutFavorite(rows, businessId)]
          : this.withoutFavorite(rows, businessId));
        throw error;
      }
    });
  }

  async updateCustomer(payload: Partial<CustomerProfile>): Promise<CustomerProfile> {
    return this.run("Unable to update customer profile", () => this.auth.updateMe(payload));
  }

  async requestProfileEmailCode(email: string) {
    return this.run("Unable to send email verification code", () => this.auth.requestProfileEmailCode(email));
  }

  async verifyProfileEmailCode(email: string, code: string): Promise<CustomerProfile> {
    return this.run("Unable to verify email code", () => this.auth.verifyProfileEmailCode(email, code));
  }

  async requestProfilePhoneOtp(phone: string, channel: "sms" | "whatsapp" = "sms") {
    return this.run("Unable to send mobile OTP", () => this.auth.requestProfilePhoneOtp(phone, channel));
  }

  async verifyProfilePhoneOtp(phone: string, otp: string): Promise<CustomerProfile> {
    return this.run("Unable to verify mobile OTP", () => this.auth.verifyProfilePhoneOtp(phone, otp));
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.run("Unable to change password", () => this.auth.changePassword(currentPassword, newPassword));
  }

  async changePasswordWithPhoneOtp(phone: string, otp: string, newPassword: string): Promise<void> {
    return this.run("Unable to change password with mobile OTP", () => this.auth.changePasswordWithPhoneOtp(phone, otp, newPassword));
  }

  async deleteAccount(currentPassword = ""): Promise<void> {
    const result = await this.run("Unable to delete account", () => this.auth.deleteAccount(currentPassword));
    this.clearAllCached();
    return result;
  }

  async loadAccountModule(slug: string, force = false): Promise<CustomerAccountModule> {
    const moduleCacheKey = this.accountModuleCacheKey(slug);
    return this.cachedLoad("account-module", moduleCacheKey, this.BOOKINGS_CACHE_TTL_MS, "Unable to load customer records", force, () => this.accountModuleRequest(slug), (data) => {
      this.accountModule.set(data);
      this.moduleCacheStore.set(moduleCacheKey, data);
    });
  }

  /** Last successfully loaded module for a hub slug, or null on the very first load. */
  cachedModule(slug: string): CustomerAccountModule | null {
    return this.moduleCacheStore.get(this.accountModuleCacheKey(slug)) ?? null;
  }

  async loadMembershipPlans(branchId?: string, force = false): Promise<CustomerMembershipPlan[]> {
    const key = branchId ?? "all";
    return this.cachedLoad("membership-plans", key, this.BUSINESS_CACHE_TTL_MS, "Unable to load memberships", force, () => firstValueFrom(this.api.listMembershipPlans({ branchId })), (rows) => {
      this.membershipPlans.set(rows);
    });
  }

  async loadMyPackages(force = false): Promise<CustomerPackage[]> {
    return this.cachedLoad("packages", "all", this.BUSINESS_CACHE_TTL_MS, "Unable to load packages", force, () => firstValueFrom(this.api.listPackages()));
  }

  async buyMembership(planId: string, branchId?: string): Promise<CustomerMembership> {
    return this.run("Unable to buy membership", async () => {
      const result = await firstValueFrom(this.api.buyMembership(planId, branchId));
      this.mergeAccountList("memberships", result.membership);
      this.clearCached("account-module");
      return result.membership;
    });
  }

  // ─── Customer-Salon Relationships ────────────────────────────────
  async loadMySalons(force = false): Promise<CustomerSalonsResponse> {
    return this.cachedLoad("my-salons", "all", this.BUSINESS_CACHE_TTL_MS, "Unable to load your salons", force, () => firstValueFrom(this.api.getMySalons()), (response) => {
      this.mySalons.set(response.salons || []);
      this.primarySalon.set(response.primarySalon);
      this.shouldPromptPrimary.set(response.shouldPromptPrimary);
      this.suggestedSalon.set(response.suggestedSalon);
    });
  }

  async setPrimarySalon(tenantId: string, branchId: string, businessId: string, businessName: string): Promise<CustomerPrimarySalon> {
    return this.run("Unable to set primary salon", async () => {
      const { primarySalon } = await firstValueFrom(this.api.setPrimarySalon(tenantId, { branchId, businessId, businessName, reason: "manual" }));
      this.primarySalon.set(primarySalon);
      this.mySalonDashboard.set(null);
      this.shouldPromptPrimary.set(false);
      this.suggestedSalon.set(null);
      this.clearCached("my-salons");
      this.clearCached("my-salon-dashboard");
      return primarySalon;
    });
  }

  async removePrimarySalon(): Promise<void> {
    return this.run("Unable to remove primary salon", async () => {
      await firstValueFrom(this.api.removePrimarySalon());
      this.primarySalon.set(null);
      this.mySalonDashboard.set(null);
      this.salonModeStore.set(false);
      this.salonModeContextStore.set(null);
      this.shouldPromptPrimary.set(false);
      this.suggestedSalon.set(null);
      this.clearCached("my-salons");
      this.clearCached("my-salon-dashboard");
      try {
        localStorage.removeItem("aura_salon_mode_context");
        localStorage.removeItem("aura_salon_mode");
      } catch {
      }
    });
  }

  async loadSalonOffers(tenantId: string, branchId: string, force = false): Promise<PublicOffersResponse | null> {
    const key = `${tenantId}:${branchId}`;
    return this.cachedLoad("salon-offers", key, this.BOOKINGS_CACHE_TTL_MS, "Unable to load salon offers", force, () => firstValueFrom(this.api.getPublicOffers(tenantId, branchId)), (response) => {
      this.salonOffers.set(response);
    });
  }

  async loadMySalonDashboard(force = false): Promise<MySalonDashboard | null> {
    return this.cachedLoad("my-salon-dashboard", "all", this.BUSINESS_CACHE_TTL_MS, "Unable to load salon dashboard", force, () => firstValueFrom(this.api.getMySalonDashboard()), (dashboard) => {
      this.mySalonDashboard.set(dashboard);
    });
  }

  async purchaseGiftCard(payload: PurchaseGiftCardPayload): Promise<CustomerGiftCard> {
    return this.run("Unable to purchase gift card", async () => {
      const giftCard = await firstValueFrom(this.api.purchaseGiftCard(payload));
      this.mergeAccountList("gift-cards", giftCard);
      this.clearCached("account-module");
      return giftCard;
    });
  }

  async createInvoicePaymentLink(invoiceId: string, amountPaise?: number): Promise<CustomerPaymentLink> {
    return this.run("Unable to create payment link", () => firstValueFrom(this.api.createInvoicePaymentLink(invoiceId, amountPaise)));
  }

  formatMoney(pricePaise: number): string {
    return (pricePaise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  }

  private replaceBooking(booking: Booking) {
    this.selectedBooking.update((current) => current?.id === booking.id ? booking : current);
    this.latestBooking.update((current) => current?.id === booking.id ? booking : current);
    this.bookings.update((rows) => rows.map((row) => row.id === booking.id ? booking : row));
  }

  private normalizeBusiness(business: Business): Business {
    return {
      ...business,
      businessName: this.titleCaseDisplay(business.businessName),
      category: this.titleCaseDisplay(business.category),
      area: this.titleCaseDisplay(business.area),
      city: this.titleCaseDisplay(business.city),
      state: this.titleCaseDisplay(business.state),
      popularService: this.titleCaseDisplay(business.popularService),
      offerText: this.titleCaseDisplay(business.offerText),
      categories: (business.categories ?? []).map((item) => this.titleCaseDisplay(item)),
      policies: (business.policies ?? []).map((item) => this.titleCaseDisplay(item)),
      galleryImages: business.galleryImages ?? [],
      services: (business.services ?? []).map((service) => ({
        ...service,
        name: this.titleCaseDisplay(service.name),
        description: this.titleCaseDisplay(service.description),
        category: this.titleCaseDisplay(service.category)
      })),
      staff: (business.staff ?? []).map((member) => ({
        ...member,
        name: this.titleCaseDisplay(member.name),
        title: this.titleCaseDisplay(member.title),
        specialty: this.titleCaseDisplay(member.specialty),
        gender: this.titleCaseDisplay(member.gender)
      })),
      reviews: business.reviews ?? [],
      businessHours: business.businessHours ?? []
    };
  }

  /**
   * Converts ALL-CAPS user-facing text to title case so service and staff
   * data reads naturally. Strings that are not entirely uppercase are left
   * untouched to protect proper nouns, acronyms and mixed-case brand names.
   */
  private titleCaseDisplay(value: string | undefined | null): string {
    if (!value) return value ?? "";
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (trimmed !== trimmed.toUpperCase() || trimmed === trimmed.toLowerCase()) return value;
    return trimmed
      .toLowerCase()
      .replace(/(?:^|[\s\-/()])([a-z])/g, (match) => match.toUpperCase());
  }

  private accountModuleRequest(slug: string): Promise<CustomerAccountModule> {
    if (slug === "rewards") return firstValueFrom(this.api.getRewards());
    if (slug === "wallet") return firstValueFrom(this.api.getWallet());
    if (slug === "memberships") return firstValueFrom(this.api.listMemberships());
    if (slug === "packages") return firstValueFrom(this.api.listPackages());
    if (slug === "gift-cards") return firstValueFrom(this.api.listGiftCards());
    if (slug === "payments") return firstValueFrom(this.api.listPayments());
    if (slug === "notifications") return firstValueFrom(this.api.listNotifications());
    if (slug === "invoices") return firstValueFrom(this.api.listInvoices());
    return Promise.resolve([]);
  }

  private accountModuleCacheKey(slug: string): string {
    const context = this.salonModeContext();
    return context?.tenantId && context.branchId ? `${context.tenantId}:${context.branchId}:${slug}` : slug;
  }

  private mergeAccountList(slug: "memberships" | "gift-cards" | "invoices", item: CustomerMembership | CustomerGiftCard | CustomerInvoice) {
    this.accountModule.update((current) => {
      if (!Array.isArray(current)) return current;
      const next = [item, ...current.filter((row) => {
        return !(row && typeof row === "object" && "id" in row && row.id === item.id);
      })];
      return next as CustomerAccountModule;
    });
  }

  private async run<T>(fallback: string, action: () => Promise<T>): Promise<T> {
    // Clear the error only when starting a fresh batch (no other request in flight),
    // and track loading with a counter so parallel calls don't flip it off early.
    if (this.loadingCount() === 0) {
      this.error.set("");
      this.loadingStartedAt = Date.now();
    }
    this.loadingCount.update((count) => count + 1);
    this.startSkeletonTimer();
    try {
      return await action();
    } catch (error) {
      const message = this.message(error, fallback);
      this.error.set(message);
      throw error;
    } finally {
      this.loadingCount.update((count) => Math.max(0, count - 1));
      if (this.loadingCount() === 0) this.clearSkeletonTimer();
    }
  }

  private startSkeletonTimer(): void {
    if (this.skeletonTimer) return;
    this.skeletonTimer = setTimeout(() => {
      this.skeletonTimer = null;
      this.skeletonTick.update((value) => value + 1);
    }, MarketplaceService.SKELETON_DELAY_MS);
  }

  private clearSkeletonTimer(): void {
    if (this.skeletonTimer) {
      clearTimeout(this.skeletonTimer);
      this.skeletonTimer = null;
    }
  }

  private message(error: unknown, fallback: string): string {
    if (this.offline()) return MarketplaceService.OFFLINE_MSG;
    if (error instanceof Error) return this.cleanErrorMessage(error.message, fallback);
    if (typeof error === "object" && error) {
      const status = "status" in error ? Number((error as { status?: unknown }).status) : null;
      if (status === 0) return "Search service is unavailable. Please try again.";
      if ("message" in error) return this.cleanErrorMessage(String((error as { message?: unknown }).message || ""), fallback);
    }
    return fallback;
  }

  private cleanErrorMessage(message: string, fallback: string): string {
    if (!message) return fallback;
    if (message.startsWith("Http failure response") || message.includes("Unknown Error")) return fallback;
    return message;
  }
}
