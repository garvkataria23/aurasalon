import { Component, EventEmitter, Input, Output } from "@angular/core";
import { RouterLink } from "@angular/router";
import { IonButton, IonIcon } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import { checkmarkOutline, starOutline, storefrontOutline, swapHorizontalOutline, timeOutline } from "ionicons/icons";
import { CustomerPrimarySalon, CustomerSalonRelationship } from "../core/api.types";

@Component({
  selector: "aura-your-salons-list",
  standalone: true,
  imports: [RouterLink, IonButton, IonIcon],
  template: `
    <section class="salons-section" aria-label="Your salons">
      <div class="salons-header">
        <h3>My Salons</h3>
        @if (visibleSalons().length > 0) {
          <span class="count">{{ visibleSalons().length }} saved</span>
        }
      </div>

      @if (visibleSalons().length === 0) {
        <div class="empty-state">
          <div class="empty-icon" aria-hidden="true"><ion-icon name="storefront-outline"></ion-icon></div>
          <strong>No salons added yet</strong>
          @if (hasBookings) {
            <p>You have bookings, but no salon is added to My Salon yet. Add a salon to manage primary mode, rewards and visits from one place.</p>
            <div class="empty-state-facts" aria-label="Salon account summary">
              <span>{{ bookingCount }} booked</span>
              <span>{{ favouriteCount }} favourite{{ favouriteCount === 1 ? '' : 's' }}</span>
              <span>0 visited</span>
            </div>
            <div class="empty-actions">
              <button type="button" class="empty-link" (click)="addPrevious.emit()">Add previous salon</button>
              <a class="empty-link secondary" routerLink="/tabs/search">Explore salons</a>
            </div>
          } @else {
            <p>Choose a salon to set primary mode, track visits, and quickly open salon-specific bookings and rewards.</p>
            <ion-button class="primary-gradient" routerLink="/tabs/search">Add a salon</ion-button>
          }
        </div>
      } @else {
        <ul class="salon-list" role="list">
          @for (salon of visibleSalons(); track salon.tenantId + ':' + salon.branchId) {
            <li
              class="salon-row"
              [class.is-primary]="primarySalon?.tenantId === salon.tenantId && primarySalon?.branchId === salon.branchId"
              role="listitem">
              <div class="salon-initials" [class.primary-badge]="isPrimary(salon)">
                {{ salonInitials(salon.businessName) }}
              </div>
              <div class="salon-details">
                <div class="salon-name-row">
                  <span class="salon-name">{{ salon.businessName }}</span>
                  @if (isPrimary(salon)) {
                    <span class="primary-tag">Primary</span>
                  }
                </div>
                <div class="salon-meta">
                  <span class="meta-pill">
                    <ion-icon name="time-outline"></ion-icon>
                    {{ salon.visitCount }} visit{{ salon.visitCount !== 1 ? 's' : '' }}
                  </span>
                  <span class="meta-pill relationship" [attr.data-type]="salon.relationshipType">
                    {{ formatRelationshipType(salon.relationshipType) }}
                  </span>
                  @if (salon.lastVisitAt) {
                    <span class="meta-pill">Last: {{ formatTimeAgo(salon.lastVisitAt) }}</span>
                  }
                </div>
              </div>
              <div class="salon-actions">
                @if (isPrimary(salon)) {
                  <a class="enter-salon-btn" [routerLink]="salonModeLink(salon)">Enter</a>
                }
                @if (!isPrimary(salon)) {
                  <button
                    type="button"
                    class="set-primary-btn"
                    [attr.aria-label]="'Set ' + salon.businessName + ' as primary salon'"
                    (click)="setAsPrimary.emit(salon)">
                    Set primary
                  </button>
                }
                @if (isPrimary(salon)) {
                  <button
                    type="button"
                    class="remove-primary-btn"
                    [attr.aria-label]="'Remove ' + salon.businessName + ' as primary salon'"
                    (click)="removePrimary.emit(salon)">
                    Remove salon
                  </button>
                }
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .salons-section {
      display: grid;
      gap: 6px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 20px;
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(240, 235, 252, 0.96));
    }

    .salons-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .salons-header h3 {
      margin: 0;
      color: var(--text);
      font-size: 0.98rem;
      font-weight: 950;
    }

    .count {
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 800;
    }

    .empty-state {
      display: grid;
      justify-items: center;
      gap: 10px;
      padding: 14px 4px;
      text-align: center;
    }

    .empty-icon {
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      color: #ffffff;
      background: linear-gradient(135deg, var(--primary), var(--primary-2));
      box-shadow: 0 14px 28px rgba(124, 99, 223, 0.18);
      font-size: 1.35rem;
    }

    .empty-state strong {
      color: var(--text);
      font-size: 1.05rem;
      line-height: 1.15;
    }

    .empty-state-facts,
    .empty-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
    }

    .empty-state-facts span {
      padding: 3px 8px;
      border-radius: 999px;
      color: var(--muted);
      background: var(--surface-soft);
      font-size: 0.76rem;
      font-weight: 850;
    }

    .empty-state ion-button {
      min-height: 38px;
      margin: 0;
    }

    .empty-link {
      justify-self: center;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--primary);
      background: var(--surface);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 900;
      text-decoration: none;
      cursor: pointer;
    }

    .empty-link.secondary {
      color: var(--text);
    }

    .empty-state p {
      margin: 0;
      color: var(--muted);
      font-size: 0.8rem;
    }

    .salon-list {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .salon-row {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      padding: 10px 8px;
      border-radius: 14px;
      transition: background 160ms ease;
    }

    .salon-row.is-primary {
      background: rgba(124, 99, 223, 0.08);
      border: 1px solid rgba(124, 99, 223, 0.18);
    }

    @media (hover: hover) and (pointer: fine) {
      .salon-row:hover {
        background: rgba(124, 99, 223, 0.06);
      }
    }

    .salon-initials {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      color: var(--text);
      background: linear-gradient(135deg, var(--surface-soft), var(--surface-elevated));
      font-size: 0.82rem;
      font-weight: 1000;
    }

    .salon-initials.primary-badge {
      color: #FFFFFF;
      background: linear-gradient(135deg, var(--brand-600), var(--primary));
    }

    .salon-details {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .salon-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .salon-name {
      min-width: 0;
      color: var(--text);
      font-weight: 900;
      font-size: 0.92rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .primary-tag {
      flex-shrink: 0;
      padding: 2px 8px;
      border-radius: 999px;
      color: #FFFFFF;
      background: linear-gradient(135deg, var(--brand-600), var(--primary));
      font-size: 0.64rem;
      font-weight: 1000;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .salon-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .meta-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 7px;
      border-radius: 999px;
      color: var(--muted);
      background: rgba(124, 99, 223, 0.08);
      font-size: 0.72rem;
      font-weight: 800;
    }

    .meta-pill ion-icon {
      width: 11px;
      height: 11px;
    }

    .meta-pill.relationship[data-type="loyal"] {
      color: #8A74E6;
      background: rgba(15, 118, 110, 0.1);
    }

    .meta-pill.relationship[data-type="regular"] {
      color: var(--primary);
      background: var(--primary-soft);
    }

    .salon-actions {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 4px;
    }

    .salon-actions > :only-child {
      grid-column: 1 / -1;
    }

    .set-primary-btn,
    .remove-primary-btn,
    .enter-salon-btn {
      min-height: 38px;
      padding: 0 12px;
      border-radius: 12px;
      border: 1px solid rgba(124, 99, 223, 0.2);
      background: var(--glass);
      color: var(--text);
      display: inline-flex;
      align-items: center;
      place-items: center;
      justify-content: center;
      font: inherit;
      font-size: 0.76rem;
      font-weight: 950;
      text-decoration: none;
      cursor: pointer;
      transition: transform 140ms ease;
    }

    .enter-salon-btn,
    .set-primary-btn {
      color: #ffffff;
      border-color: transparent;
      background: linear-gradient(135deg, var(--primary), var(--primary-2));
      box-shadow: 0 10px 22px rgba(124, 99, 223, 0.18);
    }

    .remove-primary-btn {
      color: #b91c1c;
      border-color: rgba(185, 28, 28, 0.18);
      background: rgba(255, 241, 242, 0.88);
    }

    @media (hover: hover) and (pointer: fine) {
      .set-primary-btn:hover,
      .remove-primary-btn:hover,
      .enter-salon-btn:hover {
        transform: scale(1.08);
      }
    }
  `]
})
export class YourSalonsListComponent {
  @Input() salons: CustomerSalonRelationship[] = [];
  @Input() primarySalon: CustomerPrimarySalon | null = null;
  @Input() primarySalons: CustomerPrimarySalon[] = [];
  @Input() hasBookings = false;
  @Input() bookingCount = 0;
  @Input() favouriteCount = 0;
  @Output() setAsPrimary = new EventEmitter<CustomerSalonRelationship>();
  @Output() removePrimary = new EventEmitter<CustomerSalonRelationship>();
  @Output() addPrevious = new EventEmitter<void>();

