import { Component, computed, effect, OnDestroy, OnInit, signal } from "@angular/core";
import { NavigationEnd, Router, RouterLink } from "@angular/router";
import { filter, Subscription } from "rxjs";
import { IonIcon, IonRouterOutlet } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import { checkmarkCircleOutline, closeCircleOutline, compassOutline, exitOutline, giftOutline, helpCircleOutline, homeOutline, notificationsOutline, personOutline, receiptOutline, ribbonOutline, starOutline, swapHorizontalOutline, timeOutline, walletOutline } from "ionicons/icons";
import { MarketplaceService } from "../../core/marketplace.service";
import { MySalonHeaderComponent } from "./my-salon-header.component";

@Component({
  standalone: true,
  imports: [IonRouterOutlet, IonIcon, RouterLink, MySalonHeaderComponent],
  template: `
    <section
      class="my-salon-shell"
      [attr.aria-label]="salonLabel() + ' mini app'">
      <app-my-salon-header
        [salonName]="salonLabel()"
        [initials]="salonInitials()"
        [logoImage]="salonLogo()"
        [homeHref]="homeHref()"
        [showBack]="headerBackVisible()"
        [showMenuButton]="true"
        [menuOpen]="menuOpen()"
        [switcherOpen]="salonSwitchOpen()"
        [showAction]="false"
        actionLabel="Exit"
        actionIcon="exit-outline"
        actionAriaLabel="Exit My Salon"
        (back)="back()"
        (home)="goHome($event)"
        (switcher)="toggleSalonSwitch()"
        (menu)="toggleMenu()"
        (action)="exit()" />
      <ion-router-outlet class="my-salon-shell-outlet"></ion-router-outlet>
      @if (salonSwitchOpen()) {
        <button type="button" class="salon-menu-backdrop" aria-label="Close salon switcher" (click)="closeSalonSwitch()"></button>
        <aside class="salon-switch-sheet" aria-label="Switch My Salon">
          <p class="salon-switch-kicker">Switch salon</p>
          @for (salon of salonChoices(); track salon.tenantId + ':' + salon.branchId) {
            <button type="button" class="salon-switch-item" [class.active]="isCurrentSalon(salon)" (click)="selectSalon(salon)">
              <span>{{ initials(salon.businessName) }}</span>
              <strong>{{ salon.businessName }}</strong>
              @if (isCurrentSalon(salon)) { <ion-icon name="checkmark-circle-outline" aria-hidden="true"></ion-icon> }
            </button>
          } @empty {
            <div class="salon-switch-empty">No other salon found</div>
          }
        </aside>
      }
      @if (menuOpen()) {
        <button type="button" class="salon-menu-backdrop" aria-label="Close salon menu" (click)="closeMenu()"></button>
        <aside class="salon-menu-sheet" aria-label="Salon menu">
          <div class="salon-menu-head">
            <span class="salon-menu-orb" aria-hidden="true">{{ salonInitials() }}</span>
            <div>
              <p>Salon Menu</p>
              <h2>{{ salonLabel() }}</h2>
            </div>
          </div>
          <nav class="salon-menu-list" aria-label="Selected salon shortcuts">
            <button type="button" class="salon-menu-switch" (click)="openSalonSwitchFromMenu()"><ion-icon name="swap-horizontal-outline" aria-hidden="true"></ion-icon><span><strong>Switch Salon</strong><small>Choose another salon</small></span></button>
            <a [routerLink]="navHref('bookings')" (click)="closeMenu()"><ion-icon name="time-outline" aria-hidden="true"></ion-icon><span><strong>Bookings</strong><small>Upcoming and past appointments</small></span></a>
            <a [routerLink]="navHref('wallet')" (click)="closeMenu()"><ion-icon name="wallet-outline" aria-hidden="true"></ion-icon><span><strong>Wallet</strong><small>Salon credit and transactions</small></span></a>
            <a [routerLink]="navHref('rewards')" (click)="closeMenu()"><ion-icon name="star-outline" aria-hidden="true"></ion-icon><span><strong>Rewards</strong><small>Loyalty points and benefits</small></span></a>
            <a [routerLink]="navHref('memberships')" (click)="closeMenu()"><ion-icon name="ribbon-outline" aria-hidden="true"></ion-icon><span><strong>Membership</strong><small>Plan, credits and renewal</small></span></a>
            <a [routerLink]="navHref('packages')" (click)="closeMenu()"><ion-icon name="gift-outline" aria-hidden="true"></ion-icon><span><strong>Packages</strong><small>Remaining sessions and usage</small></span></a>
            <a [routerLink]="navHref('invoices')" (click)="closeMenu()"><ion-icon name="receipt-outline" aria-hidden="true"></ion-icon><span><strong>Invoices</strong><small>Bills, payments and dues</small></span></a>
            <a [routerLink]="navHref('notifications')" (click)="closeMenu()"><ion-icon name="notifications-outline" aria-hidden="true"></ion-icon><span><strong>Notifications</strong><small>Updates from this salon</small></span></a>
            <a [routerLink]="navHref('support')" (click)="closeMenu()"><ion-icon name="help-circle-outline" aria-hidden="true"></ion-icon><span><strong>Support</strong><small>Get help with bookings or billing</small></span></a>
            @if (marketplace.primarySalon()) {
              <button type="button" class="salon-menu-remove" (click)="removePrimarySalon()"><ion-icon name="close-circle-outline" aria-hidden="true"></ion-icon><span><strong>Remove Primary</strong><small>Remove selected salon</small></span></button>
            }
            <button type="button" class="salon-menu-exit" (click)="exit()"><ion-icon name="exit-outline" aria-hidden="true"></ion-icon><span><strong>Exit My Salon</strong><small>Back to Aura customer app</small></span></button>
          </nav>
        </aside>
      }
      <nav class="my-salon-bottom-nav" aria-label="Salon mode navigation">
        <a [href]="navHref('')" [class.active]="isSalonNavActive('overview')" (click)="handleSalonNav($event, navHref(''))"><ion-icon name="home-outline" aria-hidden="true"></ion-icon><span>Overview</span></a>
        <a [href]="navHref('bookings')" [class.active]="isSalonNavActive('bookings')" (click)="handleSalonNav($event, navHref('bookings'))"><ion-icon name="time-outline" aria-hidden="true"></ion-icon><span>Bookings</span></a>
        <a [href]="navHref('wallet')" [class.active]="isSalonNavActive('wallet')" (click)="handleSalonNav($event, navHref('wallet'))"><ion-icon name="wallet-outline" aria-hidden="true"></ion-icon><span>Wallet</span></a>
        <a [href]="navHref('rewards')" [class.active]="isSalonNavActive('rewards')" (click)="handleSalonNav($event, navHref('rewards'))"><ion-icon name="star-outline" aria-hidden="true"></ion-icon><span>Rewards</span></a>
      </nav>
    </section>
  `,
  styles: [`
    :host { display: block; min-height: 100%; }
    .my-salon-shell { min-height: 100%; --ms-shell-accent: #7c63df; --ms-shell-accent-soft: #e1d6fb; }
    .my-salon-shell-outlet { padding-bottom: calc(70px + env(safe-area-inset-bottom)); }
    :host ::ng-deep ion-back-button,
    :host ::ng-deep .content-back-button,
    :host ::ng-deep .cover-back-button {
      display: none;
    }

    .salon-menu-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1090;
      border: 0;
      background: rgba(12, 10, 22, 0.38);
      backdrop-filter: blur(6px);
    }
    .my-salon-bottom-nav {
      position: fixed;
      z-index: 900;
      left: 50%;
      bottom: env(safe-area-inset-bottom);
      width: min(520px, calc(100% - 16px));
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 4px;
      padding: 5px 6px;
      border: 1px solid rgba(225, 214, 251, 0.72);
      border-radius: 18px;
      background: var(--glass);
      box-shadow: 0 -8px 24px rgba(28, 28, 28, 0.08);
      backdrop-filter: blur(18px);
      box-sizing: border-box;
      transform: translateX(-50%);
    }
    .my-salon-bottom-nav a { min-height: 42px; display: grid; justify-items: center; align-content: center; gap: 2px; border-radius: 12px; color: var(--muted); font-size: 0.72rem; font-weight: 850; text-decoration: none; }
    .my-salon-bottom-nav ion-icon { font-size: 1.05rem; }
    .my-salon-bottom-nav a.active { color: var(--ms-shell-accent); background: rgba(124, 99, 223, 0.1); }
    .salon-menu-sheet {
      position: fixed;
      z-index: 1100;
      top: calc(70px + env(safe-area-inset-top));
      right: max(12px, calc((100vw - 640px) / 2 + 12px));
      width: min(320px, max(180px, calc((100vw - 24px) / 2)));
      max-height: calc(100dvh - 92px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
      overflow: auto;
      padding: 10px;
      border: 1px solid rgba(225, 214, 251, 0.78);
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(250,247,255,0.94));
      box-shadow: 0 28px 70px rgba(38, 23, 89, 0.24);
      animation: salonMenuIn 240ms ease-out both;
    }
    .salon-switch-sheet {
      position: fixed;
      z-index: 1100;
      top: calc(66px + env(safe-area-inset-top));
      left: 50%;
      width: min(520px, calc(100% - 32px));
      max-height: min(420px, calc(100dvh - 100px));
      display: grid;
      gap: 8px;
      overflow: auto;
      padding: 12px;
      border: 1px solid rgba(225, 214, 251, 0.78);
      border-radius: 22px;
      background: rgba(255,255,255,0.96);
      box-shadow: 0 28px 70px rgba(38, 23, 89, 0.24);
      transform: translateX(-50%);
    }
    .salon-switch-kicker { margin: 0 4px 2px; color: var(--muted); font-size: 0.66rem; font-weight: 950; text-transform: uppercase; letter-spacing: 0.08em; }
    .salon-switch-item { display: grid; grid-template-columns: 30px minmax(0, 1fr) 18px; align-items: center; gap: 10px; min-height: 44px; padding: 7px 9px; border: 1px solid rgba(225, 214, 251, 0.72); border-radius: 16px; color: var(--text); background: rgba(250,247,255,0.72); text-align: left; }
    .salon-switch-item > span { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 11px; color: #fff; background: var(--ms-shell-accent); font-size: 0.66rem; font-weight: 950; }
    .salon-switch-item strong { overflow: hidden; font-size: 0.82rem; text-overflow: ellipsis; white-space: nowrap; }
    .salon-switch-item ion-icon { color: var(--ms-shell-accent); font-size: 1rem; }
    .salon-switch-item.active { border-color: rgba(124, 99, 223, 0.42); background: rgba(239, 233, 255, 0.86); }
    .salon-switch-empty { padding: 12px; border-radius: 14px; color: var(--muted); background: rgba(250,247,255,0.72); font-size: 0.78rem; font-weight: 850; text-align: center; }
    .salon-menu-head { display: flex; align-items: center; gap: 8px; padding: 0 2px 8px; }
    .salon-menu-orb { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 14px; color: #fff; background: var(--ms-shell-accent); font-size: 0.72rem; font-weight: 950; box-shadow: 0 10px 20px rgba(95, 70, 207, 0.22); }
    .salon-menu-head p { margin: 0 0 1px; color: var(--muted); font-size: 0.6rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.07em; }
    .salon-menu-head h2 { margin: 0; color: var(--text); font-size: 0.82rem; line-height: 1.08; letter-spacing: -0.03em; }
    .salon-menu-list { display: grid; gap: 6px; }
    .salon-menu-list a, .salon-menu-exit, .salon-menu-remove, .salon-menu-switch { display: grid; grid-template-columns: 20px minmax(0, 1fr); align-items: center; gap: 14px; min-height: 34px; padding: 5px 7px; border: 1px solid rgba(225, 214, 251, 0.62); border-radius: 12px; color: var(--text); background: rgba(255,255,255,0.76); text-align: left; text-decoration: none; transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease; }
    .salon-menu-exit, .salon-menu-remove { color: #9F1239; border-color: rgba(159, 18, 57, 0.18); background: rgba(255, 241, 242, 0.84); }
    .salon-menu-list ion-icon { width: 20px; height: 20px; padding: 4px; box-sizing: border-box; border-radius: 8px; color: var(--ms-shell-accent); background: color-mix(in srgb, var(--ms-shell-accent-soft) 62%, white); }
    .salon-menu-exit ion-icon, .salon-menu-remove ion-icon { color: #9F1239; background: rgba(255,255,255,0.78); }
    .salon-menu-list span { display: grid; min-width: 0; gap: 1px; }
    .salon-menu-list strong { overflow: hidden; font-size: 0.7rem; line-height: 1.05; letter-spacing: -0.02em; text-overflow: ellipsis; white-space: nowrap; }
    .salon-menu-list small { display: none; }
    .salon-menu-list a:focus-visible, .salon-menu-exit:focus-visible, .salon-menu-remove:focus-visible, .salon-menu-switch:focus-visible, .salon-switch-item:focus-visible { outline: 2px solid color-mix(in srgb, var(--ms-shell-accent) 72%, white); outline-offset: 2px; }
    .salon-menu-list a:active, .salon-menu-exit:active, .salon-menu-remove:active, .salon-menu-switch:active, .salon-switch-item:active { transform: scale(0.985); }
    @keyframes salonMenuIn { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @media (hover: hover) and (pointer: fine) {
      .salon-menu-list a:hover, .salon-menu-exit:hover, .salon-menu-remove:hover, .salon-menu-switch:hover, .salon-switch-item:hover {
        border-color: rgba(124, 99, 223, 0.36);
        box-shadow: 0 14px 28px rgba(95, 70, 207, 0.12);
        transform: translateY(-1px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .salon-menu-list a,
      .salon-menu-exit,
      .salon-menu-remove,
      .salon-menu-switch,
      .salon-switch-item {
        transition: none;
      }
      .salon-menu-sheet { animation: none; }
    }
  `]
})
export class MySalonShellPage implements OnDestroy, OnInit {
  readonly salonLabel = computed(() => this.marketplace.mySalonDashboard()?.salon?.name || this.marketplace.primarySalon()?.businessName || this.marketplace.salonModeContext()?.businessName || "Selected salon");
  readonly salonLogo = computed(() => this.marketplace.mySalonDashboard()?.salon?.logoImage || "");
  readonly salonInitials = computed(() => this.initials(this.salonLabel()));
  readonly menuOpen = signal(false);
  readonly salonSwitchOpen = signal(false);
  private readonly currentPath = signal("");
  private navigationSubscription?: Subscription;

