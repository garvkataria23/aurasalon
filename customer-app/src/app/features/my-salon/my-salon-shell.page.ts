import { Component, computed, effect, OnDestroy, OnInit, signal } from "@angular/core";
import { NavigationEnd, Router, RouterLink } from "@angular/router";
import { filter, Subscription } from "rxjs";
import { IonIcon, IonRouterOutlet } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import { calendarOutline, giftOutline, homeOutline, storefrontOutline } from "ionicons/icons";
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
        actionLabel="Exit"
        actionIcon="exit-outline"
        actionAriaLabel="Exit My Salon"
        (back)="back()"
        (home)="goHome($event)"
        (action)="exit()" />
      <ion-router-outlet class="my-salon-shell-outlet"></ion-router-outlet>
      @if (contextNavVisible()) {
        <nav class="my-salon-context-nav" aria-label="My Salon navigation">
          <a [routerLink]="navHref('')" class="context-nav-item" [class.active]="navOverviewActive()" aria-label="My Salon overview">
            <ion-icon name="home-outline" aria-hidden="true"></ion-icon>
            <span>Overview</span>
          </a>
          <a [routerLink]="bookHref()" class="context-nav-item" [class.active]="navBookActive()" aria-label="Book a service at this salon">
            <ion-icon name="calendar-outline" aria-hidden="true"></ion-icon>
            <span>Book</span>
          </a>
          <a [routerLink]="navHref('rewards')" class="context-nav-item" [class.active]="navBenefitsActive()" aria-label="View salon benefits">
            <ion-icon name="gift-outline" aria-hidden="true"></ion-icon>
            <span>Benefits</span>
          </a>
          <a [routerLink]="salonHref()" class="context-nav-item" [class.active]="navSalonActive()" aria-label="View salon details">
            <ion-icon name="storefront-outline" aria-hidden="true"></ion-icon>
            <span>Salon</span>
          </a>
        </nav>
      }
    </section>
  `,
  styles: [`
    :host { display: block; min-height: 100%; }
    .my-salon-shell { min-height: 100%; --ms-shell-accent: #7c63df; --ms-shell-accent-soft: #e1d6fb; }
    .my-salon-shell-outlet { padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
    :host ::ng-deep ion-back-button,
    :host ::ng-deep .content-back-button,
    :host ::ng-deep .cover-back-button {
      display: none;
    }

    /* Contextual bottom navigation — compact, matches marketplace tab bar */
    .my-salon-context-nav {
      position: fixed;
      z-index: 900;
      left: 50%;
      bottom: env(safe-area-inset-bottom);
      width: min(520px, calc(100% - 16px));
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 4px;
      padding: 4px 6px;
      border: 1px solid rgba(225, 214, 251, 0.72);
      border-radius: 18px;
      background: var(--glass);
      box-shadow: 0 -8px 24px rgba(28, 28, 28, 0.08);
      backdrop-filter: blur(18px);
      box-sizing: border-box;
      transform: translateX(-50%);
      contain: layout paint;
    }
    .context-nav-item {
      min-height: 44px;
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 2px;
      border-radius: 12px;
      color: var(--muted);
      font-size: 0.76rem;
      font-weight: 850;
      text-decoration: none;
      touch-action: manipulation;
      transition: color var(--motion-fast), background-color var(--motion-fast);
    }
    .context-nav-item ion-icon {
      padding: 4px 14px;
      border-radius: 999px;
      font-size: 1.12rem;
      transition: background-color var(--motion-fast), color var(--motion-fast), box-shadow var(--motion-fast);
    }
    .context-nav-item.active {
      color: var(--ms-shell-accent);
    }
    .context-nav-item.active ion-icon {
      color: #ffffff;
      background: var(--ms-shell-accent);
      box-shadow: 0 6px 14px rgba(95, 70, 207, 0.22);
    }
    .context-nav-item:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--ms-shell-accent) 72%, white);
      outline-offset: 2px;
    }
    .context-nav-item:active {
      transform: scale(0.98);
    }
    @media (hover: hover) and (pointer: fine) {
      .context-nav-item:hover {
        color: var(--text);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .context-nav-item,
      .context-nav-item ion-icon {
        transition: none;
      }
    }
  `]
})
export class MySalonShellPage implements OnDestroy, OnInit {
  readonly salonLabel = computed(() => this.marketplace.mySalonDashboard()?.salon?.name || this.marketplace.primarySalon()?.businessName || this.marketplace.salonModeContext()?.businessName || "Selected salon");
  readonly salonLogo = computed(() => this.marketplace.mySalonDashboard()?.salon?.logoImage || "");
  readonly salonInitials = computed(() => this.initials(this.salonLabel()));
  private readonly currentPath = signal("");
  private navigationSubscription?: Subscription;

  constructor(readonly marketplace: MarketplaceService, private readonly router: Router) {
    this.navigationSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.currentPath.set(event.urlAfterRedirects.split(/[?#]/)[0]));
    this.currentPath.set(this.router.url.split(/[?#]/)[0]);
    addIcons({ homeOutline, calendarOutline, giftOutline, storefrontOutline });
  }

  ngOnInit(): void {
    effect(() => {
      const context = this.marketplace.salonModeContext();
      if (context?.tenantId && context.branchId) {
        this.marketplace.clearCached("my-salon-dashboard");
      }
    });
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
    if (!currentPath || currentPath === homePath) return;
    window.history.length > 1 ? window.history.back() : void this.router.navigateByUrl(this.homeHref());
  }

  exit(): void {
    this.marketplace.exitSalonMode();
    void this.router.navigateByUrl("/tabs/home");
  }

  navHref(...segments: string[]): string {
    const base = this.marketplace.salonModeUrl();
    const tail = segments.filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/");
    return tail ? `${base}/${tail}` : base;
  }

  bookHref(): string {
    const slug = this.marketplace.mySalonDashboard()?.salon?.slug;
    return slug ? this.navHref("business", slug, "book") : this.navHref();
  }

  salonHref(): string {
    const slug = this.marketplace.mySalonDashboard()?.salon?.slug;
    return slug ? this.navHref("business", slug) : this.navHref();
  }

  /** Hidden only on booking detail/chat flows that bring their own full-screen controls. */
  readonly contextNavVisible = computed(() => {
    const path = this.currentPath();
    if (!path.startsWith("/my-salon/")) return false;
    return !/(\/booking\/(?:summary|success)|\/bookings\/[^/]+(?:\/chat)?)$/.test(path);
  });

  readonly navOverviewActive = computed(() => {
    const path = this.currentPath();
    return path === this.marketplace.salonModeUrl() || path === `${this.marketplace.salonModeUrl()}/home`;
  });

  readonly navBookActive = computed(() => /\/business\/[^/]+\/book$/.test(this.currentPath()));

  readonly navBenefitsActive = computed(() => /(?:\/rewards|\/wallet|\/memberships?|\/packages|\/gift-cards|\/loyalty)$/.test(this.currentPath()));

  readonly navSalonActive = computed(() => /\/business\/[^/]+$/.test(this.currentPath()));

  readonly headerBackVisible = computed(() => {
    const path = this.currentPath();
    const base = this.marketplace.salonModeUrl().replace(/\/+$/, "");
    if (path === base || path === `${base}/home`) return false;
    if (/\/business\/[^/]+\/book$/.test(path)) return false;
    if (/(?:\/rewards|\/wallet|\/memberships?|\/packages|\/gift-cards|\/loyalty)$/.test(path)) return false;
    if (/\/business\/[^/]+$/.test(path)) return false;
    return true;
  });

  private initials(value: string): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "MS";
  }
}
