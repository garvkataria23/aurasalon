import { Component, OnInit, computed, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { IonContent, IonIcon } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import { chevronBackOutline } from "ionicons/icons";
import { MarketplaceService } from "../../core/marketplace.service";
import { Business, CustomerSalonRelationship } from "../../core/api.types";
import { YourSalonsListComponent } from "../../shared/your-salons-list.component";

@Component({
  standalone: true,
  imports: [RouterLink, IonContent, IonIcon, YourSalonsListComponent],
  template: `
    <ion-content>
      <main class="page-narrow my-salons-page">
        <section class="my-salons-head premium-card">
          <a routerLink="/tabs/profile" aria-label="Back to profile">
            <ion-icon name="chevron-back-outline" aria-hidden="true"></ion-icon>
          </a>
          <div>
            <span>Profile</span>
            <h1>My Salons</h1>
            <p>Manage primary salons, previous salons and salon mode.</p>
          </div>
        </section>

        <aura-your-salons-list
          [salons]="marketplace.mySalons()"
          [primarySalon]="marketplace.primarySalon()"
          [primarySalons]="marketplace.primarySalons()"
          [hasBookings]="marketplace.bookings().length > 0"
          [bookingCount]="marketplace.bookings().length"
          [favouriteCount]="marketplace.favorites().length"
          (setAsPrimary)="onSetPrimarySalon($event)"
          (removePrimary)="onRemovePrimarySalon($event)"
          (addPrevious)="showPrevious.set(true)">
        </aura-your-salons-list>

        @if (showPrevious() || previousSalonCandidates().length > 0) {
          <section class="previous-salons-card premium-card">
            <div class="previous-salons-head">
              <div>
                <span>Add previous salons</span>
                <h2>Choose from your history</h2>
                <p>Only salons you previously added, favourited or booked appear here.</p>
              </div>
              @if (previousSalonCandidates().length > 0) { <strong>{{ previousSalonCandidates().length }}</strong> }
            </div>

            @if (previousSalonCandidates().length > 0) {
              <div class="previous-salon-list">
                @for (salon of previousSalonCandidates(); track salon.tenantId + ':' + salon.branchId) {
                  <article class="previous-salon-row">
                    <span class="previous-initials" aria-hidden="true">{{ initials(salon.businessName) }}</span>
                    <div>
                      <strong>{{ salon.businessName }}</strong>
                      <small>{{ salon.relationshipType === 'favourite' ? 'Favourite salon' : 'Previous booking' }}</small>
                    </div>
                    <button type="button" (click)="addPreviousSalon(salon)">Add</button>
                  </article>
                }
              </div>
            } @else {
              <div class="previous-empty">
                <strong>No previous salons found</strong>
                <p>Favourite or book a salon first, then it will appear here.</p>
                <a routerLink="/tabs/search">Explore salons</a>
              </div>
            }
          </section>
        }
      </main>
    </ion-content>
  `,
  styles: [`
    .my-salons-page {
      display: grid;
      gap: 14px;
      padding-top: calc(14px + env(safe-area-inset-top));
      padding-bottom: calc(96px + env(safe-area-inset-bottom));
    }

    .my-salons-head {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      align-items: start;
      gap: 12px;
      padding: 18px;
      border-radius: 24px;
      background: radial-gradient(circle at 10% 0%, rgba(124, 99, 223, 0.16), transparent 38%), linear-gradient(135deg, #ffffff, #fbf9ff);
    }

    .my-salons-head a {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(225, 214, 251, 0.78);
      border-radius: 14px;
      color: var(--text);
      background: rgba(255, 255, 255, 0.72);
      text-decoration: none;
    }

    .my-salons-head span {
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 950;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .my-salons-head h1 {
      margin: 2px 0 0;
      color: var(--text);
      font-size: 1.42rem;
      line-height: 1;
      letter-spacing: -0.05em;
    }

    .my-salons-head p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 0.82rem;
      font-weight: 650;
      line-height: 1.35;
    }

    .previous-salons-card {
      display: grid;
      gap: 12px;
      padding: 16px;
      border-radius: 22px;
    }

    .previous-salons-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
    }

    .previous-salons-head span {
      color: var(--primary);
      font-size: 0.72rem;
      font-weight: 950;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .previous-salons-head h2 {
      margin: 2px 0 0;
      color: var(--text);
      font-size: 1.05rem;
      line-height: 1.1;
      letter-spacing: -0.03em;
    }

    .previous-salons-head p,
    .previous-empty p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 650;
      line-height: 1.35;
    }

    .previous-salons-head > strong {
      min-width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      color: #fff;
      background: linear-gradient(135deg, var(--primary), var(--primary-2));
      font-size: 0.78rem;
    }

    .previous-salon-list { display: grid; gap: 8px; }

    .previous-salon-row {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      min-height: 64px;
      padding: 10px;
      border: 1px solid rgba(225, 214, 251, 0.72);
      border-radius: 18px;
      background: rgba(255,255,255,0.72);
    }

    .previous-initials {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      color: #fff;
      background: linear-gradient(135deg, var(--primary), var(--primary-2));
      font-size: 0.78rem;
      font-weight: 950;
    }

    .previous-salon-row strong,
    .previous-salon-row small { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .previous-salon-row strong { color: var(--text); font-size: 0.9rem; line-height: 1.15; }
    .previous-salon-row small { margin-top: 3px; color: var(--muted); font-size: 0.72rem; font-weight: 750; }

    .previous-salon-row button,
    .previous-empty a {
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 14px;
      border: 0;
      border-radius: 999px;
      color: #fff;
      background: linear-gradient(135deg, var(--primary), var(--primary-2));
      font: inherit;
      font-size: 0.76rem;
      font-weight: 950;
      text-decoration: none;
    }

    .previous-empty {
      display: grid;
      justify-items: start;
      gap: 8px;
      padding: 12px;
      border-radius: 18px;
      background: rgba(250, 247, 255, 0.74);
    }

  `]
})
export class MySalonsPage implements OnInit {
  readonly showPrevious = signal(false);
  readonly previousSalonCandidates = computed(() => this.buildPreviousSalonCandidates());

  constructor(readonly marketplace: MarketplaceService) {
    addIcons({ chevronBackOutline });
  }

  ngOnInit(): void {
    void this.marketplace.loadBookings().catch(() => undefined);
    void this.marketplace.loadFavorites().catch(() => undefined);
    void this.marketplace.loadMySalons(true).catch(() => undefined);
    void this.marketplace.loadPublicBusinesses().catch(() => undefined);
  }

  async onSetPrimarySalon(salon: CustomerSalonRelationship): Promise<void> {
    try {
      const mode = await this.marketplace.choosePrimaryMode(salon);
      if (!mode) return;
      await this.marketplace.setPrimarySalon(salon.tenantId, salon.branchId, salon.businessId, salon.businessName, mode);
    } catch {
      // Marketplace service owns user-facing error state.
    }
  }

  async onRemovePrimarySalon(salon: CustomerSalonRelationship): Promise<void> {
    try {
      await this.marketplace.removePrimarySalon(salon.tenantId, salon.branchId);
    } catch {
      // Marketplace service owns user-facing error state.
    }
  }

  async addPreviousSalon(salon: CustomerSalonRelationship): Promise<void> {
    await this.onSetPrimarySalon(salon);
  }

  initials(value: string): string {
    return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "MS";
  }

  private buildPreviousSalonCandidates(): CustomerSalonRelationship[] {
    const selected = new Set(this.marketplace.primarySalons().map((salon) => `${salon.tenantId}:${salon.branchId}`));
    const rows: CustomerSalonRelationship[] = [];
    const addSalon = (salon: CustomerSalonRelationship) => {
      const key = `${salon.tenantId}:${salon.branchId}`;
      if (selected.has(key) || rows.some((row) => `${row.tenantId}:${row.branchId}` === key)) return;
      rows.push(salon);
    };
    const addBusiness = (business: Business | undefined, relationshipType: "favourite" | "previous") => {
      if (!business?.tenantId || !business.branchId) return;
      const key = `${business.tenantId}:${business.branchId}`;
      if (selected.has(key) || rows.some((salon) => `${salon.tenantId}:${salon.branchId}` === key)) return;
      rows.push({
        id: key,
        customerId: "",
        tenantId: business.tenantId,
        branchId: business.branchId,
        businessId: business.id,
        businessName: business.businessName,
        relationshipType,
        visitCount: 0,
        lastVisitAt: "",
        isFavorite: relationshipType === "favourite" ? 1 : 0,
        createdAt: business.createdAt || "",
        updatedAt: business.createdAt || ""
      });
    };

    this.marketplace.mySalons().forEach((salon) => addSalon(salon));
    this.marketplace.favorites().forEach((favorite) => addBusiness(favorite.business, "favourite"));
    const businesses = this.marketplace.businesses();
    this.marketplace.bookings().forEach((booking) => {
      addBusiness(businesses.find((business) => business.id === booking.businessId || business.businessName === booking.businessName), "previous");
    });
    return rows;
  }
}