  constructor() {
    addIcons({ checkmarkOutline, starOutline, storefrontOutline, swapHorizontalOutline, timeOutline });
  }

  salonModeLink(salon: CustomerSalonRelationship): string {
    return `/my-salon/${encodeURIComponent(salon.tenantId)}/${encodeURIComponent(salon.branchId)}`;
  }

  visibleSalons(): CustomerSalonRelationship[] {
    const rows = [...this.salons];
    for (const primary of this.primarySalons) {
      if (rows.some((salon) => salon.tenantId === primary.tenantId && salon.branchId === primary.branchId)) continue;
      rows.push({
        id: primary.id || `${primary.tenantId}:${primary.branchId}`,
        customerId: primary.customerId || "",
        tenantId: primary.tenantId,
        branchId: primary.branchId,
        businessId: primary.businessId,
        businessName: primary.businessName,
        relationshipType: "primary",
        visitCount: 0,
        lastVisitAt: "",
        isFavorite: 0,
        createdAt: primary.setAt || "",
        updatedAt: primary.setAt || ""
      });
    }
    return rows;
  }

  isPrimary(salon: CustomerSalonRelationship): boolean {
    return this.primarySalons.some((primary) => primary.tenantId === salon.tenantId && primary.branchId === salon.branchId)
      || (!!this.primarySalon && this.primarySalon.tenantId === salon.tenantId && this.primarySalon.branchId === salon.branchId);
  }

  salonInitials(name: string): string {
    if (!name) return "S";
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  formatRelationshipType(type: string): string {
    const map: Record<string, string> = { guest: "New", returning: "Returning", regular: "Regular", loyal: "Loyal" };
    return map[type] || type;
  }

  formatTimeAgo(iso: string): string {
    if (!iso) return "";
    const time = new Date(iso).getTime();
    if (!Number.isFinite(time)) return "";
    const diff = Date.now() - time;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }
}