  constructor(readonly marketplace: MarketplaceService, private readonly router: Router) {
    this.navigationSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.currentPath.set(event.urlAfterRedirects.split(/[?#]/)[0]));
    this.currentPath.set(this.router.url.split(/[?#]/)[0]);
    addIcons({ checkmarkCircleOutline, closeCircleOutline, compassOutline, exitOutline, giftOutline, helpCircleOutline, homeOutline, notificationsOutline, personOutline, receiptOutline, ribbonOutline, starOutline, swapHorizontalOutline, timeOutline, walletOutline });
  }

  ngOnInit(): void {
    void this.marketplace.loadMySalons().catch(() => undefined);
    if (!this.marketplace.mySalonDashboard()?.salon?.slug) {
      void this.marketplace.loadMySalonDashboard().catch(() => undefined);
    }
  }

  ngOnDestroy(): void {
    this.navigationSubscription?.unsubscribe();
  }

  homeHref(): string {
    return this.marketplace.salonModeUrl();
  }

  goHome(event: Event): void {
    event.preventDefault();
    void this.router.navigateByUrl(this.homeHref());
  }

  back(): void {
    const currentPath = this.router.url.split(/[?#]/)[0].replace(/\/+$/, "");
    const homePath = this.homeHref().replace(/\/+$/, "");
    if (currentPath === homePath || currentPath.startsWith(homePath)) {
      void this.router.navigateByUrl(homePath);
      return;
    }
    if (!this.confirmLeaveSalonMode()) return;
    window.history.length > 1 ? window.history.back() : void this.router.navigateByUrl("/tabs/home");
  }

  exit(): void {
    if (!this.confirmLeaveSalonMode()) return;
    this.marketplace.exitSalonMode();
    void this.router.navigateByUrl("/tabs/home");
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
    this.salonSwitchOpen.set(false);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  handleSalonNav(event: Event, targetUrl: string): void {
    event.preventDefault();
    void this.router.navigateByUrl(targetUrl);
  }

  isSalonNavActive(item: "overview" | "bookings" | "wallet" | "rewards"): boolean {
    const path = this.currentPath().replace(/\/+$/, "");
    const base = this.homeHref().replace(/\/+$/, "");
    if (item === "overview") return path === base || path === `${base}/home`;
    return path === `${base}/${item}`;
  }

  toggleSalonSwitch(): void {
    if (!this.salonSwitchOpen()) void this.marketplace.loadMySalons(true).catch(() => undefined);
    this.salonSwitchOpen.update((open) => !open);
    this.menuOpen.set(false);
  }

  closeSalonSwitch(): void {
    this.salonSwitchOpen.set(false);
  }

  openSalonSwitchFromMenu(): void {
    this.menuOpen.set(false);
    this.salonSwitchOpen.set(true);
  }

  salonChoices() {
    const rows = this.marketplace.mySalons();
    if (rows.length) return rows;
    const context = this.marketplace.salonModeContext();
    return context?.tenantId && context.branchId
      ? [{ id: "current", customerId: "", tenantId: context.tenantId, branchId: context.branchId, businessId: context.businessId || context.branchId, businessName: context.businessName || this.salonLabel(), relationshipType: "primary", visitCount: 0, lastVisitAt: "", isFavorite: 0, createdAt: "", updatedAt: "" }]
      : [];
  }

  isCurrentSalon(salon: { tenantId: string; branchId: string }): boolean {
    const context = this.marketplace.salonModeContext();
    return context?.tenantId === salon.tenantId && context.branchId === salon.branchId;
  }

  async selectSalon(salon: { tenantId: string; branchId: string; businessId: string; businessName: string }): Promise<void> {
    await this.marketplace.setPrimarySalon(salon.tenantId, salon.branchId, salon.businessId, salon.businessName);
    this.marketplace.enterSalonMode({ tenantId: salon.tenantId, branchId: salon.branchId, businessId: salon.businessId, businessName: salon.businessName });
    this.salonSwitchOpen.set(false);
    await this.marketplace.loadMySalonDashboard(true).catch(() => undefined);
    void this.router.navigateByUrl(this.marketplace.salonModeUrl());
  }

  async removePrimarySalon(): Promise<void> {
    const confirmed = typeof window === "undefined" || window.confirm("Remove this salon as your primary salon?");
    if (!confirmed) return;
    await this.marketplace.removePrimarySalon();
    this.marketplace.exitSalonMode();
    void this.router.navigateByUrl("/tabs/home");
  }

  private confirmLeaveSalonMode(): boolean {
    return typeof window === "undefined" || window.confirm("Exit My Salon mode and go back to the customer app?");
  }

  navHref(...segments: string[]): string {
    const base = this.marketplace.salonModeUrl();
    const tail = segments.filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/");
    return tail ? `${base}/${tail}` : base;
  }

  readonly headerBackVisible = computed(() => {
    const path = this.currentPath();
    const base = this.marketplace.salonModeUrl().replace(/\/+$/, "");
    if (path === base || path === `${base}/home`) return false;
    if (/\/business\/[^/]+\/book$/.test(path)) return false;
    if (/(?:\/rewards|\/wallet|\/memberships?|\/packages|\/gift-cards|\/loyalty)$/.test(path)) return false;
    if (/\/business\/[^/]+$/.test(path)) return false;
    return true;
  });

  initials(value: string): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "MS";
  }
}
