import { Component, OnInit, computed, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { IonButton, IonContent, IonIcon } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import {
  calendarOutline,
  callOutline,
  chevronForwardOutline,
  giftOutline,
  locationOutline,
  peopleOutline,
  receiptOutline,
  refreshOutline,
  ribbonOutline,
  searchOutline,
  sparklesOutline,
  starOutline,
  swapHorizontalOutline,
  timeOutline,
  walletOutline
} from "ionicons/icons";
import { MarketplaceService } from "../../core/marketplace.service";
import { AuthService } from "../../core/auth.service";
import { CustomerSalonRelationship, MySalonDashboard } from "../../core/api.types";

@Component({
  standalone: true,
  imports: [RouterLink, IonButton, IonContent, IonIcon],
  template: `
    <ion-content class="ms-content">
      <main class="ms-page">
        @if (!dash()?.salon) {
        <div class="ms-mode-tools" aria-label="My Salon page controls">
          @if (salonChoices().length > 1 || !dash()?.hasPrimarySalon) {
            <button
              type="button"
              class="ms-switch-button"
              (click)="toggleSalonPicker()"
              [attr.aria-expanded]="salonPickerOpen()"
              aria-controls="salon-picker">
              <ion-icon name="swap-horizontal-outline" aria-hidden="true"></ion-icon>
              <span>Switch Salon ({{ salonChoices().length }})</span>
            </button>
          } @else {
            <span class="ms-mode-tools-spacer" aria-hidden="true"></span>
          }
        </div>
        }

        <!-- ─── SALON PICKER DRAWER / MODAL ─── -->
        @if (salonPickerOpen()) {
          <section id="salon-picker" class="ms-picker" aria-labelledby="salon-picker-title">
            <div class="ms-picker-head">
              <div>
                <span class="ms-kicker">Multi-Salon Switcher</span>
                <h2 id="salon-picker-title">Select your active salon</h2>
              </div>
              <span class="ms-picker-count">{{ salonChoices().length }} connected</span>
            </div>
            <p class="ms-picker-note">
              Switching loads that salon's credit balance, loyalty points, active membership, package credits, Happy Hours offers and visit history for that specific salon.
            </p>

            @if (salonChoices().length) {
              <div class="ms-choice-list">
                @for (salon of salonChoices(); track salon.tenantId + ':' + salon.branchId) {
                  <button
                    type="button"
                    class="ms-choice"
                    [class.selected]="isSelectedSalon(salon)"
                    (click)="selectSalon(salon)"
                    [disabled]="selectingSalon()"
                    [attr.aria-pressed]="isSelectedSalon(salon)">
                    <span class="ms-choice-avatar" aria-hidden="true">{{ salonInitials(salon.businessName) }}</span>
                    <span class="ms-choice-copy">
                      <strong>{{ salon.businessName }}</strong>
                      <small>
                        {{ salonVisitLabel(salon) }}
                        @if (salon.lastVisitAt) { <span> · Last {{ formatDate(salon.lastVisitAt) }}</span> }
                      </small>
                    </span>
                    <span class="ms-choice-badge" [class.is-active]="isSelectedSalon(salon)">
                      {{ isSelectedSalon(salon) ? 'Active Salon' : 'Switch' }}
                    </span>
                  </button>
                }
              </div>
            } @else {
              <div class="ms-inline-empty">
                <p>You haven't visited or booked at another salon yet.</p>
                <button type="button" class="ms-text-action" (click)="exitSalonMode()">Exit My Salon</button>
              </div>
            }
          </section>
        }

        <!-- ─── LOADING STATE ─── -->
        @if (loading()) {
          <section class="ms-loading" aria-label="Loading salon dashboard" aria-live="polite" aria-busy="true">
            <div class="ms-skeleton ms-skeleton-hero" aria-hidden="true"></div>
            <div class="ms-skeleton-grid" aria-hidden="true">
              @for (item of [1, 2, 3, 4]; track item) { <div class="ms-skeleton"></div> }
            </div>
            <div class="ms-skeleton ms-skeleton-wide" aria-hidden="true"></div>
          </section>
        } 
        
        <!-- ─── ERROR STATE (only when there is nothing cached to show) ─── -->
        @else if (loadError() && !dash()) {
          <section class="ms-state" role="alert">
            <span class="ms-state-icon"><ion-icon name="refresh-outline" aria-hidden="true"></ion-icon></span>
            <span class="ms-kicker">Connection Error</span>
            <h1>Could not load salon data</h1>
            <p>{{ loadError() }}</p>
            <ion-button class="ms-primary-button" (click)="loadDashboard()">Retry Loading</ion-button>
          </section>
        } 
        
        <!-- ─── MAIN DASHBOARD CONTENT ─── -->
        @else if (dash(); as d) {
          @if (d.salon) {

            <!-- 1. SALON HERO HEADER CARD -->
            <section class="ms-hero" aria-labelledby="salon-title">
              <div class="ms-hero-main">
                <div class="ms-salon-mark" aria-hidden="true">
                  @if (d.salon.logoImage) {
                    <img [src]="d.salon.logoImage" [alt]="d.salon.name" class="ms-salon-mark-img" />
                  } @else {
                    <span>{{ salonInitials(d.salon.name) }}</span>
                  }
                </div>
                <div class="ms-hero-copy">
                  <span class="ms-kicker">Your Personal Salon Experience</span>
                  <h1 id="salon-title">{{ d.salon.name }}</h1>
                  
                  <div class="ms-status-line">
                    <span class="ms-status" [class.is-open]="d.salon.isOpen">
                      <span class="ms-dot" aria-hidden="true"></span>
                      {{ d.salon.isOpen ? 'Open Now' : 'Closed Now' }}
                    </span>
                    @if (d.salon.hoursLabel) {
                      <span class="ms-hours-chip"><ion-icon name="time-outline" aria-hidden="true"></ion-icon> {{ d.salon.hoursLabel }}</span>
                    }
                  </div>
                </div>
              </div>

              <div class="ms-contact-list">
                @if (d.salon.address || d.salon.city) {
                  <div class="ms-contact-item">
                    <ion-icon name="location-outline" aria-hidden="true"></ion-icon>
                    <span>
                      {{ d.salon.address }}
                      @if (d.salon.address && d.salon.city) { <span>, </span> }
                      {{ d.salon.city }}
                    </span>
                  </div>
                }
                @if (d.salon.phone) {
                  <a class="ms-contact-item ms-link" [href]="'tel:' + d.salon.phone">
                    <ion-icon name="call-outline" aria-hidden="true"></ion-icon>
                    <span>{{ d.salon.phone }}</span>
                  </a>
                }
                @if (safeRating(d.salon.ratingAverage, d.salon.ratingCount); as rating) {
                  <div class="ms-contact-item">
                    <ion-icon name="star-outline" class="ms-star-icon" aria-hidden="true"></ion-icon>
                    <span><strong>{{ rating }}</strong> · {{ d.salon.ratingCount }} verified customer reviews</span>
                  </div>
                }
              </div>

              <div class="ms-hero-actions">
                <a class="ms-profile-button" [routerLink]="salonProfileLink(d.salon)">
                  Explore Salon & Services
                  <ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>
                </a>
              </div>

              <div class="ms-hero-management" aria-label="My Salon management">
                @if (salonChoices().length > 1 || !d.hasPrimarySalon) {
                  <button
                    type="button"
                    class="ms-switch-button"
                    (click)="toggleSalonPicker()"
                    [attr.aria-expanded]="salonPickerOpen()"
                    aria-controls="salon-picker">
                    <ion-icon name="swap-horizontal-outline" aria-hidden="true"></ion-icon>
                    <span>Switch Salon ({{ salonChoices().length }})</span>
                  </button>
                }
              </div>
            </section>

            <!-- 2. RELATIONSHIP & ACCOUNT SNAPSHOT (4 METRICS) -->
            <section class="ms-section ms-relationship" aria-labelledby="relationship-title">
              <div class="ms-section-head">
                <div>
                  <span class="ms-kicker">Salon Relationship & Balances</span>
                  <h2 id="relationship-title">Your Account Snapshot</h2>
                </div>
                @if (d.relationship) {
                  <span class="ms-relationship-label">{{ relationshipLabel(d.relationship.type) }}</span>
                }
              </div>

              <div class="ms-snapshot">
                <!-- Membership -->
                <a [routerLink]="scopedLink('memberships')" class="ms-snapshot-item">
                  <div class="ms-snap-top">
                    <span>Membership</span>
                    <ion-icon name="ribbon-outline" aria-hidden="true"></ion-icon>
                  </div>
                  <strong>{{ d.membership?.planName || 'Not Enrolled' }}</strong>
                  <small>{{ d.membership ? safeCount(d.membership.creditsRemaining) + ' service credits left' : 'No active plan' }}</small>
                </a>

                <!-- Salon Credit -->
                <a [routerLink]="scopedLink('wallet')" class="ms-snapshot-item">
                  <div class="ms-snap-top">
                    <span>{{ shortSalonName(d.salon.name) }} credit</span>
                    <ion-icon name="wallet-outline" aria-hidden="true"></ion-icon>
                  </div>
                  <strong class="ms-currency">{{ d.wallet ? this.marketplace.formatMoney(d.wallet.balancePaise) : '—' }}</strong>
                  <small>{{ d.wallet ? walletTxCount(d.wallet) : 'No credits on record' }}</small>
                </a>

                <!-- Salon Loyalty Points -->
                <a [routerLink]="scopedLink('rewards')" class="ms-snapshot-item">
                  <div class="ms-snap-top">
                    <span>{{ d.loyalty?.tier || 'Salon loyalty' }}</span>
                    <ion-icon name="star-outline" aria-hidden="true"></ion-icon>
                  </div>
                  <strong>{{ d.loyalty ? formatNumber(d.loyalty.points) + ' pts' : '—' }}</strong>
                  <small>{{ d.loyalty ? 'Points for discounts' : 'Earn on every visit' }}</small>
                </a>

                <!-- Active Package Credits -->
                <a [routerLink]="scopedLink('packages')" class="ms-snapshot-item">
                  <div class="ms-snap-top">
                    <span>Package Credits</span>
                    <ion-icon name="gift-outline" aria-hidden="true"></ion-icon>
                  </div>
                  <strong>{{ d.packages.length ? packageCredits() + ' sessions' : 'No Package' }}</strong>
                  <small>{{ d.packages.length ? d.packages.length + ' active package' + (d.packages.length === 1 ? '' : 's') : 'Save on bundled visits' }}</small>
                </a>
              </div>
            </section>

            <!-- 4. UPCOMING APPOINTMENTS & REBOOKING CANDIDATE -->
            <section class="ms-section ms-schedule-section" aria-labelledby="upcoming-title">
              <div class="ms-section-head">
                <div>
                  <span class="ms-kicker">Schedule & Visits</span>
                  <h2 id="upcoming-title">Upcoming Appointment</h2>
                </div>
                <a [routerLink]="scopedLink('bookings')">View All Bookings</a>
              </div>

              @if (upcomingBooking(); as booking) {
                <article class="ms-appointment">
                  <div class="ms-date-tile" aria-hidden="true">
                    <span>{{ datePart(booking.startAt, 'month') }}</span>
                    <strong>{{ datePart(booking.startAt, 'day') }}</strong>
                  </div>
                  <div class="ms-appointment-copy">
                    <span class="ms-status-chip">{{ statusLabel(booking.status) }}</span>
                    <h3>{{ booking.serviceName }}</h3>
                    <p><ion-icon name="people-outline" aria-hidden="true"></ion-icon> {{ booking.staffName || 'Professional to be confirmed' }} · {{ formatTime(booking.startAt) }}</p>
                    @if (validPrice(booking.totalPricePaise)) {
                      <strong class="ms-price">{{ this.marketplace.formatMoney(booking.totalPricePaise) }}</strong>
                    }
                  </div>
                  <a class="ms-arrow-link" [routerLink]="scopedLink('bookings', booking.id)" aria-label="View appointment details">
                    <ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>
                  </a>
                </article>
              } @else {
                <div class="ms-empty-panel">
                  <span class="ms-empty-icon"><ion-icon name="calendar-outline" aria-hidden="true"></ion-icon></span>
                  <div>
                    <h3>No upcoming appointments</h3>
                    <p>Ready for a fresh haircut, facial, or styling session? Book a time at {{ d.salon.name }}.</p>
                  </div>
                  <a [routerLink]="salonBookLink(d.salon)">Book New Appointment</a>
                </div>
              }

              <!-- Rebook Candidate Banner -->
              @if (rebookCandidate(); as booking) {
                <div class="ms-rebook-card">
                  <div class="ms-rebook-info">
                    <span class="ms-rebook-tag">Quick Rebook</span>
                    <strong>{{ booking.serviceName }}</strong>
                    <small>With {{ booking.staffName || 'Salon Professional' }}</small>
                  </div>
                  <a class="ms-rebook-action" [routerLink]="salonBookLink(d.salon)">
                    Rebook Service <ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>
                  </a>
                </div>
              }
            </section>

            <!-- 5. HAPPY HOURS & SALON OFFERS -->
            <section class="ms-section ms-offers-section" aria-labelledby="offers-title">
              <div class="ms-section-head">
                <div>
                  <span class="ms-kicker">Happy Hours & Savings</span>
                  <h2 id="offers-title">Exclusive Salon Offers</h2>
                </div>
                <a [routerLink]="scopedLink()">All Offers</a>
              </div>

              @if (d.offers.length) {
                <div class="ms-offer-rail" aria-label="Salon offers carousel">
                  @for (offer of d.offers; track offer.id) {
                    <article class="ms-offer">
                      <span class="ms-offer-value">{{ offerDiscount(offer.discountType, offer.discountValue) }}</span>
                      <h3>{{ offer.title }}</h3>
                      @if (offer.description) { <p>{{ offer.description }}</p> }
                      <div class="ms-offer-footer">
                        <small>Valid {{ formatDate(offer.validFrom) }} – {{ formatDate(offer.validTo) }}</small>
                        <a class="ms-offer-book" [routerLink]="salonBookLink(d.salon)">Claim Offer</a>
                      </div>
                    </article>
                  }
                </div>
              } @else {
                <div class="ms-empty-line">
                  <span>No active Happy Hours or offers for this salon today.</span>
                  <a [routerLink]="scopedLink()">Check Public Coupons</a>
                </div>
              }
            </section>

            <!-- 6. FEATURED SERVICES & PRICING MENU -->
            <section class="ms-section ms-services-section" aria-labelledby="services-title">
              <div class="ms-section-head">
                <div>
                  <span class="ms-kicker">Salon Menu</span>
                  <h2 id="services-title">{{ serviceQuery().trim() ? 'Search results' : 'Top Recommended' }}</h2>
                </div>
                <a [routerLink]="salonProfileLink(d.salon)">Full Menu</a>
              </div>

              @if (topRecommendedServices().length) {
                <div class="ms-service-list">
                  @for (service of topRecommendedServices(); track service.id) {
                    <div class="ms-service">
                      <span class="ms-service-index" aria-hidden="true">{{ serviceIndex($index) }}</span>
                      <div class="ms-service-copy">
                        <strong>{{ service.name }}</strong>
                        <small>{{ service.category || 'Salon Service' }} · {{ safeDuration(service.durationMinutes) }}</small>
                      </div>
                      <div class="ms-service-right">
                        <span class="ms-service-price">{{ this.marketplace.formatMoney(service.pricePaise) }}</span>
                        <a class="ms-service-book-btn" [routerLink]="salonBookLink(d.salon)" [queryParams]="{ detailServiceId: service.id, step: '1' }">Book</a>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="ms-empty-line">
                  <span>{{ serviceQuery().trim() ? 'No services match your search.' : 'No services available for this category.' }}</span>
                  <a [routerLink]="salonProfileLink(d.salon)">View Profile</a>
                </div>
              }
            </section>

            <!-- 7. STAFF MEMBERS & AVAILABILITY -->
            <section class="ms-section ms-team-section" aria-labelledby="staff-title">
              <div class="ms-section-head">
                <div>
                  <span class="ms-kicker">Our Professionals</span>
                  <h2 id="staff-title">Salon Team</h2>
                </div>
                <a [routerLink]="salonBookLink(d.salon)">Check Availability</a>
              </div>

              @if (d.staff.length) {
                <div class="ms-staff-rail" aria-label="Salon team carousel">
                  @for (staff of d.staff; track staff.id) {
                    <a class="ms-staff" [routerLink]="salonBookLink(d.salon)">
                      <span class="ms-staff-avatar" aria-hidden="true">{{ staffInitials(staff.name) }}</span>
                      <strong>{{ staff.name }}</strong>
                      <small>{{ staff.specialty || staff.title || 'Salon Specialist' }}</small>
                      <span class="ms-staff-action">Book with {{ staff.name.split(' ')[0] }}</span>
                    </a>
                  }
                </div>
              } @else {
                <div class="ms-empty-line">
                  <span>Staff profiles are not published for this salon yet.</span>
                </div>
              }
            </section>

            <!-- 8. ACTIVE BENEFITS & PACKAGES -->
            @if (d.packages.length || d.membership) {
              <section class="ms-section" aria-labelledby="active-benefits-title">
                <div class="ms-section-head">
                  <div>
                    <span class="ms-kicker">Subscribed Perks</span>
                    <h2 id="active-benefits-title">Active Membership & Packages</h2>
                  </div>
                </div>

                <div class="ms-benefit-grid">
                  @if (d.membership) {
                    <article class="ms-benefit ms-membership">
                      <span class="ms-benefit-chip">{{ statusLabel(d.membership.status) }}</span>
                      <h3>{{ d.membership.planName }}</h3>
                      <strong>{{ safeCount(d.membership.creditsRemaining) }} credits remaining</strong>
                      <small>Valid through {{ formatDate(d.membership.validityDate) }}</small>
                    </article>
                  }
                  @for (pkg of d.packages; track pkg.id) {
                    <article class="ms-benefit">
                      <span class="ms-benefit-chip ms-pkg-chip">Package</span>
                      <h3>{{ pkg.name }}</h3>
                      <strong>{{ remainingSessions(pkg.sessionsTotal, pkg.sessionsUsed) }} of {{ safeCount(pkg.sessionsTotal) }} sessions left</strong>
                      <div class="ms-progress" role="progressbar" [attr.aria-label]="pkg.name + ' usage'" [attr.aria-valuemin]="0" [attr.aria-valuemax]="safeCount(pkg.sessionsTotal)" [attr.aria-valuenow]="safeCount(pkg.sessionsUsed)">
                        <span [style.width.%]="packageProgress(pkg.sessionsTotal, pkg.sessionsUsed)"></span>
                      </div>
                    </article>
                  }
                </div>
              </section>
            }

            <!-- 9. SALON WALLET & GIFT CARDS SECTION -->
            @if (d.wallet || (d.giftCards && d.giftCards.length)) {
              <section class="ms-section ms-wallet-section" aria-labelledby="wallet-title">
                <div class="ms-section-head">
                  <div>
                    <span class="ms-kicker">Prepaid & Gift Balances</span>
                    <h2 id="wallet-title">Salon Wallet & Gift Cards</h2>
                  </div>
                  <a [routerLink]="scopedLink('wallet')">Manage Wallet</a>
                </div>

                <div class="ms-wallet-container">
                  @if (d.wallet) {
                    <div class="ms-wallet-card">
                      <div class="ms-wallet-top">
                        <span>Salon Wallet Balance</span>
                        <strong class="ms-wallet-amount">{{ this.marketplace.formatMoney(d.wallet.balancePaise) }}</strong>
                      </div>
                      @if (d.wallet.transactions.length) {
                        <div class="ms-tx-list">
                          <small class="ms-tx-head">Recent Wallet Transactions</small>
                          @for (tx of d.wallet.transactions.slice(0, 3); track tx.id) {
                            <div class="ms-tx-item">
                              <span>{{ tx.notes || tx.description || tx.type }}</span>
                              <strong [class.is-credit]="tx.amountPaise > 0">{{ this.marketplace.formatMoney(tx.amountPaise) }}</strong>
                            </div>
                          }
                        </div>
                      } @else {
                        <p class="ms-wallet-hint">Use wallet balance for 1-click payment at venue or booking online.</p>
                      }
                    </div>
                  }

                  @if (d.giftCards && d.giftCards.length) {
                    <div class="ms-gift-cards-list">
                      @for (card of d.giftCards; track card.id) {
                        <div class="ms-gift-card">
                          <ion-icon name="gift-outline" aria-hidden="true"></ion-icon>
                          <div>
                            <strong>Card Code: {{ card.code }}</strong>
                            <small>Balance: {{ this.marketplace.formatMoney(card.balancePaise) }} · Exp {{ formatDate(card.expiryDate) }}</small>
                          </div>
                          <span class="ms-gift-status">{{ card.status }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              </section>
            }

            <!-- 10. VISIT & SERVICE HISTORY -->
            <section class="ms-section ms-history-section" aria-labelledby="history-title">
              <div class="ms-section-head">
                <div>
                  <span class="ms-kicker">Past Experience</span>
                  <h2 id="history-title">Visit History</h2>
                </div>
                <a [routerLink]="scopedLink('bookings')" [queryParams]="{ tab: 'past', view: 'history' }">Full History</a>
              </div>

              @if (visitHistory(d); as visits) {
                @if (visits.length) {
                  <div class="ms-history-list">
                    @for (booking of visits; track booking.id) {
                    <a [routerLink]="scopedLink('invoices')" [queryParams]="historyInvoiceParams(booking)" class="ms-history-item">
                      <span class="ms-history-date">{{ formatDate(booking.startAt) }}</span>
                      <div class="ms-history-copy">
                        <strong>{{ booking.serviceName }}</strong>
                        <small>{{ booking.staffName || 'Salon Professional' }} · {{ statusLabel(booking.status) }}</small>
                      </div>
                      @if (validHistoryPrice(booking.totalPricePaise)) {
                        <strong class="ms-history-price">{{ this.marketplace.formatMoney(booking.totalPricePaise) }}</strong>
                      }
                      <ion-icon name="chevron-forward-outline" aria-hidden="true"></ion-icon>
                    </a>
                    }
                  </div>
                } @else {
                  <div class="ms-empty-line">
                    <span>Your visit history at this salon will appear here after your first appointment.</span>
                  </div>
                }
              } @else {
                <div class="ms-empty-line">
                  <span>Your visit history at this salon will appear here after your first appointment.</span>
                </div>
              }
            </section>

            <!-- 11. INVOICES & PAYMENTS SUMMARY -->
            @if (d.invoices && d.invoices.length) {
              <section class="ms-section" aria-labelledby="invoices-title">
                <div class="ms-section-head">
                  <div>
                    <span class="ms-kicker">Billing & Receipts</span>
                    <h2 id="invoices-title">Invoices & Payments</h2>
                  </div>
                  <a [routerLink]="scopedLink('invoices')">View All Invoices</a>
                </div>

                <div class="ms-invoice-list">
                  @for (inv of d.invoices; track inv.id) {
                    <a [routerLink]="scopedLink('invoices')" class="ms-invoice-item">
                      <ion-icon name="receipt-outline" aria-hidden="true"></ion-icon>
                      <div class="ms-invoice-copy">
                        <strong>Invoice #{{ inv.invoiceNumber }}</strong>
                        <small>{{ formatDate(inv.createdAt) }}</small>
                      </div>
                      <div class="ms-invoice-right">
                        <strong>{{ this.marketplace.formatMoney(inv.totalPaise) }}</strong>
                        <span class="ms-inv-status">{{ inv.status }}</span>
                      </div>
                    </a>
                  }
                </div>
              </section>
            }

          } @else {
            <!-- ONBOARDING STATE: NO PRIMARY SALON SELECTED -->
            <section class="ms-state ms-onboarding-state">
              <span class="ms-state-icon"><ion-icon name="sparkles-outline" aria-hidden="true"></ion-icon></span>
              <span class="ms-kicker">Personalized Salon Space</span>
              <h1>Choose Your Active Salon</h1>
              <p>
                Select a salon you have visited or booked with. Your membership, wallet, loyalty points, package credits, Happy Hours offers and history will automatically load for that salon.
              </p>
              @if (salonChoices().length) {
                <div class="ms-onboarding-copy">
                  <strong>Choose from your past salons</strong>
                  <small>You can switch again later if you have multiple salons.</small>
                </div>
                <div class="ms-choice-list">
                  @for (salon of salonChoices(); track salon.tenantId + ':' + salon.branchId) {
                    <button type="button" class="ms-choice" (click)="selectSalon(salon)" [disabled]="selectingSalon()">
                      <span class="ms-choice-avatar" aria-hidden="true">{{ salonInitials(salon.businessName) }}</span>
                      <span class="ms-choice-copy">
                        <strong>{{ salon.businessName }}</strong>
                        <small>{{ salonVisitLabel(salon) }}</small>
                      </span>
                      <span class="ms-choice-badge">Set My Salon</span>
                    </button>
                  }
                </div>
                <div class="ms-onboarding-actions">
                  <button type="button" class="ms-outline-button" (click)="openSalonSearch()">Find New Salon</button>
                  <button type="button" class="ms-outline-button" (click)="exitSalonMode()">Exit My Salon</button>
                </div>
              } @else {
                <div class="ms-onboarding-copy">
                  <strong>No past salons found</strong>
                  <small>Find a salon, open its profile, and set it as My Salon.</small>
                </div>
                <div class="ms-onboarding-actions">
                  <ion-button class="ms-primary-button" (click)="openSalonSearch()">Find New Salon</ion-button>
                  <button type="button" class="ms-outline-button" (click)="exitSalonMode()">Exit My Salon</button>
                </div>
              }
            </section>
          }
        }
      </main>
    </ion-content>
  `,
  styles: [`
    :host {
      --ms-ink: var(--text, #1C1C1C);
      --ms-muted: var(--muted, #696969);
      --ms-ivory: var(--surface, #FFFFFF);
      --ms-line: var(--border, #E8E8E8);
      --ms-emerald: #10b981;
      --ms-rose: #f43f5e;
      --ms-accent: #7c63df;
      --ms-accent-soft: #e1d6fb;
      --ms-radius-card: 22px;
      --ms-radius-item: 18px;
      --ms-elevation: 0 14px 36px rgba(28, 28, 28, 0.07);
      --ms-elevation-soft: 0 8px 22px rgba(28, 28, 28, 0.05);
      --ms-gap: 12px;
      --ms-card-padding: 18px;
      --ms-item-padding: 12px;
      --ms-button-height: 46px;
      --ms-motion: 180ms ease;
      --ms-focus-ring: color-mix(in srgb, var(--ms-accent) 70%, white);
      --ms-type-label: 0.72rem;
      --ms-type-small: 0.76rem;
      --ms-type-body: 0.84rem;
      --ms-type-title: 0.96rem;
      --ms-lh-tight: 1.18;
      --ms-lh-body: 1.45;
    }
    .ms-content {
      --background: var(--customer-bg-premium, #FFFFFF);
    }
    .ms-page {
      width: min(100%, 1120px);
      min-height: 100%;
      margin: 0 auto;
      padding: calc(58px + env(safe-area-inset-top)) 16px calc(88px + var(--safe-bottom));
      color: var(--ms-ink);
      overflow-x: clip;
    }
    .ms-page *, .ms-page *::before, .ms-page *::after { box-sizing: border-box; }
    .ms-page a, .ms-page button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    .ms-page a:focus-visible, .ms-page button:focus-visible, .ms-primary-button:focus-visible {
      outline: 2px solid var(--ms-focus-ring);
      outline-offset: 3px;
    }
    .ms-mode-tools {
      position: relative;
      z-index: 15;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
      min-height: 44px;
      margin-bottom: 12px;
    }
    .ms-switch-button {
      min-width: 44px;
      min-height: 44px;
      border: 1px solid var(--ms-line);
      border-radius: 999px;
      color: var(--ms-ink);
      background: var(--ms-ivory);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .ms-switch-button { gap: 6px; max-width: 100%; padding: 0 12px; font: inherit; font-size: .74rem; font-weight: 750; white-space: nowrap; transition: background-color var(--ms-motion), border-color var(--ms-motion), transform var(--ms-motion); }
    .ms-switch-button:active { transform: scale(.98); }
    .ms-switch-button ion-icon { font-size: 17px; color: var(--ms-accent); }
    .ms-remove-primary-button { color: var(--ms-rose); border-color: color-mix(in srgb, var(--ms-rose) 28%, var(--ms-line)); }
    .ms-remove-primary-button ion-icon { color: var(--ms-rose); }
    @media (max-width: 420px) {
      .ms-mode-tools { justify-content: center; }
      .ms-mode-tools .ms-switch-button { flex: 1 1 calc(50% - 4px); min-width: 0; }
      .ms-mode-tools-spacer { display: none; }
    }
    .ms-mode-tools-spacer { width: 44px; min-height: 44px; }
    .ms-kicker { color: var(--ms-accent); font-size: .72rem; font-weight: 800; letter-spacing: .01em; }
    .ms-section { display: grid; gap: 14px; margin-top: 36px; }

    .ms-section-head, .ms-picker-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
    .ms-section-head > div, .ms-picker-head > div { display: grid; gap: 4px; }
    .ms-section-head h2, .ms-picker-head h2 { margin: 0; color: var(--ms-ink); font-size: clamp(1.35rem, 5vw, 1.8rem); font-weight: 700; letter-spacing: -.035em; line-height: 1.1; }
    .ms-section-head > a { min-height: 44px; color: var(--ms-accent); display: inline-flex; align-items: center; font-size: .8rem; font-weight: 760; text-decoration: none; }
    .ms-picker-count { color: var(--ms-accent); font-size: .78rem; font-weight: 760; }

    /* Picker Drawer */
    .ms-picker { position: relative; z-index: 15; display: grid; gap: 14px; margin: 10px 0 18px; padding: 20px; border: 1px solid var(--ms-line); border-radius: 24px; background: var(--ms-ivory); box-shadow: 0 18px 44px rgba(28,28,28,.08); }
    .ms-picker-note { margin: 0; color: var(--ms-muted); font-size: .78rem; line-height: 1.45; }
    .ms-text-action { width: fit-content; border: 0; color: var(--ms-accent); background: transparent; font-weight: 900; text-decoration: underline; cursor: pointer; }
    .ms-choice-list { display: grid; gap: 8px; width: 100%; }
    .ms-choice { width: 100%; min-height: 64px; display: grid; grid-template-columns: 46px minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 10px; border: 1px solid var(--ms-line); border-radius: 18px; color: var(--ms-ink); background: var(--ms-ivory); font: inherit; text-align: left; cursor: pointer; transition: background-color var(--ms-motion), border-color var(--ms-motion), box-shadow var(--ms-motion), transform var(--ms-motion); }
    .ms-choice.selected { border-color: var(--ms-accent); background: var(--ms-accent-soft); box-shadow: 0 4px 14px rgba(0,0,0,.04); }
    .ms-choice:disabled { cursor: wait; opacity: .55; }
    .ms-choice:active { transform: scale(.995); }
    .ms-choice-avatar, .ms-salon-mark, .ms-staff-avatar { display: grid; place-items: center; color: white; background: var(--ms-accent); font-weight: 780; letter-spacing: -.03em; }
    .ms-choice-avatar { width: 46px; height: 46px; border-radius: 16px; font-size: .84rem; }
    .ms-choice-copy { min-width: 0; display: grid; gap: 3px; }
    .ms-choice-copy strong, .ms-choice-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ms-choice-copy strong { font-size: .9rem; }
    .ms-choice-copy small { color: var(--ms-muted); font-size: .72rem; }
    .ms-choice-badge { padding: 6px 12px; border-radius: 999px; color: var(--ms-muted); background: #eee; font-size: .72rem; font-weight: 760; }
    .ms-choice-badge.is-active { color: white; background: var(--ms-accent); }

    /* Salon Hero Card */
    .ms-hero { position: relative; overflow: hidden; display: grid; gap: 14px; margin-top: 0; padding: 18px 16px 16px; border: 1px solid var(--ms-line); border-radius: 22px; color: var(--ms-ink); background: var(--surface); box-shadow: 0 10px 28px rgba(28,28,28,.06); }
    .ms-hero-main { position: relative; z-index: 1; display: grid; grid-template-columns: 62px minmax(0,1fr); align-items: center; gap: 14px; }
    .ms-salon-mark { width: 62px; height: 62px; overflow: hidden; border: 1px solid var(--ms-line); border-radius: 20px; box-shadow: inset 0 1px rgba(255,255,255,.25); }
    .ms-salon-mark-img { width: 100%; height: 100%; object-fit: cover; }
    .ms-hero-copy { min-width: 0; display: grid; gap: 4px; }
    .ms-hero .ms-kicker { color: var(--ms-accent); }
    .ms-hero h1 { margin: 0; overflow-wrap: anywhere; font-size: clamp(1.75rem, 7vw, 2.5rem); font-weight: 700; letter-spacing: -.04em; line-height: 1.02; }
    .ms-status-line { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: var(--ms-muted); font-size: .75rem; margin-top: 2px; }
    .ms-status { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; }
    .ms-dot { width: 8px; height: 8px; border-radius: 50%; background: #f43f5e; box-shadow: 0 0 0 3px rgba(244,63,94,.2); }
    .ms-status.is-open .ms-dot { background: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.25); }
    .ms-hours-chip { display: inline-flex; align-items: center; gap: 4px; color: var(--ms-muted); font-size: .74rem; }
    .ms-contact-list { position: relative; z-index: 1; display: grid; gap: 8px; }
    .ms-contact-item { min-width: 0; display: flex; align-items: flex-start; gap: 10px; color: var(--ms-muted); font-size: .8rem; line-height: 1.4; text-decoration: none; }
    .ms-contact-item.ms-link:hover { color: var(--ms-accent); }
    .ms-contact-item ion-icon { flex: 0 0 16px; margin-top: 2px; color: var(--ms-accent); font-size: 17px; }
    .ms-star-icon { color: #f59e0b !important; }
    .ms-hero-actions { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr; gap: 8px; }
    .ms-profile-button { min-height: 44px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-size: .82rem; font-weight: 820; text-decoration: none; transition: background-color var(--ms-motion), border-color var(--ms-motion), box-shadow var(--ms-motion), transform var(--ms-motion); }
    .ms-profile-button { border: 1px solid rgba(124, 99, 223, .16); color: var(--ms-ink); background: linear-gradient(180deg, #fff, rgba(250, 248, 255, .86)); box-shadow: inset 0 1px rgba(255,255,255,.86), 0 8px 18px rgba(28,28,28,.04); }
    .ms-profile-button ion-icon { width: 18px; height: 18px; display: grid; place-items: center; margin-right: -4px; color: var(--ms-accent); }
    .ms-hero-management { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .ms-hero-management .ms-switch-button { flex: 1 1 150px; min-width: 0; }

    /* Relationship Snapshot Cards */
    .ms-relationship { margin-top: 28px; }
    .ms-relationship-label { padding: 6px 12px; border-radius: 999px; color: var(--ms-accent); background: var(--ms-accent-soft); font-size: .74rem; font-weight: 780; text-transform: capitalize; }
    .ms-snapshot { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin-top: 0; }
    .ms-snapshot-item { min-width: 0; min-height: 82px; display: grid; align-content: space-between; gap: 3px; padding: 10px 11px; border: 1px solid rgba(124, 99, 223, .12); border-radius: 17px; color: inherit; background: linear-gradient(145deg, #fff, rgba(250, 248, 255, .72)); text-decoration: none; box-shadow: inset 0 1px rgba(255,255,255,.9), 0 6px 16px rgba(28,28,28,.035); transition: transform var(--ms-motion), box-shadow var(--ms-motion), border-color var(--ms-motion), background-color var(--ms-motion); }
    .ms-snapshot-item:hover { transform: translateY(-2px); border-color: rgba(124, 99, 223, .28); box-shadow: 0 10px 24px rgba(95,70,207,.08); }
    .ms-snap-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--ms-muted); font-size: .62rem; font-weight: 820; letter-spacing: .005em; }
    .ms-snap-top span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ms-snap-top ion-icon { flex: 0 0 auto; width: 22px; height: 22px; padding: 4px; border-radius: 8px; color: var(--ms-accent); background: rgba(124, 99, 223, .08); font-size: 14px; }
    .ms-snapshot-item strong { overflow: hidden; font-size: .98rem; letter-spacing: -.03em; line-height: 1.08; text-overflow: ellipsis; white-space: nowrap; }
    .ms-snapshot-item small { color: var(--ms-muted); font-size: .63rem; line-height: 1.16; }
    .ms-currency { color: var(--ms-accent); }

    /* Appointments & Rebooking */
    .ms-appointment { display: grid; grid-template-columns: 60px minmax(0,1fr) 44px; align-items: center; gap: 14px; padding: 18px 14px 18px 18px; border: 1px solid color-mix(in srgb, var(--ms-accent) 24%, var(--ms-line)); border-radius: 22px; background: var(--surface); box-shadow: 0 14px 36px rgba(28,28,28,.06); }
    .ms-date-tile { width: 60px; height: 70px; display: grid; place-items: center; align-content: center; border-radius: 18px; color: #fff; background: var(--ms-accent); }
    .ms-date-tile span { font-size: .68rem; font-weight: 800; letter-spacing: .01em; }
    .ms-date-tile strong { font-size: 1.6rem; line-height: 1; }
    .ms-appointment-copy { min-width: 0; display: grid; gap: 4px; }
    .ms-status-chip { width: max-content; color: var(--ms-accent); font-size: .72rem; font-weight: 800; letter-spacing: .01em; }
    .ms-appointment h3, .ms-empty-panel h3 { margin: 0; font-size: 1.05rem; letter-spacing: -.02em; }
    .ms-appointment p, .ms-empty-panel p { margin: 0; color: var(--ms-muted); font-size: .75rem; line-height: 1.35; display: flex; align-items: center; gap: 5px; }
    .ms-price { font-size: .84rem; color: var(--ms-accent); }
    .ms-arrow-link { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; color: var(--ms-ink); background: #f4f1ec; text-decoration: none; }
    .ms-empty-panel { display: grid; grid-template-columns: 48px minmax(0,1fr); gap: 14px; padding: 20px; border: 1px dashed rgba(36,32,29,.2); border-radius: 22px; background: var(--ms-ivory); }
    .ms-empty-icon { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 16px; color: var(--ms-accent); background: var(--ms-accent-soft); font-size: 22px; }
    .ms-empty-panel > a { grid-column: 1 / -1; min-height: 46px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; color: white; background: var(--ms-accent); font-size: .82rem; font-weight: 780; text-decoration: none; }
    
    .ms-rebook-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border: 1px solid var(--ms-line); border-radius: 18px; background: var(--ms-ivory); }
    .ms-rebook-info { display: grid; gap: 2px; }
    .ms-rebook-tag { color: var(--ms-accent); font-size: .72rem; font-weight: 800; letter-spacing: .01em; }
    .ms-rebook-info strong { font-size: .86rem; }
    .ms-rebook-info small { color: var(--ms-muted); font-size: .7rem; }
    .ms-rebook-action { min-height: 38px; padding: 0 14px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; color: var(--ms-accent); background: var(--ms-accent-soft); font-size: .76rem; font-weight: 780; text-decoration: none; }

    /* Happy Hours & Offers Rail */
    .ms-offer-rail, .ms-staff-rail { display: grid; grid-auto-flow: column; overflow-x: auto; overscroll-behavior-inline: contain; scrollbar-width: none; scroll-padding-inline: 16px; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; contain: layout style; }
    .ms-offer-rail::-webkit-scrollbar, .ms-staff-rail::-webkit-scrollbar { display: none; }
    .ms-offer-rail { grid-auto-columns: minmax(260px, 82vw); gap: 12px; margin-inline: -16px; padding: 2px 16px 8px; }
    .ms-offer { min-height: 180px; scroll-snap-align: start; display: grid; align-content: space-between; gap: 8px; padding: 20px; border: 1px solid var(--ms-line); border-radius: 24px; color: var(--ms-ink); background: var(--surface); box-shadow: 0 12px 30px rgba(28,28,28,.06); }
    .ms-offer:nth-child(even) { color: var(--ms-ink); background: var(--ms-accent-soft); box-shadow: none; }
    .ms-offer-value { width: max-content; padding: 5px 10px; border: 1px solid currentColor; border-radius: 999px; font-size: .66rem; font-weight: 850; }
    .ms-offer h3 { margin: 4px 0 0; font-size: 1.15rem; letter-spacing: -.03em; }
    .ms-offer p { display: -webkit-box; margin: 0; overflow: hidden; font-size: .78rem; line-height: 1.4; opacity: .88; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .ms-offer-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; }
    .ms-offer-footer small { font-size: .68rem; opacity: .8; }
    .ms-offer-book { padding: 6px 12px; border-radius: 999px; color: var(--ms-ink); background: var(--surface); font-size: .72rem; font-weight: 780; text-decoration: none; }
    .ms-empty-line { min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; border: 1px solid var(--ms-line); border-radius: 18px; background: var(--ms-ivory); color: var(--ms-muted); font-size: .8rem; }
    .ms-empty-line a { color: var(--ms-accent); font-weight: 760; text-decoration: none; }

    .ms-service-list { display: grid; gap: 8px; border-top: 1px solid var(--ms-line); }
    .ms-service-search { position: sticky; top: calc(64px + env(safe-area-inset-top)); z-index: 15; display: flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 14px; border: 1px solid var(--ms-line); border-radius: 16px; background: var(--surface); box-shadow: 0 6px 18px rgba(28,28,28,.05); }
    .ms-service-search ion-icon { flex: 0 0 auto; color: var(--ms-muted); font-size: 18px; }
    .ms-service-search input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--ms-ink); font: inherit; font-size: .86rem; }
    .ms-service-search input::placeholder { color: var(--ms-muted); }
    .ms-service { min-height: 68px; display: grid; grid-template-columns: 28px minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--ms-line); color: inherit; }
    .ms-service-index { color: var(--ms-accent); font-size: .72rem; font-weight: 800; }
    .ms-service-copy { min-width: 0; display: grid; gap: 3px; }
    .ms-service-copy strong { overflow: hidden; font-size: .9rem; text-overflow: ellipsis; white-space: nowrap; }
    .ms-service-copy small { overflow: hidden; color: var(--ms-muted); font-size: .7rem; text-overflow: ellipsis; white-space: nowrap; }
    .ms-service-right { display: flex; align-items: center; gap: 10px; }
    .ms-service-price { font-size: .84rem; font-weight: 780; color: var(--ms-ink); }
    .ms-service-book-btn { min-width: 46px; min-height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 0 12px; border: 1px solid rgba(255,255,255,.26); border-radius: 999px; color: #fff; background: var(--ms-accent); box-shadow: 0 8px 18px rgba(95,70,207,.22), inset 0 1px rgba(255,255,255,.22); font-size: .68rem; font-weight: 850; line-height: 1; text-decoration: none; }

    /* Staff Rail */
    .ms-staff-rail { grid-auto-columns: 118px; gap: 8px; margin-inline: -16px; padding: 2px 16px 8px; }
    .ms-staff { min-height: 142px; scroll-snap-align: start; display: grid; justify-items: center; align-content: space-between; gap: 4px; padding: 12px 8px; border: 1px solid rgba(225,214,251,.72); border-radius: 18px; color: inherit; background: linear-gradient(180deg, #fff, rgba(225,214,251,.16)); text-align: center; text-decoration: none; transition: transform var(--ms-motion), border-color var(--ms-motion), box-shadow var(--ms-motion); }
    .ms-staff:hover { transform: translateY(-2px); }
    .ms-staff-avatar { width: 44px; height: 44px; border-radius: 16px; font-size: .78rem; }
    .ms-staff strong, .ms-staff small { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
    .ms-staff strong { display: -webkit-box; font-size: .74rem; line-height: 1.12; -webkit-line-clamp: 2; -webkit-box-orient: vertical; white-space: normal; }
    .ms-staff small { white-space: nowrap; }
    .ms-staff small { color: var(--ms-muted); font-size: .62rem; }
    .ms-staff-action { max-width: 100%; padding: 4px 8px; overflow: hidden; border-radius: 999px; color: var(--ms-accent); background: var(--ms-accent-soft); font-size: .6rem; font-weight: 780; text-overflow: ellipsis; white-space: nowrap; }

    /* Benefits Grid */
    .ms-benefit-grid { display: grid; gap: 12px; }
    .ms-benefit { min-height: 148px; display: grid; align-content: start; gap: 6px; padding: 20px; border: 1px solid var(--ms-line); border-radius: 24px; background: var(--ms-ivory); }
    .ms-benefit.ms-membership { color: var(--ms-ink); border-color: var(--ms-line); background: var(--surface); }
    .ms-benefit-chip { width: max-content; padding: 4px 10px; border-radius: 999px; color: var(--ms-accent); background: var(--ms-accent-soft); font-size: .72rem; font-weight: 800; letter-spacing: .01em; }
    .ms-pkg-chip { color: #3b82f6; background: #eff6ff; }
    .ms-benefit h3 { margin: 4px 0 0; font-size: 1.05rem; }
    .ms-benefit > strong { font-size: .8rem; }
    .ms-benefit > small { color: var(--ms-muted); font-size: .7rem; }
    .ms-membership > small { color: var(--ms-muted); }
    .ms-progress { height: 6px; margin-top: 8px; overflow: hidden; border-radius: 999px; background: rgba(36,32,29,.1); }
    .ms-progress span { display: block; height: 100%; border-radius: inherit; background: var(--ms-accent); transition: width .4s ease; }

    /* Wallet & Gift Cards */
    .ms-wallet-container { display: grid; gap: 12px; }
    .ms-wallet-card { padding: 20px; border: 1px solid var(--ms-line); border-radius: 24px; background: var(--surface); box-shadow: 0 10px 30px rgba(0,0,0,.04); }
    .ms-wallet-top { display: flex; align-items: center; justify-content: space-between; }
    .ms-wallet-top span { color: var(--ms-muted); font-size: .76rem; font-weight: 750; letter-spacing: .01em; }
    .ms-wallet-amount { font-size: 1.5rem; color: var(--ms-accent); font-weight: 800; }
    .ms-wallet-hint { margin: 10px 0 0; color: var(--ms-muted); font-size: .76rem; }
    .ms-tx-list { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--ms-line); display: grid; gap: 8px; }
    .ms-tx-head { color: var(--ms-muted); font-size: .72rem; font-weight: 780; letter-spacing: .01em; }
    .ms-tx-item { display: flex; align-items: center; justify-content: space-between; font-size: .78rem; }
    .ms-tx-item strong.is-credit { color: var(--ms-emerald); }

    .ms-gift-cards-list { display: grid; gap: 8px; }
    .ms-gift-card { display: grid; grid-template-columns: 36px minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--ms-line); border-radius: 18px; background: var(--ms-ivory); }
    .ms-gift-card ion-icon { color: var(--ms-accent); font-size: 22px; }
    .ms-gift-card strong { display: block; font-size: .84rem; }
    .ms-gift-card small { color: var(--ms-muted); font-size: .7rem; }
    .ms-gift-status { padding: 4px 8px; border-radius: 999px; background: var(--ms-accent-soft); color: var(--ms-accent); font-size: .72rem; font-weight: 800; letter-spacing: .01em; }

    /* History & Invoices */
    .ms-history-list, .ms-invoice-list { display: grid; gap: 6px; border-top: 1px solid var(--ms-line); }
    .ms-history-item, .ms-invoice-item { min-height: 66px; display: grid; grid-template-columns: 50px minmax(0,1fr) auto 18px; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid var(--ms-line); color: inherit; text-decoration: none; }
    .ms-history-date { color: var(--ms-muted); font-size: .7rem; font-weight: 740; }
    .ms-history-copy, .ms-invoice-copy { min-width: 0; display: grid; gap: 3px; }
    .ms-history-copy strong, .ms-invoice-copy strong { overflow: hidden; font-size: .84rem; text-overflow: ellipsis; white-space: nowrap; }
    .ms-history-copy small, .ms-invoice-copy small { color: var(--ms-muted); font-size: .68rem; }
    .ms-history-price { font-size: .82rem; }
    .ms-invoice-item ion-icon { color: var(--ms-accent); font-size: 20px; }
    .ms-invoice-right { display: grid; justify-items: end; gap: 2px; }
    .ms-inv-status { color: var(--ms-emerald); font-size: .72rem; font-weight: 800; letter-spacing: .01em; }

    /* States & Skeletons */
    .ms-state { min-height: 60vh; display: grid; place-items: center; align-content: center; gap: 12px; padding: 40px 16px; text-align: center; }
    .ms-state-icon { width: 64px; height: 64px; display: grid; place-items: center; margin-bottom: 4px; border-radius: 22px; color: var(--ms-accent); background: var(--ms-accent-soft); font-size: 26px; }
    .ms-state h1 { margin: 0; font-size: 1.75rem; letter-spacing: -.04em; }
    .ms-state p { max-width: 480px; margin: 0; color: var(--ms-muted); font-size: .86rem; line-height: 1.55; }
    .ms-state .ms-choice-list { max-width: 480px; margin-top: 14px; text-align: left; }
    .ms-onboarding-copy { display: grid; gap: 3px; width: min(100%, 480px); margin-top: 10px; text-align: left; }
    .ms-onboarding-copy strong { color: var(--ms-ink); font-size: .86rem; }
    .ms-onboarding-copy small { color: var(--ms-muted); font-size: .72rem; line-height: 1.35; }
    .ms-primary-button { min-height: 48px; margin-top: 10px; --background: var(--ms-accent); --background-hover: var(--ms-accent); --border-radius: 999px; --box-shadow: none; }
    .ms-onboarding-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 12px; }
    .ms-onboarding-actions .ms-primary-button { margin-top: 0; }
    .ms-outline-button { min-height: 48px; padding: 0 20px; border: 1px solid color-mix(in srgb, var(--ms-accent) 38%, var(--ms-line)); border-radius: 999px; color: var(--ms-accent); background: var(--ms-ivory); font: inherit; font-weight: 900; cursor: pointer; }
    .ms-loading { display: grid; gap: 14px; padding-top: 16px; }
    @keyframes ms-shimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }

    .ms-skeleton { min-height: 96px; border-radius: 22px; background: linear-gradient(100deg, #ebe7df 20%, #f7f4ef 38%, #ebe7df 58%); background-size: 220% 100%; animation: ms-shimmer 1.5s linear infinite; }
    .ms-skeleton-hero { min-height: 280px; border-radius: 26px; }
    .ms-skeleton-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; }
    .ms-skeleton-wide { min-height: 150px; }

    .ms-picker, .ms-hero, .ms-snapshot-item, .ms-appointment, .ms-empty-panel, .ms-rebook-card, .ms-offer, .ms-empty-line, .ms-staff, .ms-benefit, .ms-wallet-card, .ms-gift-card {
      border-width: 1px;
      border-style: solid;
      border-radius: var(--ms-radius-card);
      box-shadow: var(--ms-elevation-soft);
    }
    .ms-choice {
      border-radius: var(--ms-radius-item);
    }
    .ms-picker, .ms-hero, .ms-offer, .ms-benefit, .ms-wallet-card {
      padding: var(--ms-card-padding);
    }
    .ms-choice, .ms-gift-card, .ms-empty-line {
      padding: var(--ms-item-padding);
    }
    .ms-profile-button, .ms-empty-panel > a, .ms-rebook-action, .ms-offer-book, .ms-service-book-btn, .ms-primary-button {
      min-height: var(--ms-button-height);
      border-radius: 999px;
    }
    .ms-picker, .ms-section, .ms-benefit-grid, .ms-wallet-container {
      gap: var(--ms-gap);
    }
    .ms-kicker, .ms-snap-top, .ms-status-chip, .ms-rebook-tag, .ms-benefit-chip, .ms-wallet-top span, .ms-tx-head, .ms-gift-status, .ms-inv-status, .ms-relationship-label {
      font-size: var(--ms-type-label);
      letter-spacing: 0.01em;
      line-height: var(--ms-lh-tight);
      text-transform: none;
    }
    .ms-section-head h2, .ms-picker-head h2 {
      line-height: 1.16;
      letter-spacing: -0.025em;
    }
    .ms-hero h1 {
      line-height: 1.06;
      letter-spacing: -0.032em;
    }
    .ms-appointment h3, .ms-empty-panel h3, .ms-offer h3, .ms-benefit h3 {
      font-size: var(--ms-type-title);
      line-height: 1.2;
      letter-spacing: -0.015em;
    }
    .ms-snapshot-item strong, .ms-wallet-amount {
      line-height: 1.12;
      letter-spacing: -0.02em;
    }
    .ms-picker-note, .ms-contact-item, .ms-appointment p, .ms-empty-panel p, .ms-offer p, .ms-state p {
      font-size: var(--ms-type-body);
      line-height: var(--ms-lh-body);
    }
    .ms-choice-copy small, .ms-snapshot-item small, .ms-rebook-info small, .ms-offer-footer small, .ms-service-copy small, .ms-staff small, .ms-benefit > small, .ms-gift-card small, .ms-history-copy small, .ms-invoice-copy small {
      font-size: var(--ms-type-small);
      line-height: 1.35;
    }
    .ms-service-copy strong, .ms-history-copy strong, .ms-invoice-copy strong, .ms-staff strong, .ms-choice-copy strong, .ms-gift-card strong {
      font-size: var(--ms-type-title);
      line-height: 1.2;
      letter-spacing: -0.01em;
    }
    .ms-profile-button:active, .ms-rebook-action:active, .ms-offer-book:active, .ms-service-book-btn:active, .ms-primary-button:active, .ms-arrow-link:active, .ms-staff:active, .ms-snapshot-item:active {
      transform: scale(.99);
    }

    @media (hover: none) {
      .ms-snapshot-item:hover, .ms-staff:hover {
        transform: none;
        box-shadow: var(--ms-elevation-soft);
      }
    }

    @media (max-width: 699px) {
      .ms-hero {
        gap: 11px;
        padding: 13px;
        border-radius: 20px;
        background:
          radial-gradient(circle at 8% 8%, rgba(124, 99, 223, .12), transparent 34%),
          linear-gradient(145deg, #ffffff 0%, rgba(250, 248, 255, .94) 100%);
        box-shadow: 0 10px 24px rgba(28,28,28,.055);
      }
      .ms-hero-main { grid-template-columns: 48px minmax(0,1fr); gap: 11px; }
      .ms-salon-mark { width: 48px; height: 48px; border-radius: 16px; font-size: .84rem; }
      .ms-hero-copy { gap: 2px; }
      .ms-hero .ms-kicker { font-size: .62rem; font-weight: 850; line-height: 1.1; }
      .ms-hero h1 { font-size: clamp(1.35rem, 7vw, 1.58rem); line-height: .98; }
      .ms-status-line { gap: 7px; margin-top: 1px; font-size: .66rem; line-height: 1.15; }
      .ms-dot { width: 7px; height: 7px; box-shadow: 0 0 0 2px rgba(244,63,94,.18); }
      .ms-status.is-open .ms-dot { box-shadow: 0 0 0 2px rgba(16,185,129,.22); }
      .ms-hours-chip { font-size: .65rem; }
      .ms-hours-chip ion-icon { font-size: .78rem; }
      .ms-hero-actions { gap: 0; }
      .ms-profile-button {
        min-height: 40px;
        padding-inline: 14px;
        border-color: rgba(124, 99, 223, .2);
        font-size: .76rem;
        font-weight: 900;
        box-shadow: inset 0 1px rgba(255,255,255,.9), 0 6px 14px rgba(95,70,207,.055);
      }

      .ms-relationship { gap: 10px; margin-top: 22px; }
      .ms-section-head { align-items: flex-start; }
      .ms-section-head > div { gap: 2px; }
      .ms-section-head h2 { font-size: clamp(1.18rem, 5.4vw, 1.38rem); line-height: 1.02; }
      .ms-section-head .ms-kicker { font-size: .62rem; font-weight: 900; }
      .ms-relationship-label { min-height: 24px; padding: 5px 9px; font-size: .62rem; }
      .ms-snapshot { gap: 7px; }
      .ms-snapshot-item {
        min-height: 74px;
        gap: 2px;
        padding: 9px 10px;
        border-radius: 16px;
        background: linear-gradient(145deg, #ffffff, rgba(248, 246, 255, .78));
        box-shadow: inset 0 1px rgba(255,255,255,.9), 0 5px 14px rgba(28,28,28,.035);
      }
      .ms-snap-top { gap: 6px; font-size: .57rem; font-weight: 900; line-height: 1.05; }
      .ms-snap-top ion-icon { width: 20px; height: 20px; padding: 4px; border-radius: 7px; font-size: 13px; }
      .ms-snapshot-item strong { font-size: .9rem; line-height: 1.02; }
      .ms-snapshot-item small { display: -webkit-box; overflow: hidden; font-size: .58rem; line-height: 1.18; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

      .ms-schedule-section,
      .ms-offers-section { gap: 10px; margin-top: 24px; }
      .ms-schedule-section .ms-section-head > a,
      .ms-offers-section .ms-section-head > a {
        min-height: 30px;
        padding: 0 10px;
        border: 1px solid rgba(124, 99, 223, .14);
        border-radius: 999px;
        background: rgba(124, 99, 223, .07);
        font-size: .65rem;
        font-weight: 900;
        white-space: nowrap;
      }
      .ms-empty-panel {
        grid-template-columns: 38px minmax(0,1fr);
        gap: 10px;
        padding: 13px;
        border-style: solid;
        border-color: rgba(124, 99, 223, .13);
        border-radius: 18px;
        background: linear-gradient(145deg, #fff, rgba(250, 248, 255, .82));
        box-shadow: inset 0 1px rgba(255,255,255,.9), 0 8px 18px rgba(28,28,28,.04);
      }
      .ms-empty-icon { width: 38px; height: 38px; border-radius: 13px; font-size: 18px; }
      .ms-empty-panel h3 { font-size: .92rem; line-height: 1.08; }
      .ms-empty-panel p { display: -webkit-box; overflow: hidden; font-size: .66rem; line-height: 1.28; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .ms-empty-panel > a {
        grid-column: 1 / -1;
        min-height: 39px;
        margin-top: 2px;
        font-size: .74rem;
        font-weight: 900;
        box-shadow: 0 10px 18px rgba(95,70,207,.18);
      }
      .ms-appointment {
        grid-template-columns: 48px minmax(0,1fr) 36px;
        gap: 9px;
        padding: 12px 10px 12px 12px;
        border-radius: 18px;
      }
      .ms-date-tile { width: 48px; height: 56px; border-radius: 15px; }
      .ms-date-tile strong { font-size: 1.35rem; }
      .ms-arrow-link { width: 36px; height: 36px; }
      .ms-rebook-card {
        gap: 9px;
        padding: 10px 11px;
        border-color: rgba(124, 99, 223, .13);
        border-radius: 16px;
        background: linear-gradient(145deg, #fff, rgba(250, 248, 255, .72));
        box-shadow: 0 7px 16px rgba(28,28,28,.035);
      }
      .ms-rebook-info { min-width: 0; gap: 1px; }
      .ms-rebook-tag { font-size: .6rem; font-weight: 950; }
      .ms-rebook-info strong,
      .ms-rebook-info small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ms-rebook-info strong { font-size: .78rem; }
      .ms-rebook-info small { font-size: .62rem; }
      .ms-rebook-action { flex: 0 0 auto; min-height: 34px; padding: 0 11px; font-size: .66rem; font-weight: 900; }
      .ms-offer-rail { grid-auto-columns: minmax(220px, 78vw); gap: 9px; margin-inline: -13px; padding: 1px 13px 6px; }
      .ms-offer { min-height: 132px; gap: 6px; padding: 14px; border-radius: 18px; }
      .ms-offer-value { padding: 4px 8px; font-size: .58rem; }
      .ms-offer h3 { margin-top: 2px; font-size: .98rem; line-height: 1.08; }
      .ms-offer p { font-size: .66rem; line-height: 1.28; }
      .ms-offer-book { padding: 6px 10px; font-size: .64rem; font-weight: 900; }
      .ms-offers-section .ms-empty-line {
        display: grid;
        grid-template-columns: minmax(0,1fr) auto;
        align-items: center;
        gap: 10px;
        min-height: 0;
        padding: 11px 12px;
        border-color: rgba(124, 99, 223, .12);
        border-radius: 16px;
        background: linear-gradient(145deg, #fff, rgba(250, 248, 255, .74));
      }
      .ms-offers-section .ms-empty-line span { font-size: .68rem; line-height: 1.25; }
      .ms-offers-section .ms-empty-line a { min-height: 32px; display: inline-flex; align-items: center; padding: 0 10px; border-radius: 999px; background: var(--ms-accent-soft); font-size: .65rem; font-weight: 900; text-align: center; text-decoration: none; white-space: nowrap; }

      .ms-services-section { gap: 10px; margin-top: 24px; }
      .ms-services-section .ms-section-head > a {
        min-height: 30px;
        padding: 0 10px;
        border: 1px solid rgba(124, 99, 223, .14);
        border-radius: 999px;
        background: rgba(124, 99, 223, .07);
        font-size: .65rem;
        font-weight: 900;
        white-space: nowrap;
      }
      .ms-service-list {
        gap: 0;
        overflow: hidden;
        border: 1px solid rgba(124, 99, 223, .12);
        border-radius: 18px;
        background: linear-gradient(145deg, #fff, rgba(250, 248, 255, .72));
        box-shadow: 0 8px 18px rgba(28,28,28,.035);
      }
      .ms-service {
        min-height: 58px;
        grid-template-columns: 24px minmax(0,1fr) auto;
        gap: 8px;
        padding: 9px 10px;
        border-bottom-color: rgba(124, 99, 223, .1);
      }
      .ms-service-index { font-size: .62rem; font-weight: 950; }
      .ms-service-copy { gap: 1px; }
      .ms-service-copy strong { font-size: .78rem; line-height: 1.12; }
      .ms-service-copy small { font-size: .58rem; line-height: 1.15; }
      .ms-service-right {
        display: grid;
        justify-items: end;
        gap: 5px;
      }
      .ms-service-price { font-size: .72rem; font-weight: 950; line-height: 1; }
      .ms-service-book-btn {
        min-width: 42px;
        min-height: 30px;
        padding: 0 10px;
        border-radius: 12px;
        font-size: .62rem;
        font-weight: 950;
        box-shadow: 0 7px 14px rgba(95,70,207,.18), inset 0 1px rgba(255,255,255,.22);
      }

      .ms-team-section { gap: 10px; margin-top: 24px; }
      .ms-team-section .ms-section-head > a {
        min-height: 30px;
        padding: 0 10px;
        border: 1px solid rgba(124, 99, 223, .14);
        border-radius: 999px;
        background: rgba(124, 99, 223, .07);
        font-size: .65rem;
        font-weight: 900;
        white-space: nowrap;
      }
      .ms-team-section .ms-staff-rail {
        grid-auto-columns: 104px;
        gap: 7px;
        margin-inline: -13px;
        padding: 1px 13px 7px;
      }
      .ms-team-section .ms-staff {
        min-height: 116px;
        gap: 3px;
        padding: 9px 7px 8px;
        border-color: rgba(124, 99, 223, .14);
        border-radius: 16px;
        background: linear-gradient(145deg, #fff, rgba(250, 248, 255, .76));
        box-shadow: inset 0 1px rgba(255,255,255,.9), 0 6px 16px rgba(28,28,28,.035);
      }
      .ms-team-section .ms-staff-avatar { width: 38px; height: 38px; border-radius: 13px; font-size: .68rem; }
      .ms-team-section .ms-staff strong { font-size: .66rem; line-height: 1.08; -webkit-line-clamp: 2; }
      .ms-team-section .ms-staff small { font-size: .52rem; line-height: 1.05; }
      .ms-team-section .ms-staff-action {
        max-width: 92px;
        min-height: 22px;
        padding: 0 7px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: .5rem;
        font-weight: 950;
      }

      .ms-wallet-section,
      .ms-history-section { gap: 10px; margin-top: 24px; }
      .ms-wallet-section .ms-section-head > a,
      .ms-history-section .ms-section-head > a {
        min-height: 30px;
        padding: 0 10px;
        border: 1px solid rgba(124, 99, 223, .14);
        border-radius: 999px;
        background: rgba(124, 99, 223, .07);
        font-size: .65rem;
        font-weight: 900;
        white-space: nowrap;
      }
      .ms-wallet-container { gap: 8px; }
      .ms-wallet-card {
        padding: 12px 13px;
        border-color: rgba(124, 99, 223, .13);
        border-radius: 18px;
        background: linear-gradient(145deg, #fff, rgba(250, 248, 255, .78));
        box-shadow: inset 0 1px rgba(255,255,255,.9), 0 8px 18px rgba(28,28,28,.04);
      }
      .ms-wallet-top { align-items: start; gap: 12px; }
      .ms-wallet-top span { font-size: .64rem; font-weight: 900; line-height: 1.1; }
      .ms-wallet-amount { font-size: 1.25rem; line-height: .95; }
      .ms-wallet-hint { margin-top: 8px; font-size: .66rem; line-height: 1.28; }
      .ms-tx-list { gap: 6px; margin-top: 8px; }
      .ms-tx-head { font-size: .58rem; }
      .ms-tx-item { gap: 8px; font-size: .64rem; }
      .ms-gift-card {
        min-height: 54px;
        padding: 10px 11px;
        border-radius: 16px;
      }
      .ms-gift-card ion-icon { font-size: 18px; }
      .ms-gift-card strong { font-size: .7rem; }
      .ms-gift-card small { font-size: .58rem; }
      .ms-gift-status { font-size: .56rem; }

      .ms-history-list {
        gap: 0;
        overflow: hidden;
        border: 1px solid rgba(124, 99, 223, .12);
        border-radius: 18px;
        background: linear-gradient(145deg, #fff, rgba(250, 248, 255, .72));
        box-shadow: 0 8px 18px rgba(28,28,28,.035);
      }
      .ms-history-item {
        min-height: 52px;
        grid-template-columns: 42px minmax(0,1fr) auto 14px;
        gap: 8px;
        padding: 9px 10px;
        border-bottom-color: rgba(124, 99, 223, .1);
      }
      .ms-history-date { font-size: .6rem; font-weight: 950; }
      .ms-history-copy { gap: 1px; }
      .ms-history-copy strong { font-size: .72rem; line-height: 1.12; }
      .ms-history-copy small { font-size: .58rem; line-height: 1.15; }
      .ms-history-price { font-size: .7rem; font-weight: 950; }
      .ms-history-section .ms-empty-line {
        min-height: 0;
        padding: 11px 12px;
        border-color: rgba(124, 99, 223, .12);
        border-radius: 16px;
        background: linear-gradient(145deg, #fff, rgba(250, 248, 255, .74));
        font-size: .68rem;
        line-height: 1.25;
      }

    }

    @media (max-width: 380px) {
      .ms-page { padding-inline: 12px; }
      .ms-hero-main { grid-template-columns: 54px minmax(0,1fr); gap: 12px; }
      .ms-salon-mark { width: 54px; height: 54px; border-radius: 18px; }
      .ms-snapshot { gap: 8px; }
      .ms-appointment { grid-template-columns: 52px minmax(0,1fr) 40px; gap: 10px; padding: 14px 10px 14px 14px; }
      .ms-date-tile { width: 52px; height: 64px; border-radius: 16px; }
      .ms-service { grid-template-columns: 24px minmax(0,1fr); gap: 8px; }
      .ms-service-right { grid-column: 2; justify-content: space-between; width: 100%; }
      .ms-services-section .ms-service { grid-template-columns: 22px minmax(0,1fr) auto; }
      .ms-services-section .ms-service-right { grid-column: auto; width: auto; }
      .ms-gift-card, .ms-history-item, .ms-invoice-item { gap: 8px; }
      .ms-offer-rail { grid-auto-columns: minmax(236px, 86vw); }
      .ms-staff-rail { grid-auto-columns: 132px; }
      .ms-team-section .ms-staff-rail { grid-auto-columns: 100px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .ms-page *, .ms-page *::before, .ms-page *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }
    }

    @media (min-width: 430px) {
      .ms-hero-actions { grid-template-columns: 1.15fr .85fr; }
    }
    @media (min-width: 700px) {
      .ms-page { padding-inline: 28px; }
      .ms-hero { grid-template-columns: minmax(0,1.2fr) minmax(260px,.8fr); align-items: center; padding: 32px; }
      .ms-hero-main { grid-column: 1; }
      .ms-contact-list { grid-column: 1; }
      .ms-hero-actions { grid-column: 2; grid-row: 1 / span 2; grid-template-columns: 1fr; align-self: stretch; align-content: end; }
      .ms-snapshot { grid-template-columns: repeat(4, minmax(0,1fr)); }
      .ms-offer-rail { grid-auto-columns: minmax(280px, 38%); margin-inline: 0; padding-inline: 0; }
      .ms-staff-rail { margin-inline: 0; padding-inline: 0; }
      .ms-benefit-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
    }
    @media (min-width: 1024px) {
      .ms-page { padding-top: calc(58px + env(safe-area-inset-top)); padding-bottom: calc(88px + env(safe-area-inset-bottom)); }
      .ms-service-list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); column-gap: 32px; }
    }
  `]
})
export class MySalonPage implements OnInit {
  readonly dash = signal<MySalonDashboard | null>(null);
  readonly loading = signal(this.marketplace.mySalonDashboard() === null);
  readonly loadError = signal("");
  readonly selectingSalon = signal(false);
  readonly salonPickerOpen = signal(false);
  readonly serviceQuery = signal("");

  readonly salonChoices = computed(() => {
    const choices = new Map<string, CustomerSalonRelationship>();
    const add = (salon: CustomerSalonRelationship | null | undefined) => {
      if (!salon?.tenantId || !salon.branchId || !salon.businessId) return;
      choices.set(`${salon.tenantId}:${salon.branchId}`, salon);
    };
    add(this.marketplace.suggestedSalon());
    this.marketplace.mySalons().forEach(add);
    return [...choices.values()].sort((left, right) => {
      const visits = this.safeCount(right.visitCount) - this.safeCount(left.visitCount);
      if (visits !== 0) return visits;
      return this.dateValue(right.lastVisitAt) - this.dateValue(left.lastVisitAt);
    });
  });

  readonly upcomingBooking = computed(() => {
    const now = Date.now();
    return this.dash()?.recentBookings
      .filter((booking) => this.dateValue(booking.startAt) >= now && !this.isClosedBooking(booking.status))
      .sort((left, right) => this.dateValue(left.startAt) - this.dateValue(right.startAt))[0] ?? null;
  });

  readonly rebookCandidate = computed(() => {
    const isRebookable = (booking: MySalonDashboard["recentBookings"][number]): boolean => {
      const status = String(booking.status || "").toLowerCase();
      if (status === "cancelled" || status === "no_show") return false;
      return this.dateValue(booking.startAt) < Date.now() || status === "completed";
    };
    return this.dash()?.recentBookings.filter(isRebookable).sort((left, right) => this.dateValue(right.startAt) - this.dateValue(left.startAt))[0] ?? null;
  });

  readonly packageCredits = computed(() => this.dash()?.packages.reduce(
    (total, item) => total + this.remainingSessions(item.sessionsTotal, item.sessionsUsed), 0
  ) ?? 0);

  readonly filteredServices = computed(() => {
    const query = this.serviceQuery().trim().toLowerCase();
    let services = this.dash()?.services || [];
    if (query) {
      services = services.filter((s) =>
        s.name.toLowerCase().includes(query)
        || (s.category || "").toLowerCase().includes(query));
    }
    return services;
  });

  readonly topRecommendedServices = computed(() => {
    const services = this.filteredServices();
    const searching = !!this.serviceQuery().trim();
    const sorted = [...services].sort((a, b) => a.pricePaise - b.pricePaise || a.name.localeCompare(b.name));
    return searching ? sorted : sorted.slice(0, 5);
  });

  constructor(
    readonly marketplace: MarketplaceService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    addIcons({
      calendarOutline,
      callOutline,
      chevronForwardOutline,
      giftOutline,
      locationOutline,
      peopleOutline,
      receiptOutline,
      refreshOutline,
      ribbonOutline,
      searchOutline,
      sparklesOutline,
      starOutline,
      swapHorizontalOutline,
      timeOutline,
      walletOutline
    });
  }

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(["/login"]);
      return;
    }
    if (!this.marketplace.salonMode() && typeof window !== "undefined" && !window.confirm("Open My Salon mode?")) {
      void this.router.navigateByUrl("/tabs/home");
      return;
    }
    this.syncRouteSalonContext();
    this.marketplace.enterSalonMode(this.currentSalonContext());
    void this.loadDashboard(true).then(() => {
      const current = this.router.url.split(/[?#]/)[0].replace(/\/+$/, "");
      if (current === "/tabs/my-salon" && this.currentSalonContext().tenantId && this.currentSalonContext().branchId) {
        void this.router.navigateByUrl(this.scopedUrl(), { replaceUrl: true });
      }
    });
  }

  /**
   * Silent re-entry hook used by the route-reuse strategy. Previously loaded
   * content stays visible while the dashboard refreshes in the background.
   */
  onTabReenter(): void {
    if (this.auth.isAuthenticated()) void this.loadDashboard(true);
  }

  async loadDashboard(force = false): Promise<void> {
    this.loadError.set("");
    // Only show the full-page skeleton when nothing has ever been rendered;
    // a re-fetch must never blank out already-visible content.
    if (!this.dash()) this.loading.set(true);
    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await Promise.all([
          this.marketplace.loadMySalons(force).catch(() => undefined),
          this.marketplace.loadBookings().catch(() => undefined)
        ]);
        const dashboard = await this.marketplace.loadMySalonDashboard(force);
        this.dash.set(dashboard);
        if (!dashboard) this.loadError.set("This salon space is currently unavailable.");
        if (this.dash()?.salon) this.marketplace.enterSalonMode(this.currentSalonContext());
        this.loading.set(false);
        return;
      } catch {
        lastError = this.marketplace.error() || "Please check your network connection and try again.";
        if (this.isAuthFailure(lastError)) {
          this.marketplace.exitSalonMode();
          this.loading.set(false);
          this.loadError.set("Please sign in again to open My Salon.");
          void this.router.navigate(["/login"]);
          return;
        }
        if (attempt < 3) await this.sleep(450 * attempt);
      }
    }
    // Keep last known content on transient failures; only blank on a true first load.
    if (!this.dash()) this.dash.set(null);
    this.loadError.set(lastError);
    this.loading.set(false);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isAuthFailure(message: string): boolean {
    return /session expired|sign in|unauthorized|reconnect to your session/i.test(message);
  }

  exitSalonMode(): void {
    if (!this.confirmLeaveSalonMode()) return;
    this.marketplace.exitSalonMode();
    void this.router.navigateByUrl("/tabs/home");
  }

  openSalonSearch(): void {
    this.marketplace.exitSalonMode();
    void this.router.navigateByUrl("/tabs/search");
  }

  private confirmLeaveSalonMode(): boolean {
    return typeof window === "undefined" || window.confirm("Exit My Salon mode and go back to the customer app?");
  }

  toggleSalonPicker(): void {
    this.salonPickerOpen.update((open) => !open);
  }

  onServiceSearch(event: Event): void {
    this.serviceQuery.set(String((event.target as HTMLInputElement).value));
  }

  async selectSalon(salon: CustomerSalonRelationship): Promise<void> {
    if (this.selectingSalon() || this.isSelectedSalon(salon)) {
      this.salonPickerOpen.set(false);
      return;
    }
    this.selectingSalon.set(true);
    this.loadError.set("");
    try {
      await this.marketplace.setPrimarySalon(salon.tenantId, salon.branchId, salon.businessId, salon.businessName);
      this.marketplace.enterSalonMode({ tenantId: salon.tenantId, branchId: salon.branchId, businessId: salon.businessId, businessName: salon.businessName });
      this.salonPickerOpen.set(false);
      await this.loadDashboard(true);
      await this.router.navigateByUrl(this.scopedUrl());
    } catch {
      this.loadError.set(this.marketplace.error() || "Could not switch salon. Please try again.");
      this.salonPickerOpen.set(false);
    } finally {
      this.selectingSalon.set(false);
    }
  }

  isSelectedSalon(salon: CustomerSalonRelationship): boolean {
    const primary = this.marketplace.primarySalon();
    return primary?.tenantId === salon.tenantId && primary.branchId === salon.branchId;
  }

  scopedLink(...segments: Array<string | number | null | undefined>): string {
    return this.scopedUrl(...segments.filter((segment): segment is string | number => segment !== null && segment !== undefined));
  }

  historyInvoiceParams(booking: MySalonDashboard["recentBookings"][number]): { invoiceId: string } | null {
    return booking.invoiceId ? { invoiceId: booking.invoiceId } : null;
  }

  visitHistory(dashboard: MySalonDashboard): MySalonDashboard["recentBookings"] {
    return dashboard.recentBookings
      .filter((booking) => ["completed", "billed", "paid", "no_show", "no-show"].includes(String(booking.status || "").toLowerCase()))
      .slice(0, 3);
  }

  salonBookLink(salon: MySalonDashboard["salon"]): string {
    return salon?.slug ? this.scopedLink("business", salon.slug, "book") : this.scopedLink();
  }

  salonProfileLink(salon: MySalonDashboard["salon"]): string {
    return salon?.slug ? this.scopedLink("business", salon.slug) : this.scopedLink();
  }

  private scopedUrl(...segments: Array<string | number>): string {
    const context = this.currentSalonContext();
    if (!context.tenantId || !context.branchId) return "/tabs/home";
    const encoded = segments.map((segment) => encodeURIComponent(String(segment))).join("/");
    return `/my-salon/${encodeURIComponent(context.tenantId)}/${encodeURIComponent(context.branchId)}${encoded ? `/${encoded}` : ""}`;
  }

  private currentSalonContext(): { tenantId: string; branchId: string; businessId?: string; businessName?: string } {
    const salon = this.dash()?.salon;
    const primary = this.marketplace.primarySalon();
    const stored = this.marketplace.salonModeContext();
    const tenantId = salon?.tenantId || primary?.tenantId || this.route.snapshot.paramMap.get("tenantId") || stored?.tenantId || "";
    const branchId = salon?.branchId || primary?.branchId || this.route.snapshot.paramMap.get("branchId") || stored?.branchId || "";
    return {
      tenantId,
      branchId,
      businessId: primary?.businessId || stored?.businessId,
      businessName: salon?.name || primary?.businessName || stored?.businessName
    };
  }

  private syncRouteSalonContext(): void {
    const tenantId = this.route.snapshot.paramMap.get("tenantId");
    const branchId = this.route.snapshot.paramMap.get("branchId");
    if (!tenantId || !branchId) return;
    this.marketplace.syncSalonModeContext({ tenantId, branchId });
  }

  salonInitials(name: string): string {
    const words = String(name || "Salon").trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "S";
  }

  shortSalonName(name: string): string {
    const words = String(name || "Salon").trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).join(" ") || "Salon";
  }

  staffInitials(name: string): string {
    return this.salonInitials(name);
  }

  formatNumber(value: number): string {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("en-IN") : "0";
  }

  formatDate(iso: string): string {
    const date = this.validDate(iso);
    return date ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "Date unavailable";
  }

  formatTime(iso: string): string {
    const date = this.validDate(iso);
    return date ? date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "Time unavailable";
  }

  datePart(iso: string, part: "day" | "month"): string {
    const date = this.validDate(iso);
    if (!date) return "—";
    return date.toLocaleDateString("en-IN", part === "day"
      ? { day: "numeric", timeZone: "Asia/Kolkata" }
      : { month: "short", timeZone: "Asia/Kolkata" });
  }

  safeRating(average: number, count: number): string | null {
    const rating = Number(average);
    return Number.isFinite(rating) && this.safeCount(count) > 0 ? rating.toFixed(1) : null;
  }

  validPrice(value: number): boolean {
    return Number.isFinite(Number(value)) && Number(value) >= 0;
  }

  validHistoryPrice(value: number): boolean {
    return Number.isFinite(Number(value)) && Number(value) > 0;
  }

  safeDuration(minutes: number): string {
    const value = this.safeCount(minutes);
    return value > 0 ? `${value} min` : "Duration on request";
  }

  safeCount(value: number): number {
    const count = Number(value);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  }

  remainingSessions(total: number, used: number): number {
    return Math.max(0, this.safeCount(total) - this.safeCount(used));
  }

  packageProgress(total: number, used: number): number {
    const safeTotal = this.safeCount(total);
    return safeTotal ? Math.min(100, (this.safeCount(used) / safeTotal) * 100) : 0;
  }

  serviceIndex(index: number): string {
    return String(index + 1).padStart(2, "0");
  }

  statusLabel(status: string): string {
    const value = String(status || "Available").replace(/[_-]+/g, " ").trim();
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Available";
  }

  relationshipLabel(type: string): string {
    const labels: Record<string, string> = { guest: "New guest", returning: "Returning", regular: "Regular Client", loyal: "Loyal Client", booked: "Booked" };
    return labels[type] || this.statusLabel(type || "Your salon");
  }

  salonVisitLabel(salon: CustomerSalonRelationship): string {
    const visits = this.safeCount(salon.visitCount);
    if (!visits) return "Connected salon";
    return `${visits} visit${visits === 1 ? "" : "s"}`;
  }

  walletTxCount(wallet: MySalonDashboard["wallet"]): string {
    if (!wallet?.transactions?.length) return "Salon prepaid balance";
    const count = wallet.transactions.length;
    return `${count} transaction${count === 1 ? "" : "s"}`;
  }

  offerDiscount(type: string, value: number): string {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return "Salon Offer";
    if (type === "percentage") return `${amount.toLocaleString("en-IN", { maximumFractionDigits: 1 })}% OFF`;
    return `${this.marketplace.formatMoney(amount * 100)} OFF`;
  }

  private isClosedBooking(status: string): boolean {
    return ["cancelled", "canceled", "completed", "no_show"].includes(String(status || "").toLowerCase());
  }

  private dateValue(iso: string): number {
    return this.validDate(iso)?.getTime() ?? 0;
  }

  private validDate(iso: string): Date | null {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }

}
